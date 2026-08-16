---
layout: home
title: AI Dimag — Verified Memory for AI Coding Agents
description: Give your coding agents persistent, verified memory of your codebase. Claims with evidence that re-runs against the code — so agents stop trusting stale facts.
head:
  - - meta
    - name: keywords
      content: coding agent memory, codebase memory, verified memory, AI coding assistant, Claude Code memory, Cursor memory, GitHub Copilot, MCP, dim CLI, aiDimag, codebase knowledge, stale context detection
  - - meta
    - property: og:title
      content: AI Dimag — Verified Memory for AI Coding Agents
  - - meta
    - property: og:description
      content: Your coding agent forgets your codebase. AIDimag doesn't. Persistent, evidence-backed memory that verifies itself against the code.
  - - meta
    - property: og:url
      content: https://aidimag.com
  - - link
    - rel: canonical
      href: https://aidimag.com

hero:
  name: AI Dimag
  text: Your coding agent forgets your codebase. AIDimag doesn't.
  tagline: Persistent, evidence-backed memory for AI coding agents — every claim is verified against the code, so agents stop trusting stale facts.
  actions:
    - theme: brand
      text: Get started
      link: /getting-started
    - theme: alt
      text: Why AIDimag?
      link: /why-aidimag
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
  <a href="/why-aidimag">Why AIDimag?</a> ·
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

Every AIDimag memory carries **evidence** (a shell check, an anchored commit, a test) that
`dim verify` re-runs against the current repo — automatically, via git hooks, on every pull,
checkout, and rebase. Beliefs that stop being true go **STALE** instead of silently misleading
your AI.

![Remember → Verify → Retrieve → Trust — verification is the difference](/diagram-claim-verify.svg){.dim-diagram}

### See it in action

```sh
# Remember a checkable claim about your codebase
dim remember "All DB access goes through src/db/store.ts" \
  -k CONVENTION -p src/db \
  -e "STATIC_CHECK:grep -rL better-sqlite3 src --include=*.ts"

# Verify it against the current code
dim verify
```

Output:

```
✓ [CONVENTION] All DB access goes through src/db/store.ts
    id=4f3a9c21 status=VERIFIED conf=0.80 scope=src/db
    evidence: STATIC_CHECK(PASS) grep -rL better-sqlite3 src --include=*.ts
```

Now imagine someone imports `better-sqlite3` somewhere it shouldn't be. Run verify again:

```
~ [VERIFIED → STALE] conf 0.80→0.20  All DB access goes through src/db/store.ts
    STATIC_CHECK: FAIL (command exited 1)
```

**The memory noticed the code drifted.** That's the core value — memory that proves itself,
instead of memory you hope is right.

## Built for coding agents

AIDimag works with the tools you already use:

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

## Benchmarks

Built for codebase memory, not chatbot memory. Most AI-memory benchmarks (LoCoMo, LongMemEval,
BEAM) score recall over *conversation histories* — they don't measure whether an agent can
detect when its knowledge of a codebase is no longer true.

| Metric | Result |
|---|---|
| Hybrid Recall@1 | **0.80** |
| Hybrid MRR | **0.85** |
| Staleness detection (broken claims → STALE) | **100%** (4/4) |
| False positives (intact claims wrongly flagged) | **0%** (0/4) |
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

See **[Use cases](/use-cases)** for detailed scenarios, or **[Why AIDimag?](/why-aidimag)** for
the full comparison against other memory systems.

## The 30-second mental model

- You (or your agent) **remember** things as short, checkable claims:
  *"All database access goes through `src/db/store.ts`."*
- AIDimag attaches **evidence** (a command, a commit, a test) and **verifies** it over time.
- When the code changes and a claim no longer holds, it's marked **STALE** so nobody trusts it.
- The most important rules can be **pinned** (never expire) and turned into **guardrails**
  the agent must obey.
- Short-lived session state goes in the **scratchpad** — it expires on its own and never
  pollutes durable memory.
- All of it is fed to your AI tools automatically.

## Open source. Built for developers.

Inspect the implementation. Run it locally. Build on top of it.

```sh
npm install -g aidimag
dim init
```

[**Get started**](/getting-started) · [**View on GitHub**](https://github.com/AiDimag/aidimag) · [**Read the docs**](/introduction)

---

## License

**Open source under the [MIT License](https://github.com/AiDimag/aidimag/blob/main/LICENSE)** — free for any team size, forever. Optional managed sync at [cloud.aidimag.com](https://cloud.aidimag.com) funds the project. See [Pricing & licensing](/pricing) for details.

