/**
 * Safe one-command setup, health check, and uninstall for aidimag integrations.
 *
 * `dim setup` is the one-command wedge: it initializes the repo, installs git hooks,
 * wires MCP configs for detected agents, and optionally generates context files.
 * It is designed to be safe to run repeatedly and safe to undo.
 */

import { Command } from "commander";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, rmSync } from "node:fs";
import { execSync, spawn } from "node:child_process";
import { homedir, platform } from "node:os";
import path from "node:path";
import { MemoryStore, findRepoRoot, AIDIMAG_DIR, dbPathFor } from "../../db/store.js";
import { installGitHooks, uninstallGitHooks } from "../../verify/hooks.js";
import { resolveKnowledgeConfig, readConfig, writeConfig } from "../../config.js";
import { createPrompter, fail } from "../shared.js";

interface AgentIntegration {
  name: string;
  label: string;
  /** Project-relative or absolute path to the agent's config file. */
  configPath: string;
  /** Read a config file; returns undefined if missing or unreadable. */
  read(file: string): unknown | undefined;
  /** Write a config file. */
  write(file: string, config: unknown): void;
  /** Merge the aidimag MCP server into an existing config object. */
  merge(existing: unknown, server: Record<string, unknown>): unknown;
  /** Remove the aidimag MCP server from a config object. */
  unmerge(existing: unknown): unknown;
  /** Detect whether this integration is already configured. */
  isOurs(config: unknown): boolean;
}

const AIDIMAG_BACKUP_SUFFIX = ".aidimag-backup";
const AIDIMAG_MCP_NAME = "aidimag";

function mcpServer(root: string): Record<string, unknown> {
  return {
    command: "npx",
    args: ["-y", "aidimag", "mcp"],
    env: { AIDIMAG_REPO: root },
  };
}

function readJson(file: string): unknown | undefined {
  try {
    if (!existsSync(file)) return undefined;
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return undefined;
  }
}

function writeJson(file: string, config: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(config, null, 2) + "\n", { mode: 0o644 });
}

function mergeMcpJson(existing: unknown, server: Record<string, unknown>): unknown {
  const base = (typeof existing === "object" && existing !== null ? existing : {}) as Record<string, unknown>;
  return {
    ...base,
    mcpServers: {
      ...((base.mcpServers as Record<string, unknown>) ?? {}),
      [AIDIMAG_MCP_NAME]: server,
    },
  };
}

function unmergeMcpJson(existing: unknown): unknown {
  if (typeof existing !== "object" || existing === null) return existing;
  const obj = existing as Record<string, unknown>;
  const servers = obj.mcpServers as Record<string, unknown> | undefined;
  if (!servers || !(AIDIMAG_MCP_NAME in servers)) return existing;
  const { [AIDIMAG_MCP_NAME]: _, ...rest } = servers;
  const next = { ...obj };
  if (Object.keys(rest).length === 0) {
    delete next.mcpServers;
  } else {
    next.mcpServers = rest;
  }
  return next;
}

function isMcpOurs(config: unknown): boolean {
  if (typeof config !== "object" || config === null) return false;
  const servers = (config as Record<string, unknown>).mcpServers as Record<string, unknown> | undefined;
  return servers !== undefined && AIDIMAG_MCP_NAME in servers;
}

// -- Copilot (VS Code settings.json) --
const COPILOT_MCP_KEY = "github.copilot.chat.mcp.servers";

function mergeCopilotMcp(existing: unknown, server: Record<string, unknown>): unknown {
  const base = (typeof existing === "object" && existing !== null ? existing : {}) as Record<string, unknown>;
  const servers = (base[COPILOT_MCP_KEY] as Record<string, unknown>) ?? {};
  return {
    ...base,
    [COPILOT_MCP_KEY]: {
      ...servers,
      [AIDIMAG_MCP_NAME]: server,
    },
  };
}

function unmergeCopilotMcp(existing: unknown): unknown {
  if (typeof existing !== "object" || existing === null) return existing;
  const obj = { ...(existing as Record<string, unknown>) };
  const servers = obj[COPILOT_MCP_KEY] as Record<string, unknown> | undefined;
  if (!servers || !(AIDIMAG_MCP_NAME in servers)) return existing;
  const { [AIDIMAG_MCP_NAME]: _, ...rest } = servers;
  if (Object.keys(rest).length === 0) {
    delete obj[COPILOT_MCP_KEY];
  } else {
    obj[COPILOT_MCP_KEY] = rest;
  }
  return obj;
}

function isCopilotOurs(config: unknown): boolean {
  if (typeof config !== "object" || config === null) return false;
  const servers = (config as Record<string, unknown>)[COPILOT_MCP_KEY] as Record<string, unknown> | undefined;
  return servers !== undefined && AIDIMAG_MCP_NAME in servers;
}

function getIntegrations(root: string): AgentIntegration[] {
  return [
    {
      name: "claude-code",
      label: "Claude Code",
      configPath: path.join(root, ".mcp.json"),
      read: readJson,
      write: writeJson,
      merge: mergeMcpJson,
      unmerge: unmergeMcpJson,
      isOurs: isMcpOurs,
    },
    {
      name: "cursor",
      label: "Cursor",
      configPath: path.join(root, ".cursor", "mcp.json"),
      read: readJson,
      write: writeJson,
      merge: mergeMcpJson,
      unmerge: unmergeMcpJson,
      isOurs: isMcpOurs,
    },
    {
      name: "windsurf",
      label: "Windsurf",
      configPath: path.join(root, ".windsurf", "mcp_config.json"),
      read: readJson,
      write: writeJson,
      merge: mergeMcpJson,
      unmerge: unmergeMcpJson,
      isOurs: isMcpOurs,
    },
    {
      name: "codex",
      label: "OpenAI Codex",
      configPath: path.join(root, ".codex", "config.json"),
      read: readJson,
      write: writeJson,
      merge: mergeMcpJson,
      unmerge: unmergeMcpJson,
      isOurs: isMcpOurs,
    },
    {
      name: "copilot",
      label: "GitHub Copilot",
      configPath: path.join(root, ".vscode", "settings.json"),
      read: readJson,
      write: writeJson,
      merge: mergeCopilotMcp,
      unmerge: unmergeCopilotMcp,
      isOurs: isCopilotOurs,
    },
  ];
}

function timestampSuffix(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function backupPath(file: string): string {
  return `${file}${AIDIMAG_BACKUP_SUFFIX}-${timestampSuffix()}`;
}

interface PlanItem {
  file: string;
  action: "create" | "update" | "backup-restore";
  integration?: string;
}

function runInit(root: string, dryRun: boolean): void {
  const dir = path.join(root, AIDIMAG_DIR);
  const dbFile = dbPathFor(root);
  if (!dryRun) {
    mkdirSync(dir, { recursive: true });
    if (!existsSync(dbFile)) {
      const store = new MemoryStore(dbFile);
      store.close();
    }
    const gitignore = path.join(dir, ".gitignore");
    if (!existsSync(gitignore)) {
      writeFileSync(gitignore, "memory.db\nmemory.db-wal\nmemory.db-shm\nknowledge/\nconfig.json\n");
    }
    const knowledgeInbox = path.join(root, resolveKnowledgeConfig(root).folder);
    mkdirSync(knowledgeInbox, { recursive: true });
    const gitkeep = path.join(knowledgeInbox, ".gitkeep");
    if (!existsSync(gitkeep)) {
      writeFileSync(gitkeep, "# Drop project docs here.\n");
    }
  }
}

function mergeAgentConfig(
  integration: AgentIntegration,
  root: string,
  dryRun: boolean,
  plan: PlanItem[],
  force: boolean
): void {
  const file = integration.configPath;
  const existing = integration.read(file);
  const server = mcpServer(root);
  if (existing && integration.isOurs(existing) && !force) {
    return; // already configured and not forcing
  }
  if (existing) {
    plan.push({ file, action: "backup-restore", integration: integration.name });
    if (!dryRun) {
      renameSync(file, backupPath(file));
    }
  } else {
    plan.push({ file, action: "create", integration: integration.name });
  }
  if (!dryRun) {
    integration.write(file, integration.merge(existing, server));
  }
}

function unmergeAgentConfig(
  integration: AgentIntegration,
  dryRun: boolean,
  removed: string[],
  skipped: string[]
): void {
  const file = integration.configPath;
  if (!existsSync(file)) {
    skipped.push(integration.name);
    return;
  }
  const existing = integration.read(file);
  if (!existing || !integration.isOurs(existing)) {
    skipped.push(integration.name);
    return;
  }
  if (!dryRun) {
    const next = integration.unmerge(existing);
    if (!next || (typeof next === "object" && next !== null && Object.keys(next).length === 0)) {
      renameSync(file, backupPath(file));
      rmSync(file, { force: true });
    } else {
      renameSync(file, backupPath(file));
      integration.write(file, next);
    }
  }
  removed.push(integration.name);
}

export function registerSetupCommands(program: Command): void {
  program
    .command("setup")
    .description("Initialize aidimag safely and wire agent integrations (git hooks, MCP configs, context files)")
    .option("--dry-run", "Show what would be changed without modifying files")
    .option("--yes", "Accept all detected integrations without prompting")
    .option("--agent <agents>", "Comma-separated list of agents to configure (claude-code,cursor)")
    .option("--context-files [format]", "Generate static context files (default: all)")
    .option("--bootstrap", "Run dim bootstrap after setup")
    .option("--force", "Overwrite existing aidimag MCP configs (backs up first)")
    .action(async (opts) => {
      const root = findRepoRoot() ?? process.cwd();
      const dryRun = Boolean(opts.dryRun);
      const plan: PlanItem[] = [];

      if (dryRun) console.log("🔍 Dry run — no files will be modified.");

      // 1) init repo memory
      const freshInit = !existsSync(dbPathFor(root));
      runInit(root, dryRun);
      if (dryRun) {
        console.log(freshInit ? "  would initialize .aidimag" : "  .aidimag already exists");
      } else {
        console.log(freshInit ? "✅ Initialized .aidimag" : "✓ .aidimag already initialized");
      }

      // 2) git hooks
      if (!dryRun) {
        const hooks = installGitHooks(root);
        if (hooks.installed.length) console.log(`✅ Installed git hooks: ${hooks.installed.join(", ")}`);
        if (hooks.alreadyPresent.length) console.log(`✓ Git hooks already present: ${hooks.alreadyPresent.join(", ")}`);
      } else {
        console.log("  would install/verify git hooks");
      }

      // 3) agent MCP configs
      const integrations = getIntegrations(root);
      let selected = integrations.filter((i) => existsSync(i.configPath) || i.isOurs(i.read(i.configPath) ?? {}));
      if (opts.agent) {
        const want = new Set(opts.agent.split(",").map((s: string) => s.trim()));
        selected = integrations.filter((i) => want.has(i.name));
      }
      if (!opts.yes && !opts.agent && selected.length === 0) {
        const prompter = await createPrompter();
        const answer = (await prompter.ask("No MCP configs detected. Configure Claude Code, Cursor, Windsurf, Codex, and Copilot anyway? (y/n) ")).trim().toLowerCase();
        prompter.close();
        if (answer === "y" || answer === "yes") selected = integrations;
      }

      for (const integration of selected) {
        mergeAgentConfig(integration, root, dryRun, plan, Boolean(opts.force));
        if (dryRun) {
          console.log(`  would configure ${integration.label} → ${path.relative(root, integration.configPath)}`);
        } else {
          console.log(`✅ Configured ${integration.label} → ${path.relative(root, integration.configPath)}`);
        }
      }

      // 4) context files
      if (opts.contextFiles) {
        if (!dryRun) {
          const { generateContext } = await import("../../context/generate.js");
          const store = MemoryStore.open(root);
          const format = typeof opts.contextFiles === "string" ? opts.contextFiles : "all";
          const r = generateContext(store, root, format as never);
          store.close();
          writeConfig(root, { generateContext: { auto: true, format: format as never } });
          console.log(`✅ Generated context files: ${r.files.join(", ")}`);
        } else {
          console.log("  would generate context files");
        }
      }

      // 5) bootstrap
      if (opts.bootstrap) {
        if (!dryRun) {
          const { bootstrapRepo } = await import("../../capture/bootstrap.js");
          const store = MemoryStore.open(root);
          await bootstrapRepo(store, root);
          store.close();
          console.log("✅ Bootstrap complete — review proposals with `dim review`");
        } else {
          console.log("  would run dim bootstrap");
        }
      }

      // 6) Ollama setup for semantic search + LLM (only if no embedding/LLM provider)
      if (!dryRun) {
        const { getEmbeddingProvider } = await import("../../embeddings/provider.js");
        const { getTextProvider } = await import("../../knowledge/llm.js");
        const embProvider = await getEmbeddingProvider();
        const llmProvider = await getTextProvider();
        if (!embProvider && !llmProvider && !process.env.OPENAI_API_KEY) {
          console.log("\n🧮 Semantic search and LLM features need Ollama models.");
          console.log("   Ollama (free, local) provides both — I'll install it and pull an embedding + LLM model.\n");
          const prompter = await createPrompter("n");
          const ollamaChoice = (await prompter.ask("Set up Ollama for semantic search + LLM? [y/N] ")).trim().toLowerCase();
          prompter.close();
          if (ollamaChoice === "y" || ollamaChoice === "yes") {
            await setupOllamaInteractive();
          } else {
            console.log("   Skipped. Run `dim setup-ollama` anytime to enable semantic search + LLM features.");
          }
        }
      }

      if (dryRun && plan.length) {
        console.log("\nPlanned changes:");
        for (const item of plan) {
          console.log(`  ${item.action}: ${path.relative(root, item.file)}${item.integration ? ` (${item.integration})` : ""}`);
        }
      }

      if (!dryRun) {
        console.log("\nNext: run `dim doctor` to verify the installation.");
      }
    });

  program
    .command("doctor")
    .description("Check the aidimag installation and integrations for common problems")
    .action(async () => {
      const root = findRepoRoot();
      const checks: { ok: boolean; label: string; detail?: string }[] = [];

      const nodeMajor = parseInt(process.versions.node.split(".")[0], 10);
      checks.push({ ok: nodeMajor >= 18, label: "Node.js >= 18", detail: `v${process.versions.node}` });

      let nativeOk = false;
      try {
        await import("better-sqlite3");
        await import("sqlite-vec");
        nativeOk = true;
      } catch {
        nativeOk = false;
      }
      checks.push({ ok: nativeOk, label: "Native SQLite modules loadable" });

      const gitDir = root ? path.join(root, ".git") : "";
      checks.push({ ok: root !== null && existsSync(gitDir), label: "Inside a git repo" });

      const initialized = root ? existsSync(dbPathFor(root)) : false;
      checks.push({ ok: initialized, label: "aidimag initialized", detail: initialized ? dbPathFor(root!) : undefined });

      let storeOk = false;
      if (root && initialized) {
        try {
          const store = MemoryStore.open(root);
          storeOk = true;
          store.close();
        } catch {
          storeOk = false;
        }
      }
      checks.push({ ok: storeOk, label: "Memory store opens" });

      const hooksDir = root ? path.join(root, ".git", "hooks") : "";
      const hooksInstalled = root && existsSync(hooksDir) && ["post-merge", "post-commit", "pre-commit"].every((h) => existsSync(path.join(hooksDir, h)));
      checks.push({ ok: Boolean(hooksInstalled), label: "Git hooks installed" });

      if (root) {
        const integrations = getIntegrations(root).filter((i) => i.isOurs(i.read(i.configPath) ?? {}));
        checks.push({ ok: integrations.length > 0, label: "Agent MCP configs found", detail: integrations.map((i) => i.label).join(", ") || "none" });
      } else {
        checks.push({ ok: false, label: "Agent MCP configs found", detail: "not in a repo" });
      }

      const llmKey = process.env.OPENAI_API_KEY || process.env.AIDIMAG_LLM;
      checks.push({ ok: true, label: "LLM provider configured", detail: llmKey ? "yes" : "optional — needed for bootstrap/mine/harvest" });

      // Embedding provider check
      let embedProvider: string | null = null;
      try {
        const { getEmbeddingProvider } = await import("../../embeddings/provider.js");
        const ep = await getEmbeddingProvider();
        embedProvider = ep ? `${ep.name}/${ep.model}` : null;
      } catch { /* ignore */ }
      checks.push({
        ok: true,
        label: "Embedding provider (semantic search)",
        detail: embedProvider ? embedProvider : "none — keyword search only. Run `dim setup-ollama` to enable",
      });

      const allOk = checks.every((c) => c.ok);
      for (const c of checks) {
        const icon = c.ok ? "✅" : "⚠️";
        console.log(`${icon} ${c.label}${c.detail ? ` — ${c.detail}` : ""}`);
      }
      if (!allOk) {
        console.log("\nSome checks failed. Run `dim setup` to fix installation issues.");
        process.exitCode = 1;
      } else {
        console.log("\nAll checks passed.");
      }
    });

  program
    .command("uninstall-integrations")
    .description("Remove aidimag git hooks and agent MCP configs (backups are preserved)")
    .option("--dry-run", "Show what would be removed without modifying files")
    .option("--agent <agents>", "Comma-separated list of agents to uninstall (claude-code,cursor)")
    .option("--context-files", "Also remove generated context files")
    .action(async (opts) => {
      const root = findRepoRoot() ?? fail("not inside a git repo");
      const dryRun = Boolean(opts.dryRun);
      if (dryRun) console.log("🔍 Dry run — no files will be modified.");

      const hooksResult = dryRun ? { removed: ["post-merge", "post-commit", "pre-commit"], notPresent: [] } : uninstallGitHooks(root);
      if (dryRun) {
        console.log("  would remove aidimag blocks from git hooks");
      } else if (hooksResult.removed.length) {
        console.log(`✅ Removed aidimag blocks from hooks: ${hooksResult.removed.join(", ")}`);
      } else {
        console.log("✓ No aidimag git hooks to remove");
      }

      const integrations = getIntegrations(root);
      const selected = opts.agent
        ? integrations.filter((i) => opts.agent.split(",").map((s: string) => s.trim()).includes(i.name))
        : integrations;
      const removed: string[] = [];
      const skipped: string[] = [];
      for (const integration of selected) {
        unmergeAgentConfig(integration, dryRun, removed, skipped);
        if (dryRun) {
          if (existsSync(integration.configPath)) {
            console.log(`  would remove ${integration.label} MCP config`);
          }
        }
      }
      if (removed.length) console.log(`✅ Removed MCP configs: ${removed.join(", ")}`);
      if (skipped.length && !dryRun) console.log(`✓ No MCP config to remove for: ${skipped.join(", ")}`);

      if (opts.contextFiles) {
        const files = ["CLAUDE.md", ".cursorrules", ".windsurfrules", "AGENTS.md", ".github/copilot-instructions.md"].map((f) => path.join(root, f));
        for (const f of files) {
          if (existsSync(f)) {
            if (!dryRun) {
              renameSync(f, backupPath(f));
              rmSync(f, { force: true });
            }
            console.log(`${dryRun ? "  would remove" : "✅ Removed"} ${path.relative(root, f)}`);
          }
        }
      }

      if (!dryRun) {
        console.log("\nBackups preserved with `.aidimag-backup-<timestamp>` suffix.");
        console.log("Run `dim doctor` to verify the state.");
      }
    });

  program
    .command("setup-ollama")
    .description("Install Ollama and pull free local models for semantic search + LLM features")
    .option("--model <model>", "Embedding model to pull (skip prompt). Options: all-minilm, nomic-embed-text, mxbai-embed-large, snowflake-arctic-embed")
    .action(async (opts) => {
      if (opts.model) {
        await setupOllama(opts.model);
      } else {
        await setupOllamaInteractive();
      }
    });
}

/** Ollama binary name on macOS/Linux, or ollama.exe on Windows. */
function ollamaBinary(): string {
  return platform() === "win32" ? "ollama.exe" : "ollama";
}

/** Check if Ollama is already installed and on PATH. */
function isOllamaInstalled(): boolean {
  try {
    execSync(`${ollamaBinary()} --version`, { stdio: "pipe", timeout: 5000 });
    return true;
  } catch {
    // Check common install locations
    const commonPaths = [
      "/usr/local/bin/ollama",
      "/opt/homebrew/bin/ollama",
      path.join(homedir(), ".local", "bin", "ollama"),
      "/usr/bin/ollama",
    ];
    return commonPaths.some((p) => existsSync(p));
  }
}

/** Check if Ollama is running (server reachable on default port). */
async function isOllamaRunning(): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2000);
    const res = await fetch("http://localhost:11434/api/tags", { signal: ctl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

/** Check if a specific model is already pulled. */
function isModelPulled(model: string): boolean {
  try {
    const out = execSync(`${ollamaBinary()} list`, { encoding: "utf8", timeout: 5000 });
    return out.includes(model);
  } catch {
    return false;
  }
}

/** List all pulled models from Ollama. */
function listPulledModels(): string[] {
  try {
    const out = execSync(`${ollamaBinary()} list`, { encoding: "utf8", timeout: 5000 });
    return out
      .split("\n")
      .slice(1) // skip header row
      .map((line) => line.split(/\s+/)[0])
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Known embedding models for Ollama, ordered by size (lightest first). */
const EMBEDDING_MODELS: Array<{ name: string; size: string; dim: number; desc: string }> = [
  { name: "all-minilm", size: "~45MB", dim: 384, desc: "Lightest option. Fast, good for small repos. 384-dim." },
  { name: "nomic-embed-text", size: "~274MB", dim: 768, desc: "Best balance of size and quality. 768-dim. Recommended." },
  { name: "mxbai-embed-large", size: "~670MB", dim: 1024, desc: "Highest quality, larger. 1024-dim. Good for large repos." },
  { name: "snowflake-arctic-embed", size: "~1.2GB", dim: 1024, desc: "Top-tier quality, largest. 1024-dim. For demanding semantic search." },
];

/** Known LLM models for Ollama, for mining/harvest/bootstrap. */
const LLM_MODELS: Array<{ name: string; size: string; desc: string }> = [
  { name: "llama3.2", size: "~2.0GB", desc: "Latest, fast, good balance. Recommended." },
  { name: "llama3.1", size: "~4.9GB", desc: "Capable, larger. Good for complex repos." },
  { name: "qwen2.5-coder", size: "~4.7GB", desc: "Code-tuned. Best for bootstrap/mine/harvest." },
  { name: "qwen2.5", size: "~4.7GB", desc: "Strong general code understanding." },
  { name: "phi3", size: "~2.2GB", desc: "Compact, efficient for simple tasks." },
];

/** Default model — best balance of size and quality. */
const DEFAULT_EMBEDDING_MODEL = "nomic-embed-text";
const DEFAULT_LLM_MODEL = "llama3.2";

/** Check if a pulled model is a known embedding model (or looks like one by name). */
function isEmbeddingModel(name: string): boolean {
  const known = EMBEDDING_MODELS.map((m) => m.name);
  if (known.includes(name)) return true;
  // Heuristic: models with "embed" in the name are likely embedding models
  return /embed/i.test(name) && !/llama|qwen|mistral|gemma|phi|code/i.test(name);
}

/** Check if a pulled model is a known LLM model (non-embedding). */
function isLlmModel(name: string): boolean {
  const known = LLM_MODELS.map((m) => m.name);
  if (known.includes(name)) return true;
  return !isEmbeddingModel(name);
}

/** Save model selection to config.json. */
function saveOllamaConfig(root: string, embeddingModel: string, llmModel: string): void {
  try {
    const cfg = readConfig(root);
    const ollama = { ...(cfg.ollama as Record<string, unknown> || {}), embeddingModel, llmModel };
    writeConfig(root, { ollama });
  } catch { /* ignore */ }
}

/**
 * Interactive LLM model selection: shows already-pulled LLM models first,
 * then the catalog of recommended models. Returns the chosen model name.
 */
async function selectLlmModel(): Promise<string> {
  const pulled = listPulledModels();
  const pulledLlm = pulled.filter(isLlmModel);

  if (pulledLlm.length > 0) {
    console.log("\n🧠 You already have these LLM models pulled:");
    pulledLlm.forEach((m, i) => {
      const info = LLM_MODELS.find((lm) => lm.name === m);
      console.log(`  ${i + 1}. ${m}${info ? ` — ${info.desc}` : " (detected as LLM model)"}`);
    });
    if (pulledLlm.length === 1) {
      console.log(`\nUsing '${pulledLlm[0]}' (already available).\n`);
      return pulledLlm[0];
    }
    const prompter = await createPrompter("1");
    const choice = (await prompter.ask(`Use which pulled model? [1-${pulledLlm.length}, or 'new' to see all options] `)).trim().toLowerCase();
    prompter.close();
    const n = parseInt(choice, 10);
    if (n >= 1 && n <= pulledLlm.length) {
      return pulledLlm[n - 1];
    }
  }

  // Show the full catalog
  console.log("\n📋 Recommended LLM models (for mining, harvest, bootstrap):");
  LLM_MODELS.forEach((m, i) => {
    const already = pulledLlm.includes(m.name) ? " ✓ already pulled" : "";
    const isDefault = m.name === DEFAULT_LLM_MODEL ? " (recommended)" : "";
    console.log(`  ${i + 1}. ${m.name} — ${m.size}, ${m.desc}${isDefault}${already}`);
  });

  const defaultIdx = LLM_MODELS.findIndex((m) => m.name === DEFAULT_LLM_MODEL) + 1;
  const prompter = await createPrompter(String(defaultIdx));
  const choice = (await prompter.ask(`\nSelect model [1-${LLM_MODELS.length}] (default: ${defaultIdx}) `)).trim();
  prompter.close();
  const n = parseInt(choice, 10);
  if (n >= 1 && n <= LLM_MODELS.length) {
    return LLM_MODELS[n - 1].name;
  }
  return DEFAULT_LLM_MODEL;
}

/**
 * Interactive embedding model selection: shows already-pulled embedding models first,
 * then the catalog of recommended models. Returns the chosen model name.
 */
async function selectEmbeddingModel(): Promise<string> {
  const pulled = listPulledModels();
  const pulledEmbedding = pulled.filter(isEmbeddingModel);

  if (pulledEmbedding.length > 0) {
    console.log("\n📦 You already have these embedding models pulled:");
    pulledEmbedding.forEach((m, i) => {
      const info = EMBEDDING_MODELS.find((em) => em.name === m);
      console.log(`  ${i + 1}. ${m}${info ? ` — ${info.desc}` : " (detected as embedding model)"}`);
    });
    if (pulledEmbedding.length === 1) {
      console.log(`\nUsing '${pulledEmbedding[0]}' (already available).\n`);
      return pulledEmbedding[0];
    }
    const prompter = await createPrompter("1");
    const choice = (await prompter.ask(`Use which pulled model? [1-${pulledEmbedding.length}, or 'new' to see all options] `)).trim().toLowerCase();
    prompter.close();
    const n = parseInt(choice, 10);
    if (n >= 1 && n <= pulledEmbedding.length) {
      return pulledEmbedding[n - 1];
    }
  }

  // Show the full catalog
  console.log("\n📋 Recommended embedding models (lightest → heaviest):");
  EMBEDDING_MODELS.forEach((m, i) => {
    const already = pulledEmbedding.includes(m.name) ? " ✓ already pulled" : "";
    const isDefault = m.name === DEFAULT_EMBEDDING_MODEL ? " (recommended)" : "";
    console.log(`  ${i + 1}. ${m.name} — ${m.size}, ${m.desc}${isDefault}${already}`);
  });

  const defaultIdx = EMBEDDING_MODELS.findIndex((m) => m.name === DEFAULT_EMBEDDING_MODEL) + 1;
  const prompter = await createPrompter(String(defaultIdx));
  const choice = (await prompter.ask(`\nSelect model [1-${EMBEDDING_MODELS.length}] (default: ${defaultIdx}) `)).trim();
  prompter.close();
  const n = parseInt(choice, 10);
  if (n >= 1 && n <= EMBEDDING_MODELS.length) {
    return EMBEDDING_MODELS[n - 1].name;
  }
  return DEFAULT_EMBEDDING_MODEL;
}

/** Install Ollama based on the current platform. */
function installOllama(): boolean {
  const plat = platform();
  if (plat === "darwin") {
    // macOS: prefer Homebrew, fall back to install script
    try {
      execSync("command -v brew", { stdio: "pipe" });
      console.log("Installing Ollama via Homebrew…");
      execSync("brew install ollama", { stdio: "inherit" });
      return true;
    } catch {
      console.log("Homebrew not found — using install script…");
    }
  }
  if (plat === "darwin" || plat === "linux") {
    try {
      console.log("Running Ollama install script…");
      execSync('curl -fsSL https://ollama.com/install.sh | sh', { stdio: "inherit" });
      return true;
    } catch {
      return false;
    }
  }
  if (plat === "win32") {
    console.log("Windows: please install Ollama from https://ollama.com/download");
    console.log("  Download the Windows installer and run it, then re-run `dim setup-ollama`.");
    return false;
  }
  console.log(`Unsupported platform: ${plat}. Install Ollama manually from https://ollama.com/download`);
  return false;
}

/** Start the Ollama server in the background. */
function startOllamaServer(): boolean {
  try {
    const child = spawn(ollamaBinary(), ["serve"], {
      stdio: "ignore",
      detached: true,
    });
    child.unref();
    return true;
  } catch {
    // It may already be running or may take a moment to start
    return false;
  }
}

/** Pull an embedding model. */
function pullModel(model: string): boolean {
  try {
    console.log(`Pulling ${model} (this may take a minute)…`);
    execSync(`${ollamaBinary()} pull ${model}`, { stdio: "inherit" });
    return true;
  } catch {
    return false;
  }
}

/** Verify the embedding model works by sending a probe request. */
async function verifyEmbedding(model: string): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 5000);
    const res = await fetch("http://localhost:11434/api/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: "probe" }),
      signal: ctl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return false;
    const body = (await res.json()) as { embedding?: number[] };
    return Boolean(body.embedding?.length);
  } catch {
    return false;
  }
}

/**
 * Full Ollama setup flow: install → start server → pull model → verify.
 * Non-interactive: uses the given model name directly.
 * Returns true if Ollama + the embedding model are ready to use.
 */
export async function setupOllama(model: string = DEFAULT_EMBEDDING_MODEL): Promise<boolean> {
  console.log("🧮 Setting up Ollama for semantic search embeddings\n");

  // 1) Check if Ollama is installed
  if (isOllamaInstalled()) {
    console.log("✅ Ollama is already installed");
  } else {
    console.log("Ollama not found — installing…\n");
    const installed = installOllama();
    if (!installed) {
      console.log("\n⚠ Could not install Ollama automatically.");
      console.log("  Install it manually from https://ollama.com/download and re-run `dim setup-ollama`.");
      return false;
    }
    console.log("✅ Ollama installed");
  }

  // 2) Check if Ollama server is running
  const running = await isOllamaRunning();
  if (running) {
    console.log("✅ Ollama server is running");
  } else {
    console.log("Starting Ollama server…");
    startOllamaServer();
    let ready = false;
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      if (await isOllamaRunning()) { ready = true; break; }
    }
    if (!ready) {
      console.log("\n⚠ Ollama server didn't start. Run `ollama serve` in another terminal, then re-run `dim setup-ollama`.");
      return false;
    }
    console.log("✅ Ollama server started");
  }

  // 3) Pull the embedding model
  if (isModelPulled(model)) {
    console.log(`✅ Model '${model}' is already pulled`);
  } else {
    const pulled = pullModel(model);
    if (!pulled) {
      console.log(`\n⚠ Could not pull '${model}'. Run \`ollama pull ${model}\` manually.`);
      return false;
    }
    console.log(`✅ Model '${model}' pulled`);
  }

  // 4) Verify the embedding endpoint works
  const ok = await verifyEmbedding(model);
  if (!ok) {
    console.log("\n⚠ Embedding probe failed. The model may still be loading — try `dim reindex` in a moment.");
    return false;
  }

  console.log(`\n✅ Ollama ready! Semantic search is now enabled with model '${model}'.`);
  console.log("   Run `dim reindex` to build embeddings for existing memories.");
  return true;
}

/**
 * Interactive Ollama setup: install → start server → select model → pull → verify.
 * Detects already-pulled embedding models and lets the user choose.
 */
export async function setupOllamaInteractive(): Promise<boolean> {
  console.log("🧮 Setting up Ollama for semantic search + LLM features\n");

  const root = findRepoRoot() ?? process.cwd();

  // 1) Check if Ollama is installed
  if (isOllamaInstalled()) {
    console.log("✅ Ollama is already installed");
  } else {
    console.log("Ollama not found — installing…\n");
    const installed = installOllama();
    if (!installed) {
      console.log("\n⚠ Could not install Ollama automatically.");
      console.log("  Install it manually from https://ollama.com/download and re-run `dim setup-ollama`.");
      return false;
    }
    console.log("✅ Ollama installed");
  }

  // 2) Check if Ollama server is running
  const running = await isOllamaRunning();
  if (running) {
    console.log("✅ Ollama server is running");
  } else {
    console.log("Starting Ollama server…");
    startOllamaServer();
    let ready = false;
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      if (await isOllamaRunning()) { ready = true; break; }
    }
    if (!ready) {
      console.log("\n⚠ Ollama server didn't start. Run `ollama serve` in another terminal, then re-run `dim setup-ollama`.");
      return false;
    }
    console.log("✅ Ollama server started");
  }

  // 3) Interactive embedding model selection
  const embModel = await selectEmbeddingModel();

  // 4) Pull the embedding model if not already available
  if (isModelPulled(embModel)) {
    console.log(`\n✅ Embedding model '${embModel}' is already pulled`);
  } else {
    const pulled = pullModel(embModel);
    if (!pulled) {
      console.log(`\n⚠ Could not pull '${embModel}'. Run \`ollama pull ${embModel}\` manually.`);
      return false;
    }
    console.log(`✅ Embedding model '${embModel}' pulled`);
  }

  // 5) Verify the embedding endpoint works
  const ok = await verifyEmbedding(embModel);
  if (!ok) {
    console.log("\n⚠ Embedding probe failed. The model may still be loading — try `dim reindex` in a moment.");
    return false;
  }

  // 6) Interactive LLM model selection
  console.log("\n🧠 Now let's pick an LLM model for mining, harvest, and bootstrap.\n");
  const llmModel = await selectLlmModel();

  // 7) Pull the LLM model if not already available
  if (isModelPulled(llmModel)) {
    console.log(`\n✅ LLM model '${llmModel}' is already pulled`);
  } else {
    const pulled = pullModel(llmModel);
    if (!pulled) {
      console.log(`\n⚠ Could not pull '${llmModel}'. Run \`ollama pull ${llmModel}\` manually.`);
      console.log("   Embedding search is still working — you can pull the LLM model later.");
    } else {
      console.log(`✅ LLM model '${llmModel}' pulled`);
    }
  }

  // 8) Save both models to config
  saveOllamaConfig(root, embModel, llmModel);

  console.log(`\n✅ Ollama ready!`);
  console.log(`   📦 Embedding: ${embModel} — semantic search enabled.`);
  console.log(`   🧠 LLM: ${llmModel} — mining, harvest & bootstrap ready.`);
  console.log("   Run `dim reindex` to build embeddings for existing memories.");
  return true;
}
