# claude-optic

> Reads `~/.claude/` and returns structured JSON — sessions, costs, timesheets, work patterns. Pipe to `claude` or any LLM.

Zero-dependency, local-first TypeScript library for reading [Claude Code](https://docs.anthropic.com/en/docs/claude-code) session data from `~/.claude/`.

> **Security Warning**: `~/.claude/` contains highly sensitive data — API keys, source code, credentials, and personal information have been found in plaintext in session files. This library is designed with privacy as the primary concern. See [SECURITY.md](./SECURITY.md).

## Try it

```bash
bunx claude-optic sessions
```

## Features

- **Zero runtime dependencies**
- **No network access**
- **Privacy by default** — strips tool results and thinking blocks
- **Two-tier session loading** — fast (`history.jsonl`) or detailed (full parse)
- **Bun-native** — `Bun.file()`, `Bun.Glob`

## Install

```bash
bun add claude-optic
```

## Examples

The `examples/` directory contains standalone scripts that show what your session data unlocks. Run any of them with `bun examples/<name>.ts`.

### Cost per Feature

Match sessions to git branches and calculate what each feature costs in tokens and USD.

```bash
bun examples/cost-per-feature.ts --repo /path/to/repo
```

```
Cost per Feature / Branch
==========================================================================================
Feature/Branch                      Sessions      Tokens    Est. Cost     Commits
------------------------------------------------------------------------------------------
feat/auth-system                          8       2.3M        $4.12           5
fix/memory-leak                           3       890K        $1.55           2
refactor/api-client                       5       1.1M        $2.08           3
```

### Match Git Commits

Correlate git commits with sessions by timestamp proximity — find which session produced each commit.

```bash
bun examples/match-git-commits.ts --days 7
```

### Timesheet

Generate a weekly timesheet grouped by day and project, with gap-capped hours.

```bash
bun examples/timesheet.ts
```

```
Timesheet: 2026-02-10 → 2026-02-14
==========================================================================================
Day   Date        Project                           Hours   Sessions    Prompts
------------------------------------------------------------------------------------------
Mon   2026-02-10  claude-optic                       2.3          4         18
                  my-app                               1.1          2          8
Tue   2026-02-11  claude-optic                       3.5          6         32
------------------------------------------------------------------------------------------
      TOTAL                                            6.9         12         58
```

### Model Costs

Compare token usage and costs across Claude models.

```bash
bun examples/model-costs.ts
```

```
Model Usage & Costs: 2026-01-13 → 2026-02-12
====================================================================================================
Model                    Sessions     Input    Output   Cache W   Cache R    Est. Cost
----------------------------------------------------------------------------------------------------
opus-4-5-20250514              12     4.2M      1.1M     3.8M      2.1M       $98.42
sonnet-4-5-20250929            45     8.1M      2.3M     6.2M      4.5M       $42.15
```

### Prompt History

Export sampled prompts grouped by project as JSON — pipe to an LLM for categorization or analysis.

```bash
bun examples/prompt-history.ts --from 2026-01-01 | claude "categorize these prompts by intent"
```

### Session Digest

Compact session summaries as JSON — first prompt, branch, model, token counts, cost, duration.

```bash
bun examples/session-digest.ts --days 7 | claude "which sessions were the most productive?"
```

### Work Patterns

Aggregated work pattern metrics as JSON — hour distribution, late-night/weekend counts, longest and most expensive sessions.

```bash
bun examples/work-patterns.ts | claude "analyze my work patterns and suggest improvements"
```

### Pipe Match

Generic stdin matcher — pipe in any JSON with timestamps, match against sessions.

```bash
# Match GitHub PRs to sessions that produced them
gh pr list --json createdAt,title | bun examples/pipe-match.ts --field createdAt

# Match GitHub issues
gh issue list --json createdAt,title | bun examples/pipe-match.ts --field createdAt

# Match any timestamped JSON
echo '[{"timestamp":"2026-02-10T14:00:00Z","title":"Deploy v2.1"}]' | bun examples/pipe-match.ts

# Works with any JSON — work items, calendar events, deploys, etc.
cat events.json | bun examples/pipe-match.ts
```

## Quick Start

```typescript
import { createClaudeHistory } from "claude-optic";

const ch = createClaudeHistory();

// List today's sessions (fast — reads only history.jsonl)
const sessions = await ch.sessions.list();

// List with metadata (slower — peeks session files for branch/model/tokens)
const withMeta = await ch.sessions.listWithMeta();

// Get full session detail
const detail = await ch.sessions.detail(sessionId, projectPath);

// Stream transcript entries
for await (const entry of ch.sessions.transcript(sessionId, projectPath)) {
  console.log(entry.message?.role, entry.timestamp);
}

// Daily summary (sessions + tasks + plans + todos + project memory)
const daily = await ch.aggregate.daily("2026-02-09");

// Project summaries
const projects = await ch.aggregate.byProject({ from: "2026-02-01", to: "2026-02-09" });

// Estimate cost of a session
import { estimateCost } from "claude-optic";
const cost = estimateCost(withMeta[0]); // USD
```

## API

### `createClaudeHistory(config?)`

```typescript
const ch = createClaudeHistory({
  claudeDir: "~/.claude",           // default: ~/.claude
  privacy: "local",                  // "local" | "shareable" | "strict" | Partial<PrivacyConfig>
  cache: true,                       // default: true
});
```

### Sessions

| Method | Speed | Reads | Returns |
|--------|-------|-------|---------|
| `sessions.list(filter?)` | Fast | `history.jsonl` only | `SessionInfo[]` |
| `sessions.listWithMeta(filter?)` | Medium | + peeks session files | `SessionMeta[]` |
| `sessions.detail(id, project)` | Slow | Full session parse | `SessionDetail` |
| `sessions.transcript(id, project)` | Streaming | Full session file | `AsyncGenerator<TranscriptEntry>` |
| `sessions.count(filter?)` | Fast | `history.jsonl` only | `number` |

### Other Data

```typescript
ch.projects.list()                    // ProjectInfo[]
ch.projects.memory(projectPath)       // ProjectMemory | null
ch.tasks.list({ date: "2026-02-09" })     // TaskInfo[]
ch.todos.list({ date: "2026-02-09" })     // TodoItem[]
ch.plans.list({ date: "2026-02-09" })     // PlanInfo[]
ch.skills.list()                      // string[]
ch.skills.read("skill-name")         // string (SKILL.md content)
ch.stats.get()                        // StatsCache | null
```

### Aggregations

```typescript
ch.aggregate.daily("2026-02-09")                          // DailySummary
ch.aggregate.dailyRange("2026-02-01", "2026-02-09")       // DailySummary[]
ch.aggregate.byProject({ from: "2026-02-01" })            // ProjectSummary[]
ch.aggregate.toolUsage({ date: "2026-02-09" })            // ToolUsageReport
ch.aggregate.estimateHours(sessions)                       // number (gap-capped)
```

### Cost Estimation

```typescript
import { estimateCost, getModelPricing, MODEL_PRICING } from "claude-optic";

// Estimate cost for a session (requires SessionMeta — use listWithMeta)
const session = (await ch.sessions.listWithMeta())[0];
const cost = estimateCost(session); // USD

// Look up pricing for a model
const pricing = getModelPricing("claude-opus-4-5-20250514");
// { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 } per million tokens
```

### Filters

```typescript
// Date filter (all methods)
{ date: "2026-02-09" }                    // Single day
{ from: "2026-02-01", to: "2026-02-09" }  // Range
{ from: "2026-02-01" }                    // From date to today

// Session filter (extends DateFilter)
{ date: "2026-02-09", project: "my-app" } // Filter by project name
```

## Privacy Profiles

| Profile | Strips |
|---------|--------|
| `local` (default) | Tool results, thinking blocks |
| `shareable` | + absolute paths, home directory |
| `strict` | + prompt text, emails, credential patterns, IPs |

```typescript
// Use a built-in profile
const ch = createClaudeHistory({ privacy: "strict" });

// Or customize
const ch = createClaudeHistory({
  privacy: {
    redactPrompts: false,
    stripToolResults: true,
    stripThinking: true,
    excludeProjects: ["/work/secret-project"],
  },
});
```

## CLI

```bash
# List today's sessions
bunx claude-optic sessions

# Sessions for a specific date
bunx claude-optic sessions --date 2026-02-09

# Date range
bunx claude-optic sessions --from 2026-02-01 --to 2026-02-09

# Daily summary
bunx claude-optic daily --date 2026-02-09

# List projects
bunx claude-optic projects

# Stats
bunx claude-optic stats

# Export with strict privacy
bunx claude-optic export --from 2026-02-01 --privacy strict
```

All commands output JSON.

## Architecture

```
src/
  claude-optic.ts     # Main factory: createClaudeHistory()
  pricing.ts            # Model pricing data and cost estimation
  types/                # Type definitions (one file per domain)
  readers/              # File readers (history, session, tasks, plans, projects, stats)
  parsers/              # Session parsing, tool categorization, content extraction
  aggregations/         # Daily/project/tool summaries, time estimation
  privacy/              # Redaction engine, privacy profiles
  utils/                # Dates, paths, JSONL streaming
  cli/                  # CLI entry point
examples/               # Standalone scripts showing what the data unlocks
```

## License

MIT
