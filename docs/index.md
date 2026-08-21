---
layout: home
title: AI Dimag — Cross-Agent Trust Layer for Coding Agents
description: One verified knowledge layer for every coding agent your team uses. Detect stale assumptions, enforce engineering rules, and stop agents from repeating known mistakes.
head:
  - - meta
    - name: keywords
      content: coding agent memory, codebase memory, verified memory, AI coding assistant, Claude Code memory, Cursor memory, GitHub Copilot, MCP, dim CLI, AI Dimag, codebase knowledge, stale context detection
  - - meta
    - property: og:title
      content: AI Dimag — Cross-Agent Trust Layer for Coding Agents
  - - meta
    - property: og:description
      content: Your coding agents remember. AI Dimag makes sure they remember correctly. One verified knowledge layer for every coding agent your team uses.
  - - meta
    - property: og:url
      content: https://aidimag.com
  - - link
    - rel: canonical
      href: https://aidimag.com

hero:
  name: AI Dimag
  text: Your coding agents remember. AI Dimag makes sure they remember correctly.
  tagline: One verified knowledge layer for every coding agent your team uses. Detect stale assumptions, enforce engineering rules, and stop agents from repeating known mistakes.
  actions:
    - theme: brand
      text: Try interactive demo
      link: /demo
    - theme: alt
      text: Install locally
      link: /getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/AiDimag/aidimag

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
  <a href="/why-aidimag">Why AI Dimag?</a> ·
  <a href="/use-cases">Use cases</a> ·
  <a href="/benchmarks">Benchmarks</a> ·
  <a href="/comparison">Comparison</a> ·
  <a href="/mcp">MCP</a> ·
  <a href="/cli-reference">CLI reference</a> ·
  <a href="https://cloud.aidimag.com" target="_blank" rel="noopener">Cloud</a>
</p>

## The problem: AI coding agents forget

Every new session starts from zero. Your coding agent:

- Re-discovers the same architecture you explained yesterday
- Repeats approaches your team already tried and abandoned
- Confidently follows a "convention" that was true six months ago but isn't anymore
- Has no idea which rules are sacred ("never call the production API from a test")

Teams try to fix this with a big `CLAUDE.md` or a wiki, but those rot. Nobody updates them,
and worse — **nothing checks whether what they say is still true.** A stale instruction is
more dangerous than no instruction, because the agent trusts it.

## The solution: claim-and-verify, not store-and-retrieve

Most memory systems **store** text and **retrieve** whatever is similar later — a stored fact
is assumed true forever. That's dangerous in a codebase, where a confidently-retrieved stale
fact is *worse* than no memory at all.

Every AI Dimag memory carries **evidence** (a shell check, an anchored commit, a test) that
`dim verify` re-runs against the current repo — automatically, via git hooks, on every pull,
checkout, and rebase. Beliefs that stop being true go **STALE** instead of silently misleading
your AI.

![Remember → Verify → Retrieve → Trust — verification is the difference](/diagram-claim-verify.svg){.dim-diagram}

### See it in action

```sh
dim remember "All DB access goes through src/db/store.ts" \
  -k CONVENTION -p src \
  -e "STATIC_CHECK:! grep -rl better-sqlite3 src --include=*.ts | grep -v store.ts"

dim verify
```

When someone imports `better-sqlite3` outside `store.ts`, the next `dim verify` flips the
claim to **STALE** — the memory noticed the code drifted. That's the core value: memory that
proves itself, instead of memory you hope is right.

![Dashboard overview showing memory browser, stat cards, memory graph, and health metrics](/screenshots/dashboard-overview.png)
*The web dashboard: memory browser with trust badges, stat cards, and force-directed memory graph.*

### Your team already learned this lesson. Your agent shouldn't repeat it.

When an agent attempts something your team already tried and reverted, AI Dimag's
`FAILED_APPROACH` memories fire **before** the work happens:

```text
Attempt detected:
  Add automatic retries to declined payments

Related lesson:
  A similar implementation was reverted in PR #417 because it created
  duplicate ledger entries.

Recommendation:
  Add idempotency protection before retrying.
```

This is the difference between an agent that *remembers* and one that *remembers correctly* —
it doesn't just recall what was done, it recalls what **didn't work** and why.

### Try the interactive demo

Want to see the full workflow without installing anything? Try our [interactive demo →](/demo) —
a simulated walkthrough showing remember → verify → check → staleness detection in action.

## Built for coding agents

AI Dimag works with the tools you already use:

| Tool | How |
|---|---|
| **Claude Code** | [MCP server](/mcp) — live memory search, proposals, and critique |
| **Cursor** | MCP server or generated `.cursorrules` |
| **GitHub Copilot** | Generated `.github/copilot-instructions.md` |
| **Windsurf** | Generated `.windsurfrules` |
| **Hermes Agent** | `dim hermes install` — native Hermes memory provider via MCP bridge |
| **Any tool** | `dim generate-context --format all` writes static context files |

Two delivery channels so *every* tool benefits:

- **MCP server** (`dim mcp`) — agents that speak the Model Context Protocol get live memory
  search, session briefings, and critique during a session.
- **Generated context files** — `dim generate-context` writes `CLAUDE.md`, `.cursorrules`,
  `AGENTS.md`, and `.github/copilot-instructions.md` from your trusted memory, for tools that
  just read a file at startup. With `--auto`, these regenerate whenever memory changes.

## Integrations

### AI Agent Integrations

<style>
.integration-logos { display:flex;flex-wrap:wrap;gap:20px;justify-content:center;align-items:center;margin:24px 0; }
.integration-logos .ic-tooltip { position:relative;display:inline-flex;align-items:center; }
.integration-logos .ic-tooltip img { height:32px;transition:transform 0.15s ease; }
.integration-logos .ic-tooltip:hover img { transform:scale(1.12); }
.integration-logos .ic-tooltip::after {
  content: attr(data-name);
  position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%);
  background: hsl(222 47% 11%); color: #fff;
  padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 500;
  white-space: nowrap; pointer-events: none;
  opacity: 0; transition: opacity 0.15s ease; z-index: 10;
}
.integration-logos .ic-tooltip:hover::after { opacity: 1; }
.dark .integration-logos .ic-dark-invert { filter: invert(1); }
.dark .integration-logos .ic-tooltip::after { background: hsl(210 40% 98%); color: hsl(222 47% 11%); }
</style>
<div class="integration-logos">
  <span class="ic-tooltip" data-name="Claude Code"><img src="https://api.iconify.design/simple-icons:anthropic.svg?color=%23D97757" alt="Claude (Anthropic)"></span>
  <span class="ic-tooltip" data-name="Cursor"><img src="https://api.iconify.design/simple-icons:cursor.svg?color=%231F6FFF" alt="Cursor"></span>
  <span class="ic-tooltip" data-name="GitHub Copilot"><img src="https://api.iconify.design/simple-icons:githubcopilot.svg?color=%23000000" class="ic-dark-invert" alt="GitHub Copilot"></span>
  <span class="ic-tooltip" data-name="Windsurf"><img src="https://api.iconify.design/simple-icons:windsurf.svg?color=%231F6FFF" alt="Windsurf"></span>
  <span class="ic-tooltip" data-name="Model Context Protocol"><img src="https://api.iconify.design/simple-icons:modelcontextprotocol.svg?color=%236366f1" alt="MCP"></span>
  <span class="ic-tooltip" data-name="Ollama (local LLM)"><img src="https://api.iconify.design/simple-icons:ollama.svg?color=%23000000" class="ic-dark-invert" alt="Ollama"></span>
  <span class="ic-tooltip" data-name="OpenAI"><img src="https://api.iconify.design/simple-icons:openai.svg?color=%23412993" alt="OpenAI"></span>
  <span class="ic-tooltip" data-name="AWS Bedrock"><img src="https://api.iconify.design/simple-icons:amazonaws.svg?color=%23FF9900" alt="AWS Bedrock"></span>
  <span class="ic-tooltip" data-name="VS Code Extension"><img src="/integrations/vscode.svg" alt="VS Code"></span>
  <span class="ic-tooltip" data-name="JetBrains Extension"><img src="https://api.iconify.design/simple-icons:jetbrains.svg?color=%23FF0000" alt="JetBrains"></span>
</div>

### Ticketing Integrations

Connect your ticketing system so the *why* behind commits flows into memory. AI Dimag supports
12 built-in providers, custom HTTP middleware, and team-shared Remote mode:

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

Credentials are stored **per-repo** in `.aidimag/config.json`, which is automatically added to
`.gitignore` so it won't be committed accidentally. Tokens are never shared between projects.
One admin can share credentials via the team sync server (`dim ticket share`); teammates
connect via **Remote** mode with zero local credentials. Environment variables are also
supported as an alternative to file-based config. See
**[Connecting tickets](/guides/tickets)** for the full security guide.

## Web dashboard

Prefer clicking over typing? `dim ui` starts a local web app with a memory browser, review
queue, memory graph, health metrics, ticket management, model settings, and guided
onboarding.

See **[Web dashboard](/dashboard)** for the full feature list.

## Benchmarks

Built for codebase memory, not chatbot memory. Most AI-memory benchmarks (LoCoMo, LongMemEval,
BEAM) score recall over *conversation histories* — they don't measure whether an agent can
detect when its knowledge of a codebase is no longer true.

| Metric | Result |
|---|---|
| Hybrid Recall@1 | **0.80** |
| Hybrid MRR | **0.85** |
| Staleness detection | All 4 broken claims detected, 0 false flags across 4 intact claims |
| FTS keyword search (10,000 memories) | 1.45ms p50 |
| Vector KNN (768-dim, sqlite-vec) | 4.15ms p50 |
| Memory writes (transactional) | ~5,400/s |
| CLI cold start | ~41ms p50 |

Full methodology and raw data: **[Benchmarks](/benchmarks)** · Reproduce with `npm run bench` and `npm run bench:quality`.

## Use cases

- **Architecture memory** — Remember why the system is structured the way it is. Stop
  re-explaining the same design decisions every session.
- **Project conventions** — Remember repository-specific coding patterns and rules. Enforce
  them with [guardrails](/guides/guardrails) and pre-commit `dim check`.
- **Technical decisions** — Preserve architectural decisions and rejected alternatives so
  nobody retries a dead end.
- **Cross-session knowledge** — Give coding agents knowledge that survives individual
  conversations. Session-start briefings pull in relevant memory automatically.
- **Staleness detection** — Know when previously remembered information is no longer true.
  Evidence re-runs on every pull and checkout.
- **Large codebases** — Help agents navigate repositories where understanding everything from
  scratch is expensive. Path-scoped recall surfaces only memory relevant to the files being
  edited.

See **[Use cases](/use-cases)** for detailed scenarios, or **[Why AI Dimag?](/why-aidimag)** for
the full comparison against other memory systems.

## Open source. Built for developers.

Inspect the implementation. Run it locally. Build on top of it.

```sh
npm install -g aidimag
dim setup
```

[**Get started**](/getting-started) · [**View on GitHub**](https://github.com/AiDimag/aidimag) · [**Read the docs**](/introduction)

---

## License

**Open source under the [MIT License](https://github.com/AiDimag/aidimag/blob/main/LICENSE)** — free for any team size, forever. Optional managed sync at [cloud.aidimag.com](https://cloud.aidimag.com) funds the project. See [Pricing & licensing](/pricing) for details.

