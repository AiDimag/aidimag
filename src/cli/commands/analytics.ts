/**
 * dim analytics — agent/model performance analytics dashboard.
 *
 * Shows tokens saved, violations prevented, verify outcomes, proposal
 * throughput, and agent activity over a configurable time window.
 */

import type { Command } from "commander";
import { MemoryStore, findRepoRoot } from "../../db/store.js";
import { computeAnalytics, type AnalyticsReport } from "../../analytics.js";
import { fail } from "../shared.js";

function renderAnalytics(r: AnalyticsReport): string {
  const lines: string[] = [];

  lines.push("╔══════════════════════════════════════════════════════════╗");
  lines.push("║           AIDimag Performance Analytics                   ║");
  lines.push("╚══════════════════════════════════════════════════════════╝");
  lines.push("");
  lines.push(`Period: ${r.timeRange.since.slice(0, 10)} → ${r.timeRange.until.slice(0, 10)}`);
  lines.push("");

  // Summary
  lines.push("── Summary ────────────────────────────────────────────────");
  lines.push(`  Total memories:     ${r.summary.totalMemories}`);
  lines.push(`  Total events:       ${r.summary.totalEvents}`);
  lines.push(`  Verify runs:        ${r.summary.verifyRuns}`);
  lines.push(`  Avg pass rate:      ${r.summary.avgPassRate}%`);
  lines.push(`  Avg confidence:     ${r.summary.avgConfidence}`);
  lines.push(`  Violations prevented: ${r.summary.violationsPrevented}`);
  lines.push(`  Tokens saved:       ${r.summary.tokensSaved.toLocaleString()}`);
  lines.push("");

  // Memory lifecycle
  lines.push("── Memory Lifecycle ───────────────────────────────────────");
  lines.push(`  Created:       ${r.memoryLifecycle.created}`);
  lines.push(`  Forgotten:     ${r.memoryLifecycle.forgotten}`);
  lines.push(`  Refuted:       ${r.memoryLifecycle.refuted}`);
  lines.push(`  Superseded:    ${r.memoryLifecycle.superseded}`);
  lines.push(`  Evidence added: ${r.memoryLifecycle.evidenceAdded}`);
  lines.push(`  Net growth:    ${r.memoryLifecycle.netGrowth > 0 ? "+" : ""}${r.memoryLifecycle.netGrowth}`);
  lines.push("");

  // Proposal flow
  lines.push("── Proposal Flow ──────────────────────────────────────────");
  lines.push(`  Created:       ${r.proposalFlow.created}`);
  lines.push(`  Approved:      ${r.proposalFlow.approved}`);
  lines.push(`  Rejected:      ${r.proposalFlow.rejected}`);
  lines.push(`  Pending:       ${r.proposalFlow.pending}`);
  lines.push(`  Approval rate: ${r.proposalFlow.approvalRate}%`);
  lines.push("");

  // Verify trend
  if (r.verifyTrend.length > 0) {
    lines.push("── Verify Trend (daily) ───────────────────────────────────");
    for (const v of r.verifyTrend.slice(-10)) {
      const bar = "█".repeat(Math.round(v.passRate / 5)) + "░".repeat(20 - Math.round(v.passRate / 5));
      lines.push(`  ${v.date}  ${bar} ${v.passRate}% (${v.verified}/${v.total} pass)`);
    }
    lines.push("");
  }

  // Kind distribution
  if (r.kindDistribution.length > 0) {
    lines.push("── Memory Kind Distribution ───────────────────────────────");
    lines.push("  Kind               Count  Verified  Stale  Refuted  Avg Evidence");
    lines.push("  " + "─".repeat(68));
    for (const k of r.kindDistribution) {
      lines.push(
        `  ${k.kind.padEnd(18)} ${String(k.count).padStart(5)}  ${String(k.verified).padStart(8)}  ${String(k.stale).padStart(5)}  ${String(k.refuted).padStart(7)}  ${k.evidenceAvg.toFixed(1)}`
      );
    }
    lines.push("");
  }

  // Top agents
  if (r.topAgents.length > 0) {
    lines.push("── Agent Activity ─────────────────────────────────────────");
    for (const a of r.topAgents) {
      lines.push(`  ${a.machine.slice(0, 20).padEnd(20)}  ${String(a.events).padStart(5)} events  ${String(a.memoriesCreated).padStart(3)} created  last: ${a.lastActive.slice(0, 10)}`);
    }
    lines.push("");
  }

  // Token usage
  if (r.tokenUsage.length > 0) {
    lines.push("── Token Usage (daily) ────────────────────────────────────");
    for (const t of r.tokenUsage.slice(-10)) {
      lines.push(`  ${t.date}  requested: ${t.tokensRequested.toLocaleString().padStart(8)}  delivered: ${t.tokensDelivered.toLocaleString().padStart(8)}  saved: ${t.tokensSaved.toLocaleString().padStart(6)}`);
    }
    lines.push("");
  }

  // Insights
  lines.push("── Insights ───────────────────────────────────────────────");
  for (const insight of r.insights) {
    lines.push(`  • ${insight}`);
  }
  lines.push("");

  return lines.join("\n");
}

export function registerAnalyticsCommands(program: Command): void {
  program
    .command("analytics")
    .description("Agent/model performance analytics: tokens saved, violations prevented, verify trends")
    .option("--since <date>", "Start date (ISO or YYYY-MM-DD), default 30 days ago")
    .option("--until <date>", "End date (ISO or YYYY-MM-DD), default now")
    .option("--days <n>", "Last N days (overrides --since)", parseInt)
    .option("--json", "Machine-readable JSON output")
    .action((opts) => {
      const root = findRepoRoot();
      if (!root) fail("not inside a git repo");
      const store = MemoryStore.open(root);

      let since: string | undefined;
      let until: string | undefined;

      if (opts.days) {
        since = new Date(Date.now() - opts.days * 86_400_000).toISOString();
      } else if (opts.since) {
        since = opts.since.length === 10 ? `${opts.since}T00:00:00.000Z` : opts.since;
      }
      if (opts.until) {
        until = opts.until.length === 10 ? `${opts.until}T23:59:59.999Z` : opts.until;
      }

      const report = computeAnalytics(store, { since, until });

      if (opts.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(renderAnalytics(report));
      }

      store.close();
    });
}
