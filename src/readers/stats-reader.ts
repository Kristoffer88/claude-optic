import type { StatsCache } from "../types/stats.js";

/** Read the pre-computed stats cache from ~/.claude/stats-cache.json */
export async function readStats(statsPath: string): Promise<StatsCache | null> {
	const file = Bun.file(statsPath);
	if (!(await file.exists())) return null;
	try {
		return (await file.json()) as StatsCache;
	} catch {
		return null;
	}
}
