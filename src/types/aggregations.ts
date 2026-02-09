import type { PlanInfo } from "./plan.js";
import type { ProjectMemory } from "./project.js";
import type { SessionDetail, SessionInfo, ToolCallSummary, ToolCategory } from "./session.js";
import type { TaskInfo, TodoItem } from "./task.js";

export interface DailySummary {
	date: string;
	sessions: SessionDetail[];
	shortSessions: SessionInfo[];
	tasks: TaskInfo[];
	plans: PlanInfo[];
	todos: TodoItem[];
	totalPrompts: number;
	totalSessions: number;
	projects: string[];
	projectMemory: Map<string, string>;
}

export interface ProjectSummary {
	project: string;
	projectName: string;
	sessionCount: number;
	promptCount: number;
	estimatedHours: number;
	branches: string[];
	filesReferenced: string[];
	toolCalls: ToolCallSummary[];
	models: string[];
}

export interface ToolUsageReport {
	byTool: Map<string, number>;
	byCategory: Map<ToolCategory, number>;
	topFiles: Array<{ path: string; count: number }>;
	topCommands: Array<{ command: string; count: number }>;
	total: number;
}

export interface DateFilter {
	date?: string;
	from?: string;
	to?: string;
}

export interface SessionListFilter extends DateFilter {
	project?: string;
}
