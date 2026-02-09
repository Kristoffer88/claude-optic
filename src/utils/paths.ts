import { homedir } from "node:os";
import { join } from "node:path";

/** Encode a project path for filesystem storage (/ → -). */
export function encodeProjectPath(projectPath: string): string {
	return projectPath.replace(/\//g, "-");
}

/** Decode an encoded project path back to original (- → /). Best-effort: ambiguous. */
export function decodeProjectPath(encoded: string): string {
	return encoded.replace(/-/g, "/");
}

/** Extract a short project name from a full path. */
export function projectName(projectPath: string): string {
	return projectPath.split("/").pop() || projectPath;
}

/** Build all standard paths relative to a claude directory. */
export function claudePaths(claudeDir?: string) {
	const base = claudeDir ?? join(homedir(), ".claude");
	return {
		base,
		historyFile: join(base, "history.jsonl"),
		projectsDir: join(base, "projects"),
		tasksDir: join(base, "tasks"),
		plansDir: join(base, "plans"),
		todosDir: join(base, "todos"),
		skillsDir: join(base, "skills"),
		statsCache: join(base, "stats-cache.json"),
	};
}
