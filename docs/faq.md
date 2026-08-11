---
title: FAQ & Troubleshooting | aiDimag Help & Common Questions
description: Frequently asked questions about aiDimag. Get answers about privacy, API keys, compatibility, troubleshooting, and common issues.
head:
  - - meta
    - name: keywords
      content: aiDimag FAQ, troubleshooting, common questions, help, support, aiDimag issues, dim problems, setup help
  - - meta
    - property: og:title
      content: FAQ & Troubleshooting - aiDimag Help
  - - meta
    - property: og:url
      content: https://aidimag.com/faq
  - - link
    - rel: canonical
      href: https://aidimag.com/faq
---

# FAQ & troubleshooting

## General

### Is aiDimag tied to a specific AI tool?
No. It works with any [MCP](/mcp)-capable agent (Claude Code, Cursor, Copilot), and for tools
that don't speak MCP it generates `CLAUDE.md` / `.cursorrules` / `copilot-instructions.md`.

### Does it send my code anywhere?
No. Everything is local by default — a SQLite file in `.aidimag/`. The only network traffic is
optional: an embedding provider (if you enable semantic search) and the team sync server (if
you set one up).

### Do I need an API key?
No. aiDimag works fully offline with keyword search. An `OPENAI_API_KEY` or local Ollama
unlocks the optional smart features: *semantic* search plus LLM-powered capture
(`dim bootstrap`, `dim mine --llm`, `dim harvest`, knowledgebase summarization).

### Will it eat a lot of memory/CPU?
The CLI and extensions are tiny. The only real consumer is the optional `dim ui` dashboard
(a small Node process), which you start and stop yourself.

## Setup

### `dim: command not found`
The CLI isn't on your `PATH`. Install globally (`npm i -g aidimag`) or, from source,
`npm run build && npm link`. You can also run it via `npx aidimag <command>`.

### The IntelliJ/VSCode extension says it can't find `dim`
IDEs launched from the OS GUI sometimes have a minimal `PATH`. Make sure `dim` is installed
**globally** so GUI apps can find it. See [IDE extensions](/ide-extensions).

### Git hooks didn't install
`dim init` only installs hooks inside a git repository. Run it from the repo root (where
`.git/` lives). Existing hooks are appended to, never overwritten.

## Memory & verification

### Why is my memory stuck on "unverified"?
It has no machine-checkable evidence, or you haven't run `dim verify`. Add a `STATIC_CHECK`
and verify — see [Writing claims & evidence](/guides/claims-and-evidence).

### A memory went stale — what do I do?
A piece of its evidence failed. Decide whether the **code** drifted (fix it and re-verify) or
the **claim** is genuinely outdated (refute or rewrite it). See
[Verifying memories](/guides/verifying).

### My memory's confidence keeps dropping even though nothing's wrong.
Memories without machine-checkable evidence **decay** over time by design. Attach evidence so
it re-verifies itself, or **pin** it if it's foundational and shouldn't expire.

### What's the difference between `refute` and `forget`?
`refute` keeps the memory as *negative knowledge* ("we believed this until it stopped being
true"). `forget` deletes it entirely. Prefer `refute`.

### Why didn't my agent's learning show up immediately?
Agent-proposed and mined memories enter the [review queue](/guides/review-queue) first. Run
`dim review` to approve them.

## Capture

### `dim bootstrap` / `dim mine --llm` says "no LLM provider available"
These features synthesize claims with a text LLM. Run [Ollama](https://ollama.com) locally
(auto-detected) or set `OPENAI_API_KEY`. You can force a provider with
`AIDIMAG_LLM=openai|ollama|off`.

### `dim mine --prs` doesn't find anything
PR mining needs the [`gh` CLI](https://cli.github.com) installed and authenticated
(`gh auth status`), plus an LLM provider. It only scans PRs merged since the last run —
use `dim mine --prs --full` to rescan everything.

### A teammate's memory says its evidence was "skipped (untrusted)"
That's the security trust gate: evidence commands that arrive via team sync never execute
until you inspect and approve them with `dim verify --trust`. See the
[CLI reference](/cli-reference#dim-verify).

## Context files

### My `CLAUDE.md` changes were overwritten.
`dim generate-context` owns that file — don't edit it by hand. Edit the underlying memory and
regenerate. Turn on `--auto` so it stays current automatically.

### A stale fact isn't in my generated context — is that a bug?
No, that's intended. Generated files exclude stale and refuted memories so tools never read
knowledge you can't currently trust.

## Team sync

### Two machines edited the same memory — who wins?
Last-writer-wins by modification time. Deletions propagate via tombstones. For verification,
the server aggregates results across machines into consensus.

### I don't want to share the admin token with the team.
Don't — mint brain-scoped member keys with `dim keys create`, or use `dim login`. See
[Team sync](/guides/team-sync).

## Cloud quotas (aiDimag Cloud)

### I hit the 100 memory limit on the free tier. What happens?
When you reach the limit, `dim sync` will prompt you to choose which memories to sync:
- **Sync newest 100** — Most recently created/updated
- **Sync verified only** — Only VERIFIED status memories
- **Let me select** — Choose specific memories

Updates to already-synced memories always work, even at the limit. Only new memories are restricted.

### Can I sync more than 100 memories on the free tier?
No, the free tier is limited to 100 memories in the cloud. You can have unlimited memories locally,
but only 100 will sync. Upgrade to a paid plan for more:
- **Starter ($5/mo):** 1,000 memories
- **Developer ($15/mo):** 10,000 memories
- **Team ($50/mo):** 50,000 memories

### What if I have 1000 local memories but only 100 can sync?
You'll see a selection prompt when you run `dim sync`. Choose which 100 memories are most important
to sync with your team. The rest stay local on your machine. You can change your selection anytime.

### Do updates count against the quota?
No! Updates to already-synced memories bypass the quota. The limit only applies to new memories
you haven't synced before. This means you can always fix or update existing team knowledge.

### What happens if I upgrade to a paid plan?
After upgrading, run `dim sync` and it will automatically detect your new plan and offer to sync
all remaining memories. No data is lost — everything that was local-only will sync to the cloud.

### Does the rate limit (1 sync/min) apply to all syncs?
Yes, on the free tier you can sync once per minute. Paid plans have unlimited sync frequency.
Auto-sync respects this limit automatically.

### I'm self-hosting aiDimag Cloud. How do I disable quotas?
If you're running your own aiDimag Cloud instance, you can set unlimited quotas for all users:

```sql
-- Set unlimited memory for all users
UPDATE subscriptions SET memory_limit = NULL;

-- Or set custom limits per user
UPDATE subscriptions 
SET memory_limit = 10000 
WHERE user_id = 'your-user-id';
```

Alternatively, disable the billing feature entirely in your server configuration. See the server documentation for details.

## Still stuck?

- `dim <command> --help` shows usage for any command.
- Run the failing command with `AIDIMAG_DEBUG=1` — best-effort features (auto-sync,
  embeddings, LLM mining) fail silently by design; debug mode prints every swallowed error.
- Check `dim status` to see the store's health at a glance.
- Open `dim ui` for a visual view of memories, proposals, and the graph.

