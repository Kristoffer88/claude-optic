# CLAUDE.md

## Overview

`claude-optic` — Zero-dependency, local-first TypeScript library for reading Claude Code session data from `~/.claude/`.

## Architecture

```
src/
  index.ts              # Public API exports
  claude-optic.ts       # Main factory: createClaudeHistory()
  types/                # All type definitions (one file per domain)
  readers/              # File readers (history.jsonl, session JSONL, tasks, plans, projects, stats)
  parsers/              # Session transcript parsing, tool categorization, content block extraction
  aggregations/         # Daily summaries, project summaries, tool usage, time estimation
  privacy/              # Redaction engine, privacy profiles, credential detection
  utils/                # Dates, paths, JSONL streaming
  cli/                  # CLI commands (sessions, projects, stats, export)
```

## Key Design Decisions

- **Zero runtime dependencies.** Bun provides file I/O, JSON parsing, path handling. Every dependency is an attack surface for the most sensitive directory on a developer's machine.
- **No network imports.** No `http`, `https`, `fetch`, `net`, `dns`, `WebSocket` anywhere in the codebase.
- **Bun-native.** `Bun.file()`, `Bun.Glob`, `Bun.write()`.
- **Privacy by default.** `toolUseResult` content and thinking blocks are stripped before data reaches consumers.
- **Two-tier session loading.** `list()` reads only `history.jsonl` (fast). `listWithMeta()` also peeks session files for branch/model/tokens (slower).

## Conventions

- All dates are `YYYY-MM-DD` strings in local time
- Session IDs are UUIDs
- Project paths are encoded with `/` → `-` for filesystem storage
- JSONL files are newline-delimited JSON, one record per line

## Security Rules

- NEVER add runtime dependencies
- NEVER import network modules
- NEVER write files outside of explicit user-directed output
- Always apply privacy redaction before returning data
