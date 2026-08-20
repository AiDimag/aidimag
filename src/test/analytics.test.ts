import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { MemoryStore } from "../db/store.js";
import { computeAnalytics, recordTokenUsage } from "../analytics.js";

function tempRepo(): string {
  return mkdtempSync(path.join(tmpdir(), "aidimag-analytics-"));
}

function makeStore(dir: string): MemoryStore {
  return new MemoryStore(path.join(dir, ".aidimag", "memory.db"));
}

test("analytics: empty store produces valid report with zeroed metrics", () => {
  const dir = tempRepo();
  const store = makeStore(dir);
  try {
    const report = computeAnalytics(store);
    assert.equal(report.summary.totalMemories, 0);
    assert.equal(report.summary.totalEvents, 0);
    assert.equal(report.summary.violationsPrevented, 0);
    assert.equal(report.summary.tokensSaved, 0);
    assert.equal(report.memoryLifecycle.created, 0);
    assert.equal(report.proposalFlow.created, 0);
    assert.equal(report.kindDistribution.length, 0);
    assert.equal(report.topAgents.length, 0);
    assert.ok(report.insights.length > 0);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("analytics: tracks memory lifecycle events", () => {
  const dir = tempRepo();
  const store = makeStore(dir);
  try {
    store.write({
      kind: "GOTCHA",
      claim: "Test gotcha",
      createdBy: "test",
    });
    store.write({
      kind: "CONVENTION",
      claim: "Test convention",
      createdBy: "test",
    });

    const report = computeAnalytics(store);
    assert.equal(report.summary.totalMemories, 2);
    assert.equal(report.memoryLifecycle.created, 2);
    assert.equal(report.memoryLifecycle.netGrowth, 2);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("analytics: tracks kind distribution correctly", () => {
  const dir = tempRepo();
  const store = makeStore(dir);
  try {
    store.write({ kind: "GOTCHA", claim: "G1", createdBy: "test" });
    store.write({ kind: "GOTCHA", claim: "G2", createdBy: "test" });
    store.write({ kind: "GUARDRAIL", claim: "GR1", createdBy: "test" });
    store.write({ kind: "CONVENTION", claim: "C1", createdBy: "test" });

    const report = computeAnalytics(store);
    const gotcha = report.kindDistribution.find((k) => k.kind === "GOTCHA");
    assert.ok(gotcha);
    assert.equal(gotcha!.count, 2);

    const guardrail = report.kindDistribution.find((k) => k.kind === "GUARDRAIL");
    assert.ok(guardrail);
    assert.equal(guardrail!.count, 1);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("analytics: counts verified guardrails as violations prevented", () => {
  const dir = tempRepo();
  const store = makeStore(dir);
  try {
    const id1 = store.write({
      kind: "GUARDRAIL",
      claim: "Never commit secrets",
      createdBy: "test",
      guardrailLevel: "never",
    }).id;
    store.write({
      kind: "FAILED_APPROACH",
      claim: "Don't use direct DB calls in routes",
      createdBy: "test",
    });
    store.write({
      kind: "GOTCHA",
      claim: "Regular gotcha",
      createdBy: "test",
    });

    // Mark the guardrail as verified
    store.setStatus(id1, "VERIFIED");

    const report = computeAnalytics(store);
    // GUARDRAIL is verified → counts as violation prevented
    // FAILED_APPROACH is not verified → doesn't count
    assert.equal(report.summary.violationsPrevented, 1);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("analytics: recordTokenUsage aggregates daily", () => {
  const dir = tempRepo();
  const store = makeStore(dir);
  try {
    recordTokenUsage(store, { tokensRequested: 1000, tokensDelivered: 600, memoriesUsed: 5 });
    recordTokenUsage(store, { tokensRequested: 800, tokensDelivered: 500, memoriesUsed: 3 });

    const report = computeAnalytics(store);
    assert.equal(report.tokenUsage.length, 1); // same day, aggregated
    assert.equal(report.tokenUsage[0].tokensRequested, 1800);
    assert.equal(report.tokenUsage[0].tokensDelivered, 1100);
    assert.equal(report.tokenUsage[0].tokensSaved, 700);
    assert.equal(report.tokenUsage[0].memoriesUsed, 8);
    assert.equal(report.summary.tokensSaved, 700);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("analytics: proposal flow tracks approvals and rejections", () => {
  const dir = tempRepo();
  const store = makeStore(dir);
  try {
    store.propose({
      kind: "GOTCHA",
      claim: "Proposed gotcha 1",
      source: "test",
    });
    store.propose({
      kind: "GOTCHA",
      claim: "Proposed gotcha 2",
      source: "test",
    });

    const proposals = store.listProposals("PENDING", 100);
    store.approveProposal(proposals[0].id);
    store.rejectProposal(proposals[1].id);

    const report = computeAnalytics(store);
    assert.equal(report.proposalFlow.created, 2);
    assert.equal(report.proposalFlow.approved, 1);
    assert.equal(report.proposalFlow.rejected, 1);
    assert.equal(report.proposalFlow.pending, 0);
    assert.equal(report.proposalFlow.approvalRate, 50);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("analytics: verify trend shows daily pass rates", () => {
  const dir = tempRepo();
  const store = makeStore(dir);
  try {
    const id = store.write({
      kind: "GOTCHA",
      claim: "Test gotcha with evidence",
      createdBy: "test",
      evidence: [{ type: "STATIC_CHECK", payload: "true" }],
    }).id;

    // Record a verification event
    store.recordEvent("verification_report", id, {
      head: "abc123",
      status: "VERIFIED",
      confidence: 0.9,
      pass: true,
      deep: false,
    });

    const report = computeAnalytics(store);
    assert.equal(report.verifyTrend.length, 1);
    assert.equal(report.verifyTrend[0].total, 1);
    assert.equal(report.verifyTrend[0].verified, 1);
    assert.equal(report.verifyTrend[0].passRate, 100);
    assert.equal(report.summary.avgPassRate, 100);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("analytics: --days option limits time range", () => {
  const dir = tempRepo();
  const store = makeStore(dir);
  try {
    store.write({ kind: "GOTCHA", claim: "Old memory", createdBy: "test" });

    // Query with 0 days — should exclude everything
    const since = new Date(Date.now() + 1000).toISOString(); // 1 second in future
    const report = computeAnalytics(store, { since });
    assert.equal(report.memoryLifecycle.created, 0); // event was before "since"
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("analytics: insights include growth and health signals", () => {
  const dir = tempRepo();
  const store = makeStore(dir);
  try {
    store.write({ kind: "GOTCHA", claim: "G1", createdBy: "test" });
    store.write({ kind: "GOTCHA", claim: "G2", createdBy: "test" });
    store.write({ kind: "GOTCHA", claim: "G3", createdBy: "test" });

    const report = computeAnalytics(store);
    const growthInsight = report.insights.find((i) => i.includes("grew by"));
    assert.ok(growthInsight, "Should have a growth insight");
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("analytics: agent activity tracks machines", () => {
  const dir = tempRepo();
  const store = makeStore(dir);
  try {
    store.write({ kind: "GOTCHA", claim: "G1", createdBy: "test" });
    store.write({ kind: "GOTCHA", claim: "G2", createdBy: "test" });

    const report = computeAnalytics(store);
    assert.ok(report.topAgents.length >= 1);
    assert.ok(report.topAgents[0].events > 0);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
