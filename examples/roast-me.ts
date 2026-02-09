#!/usr/bin/env bun
/**
 * roast-me.ts — Analyze your Claude work patterns: late nights, weekend work,
 * longest sessions, most tokens burned, and overwork detection.
 *
 * Usage:
 *   bun examples/roast-me.ts [--from YYYY-MM-DD] [--to YYYY-MM-DD]
 */

import { createClaudeHistory, estimateCost, type SessionMeta } from "../src/index.js";

const args = process.argv.slice(2);
function getArg(name: string, fallback: string): string {
	const idx = args.indexOf(name);
	return idx !== -1 ? (args[idx + 1] ?? fallback) : fallback;
}

const from = getArg("--from", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
const to = getArg("--to", new Date().toISOString().slice(0, 10));

function getHour(ts: number): number {
	return new Date(ts).getHours();
}

function isWeekend(ts: number): boolean {
	const day = new Date(ts).getDay();
	return day === 0 || day === 6;
}

function durationMinutes(s: SessionMeta): number {
	return (s.timeRange.end - s.timeRange.start) / 60000;
}

function formatDuration(minutes: number): string {
	const h = Math.floor(minutes / 60);
	const m = Math.round(minutes % 60);
	return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

async function main() {
	const ch = createClaudeHistory();
	const sessions = await ch.sessions.listWithMeta({ from, to });

	if (sessions.length === 0) {
		console.log("No sessions found. Nothing to roast.");
		return;
	}

	const totalCost = sessions.reduce((s, x) => s + estimateCost(x), 0);
	const totalHours = ch.aggregate.estimateHours(sessions);
	const totalTokens = sessions.reduce(
		(s, x) => s + x.totalInputTokens + x.totalOutputTokens + x.cacheCreationInputTokens + x.cacheReadInputTokens,
		0,
	);

	const hourBuckets = new Array(24).fill(0);
	for (const s of sessions) {
		hourBuckets[getHour(s.timeRange.start)]++;
	}

	const lateNight = sessions.filter((s) => {
		const h = getHour(s.timeRange.start);
		return h >= 22 || h < 5;
	});
	const weekend = sessions.filter((s) => isWeekend(s.timeRange.start));
	const byDuration = [...sessions].sort((a, b) => durationMinutes(b) - durationMinutes(a));
	const byCost = [...sessions].sort((a, b) => estimateCost(b) - estimateCost(a));

	const byDate = new Map<string, number>();
	for (const s of sessions) {
		const date = new Date(s.timeRange.start).toLocaleDateString("en-CA");
		byDate.set(date, (byDate.get(date) ?? 0) + 1);
	}
	const busiestDay = [...byDate.entries()].sort((a, b) => b[1] - a[1])[0];

	const peakHour = hourBuckets.indexOf(Math.max(...hourBuckets));

	console.log("Your Claude Work Pattern Analysis");
	console.log("=".repeat(60));

	console.log(`\nPeriod: ${from} → ${to}`);
	console.log(`Total sessions: ${sessions.length}`);
	console.log(`Total estimated hours: ${totalHours.toFixed(1)}h`);
	console.log(`Total tokens: ${(totalTokens / 1_000_000).toFixed(1)}M`);
	console.log(`Total estimated cost: $${totalCost.toFixed(2)}`);

	console.log(`\n--- Work Schedule ---`);
	console.log(`Peak hour: ${peakHour}:00 (${hourBuckets[peakHour]} sessions)`);
	console.log(`Late-night sessions (10pm-5am): ${lateNight.length} (${((lateNight.length / sessions.length) * 100).toFixed(0)}%)`);
	console.log(`Weekend sessions: ${weekend.length} (${((weekend.length / sessions.length) * 100).toFixed(0)}%)`);

	if (busiestDay) {
		console.log(`Busiest day: ${busiestDay[0]} (${busiestDay[1]} sessions)`);
	}

	console.log(`\n--- Activity by Hour ---`);
	const maxBucket = Math.max(...hourBuckets);
	for (let h = 6; h < 30; h++) {
		const hour = h % 24;
		const count = hourBuckets[hour];
		const bar = count > 0 ? "█".repeat(Math.ceil((count / maxBucket) * 30)) : "";
		const label = `${String(hour).padStart(2, "0")}:00`;
		console.log(`  ${label} ${bar} ${count > 0 ? count : ""}`);
	}

	console.log(`\n--- Longest Sessions ---`);
	for (const s of byDuration.slice(0, 5)) {
		const date = new Date(s.timeRange.start).toLocaleDateString("en-CA");
		const dur = formatDuration(durationMinutes(s));
		console.log(`  ${dur.padEnd(10)} ${date}  ${s.projectName}  (${s.prompts.length} prompts)`);
	}

	console.log(`\n--- Most Expensive Sessions ---`);
	for (const s of byCost.slice(0, 5)) {
		const date = new Date(s.timeRange.start).toLocaleDateString("en-CA");
		const cost = estimateCost(s);
		console.log(`  $${cost.toFixed(2).padEnd(10)} ${date}  ${s.projectName}  ${s.model ?? "unknown"}`);
	}

	console.log(`\n--- The Roast ---`);
	const roasts: string[] = [];

	if (lateNight.length > sessions.length * 0.2) {
		roasts.push(`You had ${lateNight.length} late-night sessions. Your code reviewer is melatonin.`);
	}
	if (weekend.length > sessions.length * 0.3) {
		roasts.push(`${weekend.length} weekend sessions. Work-life balance is just a suggestion, apparently.`);
	}
	if (totalCost > 50) {
		roasts.push(`You've burned $${totalCost.toFixed(2)} in tokens. That's real money on robot opinions.`);
	}
	if (byDuration[0] && durationMinutes(byDuration[0]) > 180) {
		roasts.push(`Your longest session was ${formatDuration(durationMinutes(byDuration[0]))}. That's not a session, that's a relationship.`);
	}
	const avgPrompts = sessions.reduce((s, x) => s + x.prompts.length, 0) / sessions.length;
	if (avgPrompts < 3) {
		roasts.push(`Average ${avgPrompts.toFixed(1)} prompts per session. Are you even trying, or just warming up the API?`);
	}
	if (avgPrompts > 15) {
		roasts.push(`Average ${avgPrompts.toFixed(1)} prompts per session. You don't need an AI, you need a rubber duck.`);
	}

	if (roasts.length === 0) {
		roasts.push("Honestly? Your work patterns look pretty healthy. How boring.");
	}

	for (const roast of roasts) {
		console.log(`  ${roast}`);
	}
}

main().catch(console.error);
