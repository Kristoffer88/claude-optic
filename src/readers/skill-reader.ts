import { join } from "node:path";

/** List all skill names from ~/.claude/skills/ */
export async function readSkills(skillsDir: string): Promise<string[]> {
	const glob = new Bun.Glob("*/SKILL.md");
	const skills: string[] = [];
	try {
		for await (const path of glob.scan({ cwd: skillsDir })) {
			skills.push(path.split("/")[0]);
		}
	} catch {
		// skills dir may not exist
	}
	return skills;
}

/** Read a specific skill's SKILL.md content. */
export async function readSkillContent(
	skillsDir: string,
	name: string,
): Promise<string> {
	const filePath = join(skillsDir, name, "SKILL.md");
	const file = Bun.file(filePath);
	if (!(await file.exists())) {
		throw new Error(`Skill not found: ${name}`);
	}
	return file.text();
}
