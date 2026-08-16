---
title: Use Cases | AIDimag for Coding Agents
description: Real-world scenarios where AIDimag gives coding agents persistent, verified knowledge about your codebase — architecture, conventions, decisions, staleness detection, and more.
head:
  - - meta
    - name: keywords
      content: AIDimag use cases, coding agent memory, codebase memory, architecture memory, project conventions, staleness detection, cross-session knowledge, large codebase navigation
  - - meta
    - property: og:title
      content: Use Cases — AIDimag for Coding Agents
  - - meta
    - property: og:description
      content: Real scenarios where verified codebase memory helps AI coding agents stop re-discovering architecture, enforce conventions, and detect stale knowledge.
  - - meta
    - property: og:url
      content: https://aidimag.com/use-cases
  - - link
    - rel: canonical
    - href: https://aidimag.com/use-cases
---

# Use cases

AIDimag gives coding agents persistent, verified knowledge about your repository. Here are
the scenarios where it makes the biggest difference.

## Architecture memory

**Problem:** Every new session, your coding agent re-discovers how the system is structured.
You explain the same architecture, the same layering, the same data flow — over and over.

**With AIDimag:** Remember architectural decisions as typed claims with evidence. The agent
recalls them at session start and when working on relevant files.

```sh
dim remember "The API layer is stateless; all state lives in src/db/store.ts" \
  -k ARCHITECTURE -p src/api -p src/db \
  -e "STATIC_CHECK:grep -rL 'useState\|useState' src/api --include=*.ts"
```

When someone adds stateful logic to the API layer, the memory goes **STALE** — the agent is
warned, not misled.

## Project conventions

**Problem:** Your agent writes code that doesn't follow the repo's conventions — wrong naming,
wrong file placement, wrong patterns. You correct it every session.

**With AIDimag:** Record conventions as checkable claims. Enforce the most important ones
with [guardrails](/guides/guardrails) and pre-commit `dim check`.

```sh
# Convention with evidence
dim remember "All API endpoints are registered in src/api/routes.ts" \
  -k CONVENTION -p src/api \
  -e "STATIC_CHECK:grep -rL 'router\.' src/api --include=*.ts --exclude=routes.ts"

# Guardrail the agent must obey
dim remember "Never call the production payments API from tests; use the sandbox client" \
  -k GUARDRAIL -g never -p src/payments
```

## Technical decisions

**Problem:** Your team made a deliberate choice — rejected an approach, picked a library,
avoided a pattern — but nobody remembers why six months later. The agent suggests the
rejected approach again.

**With AIDimag:** Record the decision *and the rejected alternatives* as a DECISION memory.
The agent sees the context and doesn't retry a dead end.

```sh
dim remember "We use better-sqlite3 (not drizzle) because we need raw SQL control for audit queries" \
  -k DECISION -p src/db
```

## Cross-session knowledge

**Problem:** Knowledge that should survive individual conversations is lost when the session
ends. The agent has to re-learn everything.

**With AIDimag:** Session-start briefings (`dim brief`) pull in relevant memory automatically
— guardrails, in-scope verified claims, and warnings. Session-end extraction proposes durable
learnings for review. Nothing is stored without your approval.

```sh
dim brief    # session-start: guardrails, in-scope memory, gaps
# ... work with your agent ...
# agent proposes learnings at session end → dim review to approve
```

## Staleness detection

**Problem:** A convention was true six months ago but isn't anymore. Your agent confidently
follows the outdated rule because nothing told it the code changed.

**With AIDimag:** Evidence re-runs automatically via git hooks on every pull, checkout, and
rebase. When a claim stops being true, it flips to **STALE** and a recovery proposal is
auto-drafted.

```sh
dim verify   # re-run all evidence
# Output:
# ~ [VERIFIED → STALE] conf 0.80→0.20  All DB access goes through src/db/store.ts
#     STATIC_CHECK: FAIL (command exited 1)
```

The agent is told *not* to trust the stale memory until it's re-confirmed. See
[Verifying memories](/guides/verifying).

## Large codebases

**Problem:** In a large repo, understanding everything from scratch is expensive. The agent
spends tokens and time re-reading files to understand context you already know.

**With AIDimag:** Path-scoped recall surfaces only memory relevant to the files being edited.
The agent gets the context it needs without re-reading the entire codebase.

```sh
dim recall "authentication" -p src/auth    # only memories scoped to src/auth
```

## Guardrails and enforcement

**Problem:** You have rules the agent must follow — "never deploy from a test branch",
"always ask before modifying src/core", "never call production APIs from tests" — but the
agent ignores them because they're just text in a file.

**With AIDimag:** Guardrails are typed memories with enforcement levels (`never`,
`ask-first`, `always`). `dim check` runs as a pre-commit hook and catches contradictions.
The `memory_critique` MCP tool gives the agent a second critic grounded in your verified
rules.

```sh
dim remember "Never modify src/core/schema.ts without team approval" \
  -k GUARDRAIL -g ask-first -p src/core/schema.ts
```

See [Guardrails](/guides/guardrails) and [Pre-commit checks](/guides/dim-check).

## Knowledge from git history

**Problem:** Your git log contains years of decisions, gotchas, and failed approaches — but
nobody reads it, and the agent certainly doesn't.

**With AIDimag:** `dim mine` scans commits and PRs for memory-worthy signals and proposes
candidates for review. Nothing is stored automatically.

```sh
dim mine               # fast keyword heuristics
dim mine --llm --full  # LLM reads commits + diffs (needs Ollama or OPENAI_API_KEY)
dim mine --prs         # mine merged GitHub PRs + review comments (needs gh CLI)
dim review             # approve, reword, or drop each proposal
```

## Knowledge from docs

**Problem:** You have design docs, ADRs, and style guides scattered across the repo. The
agent never reads them.

**With AIDimag:** Drop docs into `knowledge/` and `dim knowledge sync` summarizes them into
the review queue. Approved claims become *pinned* memories that never decay.

```sh
mkdir knowledge/
cp docs/architecture-decision.md knowledge/
dim knowledge sync
dim review   # approve the summarized proposals
```

See [Knowledgebase](/guides/knowledgebase).

---

Next: **[Getting started](/getting-started)** · **[Why AIDimag?](/why-aidimag)** · **[How it works](/how-it-works)**
