import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { ProjectInfo, ProjectMemory } from "../types/project.js";
import { decodeProjectPath } from "../utils/paths.js";
import type { PrivacyConfig } from "../types/privacy.js";
import { isProjectExcluded } from "../privacy/redact.js";

/** List all projects from ~/.claude/projects/ */
export async function readProjects(
	projectsDir: string,
	privacy: PrivacyConfig,
): Promise<ProjectInfo[]> {
	const projects: ProjectInfo[] = [];

	let entries: string[];
	try {
		entries = await readdir(projectsDir);
	} catch {
		return projects;
	}

	for (const encodedPath of entries) {
		if (encodedPath.startsWith(".")) continue;

		const decodedPath = decodeProjectPath(encodedPath);

		if (isProjectExcluded(decodedPath, privacy)) continue;

		const projectDir = join(projectsDir, encodedPath);

		// Count session files
		let sessionCount = 0;
		try {
			const files = await readdir(projectDir);
			sessionCount = files.filter((f) => f.endsWith(".jsonl")).length;
		} catch {
			// skip unreadable dirs
			continue;
		}

		// Check for MEMORY.md
		const memoryPath = join(projectDir, "memory", "MEMORY.md");
		const hasMemory = await Bun.file(memoryPath).exists();

		const name = decodedPath.split("/").pop() || decodedPath;

		projects.push({
			encodedPath,
			decodedPath,
			name,
			sessionCount,
			hasMemory,
		});
	}

	return projects;
}

/** Read MEMORY.md for a project. */
export async function readProjectMemory(
	projectPath: string,
	projectsDir: string,
): Promise<ProjectMemory | null> {
	const encoded = projectPath.replace(/\//g, "-");
	const memoryPath = join(projectsDir, encoded, "memory", "MEMORY.md");

	try {
		const file = Bun.file(memoryPath);
		if (!(await file.exists())) return null;
		const content = await file.text();
		if (!content.trim()) return null;

		return {
			projectPath,
			projectName: projectPath.split("/").pop() || projectPath,
			content: content.slice(0, 2000),
		};
	} catch {
		return null;
	}
}

/** Read MEMORY.md for multiple projects. Returns Map<projectName, content>. */
export async function readProjectMemories(
	projectPaths: string[],
	projectsDir: string,
): Promise<Map<string, string>> {
	const memory = new Map<string, string>();
	const unique = [...new Set(projectPaths)];

	await Promise.all(
		unique.map(async (projectPath) => {
			const result = await readProjectMemory(projectPath, projectsDir);
			if (result) {
				memory.set(result.projectName, result.content);
			}
		}),
	);

	return memory;
}
