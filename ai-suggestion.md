# AIDimag Action Plan Review

## Overall Assessment

This version is much stronger because it distinguishes what is already implemented, partially implemented, and genuinely missing. It reads like a plan grounded in the codebase rather than a speculative feature list.

**Overall rating: 8.5/10**

The plan has a strong strategic direction, but a few technical claims, sequencing choices, competitive comparisons, and success metrics should be refined before treating it as final.

## What Is Working Well

- Existing capabilities are acknowledged instead of being proposed again.
- Cross-machine sync is correctly marked as implemented.
- The native-module installation risk is identified.
- Pre-commit enforcement is separated from agent-specific pre-edit enforcement.
- Token-counting dependencies are acknowledged.
- Phase 3 is correctly treated as conditional on product-market validation.
- The sequencing prioritizes extensions of existing capabilities.
- The roadmap shows how much work each feature actually requires.
- The strategy correctly positions AIDimag around trust rather than simple persistence.

## Important Corrections

### 1. `FAILED_APPROACH` May Not Need Dedicated CLI Commands

If the generic command already accepts every valid memory kind, manual creation may already work:

```bash
dim remember "Automatic retries caused duplicate ledger entries" \
  --kind FAILED_APPROACH
```

If so, adding dedicated CLI commands is not the main missing feature.

The missing product functionality is:

- Extract failed approaches from reverted commits.
- Connect them to pull requests, incidents, and CI failures.
- Retrieve them when a similar change is attempted.
- Warn the agent before it repeats the approach.
- Allow conditions under which the approach might become valid.

The current-state description should say:

> **Schema and manual capture implemented.** Missing automated extraction, similarity matching, contextual warnings, and lifecycle handling.

A convenience command such as `dim lesson` may improve usability, but it is not the core product value.

### 2. Make Failed Approaches More Nuanced

A failed approach is not always permanently wrong. It may have failed because of a particular dependency, version, architecture, or environmental condition.

Use a structured model such as:

```yaml
kind: FAILED_APPROACH
claim: Automatic retries for declined payments caused duplicate entries
scope:
  - src/payments/**
reason: Transactions did not use idempotency keys
evidence:
  - pull_request: 417
  - incident: INC-228
applies_when:
  - idempotency_not_enabled
status: VERIFIED
```

Without applicability conditions, AIDimag could block a previously failed solution even after the underlying problem has been resolved.

### 3. Clarify the Memory PR Technical Claim

The plan states that `dim check` and the verification engine can detect stale memories from a diff. That may overstate the current behavior.

Evaluating guardrails or rerunning verification evidence is different from identifying exactly which memories a pull request affects.

A more precise current-state description is:

> The verification and guardrail engines provide most of the underlying checks. Missing: diff-to-memory impact mapping, GitHub Action packaging, baseline/head comparison, and PR reporting.

### 4. Do Not Automatically Overwrite Agent Configurations

The setup process must be safe and idempotent. Its definition of done should include:

- Detect existing configurations.
- Show proposed changes.
- Merge without removing unrelated settings.
- Create a backup.
- Avoid duplicate MCP entries.
- Support a dry-run mode.
- Verify that the integration works.
- Provide an uninstall or rollback command.

Recommended commands:

```bash
npx aidimag setup --dry-run
npx aidimag setup
npx aidimag doctor
npx aidimag uninstall-integrations
```

A setup command that damages customized agent configurations would undermine the product's trust positioning.

### 5. Narrow Initial Agent Support

Full support for Claude Code, Cursor, Copilot, and Codex within the first two-month phase may still be too broad.

Define two integration levels:

- **Full integration:** MCP, hooks, context, and enforcement for one or two agents.
- **Context-file support:** Generated instruction files for additional agents.

For example:

```text
Claude Code: MCP + hooks + context + enforcement
Codex: MCP + AGENTS.md
Cursor: MCP + generated rules
Copilot: generated instructions
```

The product should not imply that pre-edit enforcement works equally across all supported agents.

### 6. Clarify the Interactive Demo Implementation

A static VitePress page plus a mutation script may not be enough for a truly interactive browser demo. A website visitor cannot safely mutate a local sample repository from a static documentation page.

Possible implementations include:

- A simulated interactive animation based on actual AIDimag output.
- An isolated backend demo environment.
- A WebContainer-based sample repository.
- A terminal recording with selectable stages.
- A downloadable sample repository for the real CLI experience.

For the first release, a polished interactive walkthrough based on real output is likely the fastest and safest option. If simulated, it should be labeled as an interactive walkthrough.

### 7. Token Counting Does Not Have to Block the First Compiler

Exact token claims require model-specific tokenizers, but an initial context compiler can still use:

- Character or byte budgets.
- Approximate token estimates.
- One initially supported tokenizer.
- Pluggable tokenizer adapters.
- A conservative fallback ratio.

For example:

```bash
dim compile-context --max-chars 5000
dim compile-context --max-tokens 1200 --model openai
```

The first release can label counts as estimates. Exact cross-model reporting can be added later. Initial success should emphasize retrieval precision and task accuracy.

### 8. Replace Personal Absolute Paths

The current-state evidence includes personal workstation paths such as:

```text
@/Users/anup.khanal/Desktop/Personal/PersonalProjects/aidimag/src/types.ts
```

These references are not portable and reveal one developer's workstation structure.

Use repository-relative references:

```text
src/types.ts:5-83
src/mcp/server.ts:40-66
src/verify/engine.ts:70-165
```

Also record the code snapshot used for the assessment:

```text
Code assessment based on commit: abc1234
Reviewed: August 16, 2026
```

Otherwise, the current-state assessment will become stale as the code changes.

### 9. Refine the Competitive Comparison

Some statements remain too absolute because native products now include forms of verification, rules, and enforcement.

| Existing wording | More defensible wording |
|---|---|
| Stores facts | Primarily recalls vendor-managed facts |
| Passive recall | Enforcement is vendor-specific and fragmented |
| Forgettable | Failed approaches are not consistently structured or portable |
| No governance | No cross-agent governance layer |
| Siloed per tool | Primarily contained within one vendor ecosystem |

GitHub validates cited repository memories, and Claude can enforce behavior through hooks. AIDimag's differentiation is centralized, cross-agent, portable, and auditable governance, not exclusive ownership of verification or enforcement.

## Recommended Sequencing

The current plan proposes:

1. Failed approaches
2. Interactive demo
3. Memory PRs
4. Token compiler

A slightly stronger structure separates product work from marketing work.

### Product Work

1. Failed-approach similarity and warnings
2. Memory PR foundation
3. Verified Context Compiler
4. Safe one-command setup

### Marketing Work in Parallel

1. Interactive homepage walkthrough
2. Updated comparison page
3. Public sample repository
4. Real usage case study

The homepage demonstration should not wait for major product development because the existing verification capability can already support a compelling demonstration.

## Best Initial End-to-End Experience

The strongest MVP is not merely adding a memory type. It is completing this full loop:

1. A previous change failed.
2. AIDimag captures the lesson and its evidence.
3. A human reviews and approves it.
4. An agent later attempts a similar change.
5. AIDimag retrieves the relevant lesson.
6. The agent is warned or blocked.
7. The avoided mistake is recorded.

This complete experience is what makes the feature defensible and valuable.

## Metric Improvements

Replace the broad metric "rule violations prevented per week" with a measurable warning and enforcement funnel.

| Metric | Meaning |
|---|---|
| Applicable warning generated | A rule or failed approach matched the attempted action |
| Agent changed course | The attempted action changed after the warning |
| Human confirmed relevance | The warning was useful rather than noise |
| Violation blocked | Enforcement stopped a violating action |
| Override rate | Humans considered the block inappropriate |
| False-warning rate | The warning did not actually apply |

For the failed-approach feature, the most important initial targets are:

- Warning precision above 70%.
- Human override rate below 15%.
- At least five verified examples of a repeated mistake being avoided.
- Warning delivery fast enough not to disrupt the agent.
- No sensitive code or incident data exposed through synced memories.

For the Verified Context Compiler, use a combined efficiency and quality target:

> Reduce input and repository-exploration tokens by at least 40%, keep task success within three percentage points of the full-context baseline, and do not increase repository-rule violations.

## Revised First-Week Priorities

1. Confirm whether manual `FAILED_APPROACH` creation already works through the generic CLI.
2. Define the failed-approach schema, matching behavior, and applicability conditions.
3. Build one end-to-end proof using a real reverted commit.
4. Create the homepage walkthrough from the same proof.
5. Package existing checks into a minimal GitHub Action.
6. Replace absolute source paths with repository-relative references and record the reviewed commit.
7. Interview five active coding-agent users using the demo.

## Refined Strategic Position

The product should be positioned as more than persistent memory:

> **AIDimag is the independent trust and governance layer for coding agents. It preserves verified engineering knowledge, delivers only the context an agent needs, and prevents every agent your team uses from repeating known mistakes or violating shared rules.**

## Final Verdict

The plan is now credible and grounded in a strong existing technical foundation. AIDimag already has much of the difficult infrastructure:

- Verification
- Executable evidence
- Guardrails
- MCP integration
- Cross-agent context generation
- Team synchronization
- A local dashboard

The fastest path is not to build additional foundations. It is to connect the existing components into one unmistakably valuable experience:

> **A real mistake happened, AIDimag preserved why it happened, another agent nearly repeated it, and AIDimag stopped it using verified evidence.**

If that experience works reliably, the Verified Context Compiler, Memory PRs, team workflows, and enterprise governance become natural expansions rather than disconnected features.

