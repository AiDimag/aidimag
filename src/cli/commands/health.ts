import type { Command } from "commander";
import { MemoryStore, findRepoRoot } from "../../db/store.js";
import { computeHealth, type AlertThresholds } from "../../health.js";
import { fail } from "../shared.js";

export function registerHealthCommands(program: Command) {
  program
    .command("health")
    .description("Show a knowledge-health dashboard for the memory store")
    .option("-f, --format <fmt>", "Output format: text or json", "text")
    .option("--max-stale <n>", "Alert threshold: max stale memories", parseInt)
    .option("--max-pending <n>", "Alert threshold: max pending proposals", parseInt)
    .option("--max-risk-score <n>", "Alert threshold: max risk score (0-100)", parseInt)
    .option("--max-repeated-mistakes <n>", "Alert threshold: max repeated mistakes per area", parseInt)
    .action(async (opts) => {
      const root = findRepoRoot() ?? fail("not inside a repo");
      const store = MemoryStore.open(root);
      try {
        const thresholds: AlertThresholds = {};
        if (opts.maxStale !== undefined) thresholds.maxStale = opts.maxStale;
        if (opts.maxPending !== undefined) thresholds.maxPending = opts.maxPending;
        if (opts.maxRiskScore !== undefined) thresholds.maxRiskScore = opts.maxRiskScore;
        if (opts.maxRepeatedMistakes !== undefined) thresholds.maxRepeatedMistakes = opts.maxRepeatedMistakes;

        const report = computeHealth(store, Object.keys(thresholds).length ? thresholds : undefined);
        if (opts.format === "json") {
          console.log(JSON.stringify(report, null, 2));
          return;
        }

        console.log(`Memory Store Health — ${root}`);
        console.log(`Total memories: ${report.summary.total}`);
        console.log(`Risk score: ${report.summary.riskScore}/100`);
        console.log("");
        console.log("Status counts:");
        for (const [status, count] of Object.entries(report.summary.byStatus)) {
          console.log(`  ${status}: ${count}`);
        }
        console.log("");
        console.log("Kind counts:");
        for (const [kind, count] of Object.entries(report.summary.byKind)) {
          console.log(`  ${kind}: ${count}`);
        }
        console.log("");
        console.log(`Pinned: ${report.summary.pinned}  |  Pending proposals: ${report.summary.pendingProposals}  |  Coverage paths: ${report.summary.coveragePaths}`);
        console.log("");

        if (report.alerts.length) {
          console.log("Alerts:");
          for (const a of report.alerts) {
            console.log(`  ${a}`);
          }
          console.log("");
        }

        if (report.topRisks.length) {
          console.log("Top risky areas (by path):");
          for (const r of report.topRisks.slice(0, 5)) {
            console.log(`  ${r.path}: score ${r.riskScore} | ${r.memories} memories, ${r.stale} stale, ${r.guardrails} guardrails, ${r.failedApproaches} failed approaches`);
          }
          console.log("");
        }

        if (report.repeatedMistakeTrends.length) {
          console.log("Repeated-mistake trends:");
          for (const t of report.repeatedMistakeTrends.slice(0, 5)) {
            const icon = t.trend === "increasing" ? "📈" : t.trend === "decreasing" ? "📉" : "➡️";
            console.log(`  ${icon} ${t.area}: ${t.count} FAILED_APPROACH(es) — ${t.trend}`);
          }
          console.log("");
        }

        if (report.oldestStale.length) {
          console.log("Oldest stale memories:");
          for (const m of report.oldestStale) {
            console.log(`  - [${m.kind}] ${m.claim} (${m.scope.paths.join(", ") || "repo-wide"})`);
          }
          console.log("");
        }

        console.log("Suggestions:");
        for (const s of report.suggestions) {
          console.log(`  • ${s}`);
        }
      } finally {
        store.close();
      }
    });
}
