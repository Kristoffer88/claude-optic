import type { ContentBlock } from "../types/transcript.js";
import type { ToolCallSummary } from "../types/session.js";
import { categorizeToolName, toolDisplayName } from "./tool-categories.js";

/** Extract text content from message content (string or ContentBlock[]). */
export function extractText(content: string | ContentBlock[] | undefined): string {
	if (!content) return "";
	if (typeof content === "string") return content;
	return content
		.filter((b): b is ContentBlock & { text: string } => b.type === "text" && !!b.text)
		.map((b) => b.text)
		.join("\n");
}

/** Extract tool call summaries from content blocks. */
export function extractToolCalls(content: string | ContentBlock[] | undefined): ToolCallSummary[] {
	if (!content || typeof content === "string") return [];

	return content
		.filter((b): b is ContentBlock & { name: string } => b.type === "tool_use" && !!b.name)
		.map((b) => ({
			name: b.name,
			displayName: toolDisplayName(b.name, b.input as Record<string, unknown> | undefined),
			category: categorizeToolName(b.name),
			target: extractToolTarget(b),
		}));
}

/** Extract file paths referenced in tool use blocks. */
export function extractFilePaths(content: string | ContentBlock[] | undefined): string[] {
	if (!content || typeof content === "string") return [];

	const paths: string[] = [];
	for (const block of content) {
		if (block.type !== "tool_use" || !block.input) continue;
		const input = block.input as Record<string, string>;
		if (input.file_path) paths.push(input.file_path);
		if (input.notebook_path) paths.push(input.notebook_path);
	}
	return paths;
}

/** Count thinking blocks in content. */
export function countThinkingBlocks(content: string | ContentBlock[] | undefined): number {
	if (!content || typeof content === "string") return 0;
	return content.filter((b) => b.type === "thinking").length;
}

function extractToolTarget(block: ContentBlock): string | undefined {
	const input = block.input as Record<string, string> | undefined;
	if (!input) return undefined;
	if (input.file_path) return input.file_path;
	if (input.notebook_path) return input.notebook_path;
	if (input.command) return input.command.split(" ")[0];
	if (input.pattern) return input.pattern;
	if (input.query) return input.query.slice(0, 80);
	return undefined;
}
