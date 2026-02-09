import { join } from "node:path";
import type { PrivacyConfig } from "../types/privacy.js";
import type { SessionDetail, SessionInfo, ToolCallSummary } from "../types/session.js";
import type { TranscriptEntry } from "../types/transcript.js";
import { encodeProjectPath } from "../utils/paths.js";
import { filterTranscriptEntry } from "../privacy/redact.js";
import { extractText, extractToolCalls, extractFilePaths, countThinkingBlocks } from "./content-blocks.js";

/**
 * Parse a full session JSONL file into a SessionDetail.
 * This is the "full" tier — reads and parses every line.
 */
export async function parseSessionDetail(
	session: SessionInfo,
	projectsDir: string,
	privacy: PrivacyConfig,
): Promise<SessionDetail> {
	const detail: SessionDetail = {
		...session,
		totalInputTokens: 0,
		totalOutputTokens: 0,
		cacheCreationInputTokens: 0,
		cacheReadInputTokens: 0,
		messageCount: 0,
		assistantSummaries: [],
		toolCalls: [],
		filesReferenced: [],
		planReferenced: false,
		thinkingBlockCount: 0,
		hasSidechains: false,
	};

	const encoded = encodeProjectPath(session.project);
	const filePath = join(projectsDir, encoded, `${session.sessionId}.jsonl`);
	const file = Bun.file(filePath);

	if (!(await file.exists())) return detail;

	const text = await file.text();
	const lines = text.split("\n");

	const toolCallSet = new Map<string, ToolCallSummary>();
	const fileSet = new Set<string>();
	let gitBranch: string | undefined;
	let model: string | undefined;

	for (const line of lines) {
		if (!line.trim()) continue;

		let entry: TranscriptEntry;
		try {
			entry = JSON.parse(line);
		} catch {
			continue;
		}

		// Apply privacy filtering
		const filtered = filterTranscriptEntry(entry, privacy);
		if (!filtered) continue;

		// Track sidechains
		if (filtered.isSidechain) {
			detail.hasSidechains = true;
		}

		// Extract git branch
		if (!gitBranch && filtered.gitBranch && filtered.gitBranch !== "HEAD") {
			gitBranch = filtered.gitBranch;
		}

		// Track plan references
		if ((filtered as { planContent?: string }).planContent) {
			detail.planReferenced = true;
		}

		if (!filtered.message) continue;

		const { role, content, model: msgModel, usage } = filtered.message;

		// Extract model
		if (msgModel && !model) {
			model = msgModel;
		}

		// Accumulate tokens
		if (usage) {
			detail.totalInputTokens += usage.input_tokens ?? 0;
			detail.totalOutputTokens += usage.output_tokens ?? 0;
			detail.cacheCreationInputTokens += usage.cache_creation_input_tokens ?? 0;
			detail.cacheReadInputTokens += usage.cache_read_input_tokens ?? 0;
		}

		// Count messages
		if (role === "user" || role === "assistant") {
			detail.messageCount++;
		}

		// Process assistant messages
		if (role === "assistant" && content) {
			const text = extractText(content);
			if (text && text.length > 20) {
				detail.assistantSummaries.push(
					text.slice(0, 200) + (text.length > 200 ? "..." : ""),
				);
			}

			for (const tc of extractToolCalls(content)) {
				toolCallSet.set(tc.displayName, tc);
			}

			for (const fp of extractFilePaths(content)) {
				fileSet.add(fp);
			}

			detail.thinkingBlockCount += countThinkingBlocks(content);
		}
	}

	detail.toolCalls = [...toolCallSet.values()];
	detail.filesReferenced = [...fileSet];
	detail.gitBranch = gitBranch;
	detail.model = model;

	// Limit summaries
	detail.assistantSummaries = detail.assistantSummaries.slice(0, 10);

	return detail;
}

/**
 * Parse multiple sessions, splitting into detailed (3+ prompts) and short.
 */
export async function parseSessions(
	sessions: SessionInfo[],
	projectsDir: string,
	privacy: PrivacyConfig,
): Promise<{ detailed: SessionDetail[]; short: SessionInfo[] }> {
	const detailed: SessionDetail[] = [];
	const short: SessionInfo[] = [];

	for (const session of sessions) {
		if (session.prompts.length >= 3) {
			detailed.push(await parseSessionDetail(session, projectsDir, privacy));
		} else {
			short.push(session);
		}
	}

	return { detailed, short };
}
