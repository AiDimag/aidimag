<div align="center">

<img src="https://raw.githubusercontent.com/AiDimag/aidimag/main/assets/logo.svg" alt="AI Dimag Logo" width="120" height="120">

# AI Dimag — Verified Memory for AI Coding Agents

**Your codebase remembers its decisions, conventions, and rules — and proves they're still true.**

[![npm version](https://img.shields.io/npm/v/aidimag?color=blue&logo=npm)](https://www.npmjs.com/package/aidimag)
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/aidimag.aidimag-vscode?label=VS%20Code&logo=visualstudiocode&color=blue)](https://marketplace.visualstudio.com/items?itemName=aidimag.aidimag-vscode)
[![JetBrains Marketplace](https://img.shields.io/jetbrains/plugin/v/33030?label=JetBrains&logo=jetbrains&color=blue)](https://plugins.jetbrains.com/plugin/33030-ai-dimag)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Documentation](https://img.shields.io/badge/docs-aidimag.com-blue)](https://aidimag.com)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org)

[**Documentation**](https://aidimag.com) • [**Getting Started**](https://aidimag.com/getting-started) • [**AI Dimag Cloud**](https://cloud.aidimag.com) • [**Pricing**](https://aidimag.com/pricing)

</div>

---

## What is AI Dimag?

**AI Dimag** is a memory system **for software engineering** — not a general-purpose "AI memory" app. It gives any MCP-compatible agent (Claude, Cursor, Copilot, Windsurf…) a **persistent memory of your codebase** that survives across sessions — decisions, conventions, gotchas, failed approaches, **guardrails**, and reusable **skills** — stored as **falsifiable claims with grounding evidence** in `.aidimag/` next to your code.

The subject of memory is your **repository**, not your preferences or chat history. Every capability — evidence, git-hook verification, guardrails, pre-commit checks, path-scoped recall, session scratchpad — exists to serve day-to-day development work.

### 🎯 The Difference: Claim-and-Verify, Not Store-and-Retrieve

Most memory systems **store** text and **retrieve** whatever is similar later — a stored fact is assumed true forever. That's dangerous in a codebase, where a confidently-retrieved stale fact is *worse* than no memory at all.

Every AI Dimag memory carries **evidence** (a shell check, an anchored commit, a test) that `dim verify` re-runs against the current repo — automatically, via git hooks, on every pull, checkout, and rebase. Beliefs that stop being true go **STALE** instead of silently misleading your AI.

### ✨ Works with Every AI Tool

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

## 🚀 Quick Start

```sh
cd your-repo
dim init                    # creates .aidimag/, installs additive git hooks
dim bootstrap               # optional: LLM-survey the repo into a starter memory set
dim review                  # approve what enters memory (nothing is stored unreviewed)

dim remember "All DB access goes through src/db/store.ts" -k INVARIANT -p src/db \
  -e "STATIC_CHECK:grep -rL better-sqlite3 src --include=*.ts"
dim recall db access
dim verify                  # re-run all evidence; stale beliefs get flagged
dim brief                   # session-start briefing: in-scope memory, guardrails, gaps

# For non-MCP tools (Copilot, Cursor without MCP, etc.):
dim generate-context --format all --auto   # creates .cursorrules, CLAUDE.md, AGENTS.md, etc.
```

## 🔌 Connect to Your AI Agent (MCP)

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

**MCP Tools** get `memory_search`, `memory_propose`, `context_note` (live in-chat fact capture), `memory_critique` (a second critic grounded in verified memory), session-start briefings, session-end extraction, and more.

**Non-MCP Tools**: `dim generate-context -f all` renders verified memory into `.cursorrules`, `CLAUDE.md`, `AGENTS.md`, `.windsurfrules`, and `.github/copilot-instructions.md` (`--auto` keeps them refreshed).

## ✨ Key Features

### 🛡️ Human-Gated Capture
Commits, PRs, AI-chat transcripts, and pasted docs are mined into *proposals*. Nothing enters memory until you approve it in `dim review` (auto-triaged best-first, `approve all --min-score 0.7` for batches).

### ✅ Verification Lifecycle
`STATIC_CHECK` / `COMMIT_REF` / `TEST_RESULT` / `EXEC_TRACE` / `HUMAN_ATTESTED` evidence. Failing evidence flips memories to STALE and auto-drafts a recovery proposal. Confidence decays without re-confirmation.

### 🔒 Evidence Trust Gate
Shell-command evidence that arrives via team sync is **never executed** until you inspect and approve it (`dim verify --trust`).

### 🔍 Hybrid Semantic Recall
FTS5 keyword + vector KNN (OpenAI or local Ollama, auto-detected; works keyword-only with neither).

### 🚦 Guardrails & Skills
Behavioral rules (`never` / `ask-first` / `always`) and step-by-step procedures, enforced by `dim check` (pre-commit) and `memory_critique`.

### 👥 Team Mode, Self-Hosted
`dim serve` + `dim sync`: local-first replicas, device-code login, brain-scoped API keys, hashed credentials, cross-machine verification consensus.

### 📚 Knowledgebase Inbox
Drop design docs / ADRs / PDFs / DOCX into `knowledge/` and they're summarized into reviewed, pinned memories.

### 📝 Scratchpad & Provenance Audit
`dim scratch` (and the `scratchpad_*` MCP tools) hold short-term session notes — TTL-expiring, never synced, never durable memory. `dim audit` lists memories resting on the weakest ground (agent-authored, evidence-free, stale, or long-unverified) so you can fix them up like a dependency audit for your repo's knowledge.

### 🎨 Web Dashboard & Extensions
`dim ui` plus VS Code and IntelliJ extensions.

## 🥊 How It Compares

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

## 📖 Documentation

<table>
<tr>
<td width="33%">

**Getting Started**
- [Installation](https://aidimag.com/getting-started)
- [Quick Start (5 min)](https://aidimag.com/quickstart)
- [Cloud Sync](https://aidimag.com/cloud-quickstart)

</td>
<td width="33%">

**Reference**
- [CLI Reference](https://aidimag.com/cli-reference)
- [MCP Integration](https://aidimag.com/mcp)
- [Configuration](https://aidimag.com/configuration)

</td>
<td width="33%">

**Guides**
- [Team Sync](https://aidimag.com/guides/team-sync)
- [Guardrails](https://aidimag.com/guides/guardrails)
- [Context Files](https://aidimag.com/guides/generate-context)

</td>
</tr>
</table>

Full documentation: **[aidimag.com](https://aidimag.com)**

---

## 🤝 Contributing

Contributions welcome! See [**CONTRIBUTING.md**](./CONTRIBUTING.md) for dev setup, project principles, and the PR checklist. All participation is governed by our [Code of Conduct](./CODE_OF_CONDUCT.md).

## 💰 License & Pricing

**AI Dimag is open source under the [MIT License](./LICENSE)** — free for everyone, any team size, forever. Use it, fork it, embed it.

The entire local-first product is free: CLI, MCP server, verification, guardrails, skills, IDE extensions, local dashboard, and self-hosted team sync (`dim serve`).

Want team sync without running a server? **[AI Dimag Cloud](https://cloud.aidimag.com)** is an optional managed sync subscription — that's how the project stays funded and open source. See [**Pricing**](https://aidimag.com/pricing).

---

<div align="center">

**Built by [Anup Khanal](https://github.com/anup-khanal)**

[Website](https://aidimag.com) • [Documentation](https://aidimag.com) • [Cloud](https://cloud.aidimag.com) • [npm](https://www.npmjs.com/package/aidimag) • [License](./LICENSE)

</div>

