export interface TaskInfo {
	id: string;
	subject: string;
	description: string;
	status: string;
	sessionDir: string;
	blocks?: string[];
	blockedBy?: string[];
}

export interface TodoItem {
	id: string;
	content: string;
	status: string;
	sessionDir: string;
}
