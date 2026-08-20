# aidimag — Command Reference & Plugin Actions Spec

> **Audience:** AI agent (or developer) implementing the **VS Code extension** (`aidimag-vscode`)
> and the **IntelliJ plugin** (`aidimag-intellij`).
>
> **Goal:** surface every aidimag capability as **buttons/widgets in a dedicated Actions
> dashboard/tab** inside each IDE — not only behind `Tools → aidimag → …` (IntelliJ) or the
> Command Palette (VS Code).

---

## 1. What aidimag is (30-second model)

aidimag (`dim` CLI) is **persistent, verified memory for AI coding agents**, scoped to a git
repository. It stores *falsifiable claims* about the repo ("memories"), each optionally backed by
**evidence** that can be re-run to confirm the claim still holds. Memories decay in confidence over
time unless pinned or re-verified. Agents access memory through an **MCP server**; humans through
the **CLI**, the **web dashboard** (`dim ui`), and the IDE plugins.

Data lives in `.aidimag/` inside the repo (SQLite DB + config). Nothing leaves the machine unless
the repo is linked to a **team sync server**.

### Core concepts

| Concept | Meaning |
|---|---|
| **Memory** | A falsifiable claim about the repo (e.g. "retries must use exponential backoff, see `src/net/retry.ts`"). Has kind, scope (paths/symbols), confidence, status. |
| **Kind** | `DECISION`, `CONVENTION`, `GOTCHA`, `FAILED_APPROACH`, `ARCHITECTURE`, `INVARIANT`, `TODO_CONTEXT`, `GUARDRAIL`, `SKILL` |
| **Guardrail level** | For `GUARDRAIL` kind only: `always` \| `ask-first` \| `never` |
| **Evidence** | `COMMIT_REF`, `TEST_RESULT`, `EXEC_TRACE`, `STATIC_CHECK`, `HUMAN_ATTESTED`, `TICKET_REF`. Re-run by `dim verify`; result `PASS`/`FAIL`/`UNKNOWN` drives memory status. |
| **Status** | ACTIVE → STALE (failed evidence / decay) → REFUTED (kept as negative knowledge). `forget` deletes permanently. |
| **Pin** | Pinned memories never decay with age (evidence failure can still mark them stale). |
| **Proposal / review queue** | Anything mined/harvested/bootstrapped/ingested is **queued for human review** — never auto-saved. Approve/reject via `dim review` or the dashboard. |
| **Scratchpad** | Short-term session notes. TTL-expiring (default 24 h), **never synced, never durable memory**. |
| **Knowledge inbox** | Drop docs (md/pdf/docx/…) into `knowledge/`; `dim knowledge sync` LLM-summarizes them into proposals. |
| **Gaps** | Log of searches (by agents or you) that returned *nothing* — the facts your memory is missing. |
| **Team sync** | Optional. Push/pull memory with a self-hosted or cloud sync server ("brain"). Synced-in evidence commands are **never executed until you approve them** (`dim verify --trust`). |
| **Tickets** | Connect Jira / GitHub Issues / Linear / HTTP middleware / the sync server, so proposals carry ticket context and branch conventions are enforced. |

### The loop

```
capture (mine / harvest / bootstrap / knowledge / remember)
   → review (dim review / dashboard)            ← humans gate everything
      → recall (MCP tools / dim recall / brief) ← agents consume memory
         → verify (dim verify / git hooks)      ← evidence keeps memory honest
            → sync (dim sync)                   ← optional team sharing
```

---

## 2. Complete CLI command reference (`dim …`)

The plugins shell out to the `dim` binary (resolved from PATH / settings). All commands run with
`cwd` = repo root. Long-running commands (mine `--llm`, bootstrap, harvest, knowledge sync,
reindex, verify `--deep`) should run in a background task/terminal with progress UI.

### 2.1 Memory (memory.ts)

| Command | What it does | Args / options | UI notes |
|---|---|---|---|
| `dim init` | Initialize aidimag in the current repo (creates `.aidimag/`, git hooks) | — | Button: **Initialize Repo** (show only when `.aidimag/` missing) |
| `dim remember <claim>` | Store a memory | `-k/--kind <kind>` (default GOTCHA), `-p/--path <paths...>`, `-s/--symbol <symbols...>`, `-e/--evidence TYPE:payload...`, `-g/--guardrail-level <level>`, `--pin` | Button: **Add Memory** → form dialog (claim, kind dropdown, paths, pin checkbox) |
| `dim recall [query...]` | Hybrid keyword + semantic search | `-p/--path`, `-k/--kind`, `-n/--limit` (10), `--all` (include refuted) | Widget: **search box** in the tab |
| `dim reindex` | Build/refresh semantic embeddings | — | Button (Maintenance group), long-running |
| `dim status` | Memory store summary (counts by kind/status, sync state) | — | **Status widget** — poll and render, don't hide behind a button |
| `dim log` | Recent memories | `-n/--limit` (20) | List widget or button |
| `dim gaps` | Knowledge gaps: searches that returned nothing | `-d/--days` (30), `-n/--limit` (20), `--clear` | Button: **Knowledge Gaps** → results view + "Clear gaps" + "Add Memory" follow-ups |
| `dim scratch [note...]` | Scratchpad: jot note; no note = list | `--session <id>` (default), `--ttl <hours>` (24), `--clear`, `--all` | Buttons: **Jot Note** (input box), **Show Notes**, **Clear Notes** (confirm) |
| `dim audit` | Provenance audit: weakest-ground memories (agent-authored, evidence-free, stale, long-unverified) | `-n/--limit` (20) | Button: **Provenance Audit** → results view, offer "Verify Memories" follow-up |
| `dim refute <id>` | Mark memory REFUTED (kept as negative knowledge) | `-s/--superseded-by <id>` | Per-memory row action (Memory Explorer / detail) |
| `dim pin <id>` | Pin memory (never decays) | — | Per-memory row action |
| `dim unpin <id>` | Unpin memory | — | Per-memory row action |
| `dim update <id>` | Edit claim/kind/evidence | `-c/--claim`, `-k/--kind`, `-g/--guardrail-level`, `-e/--evidence...`, `--remove-evidence <id>` | Per-memory edit dialog |
| `dim forget <id>` | Delete permanently (prefer refute) | — | Per-memory action, destructive → confirm |

Memory ids accept an 8-char prefix everywhere.

### 2.2 Capture (capture.ts)

| Command | What it does | Options | UI notes |
|---|---|---|---|
| `dim mine` | Mine git commit history for memory candidates → review queue | `-n/--max` (500), `--full` (ignore cursor), `--llm` (deep: LLM reads message+diff; needs Ollama/OPENAI_API_KEY), `--prs` (mine merged GitHub PRs + review comments; needs `gh` + LLM), `-q/--quiet` | Button: **Mine Commits** → QuickPick: Fast / Deep (LLM) / PRs. Long-running with progress. |
| `dim bootstrap` | Instant brain for a fresh repo: survey README/docs/manifests/structure/churn, LLM-extract initial memories → review queue | `--force` (re-run) | Button: **Bootstrap Repo**. Long-running. |
| `dim harvest` | Harvest durable facts *you typed* into AI-chat transcripts (Claude Code, Codex CLI, Copilot/VS Code, Cursor) → review queue (local-only, secrets redacted) | `--all`, `--source <names>`, `--install-hook` (wire into SessionEnd hook), `-q` | Button: **Harvest AI Chats** |
| `dim review [action] [id]` | Review pending proposals. `action`: interactive (default) \| `list` \| `approve` \| `reject`; `id` or `all` | `-n/--limit` (50), `--min-score <0–1>` (with `approve all`) | Prefer dashboard/HTTP API for per-item approve/reject buttons (§4). Button: **Review Proposals** with pending-count badge. |
| `dim proposals gc` | Purge resolved proposal rows (tombstoned for sync) | `--dry-run` | Maintenance button |

### 2.3 Verify (verify.ts)

| Command | What it does | Options | UI notes |
|---|---|---|---|
| `dim verify` | Re-run evidence, update statuses (cheap tier) | `-i/--id <ids...>`, `-d/--deep` (also TEST_RESULT/EXEC_TRACE), `--trust` (review & approve synced-in evidence commands), `-q` | Buttons: **Verify** and **Deep Verify**; **Review Synced Evidence** (trust gate) must run in a real terminal — it's interactive |
| `dim check` | Pre-commit contradiction check: staged diff vs active memories/guardrails | `-r/--ref <ref>`, `--block`, `--pre-commit` | Button: **Check Staged Changes** |
| `dim brief` | Session-start briefing: in-scope memory, guardrails, stale warnings, questions to ask | — | Button: **Session Briefing** → rendered output view |

### 2.4 Sync & cloud (sync.ts)

| Command | What it does | Options | UI notes |
|---|---|---|---|
| `dim sync` | Push + pull with the linked team server | `--full`, `--force-pull` (recovery), `-y/--yes` | Button: **Sync Now** + last-sync status widget |
| `dim cloud <action>` | `link \| unlink \| status \| remote` — manage repo↔brain binding | `-s/--server <url>`, `-b/--brain <name>`, `-t/--token`, `--json`, `--id`, `--limit` (20), `--summary`, `--proposals`, `--all`, `--full` | Buttons: **Link Cloud** (form), **Cloud Status**; `--json` gives machine-readable output for widgets |
| `dim login` | Device-code login, approved in browser | `-s/--server`, `--no-open` | Button: **Login / Approve Device** |
| `dim logout` | Remove this device's stored token | — | Button |
| `dim serve` | Run a self-hosted sync server | `-p/--port` (8787), `-d/--db`, `-t/--token` | Not a plugin button (server-side) |
| `dim keys <action>` | `create \| list \| revoke` brain-scoped API keys (admin) | `-s/--server`, `-b/--brain`, `-l/--label`, `-k/--key`, `-t/--admin-token` | Admin-only; optional settings-page feature |

### 2.5 Tickets (tickets.ts)

| Command | What it does | Options | UI notes |
|---|---|---|---|
| `dim ticket <action> [id]` | `connect \| status \| disconnect \| show \| share \| branch-rule`. Providers: `jira \| github \| linear \| http \| remote` | `--provider`, `--url`, `--token`, `--pattern`, `--enforce push\|warn\|off`, `--exempt <branches...>`, `--print <host>`, `--remove`, `--admin-token`, `--no-open` | Buttons: **Connect Tickets** (provider wizard), **Show Ticket** (input box) |
| `dim branch <ticketId>` | Create convention-conforming branch (fetches title for slug) | `-p/--prefix` (feature) | Button: **Create Ticket Branch** (input: ticket id) |
| `dim branch-check` | (hidden; used by git hooks) validate current branch | `--warn`, `--push` | Not a button |

### 2.6 Knowledge inbox (knowledge.ts)

| Command | What it does | Options | UI notes |
|---|---|---|---|
| `dim knowledge` / `dim knowledge sync` | Process inbox now: summarize new docs → proposals | — | Button: **Sync Knowledge Inbox**, long-running |
| `dim knowledge status` | Pending / skipped / processed counts | — | Feed the status widget |
| `dim knowledge list` | Processed docs + memories they produced | — | Results view |
| `dim knowledge watch` | Foreground watcher (Ctrl-C to stop) | `-d/--debounce <ms>` (750) | Optional toggle; runs as managed background process |

### 2.7 Hosts (hosts.ts)

| Command | What it does | Options | UI notes |
|---|---|---|---|
| `dim ui [action]` | `start` (default) \| `stop` the local web dashboard | `-p/--port` (4517), `--no-open` | Plugins already auto-start this and embed it (JCEF / webview) |
| `dim generate-context` | Render trustworthy memory → static context files | `-f/--format claude\|cursorrules\|copilot\|windsurfrules\|agents\|all` (claude), `--auto`, `--no-auto` | Button: **Generate Context Files** → format QuickPick |
| `dim mcp` | Run the MCP server (stdio) | — | Not a button; used by agent configs |

---

## 3. MCP tools (for reference — what agents see)

`memory_search`, `memory_get_for_files`, `memory_write`, `memory_refute`, `memory_status`,
`memory_check_change`, `scratchpad_write`, `scratchpad_read`, `scratchpad_clear`, `memory_verify`, `memory_propose`,
`context_note`, `memory_critique`, `ticket_get`, `commits_mine`, `proposals_pending`,
`knowledge_pending`, `knowledge_ingest_submit`, `knowledge_ingest`, `session_end_extraction`,
`session_start`.

The plugins don't call MCP; they shell out to `dim` or hit the dashboard HTTP API. Listed here so
UI copy can explain what agents can do.

---

## 4. Dashboard HTTP API (`dim ui`, default `http://127.0.0.1:4517`)

The embedded dashboard server exposes JSON endpoints — **prefer these over CLI parsing for
widgets** (no shell, structured data):

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/state` | GET | Full snapshot: memories, pending proposals (≤200), counts, sync/ticket config — the backbone of any widget/tab |
| `/api/search?q=…` | GET | Search memories |
| `/api/memories` | POST | Create memory (Add Memory form) |
| `/api/memories/:id/refute\|forget\|pin\|unpin` | POST | Per-memory row actions |
| `/api/proposals/:id/approve\|reject` | POST | Review-queue buttons |
| `/api/verify` | POST | Run verification |
| `/api/mine` | POST | Mine commits |
| `/api/reindex` | POST | Rebuild embeddings |
| `/api/sync` | POST | Team sync |
| `/api/cloud/link` / `/api/cloud/unlink` | POST | Cloud binding |
| `/api/tickets/connect\|disconnect\|share` / `/api/tickets/show?id=…` | POST/GET | Ticket provider management |
| `/api/keys` | * | API-key admin (proxied; admin token per-request, never stored) |

**Rule of thumb:** interactive/OS-level flows (login browser flow, `verify --trust`, bootstrap,
harvest, knowledge sync, generate-context) → shell out to `dim`. Data reads and single-item
mutations → HTTP API.

---

## 5. What already exists in the plugins

### VS Code (`aidimag-vscode`, `extension.js`)
Commands (all palette-only today except tree/statusbar items):
`openDashboard, verify, sync, login, pinMemory, connectTickets, showTicket, ticketBranch,
addMemory, refreshMemoryExplorer, openMemoryDetail, pinMemoryItem, unpinMemoryItem,
refuteMemoryItem, knowledgeSync, revealMemoryExplorer, bootstrap, mine, harvest, brief, gaps,
scratchpad, audit, verifyTrust, generateContext`.
Existing UI: Memory Explorer tree view, status bar items, dashboard webview (embeds `dim ui`).

### IntelliJ (`aidimag-intellij`)
Actions (Tools → aidimag): `OpenDashboard, RefreshDashboard, Verify, Sync, SyncKnowledge,
PinMemory, Bootstrap, Mine, Harvest, Brief, Gaps, VerifyTrust, GenerateContext, Scratchpad, Audit,
Login, ConnectTickets, ShowTicket, TicketBranch`.
Existing UI: tool window with **Dashboard** tab (JCEF embedding `dim ui`) and Memory Explorer
panel; `DimRunner` helper shells out to `dim`; `AidimagNotifications` for toasts.

---

## 6. REQUIREMENT — the "Actions" tab with widget groups

Add a new **Actions** tab (next to Dashboard / Memory Explorer) in both plugins. Every command
below becomes a **button** with icon + label + tooltip (use the CLI description). Group them:

### Widget: Repo status (top, auto-refreshing)
- Render from `GET /api/state` (fallback: `dim status`): memory counts by status/kind, pending
  proposals count, knowledge inbox pending, gap count, last sync time, ticket provider.
- Badges on buttons: **Review Proposals (N)**, **Knowledge Inbox (N)**.

### Group: Capture
| Button | Runs |
|---|---|
| ➕ Add Memory | form → `POST /api/memories` (or `dim remember`) |
| ⛏ Mine Commits | QuickPick: Fast → `dim mine` · Deep (LLM) → `dim mine --llm` · PRs → `dim mine --prs` |
| 🧠 Bootstrap Repo | `dim bootstrap` (confirm; `--force` if already done) |
| 💬 Harvest AI Chats | `dim harvest` |
| 📚 Sync Knowledge Inbox | `dim knowledge sync` (+ show `dim knowledge status` result) |

### Group: Review & hygiene
| Button | Runs |
|---|---|
| ✅ Review Proposals (N) | open dashboard review section, or in-IDE list via `/api/state` with per-row `POST /api/proposals/:id/approve|reject` |
| 🔍 Provenance Audit | `dim audit` → results view → offer **Verify Memories** |
| 🕳 Knowledge Gaps | `dim gaps` → results view → offer **Add Memory** / **Clear Gaps** |
| 🗑 Proposals GC | `dim proposals gc` (confirm; offer `--dry-run` first) |

### Group: Verify & trust
| Button | Runs |
|---|---|
| ✔ Verify | `POST /api/verify` or `dim verify` |
| 🔬 Deep Verify | `dim verify --deep` |
| 🛂 Review Synced Evidence | `dim verify --trust` — **must open a real terminal** (interactive) |
| 🧪 Check Staged Changes | `dim check` |
| 📋 Session Briefing | `dim brief` → rendered output panel |

### Group: Scratchpad (session notes)
| Button | Runs |
|---|---|
| ✏️ Jot Note | input box → `dim scratch "<note>"` (mention "expires in 24 h, never synced") |
| 📖 Show Notes | `dim scratch --all` → output view |
| 🧹 Clear Notes | `dim scratch --clear --all` (confirm) |

### Group: Team & sync
| Button | Runs |
|---|---|
| 🔄 Sync Now | `POST /api/sync` or `dim sync` |
| 🔗 Link / Unlink Cloud | form → `POST /api/cloud/link` / `unlink` |
| 🔐 Login (approve device) | `dim login` (opens browser) |
| 🚪 Logout | `dim logout` |

### Group: Tickets
| Button | Runs |
|---|---|
| 🎫 Connect Ticketing App | provider wizard → `dim ticket connect …` or `POST /api/tickets/connect` |
| 👁 Show Ticket | input box → `dim ticket show <id>` |
| 🌿 Create Ticket Branch | input box → `dim branch <ticketId>` |

### Group: Maintenance / output
| Button | Runs |
|---|---|
| 🧭 Generate Context Files | format QuickPick → `dim generate-context -f <fmt>` |
| 🧮 Reindex Embeddings | `dim reindex` |
| 🌐 Open Web Dashboard | existing openDashboard command |

### UX rules
1. **Never block the UI** — run every command async (VS Code: `withProgress`; IntelliJ:
   `Task.Backgroundable`). Reuse the existing `runDim` / `DimRunner` helpers.
2. **Destructive actions** (forget, clear scratchpad, proposals gc, unlink, logout) require a
   confirmation dialog.
3. **Interactive commands** (`verify --trust`, interactive `review`) must run in a real IDE
   terminal, not captured output.
4. **Show output** in a dedicated output channel / console tab named `aidimag`, and surface
   one-line results as toasts/status-bar messages.
5. **Graceful degradation:** if `dim` is not on PATH → show install hint
   (`npm i -g aidimag`); if repo has no `.aidimag/` → show only **Initialize Repo**; if no cloud
   link → disable Sync/Logout with tooltip.
6. **Long-running LLM commands** (mine `--llm`, bootstrap, harvest, knowledge sync) need
   cancellable progress and may take minutes.
7. Keep the existing menu/palette entries — the Actions tab is **additive**.
8. IntelliJ: build the tab as a `ContentTab` in the existing tool window; plain Swing
   (`JBPanel` + `ActionButton`s / `DialogWrapper` forms) is fine — JCEF not required for this tab.
   VS Code: a `WebviewViewProvider` (buttons post messages → `executeCommand`) or a
   `TreeView` with command items; webview preferred for grouped button layout and status widget.

---

## 7. Environment & prerequisites the plugin should check

| Requirement | Needed by | Detection |
|---|---|---|
| `dim` binary (npm pkg `aidimag`) | everything | `dim --version` |
| `.aidimag/` in repo | everything except `init` | dir exists |
| LLM provider (Ollama local or `OPENAI_API_KEY`) | mine `--llm`, bootstrap, harvest, knowledge sync, PR mining | command output will error; surface hint |
| `gh` CLI | `mine --prs` | `gh --version` |
| Linked cloud config | sync, login/logout, keys, ticket share/remote | `dim cloud status` / `/api/state` |
| Dashboard server (`dim ui`) | HTTP API widgets | `GET /api/state` on configured port (default 4517) |

