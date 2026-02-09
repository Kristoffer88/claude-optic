# Security

## Data Sensitivity Warning

**`~/.claude/` is the single most sensitive directory on a modern developer's machine.**

Claude Code session history contains:
- Every prompt you've ever sent (including those containing secrets, credentials, API keys)
- Full source code of every file Claude has read (in `toolUseResult` blocks)
- Thinking blocks that may echo sensitive information
- File paths revealing your machine's directory structure
- IP addresses, hostnames, and other infrastructure details

This library is designed with security as the primary concern:

### Design Principles

1. **Zero runtime dependencies.** Every dependency is an attack surface. This library has none.
2. **No network access.** No `http`, `https`, `fetch`, `net`, `dns`, or `WebSocket` imports anywhere in the codebase. Data never leaves your machine unless you explicitly pipe it.
3. **Privacy by default.** The default privacy profile (`local`) strips `toolUseResult` content and thinking blocks before data reaches your code.
4. **Credential redaction.** Built-in regex patterns detect and redact API keys, tokens, passwords, and IP addresses.

### Privacy Profiles

| Profile | What it strips |
|---------|---------------|
| `local` (default) | Tool results, thinking blocks |
| `shareable` | + absolute paths, home directory |
| `strict` | + prompt text, emails, credential patterns, IPs |

### Recommendations

- Never commit `~/.claude/` session data to version control
- Never send session data over the network without `strict` privacy profile
- Review output before sharing, even with `strict` — regex cannot catch everything
- Consider the AI-powered sanitization for sensitive exports (`claude-optic sanitize`)

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it via GitHub Issues or email.
