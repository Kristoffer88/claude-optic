/** Convert a timestamp (ms) to YYYY-MM-DD in local time. */
export function toLocalDate(timestamp: number): string {
	const d = new Date(timestamp);
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

/** Get today's date as YYYY-MM-DD. */
export function today(): string {
	return toLocalDate(Date.now());
}

/** Format a timestamp to HH:MM (24h). */
export function formatTime(timestamp: number): string {
	const d = new Date(timestamp);
	const h = String(d.getHours()).padStart(2, "0");
	const m = String(d.getMinutes()).padStart(2, "0");
	return `${h}:${m}`;
}

/** Resolve a DateFilter to concrete from/to strings. */
export function resolveDateRange(filter?: {
	date?: string;
	from?: string;
	to?: string;
}): { from: string; to: string } {
	if (filter?.date) {
		return { from: filter.date, to: filter.date };
	}
	if (filter?.from && filter?.to) {
		return { from: filter.from, to: filter.to };
	}
	if (filter?.from) {
		return { from: filter.from, to: today() };
	}
	const t = today();
	return { from: t, to: t };
}
