#!/usr/bin/env bun
/**
 * match-git-commits.ts — Correlate git commits with Claude sessions by timestamp proximity.
 *
 * Usage:
 *   bun examples/match-git-commits.ts [--repo /path/to/repo] [--days 7] [--window 30] [--all-projects]
 *
 * For each recent git commit, finds which Claude sessions were active around
 * that time and estimates the token cost of producing that commit.
 * By default, only matches sessions for the same project. Use --all-projects to match all.
 */

import { createClaudeHistory, estimateCost, projectName, type SessionMeta } from "../src/index.js";
import { resolve } from "node:path";

const args = process.argv.slice(2);
function getArg(name: string, fallback: string): string {
	const idx = args.indexOf(name);
	return idx !== -1 ? (args[idx + 1] ?? fallback) : fallback;
}

const repoPath = resolve(getArg("--repo", process.cwd()));
const days = parseInt(getArg("--days", "7"));
const windowMinutes = parseInt(getArg("--window", "30"));
const allProjects = args.includes("--all-projects");

interface GitCommit {
	hash: string;
	author: string;
	date: string;
	timestamp: number;
	message: string;
	filesChanged: number;
}

async function getGitCommits(): Promise<GitCommit[]> {
	const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
	const proc = Bun.spawn(
		["git", "log", `--since=${since}`, "--format=%H\t%an\t%aI\t%at\t%s", "--shortstat"],
		{ cwd: repoPath, stdout: "pipe", stderr: "pipe" },
	);
	const text = await new Response(proc.stdout).text();
	await proc.exited;

	const commits: GitCommit[] = [];
	const lines = text.trim().split("\n");

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line || !line.includes("\t")) continue;

		const parts = line.split("\t");
		if (parts.length < 5) continue;

		const [hash, author, date, timestamp, message] = parts;

		let filesChanged = 0;
		const nextLine = lines[i + 1]?.trim() ?? "";
		const match = nextLine.match(/(\d+) files? changed/);
		if (match) {
			filesChanged = parseInt(match[1]);
			i++; // skip stat line
		}

		commits.push({
			hash: hash.slice(0, 8),
			author,
			date,
			timestamp: parseInt(timestamp) * 1000,
			message: message.slice(0, 60),
			filesChanged,
		});
	}

	return commits;
}

function findMatchingSessions(commit: GitCommit, sessions: SessionMeta[]): SessionMeta[] {
	const windowMs = windowMinutes * 60 * 1000;
	return sessions.filter((s) => {
		return s.timeRange.start <= commit.timestamp + windowMs && s.timeRange.end >= commit.timestamp - windowMs;
	});
}

async function main() {
	const commits = await getGitCommits();
	if (commits.length === 0) {
		console.log(`No git commits found in the last ${days} days in ${repoPath}`);
		return;
	}

	const from = new Date(Date.now() - (days + 1) * 86400000).toISOString().slice(0, 10);
	const ch = createClaudeHistory();
	const repoName = projectName(repoPath);

	let sessions: SessionMeta[];
	const all = await ch.sessions.listWithMeta({ from });
	if (allProjects) {
		sessions = all;
	} else {
		sessions = all.filter((s) => {
			const sp = s.project;
			return sp === repoPath || repoPath.startsWith(sp + "/") || sp.startsWith(repoPath + "/") || s.projectName === repoName;
		});
		if (sessions.length === 0) {
			console.log(`No sessions found for project "${repoName}" (${repoPath}).`);
			console.log(`Use --all-projects to match across all projects.\n`);
			sessions = all; // Fall back to all
		}
	}

	const sessionCommitCount = new Map<string, number>();
	for (const commit of commits) {
		for (const s of findMatchingSessions(commit, sessions)) {
			sessionCommitCount.set(s.sessionId, (sessionCommitCount.get(s.sessionId) ?? 0) + 1);
		}
	}

	const scope = allProjects ? "all projects" : repoName;
	console.log(`Git Commits → Claude Sessions (last ${days} days, ${windowMinutes}min window, ${scope})`);
	console.log("=".repeat(100));
	console.log(
		"Commit".padEnd(10),
		"Date".padEnd(12),
		"Message".padEnd(40),
		"Sessions".padStart(10),
		"Est. Cost".padStart(12),
		"Files".padStart(8),
	);
	console.log("-".repeat(100));

	let totalCost = 0;
	let matchedCommits = 0;

	for (const commit of commits) {
		const matched = findMatchingSessions(commit, sessions);

		const cost = matched.reduce((sum, s) => {
			const numCommits = sessionCommitCount.get(s.sessionId) ?? 1;
			return sum + estimateCost(s) / numCommits;
		}, 0);

		const dateStr = new Date(commit.timestamp).toLocaleDateString("en-CA");

		console.log(
			commit.hash.padEnd(10),
			dateStr.padEnd(12),
			commit.message.slice(0, 39).padEnd(40),
			(matched.length > 0 ? String(matched.length) : "-").padStart(10),
			(matched.length > 0 ? `$${cost.toFixed(2)}` : "-").padStart(12),
			String(commit.filesChanged || "-").padStart(8),
		);

		if (matched.length > 0) {
			totalCost += cost;
			matchedCommits++;
		}
	}

	console.log("-".repeat(100));
	console.log(
		`\n${commits.length} commits, ${matchedCommits} matched to sessions, est. $${totalCost.toFixed(2)} total`,
	);
}

main().catch(console.error);
