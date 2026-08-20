/**
 * Verification-engine tests: status lifecycle, confidence decay math,
 * the trust gate at run time, and the STALE → recovery-proposal loop.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { MemoryStore } from "../db/store.js";
import { verifyAll, decayedConfidence } from "../verify/engine.js";
import { runEvidence } from "../verify/runners.js";
import { checkDiff } from "../verify/check.js";
import { mineCommits } from "../capture/commit-miner.js";

function tempRepo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "aidimag-verify-"));
  execFileSync("git", ["init", "-q"], { cwd: dir });
  return dir;
}

test("decayedConfidence: halves at one half-life, floors at minimum", () => {
  const thirtyDaysAgo = new Date(Date.now() - 45 * 86_400_000).toISOString();
  const halved = decayedConfidence(0.8, thirtyDaysAgo, 45);
  assert.ok(Math.abs(halved - 0.4) < 0.01, `expected ~0.4, got ${halved}`);
  const ancient = new Date(Date.now() - 3650 * 86_400_000).toISOString();
  assert.equal(decayedConfidence(0.9, ancient, 45), 0.05);
  // future/now anchor → unchanged
  assert.equal(decayedConfidence(0.6, new Date().toISOString(), 45), 0.6);
});

test("verifyAll: pass → VERIFIED with boost; fail → STALE with floor + recovery proposal", () => {
  const dir = tempRepo();
  const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
  try {
    const good = store.write({
      kind: "INVARIANT",
      claim: "true is true",
      evidence: [{ type: "STATIC_CHECK", payload: "true" }],
      trustExecutableEvidence: true,
    });
    const bad = store.write({
      kind: "INVARIANT",
      claim: "false is true",
      evidence: [{ type: "STATIC_CHECK", payload: "false" }],
      trustExecutableEvidence: true,
    });

    const report = verifyAll(store, dir);
    assert.equal(report.verified, 1);
    assert.equal(report.stale, 1);
    assert.equal(store.get(good.id)?.status, "VERIFIED");
    assert.ok(store.get(good.id)!.confidence > 0.7);
    assert.equal(store.get(bad.id)?.status, "STALE");
    assert.equal(store.get(bad.id)?.confidence, 0.2);

    // staleness is a capture trigger: a recovery proposal was drafted
    const pending = store.listProposals("PENDING", 100);
    const recovery = pending.filter((p) => p.source === "verify:stale");
    assert.equal(recovery.length, 1);
    assert.equal(recovery[0].sourceRef, bad.id);
    assert.match(recovery[0].claim, /Stale belief needs revisiting/);

    // second run: still stale, but no duplicate proposal (before === STALE)
    verifyAll(store, dir);
    assert.equal(store.listProposals("PENDING", 100).filter((p) => p.source === "verify:stale").length, 1);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("trust gate: untrusted synced evidence is SKIPPED, not executed", () => {
  const dir = tempRepo();
  const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
  try {
    const local = store.write({ kind: "GOTCHA", claim: "seed" });
    // a synced-in memory whose STATIC_CHECK would FAIL if it ever ran
    store.applyRemoteMemory({
      ...local,
      id: "99999999-8888-7777-6666-555555555555",
      claim: "Synced claim with foreign shell command",
      status: "VERIFIED",
      grounding: [
        {
          id: "ev-foreign",
          memoryId: "99999999-8888-7777-6666-555555555555",
          type: "STATIC_CHECK",
          payload: "exit 1",
          lastRun: null,
          result: "UNKNOWN",
        },
      ],
      links: [],
    });

    const report = verifyAll(store, dir);
    const r = report.results.find((x) => x.memoryId === "99999999-8888-7777-6666-555555555555")!;
    const outcome = r.outcomes.find((o) => o.type === "STATIC_CHECK")!;
    assert.equal(outcome.result, "SKIPPED");
    assert.match(outcome.detail, /untrusted/);
    // and because it never ran, the memory was NOT marked STALE by it
    assert.notEqual(r.after, "STALE");

    // after explicit approval, it runs (and correctly fails)
    store.trustAllEvidence();
    const report2 = verifyAll(store, dir);
    const r2 = report2.results.find((x) => x.memoryId === "99999999-8888-7777-6666-555555555555")!;
    assert.equal(r2.after, "STALE");
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("runEvidence: deep tier skipped without --deep; HUMAN_ATTESTED passes; TICKET_REF annotates", () => {
  const dir = tempRepo();
  try {
    const base = { id: "e1", memoryId: "m1", lastRun: null, result: "UNKNOWN" as const };
    assert.equal(runEvidence({ ...base, type: "TEST_RESULT", payload: "true" }, dir).result, "SKIPPED");
    assert.equal(runEvidence({ ...base, type: "TEST_RESULT", payload: "true" }, dir, { deep: true }).result, "PASS");
    assert.equal(runEvidence({ ...base, type: "EXEC_TRACE", payload: "echo hello :: hel+o" }, dir, { deep: true }).result, "PASS");
    assert.equal(runEvidence({ ...base, type: "EXEC_TRACE", payload: "echo hello :: nope" }, dir, { deep: true }).result, "FAIL");
    assert.equal(runEvidence({ ...base, type: "HUMAN_ATTESTED", payload: "trust me" }, dir).result, "PASS");
    assert.equal(runEvidence({ ...base, type: "TICKET_REF", payload: "XXX-1" }, dir).result, "SKIPPED");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("checkDiff: warns when staged change resembles a FAILED_APPROACH memory", () => {
  const dir = tempRepo();
  const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
  try {
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
    execFileSync("git", ["config", "user.name", "Test User"], { cwd: dir });

    store.write({
      kind: "FAILED_APPROACH",
      claim: "The approach \"Add automatic retry on declined payments\" was tried and reverted — caused duplicate ledger entries when idempotency keys are missing",
      paths: ["src/payments"],
      appliesWhen: ["original_commit:abc123"],
      trustExecutableEvidence: true,
    });

    // make an initial commit so we have a diff baseline
    mkdirSync(path.join(dir, "src", "payments"), { recursive: true });
    writeFileSync(path.join(dir, "src", "payments", "retry.ts"), "// retry logic");
    execFileSync("git", ["add", "."], { cwd: dir });
    execFileSync("git", ["commit", "-m", "init"], { cwd: dir });

    // staged change re-introduces the failed approach
    writeFileSync(
      path.join(dir, "src", "payments", "retry.ts"),
      [
        "// automatic retry on declined payments",
        "export function retryDeclinedPayments() {",
        "  // idempotency keys missing: this caused duplicate ledger entries",
        "  return fetch('/retry');",
        "}",
      ].join("\n")
    );
    execFileSync("git", ["add", "."], { cwd: dir });

    const report = checkDiff(store, dir);
    assert.equal(report.violations.length, 1);
    assert.equal(report.violations[0].memory.kind, "FAILED_APPROACH");
    assert.equal(report.violations[0].severity, "warn");
    assert.match(report.violations[0].detail, /FAILED_APPROACH/);
    assert.match(report.violations[0].detail, /original_commit:abc123/);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("end-to-end: reverted commit is mined, approved, and warns on re-attempt", () => {
  const dir = tempRepo();
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "Test User"], { cwd: dir });

  const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
  try {
    // 1) initial commit so we have a baseline
    mkdirSync(path.join(dir, "src", "payments"), { recursive: true });
    writeFileSync(path.join(dir, "src", "payments", "retry.ts"), "// initial");
    execFileSync("git", ["add", "."], { cwd: dir });
    execFileSync("git", ["commit", "-m", "init"], { cwd: dir });

    // 2) add a failed approach
    writeFileSync(
      path.join(dir, "src", "payments", "retry.ts"),
      "export function retryDeclinedPayments() { return fetch('/retry'); }"
    );
    execFileSync("git", ["add", "."], { cwd: dir });
    execFileSync(
      "git",
      ["commit", "-m", "Add automatic retry on declined payments", "-m", "Immediate retries without idempotency keys."],
      { cwd: dir }
    );
    const original = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir }).toString().trim();

    // 3) revert the approach
    execFileSync("git", ["revert", "--no-edit", original], { cwd: dir });

    // 4) mine history: should propose a FAILED_APPROACH memory
    const mineResult = mineCommits(store, dir, { full: true });
    assert.equal(mineResult.proposed.length, 1, "expected one FAILED_APPROACH proposal");
    assert.equal(mineResult.proposed[0].kind, "FAILED_APPROACH");
    assert.match(mineResult.proposed[0].claim, /automatic retry/i);

    // 5) human approves the proposal
    const approved = store.approveProposal(mineResult.proposed[0].id, { pinned: true });
    assert.equal(approved.kind, "FAILED_APPROACH");

    // 6) agent re-introduces the failed approach
    writeFileSync(
      path.join(dir, "src", "payments", "retry.ts"),
      "// automatic retry on declined payments\nexport function retryDeclinedPayments() { return fetch('/retry'); }"
    );
    execFileSync("git", ["add", "."], { cwd: dir });

    // 7) dim check warns before the agent commits
    const check = checkDiff(store, dir);
    assert.equal(check.violations.length, 1);
    assert.equal(check.violations[0].memory.kind, "FAILED_APPROACH");
    assert.equal(check.violations[0].severity, "warn");
    assert.match(check.violations[0].detail, /resembles a previously reverted approach/);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("dim check --json outputs structured report with risk score", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "aidimag-json-"));
  try {
    execFileSync("git", ["init", "-q"], { cwd: dir });
    execFileSync("git", ["config", "user.email", "test@test.com"], { cwd: dir });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: dir });
    mkdirSync(path.join(dir, ".aidimag"), { recursive: true });
    mkdirSync(path.join(dir, "src"), { recursive: true });
    writeFileSync(path.join(dir, "src", "a.ts"), "// initial");
    execFileSync("git", ["add", "."], { cwd: dir });
    execFileSync("git", ["commit", "-m", "init"], { cwd: dir });

    const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
    store.write({
      kind: "CONVENTION",
      claim: "All database access goes through src/db/store.ts",
      paths: ["src/"],
    });
    store.close();

    // Make a change
    writeFileSync(path.join(dir, "src", "a.ts"), "// changed");
    execFileSync("git", ["add", "."], { cwd: dir });

    const out = execFileSync(
      process.execPath,
      [path.resolve("dist/cli/index.js"), "check", "--json", "--block"],
      { cwd: dir, encoding: "utf8" }
    );
    const parsed = JSON.parse(out.trim());
    assert.equal(typeof parsed.riskScore, "number");
    assert.ok(parsed.riskScore >= 0 && parsed.riskScore <= 100);
    assert.equal(typeof parsed.riskLevel, "string");
    assert.ok(Array.isArray(parsed.violations));
    assert.ok(Array.isArray(parsed.riskFactors));
    assert.equal(typeof parsed.passed, "boolean");
    assert.ok(Array.isArray(parsed.changedFiles));
    assert.ok(parsed.changedFiles.includes("src/a.ts"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("dim check --risk-threshold exits 1 when score exceeds threshold", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "aidimag-threshold-"));
  try {
    execFileSync("git", ["init", "-q"], { cwd: dir });
    execFileSync("git", ["config", "user.email", "test@test.com"], { cwd: dir });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: dir });
    mkdirSync(path.join(dir, ".aidimag"), { recursive: true });
    mkdirSync(path.join(dir, "src"), { recursive: true });
    writeFileSync(path.join(dir, "src", "a.ts"), "// initial");
    execFileSync("git", ["add", "."], { cwd: dir });
    execFileSync("git", ["commit", "-m", "init"], { cwd: dir });

    const store = new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
    store.write({
      kind: "GUARDRAIL",
      claim: "Never eval",
      paths: ["src/"],
      guardrailLevel: "never",
    });
    store.close();

    // Change that trips the guardrail
    writeFileSync(path.join(dir, "src", "a.ts"), "const result = eval('1 + 2');\n");
    execFileSync("git", ["add", "."], { cwd: dir });

    // With --json and --risk-threshold 0, should exit 1 (any risk > 0)
    let exitCode = 0;
    try {
      execFileSync(
        process.execPath,
        [path.resolve("dist/cli/index.js"), "check", "--json", "--risk-threshold", "0"],
        { cwd: dir, encoding: "utf8" }
      );
    } catch (e: any) {
      exitCode = e.status ?? 1;
    }
    assert.ok(exitCode === 1, `expected exit 1, got ${exitCode}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

