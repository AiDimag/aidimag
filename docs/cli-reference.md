---
title: CLI Reference | Complete dim Command Guide
description: Complete reference for all dim CLI commands. Learn how to use dim init, remember, recall, verify, review, and all other aiDimag commands with examples.
head:
  - - meta
    - name: keywords
      content: dim CLI, aiDimag commands, dim reference, CLI documentation, dim init, dim remember, dim recall, dim verify, command line interface
  - - meta
    - property: og:title
      content: CLI Reference - Complete dim Command Guide
  - - meta
    - property: og:url
      content: https://aidimag.com/cli-reference
  - - link
    - rel: canonical
      href: https://aidimag.com/cli-reference
---

# CLI reference

Every `dim` command, with plain-English descriptions and examples. The `dim` and `aidimag`
commands are identical; this page uses `dim`.

Run `dim --help` or `dim <command> --help` any time for the built-in version.

[[toc]]

## Memory basics

### `dim init`

Initialize aiDimag in the current repo: creates `.aidimag/`, gitignores the database,
creates the `knowledge/` inbox, installs git hooks, and prints an MCP config snippet.

```sh
dim init
```

### `dim setup`

One-command safe installation. Initializes the repo, installs git hooks, detects and
configures MCP for agents (Claude Code, Cursor, Windsurf, OpenAI Codex, GitHub Copilot),
backs up any existing configs, and optionally generates context files. It is idempotent
and always backs up before modifying a file.

| Option | Meaning |
|---|---|
| `--dry-run` | Show what would be changed without touching files |
| `--yes` | Accept all detected integrations without prompting |
| `--agent <agents>` | Comma-separated list: `claude-code`, `cursor`, `windsurf`, `codex`, `copilot` |
| `--context-files [format]` | Generate static context files (`all`, `claude`, `cursorrules`, …) |
| `--bootstrap` | Run `dim bootstrap` after setup |
| `--force` | Overwrite existing aidimag MCP config (still backs up first) |

```sh
dim setup                          # interactive setup
npx aidimag setup --yes            # one-command install in a new repo
dim setup --dry-run --agent cursor # preview Cursor MCP config changes
dim setup --agent claude-code,cursor,windsurf,codex,copilot  # wire all five agents
```

### `dim doctor`

Health-check the installation: Node version, native SQLite modules, git repo,
initialized memory store, git hooks, agent MCP configs, LLM provider, and embedding
provider status. Exits `1` if required checks fail.

```sh
dim doctor
```

### `dim setup-ollama`

Install [Ollama](https://ollama.com) and pull free, local models for semantic search and
LLM-powered features. Automates the full flow: install Ollama → start server → pull
embedding + LLM models → verify.

If Ollama is already installed, detects pulled models and offers to reuse them.

| Option | Meaning |
|---|---|
| `--model <model>` | Skip the interactive prompt and pull a specific embedding model |

**Embedding models** (for semantic search):

| Model | Size | Dimensions | Notes |
|---|---|---|---|
| `all-minilm` | ~45MB | 384 | Lightest, fast, good for small repos |
| `nomic-embed-text` | ~274MB | 768 | **Recommended** — best balance |
| `mxbai-embed-large` | ~670MB | 1024 | Higher quality, larger repos |
| `snowflake-arctic-embed` | ~1.2GB | 1024 | Top-tier, demanding semantic search |

**LLM models** (for mining, harvest, bootstrap, knowledge sync):

| Model | Size | Notes |
|---|---|---|
| `llama3.2` | ~2.0GB | **Recommended** — fast, good balance |
| `llama3.1` | ~4.9GB | Capable, larger. Good for complex repos |
| `qwen2.5` | ~4.7GB | Strong code understanding |
| `phi3` | ~2.2GB | Compact, efficient for simple tasks |

```sh
dim setup-ollama                    # interactive — pick models
dim setup-ollama --model nomic-embed-text  # non-interactive
```

You can also run setup from the dashboard (`dim ui`) — click **Setup Ollama** or the
LLM/Embeddings status card for a step-by-step guided flow that pulls both models.

After setup, run `dim reindex` to build embeddings for existing memories.

Selected models are saved to `.aidimag/config.json` under the `ollama` key:

```json
{
  "ollama": {
    "embeddingModel": "nomic-embed-text",
    "llmModel": "llama3.2"
  }
}
```

You can change models later via the dashboard's **Model Settings** dialog (click the
LLM or Embeddings status card) or by editing `config.json` directly.

### `dim uninstall-integrations`

Remove aidimag git hooks and agent MCP configs. Preserves backups with an
`.aidimag-backup-<timestamp>` suffix. Leaves any custom logic you added to hooks.

| Option | Meaning |
|---|---|
| `--dry-run` | Show what would be removed |
| `--agent <agents>` | Only uninstall specific agents |
| `--context-files` | Also remove generated context files |

```sh
dim uninstall-integrations
dim uninstall-integrations --dry-run
```

### `dim bootstrap`

Give a fresh repo an **instant starter brain**. Surveys the repo — README, docs, ADRs,
manifests (`package.json`, `Dockerfile`, CI workflows…), any existing `CLAUDE.md` /
`.cursorrules`, the directory shape, and the most-churned files in git history — and
LLM-extracts an initial set of falsifiable claims, each with a suggested `STATIC_CHECK`
where an honest one exists. Everything is queued for `dim review`; nothing becomes
active memory without you.

| Option | Meaning |
|---|---|
| `--force` | Re-run even if this repo was already bootstrapped (dedupe absorbs repeats) |

```sh
dim bootstrap        # right after dim init
dim review           # approve your starter brain
dim verify           # put the suggested checks to the test
```

Requires an LLM provider (local Ollama or `OPENAI_API_KEY`; see `AIDIMAG_LLM`).
If no provider is detected, you'll be prompted to run `dim setup-ollama` automatically.

### `dim remember <claim>`

Store a memory directly (you are the author, so it's saved without review).

| Option | Meaning |
|---|---|
| `-k, --kind <kind>` | Kind (default `GOTCHA`). One of decision/convention/gotcha/failed_approach/architecture/invariant/todo_context/guardrail/skill |
| `-p, --path <paths...>` | File paths the memory applies to |
| `-s, --symbol <symbols...>` | Symbols (functions/classes) it applies to |
| `-e, --evidence <spec...>` | Evidence as `TYPE:payload` (repeatable) |
| `-g, --guardrail-level <level>` | For `GUARDRAIL`: `never` / `ask-first` / `always` |
| `-a, --applies-when <conditions...>` | For `FAILED_APPROACH`: conditions under which the failure applies (e.g. a feature flag or dependency version) |
| `--pin` | Pin it: exempt from time decay (evidence can still mark it stale) |

```sh
# A convention with a self-checking command
dim remember "Routes live in src/routes and are registered in src/app.ts" \
  -k CONVENTION -p src/routes -e "STATIC_CHECK:test -d src/routes"

# A guardrail
dim remember "Never log raw access tokens" -k GUARDRAIL -g never

# A pinned architectural decision
dim remember "We use last-writer-wins, not CRDTs, for sync" -k DECISION --pin

# A failed approach with applicability conditions
dim remember "Retrying declined payments caused duplicate ledger entries" \
  -k FAILED_APPROACH -p src/payments \
  -a idempotency_not_enabled pre_feature_flag_v2 \
  -e COMMIT_REF:abc1234
```

### `dim recall [query...]`

Search memories — hybrid keyword + semantic (when embeddings are configured).

| Option | Meaning |
|---|---|
| `-p, --path <paths...>` | Restrict to memories scoped to these paths |
| `-k, --kind <kind>` | Filter by kind |
| `-n, --limit <n>` | Max results (default 10) |
| `--all` | Include refuted memories |
| `--max-tokens <n>` | Only show results that fit inside a token budget |
| `--budget <n>` | Alias for `--max-tokens` |

```sh
dim recall token refresh
dim recall -p src/payments
dim recall -k GUARDRAIL
dim recall logging --max-tokens 400
```

### `dim context`

Build a prompt-ready context block for a specific task, ranked so GUARDRAIL/INVARIANT
rules appear first. The output is capped at a token budget; memories that do not fit
are reported as dropped.

| Option | Meaning |
|---|---|
| `-t, --task <task>` | Description of the coding task (required unless --diff) |
| `--diff` | Scope context to files changed in the working tree |
| `--staged` | With `--diff`, only consider staged changes |
| `-p, --path <paths...>` | Restrict to memories scoped to these paths |
| `-b, --budget <n>` | Token budget (default 1200) |
| `--preset <name>` | Use a preset: `minimal` (400), `standard` (1200), `deep` (4000) |
| `-f, --format <fmt>` | `markdown` (default) or `json` |

```sh
dim context --task "add retry logic to payments"
dim context --task "refactor auth" --preset deep --format json
dim context --diff --budget 800      # context for whatever is currently changed
dim context --diff --staged          # context for staged changes only
```

### `dim status`

Summary of the store: totals by status and kind, pinned count, and pending proposals.

```sh
dim status
```

### `dim log`

Show recent memories.

```sh
dim log -n 20
```

### `dim gaps`

Show **knowledge gaps**: recent searches (from AI agents via MCP, or you via `dim recall`)
that returned *nothing*. Each one is a question your repo's brain couldn't answer — fill
the important ones with `dim remember`.

| Option | Meaning |
|---|---|
| `-d, --days <n>` | Look-back window in days (default 30) |
| `-n, --limit <n>` | Max entries (default 20) |
| `--clear` | Clear the search log after showing |

```sh
dim gaps
dim gaps -d 7 --clear
```

The top gaps also appear in the [session briefing](/guides/session-briefing), so agents
proactively ask you about them.

### `dim scratch [note...]`

Short-term **scratchpad** for the current work session: in-flight task state, hypotheses,
"resume here tomorrow" notes. Notes expire automatically (default 24h), are **never
synced**, and never become durable memory — promote anything worth keeping with
`dim remember`. Agents get the same scratchpad via the `scratchpad_*` [MCP tools](/mcp).

| Option | Meaning |
|---|---|
| `--session <id>` | Session/topic key to group notes under (default `default`) |
| `--ttl <hours>` | Hours until the note expires (default 24) |
| `--clear` | Clear notes (this `--session`, or everything with `--all`) |
| `--all` | List/clear notes across every session key |

```sh
dim scratch "auth refactor: JWT rotation half-done, resume at src/auth/rotate.ts"
dim scratch --session payments "hypothesis: race in the retry queue"
dim scratch                 # list current notes
dim scratch --clear --all   # wipe the scratchpad
```

### `dim audit <subcommand>`

Audit trail, compliance export, and provenance audit.

#### `dim audit findings`

**Provenance audit**: list memories resting on the weakest ground — agent-authored,
evidence-free, stale, or long-unverified — highest risk first, with the reasons. Run it
periodically (like a dependency audit, but for your repo's knowledge) and fix up findings:
add evidence (`dim update <id> -e TYPE:proof`), re-check (`dim verify`), or drop
(`dim refute` / `dim forget`).

| Option | Meaning |
|---|---|
| `-n, --limit <n>` | Max entries (default 20) |

```sh
dim audit findings
dim audit findings -n 50
```

#### `dim audit export`

Export the **tamper-evident audit trail** — all memory-lifecycle events (creation, approval,
status changes, evidence runs) chained via SHA-256 hashes. Each event record includes a
`prevHash` linking it to the previous event, making any after-the-fact modification detectable.

| Option | Meaning |
|---|---|
| `-f, --format <fmt>` | `summary` (default), `json`, or `csv` |
| `-o, --output <file>` | Write to a file instead of stdout |
| `--limit <n>` | Maximum number of events to export |
| `--since <seq>` | Export only events after this sequence number |

```sh
dim audit export
dim audit export --format json --output audit.json
dim audit export --format csv --output audit.csv --since 1000
```

#### `dim audit verify <file>`

Verify the integrity of a previously exported audit trail file. Recomputes the SHA-256 chain
and reports whether tampering is detected.

```sh
dim audit verify audit.json
```

#### `dim audit sign <evidence-id>`

Cryptographically sign an evidence row with an Ed25519 private key. The signature is stored
alongside the evidence and recorded as an `evidence_signed` event in the audit trail. This
provides non-repudiable provenance for human-attested evidence.

| Option | Meaning |
|---|---|
| `-k, --key <file>` | Path to a PEM private key file (Ed25519) |
| `-b, --key-bytes <hex>` | Ed25519 private key as hex string (32 bytes) |
| `--signed-by <name>` | Signer identity (e.g. email or key fingerprint) |

```sh
dim audit sign abc12345 --key ~/.ssh/ed25519.pem --signed-by alice@example.com
```

### `dim refute <id>`

Mark a memory **refuted** (false). Unlike `forget`, it's kept as negative knowledge.

```sh
dim refute 4f3a9c21
dim refute 4f3a9c21 -s 9b2e10aa   # superseded by a newer memory
```

### `dim forget <id>`

Delete a memory permanently. Prefer `refute` so the "we no longer believe this" history is
kept.

```sh
dim forget 4f3a9c21
```

### `dim pin <id>` / `dim unpin <id>`

Pin (exempt from time decay) or unpin a memory. See [Pinned memories](/guides/pinned).

```sh
dim pin 4f3a9c21
dim unpin 4f3a9c21
```

## Verification & search index

### `dim impact`

Report which verified memories are affected by a PR/branch diff. This is read-only:
it does not flip memory statuses or mutate the store; it is designed to be run in CI
as a knowledge-impact summary.

| Option | Meaning |
|---|---|
| `-b, --base <ref>` | Base ref to compare against (default: `main`) |
| `-h, --head <ref>` | Head ref (default: `HEAD`) |
| `--json` | Output raw JSON instead of markdown |

```sh
dim impact                       # compare HEAD to main
npx aidimag impact -b develop    # compare HEAD to develop
```

### `dim verify`

Re-run evidence and update statuses.

| Option | Meaning |
|---|---|
| `-i, --id <ids...>` | Only verify specific memory ids (prefix ok) |
| `-d, --deep` | Also run expensive evidence (tests, exec traces) |
| `--trust` | Review evidence commands that arrived via **team sync** and approve them to run on this machine |
| `-q, --quiet` | Only print changes (used by git hooks) |

Exits with code `2` if anything went stale (useful in scripts/CI).

**Evidence trust gate**: executable evidence (`STATIC_CHECK` / `TEST_RESULT` /
`EXEC_TRACE`) runs shell commands — including automatically on every `git pull` via
hooks. Commands you author locally (or approve via `dim review`) are trusted; commands
that arrive via team sync are **skipped until you inspect and approve them** with
`dim verify --trust`. A teammate's (or attacker's) memory can never become code
execution on your machine without your sign-off.

**Staleness triggers capture**: when a memory newly flips to STALE, a recovery proposal
is drafted in the review queue — decide whether the code drifted (fix + re-verify) or
the claim is outdated (update/refute).

```sh
dim verify
dim verify --deep
dim verify -i 4f3a9c21
dim verify --trust     # after a sync brought in new evidence commands
```

### `dim reindex`

Build or refresh semantic embeddings for all memories (needed after enabling/switching an
embedding provider).

```sh
dim reindex
```

## Capture & review

### `dim mine`

Mine git history for memory candidates (queued as proposals, never auto-saved). Revert commits are automatically detected and proposed as `FAILED_APPROACH` memories with the original commit as evidence and an `applies_when` condition pointing to the reverted approach.

| Option | Meaning |
|---|---|
| `--full` | Rescan the entire history instead of just new commits (with `--prs`: rescan all merged PRs) |
| `--llm` | **Deep mining**: the LLM reads each commit's message *and diff* and synthesizes falsifiable claims + suggested checks (needs Ollama/`OPENAI_API_KEY`; if missing, you'll be prompted to run `dim setup-ollama`; slower, much higher quality than the keyword heuristics) |
| `--prs` | **PR mining**: mine merged GitHub PRs — descriptions and *review comments*, where reviewers state the unwritten rules ("we never…", "this caused the outage…"). Needs the [`gh` CLI](https://cli.github.com) (authenticated) and an LLM provider (auto-prompts `dim setup-ollama` if missing). Proposals carry the merge commit as evidence (source `pr-miner`) |
| `--quiet` | Minimal output (used by the post-commit hook) |

```sh
dim mine
dim mine --full
dim mine --llm --full   # highest-quality pass over the whole history
dim mine --prs          # newly merged PRs + review threads since the last run
```

### `dim capture <type> <file>`

Capture from external sources. Supports two types:

- **`incident`** — reads a structured incident report (JSON or markdown) and proposes a
  `FAILED_APPROACH` memory with provenance evidence (commit ref, ticket ref, failed
  command, CI URL) and applicability conditions.
- **`ci-log`** — parses raw CI failure log text (from GitHub Actions, Jenkins, CircleCI,
  GitLab CI, etc.) and extracts error lines, failed commands, file paths, commit SHAs,
  and CI URLs into a `FAILED_APPROACH` proposal. Supports reading from a file (`.log` or
  `.txt`) or from stdin (`-`).

| Option | Meaning |
|---|---|
| `--llm` | Use an LLM provider to synthesize a richer claim (needs Ollama/OPENAI_API_KEY) |

JSON report fields: `title`, `description`, `files?`, `failedCommand?`, `ciUrl?`, `ticketRef?`, `commitSha?`.
Markdown reports use the first `#`-heading as the title, the body as the description, and fenced `sh`/`bash` blocks as the failed command.
CI logs are parsed with regex patterns for common error types (`Error`, `FAILED`, `TypeError`, `AssertionError`, stack traces), command prefixes (`$`, `Run`, `>`), file paths, commit SHAs, and CI URLs.

```sh
dim capture incident incident-report.json
dim capture incident postmortem.md --llm
dim capture ci-log ci-failure.log
dim capture ci-log - < ci-output.txt    # read from stdin
cat ~/Downloads/actions-log.txt | dim capture ci-log -
```

### `dim harvest`

Harvest durable facts **you typed into AI chats** into the review queue. Reads local chat
transcripts for this repo from every detected source, extracts falsifiable claims from
*your* messages with the configured LLM (OpenAI/Ollama — same auto-detection as knowledge
ingestion), and queues them as proposals (source `harvest:<tool>`) with `HUMAN_ATTESTED`
evidence. If no LLM provider is available, you'll be prompted to run `dim setup-ollama`.

| Source | Where transcripts live |
|---|---|
| Claude Code | `~/.claude/projects/<repo-slug>/*.jsonl` |
| Codex CLI | `~/.codex/sessions/**/*.jsonl` (matched by session `cwd`) |
| GitHub Copilot (VS Code) | VS Code `workspaceStorage/<hash>/chatSessions/*.json` |
| Cursor | Cursor `workspaceStorage/<hash>/state.vscdb` |

Devin is cloud-hosted with no local transcripts, so it can't be harvested offline — but any
tool connected over MCP (including Devin) can harvest the current session **live** with the
`chat_harvest` [MCP tool](/mcp), and capture single facts as stated with `context_note`.

**Privacy:** local-only and opt-in by invocation. Secret-looking lines (API keys, tokens,
passwords) are redacted *before* anything reaches the LLM. Nothing becomes active memory
without `dim review`.

| Option | Meaning |
|---|---|
| `--all` | Rescan every session (ignore the cursor; dedupe absorbs repeats) |
| `--source <names>` | Comma-separated sources to harvest: `claude-code,codex,copilot-vscode,cursor` (default: all detected) |
| `--install-hook` | Add a Claude Code `SessionEnd` hook (`.claude/settings.json`) so every session is harvested automatically when it closes |
| `-q, --quiet` | Only speak up when proposals are queued (hook mode) |

```sh
dim harvest                    # scan new sessions across all detected sources
dim harvest --all              # rescan everything
dim harvest --source codex     # only Codex CLI sessions
dim harvest --install-hook     # automate it per Claude Code session
```

Codex/Copilot/Cursor have no session-end hook, so those sources are swept whenever
`dim harvest` runs (the per-source mtime cursor keeps that cheap).

### `dim review [action] [id]`

Review the proposal queue. With no action in a terminal, it opens a conversational
walkthrough (keep / reword / drop / skip). Scriptable actions: `list`, `approve`, `reject`.

The queue is **auto-triaged**: every proposal gets a 0–1 score from local signals —
machine-checkable evidence, source trust (user-stated > curated docs > miners), concrete
scope — and is *penalized* for similarity to claims you previously rejected (what you
drop teaches the queue) or to existing memory. The walkthrough and `list` show the best
candidates first, with the score and its reasons.

| Option | Meaning |
|---|---|
| `--min-score <s>` | With `approve all`: only approve proposals triaged at or above this score |

```sh
dim review                             # interactive walkthrough, best-first
dim review list
dim review approve 1caf9d77
dim review approve all --min-score 0.7 # batch-approve the confident ones
dim review reject all
```

### `dim knowledge <sync|watch|status|list>`

Manage the [knowledge inbox](/guides/knowledgebase): summarize project docs dropped into the
`knowledge/` folder into reviewed, pinned-on-approve memory proposals. `sync` is the default.
Text formats plus **PDF and DOCX** are supported (text is extracted locally before
summarization).

| Subcommand | What it does |
|---|---|
| `sync` | Process the inbox now — summarize new docs into proposals (review with `dim review`) |
| `watch` | Foreground watcher that processes the inbox whenever a doc is dropped (`-d, --debounce <ms>`) |
| `status` | Pending / unsupported / skipped / processed counts |
| `list` | Processed docs and the memories they produced |

```sh
dim knowledge sync
dim knowledge status
dim knowledge watch
```

## Context for AI tools

### `dim generate-context`

Render trusted memory into static context files for non-MCP tools.

| Option | Meaning |
|---|---|
| `-f, --format <format>` | `claude` (default), `cursorrules`, `copilot`, `windsurfrules`, `agents`, or `all` |
| `--check` | Compare existing context file(s) to the memory store instead of writing; reports missing/stale rules and exits 2 on drift |
| `--auto` | Persist auto-regeneration: refresh after verify/review/sync |
| `--no-auto` | Disable auto-regeneration |

```sh
dim generate-context
dim generate-context -f all
dim generate-context --auto       # keep it fresh automatically
dim generate-context -f all --check
```

See [Generating context files](/guides/generate-context).

### `dim check`

Pre-commit contradiction check: scan the staged diff against active memories, guardrails, and `FAILED_APPROACH` memories. Reverted approaches that resurface in the diff trigger a warning (or a hard failure with `--block`).

| Option | Meaning |
|---|---|
| `-r, --ref <ref>` | Diff against a ref instead of the staged index (e.g. `HEAD~1`) |
| `--block` | Exit 1 on a hard violation (default: warn only) |
| `--risk-threshold <n>` | Exit 1 when risk score exceeds this threshold (0–100) |
| `--json` | Output structured JSON report (for CI/GitHub Action integration) |
| `--pre-commit` | Hook mode: behavior follows `preCommitCheck` in config (no-op if unset) |

```sh
dim check
dim check --block
dim check -r HEAD~1
dim check --json --block -r origin/main  # CI mode
dim check --risk-threshold 60 --json    # fail if risk > 60
```

Critical areas can be configured in `.aidimag/critical-areas.yml` (or `.json`) to protect
sensitive paths (auth, payments, PII, migrations). When a change touches a critical area,
`dim check` flags it as a violation unless the commit message contains the area's approval
token (e.g. `[AUTH-OK]`). Areas with `block: true` cause `dim check --block` to exit 1.

`dim check` also computes a **risk score** (0–100) from violation severity, memory kind,
status, confidence, evidence count, critical-area membership, and change breadth. The score
is rendered as a progress bar with a per-factor breakdown:

```
Risk Score: 48/100 [MEDIUM]
  ██████████░░░░░░░░░░
  Factors:
    +48 GUARDRAIL violation (fail) — NEVER guardrail: the staged change appears to do exactly what this forbids
```

Levels: **low** (<30), **medium** (30–59), **high** (60–79), **critical** (80+).

With `--json`, `dim check` outputs a structured report with `passed`, `riskScore`, `riskLevel`, `riskFactors`, `changedFiles`, `checked`, `violations`, and `criticalAreaViolations` fields — suitable for parsing by CI systems and GitHub Actions.

The reusable GitHub Action (`.github/actions/aidimag-check/action.yml`) wraps `dim check --json` and posts a structured PR comment with a risk score table, risk factor breakdown, violation details, and critical area enforcement. It supports `risk-threshold`, `require-owner-approval`, and `run-required-tests` inputs for PR-level governance.

```yaml
# .aidimag/critical-areas.yml
areas:
  - label: Authentication
    paths:
      - src/auth
    owners:
      - alice@example.com
    block: true
    approvalToken: "[AUTH-OK]"
    requiredTests:
      - npm test -- auth
```

See [Pre-commit checks](/guides/dim-check).

### `dim health`

Show a knowledge-health dashboard: memory counts by status/kind, pinned and pending
proposal counts, per-path risk scores, and action suggestions.

| Option | Meaning |
|---|---|
| `-f, --format <fmt>` | `text` (default) or `json` |

```sh
dim health
dim health --format json
```

### `dim brief`

Print a session-start briefing: in-scope memory, guardrails, stale warnings, and questions
to ask before coding. See [Session briefings](/guides/session-briefing).

```sh
dim brief
```

## Tickets & branches

### `dim ticket <connect|status|show|share|branch-rule>`

Connect a ticketing system (Jira, GitHub Issues, Linear, a custom HTTP provider, or the team
sync server) so proposals carry ticket context. See [Connecting tickets](/guides/tickets).

```sh
dim ticket connect
dim ticket status
dim ticket show XXX-2100
```

### `dim branch <ticket-id>`

Create a convention-conforming branch for a ticket (fetches the title for the slug when a
provider is connected).

```sh
dim branch XXX-2100 -p feature
```

## Team sync & cloud

### `dim ui [action]`

Manage the local web dashboard (memory browser, review queue, verify, graph, health dashboard).

The dashboard has three tabs:
- **Overview** — memory list with trust badges, proposal review queue, and a force-directed graph of memories ↔ scope paths.
- **Health** — risk metrics (overall risk score with progress bar), memory summary cards (verified/stale/refuted/failed approaches/pending), coverage heatmap of top risk paths, verify pass-rate trend chart, token usage trend chart, proposal throughput metrics, agent activity breakdown, and actionable suggestions.
- **Actions** — manage, review, verify, sync, mine, bootstrap, generate context files, and more.

| Argument | Meaning |
|---|---|
| `action` | `start` (default) or `stop` |

| Option | Meaning |
|---|---|
| `-p, --port <n>` | Port (default 4517) |
| `--no-open` | Don't open the browser automatically (start only) |

```sh
dim ui              # start the dashboard
dim ui start        # explicit start
dim ui -p 5000      # start on custom port
dim ui stop         # stop the server
dim ui stop -p 5000 # stop server on custom port
```

### `dim serve`

Run a self-hosted team sync server.

```sh
dim serve --token <shared-secret> --db ./team-sync.db --port 8787
```

### `dim cloud <link|status|unlink>`

Bind the repo to a sync server brain.

```sh
dim cloud link --server http://your-server:8787 --brain myrepo --token <secret>
dim cloud status
dim cloud unlink
```

### `dim sync`

Push/pull memory with the linked team server (also runs automatically after writes).

```sh
dim sync              # incremental sync
dim sync --full       # re-upload everything
```

**Cloud quota handling (aiDimag Cloud free tier):**

When you hit the 100 memory limit, `dim sync` will prompt you to select which memories to sync:
- **Sync newest 100** — Most recently created/updated
- **Sync verified only** — Only VERIFIED status memories  
- **Let me select** — Choose specific memories interactively

Updates to already-synced memories always work, even at the limit. The quota only applies to new memories.

::: tip
Upgrade to a paid plan for unlimited memories and sync frequency. See [Pricing](/pricing).
:::

### `dim login` / `dim logout`

Device-code login: approve this machine in the browser; the token is saved to `.aidimag/config.json` (per-project). Requires the repo to be linked first with `dim cloud link`.

```sh
# First link the repo (without token)
dim cloud link --server https://cloud.aidimag.com --brain myrepo-abc123

# Then login via browser
dim login

# Logout removes the token from config
dim logout
```

### `dim keys <create|list|revoke>`

Mint or revoke brain-scoped API keys (requires the admin token).

```sh
AIDIMAG_ADMIN_TOKEN=... dim keys create --brain myrepo --label alice
dim keys list --brain myrepo
dim keys revoke --key aidimag_sk_...
```

See [Team sync](/guides/team-sync).

### `dim retention`

Apply retention policy: auto-forget old, evidence-free memories. Configured via `retention` in `.aidimag/config.json` or overridden with CLI flags.

```sh
# Dry-run: see what would be forgotten
dim retention --dry-run --max-age-days 90

# Actually forget (uses config or --max-age-days)
dim retention --max-age-days 90

# Also forget STALE memories older than 30 days
dim retention --max-age-days 90 --stale-age-days 30
```

Config example (`.aidimag/config.json`):

```json
{
  "retention": {
    "maxAgeDays": 90,
    "staleAgeDays": 30,
    "preservePinned": true,
    "preserveSources": ["human", "knowledge:"],
    "dryRun": false
  }
}
```

Pinned memories, human-authored memories, and REFUTED memories are always preserved by default.

### `dim users <create|list|revoke|set-role>`

Manage RBAC users on the sync server (requires admin token).

```sh
AIDIMAG_ADMIN_TOKEN=... dim users create --username alice --role member
dim users list
dim users revoke --user-id <uuid>
dim users set-role --user-id <uuid> --role viewer --brain myrepo
```

Roles: `admin` (full access), `member` (read + write), `viewer` (read only). Per-brain role overrides take precedence over the global role.

### `dim oidc <set|show|remove>`

Configure OIDC SSO on the sync server (requires admin token).

```sh
AIDIMAG_ADMIN_TOKEN=... dim oidc set \
  --issuer https://accounts.google.com \
  --client-id your-client-id \
  --client-secret your-secret \
  --redirect-uri https://your-server/v1/auth/oidc/callback

dim oidc show
dim oidc remove
```

Users can then log in at `https://your-server/v1/auth/oidc/login`. The OIDC `sub` claim must match a user's `oidcSub` field (set via `dim users create --oidc-sub <sub>`).

### `dim analytics`

Agent/model performance analytics: tokens saved, violations prevented, verify trends, proposal throughput, and agent activity.

```sh
# Default: last 30 days, text dashboard
dim analytics

# Last 7 days
dim analytics --days 7

# Custom date range
dim analytics --since 2025-01-01 --until 2025-02-01

# JSON output for CI or dashboards
dim analytics --json
```

Metrics tracked:
- **Tokens saved** — from budgeted `dim recall` and `dim context` calls
- **Violations prevented** — verified GUARDRAIL and FAILED_APPROACH memories
- **Verify pass rate** — daily PASS/FAIL trend from `dim verify` runs
- **Proposal flow** — created, approved, rejected, pending, approval rate
- **Memory lifecycle** — created, forgotten, refuted, superseded, net growth
- **Agent activity** — per-machine event counts and memory creation
- **Kind distribution** — count, verified, stale, refuted, avg evidence per kind

## Agent integration

### `dim mcp`

Run the MCP server over stdio. Usually invoked by your agent's config, not by hand. See
[MCP integration](/mcp).

```sh
dim mcp
```

## Environment variables

| Variable | Purpose |
|---|---|
| `AIDIMAG_REPO` | Repo root the MCP server / CLI should use |
| `AIDIMAG_EMBEDDINGS` | `auto` (default) / `openai` / `ollama` / `off` |
| `AIDIMAG_LLM` | Text-LLM provider for mining/harvest/bootstrap/knowledge: `auto` (default) / `openai` / `ollama` / `off` |
| `OPENAI_API_KEY` | Enables OpenAI embeddings + text extraction |
| `AIDIMAG_OPENAI_MODEL`, `AIDIMAG_OLLAMA_MODEL`, `AIDIMAG_OLLAMA_URL` | Customize embedding providers |
| `AIDIMAG_OLLAMA_CHAT_MODEL` | Override the Ollama LLM model (default: from `config.json` or `llama3.1`) |
| `AIDIMAG_OPENAI_CHAT_MODEL` | Override the OpenAI chat model (default: `gpt-4o-mini`) |
| `AIDIMAG_AUTO_SYNC` | Set to `off` to disable debounced auto-sync after writes |
| `AIDIMAG_API_KEY` | Auth token for sync (alternative to the credentials file) |
| `AIDIMAG_SYNC_TOKEN`, `AIDIMAG_ADMIN_TOKEN` | Server/admin tokens for `dim serve` / `dim keys` |
| `AIDIMAG_DEBUG` | Set to `1` to print errors from best-effort paths (auto-sync, embeddings, LLM mining skips, gap logging) that are normally silent |

---

Next: **[Configuration](/configuration)**.

