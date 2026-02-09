/** One line from history.jsonl — a single user prompt. */
export interface HistoryEntry {
	display: string;
	timestamp: number;
	project: string;
	sessionId: string;
	pastedContents?: Record<string, unknown>;
}

/** Lightweight session info derived from history.jsonl grouping only. Fast — no file reads. */
export interface SessionInfo {
	sessionId: string;
	project: string;
	projectName: string;
	prompts: string[];
	promptTimestamps: number[];
	timeRange: { start: number; end: number };
}

/** Session with metadata peeked from the session JSONL file (first+last lines). */
export interface SessionMeta extends SessionInfo {
	gitBranch?: string;
	model?: string;
	totalInputTokens: number;
	totalOutputTokens: number;
	cacheCreationInputTokens: number;
	cacheReadInputTokens: number;
	messageCount: number;
}

/** Full session detail from parsing the entire session JSONL file. */
export interface SessionDetail extends SessionMeta {
	assistantSummaries: string[];
	toolCalls: ToolCallSummary[];
	filesReferenced: string[];
	planReferenced: boolean;
	thinkingBlockCount: number;
	hasSidechains: boolean;
}

export type ToolCategory =
	| "file_read"
	| "file_write"
	| "shell"
	| "search"
	| "web"
	| "task"
	| "other";

export interface ToolCallSummary {
	name: string;
	displayName: string;
	category: ToolCategory;
	/** e.g. file_path for Read/Write, command for Bash */
	target?: string;
}
