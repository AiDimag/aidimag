import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { MemoryStore } from "../db/store.js";
import { buildImpactReport, renderImpactReport } from "../verify/impact.js";

const CLI = path.resolve(process.cwd(), "dist/cli/index.js");

function tempRepo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "aidimag-impact-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "Test User"], { cwd: dir });
  writeFileSync(path.join(dir, ".gitignore"), ".aidimag\n");
  return dir;
}

test("impact report finds affected memories by file scope", () => {
  const dir = tempRepo();
  const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
  try {
    // initial commit on main
    mkdirSync(path.join(dir, "src", "payments"), { recursive: true });
    writeFileSync(path.join(dir, "src", "payments", "retry.ts"), "// initial");
    execFileSync("git", ["add", "."], { cwd: dir });
    execFileSync("git", ["commit", "-m", "init"], { cwd: dir });
    const main = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir }).toString().trim();

    // create a verified memory scoped to src/payments
    const proposal = store.propose({
      kind: "CONVENTION",
      claim: "All payment retries are idempotent",
      paths: ["src/payments"],
      evidence: [],
      source: "test",
    });
    if (!proposal) throw new Error("proposal not created");
    store.approveProposal(proposal.id, { pinned: false });

    // make a branch change
    execFileSync("git", ["checkout", "-b", "feature"], { cwd: dir });
    writeFileSync(path.join(dir, "src", "payments", "retry.ts"), "// changed");
    execFileSync("git", ["add", "."], { cwd: dir });
    execFileSync("git", ["commit", "-m", "change retry"], { cwd: dir });
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir }).toString().trim();

    const report = buildImpactReport(store, dir, main, head);
    assert.equal(report.changedFiles.length, 1);
    assert.ok(report.changedFiles[0].endsWith("retry.ts"));
    assert.equal(report.summary.total, 1);
    assert.equal(report.affected.CONVENTION.length, 1);
    assert.equal(report.affected.CONVENTION[0].memory.claim, "All payment retries are idempotent");
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("impact report renders markdown", () => {
  const dir = tempRepo();
  const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
  try {
    writeFileSync(path.join(dir, "file.txt"), "x");
    execFileSync("git", ["add", "."], { cwd: dir });
    execFileSync("git", ["commit", "-m", "init"], { cwd: dir });
    const main = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir }).toString().trim();

    store.write({ kind: "CONVENTION", claim: "C", paths: ["file.txt"], createdBy: "test", evidence: [] });

    execFileSync("git", ["checkout", "-b", "feature"], { cwd: dir });
    writeFileSync(path.join(dir, "file.txt"), "y");
    execFileSync("git", ["add", "."], { cwd: dir });
    execFileSync("git", ["commit", "-m", "change"], { cwd: dir });
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir }).toString().trim();

    const report = buildImpactReport(store, dir, main, head);
    const md = renderImpactReport(report);
    assert.match(md, /CONVENTION/);
    assert.match(md, /C/);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("dim impact CLI outputs markdown", () => {
  const dir = tempRepo();
  const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
  try {
    writeFileSync(path.join(dir, "file.txt"), "x");
    execFileSync("git", ["add", "."], { cwd: dir });
    execFileSync("git", ["commit", "-m", "init"], { cwd: dir });
    const main = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir }).toString().trim();

    store.write({ kind: "GOTCHA", claim: "G", paths: ["file.txt"], createdBy: "test", evidence: [] });

    execFileSync("git", ["checkout", "-b", "feature"], { cwd: dir });
    writeFileSync(path.join(dir, "file.txt"), "y");
    execFileSync("git", ["add", "."], { cwd: dir });
    execFileSync("git", ["commit", "-m", "change"], { cwd: dir });

    const out = execFileSync("node", [CLI, "impact", "--base", main], { cwd: dir, encoding: "utf8" });
    assert.match(out, /GOTCHA/);
    assert.match(out, /G/);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("impact report with --verify predicts stale memories", () => {
  const dir = tempRepo();
  const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
  try {
    // Create a file with specific content that a STATIC_CHECK will verify
    mkdirSync(path.join(dir, "src"), { recursive: true });
    writeFileSync(path.join(dir, "src", "config.ts"), "export const DEBUG = true;\n");
    execFileSync("git", ["add", "."], { cwd: dir });
    execFileSync("git", ["commit", "-m", "init"], { cwd: dir });
    const main = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir }).toString().trim();

    // Create a memory with STATIC_CHECK evidence that passes currently
    store.write({
      kind: "INVARIANT",
      claim: "DEBUG flag is true in config",
      paths: ["src/config.ts"],
      createdBy: "test",
      evidence: [{ type: "STATIC_CHECK", payload: "grep -q 'DEBUG = true' src/config.ts" }],
      trustExecutableEvidence: true,
    });

    // Branch: change the file so the evidence will fail
    execFileSync("git", ["checkout", "-b", "feature"], { cwd: dir });
    writeFileSync(path.join(dir, "src", "config.ts"), "export const DEBUG = false;\n");
    execFileSync("git", ["add", "."], { cwd: dir });
    execFileSync("git", ["commit", "-m", "change debug flag"], { cwd: dir });
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir }).toString().trim();

    // Build impact report with verify — should predict stale
    const report = buildImpactReport(store, dir, main, head, { verify: true });
    assert.equal(report.summary.wouldGoStale, 1);
    assert.equal(report.stalePredictions.length, 1);
    assert.equal(report.stalePredictions[0].result, "FAIL");
    assert.equal(report.stalePredictions[0].evidenceType, "STATIC_CHECK");

    // Render should include stale section
    const md = renderImpactReport(report);
    assert.match(md, /would go STALE/);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("impact report without --verify has no stale predictions", () => {
  const dir = tempRepo();
  const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
  try {
    mkdirSync(path.join(dir, "src"), { recursive: true });
    writeFileSync(path.join(dir, "src", "config.ts"), "export const DEBUG = true;\n");
    execFileSync("git", ["add", "."], { cwd: dir });
    execFileSync("git", ["commit", "-m", "init"], { cwd: dir });
    const main = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir }).toString().trim();

    store.write({
      kind: "INVARIANT",
      claim: "DEBUG flag is true",
      paths: ["src/config.ts"],
      createdBy: "test",
      evidence: [{ type: "STATIC_CHECK", payload: "grep -q 'DEBUG = true' src/config.ts" }],
      trustExecutableEvidence: true,
    });

    execFileSync("git", ["checkout", "-b", "feature"], { cwd: dir });
    writeFileSync(path.join(dir, "src", "config.ts"), "export const DEBUG = false;\n");
    execFileSync("git", ["add", "."], { cwd: dir });
    execFileSync("git", ["commit", "-m", "change"], { cwd: dir });
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir }).toString().trim();

    const report = buildImpactReport(store, dir, main, head);
    assert.equal(report.summary.wouldGoStale, 0);
    assert.equal(report.stalePredictions.length, 0);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
