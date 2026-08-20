import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { installGitHooks, uninstallGitHooks } from "../verify/hooks.js";

const CLI = path.resolve(process.cwd(), "dist/cli/index.js");

function tempRepo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "aidimag-setup-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "Test User"], { cwd: dir });
  return dir;
}

test("install/uninstall git hooks round-trip", () => {
  const dir = tempRepo();
  try {
    const installed = installGitHooks(dir);
    assert.ok(installed.installed.length > 0, "expected hooks to be installed");

    const preCommit = path.join(dir, ".git", "hooks", "pre-commit");
    assert.ok(existsSync(preCommit), "pre-commit hook should exist");
    const content = readFileSync(preCommit, "utf8");
    assert.match(content, /aidimag/);

    const uninstalled = uninstallGitHooks(dir);
    assert.deepEqual(new Set(uninstalled.removed), new Set(installed.installed));
    if (existsSync(preCommit)) {
      const after = readFileSync(preCommit, "utf8");
      assert.doesNotMatch(after, /aidimag/);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("setup --dry-run does not modify files", () => {
  const dir = tempRepo();
  try {
    const out = execFileSync("node", [CLI, "setup", "--dry-run"], { cwd: dir, encoding: "utf8" });
    assert.match(out, /Dry run/);
    assert.match(out, /would initialize \.aidimag/);
    assert.ok(!existsSync(path.join(dir, ".aidimag")), ".aidimag should not be created in dry run");
    assert.ok(!existsSync(path.join(dir, ".mcp.json")), ".mcp.json should not be created in dry run");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("setup creates .aidimag, hooks, and mcp configs", () => {
  const dir = tempRepo();
  try {
    execFileSync("node", [CLI, "setup", "--yes", "--agent", "claude-code,cursor"], { cwd: dir, encoding: "utf8" });

    assert.ok(existsSync(path.join(dir, ".aidimag", "memory.db")), "memory db should be created");
    assert.ok(existsSync(path.join(dir, ".git", "hooks", "pre-commit")), "pre-commit hook should be installed");

    const mcp = path.join(dir, ".mcp.json");
    assert.ok(existsSync(mcp), ".mcp.json should exist");
    const parsed = JSON.parse(readFileSync(mcp, "utf8"));
    assert.equal(parsed.mcpServers.aidimag.command, "npx");
    assert.deepEqual(parsed.mcpServers.aidimag.args, ["-y", "aidimag", "mcp"]);

    const cursor = path.join(dir, ".cursor", "mcp.json");
    assert.ok(existsSync(cursor), ".cursor/mcp.json should exist");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("setup backs up existing mcp config before merging", () => {
  const dir = tempRepo();
  try {
    mkdirSync(path.join(dir, ".cursor"), { recursive: true });
    const existing = { mcpServers: { other: { command: "other" } } };
    writeFileSync(path.join(dir, ".cursor", "mcp.json"), JSON.stringify(existing) + "\n");

    execFileSync("node", [CLI, "setup", "--yes", "--agent", "cursor"], { cwd: dir, encoding: "utf8" });

    const cursor = path.join(dir, ".cursor", "mcp.json");
    const parsed = JSON.parse(readFileSync(cursor, "utf8"));
    assert.equal(parsed.mcpServers.other.command, "other");
    assert.equal(parsed.mcpServers.aidimag.command, "npx");

    const backups = execFileSync("find", [dir, "-name", "*.aidimag-backup-*"], { encoding: "utf8" }).trim();
    assert.ok(backups.length > 0, "backup file should be created");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("uninstall-integrations removes hooks and mcp configs", () => {
  const dir = tempRepo();
  try {
    execFileSync("node", [CLI, "setup", "--yes", "--agent", "claude-code"], { cwd: dir, encoding: "utf8" });
    assert.ok(existsSync(path.join(dir, ".mcp.json")));

    execFileSync("node", [CLI, "uninstall-integrations"], { cwd: dir, encoding: "utf8" });

    const preCommit = path.join(dir, ".git", "hooks", "pre-commit");
    if (existsSync(preCommit)) {
      assert.doesNotMatch(readFileSync(preCommit, "utf8"), /aidimag/);
    }
    assert.ok(!existsSync(path.join(dir, ".mcp.json")), ".mcp.json should be removed");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("doctor reports healthy after setup", () => {
  const dir = tempRepo();
  try {
    execFileSync("node", [CLI, "setup", "--yes", "--agent", "claude-code"], { cwd: dir, encoding: "utf8" });
    const out = execFileSync("node", [CLI, "doctor"], { cwd: dir, encoding: "utf8" });
    assert.match(out, /All checks passed/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("doctor reports missing init before setup", () => {
  const dir = tempRepo();
  try {
    let out: string;
    try {
      out = execFileSync("node", [CLI, "doctor"], { cwd: dir, encoding: "utf8" });
    } catch (err: any) {
      out = err.stdout ?? "";
    }
    assert.match(out, /aidimag initialized/);
    assert.doesNotMatch(out, /All checks passed/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("setup wires Windsurf MCP config", () => {
  const dir = tempRepo();
  try {
    execFileSync("node", [CLI, "setup", "--yes", "--agent", "windsurf"], { cwd: dir, encoding: "utf8" });

    const windsurf = path.join(dir, ".windsurf", "mcp_config.json");
    assert.ok(existsSync(windsurf), ".windsurf/mcp_config.json should exist");
    const parsed = JSON.parse(readFileSync(windsurf, "utf8"));
    assert.equal(parsed.mcpServers.aidimag.command, "npx");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("setup wires Codex MCP config", () => {
  const dir = tempRepo();
  try {
    execFileSync("node", [CLI, "setup", "--yes", "--agent", "codex"], { cwd: dir, encoding: "utf8" });

    const codex = path.join(dir, ".codex", "config.json");
    assert.ok(existsSync(codex), ".codex/config.json should exist");
    const parsed = JSON.parse(readFileSync(codex, "utf8"));
    assert.equal(parsed.mcpServers.aidimag.command, "npx");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("setup wires Copilot MCP config in VS Code settings", () => {
  const dir = tempRepo();
  try {
    execFileSync("node", [CLI, "setup", "--yes", "--agent", "copilot"], { cwd: dir, encoding: "utf8" });

    const settings = path.join(dir, ".vscode", "settings.json");
    assert.ok(existsSync(settings), ".vscode/settings.json should exist");
    const parsed = JSON.parse(readFileSync(settings, "utf8"));
    const servers = parsed["github.copilot.chat.mcp.servers"];
    assert.ok(servers, "Copilot MCP servers key should exist");
    assert.equal(servers.aidimag.command, "npx");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("setup --agent all wires all five integrations", () => {
  const dir = tempRepo();
  try {
    execFileSync("node", [CLI, "setup", "--yes", "--agent", "claude-code,cursor,windsurf,codex,copilot"], {
      cwd: dir,
      encoding: "utf8",
    });

    assert.ok(existsSync(path.join(dir, ".mcp.json")), "Claude Code config");
    assert.ok(existsSync(path.join(dir, ".cursor", "mcp.json")), "Cursor config");
    assert.ok(existsSync(path.join(dir, ".windsurf", "mcp_config.json")), "Windsurf config");
    assert.ok(existsSync(path.join(dir, ".codex", "config.json")), "Codex config");
    assert.ok(existsSync(path.join(dir, ".vscode", "settings.json")), "Copilot config");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
