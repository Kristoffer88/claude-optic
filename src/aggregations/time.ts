import type { SessionInfo } from "../types/session.js";

/** Gap cap in ms — if gap between consecutive prompts exceeds this, cap it. */
const GAP_CAP_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Estimate hours of active work from session timestamp data.
 * Uses gap-capped timestamp math: gaps > 15 minutes are capped at 15 minutes,
 * preventing idle time from inflating estimates.
 */
export function estimateHours(sessions: SessionInfo[]): number {
	if (sessions.length === 0) return 0;

	let totalMs = 0;

	for (const session of sessions) {
		const timestamps = session.promptTimestamps.length > 0
			? [...session.promptTimestamps].sort((a, b) => a - b)
			: [session.timeRange.start, session.timeRange.end].filter((t) => t > 0);

		if (timestamps.length <= 1) {
			// Single prompt: count as 5 minutes of work
			totalMs += 5 * 60 * 1000;
			continue;
		}

		for (let i = 1; i < timestamps.length; i++) {
			const gap = timestamps[i] - timestamps[i - 1];
			totalMs += Math.min(gap, GAP_CAP_MS);
		}
	}

	return totalMs / (1000 * 60 * 60);
}
