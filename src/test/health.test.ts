import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { MemoryStore } from "../db/store.js";
import { computeHealth } from "../health.js";

const CLI = path.resolve(process.cwd(), "dist/cli/index.js");

function tempRepo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "aidimag-health-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "Test User"], { cwd: dir });
  return dir;
}

test("computeHealth reports counts and risk scores", () => {
  const dir = tempRepo();
  const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
  try {
    store.write({ kind: "GUARDRAIL", claim: "Never log secrets", paths: ["src/auth.ts"], createdBy: "test", evidence: [] });
    store.write({ kind: "FAILED_APPROACH", claim: "Do not use sync fs", paths: ["src/io"], createdBy: "test", evidence: [] });
    store.write({ kind: "CONVENTION", claim: "Use async functions", paths: ["src"], createdBy: "test", evidence: [] });

    const report = computeHealth(store);
    assert.equal(report.summary.total, 3);
    assert.equal(report.summary.byStatus.VERIFIED, 0);
    assert.equal(report.summary.byKind.GUARDRAIL, 1);
    assert.equal(report.summary.byKind.FAILED_APPROACH, 1);
    assert.ok(report.summary.riskScore > 0);
    assert.equal(report.topRisks.length, 3);

    const authRisk = report.topRisks.find((r) => r.path === "src/auth.ts")!;
    assert.ok(authRisk);
    assert.equal(authRisk.guardrails, 1);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("dim health CLI prints dashboard", () => {
  const dir = tempRepo();
  const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
  try {
    store.write({ kind: "CONVENTION", claim: "Use async functions", paths: ["src"], createdBy: "test", evidence: [] });
    const out = execFileSync("node", [CLI, "health"], { cwd: dir, encoding: "utf8" });
    assert.match(out, /Memory Store Health/);
    assert.match(out, /CONVENTION/);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
