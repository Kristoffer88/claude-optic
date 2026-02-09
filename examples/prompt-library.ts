#!/usr/bin/env bun
/**
 * prompt-library.ts — Extract unique, reusable prompts from your Claude history.
 *
 * Usage:
 *   bun examples/prompt-library.ts [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--min-length 50]
 *
 * Filters out noise (short commands, commit messages, "yes", "exit") and
 * deduplicates prompts by similarity, grouping them by intent pattern.
 */

import { createClaudeHistory } from "../src/index.js";

const args = process.argv.slice(2);
function getArg(name: string, fallback: string): string {
	const idx = args.indexOf(name);
	return idx !== -1 ? (args[idx + 1] ?? fallback) : fallback;
}

const from = getArg("--from", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
const to = getArg("--to", new Date().toISOString().slice(0, 10));
const minLength = parseInt(getArg("--min-length", "50"));

const NOISE_PATTERNS = [
	/^(yes|no|y|n|ok|okay|sure|thanks|thank you|done|exit|quit|q)$/i,
	/^(continue|go ahead|proceed|next|lgtm|looks good)$/i,
	/^\/\w+/,                          // Slash commands
	/^git (commit|push|pull|merge)/i,  // Git commands
	/^(npm|bun|yarn|pnpm) /i,         // Package manager commands
	/^[A-Z]{2,5}-\d+/,                // Jira/ticket references only
	/^https?:\/\//,                    // Just URLs
	/^\d+$/,                           // Just numbers
];

const INTENT_PATTERNS: Array<{ pattern: RegExp; category: string }> = [
	{ pattern: /^(fix|debug|resolve|troubleshoot)/i, category: "Bug Fix" },
	{ pattern: /^(add|implement|create|build|make)/i, category: "Feature" },
	{ pattern: /^(refactor|clean|simplify|improve|optimize)/i, category: "Refactor" },
	{ pattern: /^(test|write tests|add tests)/i, category: "Testing" },
	{ pattern: /^(explain|what|why|how|can you)/i, category: "Question" },
	{ pattern: /^(review|check|look at|analyze)/i, category: "Review" },
	{ pattern: /^(update|change|modify|rename)/i, category: "Update" },
	{ pattern: /^(move|migrate|port|convert)/i, category: "Migration" },
	{ pattern: /^(document|docs|readme|comment)/i, category: "Documentation" },
	{ pattern: /^(deploy|release|publish|ship)/i, category: "Deploy" },
	{ pattern: /^(design|architect|plan|think about)/i, category: "Design" },
];

function isNoise(prompt: string): boolean {
	if (prompt.length < minLength) return true;
	return NOISE_PATTERNS.some((p) => p.test(prompt.trim()));
}

function categorize(prompt: string): string {
	for (const { pattern, category } of INTENT_PATTERNS) {
		if (pattern.test(prompt.trim())) return category;
	}
	return "Other";
}

function normalize(prompt: string): string {
	return prompt.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 200);
}

async function main() {
	const ch = createClaudeHistory();
	const sessions = await ch.sessions.list({ from, to });

	const allPrompts: Array<{ text: string; project: string; date: string }> = [];
	for (const s of sessions) {
		const date = new Date(s.timeRange.start).toLocaleDateString("en-CA");
		for (const prompt of s.prompts) {
			if (!isNoise(prompt)) {
				allPrompts.push({ text: prompt, project: s.projectName, date });
			}
		}
	}

	const seen = new Map<string, { text: string; count: number; projects: Set<string>; dates: string[] }>();
	for (const p of allPrompts) {
		const key = normalize(p.text);
		const existing = seen.get(key);
		if (existing) {
			existing.count++;
			existing.projects.add(p.project);
			existing.dates.push(p.date);
		} else {
			seen.set(key, {
				text: p.text,
				count: 1,
				projects: new Set([p.project]),
				dates: [p.date],
			});
		}
	}

	const byCategory = new Map<string, typeof unique>();
	const unique = [...seen.values()];

	for (const entry of unique) {
		const cat = categorize(entry.text);
		const list = byCategory.get(cat) ?? [];
		list.push(entry);
		byCategory.set(cat, list);
	}

	console.log(`Prompt Library: ${from} → ${to}`);
	console.log(`${allPrompts.length} prompts collected, ${unique.length} unique after dedup\n`);

	const categories = [...byCategory.entries()].sort((a, b) => b[1].length - a[1].length);

	for (const [category, prompts] of categories) {
		console.log(`\n${"═".repeat(60)}`);
		console.log(`  ${category} (${prompts.length} prompts)`);
		console.log(`${"═".repeat(60)}`);

		const sorted = prompts.sort((a, b) => b.count - a.count || b.text.length - a.text.length);

		for (const p of sorted.slice(0, 15)) {
			const preview = p.text.slice(0, 100).replace(/\n/g, " ");
			const reuse = p.count > 1 ? ` (×${p.count})` : "";
			const projects = [...p.projects].join(", ");
			console.log(`\n  ${preview}${p.text.length > 100 ? "..." : ""}${reuse}`);
			console.log(`  └─ ${projects}`);
		}

		if (sorted.length > 15) {
			console.log(`\n  ... and ${sorted.length - 15} more`);
		}
	}

	const reused = unique.filter((p) => p.count > 1);
	console.log(`\n${"─".repeat(60)}`);
	console.log(`${unique.length} unique prompts across ${categories.length} categories`);
	console.log(`${reused.length} prompts used more than once`);
}

main().catch(console.error);
