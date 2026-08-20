/**
 * Verification & guardrail commands: verify, check, brief.
 */

import type { Command } from "commander";
import { MemoryStore, findRepoRoot } from "../../db/store.js";
import { verifyAll } from "../../verify/engine.js";
import { fail, autoSync, maybeRegenerateContext, createPrompter } from "../shared.js";

export function registerVerifyCommands(program: Command): void {
  program
    .command("verify")
    .description("Re-run evidence and update memory statuses (cheap tier; --deep adds tests/exec)")
    .option("-i, --id <ids...>", "Only verify specific memory ids (prefix ok)")
    .option("-d, --deep", "Also run expensive evidence (TEST_RESULT, EXEC_TRACE)")
    .option("--trust", "Review evidence commands that arrived via team sync and approve them to run on this machine")
    .option("-q, --quiet", "Only print status changes (for git hooks)")
    .action(async (opts) => {
      const root = findRepoRoot() ?? fail("not inside a repo");
      const store = MemoryStore.open(root);
      if (opts.trust) {
        const pending = store.untrustedEvidence();
        if (!pending.length) {
          console.log("No untrusted evidence — everything runnable was authored or approved on this machine.");
        } else {
          console.log(`${pending.length} synced-in evidence command(s) are NOT yet approved to execute here:\n`);
          for (const u of pending) {
            console.log(`  [${u.type}] ${u.payload}`);
            console.log(`      for: "${u.claim.slice(0, 90)}"\n`);
          }
          const { ask, close } = await createPrompter("n");
          const ans = (await ask("Approve ALL of the above to run on this machine? [y/N] ")).trim().toLowerCase();
          close();
          if (ans === "y" || ans === "yes") {
            console.log(`✓ approved ${store.trustAllEvidence()} command(s). They'll run on the next verify.`);
          } else {
            console.log("Nothing approved — they stay skipped during verification.");
          }
        }
      }
      const report = verifyAll(store, root, { ids: opts.id, deep: Boolean(opts.deep) });

      for (const r of report.results) {
        const changed = r.after !== r.before || r.decayed;
        if (opts.quiet && !changed) continue;
        const arrow = r.after !== r.before ? `${r.before} → ${r.after}` : r.after;
        const icon = r.after === "VERIFIED" ? "✓" : r.after === "STALE" ? "~" : "?";
        const decayNote = r.decayed ? " (decayed)" : "";
        console.log(`${icon} [${arrow}] conf ${r.confidenceBefore.toFixed(2)}→${r.confidenceAfter.toFixed(2)}${decayNote}  ${r.claim.slice(0, 90)}`);
        for (const o of r.outcomes) {
          if (opts.quiet && o.result !== "FAIL") continue;
          console.log(`    ${o.type}: ${o.result} (${o.detail})`);
        }
      }
      if (opts.quiet) {
        // hook mode: machine-stable output — only speak when something went stale
        if (report.stale > 0) {
          console.log(
            `\nchecked ${report.checked}: ${report.verified} verified, ${report.stale} stale, ${report.decayed} decayed, ${report.unchanged} unchanged`
          );
        }
      } else if (report.checked === 0) {
        console.log("Nothing to verify yet — store something with `dim remember` first.");
      } else if (report.stale > 0) {
        console.log(
          `\n⚠ ${report.stale} memor${report.stale === 1 ? "y" : "ies"} went stale — the code changed under ${report.stale === 1 ? "it" : "them"}. ` +
            `Stale memories are down-ranked in recall until they recover.\n` +
            `(checked ${report.checked}: ${report.verified} verified, ${report.stale} stale, ${report.decayed} decayed, ${report.unchanged} unchanged)`
        );
      } else {
        console.log(
          `\n✓ All good — ${report.verified} verified, ${report.unchanged} unchanged${report.decayed ? `, ${report.decayed} aging (decayed)` : ""} of ${report.checked} checked.`
        );
      }
      await autoSync(store);
      // keep generated context in sync when a status actually flipped
      if (report.results.some((r) => r.after !== r.before)) await maybeRegenerateContext(store);
      store.close();
      if (report.stale > 0) process.exitCode = 2; // signal staleness to scripts
    });

  program
    .command("check")
    .description("Pre-commit contradiction check: scan the staged diff against active memories and guardrails")
    .option("-r, --ref <ref>", "Diff against a ref instead of the staged index (e.g. HEAD~1)")
    .option("--block", "Exit 1 when a hard violation is found (default: warn only)")
    .option("--risk-threshold <n>", "Exit 1 when risk score exceeds this threshold (0-100)", parseInt)
    .option("--json", "Output structured JSON report instead of text")
    .option("--pre-commit", "Run in hook mode: behavior follows preCommitCheck in .aidimag/config.json (no-op if unset)", false)
    .action(async (opts) => {
      const root = findRepoRoot() ?? fail("not inside a git repo");
      let block = Boolean(opts.block);
      if (opts.preCommit) {
        const { readConfig } = await import("../../config.js");
        const mode = readConfig(root).preCommitCheck;
        if (!mode) return; // hook installed but feature disabled — silent no-op
        block = mode === "block";
      }
      const store = MemoryStore.open(root);
      const { checkDiff } = await import("../../verify/check.js");
      const report = checkDiff(store, root, { ref: opts.ref });
      store.close();

      // Critical area enforcement
      const { readCriticalAreas, checkCriticalAreas } = await import("../../verify/critical-areas.js");
      const areasConfig = readCriticalAreas(root);
      let commitMessage: string | undefined;
      if (areasConfig.areas.length) {
        try {
          const { execFileSync } = await import("node:child_process");
          commitMessage = execFileSync("git", ["log", "-1", "--format=%B"], { cwd: root, encoding: "utf8" });
        } catch { /* ignore */ }
      }
      const areaViolations = checkCriticalAreas(areasConfig, report.changedFiles, { commitMessage });

      // Risk score
      const { computeRiskScore, renderRiskScore } = await import("../../verify/risk-score.js");
      const risk = computeRiskScore(report, areaViolations);

      if (report.changedFiles.length === 0 && areaViolations.length === 0) {
        if (!opts.preCommit) console.log("dim check: no changes to check.");
        return;
      }
      const fails = report.violations.filter((v) => v.severity === "fail");
      const warns = report.violations.filter((v) => v.severity === "warn");
      const areaFails = areaViolations.filter((v) => v.severity === "fail");
      const areaWarns = areaViolations.filter((v) => v.severity === "warn");

      // JSON output for CI/GitHub Action integration
      if (opts.json) {
        const jsonOutput = {
          passed: fails.length === 0 && areaFails.length === 0,
          riskScore: risk.score,
          riskLevel: risk.level,
          riskFactors: risk.factors,
          changedFiles: report.changedFiles,
          checked: report.checked,
          violations: report.violations.map((v) => ({
            kind: v.memory.kind,
            severity: v.severity,
            detail: v.detail,
            claim: v.memory.claim,
            memoryId: v.memory.id,
          })),
          criticalAreaViolations: areaViolations.map((v) => ({
            area: v.area.label,
            severity: v.severity,
            detail: v.detail,
            changedFiles: v.changedFiles,
            owners: v.area.owners,
            requiredTests: v.area.requiredTests,
          })),
        };
        console.log(JSON.stringify(jsonOutput, null, 2));
        const totalFails = fails.length + areaFails.length;
        const thresholdExceeded = opts.riskThreshold !== undefined && risk.score > opts.riskThreshold;
        if ((totalFails && block) || thresholdExceeded) {
          process.exit(1);
        }
        return;
      }

      if (report.violations.length === 0 && areaViolations.length === 0) {
        if (!opts.preCommit) {
          console.log(`✓ dim check: ${report.checked} memorie(s) considered across ${report.changedFiles.length} file(s) — no conflicts.`);
          console.log(renderRiskScore(risk));
        }
        return;
      }
      for (const v of fails) {
        console.error(`✗ [${v.memory.kind}] ${v.detail}\n    "${v.memory.claim}"`);
      }
      for (const v of warns) {
        console.error(`~ [${v.memory.kind}] ${v.detail}\n    "${v.memory.claim}"`);
      }
      for (const v of areaFails) {
        console.error(`✗ [CRITICAL] ${v.detail}\n    files: ${v.changedFiles.join(", ")}`);
      }
      for (const v of areaWarns) {
        console.error(`~ [CRITICAL] ${v.detail}\n    files: ${v.changedFiles.join(", ")}`);
      }
      if (!opts.preCommit) {
        console.error(renderRiskScore(risk));
      }
      const totalFails = fails.length + areaFails.length;
      const thresholdExceeded = opts.riskThreshold !== undefined && risk.score > opts.riskThreshold;
      if (totalFails && block) {
        console.error(`\ndim check: ${totalFails} blocking violation(s). Resolve them or commit with --no-verify.`);
        process.exit(1);
      }
      if (thresholdExceeded) {
        console.error(`\ndim check: risk score ${risk.score} exceeds threshold ${opts.riskThreshold}.`);
        process.exit(1);
      }
    });

  program
    .command("impact")
    .description("Report which verified memories are affected by the changes in this PR/branch")
    .option("-b, --base <ref>", "Base ref to compare against", "main")
    .option("-h, --head <ref>", "Head ref (defaults to HEAD)", "HEAD")
    .option("--verify", "Run evidence checks to predict which memories would go STALE")
    .option("--json", "Output raw JSON report instead of markdown")
    .option("--fail-on-impact", "Exit 1 if any memories would go stale or any violations are found")
    .option("--max-stale-risk <n>", "Exit 1 if the stale risk score exceeds this threshold (0-100)", parseInt)
    .action(async (opts) => {
      const root = findRepoRoot() ?? fail("not inside a git repo");
      const store = MemoryStore.open(root);
      const { buildImpactReport, renderImpactReport } = await import("../../verify/impact.js");
      const base = opts.base;
      const head = opts.head;
      const report = buildImpactReport(store, root, base, head, { verify: opts.verify });
      store.close();
      if (opts.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(renderImpactReport(report));
      }

      if (opts.failOnImpact) {
        const hasViolations = report.violations.length > 0;
        const hasStalePredictions = report.stalePredictions.length > 0;
        if (hasViolations || hasStalePredictions) {
          console.error(`\ndim impact: ${report.violations.length} violation(s) and ${report.stalePredictions.length} stale prediction(s) — failing for branch protection.`);
          process.exit(1);
        }
      }

      if (opts.maxStaleRisk !== undefined && report.summary.staleRisk > opts.maxStaleRisk) {
        console.error(`\ndim impact: stale risk ${report.summary.staleRisk} exceeds threshold ${opts.maxStaleRisk}.`);
        process.exit(1);
      }
    });

  program
    .command("brief")
    .description("Print a session-start briefing: in-scope memory, guardrails, stale warnings, and questions to ask")
    .action(async () => {
      const root = findRepoRoot() ?? fail("not inside a git repo");
      const store = MemoryStore.open(root);
      const { buildSessionBriefing, renderBriefing } = await import("../../capture/session-briefing.js");
      const briefing = buildSessionBriefing(store, root);
      process.stdout.write(renderBriefing(briefing));
      store.close();
    });
}

