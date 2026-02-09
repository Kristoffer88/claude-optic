import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { PlanInfo } from "../types/plan.js";

function isInDateRange(fileDate: Date, from: string, to: string): boolean {
	const year = fileDate.getFullYear();
	const month = String(fileDate.getMonth() + 1).padStart(2, "0");
	const day = String(fileDate.getDate()).padStart(2, "0");
	const dateStr = `${year}-${month}-${day}`;
	return dateStr >= from && dateStr <= to;
}

/** Read plans from ~/.claude/plans/*.md */
export async function readPlans(
	plansDir: string,
	from: string,
	to: string,
	includeContent: boolean = false,
): Promise<PlanInfo[]> {
	const plans: PlanInfo[] = [];

	let files: string[];
	try {
		files = await readdir(plansDir);
	} catch {
		return plans;
	}

	for (const file of files) {
		if (!file.endsWith(".md")) continue;
		const filePath = join(plansDir, file);

		const fileStat = await stat(filePath).catch(() => null);
		if (!fileStat || !isInDateRange(fileStat.mtime, from, to)) continue;

		try {
			const content = await Bun.file(filePath).text();
			const lines = content.split("\n");
			const title =
				lines.find((l) => l.startsWith("# "))?.replace("# ", "") ||
				file.replace(".md", "");
			const snippet = lines
				.filter((l) => l.trim() && !l.startsWith("#"))
				.slice(0, 3)
				.join(" ")
				.slice(0, 300);

			plans.push({
				filename: file,
				title,
				snippet,
				content: includeContent ? content : undefined,
			});
		} catch {
			// skip
		}
	}

	return plans;
}
