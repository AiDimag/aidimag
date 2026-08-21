# Team sync

By default aiDimag is single-player: memory lives in a local SQLite file. To share a **team
brain** for a repo, use **aiDimag Cloud** (hosted) or run your own sync server.

::: tip Cloud sync one-pager
For the hosted dashboard + API key flow, see **[Cloud sync TLDR](/cloud-quickstart)**.
This page covers the **self-hosted** `dim serve` option.
:::

![Team sync architecture: each developer keeps a full local replica; dim serve is a dumb ordered log; synced-in evidence is gated behind dim verify --trust](/diagram-team-sync.svg){.dim-diagram}

## The model

- **Local-first.** Everyone still reads/writes their own local replica; nothing blocks on the
  network.
- **`dim sync` exchanges changes** — last-writer-wins by modification time, with tombstones so
  deletions propagate.
- **The server is a dumb ordered log.** All the smart merging, verification, and ranking stay
  on each client. The future hosted version uses this same protocol.

## Set up a server

### Quick start (local testing)

Run it anywhere reachable — a laptop, a VPS, Fly.io:

```sh
dim serve --token <shared-secret> --db ./team-sync.db --port 8787
```

### Remote deployment

Deploy the sync server using Docker on any host (Railway, Render, VPS, Fly.io, etc.).

```sh
npm run build
docker build -f deploy/Dockerfile -t aidimag-sync .
docker run -d -p 8787:8787 -v aidimag_data:/data \
  -e AIDIMAG_SYNC_TOKEN=<admin-token> aidimag-sync
```

**Important:** Put HTTPS in front (Caddy/Traefik/cloud load balancer) before real use — tokens travel as Bearer headers.

#### Deployment files

The `deploy/` directory contains:
- **`Dockerfile`** — Container image for the sync server
- **`fly.toml`** — Fly.io configuration
- **`README.md`** — Detailed deployment instructions

::: tip Security note
The `AIDIMAG_SYNC_TOKEN` is your admin token. Store it securely (password manager, secrets vault). Never commit it to the repository. Use this token to mint brain-scoped keys for team members (see API keys section below).
:::

## Link a repo

Each team member, inside the repo:

```sh
dim cloud link --server http://your-server:8787 --brain myrepo --token <shared-secret>
dim sync
```

The server URL, brain name, and **token** all go in `.aidimag/config.json`. This file is **gitignored by default** (`dim init` adds it to `.aidimag/.gitignore`). So onboarding a teammate is:

```sh
dim init
dim cloud link --token <secret>
dim sync
```

## Automatic sync

Sync also runs **automatically** (debounced, ~30s) after `remember`, `review`, `verify`,
`refute`, and `forget`. Disable it with `AIDIMAG_AUTO_SYNC=off`.

## Device login instead of pasting tokens

```sh
dim login
```

Shows a short code, opens the server's approval page, and an existing credential approves the
device. The minted token inherits that approver's brain scope and is revocable. `dim logout`
clears it.

## API keys (don't share the admin token)

The `--token` you start the server with is the **admin** token. Mint revocable, brain-scoped
member keys instead of sharing it:

```sh
AIDIMAG_ADMIN_TOKEN=... dim keys create --brain myrepo --label alice
# → aidimag_sk_...  (only valid for that brain)

dim keys list --brain myrepo
dim keys revoke --key aidimag_sk_...
```

## Cross-machine consensus

Every memory-lifecycle change (create / status / evidence / verification) is recorded in a
local append-only **event log** and shipped on sync. The server aggregates verification
reports across machines, so you can answer: *"How many machines confirm this memory passes at
commit X?"* — turning one developer's green check into team-wide confidence.

## Security

- **Evidence trust gate** — synced-in memories can carry executable evidence (shell
  commands). Those are **never executed on your machine** until you inspect and approve
  them once with `dim verify --trust`; until then verification simply skips them. Evidence
  you wrote or approved locally is trusted automatically. See
  [Verifying memories](/guides/verifying#evidence-trust-gate-team-sync).
- **Credentials are hashed at rest** — the server stores only SHA-256 hashes of API keys
  and account tokens (existing plaintext rows are migrated automatically). `dim keys list`
  shows fingerprints, not secrets.
- **Rate limiting** — the unauthenticated device-login endpoints are limited per IP, so
  short user codes can't be brute-forced.
- **Generic errors** — the server never leaks internal error details to clients; specifics
  go to the server log only.

## aiDimag Cloud

Prefer a managed sync server? [cloud.aidimag.com](https://cloud.aidimag.com) runs the
sync protocol for you — no infrastructure, no Docker, just an API key. Create a project,
invite teammates, and everyone gets a shared brain with automatic sync.

<!-- TODO: add /screenshots/cloud-showcase.webm and cloud-showcase.mp4, then add <source> tags back -->
<!-- <video autoplay loop muted playsinline poster="/screenshots/placeholder.svg" style="width:100%;border-radius:0.875rem;border:1px solid hsl(var(--aid-border,214 28% 90%) / 0.6);box-shadow:0 0 0 1px rgba(37,99,235,0.06),0 8px 32px rgba(37,99,235,0.06);margin:24px 0;">
</video>
*A tour of cloud.aidimag.com: homepage, dashboard, creating a project, browsing memory, managing API keys, and connecting ticketing.* -->

### Homepage

![cloud.aidimag.com homepage with hero section and feature highlights](/screenshots/cloud-homepage.png)
*The cloud homepage — sign in or create an account to get started.*

### Dashboard

![Cloud dashboard showing project list and team overview](/screenshots/cloud-dashboard.png)
*The dashboard: all your projects at a glance, with memory counts and sync status.*

### Create a new project

![Create new project dialog with brain name and server selection](/screenshots/cloud-create-project.png)
*Creating a new project: name your brain, choose a server region, and get an API key instantly.*

### Project page

![Project page showing memory stats, team members, and sync timeline](/screenshots/cloud-project-page.png)
*The project page: memory stats, team members, and a live sync timeline.*

### API keys

![API keys management page with create, list, and revoke actions](/screenshots/cloud-api-keys.png)
*API keys: mint revocable, brain-scoped keys for each teammate. Never share the admin token.*

### Memory browser

![Cloud memory browser showing memories with kind, status, and confidence](/screenshots/cloud-memory-browser.png)
*The cloud memory browser: search and filter all team memories by kind, status, and scope.*

### Ticketing

![Cloud ticketing page showing connected provider and shared credentials](/screenshots/cloud-ticketing.png)
*Ticketing in the cloud: the admin connects a provider and shares credentials with the team via Remote mode.*

::: tip Get started
Visit [cloud.aidimag.com](https://cloud.aidimag.com) to create your team brain. Then link
your repo with `dim cloud link` and run `dim sync` — that's it.
:::

## Check status

```sh
dim cloud status
```

Next: **[Knowledgebase](/guides/knowledgebase)**.

