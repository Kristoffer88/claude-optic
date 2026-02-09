import type { PrivacyConfig } from "../types/privacy.js";
import type { ToolUsageReport, SessionListFilter } from "../types/aggregations.js";
import type { ToolCategory, ToolCallSummary } from "../types/session.js";
import { readHistory } from "../readers/history-reader.js";
import { parseSessionDetail } from "../parsers/session-detail.js";
import { resolveDateRange } from "../utils/dates.js";

/** Build a tool usage report from session data. */
export async function buildToolUsageReport(
	filter: SessionListFilter,
	historyFile: string,
	projectsDir: string,
	privacy: PrivacyConfig,
): Promise<ToolUsageReport> {
	const { from, to } = resolveDateRange(filter);
	const sessions = await readHistory(historyFile, from, to, privacy);

	const byTool = new Map<string, number>();
	const byCategory = new Map<ToolCategory, number>();
	const fileCounts = new Map<string, number>();
	const commandCounts = new Map<string, number>();
	let total = 0;

	for (const session of sessions) {
		if (session.prompts.length < 2) continue; // skip trivial sessions
		const detail = await parseSessionDetail(session, projectsDir, privacy);

		for (const tc of detail.toolCalls) {
			byTool.set(tc.name, (byTool.get(tc.name) ?? 0) + 1);
			byCategory.set(tc.category, (byCategory.get(tc.category) ?? 0) + 1);
			total++;

			if (tc.target) {
				if (tc.category === "file_read" || tc.category === "file_write") {
					fileCounts.set(tc.target, (fileCounts.get(tc.target) ?? 0) + 1);
				}
				if (tc.category === "shell") {
					commandCounts.set(tc.target, (commandCounts.get(tc.target) ?? 0) + 1);
				}
			}
		}
	}

	const topFiles = [...fileCounts.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 20)
		.map(([path, count]) => ({ path, count }));

	const topCommands = [...commandCounts.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 20)
		.map(([command, count]) => ({ command, count }));

	return { byTool, byCategory, topFiles, topCommands, total };
}
