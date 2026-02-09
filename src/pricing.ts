import type { SessionMeta } from "./types/session.js";

/** Per-million-token pricing in USD. */
export interface ModelPricing {
	input: number;
	output: number;
	cacheWrite: number;
	cacheRead: number;
}

/** Current Claude model pricing (USD per million tokens). */
export const MODEL_PRICING: Record<string, ModelPricing> = {
	// Opus
	"claude-opus-4-5-20250514": { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
	"claude-opus-4-6": { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },

	// Sonnet
	"claude-sonnet-4-5-20250929": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
	"claude-sonnet-4-5-20250514": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
	"claude-sonnet-4-0-20250514": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },

	// Haiku
	"claude-haiku-4-5-20251001": { input: 0.8, output: 4, cacheWrite: 1, cacheRead: 0.08 },
	"claude-haiku-3-5-20241022": { input: 0.8, output: 4, cacheWrite: 1, cacheRead: 0.08 },

	// Legacy
	"claude-3-5-sonnet-20241022": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
	"claude-3-5-sonnet-20240620": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
	"claude-3-5-haiku-20241022": { input: 0.8, output: 4, cacheWrite: 1, cacheRead: 0.08 },
	"claude-3-opus-20240229": { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
};

const FALLBACK_PRICING: ModelPricing = { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 };

let activePricing: Record<string, ModelPricing> = MODEL_PRICING;

/** Override or extend the pricing table. Merges with built-in defaults. */
export function setPricing(overrides: Record<string, ModelPricing>): void {
	activePricing = { ...MODEL_PRICING, ...overrides };
}

/** Look up pricing for a model, falling back to Sonnet rates. */
export function getModelPricing(model?: string): ModelPricing {
	if (!model) return FALLBACK_PRICING;
	return activePricing[model] ?? FALLBACK_PRICING;
}

/** Estimate USD cost of a session based on token counts and model. */
export function estimateCost(session: SessionMeta): number {
	const pricing = getModelPricing(session.model);
	const m = 1_000_000;
	return (
		(session.totalInputTokens / m) * pricing.input +
		(session.totalOutputTokens / m) * pricing.output +
		(session.cacheCreationInputTokens / m) * pricing.cacheWrite +
		(session.cacheReadInputTokens / m) * pricing.cacheRead
	);
}
