---
title: Why AIDimag? | Claim-and-Verify Memory for Coding Agents
description: AIDimag doesn't just store context — it verifies every claim against the codebase. Learn why claim-and-verify beats store-and-retrieve for AI coding agents.
head:
  - - meta
    - name: keywords
      content: why aidimag, claim and verify, verified memory, codebase memory, AI coding agent memory, stale context, evidence-backed memory, coding agent context
  - - meta
    - property: og:title
      content: Why AIDimag? — Claim-and-Verify Memory for Coding Agents
  - - meta
    - property: og:description
      content: Most memory systems store text and assume it's true forever. AIDimag verifies every claim against the code — so agents stop trusting stale facts.
  - - meta
    - property: og:url
      content: https://aidimag.com/why-aidimag
  - - link
    - rel: canonical
      href: https://aidimag.com/why-aidimag
---

# Why AIDimag?

Your coding agent doesn't need more context. It needs the **right** context — and it needs
to know when that context is no longer true.

## Chat memory ≠ Codebase memory

Most AI memory systems are built for **conversational memory**: remembering users,
preferences, and chat history across sessions. That's a different problem from remembering
a **living codebase**.

| | Chat memory | **Codebase memory** |
|---|---|---|
| **Subject** | User preferences, conversation history | Repository architecture, decisions, conventions |
| **Changes** | Rarely — preferences are stable | Constantly — code changes every day |
| **Risk of stale** | Low — a wrong preference is annoying | High — a wrong claim about code causes bugs |
| **Verification** | Impossible — there's nothing to check | Possible — run the evidence against the repo |

AIDimag is built for the second column. It doesn't track preferences or chat history. The
subject of memory is your **repository**.

## The core difference: store-and-retrieve vs claim-and-verify

Almost every memory layer for AI agents follows the same model:

> **Store-and-retrieve** — capture text, then retrieve the most *similar* items later. Once
> stored, a fact is assumed true forever.

That model is fine for remembering that a user prefers dark mode. It is dangerous for
remembering that "all DB access goes through `src/db/store.ts`" — because codebases change,
and a confidently-retrieved stale fact is *worse* than no memory at all: your agent will act
on it.

AIDimag's model:

> **Claim-and-verify** — every memory is a *falsifiable claim* with attached **evidence** (a
> shell check, an anchored commit, a test). `dim verify` re-runs that evidence against the
> current repo — automatically, via git hooks, after every pull, checkout, and rebase. A
> claim that stops being true flips to **STALE** instead of silently misleading your agent.

### What this looks like in practice

```sh
# Remember a claim with evidence
dim remember "All DB access goes through src/db/store.ts" \
  -k CONVENTION -p src/db \
  -e "STATIC_CHECK:grep -rL better-sqlite3 src --include=*.ts"
```

```
✓ [CONVENTION] All DB access goes through src/db/store.ts
    id=4f3a9c21 status=VERIFIED conf=0.80 scope=src/db
    evidence: STATIC_CHECK(PASS) grep -rL better-sqlite3 src --include=*.ts
```

Someone adds a direct `better-sqlite3` import elsewhere. Next pull triggers verification
automatically:

```
~ [VERIFIED → STALE] conf 0.80→0.20  All DB access goes through src/db/store.ts
    STATIC_CHECK: FAIL (command exited 1)
```

The memory is now **stale** — and any agent that searches for it is told not to trust it
until it's fixed. A recovery proposal is auto-drafted so a human decides: did the code drift,
or is the claim now wrong?

## What makes AIDimag different

- **Claim-and-verify, not store-and-retrieve.** Most memory systems store text and retrieve
  whatever is similar later — a stored fact is assumed true forever. AIDimag re-runs each
  memory's evidence against the current repo, so trust reflects *now*, not *when it was
  written*. See [How aiDimag compares](/comparison).
- **Local-first.** Everything lives in a single SQLite file in `.aidimag/` next to your code.
  No account required to start.
- **Human-gated.** Nothing becomes active memory automatically — proposals wait in a review
  queue until you approve them.
- **Self-correcting.** Memories carry confidence that decays over time and collapses when
  evidence fails, so trust expires instead of lingering.
- **Enforcing, not just informing.** Guardrails, pre-commit `dim check`, and the
  `memory_critique` second-critic actively catch work that contradicts verified memory.
- **Team-optional.** Add a self-hosted sync server when you want a shared brain. No SaaS
  lock-in.

## The four memory statuses

| Status | Meaning |
|---|---|
| **VERIFIED** | Its machine-checkable evidence currently passes. Trust it. |
| **UNVERIFIED** | Stored, but its evidence hasn't confirmed it (or it has none yet). |
| **STALE** | Evidence that used to pass now **fails** — the code changed under it. Don't trust it until it recovers. |
| **REFUTED** | Deliberately marked false (by a human or agent). Kept as *negative knowledge*. |

The important rule: **a failing check always makes a memory stale**, no matter what else is
true about it. That's what keeps memory honest.

## How AIDimag compares to alternatives

| | Conversational memory | Vector-store plugins | Hand-maintained files | **AIDimag** |
|---|---|---|---|---|
| **Built for** | Chat assistants remembering *users* | General recall over embedded text | Static instructions for agents | **Coding agents in a living repo** |
| **Unit of memory** | Extracted facts / chat summaries | Embedded text chunks | Prose | **Falsifiable, typed claims with evidence** |
| **When code changes** | Nothing — stored facts stay "true" | Nothing | File silently rots | **Evidence re-runs via git hooks; broken claims flip STALE** |
| **Trust model** | Write-time label, never re-checked | Similarity ≈ trust | "It's in the file" | **Verification status + decaying confidence; trust-ranked retrieval** |
| **Enforcement** | None — injection only | None | Hope the model reads it | **Guardrails + pre-commit `dim check` + `memory_critique`** |
| **Failure mode** | Confidently recalls outdated facts | Retrieves similar, true or not | Instructions drift from reality | **Says "this went STALE" instead of guessing** |

Full product-by-product comparison against Mnemosyne, mem0, Letta, Honcho, SuperMemory,
Hindsight, and ChromaDB: **[How aiDimag compares](/comparison)**.

## When you'd want something else

Honest scoping: if you're building a consumer chat assistant that must remember user
preferences across sessions, a conversational memory layer is the right tool. If you need
general semantic recall over a large document corpus, use a vector store directly.

Use AIDimag when the problem is: **AI coding agents keep re-discovering, re-asking, or —
worse — confidently misremembering how your codebase works.**

---

Next: **[Use cases](/use-cases)** · **[Getting started](/getting-started)** · **[How it works](/how-it-works)**
