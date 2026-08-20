# AIDimag Improvement Action Plan

**Code snapshot for this assessment:**
- Reviewed commit: `b8f63781e6670c8d779a073f922f776406e5984d`
- Assessment date: August 16, 2026
- Source references are repo-relative (`src/...`) so this plan remains readable as the code evolves.

## Strategic Position

**AIDimag is the independent trust and governance layer for coding agents.**

Native memory is becoming a commodity (Claude Code Memory, GitHub Copilot Memory, Cursor). To stand out, AIDimag must own cross-agent consistency, verified institutional knowledge, and mistake prevention. The moat is not persistence. The moat is *trust*: one canonical, verifiable source of truth that prevents every agent your team uses from breaking shared rules or repeating known failures.

---

## Guiding Principles

1. **Show, don't tell.** Every visitor should experience the value in under a minute.
2. **One-command setup.** Reduce friction from npm install to first verified memory to a single command.
3. **Position against Copilot honestly.** Acknowledge native memory, then explain why portable, enforceable, open, verified memory still matters.
4. **Focus on team workflow, not solo convenience.** The enterprise wedge is governance and institutional knowledge preservation.
5. **Measure value in outcomes, not features.** Tokens saved, regressions prevented, mistakes avoided, time to first correct edit.

---

## Phased Roadmap

### Phase 1: Developer Wedge (Months 1–2)

Goal: a single developer installs AIDimag in 60 seconds and immediately sees value.

| Priority | Feature | Why It Differentiates | Definition of Done | Current State |
|----------|---------|----------------------|-------------------|---------------|
| P0 | `npx aidimag setup` auto-configures all detected agents | One command installs MCP configs, initializes repo, suggests first memories | Detects existing configs, shows proposed changes in dry-run, merges without overwriting, backs up, verifies integrations, supports rollback; works for Claude Code, Cursor, Copilot, Codex | **Implemented.** `dim setup` runs `dim init`, installs git hooks, and wires MCP configs for Claude Code (`.mcp.json`), Cursor (`.cursor/mcp.json`), Windsurf (`.windsurf/mcp_config.json`), OpenAI Codex (`.codex/config.json`), and GitHub Copilot (`.vscode/settings.json`). Supports `--dry-run`, `--yes`, `--agent`, `--force`, `--context-files`, and `--bootstrap`. `dim doctor` verifies all integrations. `dim uninstall-integrations` cleanly removes all configs with backups. 11 tests passing. **Risk:** `better-sqlite3`/`sqlite-vec` require native builds, so setup must document prerequisites and degrade gracefully. |
| P0 | Interactive homepage demo | Visitors experience AIDimag's value in under a minute | Polished interactive walkthrough on homepage, plus a downloadable sample repo for the real CLI experience | **Implemented.** Interactive demo page at `/demo` (VitePress + Vue `<script setup>`) simulates the full AIDimag workflow in 6 steps: remember → verify → code change → dim check (block) → staleness detection → FAILED_APPROACH warning. Features typed terminal animation, live memory card state updates, diff visualization, risk score display, auto-play mode, and progress navigation. Linked from homepage CTA, nav bar, and sidebar. Downloadable sample repo page at `/sample-repo` with build script (`scripts/build-sample-repo.sh`) that generates a tar.gz with pre-seeded memories, git history with a reverted commit, critical-areas config, and generated CLAUDE.md. |
| P0 | `FAILED_APPROACH` memory type | "Never repeat this mistake" is the strongest emotional and practical hook | End-to-end loop: capture lesson from reverted commit/CI/PR → human review → warn/block agent before it repeats the approach → record outcome | **Implemented.** `dim mine` detects git revert commits and proposes `FAILED_APPROACH` memories with `applies_when` pointing at the original commit; `dim check` warns on staged changes that resemble the failed approach; MCP `memory_check_change` gives agents a pre-edit warning. CLI `dim remember --kind FAILED_APPROACH --applies-when ...` and context capture via MCP also support applicability conditions. `dim capture ci-log --github` auto-fetches failed GitHub Actions run logs via `gh` CLI. `dim capture incident --batch <dir>` supports bulk ingestion. `applies_when` conditions are now evaluated at check time via `evaluateAppliesWhen` in `src/verify/check.ts` — supports `path:`, `symbol:`, `keyword:`, `original_commit:` prefixes and bare-text keyword matching, so FAILED_APPROACH warnings only fire when the preconditions of the original failure are still present. |
| P1 | Token-budgeted retrieval | `dim recall "..." --max-tokens 800` and `dim context --task "..." --budget 1200` | Three presets (minimal/standard/deep); reports tokens saved | **Implemented.** `dim recall` accepts `--max-tokens`/`--budget` and drops memories that exceed the budget while reporting the count. New `dim context` command builds a task-scoped prompt block with `--budget`, `--preset minimal|standard|deep`, and `--format json|markdown`, ranking GUARDRAIL/INVARIANT/FAILED_APPROACH highest. Tokenizer defaults to a conservative ~4-char heuristic; set `AIDIMAG_TOKENIZER=openai` to use `gpt-tokenizer` if installed. Now supports `--max-chars` mode as an alternative to token budgets. Per-model token estimation now supports Claude (~3.5 chars/token), Gemini (~4), Llama/Mistral (~3.8) via `AIDIMAG_TOKENIZER` or `AIDIMAG_MODEL` env vars. OpenAI uses exact counts via `gpt-tokenizer` when installed. `resolveModelFamily` auto-detects model family from model name patterns (sonnet/haiku/opus → claude, gemini/flash → gemini, etc.). |
| P1 | Pre-edit and pre-commit guardrails | Block or warn before an agent violates a verified rule | Integrates with Claude hooks; runs on `dim check` and git pre-commit | **Implemented.** `dim check --block` and git pre-commit hooks exist `src/cli/commands/verify.ts:82-123`. MCP `memory_check_change` provides structured pre-edit guidance with proceed/ask_first/stop decisions, risk scores, and critical-area enforcement. New MCP `memory_pre_edit` tool checks a specific file + code snippet against guardrails and returns a clear STOP/PROCEED decision. Both tools integrate risk scoring and critical-area checks for agent-native pre-edit blocking. |
| P1 | Diff-aware context (`dim context --diff`) | Only retrieve memories relevant to the current diff | Reduces noise and token waste in agent sessions | **Implemented.** `dim context --diff` reads changed files from the working tree (or `--staged`) and uses them as path filters, returning only memories scoped to the files the agent is about to touch. Optional `--task` query combines with the diff-scoped path filter. Symbol-level extraction from the diff is now supported via `src/verify/diff-symbols.ts`, which extracts function/class/method names from added lines and passes them as `symbols` to `hybridSearch` for tighter matching. |

### Phase 2: Team Workflow (Months 3–4)

Goal: AIDimag becomes part of the code-review process and shared team knowledge.

| Priority | Feature | Why It Differentiates | Definition of Done | Current State |
|----------|---------|----------------------|-------------------|---------------|
| P0 | Memory PRs / Knowledge Impact checks | PRs review code and knowledge changes together | GitHub Action posts memory impact summary; stale memories, new decisions, affected guardrails | **Implemented.** `dim impact` diffs a PR branch against `main`, finds memories scoped to changed files, and reports affected guardrails/invariants/conventions/FAILED_APPROACH entries. The reusable GitHub Action posts both `dim check` results and the `dim impact --verify` report as a sticky PR comment. `--verify` flag runs evidence checks to predict which memories would go STALE if the PR merges. `dim impact` now highlights new decisions (DECISION/CONVENTION/ARCHITECTURE/GUARDRAIL) created within the PR's commit range, rendered in a dedicated section. `dim impact --fail-on-impact` exits 1 when violations or stale predictions are found, and `--max-stale-risk <n>` exits 1 when the stale risk score exceeds a threshold. The GitHub Action workflow (`aidimag-check.yml`) and reusable action (`aidimag-check/action.yml`) now include a `fail-on-impact` input and a dedicated step that fails the PR check on knowledge impact. |
| P0 | Cross-agent instruction sync | Compile canonical rules into CLAUDE.md, AGENTS.md, Cursor rules, Copilot instructions | Drift detection reports where each agent is missing or outdated | **Implemented.** `dim generate-context` emits `claude`, `cursorrules`, `copilot`, `windsurfrules`, and `agents` formats. `dim generate-context --check` compares each generated file against the canonical memory store, reports missing and stale rules per agent, and exits 2 on drift. `dim generate-context --check --fix` auto-regenerates files when drift is detected. `--auto` flag persists the setting so verify/review/sync keep context files fresh automatically. Fixed guardrail prefix stripping in drift detection so `ASK FIRST:`/`NEVER:`/`ALWAYS:` prefixes don't cause false drift. Per-agent format customization is now supported via `AGENT_FORMATS` in `src/context/generate.ts`, allowing different heading styles, guardrail prefixes, section ordering, and scope annotations per agent format. |
| P1 | Team knowledge health dashboard | Show memory coverage, staleness, conflicts, repeated agent mistakes | Manager/lead can see which code areas are high-risk | **Implemented.** `dim health` prints status/kind counts, pinned/proposal counts, per-path risk scores (guardrails, stale, failed approaches), oldest stale memories, and actionable suggestions. `dim ui` now includes a Health tab with: overall risk score banner with progress bar, memory summary metric cards (total, verified, unverified, stale, refuted, failed approaches, pending proposals, pinned, coverage paths), coverage heatmap showing top risk paths with color-coded risk bars, verify pass-rate trend chart (last 30 days, color-coded by pass rate), token usage trend chart with tooltips, proposal throughput metrics (approval rate), agent activity breakdown, and actionable suggestions. `/api/health` and `/api/analytics` endpoints power the dashboard. `dim health` now includes repeated-mistake trend analysis (grouping FAILED_APPROACH memories by path, detecting increasing/stable/decreasing trends) and configurable alert thresholds (`--max-stale`, `--max-pending`, `--max-risk-score`, `--max-repeated-mistakes`). Alerts are rendered in the CLI output and included in JSON format. The web UI Health tab now renders alerts and repeated-mistake trends with a visual timeline showing failure dates, trend direction (increasing/stable/decreasing) with color-coded indicators, and failure counts per area. |
| P1 | Capture from PRs, tickets, incidents | Proposed memories with provenance; human approval required | Adapters for GitHub PRs, Jira/Linear, incident reports, reverted commits | **Implemented.** `dim mine --prs` mines merged GitHub PRs, and ticket providers exist for Jira/Linear/GitHub. `dim capture incident` reads JSON or markdown incident reports. `dim capture ci-log` parses raw CI failure logs (GitHub Actions, Jenkins, etc.) from files or stdin, extracting error lines, failed commands, file paths, commit SHAs, and CI URLs into a FAILED_APPROACH proposal. `parseReport` auto-detects `.log`/`.txt` files as CI logs. `dim capture ci-log --github [run-id]` auto-fetches failed GitHub Actions run logs via `gh` CLI (supports `latest` or numeric run ID). `dim capture incident --batch <dir>` supports bulk ingestion of all report files in a directory. |
| P2 | Cross-machine sync | Shared team memory store | Encrypted sync via configured backend or self-hosted server | **Implemented.** `dim serve`, `dim cloud link`, and `dim sync` provide self-hosted team sync with token auth `src/cli/commands/sync.ts:11-25` and `src/sync/`. |

### Phase 3: Enterprise Control Plane (Months 5–6)

Goal: AIDimag becomes a required governance layer for AI-generated code.

| Priority | Feature | Why It Differentiates | Definition of Done | Current State |
|----------|---------|----------------------|-------------------|---------------|
| P0 | Protected code boundaries | Mark auth, payments, PII, migrations as critical; enforce owners, tests, approvals | Config via YAML; blocks unapproved changes | **Implemented.** `.aidimag/critical-areas.yml` (or `.json`) defines critical areas with paths, owners, required tests, approval tokens, and block/warn mode. `dim check` reads the config, checks changed files against critical paths, and blocks (exit 1 with `--block`) when a change touches a critical area without the approval token in the commit message. The reusable GitHub Action (`.github/actions/aidimag-check/action.yml`) supports `require-owner-approval` (fetches PR reviews and fails if no listed owner has approved) and `run-required-tests` (runs tests listed in critical-areas config and fails if any fail). `dim ui` now includes an "Areas" tab for full CRUD management of critical areas — add/edit/remove areas with paths, owners, approval tokens, required tests, and block/warn mode, persisted via `GET/PUT /api/critical-areas` endpoints backed by `writeCriticalAreas` in `src/verify/critical-areas.ts`. |
| P0 | AI change-risk score | Score each agent edit before it proceeds | Risk > threshold requires human approval; rationale listed | **Implemented.** `dim check` computes a 0–100 risk score from violation severity, memory kind/status/confidence, evidence count, critical-area membership, and change breadth. Score is rendered as a progress bar with per-factor breakdown. Levels: low (<30), medium (30–59), high (60–79), critical (80+). `dim check --json` outputs a structured report with `riskScore`, `riskLevel`, `riskFactors`, `violations`, `criticalAreaViolations`, `changedFiles`, and `passed` fields for CI integration. `dim check --risk-threshold <n>` exits 1 when the score exceeds the threshold. The reusable GitHub Action accepts a `risk-threshold` input and posts a structured PR comment with a risk score table, risk factor breakdown, violation details, and critical area enforcement status. MCP pre-edit enforcement is now configurable via `mcpEnforce` in `.aidimag/config.json` (`warn` | `enforce` | `off`, default `warn`). In `enforce` mode, `memory_check_change` and `memory_pre_edit` return `isError: true` when the decision is `STOP`, providing a hard block that agents must respect. `resolveMcpEnforceConfig` in `src/config.ts` reads the setting. |
| P1 | Audit trail and compliance | Who approved each memory, what evidence supports it, history of changes | Tamper-evident log; export for compliance | **Implemented.** `dim audit export` produces a tamper-evident, SHA-256 chained event log (JSON/CSV/summary) of all memory-lifecycle events. `dim audit verify` confirms integrity of a previously exported file. `dim audit findings` surfaces memories on the least ground (provenance audit). Every memory has `createdBy`, `createdAt`, `updatedAt`, grounding evidence. `dim audit sign <evidence-id>` cryptographically signs evidence rows with Ed25519 keys, storing the signature and signer identity; signed evidence provides non-repudiable provenance. Immutable history enforced at the DB level via SQLite triggers that reject UPDATE/DELETE on event data columns (the `synced` column is exempt for `dim sync`). Schema v13 adds `signature`/`signed_by` columns to evidence and `evidence_signed` event type. 12 tests passing. |
| P1 | RBAC, SSO, retention | Enterprise readiness | Role-based memory access; SSO integration; retention policies | **Implemented.** `dim users` manages RBAC roles (admin/member/viewer) with per-brain overrides on the sync server. `dim oidc` configures OIDC SSO (Google, Okta, Azure AD) with CSRF-protected login/callback flow and automatic token minting. `dim retention` auto-forgets old evidence-free memories with configurable thresholds, preserving pinned/human/REFUTED memories. 20 tests passing (9 retention + 11 RBAC/SSO). |
| P2 | Agent/model performance analytics | Answer "Are our AI tools improving delivery without risk?" | Dashboard tracks tokens saved, PR success rate, rework rate, violations prevented | **Implemented.** `dim analytics` aggregates events, verify outcomes, proposal throughput, token usage, and agent activity into a performance dashboard. Tracks tokens saved (via `recordTokenUsage` wired into `dim recall` and `dim context`), violations prevented (verified guardrails/failed-approaches), verify pass rates over time, proposal approval rates, memory lifecycle (created/forgotten/refuted), and per-machine agent activity. Supports `--days`, `--since`, `--until`, and `--json` output. 10 tests passing. |

---

## Feasibility & Dependencies Assessment

### What is already built (the strongest foundation)

- **Core memory model:** Memory kinds, statuses, confidence decay, evidence types, and guardrail levels are already in `src/types.ts:5-83` and `src/mcp/server.ts:40-66`.
- **Verification engine:** `verifyAll` handles VERIFIED ↔ STALE transitions, confidence boosts/floors, and decay `src/verify/engine.ts:70-165`.
- **MCP server:** A full tool suite already exists (`memory_search`, `memory_get_for_files`, `memory_verify`, `memory_propose`, `memory_critique`, `chat_harvest`, etc.) `src/mcp/server.ts:149-400`.
- **CLI:** `dim init`, `dim verify`, `dim check`, `dim review`, `dim mine`, `dim bootstrap`, `dim harvest`, `dim generate-context`, `dim ui`, `dim cloud`, `dim serve` are already wired in `src/cli/index.ts:45-52`.
- **Pre-commit guardrails:** `dim check --block` and git hooks are implemented `src/cli/commands/verify.ts:82-123`.
- **Cross-agent context generation:** `dim generate-context` already emits Claude, Cursor, Windsurf, Copilot, and AGENTS.md formats `src/cli/commands/hosts.ts:68-98`.
- **Team sync:** Self-hosted sync server and cloud linking are implemented `src/cli/commands/sync.ts:11-25`.
- **Dashboard:** `dim ui` serves a local web UI with memory graph, proposals, verify, sync, and ticket/cloud dialogs `src/ui/server.ts:69-600`.

### Hard dependencies / blockers to watch

- **Native Node modules:** `better-sqlite3` and `sqlite-vec` require a build step. `npx aidimag setup` cannot be a pure zero-dependency command unless you ship prebuilds or fall back to SQLite WASM. This is the biggest friction point for "install in 60 seconds."
- **LLM provider for capture features:** `dim bootstrap`, `dim mine --llm`, and `dim harvest` require Ollama or `OPENAI_API_KEY`. The one-command setup must gracefully degrade if no provider is configured.
- **Agent-specific hooks:** Pre-edit blocking requires integration with each agent's hook system (Claude Code hooks exist; Cursor/Copilot hooks are limited or non-public). The plan must treat pre-*commit* blocking as the reliable baseline and pre-edit blocking as best-effort per agent.
- **Token counting:** Token-budgeted retrieval needs per-model tokenizers (Claude, OpenAI, etc.). Without exact token counts, the "tokens saved" metric is marketing, not evidence.

### Risks to consider

- **Over-promising on setup:** If the homepage demo says "one command" but users hit native-module build errors, trust is lost immediately. Consider shipping a Docker/preview path or documenting the Node build prerequisites.
- **Feature breadth vs. depth:** Many items in this plan are partially started. The risk is shipping a thin version of everything instead of a deep version of the top two wedges.
- **Enterprise before product-market fit:** Phase 3 features are powerful but should not be built until Phase 1 and 2 are proven with real teams.

### Sequencing adjustments

1. **Lean into what exists.** The verification engine, guardrails, and cross-agent context generation are real differentiators today. Make them the heroes of the homepage and docs before building new categories.
2. **Failed-approach memory first.** The schema and manual capture already exist. The product work is automated extraction, similarity matching, applicability conditions, and agent warnings. This is the fastest path to a defensible "stand out" feature.
3. **Interactive demo in parallel with failed approaches.** Base the homepage walkthrough on the same end-to-end failed-approach proof so the demo validates the actual product, not generic claims. Ship a simulated/recorded walkthrough first, downloadable sample repo second.
4. **Memory PRs third.** `dim check` already produces diff-based checks; the missing piece is diff-to-memory impact mapping, baseline/head comparison, and a GitHub Action wrapper.
5. **Token compiler fourth.** It is high-impact but depends on retrieval ranking. Start with character budgets and approximate token estimates; exact cross-model tokenizers can come later.

### Failed-approach structured model

A failed approach should carry applicability conditions so it does not block a solution after the underlying cause is fixed:

```yaml
kind: FAILED_APPROACH
claim: Automatic retries for declined payments caused duplicate entries
scope:
  paths: [src/payments/**]
  symbols: [PaymentService.processRefund]
reason: Transactions did not use idempotency keys
evidence:
  - type: COMMIT_REF
    payload: abc1234
  - type: TICKET_REF
    payload: INC-228
applies_when:
  - idempotency_not_enabled
status: VERIFIED
```

This lets AIDimag warn only when the same preconditions are present. `applies_when`, richer source links (e.g. `PULL_REQUEST`, `INCIDENT`), and symbol-level scope are schema extensions beyond the current `MemoryEntry` model.

---

## Standing Out: Key Differentiators vs. Native Memory

| Native Agent Memory | AIDimag |
|---------------------|---------|
| Primarily contained within one vendor ecosystem | Cross-agent canonical knowledge |
| Primarily recalls vendor-managed facts | Verifies facts continuously with executable evidence |
| Citations to code | Executable evidence + citations |
| Enforcement is vendor-specific and fragmented | Active enforcement and pre-edit guardrails (best-effort per agent hook surface) |
| Failed approaches are not consistently structured or portable | Preserves failed approaches as first-class, condition-aware knowledge |
| Tool-specific | Open source, local-first, auditable |
| No cross-agent governance layer | Change-risk scoring, protected boundaries, audit trails |

---

## Homepage and Messaging Fixes

1. **Primary CTA:** "Try it in a sample repo" (interactive demo).
2. **Secondary CTA:** "Install locally" (one command).
3. **Tertiary link:** "View on GitHub".
4. **Outcome copy:** replace repeated "claim-and-verify" with measurable results:
   - Fewer repeated repo scans
   - Fewer incorrect architectural assumptions
   - Faster onboarding
   - Reduced agent-token usage
   - Fewer repeated failed fixes
   - Less maintenance of instruction files
5. **Targeted paths:**
   - **Solo:** stop re-explaining your repo
   - **Team:** share verified engineering knowledge
   - **Enterprise:** enforce conventions and audit agent behavior
6. **Naming consistency:** use **AI Dimag** for the brand, **aidimag** for the package/CLI everywhere.

---

## Benchmarks and Proof

Upgrade benchmarks from marketing claims to defensible evidence.

- Expand staleness benchmark to 100–500 mutation scenarios across multiple real repositories and languages.
- Compare against: no memory, static AGENTS.md, full AIDimag briefing, and token-budgeted context compiler.
- Track and publish:
  - Input tokens per completed task
  - Files read by the agent
  - Tool calls
  - Time to first correct edit
  - Task success rate
  - Rule violations prevented
  - Context precision / recall
- Add a public sample repo with realistic verified memories.
- Publish one real case study with before/after agent session transcript.

Target headline: **"AIDimag reduced context and repo-exploration tokens by 65% while preserving accuracy and catching more repo-specific violations."**

---

## Flagship Feature: Verified Context Compiler

Package the token-efficiency work into one headline capability.

```bash
dim compile-context \
  --task "Add refund retry handling" \
  --diff \
  --budget 1200 \
  --format claude
```

Output:
- Smallest verified context bundle for the task
- Token count and what was included/excluded
- Estimated full-repo tokens avoided
- Applicable guardrails, decisions, and failed approaches

This is the concrete answer to "Why not just use the agent's native memory?"

---

## Metrics for Success

### Adoption & engagement

| Category | Metric | Target (6 months) |
|----------|--------|-------------------|
| Adoption | Time from landing to first verified memory | < 2 minutes |
| Adoption | Setup completion rate from homepage demo | > 40% |
| Engagement | Repositories with active memory checks | 100+ public, 20+ teams |
| Trust | Staleness benchmark scenarios | > 500 |
| Enterprise | Teams using Memory PRs | 10+ |

### Warning and enforcement funnel

Replace the broad "rule violations prevented per week" metric with a measurable funnel:

| Metric | Meaning | Initial target |
|--------|---------|----------------|
| Applicable warning generated | A rule or failed approach matched the attempted action | Baseline |
| Agent changed course | The attempted action changed after the warning | > 50% |
| Human confirmed relevance | The warning was useful rather than noise | Precision > 70% |
| Violation blocked | Enforcement stopped a violating action | Baseline |
| Human override rate | Humans considered the block inappropriate | < 15% |
| False-warning rate | The warning did not actually apply | < 15% |

### Failed-approach feature targets

- At least five verified examples of a repeated mistake being avoided.
- Warning delivery fast enough not to disrupt the agent (< 500 ms end-to-end).
- No sensitive code or incident data exposed through synced memories.

### Verified Context Compiler targets

> Reduce input and repository-exploration tokens by at least 40%, keep task success within three percentage points of the full-context baseline, and do not increase repository-rule violations.

| Category | Metric | Target (6 months) |
|----------|--------|-------------------|
| Value | Average tokens saved per agent task | > 40% |
| Value | Files read by the agent | Reduced vs. full-context baseline |
| Value | Context precision | > 70% of retrieved memories used |
| Value | Context recall | Required memories included > 95% |

---

## Next Steps (This Week)

Assessment based on commit `b8f63781e6670c8d779a073f922f776406e5984d`.

### Product work

1. **~~Confirm manual `FAILED_APPROACH` creation works end-to-end.~~** `dim remember --kind FAILED_APPROACH` works via the generic CLI, including `--applies-when`.
2. **~~Define the failed-approach schema extension.~~** `applies_when` added to `MemoryEntry`, proposals, DB schema, CLI, and MCP; similarity matching implemented in `dim check`.
3. **~~Build one end-to-end proof using a real reverted commit.~~** `dim mine` detects reverts, proposes `FAILED_APPROACH`, and `dim check` warns when the approach is re-attempted; covered by an integration test.
4. **~~Package existing checks into a minimal GitHub Action.~~** Start with `dim check --block` on pull requests and a summary comment. *Done: reusable action at `.github/actions/aidimag-check/action.yml`, repo workflow at `.github/workflows/aidimag-check.yml`, documented in `docs/guides/dim-check.md`.*
5. **~~Design `npx aidimag setup` safely.~~** `dim setup`, `dim doctor`, and `dim uninstall-integrations` are implemented with dry-run, backups, merge-without-overwrite, and MCP config wiring for Claude Code / Cursor.
6. **~~Memory PRs / knowledge impact checks.~~** `dim impact` reports which verified memories are affected by a PR diff; the reusable GitHub Action posts the impact report alongside `dim check` results as a sticky PR comment.
7. **~~Token compiler for retrieval.~~** `dim recall` supports `--max-tokens`/`--budget` and `dim context` builds a task-scoped, budgeted prompt block with `minimal`/`standard`/`deep` presets.

### Next code feature

8. **~~Diff-aware context (`dim context --diff`).~~** `dim context --diff` scopes context to files changed in the working tree (or `--staged`) and applies the token budget only to relevant memories.
9. **~~Cross-agent instruction sync / drift detection.~~** `dim generate-context --check` compares generated context files against the memory store, reports missing/stale rules per agent, and exits 2 on drift.
10. **~~Team knowledge health dashboard.~~** `dim health` prints status/kind counts, pinned/proposal counts, per-path risk scores, oldest stale memories, and actionable suggestions. JSON output available with `--format json`.
11. **~~Incident / CI capture adapter.~~** `dim capture incident <file>` reads a JSON or markdown incident report and proposes a `FAILED_APPROACH` memory with provenance evidence (commit ref, ticket ref, failed command, CI URL) and applicability conditions. Optional `--llm` flag synthesizes a richer claim.
12. **~~Protected code boundaries.~~** `.aidimag/critical-areas.yml` (or `.json`) defines critical areas with paths, owners, required tests, approval tokens, and block/warn mode. `dim check` enforces: changes to critical paths without the approval token in the commit message are flagged (exit 1 with `--block`). The reusable GitHub Action supports `require-owner-approval` (fetches PR reviews and fails if no listed owner has approved) and `run-required-tests` (runs tests listed in critical-areas config and fails if any fail).
13. **~~AI change-risk score.~~** `dim check` computes a 0–100 risk score from violation severity, memory kind/status/confidence, evidence count, critical-area membership, and change breadth. Rendered as a progress bar with per-factor breakdown (low/medium/high/critical). `dim check --json` outputs a structured report for CI integration. `dim check --risk-threshold <n>` exits 1 when the score exceeds the threshold. The reusable GitHub Action accepts a `risk-threshold` input and posts a structured PR comment with a risk score table, risk factor breakdown, violation details, and critical area enforcement status.
14. **~~Audit trail and compliance export.~~** `dim audit export` produces a tamper-evident, SHA-256 chained event log (JSON/CSV/summary). `dim audit verify` confirms integrity. `dim audit findings` surfaces memories on the least ground. `dim audit sign <evidence-id>` cryptographically signs evidence rows with Ed25519 keys. Immutable history enforced via SQLite triggers preventing UPDATE/DELETE on event data. Schema v13.
15. **RBAC, SSO, and retention policies.** Add user-level permissions to the sync server (currently shared tokens only). Integrate SSO (OIDC/SAML). Add retention policies (auto-forget memories older than N days with no evidence).

### Marketing work (in parallel)

16. **Create the homepage walkthrough from the same failed-approach proof.** Use simulated/recorded real output; clearly label it as an interactive walkthrough. Provide a downloadable sample repo for the actual CLI experience.
17. **Draft the updated comparison page.** Acknowledge GitHub Copilot Memory directly; contrast AIDimag on portability, executable evidence, cross-agent governance, and open source.
18. **Replace absolute source paths in this plan with repo-relative references and record the reviewed commit.** Done above; keep this discipline going forward.
19. **Interview five active coding-agent users using the demo.** Validate that the failed-approach story resonates before expanding the roadmap.

---

## Single-Sentence Pitch

**AIDimag is the independent trust and governance layer for coding agents. It preserves verified engineering knowledge, delivers only the context an agent needs, and prevents every agent your team uses from repeating known mistakes or violating shared rules.**
