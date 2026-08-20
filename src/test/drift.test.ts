import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { MemoryStore } from "../db/store.js";
import { detectDrift } from "../context/drift.js";

const CLI = path.resolve(process.cwd(), "dist/cli/index.js");

function tempRepo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "aidimag-drift-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "Test User"], { cwd: dir });
  writeFileSync(path.join(dir, ".gitignore"), ".aidimag\n");
  return dir;
}

test("detectDrift reports missing and stale rules", () => {
  const dir = tempRepo();
  const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
  try {
    store.write({ kind: "CONVENTION", claim: "Use async functions", paths: ["src"], createdBy: "test", evidence: [] });
    store.write({ kind: "GUARDRAIL", claim: "Never log secrets", paths: ["src"], createdBy: "test", evidence: [] });

    // CLAUDE.md has one rule but missing the guardrail and includes a stale one
    writeFileSync(
      path.join(dir, "CLAUDE.md"),
      `<!-- aidimag -->
# Project Memory
- Use async functions [VERIFIED]
- Old rule no longer in store
`
    );

    const report = detectDrift(store, dir, "claude");
    assert.equal(report.files.length, 1);
    assert.equal(report.files[0].file, "CLAUDE.md");
    assert.equal(report.files[0].missing.length, 1);
    assert.equal(report.files[0].missing[0].claim, "Never log secrets");
    assert.equal(report.files[0].stale.length, 1);
    assert.ok(report.files[0].stale[0].includes("old rule"));
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("generate-context --check exits non-zero on drift", () => {
  const dir = tempRepo();
  const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
  try {
    store.write({ kind: "CONVENTION", claim: "Use async functions", paths: ["src"], createdBy: "test", evidence: [] });
    writeFileSync(path.join(dir, "CLAUDE.md"), "<!-- empty -->\n");

    let exitCode = 0;
    let out = "";
    try {
      out = execFileSync("node", [CLI, "generate-context", "-f", "claude", "--check"], { cwd: dir, encoding: "utf8" });
    } catch (err: any) {
      exitCode = err.status ?? 1;
      out = err.stdout ?? "";
    }
    assert.notEqual(exitCode, 0);
    assert.match(out, /Missing/);
    assert.match(out, /Use async functions/);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("generate-context --check passes when in sync", () => {
  const dir = tempRepo();
  const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
  try {
    store.write({ kind: "CONVENTION", claim: "Use async functions", paths: ["src"], createdBy: "test", evidence: [] });
    execFileSync("node", [CLI, "generate-context", "-f", "claude"], { cwd: dir, encoding: "utf8" });
    const out = execFileSync("node", [CLI, "generate-context", "-f", "claude", "--check"], { cwd: dir, encoding: "utf8" });
    assert.match(out, /in sync/);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("generate-context --check --fix auto-regenerates on drift", () => {
  const dir = tempRepo();
  const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
  try {
    store.write({ kind: "CONVENTION", claim: "Use async functions", paths: ["src"], createdBy: "test", evidence: [] });
    store.write({ kind: "GUARDRAIL", claim: "Never log secrets", paths: ["src"], createdBy: "test", evidence: [] });

    // Write an incomplete CLAUDE.md
    writeFileSync(path.join(dir, "CLAUDE.md"), "<!-- aidimag -->\n# Project Memory\n- Use async functions [VERIFIED]\n");

    // Run --check --fix — should regenerate and exit 0
    const out = execFileSync("node", [CLI, "generate-context", "-f", "claude", "--check", "--fix"], {
      cwd: dir,
      encoding: "utf8",
    });

    // Should report drift then fix it
    assert.match(out, /Drift detected/);
    assert.match(out, /Auto-fixed/);

    // File should now contain both memories
    const content = readFileSync(path.join(dir, "CLAUDE.md"), "utf8");
    assert.match(content, /Use async functions/);
    assert.match(content, /Never log secrets/);

    // Subsequent --check should pass
    const out2 = execFileSync("node", [CLI, "generate-context", "-f", "claude", "--check"], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.match(out2, /in sync/);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
