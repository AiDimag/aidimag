# Cloud Sync Setup

**Goal:** sync a shared team brain through **AI Dimag Cloud** while agents read **local** memory (fast, offline) and changes replicate in the background.

::: tip Prerequisites
This guide assumes you've already installed the CLI (`npm install -g aidimag`) and run `dim init` in your repo. See [Getting started](/getting-started) if you haven't.
:::

::: tip Local-first
Agents always query your local SQLite copy. Cloud is sync only — not a remote database you search over the network.
:::

## At a glance

| Step | Who | What |
|------|-----|------|
| 1 | Once (you) | Sign up at cloud.aidimag.com → create project → get API key |
| 2 | Per repo | `dim cloud link` → `dim sync` |
| 3 | Daily | Sync to cloud (auto-sync runs too) |
| 4 | Teammates | Clone repo → `dim cloud link` → `dim sync` |

---

## 1. Create your cloud account

1. Go to **[cloud.aidimag.com](https://cloud.aidimag.com)**
2. **Sign up** with email/password or GitHub
3. **Create a new project** — one project = one shared **brain** for your team
4. In your project → **Keys** tab → **Create API key** → copy the `aidimag_sk_…` token (shown once)

::: tip Free tier limits
The free tier includes **100 memories**, **1 API key**, and **1 sync per minute**. Perfect for trying cloud sync! Upgrade to a paid plan for unlimited memories and sync frequency. See [Pricing](/pricing) for details.
:::

::: warning Keep your API key secret
The token is stored per-project in `.aidimag/config.json`. Add this file to `.gitignore` to keep tokens private (done automatically by `dim init`). Each team member gets their own key from the dashboard.
:::

::: tip Self-hosting?
If you're running your own AI Dimag Cloud instance instead of using cloud.aidimag.com, see [Team sync (self-hosted)](/guides/team-sync) for deployment instructions.
:::

---

## 2. Link to cloud

Use the brain ID and API key from your dashboard:

```sh
dim cloud link \
  --server https://cloud.aidimag.com \
  --brain YOUR_BRAIN_ID \
  --token aidimag_sk_...

dim sync
```

- **`.aidimag/config.json`** stores server URL, brain ID, and token
- **Gitignored by default** — `dim init` adds `config.json` to `.aidimag/.gitignore`

Verify the connection:

```sh
dim cloud status
dim cloud remote --summary
```

You should see memory counts (server vs local) and pending proposals.

---

## 3. Sync to cloud

![Dashboard showing cloud sync status with brain icon and connected server](/screenshots/dim-sync.png)
*Cloud sync status: the dashboard shows the connected server, brain name, and sync state at a glance.*

Sync runs **automatically** (~30s debounce) after `dim remember`, `dim review`, `dim verify`, `dim refute`, and `dim forget`. Disable with `AIDIMAG_AUTO_SYNC=off`.

Manual sync when you want to be sure:

```sh
dim sync              # incremental
dim sync --full       # re-upload everything (after server reset / cursor issues)
```

::: tip Free tier quota
If you hit the 100 memory limit, `dim sync` will prompt you to select which memories to sync. Updates to already-synced memories always work, even at the limit. See [FAQ - Cloud quotas](/faq#cloud-quotas-aidimag-cloud) for details.
:::

---

## 4. Onboard a teammate

They clone the repo (config already has server + brain ID):

```sh
git clone … && cd your-app
dim init
dim cloud link --server https://cloud.aidimag.com --brain YOUR_BRAIN_ID --token aidimag_sk_…
dim sync
```

Each person gets their own API key from the dashboard (don’t share keys). Their machine pulls the full team brain into local SQLite.

---

## 5. Useful cloud checks

| Command | What it tells you |
|---------|-------------------|
| `dim cloud status` | Linked server + brain |
| `dim cloud remote --summary` | Remote vs local counts |
| `dim cloud remote --proposals` | Pending proposals on server |
| `dim proposals gc` | Remove legacy resolved proposal rows locally, then `dim sync` |

---

## Troubleshooting (quick)

| Symptom | Fix |
|---------|-----|
| `connection refused` on sync | Check server URL in `.aidimag/config.json` — should be `https://cloud.aidimag.com` (or your self-hosted URL) |
| `nothing to send` but local has data | `dim sync --full` |
| Remote shows old proposal count | `dim proposals gc` then `dim sync` |
| Debug detail | `AIDIMAG_DEBUG=1 dim sync` |

More: [FAQ](/faq) · [Configuration](/configuration) · [Team sync (self-hosted)](/guides/team-sync)

---

Next: **[CLI reference](/cli-reference)**.
