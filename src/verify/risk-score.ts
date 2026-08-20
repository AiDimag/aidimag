/**
 * AI change-risk score.
 *
 * Combines memory status, confidence, evidence, file scope, and critical-area
 * membership into a 0–100 risk score for a set of changed files. The score is
 * designed to surface changes that need human review before merge.
 *
 * Factors:
 *  - Violation severity (fail > warn)
 *  - Memory kind (GUARDRAIL/FAILED_APPROACH > INVARIANT > CONVENTION > other)
 *  - Memory status (REFUTED > STALE > UNVERIFIED > VERIFIED)
 *  - Confidence (lower confidence → higher risk)
 *  - Evidence count (more evidence → lower risk for that memory)
 *  - Critical-area membership (adds a flat risk bonus)
 *  - Number of changed files (broader changes → higher risk)
 */

import type { CheckReport, CheckViolation } from "./check.js";
import type { CriticalAreaViolation } from "./critical-areas.js";
import type { MemoryEntry, MemoryKind, MemoryStatus } from "../types.js";

export interface RiskScore {
  score: number;
  level: "low" | "medium" | "high" | "critical";
  factors: RiskFactor[];
}

export interface RiskFactor {
  label: string;
  contribution: number;
  detail?: string;
}

const KIND_WEIGHT: Record<MemoryKind, number> = {
  GUARDRAIL: 30,
  FAILED_APPROACH: 25,
  INVARIANT: 20,
  CONVENTION: 12,
  ARCHITECTURE: 10,
  DECISION: 8,
  GOTCHA: 8,
  SKILL: 5,
  TODO_CONTEXT: 3,
};

const STATUS_MULTIPLIER: Record<MemoryStatus, number> = {
  REFUTED: 1.5,
  STALE: 1.3,
  UNVERIFIED: 1.1,
  VERIFIED: 1.0,
};

const SEVERITY_BASE: Record<string, number> = {
  fail: 40,
  warn: 15,
};

const CRITICAL_AREA_BONUS = 25;
const FILE_COUNT_THRESHOLD = 5;
const FILE_COUNT_BONUS = 10;

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function riskLevel(score: number): RiskScore["level"] {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 30) return "medium";
  return "low";
}

/**
 * Compute a risk score for a check report plus any critical-area violations.
 */
export function computeRiskScore(
  report: CheckReport,
  areaViolations: CriticalAreaViolation[] = []
): RiskScore {
  const factors: RiskFactor[] = [];

  // 1) Violation-based risk
  for (const v of report.violations) {
    const base = SEVERITY_BASE[v.severity] ?? 10;
    const kindWeight = KIND_WEIGHT[v.memory.kind] ?? 10;
    const statusMult = STATUS_MULTIPLIER[v.memory.status] ?? 1.0;
    const confidenceFactor = 1 - (v.memory.confidence ?? 0.5) * 0.15;
    const evidenceCount = v.memory.grounding?.length ?? 0;
    const evidenceDiscount = Math.min(evidenceCount * 2, 10);

    const contribution = clampScore(
      (base + kindWeight * 0.5) * statusMult * confidenceFactor - evidenceDiscount
    );

    if (contribution > 0) {
      factors.push({
        label: `${v.memory.kind} violation (${v.severity})`,
        contribution,
        detail: v.detail.slice(0, 120),
      });
    }
  }

  // 2) Critical-area risk
  for (const av of areaViolations) {
    const contribution = av.severity === "fail" ? CRITICAL_AREA_BONUS : CRITICAL_AREA_BONUS * 0.5;
    factors.push({
      label: `Critical area: ${av.area.label}`,
      contribution: Math.round(contribution),
      detail: `${av.changedFiles.length} file(s) touched`,
    });
  }

  // 3) Broad-change risk
  if (report.changedFiles.length > FILE_COUNT_THRESHOLD) {
    factors.push({
      label: `Broad change (${report.changedFiles.length} files)`,
      contribution: FILE_COUNT_BONUS,
    });
  }

  // 4) Unverified memories in scope (even without a violation)
  const unverifiedInScope = report.violations.length === 0 ? 0 : 0; // already counted via violations
  // This is intentionally 0 — violations already capture unverified memories.

  // Aggregate: take the max single-factor contribution, then add diminishing
  // returns from additional factors. This prevents a single noisy memory from
  // dominating, while still escalating when multiple signals align.
  let score = 0;
  if (factors.length > 0) {
    const sorted = factors.map((f) => f.contribution).sort((a, b) => b - a);
    score = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      score += sorted[i] * (0.5 / i);
    }
  }

  // No memories checked and no critical areas → minimal risk
  if (report.checked === 0 && areaViolations.length === 0 && report.changedFiles.length === 0) {
    score = 0;
  } else if (report.checked === 0 && areaViolations.length === 0) {
    // Changed files but no memories in scope → low risk (unknown territory)
    score = Math.min(score + 5, 20);
  }

  score = clampScore(score);
  return { score, level: riskLevel(score), factors };
}

/**
 * Render a risk score as a human-readable string for CLI output.
 */
export function renderRiskScore(risk: RiskScore): string {
  const bar = "█".repeat(Math.round(risk.score / 5)) + "░".repeat(20 - Math.round(risk.score / 5));
  const lines = [
    `Risk Score: ${risk.score}/100 [${risk.level.toUpperCase()}]`,
    `  ${bar}`,
  ];
  if (risk.factors.length) {
    lines.push("  Factors:");
    for (const f of risk.factors) {
      lines.push(`    +${f.contribution} ${f.label}${f.detail ? ` — ${f.detail}` : ""}`);
    }
  } else {
    lines.push("  No risk factors detected.");
  }
  return lines.join("\n");
}
