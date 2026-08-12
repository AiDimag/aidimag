# IDE extensions

aiDimag has native extensions for **VSCode** and **IntelliJ IDEA** so you can browse, add,
and verify memory without leaving your editor. Both shell out to the same `dim` CLI, so they
always behave consistently with the terminal.

::: tip Install the extensions
[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code%20Marketplace-v1.0.6-blue?logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=aidimag.aidimag-vscode)
[![JetBrains Marketplace](https://img.shields.io/jetbrains/plugin/v/33030?label=JetBrains%20Marketplace&logo=jetbrains&color=blue)](https://plugins.jetbrains.com/plugin/33030-ai-dimag)

**[📦 VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=aidimag.aidimag-vscode)** — or search "aiDimag" in the Extensions view.
**[📦 JetBrains Marketplace](https://plugins.jetbrains.com/plugin/33030-ai-dimag)** — or search "AI Dimag" in Settings → Plugins.
:::

::: tip Prerequisite
Install the `dim` CLI and run `dim init` in your repo first. The extensions call `dim` under
the hood and need it on your `PATH`.
:::

## VSCode extension

Source: [AiDimag/aidimag-vscode](https://github.com/AiDimag/aidimag-vscode).

**Features**

- **Memory Explorer** — a tree view of all memories, colour-coded by kind (including
  guardrails and skills), with a detail webview for each.
- **Add memory** — a guided flow; for guardrails it prompts for the enforcement level
  (never / ask-first / always).
- **Status bar** — a 🧠 indicator of memory health that turns a warning colour when
  memories go stale.
- **Knowledge inbox watcher** — drop docs into the repo's `knowledge/` folder and the
  extension auto-runs `dim knowledge sync` to summarize them into reviewable, pinned-on-approve
  proposals (toggle with `aidimag.knowledgeWatch`; also available as the
  *aidimag: Sync Knowledge Inbox* command). See [Knowledgebase](/guides/knowledgebase).
- **Commands** — verify, sync, sync knowledge, and the embedded dashboard.

**Install**

1. Open the Extensions view in VS Code (`Cmd/Ctrl+Shift+X`) and search for **aiDimag** — or install from the [Marketplace page](https://marketplace.visualstudio.com/items?itemName=aidimag.aidimag-vscode)
2. Or from the command line: `code --install-extension aidimag.aidimag-vscode`
3. **Cursor / VSCodium users:** install from the [Open VSX listing](https://open-vsx.org/extension/aidimag/aidimag-vscode) — same extension ID (`aidimag.aidimag-vscode`), same code.

## IntelliJ plugin

Source: [AiDimag/aidimag-intellij](https://github.com/AiDimag/aidimag-intellij). Works in IntelliJ IDEA (and other JetBrains IDEs on the same
platform version).

**Features**

- **Memory Explorer tool window** — colour-coded nodes, a detail pane, search/filter by kind
  and status, and the guardrail enforcement level shown inline.
- **Add memory dialog** — with a guardrail-level selector that appears when you choose the
  guardrail kind.
- **Toolbar actions** — add, verify all, mine.
- **Embedded dashboard tab** (JCEF) and **status-bar widgets** for memory and sync health.
- **Knowledge inbox watcher** — drop docs into the repo's `knowledge/` folder and the plugin
  auto-runs `dim knowledge sync` (toggle in Settings; also the *Sync Knowledge Inbox* action).
- **Auto-sync** in the background.

Find the actions under **Tools → aiDimag**.

**Install**

1. Open IntelliJ IDEA → Settings/Preferences → **Plugins → Marketplace**
2. Search for **AI Dimag** and click Install — or browse the [Marketplace page](https://plugins.jetbrains.com/plugin/33030-ai-dimag)
3. Restart the IDE

::: warning macOS PATH note
JetBrains IDEs launched from Finder/Toolbox sometimes run with a minimal `PATH` that doesn't
include your global npm bin directory, so `dim` can't be found. The plugin works around this
by inheriting your console environment; if you still hit "cannot run program dim", make sure
`dim` is installed globally (`npm link` or `npm i -g aidimag`).
:::

## Which surfaces do what?

| Task | CLI | VSCode | IntelliJ |
|---|---|---|---|
| Browse memories | `dim log` / `dim recall` | Memory Explorer | Memory Explorer |
| Add a memory | `dim remember` | Add flow | Add dialog |
| Verify | `dim verify` | command | toolbar |
| Review proposals | `dim review` | dashboard | dashboard |
| Ingest knowledge docs | `dim knowledge sync` | inbox watcher | inbox watcher |
| Full dashboard | `dim ui` | webview | JCEF tab |

All three read and write the same `.aidimag/memory.db`, so you can mix and match freely.

