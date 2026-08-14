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

---

<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:24px 0 8px;">
  <a href="https://www.npmjs.com/package/aidimag" target="_blank" rel="noopener"><img src="https://img.shields.io/npm/v/aidimag?color=blue&logo=npm" alt="npm version"></a>
  <a href="https://github.com/AiDimag/aidimag/actions/workflows/ci.yml" target="_blank" rel="noopener"><img src="https://github.com/AiDimag/aidimag/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
  <a href="https://github.com/AiDimag/aidimag" target="_blank" rel="noopener"><img src="https://img.shields.io/github/stars/AiDimag/aidimag?style=flat&logo=github&color=blue" alt="GitHub stars"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=aidimag.aidimag-vscode" target="_blank" rel="noopener"><img src="https://img.shields.io/badge/VS%20Code-v1.0.6-blue?logo=visualstudiocode" alt="VS Code Marketplace"></a>
  <a href="https://plugins.jetbrains.com/plugin/33030-ai-dimag" target="_blank" rel="noopener"><img src="https://img.shields.io/jetbrains/plugin/v/33030?label=JetBrains&logo=jetbrains&color=blue" alt="JetBrains Marketplace"></a>
  <a href="https://registry.modelcontextprotocol.io/?q=aidimag" target="_blank" rel="noopener"><img src="https://img.shields.io/badge/MCP-Registry-6366f1?logo=modelcontextprotocol" alt="MCP Registry"></a>
  <a href="https://glama.ai/mcp/servers/AiDimag/aidimag" target="_blank" rel="noopener"><img src="https://glama.ai/mcp/servers/AiDimag/aidimag/badges/score.svg" alt="aidimag MCP server"></a>
  <a href="https://www.producthunt.com/products/ai-dimag?utm_source=other&utm_medium=social" target="_blank" rel="noopener"><img src="https://img.shields.io/badge/Product%20Hunt-AI%20Dimag-da552f?logo=producthunt&logoColor=white" alt="Product Hunt"></a>
  <a href="https://github.com/AiDimag/aidimag/blob/main/LICENSE" target="_blank" rel="noopener"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
</div>

<p style="text-align:center;margin:0 0 8px;">
  <a href="https://github.com/AiDimag/aidimag" target="_blank" rel="noopener">GitHub</a> ·
  <a href="https://www.npmjs.com/package/aidimag" target="_blank" rel="noopener">npm</a> ·
  <a href="/benchmarks">Benchmarks</a> ·
  <a href="/comparison">Comparison</a> ·
  <a href="/cli-reference">CLI reference</a> ·
  <a href="/mcp">MCP</a> ·
  <a href="/ide-extensions">IDE extensions</a> ·
  <a href="https://cloud.aidimag.com" target="_blank" rel="noopener">Cloud</a>
</p>

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

