/**
 * Team knowledge health dashboard — compute risk/coverage metrics for the memory store.
 */

import type { MemoryStore } from "./db/store.js";
import type { MemoryEntry, MemoryKind, MemoryStatus } from "./types.js";

export interface PathRisk {
  path: string;
  memories: number;
  stale: number;
  guardrails: number;
  failedApproaches: number;
  riskScore: number;
}

export interface RepeatedMistakeTrend {
  /** path or area where mistakes repeat */
  area: string;
  /** number of FAILED_APPROACH memories in this area */
  count: number;
  /** dates of the failed approaches (ISO) */
  dates: string[];
  /** trend direction: increasing, stable, or decreasing */
  trend: "increasing" | "stable" | "decreasing";
}

export interface AlertThresholds {
  /** max stale memories before alert */
  maxStale?: number;
  /** max pending proposals before alert */
  maxPending?: number;
  /** max risk score before alert (0-100) */
  maxRiskScore?: number;
  /** max repeated mistakes in a single area before alert */
  maxRepeatedMistakes?: number;
}

export interface HealthReport {
  summary: {
    total: number;
    byStatus: Record<MemoryStatus, number>;
    byKind: Partial<Record<MemoryKind, number>>;
    pinned: number;
    unverified: number;
    stale: number;
    refuted: number;
    failedApproaches: number;
    pendingProposals: number;
    coveragePaths: number;
    riskScore: number; // 0..100, higher = more concerning
  };
  topRisks: PathRisk[];
  oldestStale: MemoryEntry[];
  repeatedMistakeTrends: RepeatedMistakeTrend[];
  alerts: string[];
  suggestions: string[];
}

function pathOf(m: MemoryEntry, fallback = "<repo-wide>"): string {
  return m.scope.paths[0] ?? fallback;
}

function daysSince(iso: string | null): number {
  if (!iso) return 0;
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
}

export function computeHealth(store: MemoryStore, thresholds?: AlertThresholds): HealthReport {
  const memories = store.list(10_000);
  const pendingProposalsList = store.listProposals("PENDING", 10_000);

  const byStatus: Record<MemoryStatus, number> = { VERIFIED: 0, UNVERIFIED: 0, STALE: 0, REFUTED: 0 };
  const byKind: Partial<Record<MemoryKind, number>> = {};
  let pinned = 0;
  let riskScore = 0;

  for (const m of memories) {
    byStatus[m.status] = (byStatus[m.status] as number) + 1;
    byKind[m.kind] = ((byKind[m.kind] ?? 0) as number) + 1;
    if (m.pinned) pinned++;
  }

  const failedApproaches = byKind["FAILED_APPROACH"] ?? 0;

  // Risk scoring: stale/refuted and failed approaches are the strongest signals.
  const total = memories.length || 1;
  const stalenessRatio = (byStatus.STALE + byStatus.REFUTED) / total;
  riskScore += Math.round(stalenessRatio * 40); // up to 40 points
  riskScore += Math.min(30, failedApproaches * 5); // up to 30 points
  riskScore += Math.min(20, pendingProposalsList.length * 2); // up to 20 points
  riskScore = Math.min(100, riskScore);

  // Path-level rollup (group by first scoped path; repo-wide memories go into a bucket).
  const pathMap = new Map<string, PathRisk>();
  for (const m of memories) {
    const key = pathOf(m);
    const existing = pathMap.get(key);
    if (existing) {
      existing.memories++;
      if (m.status === "STALE") existing.stale++;
      if (m.kind === "GUARDRAIL") existing.guardrails++;
      if (m.kind === "FAILED_APPROACH") existing.failedApproaches++;
    } else {
      pathMap.set(key, {
        path: key,
        memories: 1,
        stale: m.status === "STALE" ? 1 : 0,
        guardrails: m.kind === "GUARDRAIL" ? 1 : 0,
        failedApproaches: m.kind === "FAILED_APPROACH" ? 1 : 0,
        riskScore: 0,
      });
    }
  }

  for (const r of pathMap.values()) {
    // Risk score per path: weight stale/failed-approach over raw count.
    r.riskScore = Math.min(
      100,
      Math.round(
        (r.stale * 15) + (r.failedApproaches * 20) + (r.guardrails * 5) + Math.log2(r.memories + 1) * 2
      )
    );
  }

  const topRisks = Array.from(pathMap.values()).sort((a, b) => b.riskScore - a.riskScore).slice(0, 10);

  const oldestStale = memories
    .filter((m) => m.status === "STALE")
    .sort((a, b) => daysSince(a.updatedAt) - daysSince(b.updatedAt))
    .slice(0, 5);

  // Repeated-mistake trends: group FAILED_APPROACH memories by path, detect trend.
  const mistakeMap = new Map<string, { area: string; dates: string[] }>();
  for (const m of memories) {
    if (m.kind !== "FAILED_APPROACH") continue;
    const area = pathOf(m);
    const existing = mistakeMap.get(area);
    if (existing) {
      existing.dates.push(m.createdAt);
    } else {
      mistakeMap.set(area, { area, dates: [m.createdAt] });
    }
  }

  const repeatedMistakeTrends: RepeatedMistakeTrend[] = [];
  for (const { area, dates } of mistakeMap.values()) {
    dates.sort();
    const count = dates.length;
    let trend: "increasing" | "stable" | "decreasing" = "stable";
    if (count >= 3) {
      // Compare first half vs second half frequency
      const mid = Math.floor(count / 2);
      const firstHalfSpan = dates.length > 1 ? daysSince(dates[mid - 1]) - daysSince(dates[0]) : 0;
      const secondHalfSpan = dates.length > mid + 1 ? daysSince(dates[count - 1]) - daysSince(dates[mid]) : 0;
      if (secondHalfSpan < firstHalfSpan * 0.6) trend = "increasing";
      else if (secondHalfSpan > firstHalfSpan * 1.5) trend = "decreasing";
    }
    repeatedMistakeTrends.push({ area, count, dates, trend });
  }
  repeatedMistakeTrends.sort((a, b) => b.count - a.count);

  // Alerts based on configurable thresholds
  const alerts: string[] = [];
  const t = thresholds ?? {};
  if (t.maxStale !== undefined && byStatus.STALE > t.maxStale) {
    alerts.push(`⚠️ Stale memories (${byStatus.STALE}) exceed threshold (${t.maxStale}).`);
  }
  if (t.maxPending !== undefined && pendingProposalsList.length > t.maxPending) {
    alerts.push(`⚠️ Pending proposals (${pendingProposalsList.length}) exceed threshold (${t.maxPending}).`);
  }
  if (t.maxRiskScore !== undefined && riskScore > t.maxRiskScore) {
    alerts.push(`⚠️ Risk score (${riskScore}) exceeds threshold (${t.maxRiskScore}).`);
  }
  if (t.maxRepeatedMistakes !== undefined) {
    for (const rmt of repeatedMistakeTrends) {
      if (rmt.count > t.maxRepeatedMistakes) {
        alerts.push(`⚠️ Repeated mistakes in ${rmt.area} (${rmt.count}) exceed threshold (${t.maxRepeatedMistakes}).`);
      }
    }
  }

  const suggestions: string[] = [];
  if (byStatus.STALE > 0) suggestions.push(`Review ${byStatus.STALE} stale memory(ies) with \`dim audit\` or \`dim verify\`.`);
  if (pendingProposalsList.length > 0) {
    suggestions.push(`Approve or reject ${pendingProposalsList.length} pending proposal(s) with \`dim review\`.`);
  }
  if (failedApproaches > 0) {
    suggestions.push(`Ensure every agent sees the ${failedApproaches} FAILED_APPROACH memory(ies) via \`dim generate-context\`.`);
  }
  if (byStatus.UNVERIFIED > byStatus.VERIFIED && memories.length > 5) {
    suggestions.push(`More unverified than verified memories — run evidence with \`dim verify\` to raise trust.`);
  }
  for (const rmt of repeatedMistakeTrends) {
    if (rmt.trend === "increasing") {
      suggestions.push(`Repeated failures in ${rmt.area} are increasing — consider a guardrail or training.`);
    }
  }
  if (suggestions.length === 0) suggestions.push("Store looks healthy. Keep capturing decisions and verifying memories.");

  return {
    summary: {
      total: memories.length,
      byStatus,
      byKind,
      pinned,
      unverified: byStatus.UNVERIFIED,
      stale: byStatus.STALE,
      refuted: byStatus.REFUTED,
      failedApproaches,
      pendingProposals: pendingProposalsList.length,
      coveragePaths: pathMap.size,
      riskScore,
    },
    topRisks,
    oldestStale,
    repeatedMistakeTrends,
    alerts,
    suggestions,
  };
}
