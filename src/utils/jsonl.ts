/** Parse all lines from a JSONL string, skipping malformed lines. */
export function parseJsonl<T>(text: string): T[] {
	const results: T[] = [];
	for (const line of text.split("\n")) {
		if (!line.trim()) continue;
		try {
			results.push(JSON.parse(line) as T);
		} catch {
			// skip malformed
		}
	}
	return results;
}

/** Stream-parse JSONL from a file, yielding each parsed line. */
export async function* streamJsonl<T>(filePath: string): AsyncGenerator<T> {
	const file = Bun.file(filePath);
	if (!(await file.exists())) return;

	const text = await file.text();
	for (const line of text.split("\n")) {
		if (!line.trim()) continue;
		try {
			yield JSON.parse(line) as T;
		} catch {
			// skip malformed
		}
	}
}

/** Peek a JSONL file — read only first N and last N bytes for metadata extraction. */
export async function peekJsonl(
	filePath: string,
	bytes: number = 4096,
): Promise<{ first: unknown[]; last: unknown[]; totalBytes: number }> {
	const file = Bun.file(filePath);
	if (!(await file.exists())) return { first: [], last: [], totalBytes: 0 };

	const size = file.size;

	if (size <= bytes * 2) {
		// Small file: just read the whole thing
		const text = await file.text();
		const lines = parseJsonl<unknown>(text);
		return { first: lines, last: [], totalBytes: size };
	}

	// Read first chunk
	const firstChunk = await file.slice(0, bytes).text();
	const firstLines = firstChunk.split("\n").filter((l) => l.trim());
	const first: unknown[] = [];
	for (const line of firstLines.slice(0, -1)) {
		// Skip last line of chunk (may be truncated)
		try {
			first.push(JSON.parse(line));
		} catch {
			// skip
		}
	}

	// Read last chunk
	const lastChunk = await file.slice(Math.max(0, size - bytes), size).text();
	const lastLines = lastChunk.split("\n").filter((l) => l.trim());
	const last: unknown[] = [];
	for (const line of lastLines.slice(1)) {
		// Skip first line of chunk (may be truncated)
		try {
			last.push(JSON.parse(line));
		} catch {
			// skip
		}
	}

	return { first, last, totalBytes: size };
}

/** Read and parse an entire JSONL file. */
export async function readJsonl<T>(filePath: string): Promise<T[]> {
	const file = Bun.file(filePath);
	if (!(await file.exists())) return [];
	const text = await file.text();
	return parseJsonl<T>(text);
}
