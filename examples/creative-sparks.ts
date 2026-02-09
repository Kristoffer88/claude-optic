#!/usr/bin/env bun
/**
 * creative-sparks.ts — Find sessions with creative, ambitious, or novel prompts.
 *
 * Usage:
 *   bun examples/creative-sparks.ts [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--top 20]
 *
 * Scores sessions by signals of creative/ambitious work:
 * - Keywords indicating exploration, design, or ambition
 * - High message counts (deep conversations)
 * - Many tool calls (active building)
 * - Long prompts (detailed thinking)
 */

import { createClaudeHistory, type SessionDetail } from "../src/index.js";

const args = process.argv.slice(2);
function getArg(name: string, fallback: string): string {
	const idx = args.indexOf(name);
	return idx !== -1 ? (args[idx + 1] ?? fallback) : fallback;
}

const from = getArg("--from", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
const to = getArg("--to", new Date().toISOString().slice(0, 10));
const topN = parseInt(getArg("--top", "20"));

const CREATIVE_KEYWORDS = [
	"design", "architect", "prototype", "explore", "experiment",
	"what if", "could we", "imagine", "creative", "novel",
	"innovative", "ambitious", "build", "create", "invent",
	"brainstorm", "refactor", "reimagine", "rethink", "vision",
	"from scratch", "new approach", "better way", "redesign",
	"framework", "platform", "system", "engine", "pipeline",
];

const AMBITIOUS_PATTERNS = [
	/implement .{20,}/i,   // Long implementation requests
	/build (a|an|the) /i,  // Building something new
	/create (a|an|the) /i, // Creating something new
	/design (a|an|the) /i, // Designing something
	/let's .{15,}/i,       // Collaborative exploration
	/plan .{10,}/i,        // Planning something
];

function scoreSession(detail: SessionDetail): number {
	let score = 0;
	const allPrompts = detail.prompts.join(" ").toLowerCase();

	for (const kw of CREATIVE_KEYWORDS) {
		if (allPrompts.includes(kw)) score += 2;
	}

	for (const pattern of AMBITIOUS_PATTERNS) {
		if (pattern.test(allPrompts)) score += 3;
	}

	const avgPromptLen = allPrompts.length / Math.max(detail.prompts.length, 1);
	score += Math.floor(avgPromptLen / 200);
	score += Math.floor(detail.messageCount / 10);
	score += Math.floor(detail.toolCalls.length / 20);

	const writes = detail.toolCalls.filter((t) => t.category === "file_write").length;
	score += Math.floor(writes / 5) * 2;

	if (detail.prompts.length >= 10) score += 5;
	if (detail.prompts.length >= 20) score += 5;

	return score;
}

async function main() {
	const ch = createClaudeHistory();

	const sessions = await ch.sessions.listWithMeta({ from, to });
	const candidates = sessions.filter((s) => s.prompts.length >= 3);

	console.log(`Scanning ${candidates.length} sessions for creative sparks...`);

	const scored: Array<{ detail: SessionDetail; score: number }> = [];

	for (const s of candidates) {
		try {
			const detail = await ch.sessions.detail(s.sessionId, s.project);
			const score = scoreSession(detail);
			if (score > 0) scored.push({ detail, score });
		} catch {
			// Skip sessions that can't be parsed
		}
	}

	scored.sort((a, b) => b.score - a.score);
	const top = scored.slice(0, topN);

	console.log(`\nTop ${Math.min(topN, top.length)} Creative Sessions`);
	console.log("=".repeat(100));

	for (const { detail, score } of top) {
		const date = new Date(detail.timeRange.start).toLocaleDateString("en-CA");
		const firstPrompt = detail.prompts[0]?.slice(0, 80) ?? "(empty)";

		console.log(`\n  Score: ${score}  |  ${date}  |  ${detail.projectName}`);
		console.log(`  ${detail.prompts.length} prompts, ${detail.messageCount} messages, ${detail.toolCalls.length} tool calls`);
		console.log(`  Branch: ${detail.gitBranch ?? "none"}  |  Model: ${detail.model ?? "unknown"}`);
		console.log(`  First prompt: "${firstPrompt}${detail.prompts[0]?.length > 80 ? "..." : ""}"`);

		const allText = detail.prompts.join(" ").toLowerCase();
		const matched = CREATIVE_KEYWORDS.filter((kw) => allText.includes(kw));
		if (matched.length > 0) {
			console.log(`  Keywords: ${matched.join(", ")}`);
		}
	}

	console.log(`\n${"─".repeat(60)}`);
	console.log(`${scored.length} sessions scored, showing top ${top.length}`);
}

main().catch(console.error);
