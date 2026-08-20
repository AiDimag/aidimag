---
title: How aiDimag Compares | Verified Codebase Memory vs Other Memory Systems
description: How aiDimag's claim-and-verify model differs from conversational memory layers, vector-store memory plugins, and hand-maintained context files — and why that matters for coding agents.
head:
  - - meta
    - name: keywords
      content: AI memory comparison, verified memory, coding agent memory, AI agent memory systems, claim and verify, stale context, codebase memory
  - - meta
    - property: og:title
      content: How aiDimag Compares - Verified Codebase Memory
  - - meta
    - property: og:url
      content: https://aidimag.com/comparison
  - - link
    - rel: canonical
      href: https://aidimag.com/comparison
---

# How aiDimag compares

aiDimag is not a general-purpose "AI memory" product. It is a **memory system for
software engineering**: the thing it remembers is your *codebase* — decisions,
conventions, invariants, gotchas, failed approaches, guardrails, and step-by-step
skills — and the thing it optimizes for is whether those facts are **still true of the
code right now**.

That focus produces a different design from the memory tools you may have seen. This page
compares aiDimag against the common *categories* of memory systems, then against the
specific products people ask about most.

## The core difference: store-and-retrieve vs claim-and-verify

Almost every memory layer for AI agents follows the same model:

> **Store-and-retrieve** — capture text (chat history, extracted facts, embedded
> documents), then retrieve the most *similar* items later. Once stored, a fact is
> assumed true forever. At best it fades with age or carries a label describing how
> trustworthy it *was when written*.

That model is fine for remembering that a user prefers dark mode. It is dangerous for
remembering that "all DB access goes through `src/db/store.ts`" — because codebases
change, and a confidently-retrieved stale fact is *worse* than no memory at all: your
agent will act on it.

aiDimag's model:

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
  actively block or flag work that contradicts verified memory. Store-and-retrieve
  systems only ever *inject* context; they can't enforce it.

## Category-by-category

| | Conversational memory layers | Vector-store memory plugins | Hand-maintained context files | **aiDimag** |
|---|---|---|---|---|
| **Built for** | Chat assistants remembering *users* (preferences, past conversations) | General recall over embedded text | Giving coding agents static instructions | **Coding agents working in a living repo** |
| **Unit of memory** | Extracted facts / summarized conversation chunks | Embedded text chunks | Prose instructions | **Falsifiable claims with evidence, typed** (DECISION, INVARIANT, GUARDRAIL, SKILL…) |
| **How memory gets in** | Automatic — everything the model deems memorable is stored | Automatic embedding of whatever you feed it | A human edits a file, occasionally | **Human-gated**: commits, PRs, chats, and docs are mined into *proposals*; nothing is stored without review |
| **When the code changes** | Nothing happens — stored facts stay "true" | Nothing happens | The file silently rots until someone notices | **Evidence re-runs on every pull/checkout; broken claims flip to STALE and draft a recovery proposal** |
| **Trust model** | Optional write-time label (stated vs inferred), never re-checked | Similarity score ≈ trust | "It's in the file, so it's policy" | **Verification status + confidence that decays without re-confirmation; trust-ranked retrieval** |
| **Enforcement** | None — context injection only | None | Depends on the model reading carefully | **Guardrails + pre-commit `dim check` + `memory_critique` (a second critic grounded in verified memory)** |
| **Scoping** | Per-user | Per-collection | Per-repo, one big file | **Per-path and per-symbol** — memories surface only for the files being edited |
| **Short-term memory** | Conversation window management | — | — | **Scratchpad**: TTL-expiring session notes, kept strictly separate from durable memory |
| **Security of shared memory** | N/A (single user) | N/A | Committed file — anyone can edit | **Evidence trust gate**: synced-in shell checks never execute until you inspect and approve them |
| **Team story** | Per-user cloud accounts | Shared collection | Merge conflicts in a markdown file | **Self-hosted sync with last-writer-wins, tombstones, and cross-machine verification consensus** |
| **Failure mode** | Confidently recalls things that are no longer true | Retrieves whatever is similar, true or not | Instructions drift from reality | **Says "this went stale" instead of guessing** |

## Product-by-product

The tools people most often ask about, and where each one actually sits. Most of
them are *conversational/agent* memory — excellent at remembering users and chat
sessions, which is a different problem from remembering a living codebase:

| | **aiDimag** | Mnemosyne | mem0 | Letta | Honcho | SuperMemory | Hindsight | ChromaDB |
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
| **Published benchmarks** | [Own reproducible suite](/benchmarks): 100% staleness detection / 0% FP | BEAM 65.2%, LongMemEval 98.9% R@All@5 (self-reported, v3.0.0) | LoCoMo | LoCoMo 83.2% | LongMemEval 90.4% | MemoryBench 85.2% | BEAM 73.4%, LongMemEval 94.6% | — |

Competitor figures are the numbers those projects publish themselves (metrics and
judges differ between them — see each project's methodology before comparing rows).

**Why aiDimag doesn't publish LoCoMo / LongMemEval / BEAM scores:** those benchmarks
measure recall over long *conversation histories* — the subject of memory is the
user and the chat. aiDimag's subject is the repository, so the honest equivalents are
different questions: *does recall return the right claim about the code?* and *does
memory notice when the code drifts?* Both are measured in the
[reproducible benchmark suite](/benchmarks) — retrieval Recall@k/MRR over a labeled
query set, and staleness detection against a real mutating git repo (100% detection,
0% false positives). No chat-memory benchmark measures the second property at all —
in a store-and-retrieve system there is nothing to re-verify.

- **Choose Mnemosyne / mem0 / Honcho / SuperMemory** when the thing to remember is a
  *user or conversation* across sessions.
- **Choose Letta** when you want a full agent runtime that manages its own context.
- **Choose ChromaDB** when you need a vector database, not a memory system.
- **Choose Hindsight** for general agent memory with strong published recall numbers.
- **Choose aiDimag** when AI coding agents keep re-discovering or misremembering how
  your *codebase* works — and you need memories that prove they're still true.

## What aiDimag deliberately does *not* do

Being focused on engineering means saying no to things general-purpose memory products do:

- **It doesn't remember users.** No preference tracking, no personalization profiles.
  The subject of memory is the repository, not the person.
- **It doesn't auto-store everything.** Automatic capture without review fills memory
  with plausible-sounding noise. Every capture channel in aiDimag ends at `dim review`.
- **It doesn't manage your chat window.** Conversation summarization and token budgeting
  belong to the host agent. aiDimag supplies the *durable* layer underneath (plus a
  scratchpad for in-flight session state).
- **It doesn't require a cloud.** One SQLite file per repo, next to your code. Team sync
  is optional and self-hostable.

## When you'd want something else

Honest scoping: if you're building a consumer chat assistant that must remember user
preferences across sessions, a conversational memory layer is the right tool. If you need
general semantic recall over a large document corpus, use a vector store directly.

Use aiDimag when the problem is: **AI coding agents keep re-discovering, re-asking, or —
worse — confidently misremembering how your codebase works.**

Next: **[Install & setup](/getting-started)**.

