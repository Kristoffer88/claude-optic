/** A single content block inside an assistant message. */
export interface ContentBlock {
	type: "text" | "thinking" | "tool_use" | "tool_result";
	text?: string;
	thinking?: string;
	name?: string;
	id?: string;
	tool_use_id?: string;
	input?: Record<string, unknown>;
	content?: string | ContentBlock[];
}

/** Raw line from a session JSONL file. Union of all possible shapes. */
export interface TranscriptEntry {
	type?: "user" | "assistant" | "progress" | "file-history-snapshot";
	message?: {
		role?: "user" | "assistant";
		content?: string | ContentBlock[];
		model?: string;
		usage?: {
			input_tokens?: number;
			output_tokens?: number;
			cache_creation_input_tokens?: number;
			cache_read_input_tokens?: number;
		};
	};
	timestamp?: string;
	gitBranch?: string;
	planContent?: string;
	cwd?: string;
	sessionId?: string;
	isSidechain?: boolean;
	parentUuid?: string;
	uuid?: string;
	toolUseResult?: unknown;
}
