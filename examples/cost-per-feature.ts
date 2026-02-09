#!/usr/bin/env bun
/**
 * cost-per-feature.ts — Match Claude sessions to git branches and calculate cost per feature.
 *
 * Usage:
 *   bun examples/cost-per-feature.ts [--repo /path/to/repo] [--from YYYY-MM-DD] [--to YYYY-MM-DD]
 *
 * Reads git log from the specified repo (or cwd) and matches branches to sessions
 * that were active on those branches. Outputs a cost breakdown per feature/branch.
 */

import { createClaudeHistory, estimateCost, type SessionMeta } from "../src/index.js";

const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
	const idx = args.indexOf(name);
	return idx !== -1 ? args[idx + 1] : undefined;
}

const repoPath = getArg("--repo") ?? process.cwd();
const from = getArg("--from") ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
const to = getArg("--to");

interface BranchInfo {
	branch: string;
	commits: number;
	lastCommit: string;
}

async function getGitBranches(): Promise<BranchInfo[]> {
	const proc = Bun.spawn(
		["git", "for-each-ref", "--sort=-committerdate", "--format=%(refname:short)\t%(committerdate:iso)", "refs/heads/"],
		{ cwd: repoPath, stdout: "pipe", stderr: "pipe" },
	);
	const text = await new Response(proc.stdout).text();
	await proc.exited;

	const branches: BranchInfo[] = [];
	for (const line of text.trim().split("\n")) {
		if (!line) continue;
		const [branch, lastCommit] = line.split("\t");

		const base = await getDefaultBranch();
		const countProc = Bun.spawn(
			["git", "rev-list", "--count", `${base}..${branch}`],
			{ cwd: repoPath, stdout: "pipe", stderr: "pipe" },
		);
		const countText = await new Response(countProc.stdout).text();
		await countProc.exited;
		const commits = parseInt(countText.trim()) || 0;

		branches.push({ branch, commits, lastCommit: lastCommit?.trim() ?? "" });
	}
	return branches;
}

async function getDefaultBranch(): Promise<string> {
	const proc = Bun.spawn(
		["git", "symbolic-ref", "--short", "HEAD"],
		{ cwd: repoPath, stdout: "pipe", stderr: "pipe" },
	);
	const text = await new Response(proc.stdout).text();
	await proc.exited;

	const current = text.trim();
	for (const candidate of ["main", "master"]) {
		const check = Bun.spawn(
			["git", "rev-parse", "--verify", candidate],
			{ cwd: repoPath, stdout: "pipe", stderr: "pipe" },
		);
		await check.exited;
		if (check.exitCode === 0) return candidate;
	}
	return current;
}

async function main() {
	const ch = createClaudeHistory();
	const sessions = await ch.sessions.listWithMeta({ from, to });

	const byBranch = new Map<string, SessionMeta[]>();
	const unmatched: SessionMeta[] = [];

	for (const s of sessions) {
		const branch = s.gitBranch ?? "unknown";
		if (branch === "unknown") {
			unmatched.push(s);
			continue;
		}
		const list = byBranch.get(branch) ?? [];
		list.push(s);
		byBranch.set(branch, list);
	}

	let gitBranches: BranchInfo[] = [];
	try {
		gitBranches = await getGitBranches();
	} catch {
		// Not in a git repo
	}
	const commitMap = new Map(gitBranches.map((b) => [b.branch, b.commits]));

	interface FeatureCost {
		branch: string;
		sessions: number;
		inputTokens: number;
		outputTokens: number;
		cacheTokens: number;
		cost: number;
		commits: number;
	}

	const features: FeatureCost[] = [];

	for (const [branch, branchSessions] of byBranch) {
		const cost = branchSessions.reduce((sum, s) => sum + estimateCost(s), 0);
		features.push({
			branch,
			sessions: branchSessions.length,
			inputTokens: branchSessions.reduce((s, x) => s + x.totalInputTokens, 0),
			outputTokens: branchSessions.reduce((s, x) => s + x.totalOutputTokens, 0),
			cacheTokens: branchSessions.reduce((s, x) => s + x.cacheCreationInputTokens + x.cacheReadInputTokens, 0),
			cost,
			commits: commitMap.get(branch) ?? 0,
		});
	}

	features.sort((a, b) => b.cost - a.cost);

	const totalCost = features.reduce((s, f) => s + f.cost, 0);
	const unmatchedCost = unmatched.reduce((s, x) => s + estimateCost(x), 0);

	console.log("Cost per Feature / Branch");
	console.log("=".repeat(90));
	console.log(
		"Feature/Branch".padEnd(35),
		"Sessions".padStart(10),
		"Tokens".padStart(12),
		"Est. Cost".padStart(12),
		"Commits".padStart(10),
	);
	console.log("-".repeat(90));

	for (const f of features) {
		const tokens = f.inputTokens + f.outputTokens + f.cacheTokens;
		console.log(
			f.branch.slice(0, 34).padEnd(35),
			String(f.sessions).padStart(10),
			formatTokens(tokens).padStart(12),
			`$${f.cost.toFixed(2)}`.padStart(12),
			String(f.commits).padStart(10),
		);
	}

	if (unmatched.length > 0) {
		const tokens = unmatched.reduce((s, x) => s + x.totalInputTokens + x.totalOutputTokens + x.cacheCreationInputTokens + x.cacheReadInputTokens, 0);
		console.log(
			"(no branch)".padEnd(35),
			String(unmatched.length).padStart(10),
			formatTokens(tokens).padStart(12),
			`$${unmatchedCost.toFixed(2)}`.padStart(12),
			"-".padStart(10),
		);
	}

	console.log("-".repeat(90));
	console.log(
		"TOTAL".padEnd(35),
		String(sessions.length).padStart(10),
		"".padStart(12),
		`$${(totalCost + unmatchedCost).toFixed(2)}`.padStart(12),
		"".padStart(10),
	);
}

function formatTokens(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
	return String(n);
}

main().catch(console.error);
