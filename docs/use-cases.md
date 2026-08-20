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
  -e "STATIC_CHECK:! grep -rl 'useState' src/api --include=*.ts"
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
  -e "STATIC_CHECK:! grep -rl 'router\.' src/api --include=*.ts --exclude=routes.ts"

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

## Learning from incidents

**Problem:** A production incident or CI failure reveals a failed approach, but the lesson
stays in a postmortem doc that nobody re-reads. Next sprint, the agent suggests the same
broken pattern.

**With AIDimag:** `dim capture incident` reads a JSON or markdown incident report and
proposes a `FAILED_APPROACH` memory with provenance evidence (commit ref, ticket ref,
failed command, CI URL). `dim capture ci-log` parses raw CI failure logs from files or
stdin, extracting error lines, failed commands, file paths, and commit SHAs. After review,
the memory blocks future attempts.

```sh
dim capture incident postmortem-payments-retry-storm.md
dim capture incident incident.json --llm   # LLM synthesizes a richer claim
dim capture ci-log ci-failure.log          # parse raw CI log
dim capture ci-log - < actions-output.txt  # pipe from stdin
dim review                                  # approve the proposal
```

## Protecting critical code

**Problem:** Certain paths — authentication, payments, PII handling, database migrations —
are too sensitive for unsupervised agent changes. But nothing stops the agent from editing
them.

**With AIDimag:** Define critical areas in `.aidimag/critical-areas.yml` with required
owners, approval tokens, and block/warn mode. `dim check` enforces: changes to critical
paths without the approval token in the commit message are flagged or blocked.

```yaml
# .aidimag/critical-areas.yml
areas:
  - label: Authentication
    paths: [src/auth]
    owners: [alice@example.com]
    block: true
    approvalToken: "[AUTH-OK]"
```

```sh
git commit -m "refactor auth middleware [AUTH-OK]"   # passes
git commit -m "refactor auth middleware"              # blocked by dim check --block
```

## Change-risk scoring

**Problem:** Some changes are riskier than others — they touch guardrails, critical areas,
or memories with low confidence. But all changes look the same to the agent.

**With AIDimag:** `dim check` computes a 0–100 risk score from violation severity, memory
kind/status/confidence, evidence count, critical-area membership, and change breadth. The
score and its factors are displayed alongside the check output, so reviewers know where to
focus.

```
Risk Score: 72/100 [HIGH]
  ██████████████░░░░░░
  Factors:
    +48 GUARDRAIL violation (fail) — never modify schema without approval
    +25 Critical area: Migrations — 3 file(s) touched
```

## Compliance and audit trail

**Problem:** For regulated teams, you need to prove who approved each memory, what evidence
supports it, and that the history hasn't been tampered with.

**With AIDimag:** Every memory-lifecycle event is recorded in an append-only event log.
`dim audit export` produces a tamper-evident, SHA-256 chained export (JSON or CSV) suitable
for compliance review. `dim audit verify` confirms integrity of a previous export.

```sh
dim audit export --format json --output audit-2026-08.json
dim audit verify audit-2026-08.json    # ✓ no tampering detected
```

## Team knowledge health

**Problem:** You've been using AIDimag for months. Which areas of the codebase have
well-covered knowledge, and which are gaps? Are memories going stale? Are there
unreviewed proposals piling up?

**With AIDimag:** `dim health` prints a dashboard with memory counts by status/kind, pinned
and pending proposal counts, per-path risk scores, oldest stale memories, and actionable
suggestions. `dim ui` includes a Health tab with an interactive risk score banner, coverage
heatmap of top risk paths, verify pass-rate trend chart, token usage trends, proposal
throughput metrics, and agent activity breakdown.

```sh
dim health              # text dashboard
dim health --format json # machine-readable
dim ui                   # open web dashboard with Health tab
```

## Cross-agent instruction drift

**Problem:** You generate context files for Claude Code, Cursor, and Copilot — but over
time, the memory store evolves and the generated files go stale. Agents start following
outdated rules.

**With AIDimag:** `dim generate-context --check` compares generated context files against
the memory store, reports missing or stale rules per agent, and exits non-zero on drift.
Run it in CI to catch drift before agents do.

```sh
dim generate-context --check   # exits 2 if any agent's context is out of sync
```

## Memory retention and cleanup

**Problem:** Over time, the memory store accumulates old agent-authored memories with no
evidence — they were useful once but are now just noise that dilutes recall quality.

**With AIDimag:** `dim retention` auto-forgets memories older than a configurable threshold
that have no supporting evidence. STALE memories can be cleaned up on a separate schedule.
Pinned, human-authored, and REFUTED memories are always preserved.

```sh
dim retention --dry-run --max-age-days 90   # preview
dim retention --max-age-days 90              # execute
```

## Role-based access control

**Problem:** On a shared sync server, not everyone should have the same access. Junior devs
might only need read access, while team leads need write, and only admins should manage keys.

**With AIDimag:** `dim users` manages RBAC roles on the sync server. Three roles — `admin`,
`member`, `viewer` — can be assigned globally or overridden per brain.

```sh
dim users create --username alice --role member
dim users set-role --user-id <uuid> --role viewer --brain restricted-repo
```

## Single sign-on (OIDC)

**Problem:** Teams already have an identity provider (Google, Okta, Azure AD). They don't want
to manage separate credentials for the sync server.

**With AIDimag:** `dim oidc` configures an OIDC provider on the sync server. Users authenticate
via their existing IdP, and the `sub` claim maps to an aidimag user account.

```sh
dim oidc set --issuer https://accounts.google.com \
  --client-id ... --client-secret ... \
  --redirect-uri https://your-server/v1/auth/oidc/callback
```

---

Next: **[Introduction](/introduction)**.
