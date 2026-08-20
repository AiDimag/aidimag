import { test } from "node:test";
import assert from "node:assert/strict";
import { computeRiskScore, renderRiskScore } from "../verify/risk-score.js";
import type { CheckReport, CheckViolation } from "../verify/check.js";
import type { CriticalAreaViolation } from "../verify/critical-areas.js";
import type { MemoryEntry } from "../types.js";

function makeMemory(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    id: "test-id",
    kind: "CONVENTION",
    claim: "Always use async functions",
    scope: { paths: ["src/"], symbols: [] },
    confidence: 0.8,
    status: "VERIFIED",
    pinned: false,
    createdBy: "human",
    createdAt: new Date().toISOString(),
    verifiedAt: new Date().toISOString(),
    supersededBy: null,
    updatedAt: null,
    grounding: [],
    links: [],
    ...overrides,
  };
}

function makeViolation(overrides: Partial<CheckViolation> = {}): CheckViolation {
  return {
    memory: makeMemory(),
    severity: "warn",
    detail: "test violation",
    ...overrides,
  };
}

function makeReport(overrides: Partial<CheckReport> = {}): CheckReport {
  return {
    changedFiles: ["src/index.ts"],
    checked: 1,
    violations: [],
    ...overrides,
  };
}

test("computeRiskScore returns 0 for no changes", () => {
  const report = makeReport({ changedFiles: [], checked: 0, violations: [] });
  const risk = computeRiskScore(report);
  assert.equal(risk.score, 0);
  assert.equal(risk.level, "low");
  assert.equal(risk.factors.length, 0);
});

test("computeRiskScore returns low for changes with no memories in scope", () => {
  const report = makeReport({ changedFiles: ["src/new.ts"], checked: 0, violations: [] });
  const risk = computeRiskScore(report);
  assert.ok(risk.score <= 20);
  assert.equal(risk.level, "low");
});

test("computeRiskScore escalates with fail violations", () => {
  const report = makeReport({
    changedFiles: ["src/auth.ts"],
    checked: 1,
    violations: [
      makeViolation({
        severity: "fail",
        memory: makeMemory({ kind: "GUARDRAIL", status: "VERIFIED", confidence: 0.9 }),
        detail: "NEVER guardrail tripped",
      }),
    ],
  });
  const risk = computeRiskScore(report);
  assert.ok(risk.score >= 45, `expected >= 45, got ${risk.score}`);
  assert.ok(risk.level === "medium" || risk.level === "high" || risk.level === "critical");
  assert.ok(risk.factors.length >= 1);
});

test("computeRiskScore is higher for REFUTED than VERIFIED", () => {
  const verifiedReport = makeReport({
    changedFiles: ["src/"],
    checked: 1,
    violations: [
      makeViolation({
        severity: "warn",
        memory: makeMemory({ status: "VERIFIED", confidence: 0.8 }),
      }),
    ],
  });
  const refutedReport = makeReport({
    changedFiles: ["src/"],
    checked: 1,
    violations: [
      makeViolation({
        severity: "warn",
        memory: makeMemory({ status: "REFUTED", confidence: 0.8 }),
      }),
    ],
  });
  const verifiedRisk = computeRiskScore(verifiedReport);
  const refutedRisk = computeRiskScore(refutedReport);
  assert.ok(refutedRisk.score > verifiedRisk.score, `refuted ${refutedRisk.score} should be > verified ${verifiedRisk.score}`);
});

test("computeRiskScore is higher for low confidence memories", () => {
  const highConf = computeRiskScore(
    makeReport({
      changedFiles: ["src/"],
      checked: 1,
      violations: [makeViolation({ memory: makeMemory({ confidence: 0.9 }) })],
    })
  );
  const lowConf = computeRiskScore(
    makeReport({
      changedFiles: ["src/"],
      checked: 1,
      violations: [makeViolation({ memory: makeMemory({ confidence: 0.2 }) })],
    })
  );
  assert.ok(lowConf.score > highConf.score, `low conf ${lowConf.score} should be > high conf ${highConf.score}`);
});

test("computeRiskScore adds critical area bonus", () => {
  const report = makeReport({ changedFiles: ["src/auth/login.ts"], checked: 0, violations: [] });
  const areaViolation: CriticalAreaViolation = {
    area: { label: "Auth", paths: ["src/auth"], block: true },
    changedFiles: ["src/auth/login.ts"],
    severity: "fail",
    detail: "Change touches critical area",
  };
  const risk = computeRiskScore(report, [areaViolation]);
  assert.ok(risk.score >= 25, `expected >= 25, got ${risk.score}`);
  assert.ok(risk.factors.some((f) => f.label.includes("Auth")));
});

test("computeRiskScore adds broad change factor", () => {
  const report = makeReport({
    changedFiles: ["a.ts", "b.ts", "c.ts", "d.ts", "e.ts", "f.ts"],
    checked: 0,
    violations: [],
  });
  const risk = computeRiskScore(report);
  assert.ok(risk.factors.some((f) => f.label.includes("Broad change")));
});

test("computeRiskScore aggregates multiple factors with diminishing returns", () => {
  const report = makeReport({
    changedFiles: ["src/auth/login.ts", "src/auth/session.ts", "src/auth/token.ts"],
    checked: 2,
    violations: [
      makeViolation({
        severity: "fail",
        memory: makeMemory({ kind: "GUARDRAIL", confidence: 0.5 }),
      }),
      makeViolation({
        severity: "warn",
        memory: makeMemory({ kind: "FAILED_APPROACH", confidence: 0.6 }),
      }),
    ],
  });
  const areaViolation: CriticalAreaViolation = {
    area: { label: "Auth", paths: ["src/auth"], block: true },
    changedFiles: ["src/auth/login.ts"],
    severity: "fail",
    detail: "Critical area touched",
  };
  const risk = computeRiskScore(report, [areaViolation]);
  assert.ok(risk.score >= 60, `expected >= 60, got ${risk.score}`);
  assert.ok(risk.factors.length >= 3);
});

test("renderRiskScore produces readable output", () => {
  const risk = computeRiskScore(
    makeReport({
      changedFiles: ["src/auth.ts"],
      checked: 1,
      violations: [
        makeViolation({
          severity: "fail",
          memory: makeMemory({ kind: "GUARDRAIL", confidence: 0.5 }),
          detail: "Guardrail tripped",
        }),
      ],
    })
  );
  const rendered = renderRiskScore(risk);
  assert.match(rendered, /Risk Score: \d+\/100/);
  assert.match(rendered, /(LOW|MEDIUM|HIGH|CRITICAL)/);
  assert.match(rendered, /Factors:/);
});

test("renderRiskScore shows no factors message when clean", () => {
  const risk = computeRiskScore(makeReport({ changedFiles: [], checked: 0, violations: [] }));
  const rendered = renderRiskScore(risk);
  assert.match(rendered, /No risk factors/);
});
