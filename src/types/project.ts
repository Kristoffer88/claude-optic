export interface ProjectInfo {
	encodedPath: string;
	decodedPath: string;
	name: string;
	sessionCount: number;
	hasMemory: boolean;
}

export interface ProjectMemory {
	projectPath: string;
	projectName: string;
	content: string;
}
