#!/usr/bin/env bun
/**
 * pipe-match.ts — Generic stdin matcher: pipe in any JSON array with timestamps,
 * match against Claude sessions.
 *
 * Usage:
 *   cat data.json | bun examples/pipe-match.ts [--window 30] [--field timestamp]
 *   echo '[{"timestamp":"2026-02-10T14:00:00Z","title":"Sprint planning"}]' | bun examples/pipe-match.ts
 *
 * Works with any JSON that has timestamps — PRs, issues, deploys, calendar events, etc.
 *
 * Examples with common CLIs:
 *   gh pr list --json createdAt,title | bun examples/pipe-match.ts --field createdAt
 *   gh issue list --json createdAt,title | bun examples/pipe-match.ts --field createdAt
 *   az deployment group list --query "[].{timestamp:timestamp,name:name}" -o json | bun examples/pipe-match.ts
 *
 * Expected input: JSON array of objects with a timestamp field.
 * Supported timestamp formats:
 *   - ISO 8601 string: "2026-02-10T14:00:00Z"
 *   - Unix ms: 1707580800000
 *   - Unix seconds: 1707580800
 *
 * The script auto-detects common timestamp field names:
 *   timestamp, date, created, createdAt, created_at, time, start, startDate, closedDate, etc.
 */

import { createClaudeHistory, estimateCost, type SessionMeta } from "../src/index.js";

const args = process.argv.slice(2);
function getArg(name: string, fallback: string): string {
	const idx = args.indexOf(name);
	return idx !== -1 ? (args[idx + 1] ?? fallback) : fallback;
}

const windowMinutes = parseInt(getArg("--window", "30"));
const explicitField = getArg("--field", "");

const TIMESTAMP_FIELDS = [
	"timestamp", "date", "time", "created", "createdAt", "created_at",
	"updated", "updatedAt", "updated_at", "start", "end", "startDate",
	"endDate", "closedDate", "closed_at", "completedDate", "completed_at",
	"changedDate", "resolvedDate", "activatedDate",
];

function findTimestampField(obj: Record<string, unknown>): string | null {
	if (explicitField && explicitField in obj) return explicitField;
	for (const field of TIMESTAMP_FIELDS) {
		if (field in obj) return field;
	}
	for (const [key, value] of Object.entries(obj)) {
		if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return key;
		if (typeof value === "number" && value > 1_000_000_000) return key;
	}
	return null;
}

function parseTimestamp(value: unknown): number | null {
	if (typeof value === "number") {
		return value < 1e12 ? value * 1000 : value;
	}
	if (typeof value === "string") {
		const ms = new Date(value).getTime();
		return isNaN(ms) ? null : ms;
	}
	return null;
}

function getDisplayTitle(obj: Record<string, unknown>): string {
	for (const field of ["title", "name", "subject", "summary", "description", "message", "display"]) {
		if (typeof obj[field] === "string") return (obj[field] as string).slice(0, 60);
	}
	for (const value of Object.values(obj)) {
		if (typeof value === "string" && value.length > 5 && value.length < 200) return value.slice(0, 60);
	}
	return JSON.stringify(obj).slice(0, 60);
}

async function main() {
	const stdin = await Bun.stdin.text();
	const trimmed = stdin.trim();

	if (!trimmed || trimmed === "[]") {
		console.log("No input data. Pipe in a JSON array with timestamped objects.");
		console.log("\nUsage:");
		console.log("  cat events.json | bun examples/pipe-match.ts");
		console.log("  echo '[{\"timestamp\":\"2026-02-10T14:00:00Z\",\"title\":\"Deploy\"}]' | bun examples/pipe-match.ts");
		return;
	}

	let items: Record<string, unknown>[];
	try {
		items = JSON.parse(trimmed);
		if (!Array.isArray(items)) {
			items = [items]; // Single object → wrap in array
		}
	} catch {
		console.error("Error: Input is not valid JSON. Expected a JSON array.");
		process.exit(1);
	}

	if (items.length === 0) {
		console.log("Empty array — nothing to match.");
		return;
	}

	const tsField = findTimestampField(items[0] as Record<string, unknown>);
	if (!tsField) {
		console.error("Error: Could not find a timestamp field in the input objects.");
		console.error("Available fields:", Object.keys(items[0]).join(", "));
		console.error("Use --field <name> to specify which field contains timestamps.");
		process.exit(1);
	}

	console.log(`Using timestamp field: "${tsField}" (${windowMinutes}min matching window)\n`);

	const parsed = items
		.map((item) => ({
			item: item as Record<string, unknown>,
			timestamp: parseTimestamp((item as Record<string, unknown>)[tsField]),
			title: getDisplayTitle(item as Record<string, unknown>),
		}))
		.filter((p) => p.timestamp !== null);

	if (parsed.length === 0) {
		console.error("Error: No valid timestamps found in the input data.");
		process.exit(1);
	}

	const minTs = Math.min(...parsed.map((p) => p.timestamp!));
	const maxTs = Math.max(...parsed.map((p) => p.timestamp!));
	const from = new Date(minTs - 86400000).toISOString().slice(0, 10);
	const to = new Date(maxTs + 86400000).toISOString().slice(0, 10);

	const ch = createClaudeHistory();
	const sessions = await ch.sessions.listWithMeta({ from, to });

	const windowMs = windowMinutes * 60 * 1000;

	console.log("Matches");
	console.log("=".repeat(100));
	console.log(
		"Item".padEnd(40),
		"Date".padEnd(12),
		"Sessions".padStart(10),
		"Project".padEnd(25),
		"Cost".padStart(10),
	);
	console.log("-".repeat(100));

	let totalMatched = 0;

	for (const { title, timestamp } of parsed) {
		const ts = timestamp!;
		const matched = sessions.filter(
			(s) => s.timeRange.start <= ts + windowMs && s.timeRange.end >= ts - windowMs,
		);

		const date = new Date(ts).toLocaleDateString("en-CA");
		const cost = matched.reduce((s, x) => s + estimateCost(x), 0);
		const project = matched[0]?.projectName ?? "-";

		console.log(
			title.slice(0, 39).padEnd(40),
			date.padEnd(12),
			(matched.length > 0 ? String(matched.length) : "-").padStart(10),
			project.slice(0, 24).padEnd(25),
			(matched.length > 0 ? `$${cost.toFixed(2)}` : "-").padStart(10),
		);

		if (matched.length > 0) totalMatched++;
	}

	console.log("-".repeat(100));
	console.log(`\n${parsed.length} items, ${totalMatched} matched to sessions`);
}

main().catch(console.error);
