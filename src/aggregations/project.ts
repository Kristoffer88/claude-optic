import type { PrivacyConfig } from "../types/privacy.js";
import type { ProjectSummary, SessionListFilter } from "../types/aggregations.js";
import type { SessionInfo, ToolCallSummary } from "../types/session.js";
import { readHistory } from "../readers/history-reader.js";
import { parseSessionDetail } from "../parsers/session-detail.js";
import { resolveDateRange } from "../utils/dates.js";
import { projectName } from "../utils/paths.js";
import { estimateHours } from "./time.js";

/** Build per-project summaries from session data. */
export async function buildProjectSummaries(
	filter: SessionListFilter,
	historyFile: string,
	projectsDir: string,
	privacy: PrivacyConfig,
): Promise<ProjectSummary[]> {
	const { from, to } = resolveDateRange(filter);
	const sessions = await readHistory(historyFile, from, to, privacy);

	// Group by project
	const byProject = new Map<string, SessionInfo[]>();
	for (const session of sessions) {
		const name = session.projectName;
		if (filter.project && !name.toLowerCase().includes(filter.project.toLowerCase())) continue;
		const existing = byProject.get(name);
		if (existing) {
			existing.push(session);
		} else {
			byProject.set(name, [session]);
		}
	}

	const summaries: ProjectSummary[] = [];

	for (const [name, projectSessions] of byProject) {
		const allToolCalls: ToolCallSummary[] = [];
		const allFiles: string[] = [];
		const allBranches: string[] = [];
		const allModels: string[] = [];

		// Parse detailed sessions for rich data
		for (const session of projectSessions) {
			if (session.prompts.length >= 3) {
				const detail = await parseSessionDetail(session, projectsDir, privacy);
				allToolCalls.push(...detail.toolCalls);
				allFiles.push(...detail.filesReferenced);
				if (detail.gitBranch) allBranches.push(detail.gitBranch);
				if (detail.model) allModels.push(detail.model);
			}
		}

		summaries.push({
			project: projectSessions[0].project,
			projectName: name,
			sessionCount: projectSessions.length,
			promptCount: projectSessions.reduce((sum, s) => sum + s.prompts.length, 0),
			estimatedHours: estimateHours(projectSessions),
			branches: [...new Set(allBranches)],
			filesReferenced: [...new Set(allFiles)],
			toolCalls: allToolCalls,
			models: [...new Set(allModels)],
		});
	}

	return summaries.sort((a, b) => b.promptCount - a.promptCount);
}
