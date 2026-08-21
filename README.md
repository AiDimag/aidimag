<div align="center">

<img src="https://raw.githubusercontent.com/AiDimag/aidimag/main/assets/logo.svg" alt="AI Dimag Logo" width="120" height="120">

# AI Dimag — Verified Memory for AI Coding Agents

**Your coding agent forgets your codebase. AIDimag doesn't.**

[![npm version](https://img.shields.io/npm/v/aidimag?color=blue&logo=npm)](https://www.npmjs.com/package/aidimag)
[![CI](https://github.com/AiDimag/aidimag/actions/workflows/ci.yml/badge.svg)](https://github.com/AiDimag/aidimag/actions/workflows/ci.yml)
[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code-v1.0.6-blue?logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=aidimag.aidimag-vscode)
[![JetBrains Marketplace](https://img.shields.io/jetbrains/plugin/v/33030?label=JetBrains&logo=jetbrains&color=blue)](https://plugins.jetbrains.com/plugin/33030-ai-dimag)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-6366f1?logo=modelcontextprotocol)](https://registry.modelcontextprotocol.io/?q=aidimag)
[![aidimag MCP server](https://glama.ai/mcp/servers/AiDimag/aidimag/badges/score.svg)](https://glama.ai/mcp/servers/AiDimag/aidimag)
[![Product Hunt](https://img.shields.io/badge/Product%20Hunt-AI%20Dimag-da552f?logo=producthunt&logoColor=white)](https://www.producthunt.com/products/ai-dimag?utm_source=other&utm_medium=social)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Documentation](https://img.shields.io/badge/docs-aidimag.com-blue)](https://aidimag.com)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org)

[**Documentation**](https://aidimag.com) • [**Why AIDimag?**](https://aidimag.com/why-aidimag) • [**Getting Started**](https://aidimag.com/getting-started) • [**Use Cases**](https://aidimag.com/use-cases) • [**Benchmarks**](https://aidimag.com/benchmarks) • [**AI Dimag Cloud**](https://cloud.aidimag.com) • [**Pricing**](https://aidimag.com/pricing)

</div>

---

## What is AI Dimag?

**AI Dimag** is a memory system **for software engineering** — not a general-purpose "AI memory" app. It gives any MCP-compatible agent (Claude, Cursor, Copilot, Windsurf…) a **persistent memory of your codebase** that survives across sessions — decisions, conventions, gotchas, failed approaches, **guardrails**, and reusable **skills** — stored as **falsifiable claims with grounding evidence** in `.aidimag/` next to your code.

The subject of memory is your **repository**, not your preferences or chat history. Every capability — evidence, git-hook verification, guardrails, pre-commit checks, path-scoped recall, session scratchpad — exists to serve day-to-day development work.

### The Difference: Claim-and-Verify, Not Store-and-Retrieve

Most memory systems **store** text and **retrieve** whatever is similar later — a stored fact is assumed true forever. That's dangerous in a codebase, where a confidently-retrieved stale fact is *worse* than no memory at all.

Every AI Dimag memory carries **evidence** (a shell check, an anchored commit, a test) that `dim verify` re-runs against the current repo — automatically, via git hooks, on every pull, checkout, and rebase. Beliefs that stop being true go **STALE** instead of silently misleading your AI.

### Works with Every AI Tool

- **MCP tools** (Claude, Cursor, etc.) get real-time memory via the MCP server
- **Non-MCP tools** (Copilot, Windsurf, etc.) get static context files (`.cursorrules`, `CLAUDE.md`, `AGENTS.md`, etc.)

<div align="center">
<img src="https://raw.githubusercontent.com/AiDimag/aidimag/main/assets/hero-illustration.svg" alt="AI Dimag Flow" width="600">
</div>

## Install

```sh
npm install -g aidimag
```

Requires Node 22+. Ships two equivalent binaries: `dim` (short) and `aidimag`.

## Quick Start

```sh
cd your-repo
dim init                    # creates .aidimag/, installs additive git hooks
dim bootstrap               # optional: LLM-survey the repo into a starter memory set
dim review                  # approve what enters memory (nothing is stored unreviewed)

dim remember "All DB access goes through src/db/store.ts" -k INVARIANT -p src \
  -e "STATIC_CHECK:! grep -rl better-sqlite3 src --include=*.ts | grep -v store.ts"
dim recall db access
dim verify                  # re-run all evidence; stale beliefs get flagged
dim brief                   # session-start briefing: in-scope memory, guardrails, gaps

# For non-MCP tools (Copilot, Cursor without MCP, etc.):
dim generate-context --format all --auto   # creates .cursorrules, CLAUDE.md, AGENTS.md, etc.
```

### One-command setup

```sh
dim setup --yes              # init + git hooks + MCP configs for detected agents + context files
dim setup-ollama             # install Ollama + pull a free local embedding model for semantic search
dim doctor                   # verify everything is wired correctly
```

## Connect to Your AI Agent (MCP)

Add to your agent config (e.g. `.mcp.json` for Claude Code):

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

**MCP Tools** get `memory_search`, `memory_propose`, `context_note` (live in-chat fact capture), `chat_harvest` (live, tool-agnostic session harvesting with server-side secret redaction), `memory_critique` (a second critic grounded in verified memory), session-start briefings, session-end extraction, and more.

**Non-MCP Tools**: `dim generate-context -f all` renders verified memory into `.cursorrules`, `CLAUDE.md`, `AGENTS.md`, `.windsurfrules`, and `.github/copilot-instructions.md` (`--auto` keeps them refreshed).

**Hermes Agent**: `dim hermes install` registers aidimag as a native Hermes memory provider — one command, no pip, no venv. A single stdlib-only Python bridge delegates to the MCP server: session briefings are injected into the system prompt, recall is prefetched per turn, and session learnings become review-queue *proposals* (never silent writes). Then: `hermes config set memory.provider aidimag`.

## Key Features

### Human-Gated Capture
Commits, PRs, AI-chat transcripts (Claude Code, Codex, Copilot, Cursor), and pasted docs are mined into *proposals*. Nothing enters memory until you approve it in `dim review` (auto-triaged best-first, `approve all --min-score 0.7` for batches).

### Verification Lifecycle
`STATIC_CHECK` / `COMMIT_REF` / `TEST_RESULT` / `EXEC_TRACE` / `HUMAN_ATTESTED` evidence. Failing evidence flips memories to STALE and auto-drafts a recovery proposal. Confidence decays without re-confirmation.

### Evidence Trust Gate
Shell-command evidence that arrives via team sync is **never executed** until you inspect and approve it (`dim verify --trust`).

### Hybrid Semantic Recall
FTS5 keyword + vector KNN (OpenAI, local Ollama, or AWS Bedrock; auto-detected except Bedrock, which is explicit opt-in; works keyword-only with none).

### Guardrails & Skills
Behavioral rules (`never` / `ask-first` / `always`) and step-by-step procedures, enforced by `dim check` (pre-commit) and `memory_critique`.

### Team Mode, Self-Hosted
`dim serve` + `dim sync`: local-first replicas, device-code login, brain-scoped API keys, hashed credentials, cross-machine verification consensus.

### Knowledgebase Inbox
Drop design docs / ADRs / PDFs / DOCX into `knowledge/` and they're summarized into reviewed, pinned memories.

### Scratchpad & Provenance Audit
`dim scratch` (and the `scratchpad_*` MCP tools) hold short-term session notes — TTL-expiring, never synced, never durable memory. `dim audit` lists memories resting on the weakest ground (agent-authored, evidence-free, stale, or long-unverified) so you can fix them up like a dependency audit for your repo's knowledge.

### Web Dashboard & Extensions
`dim ui` — run checks, session briefings, bootstrap, harvest, and context generation from the browser — plus VS Code and IntelliJ extensions.

## Ticketing Integration

Commits tell you *what* changed; tickets hold the *why*. aiDimag connects to your ticketing system so that context flows into your memory — ticket titles, types, and statuses appear next to mined proposals during `dim review`, and agents can fetch tickets via the `ticket_get` MCP tool.

### Supported providers

Jira, GitHub Issues, Linear, GitLab Issues, Azure DevOps, ClickUp, Shortcut, YouTrack, Asana, Trello, Notion, Pivotal Tracker, a custom HTTP middleware, or **Remote** (team sync server — zero local credentials).

### Quick start

```sh
# Connect a provider (interactive)
dim ticket connect

# Check status
dim ticket status

# View a specific ticket
dim ticket show XXX-2100

# Share credentials with your team (admin)
dim ticket share
```

### Per-repo credential storage

Ticket credentials are stored **per-repo** in `.aidimag/config.json` under `tickets.token` (with file mode `0o600`), matching the same pattern as cloud sync tokens. Credentials never leak between projects. You can also set the `AIDIMAG_TICKET_TOKEN` environment variable, which takes precedence over the config file.

### Team-shared tickets (Remote provider)

One admin shares their ticket credential via the sync server (`dim ticket share`). Team members select **"Remote (team sync server)"** as their provider — they resolve tickets through the server and hold **zero** ticket credentials locally. When a cloud server is linked, the dashboard auto-discovers the team's ticket provider and shows a **"Connect now"** button.

### Branch conventions

Define a branch-naming convention and have aiDimag warn or block on violations:

```sh
dim ticket branch-rule        # manage the convention
dim branch XXX-2100           # create a conforming branch (fetches title for slug)
```

| Enforcement | Effect |
|---|---|
| `off` | No checking |
| `warn` | Heads-up at branch creation (`post-checkout`) |
| `push` | Blocks pushing non-conforming branches (`pre-push`) |

Full guide: **[Connecting tickets](https://aidimag.com/guides/tickets)**

## How It Compares

AI Dimag follows a **claim-and-verify** model; other memory systems follow **store-and-retrieve**. The short version:

| | Conversational memory layers | Vector-store memory plugins | Hand-maintained context files | **AI Dimag** |
|---|---|---|---|---|
| **Built for** | Chat assistants remembering *users* | General recall over embedded text | Static instructions for coding agents | **Coding agents in a living repo** |
| **Unit of memory** | Extracted facts / chat summaries | Embedded text chunks | Prose | **Falsifiable, typed claims with evidence** |
| **How memory gets in** | Automatic capture | Automatic embedding | Manual edits | **Human-gated review queue** |
| **When the code changes** | Nothing — stored facts stay "true" | Nothing | File silently rots | **Evidence re-runs via git hooks; broken claims flip STALE** |
| **Trust model** | Write-time label, never re-checked | Similarity ≈ trust | "It's in the file" | **Verification status + decaying confidence; trust-ranked retrieval** |
| **Enforcement** | None — injection only | None | Hope the model reads it | **Guardrails + pre-commit `dim check` + `memory_critique`** |
| **Failure mode** | Confidently recalls outdated facts | Retrieves similar, true or not | Instructions drift from reality | **Says "this went STALE" instead of guessing** |

Full comparison: **[aidimag.com/comparison](https://aidimag.com/comparison)**

### vs. named tools

How aiDimag relates to the memory tools people usually ask about. These solve a
different problem (remembering *users and conversations*); aiDimag remembers your
*repository* and proves its memories are still true:

| | **aiDimag** | Mnemosyne | mem0 | Letta | Honcho | SuperMemory | Hindsight | ChromaDB |
|---|---|---|---|---|---|---|---|---|
| **Subject of memory** | **Your codebase** | Chat/agent sessions | User & agent facts | Agent's own context | User/peer reasoning | Personal + agent | Agent memory | — (vector DB) |
| **Local-first** | ✅ SQLite per repo | ✅ SQLite | ⚠️ Hybrid | ❌ Docker+PG | ⚠️ PG+worker | ❌ SaaS | ✅ SQLite | ✅ Embedded |
| **MCP server** | ✅ Built-in | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Verifies memories against code** | ✅ Evidence re-runs via git hooks | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Human-gated writes** | ✅ Review queue | ❌ Auto-capture | ❌ Auto | ❌ | ❌ | ❌ | ❌ | — |
| **Enforcement** | ✅ Guardrails + pre-commit + critique | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Open source** | ✅ MIT | ✅ MIT | ✅ Apache 2.0 | ✅ Apache 2.0 | ⚠️ AGPL | ❌ Proprietary | ✅ MIT | ✅ Apache 2.0 |
| **Published benchmark** | Own suite: 100% staleness detection, 0% FP | BEAM 65.2% / LongMemEval 98.9% R@All@5 (self-reported) | LoCoMo | LoCoMo 83.2% | LongMemEval 90.4% | MemoryBench 85.2% | BEAM 73.4% / LongMemEval 94.6% | — |

Chat-memory benchmarks (LoCoMo, LongMemEval, BEAM) score recall over *conversation
histories*, so they don't apply to aiDimag — its memory subject is the repo. Instead
aiDimag publishes its own reproducible suite (below), including the metric none of
the chat benchmarks measure: **does memory notice when the code changes?**

## Benchmarks

Reproducible performance and quality suites live in [`benchmark/`](./benchmark)
(`npm run bench`, `npm run bench:quality`). Headline results (Apple M4, Node 24,
10,000-memory brain — full tables at [aidimag.com/benchmarks](https://aidimag.com/benchmarks)):

| Metric | Result |
|---|---|
| FTS keyword search | 1.45ms p50 |
| Vector KNN (768-dim, sqlite-vec) | 4.15ms p50 |
| Memory writes (transactional, incl. FTS + event log) | ~5,400/s |
| CLI cold start (`dim --help`) | ~41ms p50 |
| **Staleness detection** (broken claims → STALE, real git fixture) | **100%** (4/4) |
| **False positives** (intact claims wrongly flagged) | **0%** (0/4) |
| Retrieval, keyword queries (Recall@1 / MRR, FTS-only) | 1.00 / 1.00 |
| Retrieval, paraphrase queries (FTS-only; hybrid closes this gap) | 0.25 / 0.27 |

## Documentation

<table>
<tr>
<td width="33%">

**Getting Started**
- [Installation](https://aidimag.com/getting-started)
- [Quick Start (5 min)](https://aidimag.com/quickstart)
- [Cloud Sync](https://aidimag.com/cloud-quickstart)

</td>
<td width="33%">

**Overview**
- [Why AIDimag?](https://aidimag.com/why-aidimag)
- [Use Cases](https://aidimag.com/use-cases)
- [How it Works](https://aidimag.com/how-it-works)
- [Web Dashboard](https://aidimag.com/dashboard)
- [Comparison](https://aidimag.com/comparison)
- [CLI Reference](https://aidimag.com/cli-reference)
- [MCP Integration](https://aidimag.com/mcp)
- [Configuration](https://aidimag.com/configuration)

</td>
<td width="33%">

**Guides**
- [Team Sync](https://aidimag.com/guides/team-sync)
- [Connecting Tickets](https://aidimag.com/guides/tickets)
- [Guardrails](https://aidimag.com/guides/guardrails)
- [Context Files](https://aidimag.com/guides/generate-context)

</td>
</tr>
</table>

Full documentation: **[aidimag.com](https://aidimag.com)**

---

## Contributing

Contributions welcome! See [**CONTRIBUTING.md**](./CONTRIBUTING.md) for dev setup, project principles, and the PR checklist. All participation is governed by our [Code of Conduct](./CODE_OF_CONDUCT.md).

## License & Pricing

**AI Dimag is open source under the [MIT License](./LICENSE)** — free for everyone, any team size, forever. Use it, fork it, embed it.

The entire local-first product is free: CLI, MCP server, verification, guardrails, skills, IDE extensions, local dashboard, and self-hosted team sync (`dim serve`).

Want team sync without running a server? **[AI Dimag Cloud](https://cloud.aidimag.com)** is an optional managed sync subscription — that's how the project stays funded and open source. See [**Pricing**](https://aidimag.com/pricing).

---

<div align="center">

**Built by [Anup Khanal](https://github.com/anup-khanal)**

[Website](https://aidimag.com) • [Documentation](https://aidimag.com) • [Cloud](https://cloud.aidimag.com) • [npm](https://www.npmjs.com/package/aidimag) • [License](./LICENSE)

</div>

