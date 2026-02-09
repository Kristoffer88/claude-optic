import type { PrivacyConfig } from "../types/privacy.js";
import type { HistoryEntry, SessionInfo } from "../types/session.js";
import { toLocalDate } from "../utils/dates.js";
import { projectName } from "../utils/paths.js";
import { isProjectExcluded, redactString } from "../privacy/redact.js";

/**
 * Read history.jsonl and group entries into SessionInfo objects.
 * This is the fast path — no session file reads, just history.jsonl.
 */
export async function readHistory(
	historyFile: string,
	from: string,
	to: string,
	privacy: PrivacyConfig,
): Promise<SessionInfo[]> {
	const file = Bun.file(historyFile);
	if (!(await file.exists())) return [];

	const text = await file.text();
	const entries: HistoryEntry[] = [];

	for (const line of text.split("\n")) {
		if (!line.trim()) continue;
		try {
			const entry = JSON.parse(line) as HistoryEntry;
			const entryDate = toLocalDate(entry.timestamp);

			// Early exit: skip entries outside date range
			if (entryDate < from || entryDate > to) continue;

			// Privacy: skip excluded projects
			if (isProjectExcluded(entry.project, privacy)) continue;

			entries.push(entry);
		} catch {
			// skip malformed
		}
	}

	// Group by sessionId
	const sessionMap = new Map<
		string,
		{ project: string; prompts: string[]; timestamps: number[] }
	>();

	for (const entry of entries) {
		const existing = sessionMap.get(entry.sessionId);
		const display = privacy.redactPrompts
			? "[redacted]"
			: privacy.redactPatterns.length > 0
				? redactString(entry.display, privacy)
				: entry.display;

		if (existing) {
			existing.prompts.push(display);
			existing.timestamps.push(entry.timestamp);
		} else {
			sessionMap.set(entry.sessionId, {
				project: entry.project,
				prompts: [display],
				timestamps: [entry.timestamp],
			});
		}
	}

	const sessions: SessionInfo[] = [];
	for (const [sessionId, data] of sessionMap) {
		sessions.push({
			sessionId,
			project: data.project,
			projectName: projectName(data.project),
			prompts: data.prompts,
			promptTimestamps: data.timestamps,
			timeRange: {
				start: Math.min(...data.timestamps),
				end: Math.max(...data.timestamps),
			},
		});
	}

	sessions.sort((a, b) => a.timeRange.start - b.timeRange.start);
	return sessions;
}
