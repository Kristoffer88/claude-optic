export interface PrivacyConfig {
	/** Replace user prompt text with [redacted] */
	redactPrompts: boolean;
	/** Strip absolute paths to relative */
	redactAbsolutePaths: boolean;
	/** Replace $HOME with ~ */
	redactHomeDir: boolean;
	/** Remove thinking blocks entirely */
	stripThinking: boolean;
	/** Skip toolUseResult content (DEFAULT: true) */
	stripToolResults: boolean;
	/** Custom regex patterns to redact (emails, API keys, etc.) */
	redactPatterns: RegExp[];
	/** Skip these projects entirely */
	excludeProjects: string[];
}

export type PrivacyProfile = "local" | "shareable" | "strict";
