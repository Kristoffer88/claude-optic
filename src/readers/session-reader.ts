import { join } from "node:path";
import type { PrivacyConfig } from "../types/privacy.js";
import type { SessionInfo, SessionMeta } from "../types/session.js";
import type { TranscriptEntry } from "../types/transcript.js";
import { encodeProjectPath } from "../utils/paths.js";
import { filterTranscriptEntry } from "../privacy/redact.js";

/**
 * Peek session metadata from a session JSONL file.
 * Reads the entire file but only extracts lightweight metadata.
 * This is the "medium" tier — slower than history.jsonl only, but still avoids full parsing.
 */
export async function peekSession(
	session: SessionInfo,
	projectsDir: string,
	privacy: PrivacyConfig,
): Promise<SessionMeta> {
	const meta: SessionMeta = {
		...session,
		totalInputTokens: 0,
		totalOutputTokens: 0,
		cacheCreationInputTokens: 0,
		cacheReadInputTokens: 0,
		messageCount: 0,
	};

	const encoded = encodeProjectPath(session.project);
	const filePath = join(projectsDir, encoded, `${session.sessionId}.jsonl`);
	const file = Bun.file(filePath);
	if (!(await file.exists())) return meta;

	try {
		const text = await file.text();
		for (const line of text.split("\n")) {
			if (!line.trim()) continue;
			try {
				const entry = JSON.parse(line) as TranscriptEntry;

				// Extract git branch from first occurrence
				if (!meta.gitBranch && entry.gitBranch && entry.gitBranch !== "HEAD") {
					meta.gitBranch = entry.gitBranch;
				}

				// Extract model from first assistant message
				if (!meta.model && entry.message?.model) {
					meta.model = entry.message.model;
				}

				// Accumulate token usage
				const usage = entry.message?.usage;
				if (usage) {
					meta.totalInputTokens += usage.input_tokens ?? 0;
					meta.totalOutputTokens += usage.output_tokens ?? 0;
					meta.cacheCreationInputTokens += usage.cache_creation_input_tokens ?? 0;
					meta.cacheReadInputTokens += usage.cache_read_input_tokens ?? 0;
				}

				// Count messages (user + assistant only)
				if (entry.message?.role === "user" || entry.message?.role === "assistant") {
					meta.messageCount++;
				}
			} catch {
				// skip malformed
			}
		}
	} catch {
		// file unreadable
	}

	return meta;
}

/**
 * Stream transcript entries from a session JSONL file with privacy filtering.
 */
export async function* streamTranscript(
	sessionId: string,
	projectPath: string,
	projectsDir: string,
	privacy: PrivacyConfig,
): AsyncGenerator<TranscriptEntry> {
	const encoded = encodeProjectPath(projectPath);
	const filePath = join(projectsDir, encoded, `${sessionId}.jsonl`);
	const file = Bun.file(filePath);
	if (!(await file.exists())) return;

	const text = await file.text();
	for (const line of text.split("\n")) {
		if (!line.trim()) continue;
		try {
			const entry = JSON.parse(line) as TranscriptEntry;
			const filtered = filterTranscriptEntry(entry, privacy);
			if (filtered) yield filtered;
		} catch {
			// skip malformed
		}
	}
}
