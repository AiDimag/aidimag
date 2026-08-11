# Contributing to AI Dimag

Thanks for your interest in contributing! AI Dimag is MIT-licensed open source — the
local-first product (CLI, MCP server, verification, IDE extensions, self-hosted sync) is
developed here. The optional managed sync service at
[cloud.aidimag.com](https://cloud.aidimag.com) funds the project.

## Ways to contribute

- **Bug reports & feature requests** — [open an issue](https://github.com/AiDimag/aidimag/issues).
  For bugs, include your OS, Node version, `dim --version`, and reproduction steps.
- **Docs** — the site in `docs/` is VitePress; typo fixes and clarifications are always welcome.
- **Code** — see below.
- **Security issues** — please do **not** open a public issue. See [Security](#security).

## Development setup

Requirements: **Node 22+** and git.

```sh
git clone git@github.com:AiDimag/aidimag.git
cd aidimag
npm install
npm run build        # compile TypeScript to dist/
npm test             # node --test against dist/test/
```

Useful entry points:

| Path | What it is |
|---|---|
| `src/cli/` | The `dim` CLI (commander) — commands live in `src/cli/commands/` |
| `src/db/` | `MemoryStore` (better-sqlite3) + schema/migrations |
| `src/mcp/server.ts` | The MCP server (tools, prompts, resources) |
| `src/verify/` | Evidence engine, git hooks, decay |
| `src/capture/` | Commit/PR mining, harvest, session briefing/extraction |
| `src/embeddings/` | Hybrid FTS + vector recall |
| `src/sync/` | Team sync client; `dim serve` server |
| `vscode-extension/` | VS Code extension (plain CommonJS, no build step) |
| `intellij-plugin/` | IntelliJ plugin (Kotlin/Gradle) |
| `docs/` | VitePress documentation site |

Run your local build against a scratch repo:

```sh
mkdir /tmp/play && cd /tmp/play && git init
node /path/to/aidimag/dist/cli/index.js init
```

## Project principles

Please keep these in mind — PRs that fight them are unlikely to land:

1. **Claim-and-verify.** Memories are falsifiable claims with evidence, re-checked
   against the current repo. Features should strengthen verification, not bypass it.
2. **Human-gated capture.** Nothing enters durable memory without review. New capture
   channels must end in the proposal queue, not write memories directly.
3. **Local-first.** One SQLite file per repo; no feature may *require* a network service.
4. **Security of shared state.** Anything that arrives via sync and could execute code
   goes through the evidence trust gate. Never weaken it.
5. **Degrade gracefully.** No embedding provider, no LLM, no `gh` CLI — everything must
   still work (keyword-only search, heuristic mining, etc.).

## Making changes

1. Fork and create a topic branch from `main`.
2. Make your change. Match the existing style (TypeScript ESM, 2-space indent,
   `better-sqlite3` prepared statements, comments explain *why* not *what*).
3. **Add or update tests** in `src/test/` (`node --test`; see existing files for the
   pattern — temp-dir stores, no mocking frameworks).
4. **Schema changes**: bump `SCHEMA_VERSION` in `src/db/schema.ts`. Additive columns go
   in `MIGRATIONS` (idempotent `ALTER TABLE`); CHECK-constraint changes need a guarded
   rebuild block gated on the stored version (see `MEMORIES_REBUILD_V8`).
5. **New CLI commands / MCP tools**: update `docs/cli-reference.md` / `docs/mcp.md`, and
   consider parity in the VS Code + IntelliJ extensions.
6. Run the checks:
   ```sh
   npx tsc --noEmit && npm run build && npm test
   ```
7. Open a PR with a clear description of *what* and *why*. Small, focused PRs review
   fastest.

## Commit style

Conventional-ish prefixes are appreciated: `feat:`, `fix:`, `docs:`, `test:`,
`refactor:`, `chore:`. A body explaining the reasoning helps future archaeology —
this project eats its own dog food and mines commits for memory proposals.

## Security

If you find a vulnerability (especially anything touching the evidence trust gate,
sync auth, or shell execution), email the maintainer or use
[GitHub private vulnerability reporting](https://github.com/AiDimag/aidimag/security/advisories/new)
instead of a public issue. We'll acknowledge within a few days.

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](./LICENSE).

