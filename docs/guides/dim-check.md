# Pre-commit checks

`dim check` moves verification **earlier** — instead of noticing a problem after code lands,
it scans your **staged changes** against active memory and guardrails *before* the commit.

## Run it manually

```sh
dim check
```

It looks at `git diff --cached` and, for the files you changed:

- **re-runs `STATIC_CHECK` evidence** — a now-failing check means your change contradicts a
  claim;
- **matches `never` guardrails** against the added lines — flags a change that does what a
  guardrail forbids;
- **reminds you about in-scope invariants/conventions** that don't have an automated check.

Example output:

```
✗ [GUARDRAIL] 🚫 NEVER guardrail: the staged change appears to do exactly what this forbids
    "Never call the production payments API from src; use the sandbox client..."
~ [CONVENTION] CONVENTION covers a file you changed — make sure it still holds (no automated check attached)
    "Handlers never touch the DB directly"
```

`✗` is a hard violation; `~` is an advisory reminder.

`dim check` also displays a **risk score** (0–100) that aggregates violation severity,
memory kind/status/confidence, evidence count, critical-area membership, and change breadth
into a single signal:

```
Risk Score: 48/100 [MEDIUM]
  ██████████░░░░░░░░░░
  Factors:
    +48 GUARDRAIL violation (fail) — NEVER guardrail: the staged change appears to do exactly what this forbids
```

Levels: **low** (<30), **medium** (30–59), **high** (60–79), **critical** (80+).

## Critical areas

Protect sensitive paths (auth, payments, PII, migrations) by defining critical areas in
`.aidimag/critical-areas.yml`:

```yaml
areas:
  - label: Authentication
    paths: [src/auth]
    owners: [alice@example.com]
    block: true
    approvalToken: "[AUTH-OK]"
    requiredTests:
      - npm test -- auth
```

When a change touches a critical area, `dim check` flags it as a `[CRITICAL]` violation
unless the commit message contains the approval token (e.g. `[AUTH-OK]`). Areas with
`block: true` cause `dim check --block` to exit 1.

```sh
git commit -m "refactor auth middleware [AUTH-OK]"   # passes
git commit -m "refactor auth middleware"              # blocked
```

## Warn vs block

By default `dim check` only **warns** (exit 0). To make hard violations fail:

```sh
dim check --block      # exit 1 on a hard violation
```

Check against a ref instead of the staged index:

```sh
dim check -r HEAD~1
```

## Turn it into a pre-commit hook

aiDimag installs a `pre-commit` hook (additively) that runs `dim check --pre-commit`. It's a
**no-op until you opt in** via the `preCommitCheck` setting in `.aidimag/config.json`:

| `preCommitCheck` | Behavior on commit |
|---|---|
| unset / `false` | Hook does nothing |
| `"warn"` / `true` | Prints violations, allows the commit |
| `"block"` | Prints violations and **blocks** the commit on a hard violation |

Set it:

```json
{ "preCommitCheck": "block" }
```

Now a commit that trips a `never` guardrail is stopped:

```
✗ [GUARDRAIL] 🚫 NEVER guardrail: the staged change appears to do exactly what this forbids
dim check: 1 blocking violation(s). Resolve them or commit with --no-verify.
```

You can always bypass in a pinch with `git commit --no-verify`.

## Run it on pull requests

Use the reusable `aidimag-check` action to run `dim check --json --block` in CI and post a
structured summary comment on every pull request with a risk score table, violation details,
and critical area enforcement:

```yaml
name: AIDimag Check
on:
  pull_request:
    branches: [main]
permissions:
  contents: read
  pull-requests: write
  checks: write
jobs:
  aidimag-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: AiDimag/aidimag/.github/actions/aidimag-check@main
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          risk-threshold: 60        # fail if risk score > 60
          require-owner-approval: 'true'   # require listed owners to approve PRs touching critical areas
          run-required-tests: 'true'       # run tests listed in critical-areas config
```

### Action inputs

| Input | Default | Description |
|---|---|---|
| `token` | `github.token` | Token for posting PR comments |
| `base-ref` | `github.base_ref` | Base ref to diff against |
| `risk-threshold` | (none) | Fail if risk score exceeds this (0–100) |
| `require-owner-approval` | `false` | Require listed owners to approve PRs touching critical areas |
| `run-required-tests` | `false` | Run tests listed in critical-areas config and fail if any fail |
| `version` | `latest` | aiDimag npm version to install |

The action diffs against the pull-request base ref, exits with an error on a blocking
violation, and updates one sticky PR comment with the results. The comment includes:

- A **risk score table** with color-coded badge (🟢 <30, 🟡 30–59, 🟠 60–79, 🔴 80+)
- **Risk factors** breakdown showing each contribution
- **Memory violations** (fail and warn) with claim text
- **Critical area violations** with owners and required tests
- **Owner approval status** (missing approvers are flagged)
- **Required test results** (failed tests are flagged)
- A **knowledge-impact report** from `dim impact`, listing verified memories whose scope
  overlaps the changed files

For CI, commit `.aidimag` to the repo (memories are usually safe to share) or run `dim cloud link`
and `dim sync` so the runner pulls the team memory store before checking.

## How it compares to `dim verify`

| | `dim verify` | `dim check` |
|---|---|---|
| When | After code lands (and on hooks) | Before a commit, on staged changes |
| Scope | Whole store | Only memories touching changed files |
| Effect | Updates statuses | Reports/blocks; doesn't change statuses |

Think of `dim check` as the **shift-left** companion to `dim verify`: catch the contradiction
at author time, not after.

Next: **[Session briefings](/guides/session-briefing)**.

