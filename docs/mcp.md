---
title: MCP Integration | Connect aiDimag to Claude Code, Cursor & Copilot
description: Learn how to integrate aiDimag with AI coding agents using the Model Context Protocol (MCP). Setup guides for Claude Code, Cursor, and GitHub Copilot.
head:
  - - meta
    - name: keywords
      content: MCP integration, Model Context Protocol, Claude Code setup, Cursor integration, GitHub Copilot, aiDimag MCP server, AI agent integration
  - - meta
    - property: og:title
      content: MCP Integration - Connect AI Coding Agents
  - - meta
    - property: og:url
      content: https://aidimag.com/mcp
  - - link
    - rel: canonical
      href: https://aidimag.com/mcp
---

# MCP integration

aiDimag ships an [MCP](https://modelcontextprotocol.io) server so any MCP-capable AI agent
can read and write memory **live** during a session — search before exploring, write
learnings at the end, and critique its own work against your verified rules.

## Start the server

The server runs over stdio and is normally launched by your agent, not by hand:

```sh
dim mcp
```

Point it at a repo with the `AIDIMAG_REPO` environment variable (most agent configs set this
for you).

## Add it to your agent

### Claude Code (`.mcp.json`)

```json
{
  "mcpServers": {
    "aidimag": {
      "command": "npx",
      "args": ["-y", "aidimag", "mcp"],
      "env": { "AIDIMAG_REPO": "/path/to/your/repo" }
    }
  }
}
```

### Cursor

Add the same server block to Cursor's MCP settings (Settings → MCP), using the
`npx -y aidimag mcp` command and the `AIDIMAG_REPO` env var.

### GitHub Copilot / other MCP clients

Any client that supports MCP servers can use the identical `command`/`args`/`env`. If your
tool doesn't speak MCP, use [generated context files](/guides/generate-context) instead.

`dim init` prints a ready-to-paste snippet for you.

### From the MCP Registry

aidimag is published to the [official MCP Registry](https://registry.modelcontextprotocol.io)
as **`io.github.AiDimag/aidimag`** — clients and catalogs that browse the registry can
install it directly (npm package `aidimag`, stdio transport, launched as `npx -y aidimag mcp`).
The manifest lives in [`server.json`](https://github.com/AiDimag/aidimag/blob/main/server.json)
at the repo root.

For maintainers, publishing a new version:

```sh
npm version patch            # bumps package.json AND server.json (registry:sync hook)
npm publish                  # npm package must be live before the registry validates it
mcp-publisher login github   # auth for the io.github.AiDimag namespace — use a classic PAT
                             # with read:org (MCP_GITHUB_TOKEN=ghp_… mcp-publisher login github);
                             # the device flow can't see org ownership unless the registry's
                             # GitHub App is installed on the org
npm run registry:publish     # re-syncs server.json and publishes to the registry
```

The registry validates npm ownership via the `mcpName` field in `package.json`, so that
field must match the registry name **exactly, including case** (`AiDimag`, not `aidimag`).

## What the server exposes

### Tools

| Tool | What it does |
|---|---|
| `memory_search` | Search verified memory before exploring the codebase (every search is logged locally; zero-hit queries surface as knowledge gaps via `dim gaps`) |
| `memory_get_for_files` | Get memories relevant to specific files before editing them |
| `memory_write` | Save a new memory (set `guardrail_level` for guardrails) |
| `memory_propose` | Queue a memory for human review (preferred at session end) |
| `context_note` | **Passive in-chat capture** — the moment you state a durable fact in chat ("we use X because Y", "never touch Z"), the agent notes it into the review queue with your verbatim quote and `HUMAN_ATTESTED` evidence. No session-end ritual needed. |
| `chat_harvest` | **On-the-fly session harvest** — the agent passes your verbatim messages from the current chat and durable facts are extracted (secrets redacted first) and queued for review. The live equivalent of `dim harvest`, and **tool-agnostic by construction**: works from any MCP client — Copilot, Cursor, Codex, Claude, Windsurf, and cloud tools like Devin that have no local transcripts to harvest offline. |
| `memory_verify` | Re-run cheap evidence and update statuses. Evidence commands that arrived via team sync and weren't approved on this machine are **skipped, never executed** — the human approves them once with `dim verify --trust` |
| `memory_refute` | Mark a memory false when it no longer holds |
| `memory_status` | Counts by status and kind |
| `commits_mine` | Mine git history for memory proposals (like `dim mine`; optional `full`, `llm`, `max`) |
| `memory_critique` | Review work against verified memory + guardrails (a "second critic") |
| `scratchpad_write` | Jot a **short-term working note** for the current session (task state, plans, hypotheses). TTL-expiring (default 24h), never synced, never durable memory |
| `scratchpad_read` | Read back working notes — use when resuming a task to recover in-flight state (expired notes are purged automatically) |
| `scratchpad_clear` | Clear working notes when a task completes |
| `proposals_pending` | List proposals awaiting review |
| `knowledge_pending` | List documents waiting in the knowledge inbox to be summarized |
| `knowledge_ingest_submit` | Submit the claims extracted from a pending knowledge doc (queues proposals, backs up the original) |
| `ticket_get` | Fetch the current ticket's details (auto-detects from the branch) |
| `aidimag_help` | Overview of all aidimag tools, prompts, resources, and `dim` CLI commands — the agent calls this when you ask "what can aidimag do?" |

### Prompts

| Prompt | When to run it |
|---|---|
| `session_start` | At the **start** of a session — surfaces in-scope memory, guardrails, stale warnings, questions to ask, and any docs waiting in the knowledge inbox |
| `session_end_extraction` | At the **end** — extract durable learnings into the proposal queue |
| `knowledge_ingest` | Process the [knowledge inbox](/guides/knowledgebase) in-session — read each pending doc, extract falsifiable claims, and submit them with `knowledge_ingest_submit` |
| `help` | Anytime — shows everything aidimag offers (most clients expose prompts as slash commands, e.g. `/mcp__aidimag__help` in Claude Code) |

### Resources

| Resource | Contents |
|---|---|
| `aidimag://digest` | A compact digest of repo memory for bootstrapping |
| `aidimag://session-briefing` | The same briefing as `dim brief`, as a resource |
| `aidimag://help` | The full capabilities overview (same text as the `help` prompt) |

## How users discover aidimag's commands

You never have to memorize the list — discovery is built in at four levels:

1. **On connect** — the server sends MCP `instructions` at the handshake; most hosts feed
   them to the model automatically, so the agent knows the workflow (and to offer help)
   from the first message.
2. **Slash command** — run the `help` prompt from your client's prompt picker
   (Claude Code: `/mcp__aidimag__help`; Cursor/Copilot: the MCP prompts menu).
3. **Just ask** — "what can aidimag do?" makes the agent call `aidimag_help` and relay it.
4. **Session start** — the `session_start` briefing ends with a one-line reminder that
   aidimag is active and how to see all commands.

## A typical agent loop

1. **Start** → run `session_start` (or read `aidimag://session-briefing`) to learn the rules
   and stale spots.
2. **Before editing files** → `memory_get_for_files` to pull conventions/gotchas/guardrails.
3. **While working** → `memory_search` whenever a question comes up, `context_note`
   the moment the human states a durable fact in chat, and `scratchpad_write` for
   in-flight task state (plans, hypotheses, "resume here" markers).
4. **Before finishing** → `memory_critique` with a short summary to catch guardrail
   violations and contradictions.
5. **End** → run `session_end_extraction` and `memory_propose` durable learnings (which you
   later approve with `dim review`); `chat_harvest` the session's user messages to catch
   anything stated in passing; `scratchpad_clear` anything no longer needed.

## Do I even need MCP?

No — it's the richest integration, but optional. `dim generate-context` produces
`CLAUDE.md`, `.cursorrules`, and `copilot-instructions.md` that any assistant reads at
startup. Many teams use both: MCP for live read/write, generated files as a static fallback.

