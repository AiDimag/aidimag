# Connecting tickets

Commits tell you *what* changed; tickets usually hold the *why* — the root cause, the
rejected alternatives, the acceptance criteria. aiDimag can connect to your ticketing system
so that context flows into your memory.

## Supported providers

<style>
.integration-logos { display:flex;flex-wrap:wrap;gap:20px;justify-content:center;align-items:center;margin:24px 0; }
.integration-logos .ic-tooltip { position:relative;display:inline-flex;align-items:center; }
.integration-logos .ic-tooltip img { height:32px;transition:transform 0.15s ease; }
.integration-logos .ic-tooltip:hover img { transform:scale(1.12); }
.integration-logos .ic-tooltip::after {
  content: attr(data-name);
  position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%);
  background: hsl(222 47% 11%); color: #fff;
  padding: 4px 10px; border-radius: 6px; font-size: 12px;
  white-space: nowrap; pointer-events: none;
  opacity: 0; transition: opacity 0.15s ease; z-index: 10;
}
.integration-logos .ic-tooltip:hover::after { opacity: 1; }
.dark .integration-logos .ic-dark-invert { filter: invert(1); }
.dark .integration-logos .ic-tooltip::after { background: hsl(210 40% 98%); color: hsl(222 47% 11%); }
</style>
<div class="integration-logos">
  <span class="ic-tooltip" data-name="Jira"><img src="https://api.iconify.design/simple-icons:jira.svg?color=%230052CC" alt="Jira"></span>
  <span class="ic-tooltip" data-name="GitHub Issues"><img src="https://api.iconify.design/simple-icons:github.svg?color=%23000000" class="ic-dark-invert" alt="GitHub Issues"></span>
  <span class="ic-tooltip" data-name="Linear"><img src="https://api.iconify.design/simple-icons:linear.svg?color=%235E6AD2" alt="Linear"></span>
  <span class="ic-tooltip" data-name="GitLab Issues"><img src="https://api.iconify.design/simple-icons:gitlab.svg?color=%23FC6D26" alt="GitLab Issues"></span>
  <span class="ic-tooltip" data-name="Azure DevOps"><img src="https://api.iconify.design/simple-icons:azuredevops.svg?color=%230078D7" alt="Azure DevOps"></span>
  <span class="ic-tooltip" data-name="ClickUp"><img src="https://api.iconify.design/simple-icons:clickup.svg?color=%237B68EE" alt="ClickUp"></span>
  <span class="ic-tooltip" data-name="Shortcut"><img src="https://api.iconify.design/simple-icons:shortcut.svg?color=%2336b37e" alt="Shortcut"></span>
  <span class="ic-tooltip" data-name="YouTrack"><img src="https://api.iconify.design/logos:youtrack.svg" alt="YouTrack"></span>
  <span class="ic-tooltip" data-name="Asana"><img src="https://api.iconify.design/simple-icons:asana.svg?color=%23F06A6A" alt="Asana"></span>
  <span class="ic-tooltip" data-name="Trello"><img src="https://api.iconify.design/simple-icons:trello.svg?color=%230052CC" alt="Trello"></span>
  <span class="ic-tooltip" data-name="Notion"><img src="https://api.iconify.design/simple-icons:notion.svg?color=%23000000" class="ic-dark-invert" alt="Notion"></span>
  <span class="ic-tooltip" data-name="Pivotal Tracker"><img src="https://api.iconify.design/simple-icons:pivotaltracker.svg?color=%230060A0" alt="Pivotal Tracker"></span>
</div>

Plus a **custom HTTP provider** (your own middleware — see `design/HTTP_PROVIDER.md` in the repo)
and **Remote (team sync server)** — share one credential with the whole team; teammates hold zero
local credentials.

## Connect

![Tickets modal with provider dropdown, URL and credential fields](/screenshots/dashboard-tickets-modal.png)
*The Tickets modal: select a provider, enter your base URL and credential, and connect.*

```sh
dim ticket connect
```

This runs an interactive flow that asks for your provider and credentials. The provider, base
URL, and pattern are written to `.aidimag/config.json` under the `tickets` key. The credential
itself is also stored per-repo in `.aidimag/config.json` under `tickets.token` (with file mode
`0o600`) — it is never stored globally and never leaks between projects.

```sh
dim ticket status      # show what's connected
dim ticket show XXX-2100
```

## What you get

### Ticket ids extracted automatically (offline)

aiDimag pulls the ticket id from your **branch name** or **commit messages** using a pattern
in your config — no provider needed. Mined proposals are tagged with that id automatically.

### Live context at review time

![Ticket context shown next to a proposal in dim review](/screenshots/dim-review-ticket-context.png)
*Ticket context in review: the ticket's title, type, and status appear next to each mined proposal.*

When a provider *is* connected, `dim review` shows the ticket's title, type, status, and body
next to each proposal, so you can confirm the *why* before approving:

```
── 1 of 2 ── GOTCHA · mined from commit a1b2c3d4
   "refreshToken() twice concurrently logs the user out."
   ticket: XXX-2100 "Session drops on rapid navigation" (bug, done) — https://...
```

### Agents can fetch tickets

The MCP `ticket_get` tool lets an agent pull the current ticket (auto-detected from the
branch) at session end, so its proposals carry the real rationale.

## Branch conventions

![Branch rule enforcement output in the terminal](/screenshots/dim-ticket-branch-rule.png)
*Branch rule enforcement: aiDimag warns or blocks non-conforming branches at checkout and push.*

You can define a branch-naming convention and have aiDimag warn or block on violations:

```sh
dim ticket branch-rule        # manage the convention; prints server-side rules too
dim branch XXX-2100           # create a conforming branch (fetches the title for the slug)
```

| Enforcement | Effect |
|---|---|
| `off` | No checking |
| `warn` | A heads-up at branch creation (`post-checkout`) |
| `push` | Blocks pushing a non-conforming branch (`pre-push`) |

## Team-shared credentials (Remote provider)

![Team ticket auto-discovery showing the Connect now button](/screenshots/dim-ticket-share.png)
*Team auto-discovery: when the admin has shared ticket credentials, the dashboard shows the team's provider with a Connect now button.*

So every teammate doesn't need their own ticket token, one person can share the credential
through the sync server:

```sh
dim ticket share
```

Team members then select **"Remote (team sync server)"** as their provider in `dim ticket connect`
or via the dashboard's Tickets modal. They resolve tickets via the server and hold **zero** ticket
credentials locally.

When a cloud server is linked and the admin has shared ticket credentials, the dashboard
automatically detects the team's ticket provider and shows a **"Connect now"** button — no need
to know which provider the team is using.

### Per-repo credential storage

Ticket credentials are stored **per-repo** in `.aidimag/config.json` under `tickets.token`,
matching the same pattern used for cloud sync tokens. This ensures credentials never leak
between projects. The file is created with mode `0o600` and is gitignored by default.

You can also set the credential via the `AIDIMAG_TICKET_TOKEN` environment variable, which takes
precedence over the config file.

Next: **[Team sync](/guides/team-sync)**.

