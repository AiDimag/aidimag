---
title: How AI Dimag Compares | Cross-Agent Trust Layer vs Other Memory Systems
description: How AI Dimag's claim-and-verify model differs from native agent memory, conversational memory layers, vector-store memory plugins, and hand-maintained context files — and why that matters for coding agents.
head:
  - - meta
    - name: keywords
      content: AI memory comparison, verified memory, coding agent memory, AI agent memory systems, claim and verify, stale context, codebase memory, GitHub Copilot memory, Claude Code memory, Cursor rules
  - - meta
    - property: og:title
      content: How AI Dimag Compares - Cross-Agent Trust Layer
  - - meta
    - property: og:url
      content: https://aidimag.com/comparison
  - - link
    - rel: canonical
      href: https://aidimag.com/comparison
---

# How AI Dimag compares

AI Dimag is not a general-purpose "AI memory" product. It is a **cross-agent trust layer
for software engineering**: the thing it remembers is your *codebase* — decisions,
conventions, invariants, gotchas, failed approaches, guardrails, and step-by-step
skills — and the thing it optimizes for is whether those facts are **still true of the
code right now**.

That focus produces a different design from the memory tools you may have seen. This page
compares AI Dimag against native agent memory systems, common *categories* of memory
platforms, and the specific products people ask about most.

## The core difference: store-and-retrieve vs claim-and-verify

Most memory layers for AI agents follow a similar model:

> **Store-and-retrieve** — capture text (chat history, extracted facts, embedded
> documents), then retrieve the most *similar* items later. Once stored, a fact is
> typically assumed true unless manually updated. Some systems add provenance labels
> or age-based fading, but few actively re-check whether a stored fact still holds
> against the current codebase.

That model is fine for remembering that a user prefers dark mode. It is risky for
remembering that "all DB access goes through `src/db/store.ts`" — because codebases
change, and a confidently-retrieved stale fact is *worse* than no memory at all: your
agent will act on it.

AI Dimag's model:

> **Claim-and-verify** — every memory is a *falsifiable claim* with attached
> **evidence** (a shell check, an anchored commit, a test). `dim verify` re-runs that
> evidence against the current repo — automatically, via git hooks, after every pull,
> checkout, and rebase. A claim that stops being true flips to **STALE** instead of
> silently misleading your agent, and a recovery proposal is drafted so a human decides:
> did the code drift, or is the claim now wrong?

The practical consequences:

- **Trust is earned continuously, not assigned once.** A provenance label answers "how
  trustworthy was this when written?" Evidence answers "is this still true *right now*?"
  Only the second question keeps up with a moving codebase.
- **Retrieval ranks by verification, not just similarity.** A verified memory outranks
  an unverified one, which outranks a stale one — regardless of how well the stale one
  matches your query. Provenance (human > agent-authored) and recency are tiebreaks;
  verification always dominates.
- **Memory can say no.** Guardrails (`never` / `ask-first` / `always`) and `dim check`
  actively block or flag work that contradicts verified memory. Most store-and-retrieve
  systems only *inject* context — though some, like Claude Code hooks, can enforce rules
  through custom hook scripts. AI Dimag makes enforcement a first-class, auditable feature
  rather than something you wire up manually.

## Native agent memory systems

Several coding agents now ship with built-in memory or rules features. These are
improving rapidly and are the most natural comparison since they serve the same
use case — giving a coding agent persistent knowledge of your codebase.

<div class="wide-table" style="overflow-x:auto;">

| | **AI Dimag** | **GitHub Copilot Memory** | **Claude Code Memory** | **Cursor rules & memory** | **Static `AGENTS.md` / `CLAUDE.md`** | **Codebase Memory MCP** |
|---|---|---|---|---|---|---|
| **What it is** | Cross-agent trust layer with verified claims | Repo-scoped memories cited from the branch | `CLAUDE.md` files + hooks for enforcement | `.cursorrules` / `.cursor/rules` for instructions | Hand-maintained markdown files agents read at startup | MCP server providing codebase context to agents |
| **Cross-agent portability** | ✅ One memory store works with Claude, Cursor, Copilot, Windsurf, and any MCP client | ❌ Copilot only | ❌ Claude Code only | ❌ Cursor only | ⚠️ Each tool reads its own file format | ⚠️ Any MCP client, but no generated context files |
| **Staleness detection** | ✅ Evidence re-runs on every pull/checkout; broken claims flip to STALE | ⚠️ Validates cited memories against current branch, but doesn't proactively re-check | ❌ File rots silently until someone notices | ❌ File rots silently | ❌ File rots silently | ❌ No re-verification |
| **Executable evidence** | ✅ Shell checks, commit refs, tests — re-run automatically | ⚠️ Citations validated against branch state | ❌ Prose only | ❌ Prose only | ❌ Prose only | ⚠️ Provides code context, but no claim verification |
| **Explicit memory status** | ✅ UNVERIFIED / VERIFIED / STALE with confidence scores | ⚠️ Cited vs uncited distinction | ❌ No status tracking | ❌ No status tracking | ❌ No status tracking | ❌ No status tracking |
| **Human-controlled review** | ✅ Every memory goes through `dim review` queue | ⚠️ Memories can be added by the agent or user | ⚠️ User edits files directly | ⚠️ User edits files directly | ✅ User edits files directly | ⚠️ Depends on setup |
| **Guardrails & enforcement** | ✅ `never` / `ask-first` / `always` + pre-commit `dim check` | ❌ No enforcement layer | ⚠️ Hooks can enforce rules, but require manual setup | ❌ No enforcement | ❌ Depends on the model reading carefully | ❌ No enforcement |
| **Local-first** | ✅ One SQLite file per repo | ❌ Cloud-based | ✅ Local files | ✅ Local files | ✅ Local files | ⚠️ Depends on deployment |
| **Shared institutional knowledge** | ✅ Self-hosted team sync with verification consensus | ⚠️ Per-repo, per-user | ⚠️ Committed file — merge conflicts | ⚠️ Committed file — merge conflicts | ⚠️ Committed file — merge conflicts | ⚠️ Per-deployment |
| **Auditable enforcement** | ✅ Every check, verify, and guardrail hit is logged | ❌ | ⚠️ Hook execution visible in logs | ❌ | ❌ | ❌ |
| **Failed-approach prevention** | ✅ `FAILED_APPROACH` memories warn agents before repeating mistakes | ❌ | ❌ | ❌ | ⚠️ Only if manually documented | ❌ |

</div>

**Where native agent memory is strong:** GitHub Copilot Memory validates cited
repository memories against the current branch, which is a meaningful step toward
verification. Claude Code hooks can enforce rules through custom scripts. Cursor rules
are simple and fast to set up for a single tool.

**Where AI Dimag is different:** It is the only system that combines cross-agent
portability, executable evidence that re-runs automatically, explicit memory status
tracking, human-gated review, guardrails, local-first operation, shared institutional
knowledge, and auditable enforcement — in one tool that works with every coding agent
your team uses.

## Category-by-category

| | Conversational memory layers | Vector-store memory plugins | Hand-maintained context files | **AI Dimag** |
|---|---|---|---|---|
| **Built for** | Chat assistants remembering *users* (preferences, past conversations) | General recall over embedded text | Giving coding agents static instructions | **Coding agents working in a living repo** |
| **Unit of memory** | Extracted facts / summarized conversation chunks | Embedded text chunks | Prose instructions | **Falsifiable claims with evidence, typed** (DECISION, INVARIANT, GUARDRAIL, SKILL…) |
| **How memory gets in** | Automatic — everything the model deems memorable is stored | Automatic embedding of whatever you feed it | A human edits a file, occasionally | **Human-gated**: commits, PRs, chats, and docs are mined into *proposals*; nothing is stored without review |
| **When the code changes** | Typically nothing happens — stored facts stay as-is | Typically nothing happens | The file silently rots until someone notices | **Evidence re-runs on every pull/checkout; broken claims flip to STALE and draft a recovery proposal** |
| **Trust model** | Optional write-time label (stated vs inferred), rarely re-checked | Similarity score ≈ trust | "It's in the file, so it's policy" | **Verification status + confidence that decays without re-confirmation; trust-ranked retrieval** |
| **Enforcement** | None — context injection only | None | Depends on the model reading carefully | **Guardrails + pre-commit `dim check` + `memory_critique` (a second critic grounded in verified memory)** |
| **Scoping** | Per-user | Per-collection | Per-repo, one big file | **Per-path and per-symbol** — memories surface only for the files being edited |
| **Short-term memory** | Conversation window management | — | — | **Scratchpad**: TTL-expiring session notes, kept strictly separate from durable memory |
| **Security of shared memory** | N/A (single user) | N/A | Committed file — anyone can edit | **Evidence trust gate**: synced-in shell checks never execute until you inspect and approve them |
| **Team story** | Per-user cloud accounts | Shared collection | Merge conflicts in a markdown file | **Self-hosted sync with last-writer-wins, tombstones, and cross-machine verification consensus** |
| **Failure mode** | Confidently recalls things that are no longer true | Retrieves whatever is similar, true or not | Instructions drift from reality | **Says "this went stale" instead of guessing** |

## AI Dimag's advantages

When compared against both native agent memory and general-purpose memory products,
AI Dimag's distinct advantages are:

- **Cross-agent portability** — One memory store works with Claude Code, Cursor, GitHub
  Copilot, Windsurf, and any MCP client. Native agent memories are locked to one tool.
- **Executable evidence** — Every claim carries a shell check, commit ref, or test that
  re-runs automatically. Native agent memories use prose that can't be re-checked.
- **Explicit memory status** — UNVERIFIED, VERIFIED, and STALE states with confidence
  scores. Other systems have no way to tell you whether a memory is still true.
- **Human-controlled review** — Every memory goes through a `dim review` queue before
  being stored. Nothing enters memory automatically without human approval.
- **Guardrails** — `never` / `ask-first` / `always` rules that actively block or flag
  agent work. Claude Code can achieve this with custom hooks, but AI Dimag makes it
  built-in and auditable.
- **Local-first operation** — One SQLite file per repo, next to your code. No cloud
  required. GitHub Copilot Memory is cloud-based.
- **Shared institutional knowledge** — Self-hosted team sync with verification consensus.
  Native agent memories are per-user or require merge conflicts in committed files.
- **Auditable enforcement** — Every check, verify, and guardrail hit is logged. You can
  see exactly what was blocked and why.
- **Failed-approach prevention** — `FAILED_APPROACH` memories proactively warn agents
  before they repeat known mistakes. No native agent memory has this concept.

## Product-by-product

The tools people most often ask about, and where each one actually sits. Most of
them are *conversational/agent* memory — excellent at remembering users and chat
sessions, which is a different problem from remembering a living codebase:

<div class="wide-table" style="overflow-x:auto;">

| | **AI Dimag** | Mnemosyne | mem0 | Letta | Honcho | SuperMemory | Hindsight | ChromaDB |
|---|---|---|---|---|---|---|---|---|
| **Subject of memory** | **Your codebase** | Chat/agent sessions | User & agent facts | Agent's own context window | User/peer reasoning | Personal + agent memory | Agent memory | — (vector database) |
| **Architecture** | Falsifiable claims + evidence, FTS5 + sqlite-vec hybrid | BEAM 3-tier (episodic/semantic/persona) | Session + extracted facts | OS-style virtual context (MemGPT) | Peer model + reasoning | 5-layer memory stack | Episodic + semantic + graph + BM25 | Vector store |
| **Local-first** | ✅ One SQLite file per repo | ✅ SQLite | ⚠️ Hybrid (OSS + managed platform) | ❌ Docker + Postgres | ⚠️ Postgres + worker | ❌ SaaS | ✅ SQLite | ✅ Embedded |
| **MCP server** | ✅ Built-in | ✅ Built-in | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| **How memory gets in** | **Human-gated review queue** | Auto-capture | Auto-extraction | Agent-managed | Auto | Auto | Auto | You embed it |
| **When the code changes** | **Evidence re-runs via git hooks; broken claims flip STALE** | Nothing | Nothing | Nothing | Nothing | Nothing | Nothing | Nothing |
| **Enforcement** | ✅ Guardrails + pre-commit `dim check` + `memory_critique` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Team story** | Self-hosted sync, evidence trust gate, verification consensus | Sync service | Managed platform | Server deployment | Managed | SaaS | Self-hosted | Server mode |
| **Open source** | ✅ MIT | ✅ MIT | ✅ Apache 2.0 | ✅ Apache 2.0 | ⚠️ AGPL | ❌ Proprietary | ✅ MIT | ✅ Apache 2.0 |
| **Published benchmarks** | [Own reproducible suite](/benchmarks): all 4 broken claims detected, 0 false flags | BEAM 65.2%, LongMemEval 98.9% R@All@5 (self-reported, v3.0.0) | LoCoMo | LoCoMo 83.2% | LongMemEval 90.4% | MemoryBench 85.2% | BEAM 73.4%, LongMemEval 94.6% | — |

</div>

Competitor figures are the numbers those projects publish themselves (metrics and
judges differ between them — see each project's methodology before comparing rows).

**Why AI Dimag doesn't publish LoCoMo / LongMemEval / BEAM scores:** those benchmarks
measure recall over long *conversation histories* — the subject of memory is the
user and the chat. AI Dimag's subject is the repository, so the honest equivalents are
different questions: *does recall return the right claim about the code?* and *does
memory notice when the code drifts?* Both are measured in the
[reproducible benchmark suite](/benchmarks) — retrieval Recall@k/MRR over a labeled
query set, and staleness detection against a real mutating git repo (all 4 broken
claims detected, 0 false flags across 4 intact claims). No chat-memory benchmark
measures the second property at all — in a store-and-retrieve system there is nothing
to re-verify.

- **Choose Mnemosyne / mem0 / Honcho / SuperMemory** when the thing to remember is a
  *user or conversation* across sessions.
- **Choose Letta** when you want a full agent runtime that manages its own context.
- **Choose ChromaDB** when you need a vector database, not a memory system.
- **Choose Hindsight** for general agent memory with strong published recall numbers.
- **Choose AI Dimag** when AI coding agents keep re-discovering or misremembering how
  your *codebase* works — and you need memories that prove they're still true.

## What AI Dimag deliberately does *not* do

Being focused on engineering means saying no to things general-purpose memory products do:

- **It doesn't remember users.** No preference tracking, no personalization profiles.
  The subject of memory is the repository, not the person.
- **It doesn't auto-store everything.** Automatic capture without review fills memory
  with plausible-sounding noise. Every capture channel in AI Dimag ends at `dim review`.
- **It doesn't manage your chat window.** Conversation summarization and token budgeting
  belong to the host agent. AI Dimag supplies the *durable* layer underneath (plus a
  scratchpad for in-flight session state).
- **It doesn't require a cloud.** One SQLite file per repo, next to your code. Team sync
  is optional and self-hostable.

## When you'd want something else

Honest scoping: if you're building a consumer chat assistant that must remember user
preferences across sessions, a conversational memory layer is the right tool. If you need
general semantic recall over a large document corpus, use a vector store directly. If
you only use one coding agent and its native memory is sufficient, that may be enough —
but if you need cross-agent portability, executable evidence, or team-wide enforcement,
AI Dimag adds what native memory can't.

Use AI Dimag when the problem is: **AI coding agents keep re-discovering, re-asking, or —
worse — confidently misremembering how your codebase works — and you need a trust layer
that works across every agent your team uses.**

Next: **[Install & setup](/getting-started)**.

