/** Pre-computed stats from ~/.claude/stats-cache.json */
export interface StatsCache {
	version: number;
	lastComputedDate: string;
	dailyActivity: Array<{
		date: string;
		messageCount: number;
		sessionCount: number;
		toolCallCount: number;
	}>;
	totalSessions: number;
	totalMessages: number;
	hourCounts: Record<string, number>;
	modelUsage?: Record<string, number>;
}
