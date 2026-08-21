# Web dashboard

The dashboard is a local web app for everything you'd otherwise do on the command line —
handy when you'd rather click than type.

## Open it

```sh
dim ui
```

This starts a small local server (default port **4517**) and opens your browser. Stop it with
`Ctrl+C` or `dim ui stop`.

```sh
dim ui -p 5000      # custom port
dim ui --no-open    # start the server without opening a browser
dim ui stop         # stop the server
dim ui stop -p 5000 # stop server on custom port
```

## What's inside

![Dashboard overview showing memory browser, stat cards, and memory graph](/screenshots/dashboard-overview.png)
*The Overview tab: memory browser with trust badges, stat cards, and force-directed memory graph.*

- **Memory browser** — every memory with its kind, status, confidence, scope, and evidence.
  Filter and search to find what you need.
![Review queue in the dashboard with click-to-approve](/screenshots/dashboard-review-queue.png)
*The review queue: triage proposals with one-click approve, reword, or reject.*

- **Review queue** — approve, reword, or reject pending proposals from the commit miner and
  agent sessions.
- **Dashboard stats** — at-a-glance cards for total memories, Review Queue, Knowledge Inbox,
  Knowledge Gaps, LLM provider, and Embeddings provider.
- **LLM & Embeddings status cards** — show the connected provider name and selected model.
  Click to open **Model Settings** (change models, pull new ones) or trigger **Setup Ollama**
  if no provider is connected.
![Actions tab with grouped action buttons and copy-to-CLI icons](/screenshots/dashboard-actions.png)
*The Actions tab: grouped actions (Core, Analysis, Collaboration, Advanced) with copy-to-CLI icons.*

- **Actions tab** — manage, review, verify, and sync your project's memory. Actions are
  grouped into Core (capture, review, verify), Analysis (audit, gaps, search log),
  Collaboration (sync, cloud, login, tickets, branch, Hermes), and Advanced (context files,
  guardrails, tickets, scratchpad, Ollama setup). Most actions execute directly via server
  API calls — no need to copy commands to a terminal. A **copy icon** (⧉) next to each CLI
  command lets you copy the equivalent terminal command if preferred.
![Interactive onboarding tour with spotlight positioning](/screenshots/dashboard-onboarding.png)
*Interactive onboarding: a 14-step guided walkthrough with spotlight positioning.*

- **Interactive onboarding tour** — a 14-step guided walkthrough covering the full first-time
  workflow: Memory Graph → Search → Proposals → Actions → Bootstrap → Mine → Import Knowledge
  → Harvest → Embeddings & LLM → Agent Integration → Verify & Sync → Health → Protected Areas.
  Includes spotlight positioning, scroll lock, and auto-adjusts on window resize. Replay
  anytime via Actions → Reset Onboarding.
- **Modal confirmations** — destructive actions (clear notes, sign out, purge proposals,
  clear gaps) use styled modal dialogs instead of native browser prompts.
![Setup Ollama dialog with step-by-step flow and progress spinners](/screenshots/dashboard-setup-ollama.png)
*Setup Ollama dialog: guided install → start → pull models → verify, with progress spinners.*

- **Setup Ollama dialog** — guided step-by-step flow: install Ollama → start server →
  pull embedding + LLM models → verify. Shows progress with spinners for each step.

![Model Settings dialog with model selection and pull buttons](/screenshots/dashboard-model-settings.png)
*Model Settings dialog: change embedding or LLM models, pull new ones with status indicators.*

- **Model Settings dialog** — change embedding or LLM model selection, pull new models
  directly from the UI, with pull status indicators.
- **Verify buttons** — re-run evidence on demand and watch statuses update.
![Memory graph showing force-directed visualization of memories and links](/screenshots/dashboard-memory-graph.png)
*Memory graph: force-directed visualization showing how memories support, contradict, or refine each other.*

- **Memory graph** — a force-directed visualization of memories and their links
  (supports / contradicts / refines), so you can see how knowledge connects.

![Health tab with risk metrics, coverage heatmap, and trend charts](/screenshots/dashboard-health.png)
*Health tab: risk score, coverage heatmap, verify pass-rate trend, and agent activity breakdown.*

- **Health tab** — risk metrics, coverage heatmap, and trend charts for your project's
  AI memory.
- **Protected Areas tab** — define critical code boundaries that require owner approval,
  passing tests, or explicit approval tokens before changes are allowed.
- **Loading indicators** — long-running actions (bootstrap, harvest, mine, sync, reindex,
  verify) show spinner toasts while running, so you always know when work is in progress.
![Tickets modal with provider dropdown open showing 12+ providers](/screenshots/dashboard-tickets-modal.png)
*Tickets modal: connect ticket providers with the dropdown rendered above the modal.*

- **Tickets modal** — connect, validate, share, and disconnect ticket providers from the
  browser. Supports 12+ providers (Jira, GitHub Issues, Linear, GitLab Issues, Azure DevOps,
  ClickUp, Shortcut, YouTrack, Asana, Trello, Notion, Pivotal Tracker), custom HTTP middleware,
  and Remote (team sync server). The provider dropdown renders above the modal without
  scrollbars. When a cloud server is linked and the admin has shared ticket credentials, the
  dashboard auto-discovers the team's provider and shows a "Connect now" button.
- **Themed scrollbars** — all scrollable elements use thin, themed scrollbars that adapt to
  light/dark mode.
- **Confirm dialog for memory deletion** — the "Forget" button uses a styled confirmation
  dialog instead of the browser's native `confirm()` prompt.

## When to use the dashboard vs the CLI

| You want to… | Best surface |
|---|---|
| Quickly add a one-off memory | CLI (`dim remember`) |
| Skim and triage a big review queue | Dashboard |
| See how memories relate visually | Dashboard graph |
| Script or automate | CLI |
| Work without leaving your editor | [IDE extension](/ide-extensions) |

The dashboard, CLI, and IDE extensions all operate on the same local database, so changes in
one show up everywhere.

---

Next: **[Benchmarks](/benchmarks)**.

