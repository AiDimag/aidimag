/**
 * Agent/model performance analytics.
 *
 * Aggregates data from the events table, memory store, and check/verify
 * history to answer: "Are our AI tools improving delivery without risk?"
 *
 * Metrics tracked:
 *  - Tokens saved (from recall/context budget reports)
 *  - Violations prevented (from check runs)
 *  - Verify outcomes (PASS/FAIL over time)
 *  - Memory lifecycle (created → verified → stale → refuted)
 *  - Proposal throughput (created → approved/rejected)
 *  - Agent activity (which machines/sources are writing)
 */

import type { MemoryStore } from "./db/store.js";
import type { MemoryEntry, MemoryKind, MemoryStatus } from "./types.js";

export interface AnalyticsTimeRange {
  /** ISO timestamp — default 30 days ago */
  since?: string;
  /** ISO timestamp — default now */
  until?: string;
}

export interface VerifyOutcome {
  date: string;
  total: number;
  verified: number;
  stale: number;
  passRate: number;
}

export interface ProposalFlow {
  created: number;
  approved: number;
  rejected: number;
  pending: number;
  approvalRate: number;
}

export interface MemoryLifecycleStats {
  created: number;
  forgotten: number;
  refuted: number;
  superseded: number;
  evidenceAdded: number;
  evidenceRemoved: number;
  netGrowth: number;
}

export interface AgentActivity {
  machine: string;
  events: number;
  memoriesCreated: number;
  lastActive: string;
}

export interface KindDistribution {
  kind: MemoryKind;
  count: number;
  verified: number;
  stale: number;
  refuted: number;
  evidenceAvg: number;
}

export interface TokenUsageStat {
  date: string;
  tokensRequested: number;
  tokensDelivered: number;
  tokensSaved: number;
  memoriesUsed: number;
}

export interface AnalyticsReport {
  generatedAt: string;
  timeRange: { since: string; until: string };
  summary: {
    totalMemories: number;
    totalEvents: number;
    violationsPrevented: number;
    tokensSaved: number;
    verifyRuns: number;
    checkRuns: number;
    avgPassRate: number;
    avgConfidence: number;
  };
  memoryLifecycle: MemoryLifecycleStats;
  proposalFlow: ProposalFlow;
  verifyTrend: VerifyOutcome[];
  kindDistribution: KindDistribution[];
  topAgents: AgentActivity[];
  tokenUsage: TokenUsageStat[];
  insights: string[];
}

type StoreDB = {
  db: {
    prepare: (sql: string) => {
      all: (...args: unknown[]) => Record<string, unknown>[];
      get: (...args: unknown[]) => Record<string, unknown> | undefined;
      run: (...args: unknown[]) => unknown;
    };
  };
};

function getStoreDB(store: MemoryStore): StoreDB {
  return store as unknown as StoreDB;
}

function defaultSince(): string {
  return new Date(Date.now() - 30 * 86_400_000).toISOString();
}

export function computeAnalytics(
  store: MemoryStore,
  range: AnalyticsTimeRange = {}
): AnalyticsReport {
  const since = range.since ?? defaultSince();
  const until = range.until ?? new Date().toISOString();
  const db = getStoreDB(store);

  // --- Event counts in range ---
  const eventCounts = db.db.prepare(
    `SELECT type, COUNT(*) as cnt FROM events
     WHERE created_at >= ? AND created_at <= ?
     GROUP BY type ORDER BY cnt DESC`
  ).all(since, until) as Array<{ type: string; cnt: number }>;

  const eventMap = new Map<string, number>(eventCounts.map((e) => [e.type, e.cnt]));
  const totalEvents = eventCounts.reduce((s, e) => s + e.cnt, 0);

  // --- Memory lifecycle ---
  const memoryLifecycle: MemoryLifecycleStats = {
    created: eventMap.get("memory_created") ?? 0,
    forgotten: eventMap.get("forgotten") ?? 0,
    refuted: eventMap.get("refuted") ?? 0,
    superseded: eventMap.get("superseded") ?? 0,
    evidenceAdded: eventMap.get("evidence_added") ?? 0,
    evidenceRemoved: eventMap.get("evidence_removed") ?? 0,
    netGrowth: 0,
  };
  memoryLifecycle.netGrowth = memoryLifecycle.created - memoryLifecycle.forgotten - memoryLifecycle.refuted;

  // --- Proposal flow ---
  const proposalsCreated = eventMap.get("proposal_created") ?? 0;
  const proposalsApproved = eventMap.get("proposal_approved") ?? 0;
  const proposalsRejected = eventMap.get("proposal_rejected") ?? 0;
  const pendingProposals = store.listProposals("PENDING", 10_000).length;
  const proposalFlow: ProposalFlow = {
    created: proposalsCreated,
    approved: proposalsApproved,
    rejected: proposalsRejected,
    pending: pendingProposals,
    approvalRate: proposalsCreated > 0
      ? Math.round((proposalsApproved / proposalsCreated) * 100)
      : 0,
  };

  // --- Verify trend (daily aggregation) ---
  const verifyRows = db.db.prepare(
    `SELECT DATE(created_at) as date,
            COUNT(*) as total,
            SUM(CASE WHEN json_extract(payload, '$.pass') = 1 THEN 1 ELSE 0 END) as passed,
            SUM(CASE WHEN json_extract(payload, '$.status') = 'STALE' THEN 1 ELSE 0 END) as stale
     FROM events
     WHERE type = 'verification_report' AND created_at >= ? AND created_at <= ?
     GROUP BY DATE(created_at)
     ORDER BY date ASC`
  ).all(since, until) as Array<{ date: string; total: number; passed: number; stale: number }>;

  const verifyTrend: VerifyOutcome[] = verifyRows.map((r) => ({
    date: r.date,
    total: r.total,
    verified: r.passed,
    stale: r.stale,
    passRate: r.total > 0 ? Math.round((r.passed / r.total) * 100) : 0,
  }));

  const verifyRuns = verifyTrend.reduce((s, v) => s + v.total, 0);
  const totalVerified = verifyTrend.reduce((s, v) => s + v.verified, 0);
  const avgPassRate = verifyRuns > 0 ? Math.round((totalVerified / verifyRuns) * 100) : 0;

  // --- Kind distribution ---
  const memories = store.list(10_000);
  const kindMap = new Map<MemoryKind, KindDistribution>();
  for (const m of memories) {
    const k = m.kind;
    const existing = kindMap.get(k);
    if (existing) {
      existing.count++;
      if (m.status === "VERIFIED") existing.verified++;
      if (m.status === "STALE") existing.stale++;
      if (m.status === "REFUTED") existing.refuted++;
      existing.evidenceAvg += m.grounding.length;
    } else {
      kindMap.set(k, {
        kind: k,
        count: 1,
        verified: m.status === "VERIFIED" ? 1 : 0,
        stale: m.status === "STALE" ? 1 : 0,
        refuted: m.status === "REFUTED" ? 1 : 0,
        evidenceAvg: m.grounding.length,
      });
    }
  }
  const kindDistribution = Array.from(kindMap.values()).map((k) => ({
    ...k,
    evidenceAvg: k.count > 0 ? Math.round((k.evidenceAvg / k.count) * 100) / 100 : 0,
  })).sort((a, b) => b.count - a.count);

  // --- Agent activity (by machine) ---
  const agentRows = db.db.prepare(
    `SELECT machine,
            COUNT(*) as events,
            SUM(CASE WHEN type = 'memory_created' THEN 1 ELSE 0 END) as memories_created,
            MAX(created_at) as last_active
     FROM events
     WHERE created_at >= ? AND created_at <= ?
     GROUP BY machine
     ORDER BY events DESC
     LIMIT 10`
  ).all(since, until) as Array<{ machine: string; events: number; memories_created: number; last_active: string }>;

  const topAgents: AgentActivity[] = agentRows.map((r) => ({
    machine: r.machine,
    events: r.events,
    memoriesCreated: r.memories_created,
    lastActive: r.last_active,
  }));

  // --- Token usage (from recall/context events if recorded) ---
  // Token usage is tracked via meta keys set by recall/context commands
  const tokenMetaKeys = db.db.prepare(
    `SELECT key, value FROM meta WHERE key LIKE 'token_usage_%' AND key >= ?`
  ).all(`token_usage_${since}`) as Array<{ key: string; value: string }>;

  const tokenUsage: TokenUsageStat[] = [];
  let totalTokensSaved = 0;
  for (const row of tokenMetaKeys) {
    try {
      const data = JSON.parse(row.value) as {
        date: string;
        tokensRequested: number;
        tokensDelivered: number;
        memoriesUsed: number;
      };
      const saved = data.tokensRequested - data.tokensDelivered;
      totalTokensSaved += saved;
      tokenUsage.push({
        date: data.date,
        tokensRequested: data.tokensRequested,
        tokensDelivered: data.tokensDelivered,
        tokensSaved: saved,
        memoriesUsed: data.memoriesUsed,
      });
    } catch { /* skip malformed */ }
  }
  tokenUsage.sort((a, b) => a.date.localeCompare(b.date));

  // --- Violations prevented ---
  // Count check-related events or derive from risk score events
  const checkRuns = db.db.prepare(
    `SELECT COUNT(DISTINCT DATE(created_at)) as days
     FROM events
     WHERE type = 'verification_report' AND created_at >= ? AND created_at <= ?`
  ).get(since, until) as { days: number } | undefined;

  // Violations prevented = memories that are GUARDRAIL or FAILED_APPROACH that are VERIFIED
  // (they actively prevent bad agent behavior)
  const violationsPrevented = memories.filter(
    (m) => (m.kind === "GUARDRAIL" || m.kind === "FAILED_APPROACH") && m.status === "VERIFIED"
  ).length;

  // --- Average confidence ---
  const avgConfidence = memories.length > 0
    ? Math.round((memories.reduce((s, m) => s + m.confidence, 0) / memories.length) * 100) / 100
    : 0;

  // --- Insights ---
  const insights: string[] = [];

  if (memoryLifecycle.netGrowth > 0) {
    insights.push(`Memory store grew by ${memoryLifecycle.netGrowth} memories in the selected period.`);
  } else if (memoryLifecycle.netGrowth < 0) {
    insights.push(`Memory store shrank by ${Math.abs(memoryLifecycle.netGrowth)} memories — retention or cleanup is active.`);
  }

  if (avgPassRate > 80) {
    insights.push(`Evidence pass rate is ${avgPassRate}% — memories are well-supported.`);
  } else if (avgPassRate > 0 && avgPassRate < 50) {
    insights.push(`Evidence pass rate is only ${avgPassRate}% — many memories are going stale. Run \`dim verify\` and add evidence.`);
  }

  if (proposalFlow.approvalRate > 0 && proposalFlow.approvalRate < 50) {
    insights.push(`Proposal approval rate is ${proposalFlow.approvalRate}% — agents are proposing low-quality memories. Review guardrails.`);
  }

  if (violationsPrevented > 0) {
    insights.push(`${violationsPrevented} verified guardrails/failed-approaches are actively preventing bad agent behavior.`);
  }

  if (totalTokensSaved > 0) {
    insights.push(`Saved ${totalTokensSaved.toLocaleString()} tokens via budgeted retrieval.`);
  }

  if (topAgents.length > 1) {
    insights.push(`${topAgents.length} active machines contributing to the memory store.`);
  }

  const staleCount = kindDistribution.reduce((s, k) => s + k.stale, 0);
  if (staleCount > memories.length * 0.2) {
    insights.push(`${staleCount} memories are STALE (>20% of store) — schedule a \`dim verify\` run.`);
  }

  if (insights.length === 0) {
    insights.push("Not enough data for insights. Use `dim verify` and `dim check` regularly to build analytics.");
  }

  return {
    generatedAt: new Date().toISOString(),
    timeRange: { since, until },
    summary: {
      totalMemories: memories.length,
      totalEvents,
      violationsPrevented,
      tokensSaved: totalTokensSaved,
      verifyRuns,
      checkRuns: checkRuns?.days ?? 0,
      avgPassRate,
      avgConfidence,
    },
    memoryLifecycle,
    proposalFlow,
    verifyTrend,
    kindDistribution,
    topAgents,
    tokenUsage,
    insights,
  };
}

/** Record token usage for analytics tracking. Called by recall/context commands. */
export function recordTokenUsage(
  store: MemoryStore,
  opts: { tokensRequested: number; tokensDelivered: number; memoriesUsed: number }
): void {
  const date = new Date().toISOString().slice(0, 10);
  const key = `token_usage_${date}`;
  const db = getStoreDB(store);

  // Aggregate into the day's entry
  const existing = db.db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as
    | { value: string } | undefined;

  let data: { date: string; tokensRequested: number; tokensDelivered: number; memoriesUsed: number };
  if (existing) {
    data = JSON.parse(existing.value) as typeof data;
    data.tokensRequested += opts.tokensRequested;
    data.tokensDelivered += opts.tokensDelivered;
    data.memoriesUsed += opts.memoriesUsed;
  } else {
    data = {
      date,
      tokensRequested: opts.tokensRequested,
      tokensDelivered: opts.tokensDelivered,
      memoriesUsed: opts.memoriesUsed,
    };
  }

  db.db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)").run(key, JSON.stringify(data));
}
