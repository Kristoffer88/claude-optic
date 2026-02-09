import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { TaskInfo, TodoItem } from "../types/task.js";

function isSameDate(fileDate: Date, targetDate: string): boolean {
	const year = fileDate.getFullYear();
	const month = String(fileDate.getMonth() + 1).padStart(2, "0");
	const day = String(fileDate.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}` === targetDate;
}

function isInDateRange(fileDate: Date, from: string, to: string): boolean {
	const year = fileDate.getFullYear();
	const month = String(fileDate.getMonth() + 1).padStart(2, "0");
	const day = String(fileDate.getDate()).padStart(2, "0");
	const dateStr = `${year}-${month}-${day}`;
	return dateStr >= from && dateStr <= to;
}

/** Read tasks from ~/.claude/tasks/{sessionDir}/*.json */
export async function readTasks(
	tasksDir: string,
	from: string,
	to: string,
): Promise<TaskInfo[]> {
	const tasks: TaskInfo[] = [];

	let sessionDirs: string[];
	try {
		sessionDirs = await readdir(tasksDir);
	} catch {
		return tasks;
	}

	for (const sessionDir of sessionDirs) {
		const dirPath = join(tasksDir, sessionDir);
		const dirStat = await stat(dirPath).catch(() => null);
		if (!dirStat?.isDirectory()) continue;

		let files: string[];
		try {
			files = await readdir(dirPath);
		} catch {
			continue;
		}

		for (const file of files) {
			if (!file.endsWith(".json")) continue;
			const filePath = join(dirPath, file);

			const fileStat = await stat(filePath).catch(() => null);
			if (!fileStat || !isInDateRange(fileStat.mtime, from, to)) continue;

			try {
				const content = await Bun.file(filePath).json();
				if (
					content.subject &&
					(content.status === "completed" || content.status === "in_progress")
				) {
					tasks.push({
						id: content.id,
						subject: content.subject,
						description: content.description || "",
						status: content.status,
						sessionDir,
						blocks: content.blocks,
						blockedBy: content.blockedBy,
					});
				}
			} catch {
				// skip malformed
			}
		}
	}

	return tasks;
}

/** Read todos from ~/.claude/todos/*.json */
export async function readTodos(
	todosDir: string,
	from: string,
	to: string,
): Promise<TodoItem[]> {
	const todos: TodoItem[] = [];

	let files: string[];
	try {
		files = await readdir(todosDir);
	} catch {
		return todos;
	}

	for (const file of files) {
		if (!file.endsWith(".json")) continue;
		const filePath = join(todosDir, file);

		const fileStat = await stat(filePath).catch(() => null);
		if (!fileStat || !isInDateRange(fileStat.mtime, from, to)) continue;

		try {
			const content = await Bun.file(filePath).json();
			if (content.content) {
				todos.push({
					id: content.id || file.replace(".json", ""),
					content: content.content,
					status: content.status || "unknown",
					sessionDir: content.sessionDir || "",
				});
			}
		} catch {
			// skip malformed
		}
	}

	return todos;
}
