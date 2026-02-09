// Main factory
export { createClaudeHistory } from "./claude-optic.js";
export type { ClaudeHistory, ClaudeHistoryConfig } from "./claude-optic.js";

// Types
export type {
	HistoryEntry,
	SessionInfo,
	SessionMeta,
	SessionDetail,
	ToolCategory,
	ToolCallSummary,
} from "./types/session.js";

export type { ContentBlock, TranscriptEntry } from "./types/transcript.js";

export type { TaskInfo, TodoItem } from "./types/task.js";

export type { PlanInfo } from "./types/plan.js";

export type { ProjectInfo, ProjectMemory } from "./types/project.js";

export type { StatsCache } from "./types/stats.js";

export type {
	DailySummary,
	ProjectSummary,
	ToolUsageReport,
	DateFilter,
	SessionListFilter,
} from "./types/aggregations.js";

export type { PrivacyConfig, PrivacyProfile } from "./types/privacy.js";

// Privacy profiles (runtime values, not just types)
export { PRIVACY_PROFILES, resolvePrivacyConfig } from "./privacy/config.js";

// Utilities (for advanced users)
export { encodeProjectPath, decodeProjectPath, projectName, claudePaths } from "./utils/paths.js";
export { toLocalDate, today, formatTime, resolveDateRange } from "./utils/dates.js";
export { parseJsonl, streamJsonl, peekJsonl, readJsonl } from "./utils/jsonl.js";

// Parsers (for advanced users building custom pipelines)
export { parseSessionDetail, parseSessions } from "./parsers/session-detail.js";
export { categorizeToolName, toolDisplayName } from "./parsers/tool-categories.js";
export { extractText, extractToolCalls, extractFilePaths, countThinkingBlocks } from "./parsers/content-blocks.js";

// Pricing
export type { ModelPricing } from "./pricing.js";
export { MODEL_PRICING, getModelPricing, estimateCost, setPricing } from "./pricing.js";

// Readers (for advanced users)
export { readProjectMemories } from "./readers/project-reader.js";
