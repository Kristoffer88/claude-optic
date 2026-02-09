#!/usr/bin/env bun
/**
 * timesheet.ts — Generate a weekly timesheet from Claude session timestamps.
 *
 * Usage:
 *   bun examples/timesheet.ts [--from YYYY-MM-DD] [--to YYYY-MM-DD]
 *
 * Groups sessions by day and project, uses gap-capped hour estimation,
 * and outputs a table suitable for time tracking or invoicing.
 */

import { createClaudeHistory, toLocalDate, type SessionMeta } from "../src/index.js";

const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
	const idx = args.indexOf(name);
	return idx !== -1 ? args[idx + 1] : undefined;
}

const now = new Date();
const dayOfWeek = now.getDay();
const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
const monday = new Date(now.getTime() - mondayOffset * 86400000);

const from = getArg("--from") ?? monday.toISOString().slice(0, 10);
const to = getArg("--to") ?? now.toISOString().slice(0, 10);

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

async function main() {
	const ch = createClaudeHistory();
	const sessions = await ch.sessions.listWithMeta({ from, to });

	const byDateProject = new Map<string, Map<string, SessionMeta[]>>();

	for (const s of sessions) {
		const date = toLocalDate(new Date(s.timeRange.start));
		const project = s.projectName || "unknown";

		let projectMap = byDateProject.get(date);
		if (!projectMap) {
			projectMap = new Map();
			byDateProject.set(date, projectMap);
		}

		const list = projectMap.get(project) ?? [];
		list.push(s);
		projectMap.set(project, list);
	}

	const dates = [...byDateProject.keys()].sort();

	console.log(`Timesheet: ${from} → ${to}`);
	console.log("=".repeat(90));
	console.log(
		"Day".padEnd(6),
		"Date".padEnd(12),
		"Project".padEnd(30),
		"Hours".padStart(8),
		"Sessions".padStart(10),
		"Prompts".padStart(10),
	);
	console.log("-".repeat(90));

	let totalHours = 0;
	let totalSessions = 0;
	let totalPrompts = 0;

	for (const date of dates) {
		const projectMap = byDateProject.get(date)!;
		const dayName = DAYS[new Date(date + "T12:00:00").getDay()];
		let first = true;

		const projects = [...projectMap.entries()].map(([project, sess]) => ({
			project,
			sessions: sess,
			hours: ch.aggregate.estimateHours(sess),
			prompts: sess.reduce((s, x) => s + x.prompts.length, 0),
		}));
		projects.sort((a, b) => b.hours - a.hours);

		for (const p of projects) {
			console.log(
				(first ? dayName : "").padEnd(6),
				(first ? date : "").padEnd(12),
				p.project.slice(0, 29).padEnd(30),
				p.hours.toFixed(1).padStart(8),
				String(p.sessions.length).padStart(10),
				String(p.prompts).padStart(10),
			);
			totalHours += p.hours;
			totalSessions += p.sessions.length;
			totalPrompts += p.prompts;
			first = false;
		}
	}

	console.log("-".repeat(90));
	console.log(
		"".padEnd(6),
		"TOTAL".padEnd(12),
		"".padEnd(30),
		totalHours.toFixed(1).padStart(8),
		String(totalSessions).padStart(10),
		String(totalPrompts).padStart(10),
	);

	const allByProject = new Map<string, SessionMeta[]>();
	for (const s of sessions) {
		const project = s.projectName || "unknown";
		const list = allByProject.get(project) ?? [];
		list.push(s);
		allByProject.set(project, list);
	}

	console.log(`\nSummary by Project`);
	console.log("-".repeat(50));

	const projectTotals = [...allByProject.entries()]
		.map(([project, sess]) => ({ project, hours: ch.aggregate.estimateHours(sess) }))
		.sort((a, b) => b.hours - a.hours);

	for (const p of projectTotals) {
		console.log(`  ${p.project.padEnd(30)} ${p.hours.toFixed(1).padStart(8)}h`);
	}
}

main().catch(console.error);
