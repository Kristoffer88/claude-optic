#!/usr/bin/env bun
/**
 * model-costs.ts — Compare model usage and costs across your Claude sessions.
 *
 * Usage:
 *   bun examples/model-costs.ts [--from YYYY-MM-DD] [--to YYYY-MM-DD]
 *
 * Shows which models you use most, their token consumption, and estimated costs.
 */

import { createClaudeHistory, estimateCost, getModelPricing, type SessionMeta } from "../src/index.js";

const args = process.argv.slice(2);
function getArg(name: string, fallback: string): string {
	const idx = args.indexOf(name);
	return idx !== -1 ? (args[idx + 1] ?? fallback) : fallback;
}

const from = getArg("--from", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
const to = getArg("--to", new Date().toISOString().slice(0, 10));

function formatTokens(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
	return String(n);
}

function shortModel(model: string): string {
	if (model.includes("opus")) return model.replace(/claude-/, "").slice(0, 20);
	if (model.includes("sonnet")) return model.replace(/claude-/, "").slice(0, 20);
	if (model.includes("haiku")) return model.replace(/claude-/, "").slice(0, 20);
	return model.slice(0, 20);
}

interface ModelStats {
	model: string;
	sessions: number;
	inputTokens: number;
	outputTokens: number;
	cacheWriteTokens: number;
	cacheReadTokens: number;
	cost: number;
}

async function main() {
	const ch = createClaudeHistory();
	const sessions = await ch.sessions.listWithMeta({ from, to });

	const byModel = new Map<string, SessionMeta[]>();
	for (const s of sessions) {
		const model = s.model ?? "unknown";
		const list = byModel.get(model) ?? [];
		list.push(s);
		byModel.set(model, list);
	}

	const stats: ModelStats[] = [];
	for (const [model, modelSessions] of byModel) {
		stats.push({
			model,
			sessions: modelSessions.length,
			inputTokens: modelSessions.reduce((s, x) => s + x.totalInputTokens, 0),
			outputTokens: modelSessions.reduce((s, x) => s + x.totalOutputTokens, 0),
			cacheWriteTokens: modelSessions.reduce((s, x) => s + x.cacheCreationInputTokens, 0),
			cacheReadTokens: modelSessions.reduce((s, x) => s + x.cacheReadInputTokens, 0),
			cost: modelSessions.reduce((s, x) => s + estimateCost(x), 0),
		});
	}

	stats.sort((a, b) => b.cost - a.cost);

	const totalCost = stats.reduce((s, x) => s + x.cost, 0);
	const totalSessions = sessions.length;
	const totalInput = stats.reduce((s, x) => s + x.inputTokens, 0);
	const totalOutput = stats.reduce((s, x) => s + x.outputTokens, 0);

	console.log(`Model Usage & Costs: ${from} → ${to}`);
	console.log("=".repeat(100));
	console.log(
		"Model".padEnd(24),
		"Sessions".padStart(10),
		"Input".padStart(10),
		"Output".padStart(10),
		"Cache W".padStart(10),
		"Cache R".padStart(10),
		"Est. Cost".padStart(12),
	);
	console.log("-".repeat(100));

	for (const s of stats) {
		const pricing = getModelPricing(s.model);
		console.log(
			shortModel(s.model).padEnd(24),
			String(s.sessions).padStart(10),
			formatTokens(s.inputTokens).padStart(10),
			formatTokens(s.outputTokens).padStart(10),
			formatTokens(s.cacheWriteTokens).padStart(10),
			formatTokens(s.cacheReadTokens).padStart(10),
			`$${s.cost.toFixed(2)}`.padStart(12),
		);
	}

	console.log("-".repeat(100));
	console.log(
		"TOTAL".padEnd(24),
		String(totalSessions).padStart(10),
		formatTokens(totalInput).padStart(10),
		formatTokens(totalOutput).padStart(10),
		"".padStart(10),
		"".padStart(10),
		`$${totalCost.toFixed(2)}`.padStart(12),
	);

	console.log(`\n--- Cost Breakdown ---`);
	for (const s of stats) {
		const pct = totalCost > 0 ? ((s.cost / totalCost) * 100).toFixed(0) : "0";
		const bar = "█".repeat(Math.ceil((s.cost / (stats[0]?.cost || 1)) * 30));
		console.log(`  ${shortModel(s.model).padEnd(24)} ${bar} ${pct}%  ($${s.cost.toFixed(2)})`);
	}

	console.log(`\n--- Per-Session Averages ---`);
	for (const s of stats) {
		const avgCost = s.cost / s.sessions;
		const avgTokens = (s.inputTokens + s.outputTokens) / s.sessions;
		console.log(
			`  ${shortModel(s.model).padEnd(24)} $${avgCost.toFixed(3)}/session  ${formatTokens(avgTokens)} tokens/session`,
		);
	}
}

main().catch(console.error);
