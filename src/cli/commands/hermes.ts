/**
 * Hermes Agent integration: `dim hermes install | status | uninstall`.
 *
 * Design: no pip package, no side-venv. The plugin is ONE stdlib-only Python
 * file (integrations/hermes/aidimag_hermes_provider.py) that bridges Hermes's
 * MemoryProvider interface to the aidimag MCP server over stdio. The installer
 * copies it into $HERMES_HOME/plugins/aidimag/__init__.py and pins the exact
 * node binary + server entry point of THIS aidimag install in config.json, so
 * the plugin never depends on PATH, Python package state, or interpreter
 * version — the three failure modes that plague pip-based Hermes plugins.
 */

import type { Command } from "commander";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findRepoRoot } from "../../db/store.js";
import { fail } from "../shared.js";

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function hermesHome(): string {
  return process.env.HERMES_HOME ?? path.join(homedir(), ".hermes");
}

function pluginDir(): string {
  return path.join(hermesHome(), "plugins", "aidimag");
}

function providerTemplate(): string {
  const p = path.join(PKG_ROOT, "integrations", "hermes", "aidimag_hermes_provider.py");
  if (!existsSync(p)) fail(`provider template missing from this install (${p}) — reinstall aidimag`);
  return p;
}

/** Syntax-check the installed plugin with whatever python3 is around (best effort). */
function pythonSyntaxCheck(file: string): "ok" | "skipped" | string {
  try {
    execFileSync("python3", ["-m", "py_compile", file], { stdio: ["ignore", "pipe", "pipe"] });
    return "ok";
  } catch (err) {
    const e = err as { code?: string; stderr?: Buffer };
    if (e.code === "ENOENT") return "skipped"; // no python3 on PATH — Hermes will have its own
    return e.stderr?.toString().trim() || "py_compile failed";
  }
}

export function registerHermesCommands(program: Command): void {
  const hermes = program
    .command("hermes")
    .description("Integrate aidimag as a Hermes Agent memory provider (verified repo memory in Hermes sessions)");

  hermes
    .command("install")
    .description("Install the aidimag memory-provider plugin into $HERMES_HOME/plugins/aidimag (no pip required)")
    .option("--repo <path>", "Pin a specific repo's .aidimag/ brain (default: auto-detect per session)")
    .option("--home <path>", "Hermes home directory (default: $HERMES_HOME or ~/.hermes)")
    .action((opts) => {
      if (opts.home) process.env.HERMES_HOME = path.resolve(opts.home);
      const home = hermesHome();
      if (!existsSync(home)) {
        fail(
          `Hermes home not found at ${home}. Install Hermes Agent first, or pass --home <path> ` +
            `(HERMES_HOME env var also works).`
        );
      }
      const dir = pluginDir();
      mkdirSync(dir, { recursive: true });
      copyFileSync(providerTemplate(), path.join(dir, "__init__.py"));

      // Pin THIS install's node + MCP entry point — immune to PATH differences
      // between the user's shell and the Hermes gateway process.
      const serverJs = path.join(PKG_ROOT, "dist", "mcp", "server.js");
      const repo = opts.repo ? path.resolve(opts.repo) : findRepoRoot();
      const config: Record<string, unknown> = existsSync(serverJs)
        ? { command: process.execPath, args: [serverJs] }
        : {}; // dev/edge case — provider falls back to `npx -y aidimag mcp`
      if (repo) config.repo = repo;
      writeFileSync(path.join(dir, "config.json"), JSON.stringify(config, null, 2) + "\n");

      const check = pythonSyntaxCheck(path.join(dir, "__init__.py"));
      console.log(`✓ Installed Hermes plugin → ${dir}`);
      console.log(
        check === "ok"
          ? "✓ Python syntax check passed"
          : check === "skipped"
            ? "• Python syntax check skipped (no python3 on PATH — fine, Hermes ships its own)"
            : `⚠ Python syntax check failed:\n${check}`
      );
      if (repo) console.log(`✓ Pinned repo: ${repo}`);
      else console.log("• No repo pinned — the provider auto-detects .aidimag/ from the session's working directory");
      console.log("\nNext steps:");
      console.log("  hermes config set memory.provider aidimag");
      console.log("  hermes memory status        # confirm the active provider");
      console.log("\nUpgrading aidimag later? Re-run `dim hermes install` to refresh the bridge.");
    });

  hermes
    .command("status")
    .description("Show the Hermes plugin install state")
    .action(() => {
      const dir = pluginDir();
      const initPy = path.join(dir, "__init__.py");
      const cfgFile = path.join(dir, "config.json");
      if (!existsSync(initPy)) {
        console.log(`Not installed (expected ${initPy}). Run \`dim hermes install\`.`);
        return;
      }
      console.log(`✓ Plugin installed at ${dir}`);
      try {
        const cfg = JSON.parse(readFileSync(cfgFile, "utf8"));
        console.log(`  server : ${cfg.command ? `${cfg.command} ${(cfg.args ?? []).join(" ")}` : "npx -y aidimag mcp (fallback)"}`);
        console.log(`  repo   : ${cfg.repo ?? "(auto-detect per session)"}`);
        if (cfg.command && !existsSync(cfg.command)) {
          console.log("  ⚠ pinned node binary no longer exists — re-run `dim hermes install`");
        }
        if (cfg.args?.[0] && !existsSync(cfg.args[0])) {
          console.log("  ⚠ pinned MCP server entry no longer exists — re-run `dim hermes install`");
        }
      } catch {
        console.log("  ⚠ config.json missing or unreadable — re-run `dim hermes install`");
      }
      console.log("\nVerify inside Hermes:  hermes memory status");
    });

  hermes
    .command("uninstall")
    .description("Remove the aidimag plugin from Hermes")
    .action(() => {
      const dir = pluginDir();
      if (!existsSync(dir)) {
        console.log("Nothing to remove — plugin is not installed.");
        return;
      }
      rmSync(dir, { recursive: true, force: true });
      console.log(`✓ Removed ${dir}`);
      console.log("If aidimag was the active provider, switch back:  hermes config set memory.provider builtin");
    });
}

