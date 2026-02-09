import type { ToolCategory } from "../types/session.js";

const TOOL_CATEGORY_MAP: Record<string, ToolCategory> = {
	// File reading
	Read: "file_read",
	Glob: "file_read",
	Grep: "file_read",
	ListMcpResourcesTool: "file_read",
	ReadMcpResourceTool: "file_read",

	// File writing
	Write: "file_write",
	Edit: "file_write",
	NotebookEdit: "file_write",

	// Shell
	Bash: "shell",

	// Search
	WebSearch: "search",
	WebFetch: "web",

	// Task/agent management
	Task: "task",
	TaskCreate: "task",
	TaskUpdate: "task",
	TaskGet: "task",
	TaskList: "task",
	TaskStop: "task",
	TaskOutput: "task",
	EnterPlanMode: "task",
	ExitPlanMode: "task",
	AskUserQuestion: "task",
	Skill: "task",
};

export function categorizeToolName(name: string): ToolCategory {
	// Check direct mapping
	if (name in TOOL_CATEGORY_MAP) return TOOL_CATEGORY_MAP[name];

	// MCP tools with known patterns
	if (name.startsWith("mcp__")) {
		if (name.includes("search")) return "search";
		if (name.includes("fetch") || name.includes("read")) return "file_read";
		if (name.includes("write") || name.includes("create") || name.includes("edit")) return "file_write";
		return "other";
	}

	return "other";
}

/** Create a human-readable display name for a tool call. */
export function toolDisplayName(
	name: string,
	input?: Record<string, unknown>,
): string {
	const shortName = name.startsWith("mcp__")
		? name.split("__").pop() || name
		: name;

	if (input?.file_path && typeof input.file_path === "string") {
		const parts = input.file_path.split("/");
		const short = parts.slice(-2).join("/");
		return `${shortName}(${short})`;
	}

	if (input?.command && typeof input.command === "string") {
		const cmd = input.command.split(" ")[0];
		return `${shortName}(${cmd})`;
	}

	if (input?.pattern && typeof input.pattern === "string") {
		return `${shortName}(${input.pattern})`;
	}

	return shortName;
}
