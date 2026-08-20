import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { MemoryStore } from "../db/store.js";
import { applyBudget, getTokenizer } from "../llm/tokens.js";

const CLI = path.resolve(process.cwd(), "dist/cli/index.js");

function tempRepo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "aidimag-tokens-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "Test User"], { cwd: dir });
  writeFileSync(path.join(dir, ".gitignore"), ".aidimag\n");
  return dir;
}

test("applyBudget respects token limit", async () => {
  const items = [
    { memory: { id: "1", claim: "A", detail: null, kind: "GOTCHA", status: "VERIFIED" } as any, relevance: 1 },
    { memory: { id: "2", claim: "B", detail: null, kind: "GOTCHA", status: "VERIFIED" } as any, relevance: 1 },
    { memory: { id: "3", claim: "C", detail: null, kind: "GOTCHA", status: "VERIFIED" } as any, relevance: 1 },
  ];

  const out = await applyBudget(items, 26);
  assert.ok(out.included.length > 0, "expected at least one item within budget");
  assert.ok(out.included.length < items.length, "expected at least one item to be dropped");
  assert.equal(out.included.length + out.dropped, items.length);
});

test("recall --max-tokens drops memories over budget", () => {
  const dir = tempRepo();
  const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
  try {
    store.write({ kind: "GOTCHA", claim: "Shared keyword A", paths: ["src"], createdBy: "test", evidence: [] });
    store.write({ kind: "GOTCHA", claim: "Shared keyword B", paths: ["src"], createdBy: "test", evidence: [] });
    store.write({ kind: "GOTCHA", claim: "Shared keyword C", paths: ["src"], createdBy: "test", evidence: [] });

    const out = execFileSync("node", [CLI, "recall", "Shared keyword", "--max-tokens", "20"], { cwd: dir, encoding: "utf8" });
    assert.match(out, /token budget/);
    const dropped = (out.match(/(\d+) dropped/) ?? ["", "0"])[1];
    assert.ok(parseInt(dropped, 10) >= 1);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("dim context builds a budgeted context block", () => {
  const dir = tempRepo();
  const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
  try {
    store.write({ kind: "GUARDRAIL", claim: "Never log secrets", paths: ["src"], createdBy: "test", evidence: [] });
    store.write({ kind: "GOTCHA", claim: "Remember retries", paths: ["src"], createdBy: "test", evidence: [] });

    const out = execFileSync("node", [CLI, "context", "--task", "add logging", "--budget", "100"], { cwd: dir, encoding: "utf8" });
    assert.match(out, /Context for: add logging/);
    assert.match(out, /Token budget:/);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("dim context --preset deep accepts preset name", () => {
  const dir = tempRepo();
  const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
  try {
    store.write({ kind: "CONVENTION", claim: "Use async functions", paths: ["src"], createdBy: "test", evidence: [] });

    const out = execFileSync("node", [CLI, "context", "--task", "refactor", "--preset", "deep"], { cwd: dir, encoding: "utf8" });
    assert.match(out, /4000/);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("dim context --diff scopes to changed files", () => {
  const dir = tempRepo();
  const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
  try {
    mkdirSync(path.join(dir, "src"), { recursive: true });
    writeFileSync(path.join(dir, "src", "auth.ts"), "// auth");
    execFileSync("git", ["add", "."], { cwd: dir });
    execFileSync("git", ["commit", "-m", "init"], { cwd: dir });

    store.write({ kind: "CONVENTION", claim: "Auth guardrails", paths: ["src/auth.ts"], createdBy: "test", evidence: [] });
    store.write({ kind: "GOTCHA", claim: "Payments gotcha", paths: ["src/payments"], createdBy: "test", evidence: [] });

    writeFileSync(path.join(dir, "src", "auth.ts"), "// modified auth");

    const out = execFileSync("node", [CLI, "context", "--diff", "--budget", "200"], { cwd: dir, encoding: "utf8" });
    assert.match(out, /Auth guardrails/);
    assert.doesNotMatch(out, /Payments gotcha/);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
