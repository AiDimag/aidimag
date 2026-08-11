---
layout: home
title: AI Dimag - Verified Memory for AI Coding Agents
description: Your codebase remembers its decisions, conventions, gotchas, and rules — and proves they're still true. Open source under the MIT license.
head:
  - - meta
    - name: keywords
      content: AI coding assistant, AI memory, verified memory, coding agent, Claude Code, Cursor, GitHub Copilot, MCP, dim CLI, aiDimag, codebase memory
  - - meta
    - property: og:title
      content: AI Dimag - Verified Memory for AI Coding Agents
  - - meta
    - property: og:description
      content: Your codebase remembers its decisions, conventions, gotchas, and rules — and proves they're still true.
  - - meta
    - property: og:url
      content: https://aidimag.com
  - - link
    - rel: canonical
      href: https://aidimag.com

hero:
  name: AI Dimag
  text: Verified memory for AI coding agents
  tagline: Your codebase remembers its decisions, conventions, gotchas, and rules — and proves they're still true.
  image:
    src: /hero-illustration.svg
    alt: The aiDimag memory loop — remember, verify, flag stale facts, deliver to AI tools
  actions:
    - theme: brand
      text: Get started
      link: /getting-started
    - theme: alt
      text: What is aiDimag?
      link: /introduction
    - theme: alt
      text: Pricing
      link: /pricing

features:
  - icon: 🧠
    title: Never explain your codebase twice
    details: Your coding agent remembers the architecture decisions, conventions, invariants, gotchas, and dead ends your team already worked through — every session starts where the last one left off, not from a cold repo scan.
  - icon: ✅
    title: Claim-and-verify, not store-and-retrieve
    details: Every memory is a falsifiable claim with evidence — a shell check, an anchored commit, a test. Git hooks re-verify on every pull and rebase; claims the code has outgrown flip to STALE instead of silently misleading your agent.
  - icon: 🚦
    title: Guardrails your agent must respect
    details: Encode engineering rules as never / ask-first / always guardrails. They surface in every session briefing, ground the memory_critique second-critic, and dim check can block a violating commit before it lands.
  - icon: 🔌
    title: Wired into your development tools
    details: Live MCP tools for Claude Code, Cursor, and Copilot — plus generated CLAUDE.md, .cursorrules, and copilot-instructions.md for everything else. VS Code and IntelliJ extensions, git-hook capture, ticket integration.
  - icon: 👥
    title: Local-first, team-ready
    details: One SQLite file in your repo — no account, no cloud required. Scale to a team with a self-hosted sync server, brain-scoped API keys, and cross-machine verification consensus.
  - icon: 🔒
    title: Engineered for repo security
    details: Nothing enters memory without human review. Shell-command evidence that arrives via team sync is never executed until you inspect and approve it — a teammate's memory can't become code execution on your machine.
---

## In one sentence

**aiDimag is a memory system for software engineering**: it gives AI coding agents a
long-term memory of your codebase that is **checked against reality** — so they stop
re-discovering the same things, and stop trusting facts the code has since outgrown.

It is not a general-purpose "AI memory" app. The subject of memory is your *repository* —
not your preferences, not your conversations — and every capability (evidence, git-hook
verification, guardrails, pre-commit checks, path-scoped recall) exists to serve
day-to-day development work. See **[how aiDimag compares](/comparison)** to other memory
systems.

## The 30-second mental model

- You (or your agent) **remember** things as short, checkable claims:
  *"All database access goes through `src/db/store.ts`."*
- aiDimag attaches **evidence** (a command, a commit, a test) and **verifies** it over time.
- When the code changes and a claim no longer holds, it's marked **stale** so nobody trusts it.
- The most important rules can be **pinned** (never expire) and turned into **guardrails**
  the agent must obey.
- Short-lived session state goes in the **scratchpad** — it expires on its own and never
  pollutes durable memory.
- All of it is fed to your AI tools automatically.

Head to **[Getting started](https://aidimag.com/getting-started)** to set it up in your repo, or read
**[What is aiDimag?](https://aidimag.com/introduction)** for the why.

---

## License

**Open source under the [MIT License](https://github.com/AiDimag/aidimag/blob/main/LICENSE)** — free for any team size, forever. Optional managed sync at [cloud.aidimag.com](https://cloud.aidimag.com) funds the project. See [Pricing & licensing](/pricing) for details.

