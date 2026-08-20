/**
 * `dim impact` — knowledge-impact report for a pull request.
 *
 * Given a base and head ref, reports which verified memories are affected by the
 * changed files. This is read-only: it does not flip statuses or mutate the store.
 * The post-merge `dim verify` hook is what actually re-checks evidence and marks
 * memories stale.
 *
 * With `--verify`, it also runs evidence checks against the head ref and reports
 * which memories would go STALE if the PR merges.
 */

import { execFileSync } from "node:child_process";
import type { MemoryStore } from "../db/store.js";
import type { MemoryEntry, MemoryKind, EvidenceResult } from "../types.js";
import { checkDiffText } from "./check.js";
import { runEvidence } from "./runners.js";

export interface ImpactMemory {
  memory: MemoryEntry;
  reason: "scope" | "violation";
}

export interface StalePrediction {
  memory: MemoryEntry;
  evidenceType: string;
  result: EvidenceResult | "SKIPPED";
  detail: string;
}

export interface ImpactReport {
  base: string;
  head: string;
  changedFiles: string[];
  violations: import("./check.js").CheckViolation[];
  affected: Record<MemoryKind, ImpactMemory[]>;
  stalePredictions: StalePrediction[];
  newDecisions: ImpactMemory[];
  summary: {
    total: number;
    byKind: Record<string, number>;
    staleRisk: number;
    wouldGoStale: number;
    newDecisions: number;
  };
}

function gitDiffRefs(repoRoot: string, base: string, head: string): string {
  try {
    return execFileSync("git", ["diff", "--unified=0", `${base}...${head}`, "--"], {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch {
    return "";
  }
}

export function gitChangedFiles(repoRoot: string, base: string, head: string): string[] {
  try {
    const out = execFileSync("git", ["diff", "--name-only", "--diff-filter=ACMRT", `${base}...${head}`, "--"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    return out.split("\n").map((l) => l.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export function gitWorkingTreeFiles(repoRoot: string, staged = false): string[] {
  const args = staged ? ["diff", "--cached", "--name-only", "--diff-filter=ACMRT", "--"] : ["diff", "--name-only", "--diff-filter=ACMRT", "--"];
  try {
    const out = execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" });
    return out.split("\n").map((l) => l.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function memoryTouchesFiles(m: MemoryEntry, files: string[]): boolean {
  if (m.scope.paths.length === 0) return false;
  return m.scope.paths.some((sp) =>
    files.some((f) => f.startsWith(sp) || sp.startsWith(f) || f === sp)
  );
}

const KIND_ORDER: MemoryKind[] = [
  "GUARDRAIL",
  "INVARIANT",
  "CONVENTION",
  "FAILED_APPROACH",
  "DECISION",
  "ARCHITECTURE",
  "GOTCHA",
  "TODO_CONTEXT",
  "SKILL",
];

export function buildImpactReport(
  store: MemoryStore,
  repoRoot: string,
  base: string,
  head: string,
  opts: { verify?: boolean } = {}
): ImpactReport {
  const diff = gitDiffRefs(repoRoot, base, head);
  const changedFiles = gitChangedFiles(repoRoot, base, head);
  const checkReport = checkDiffText(store, diff, repoRoot);

  const active = store
    .list()
    .filter((m) => m.status === "VERIFIED" || m.status === "UNVERIFIED" || m.pinned);

  const affected: Record<MemoryKind, ImpactMemory[]> = {
    DECISION: [],
    CONVENTION: [],
    GOTCHA: [],
    FAILED_APPROACH: [],
    ARCHITECTURE: [],
    INVARIANT: [],
    TODO_CONTEXT: [],
    GUARDRAIL: [],
    SKILL: [],
  };

  for (const m of active) {
    const byScope = memoryTouchesFiles(m, changedFiles);
    const byViolation = checkReport.violations.some((v) => v.memory.id === m.id);
    if (!byScope && !byViolation) continue;
    const entry: ImpactMemory = {
      memory: m,
      reason: byViolation ? "violation" : "scope",
    };
    affected[m.kind].push(entry);
  }

  // Memories that have machine-checkable evidence touching changed files are at
  // risk of going stale once the PR lands and `dim verify` re-runs.
  const staleRisk = affected.GUARDRAIL.length + affected.INVARIANT.length + affected.CONVENTION.length;

  // -- Stale predictions: run evidence against the head ref to see which
  //    memories would flip to STALE if this PR merges.
  const stalePredictions: StalePrediction[] = [];
  if (opts.verify) {
    const allAffected = Object.values(affected).flat();
    for (const { memory: m } of allAffected) {
      if (m.status === "REFUTED") continue;
      for (const ev of m.grounding) {
        if (ev.type === "HUMAN_ATTESTED" || ev.type === "TICKET_REF") continue;
        const outcome = runEvidence(ev, repoRoot);
        if (outcome.result === "FAIL") {
          stalePredictions.push({
            memory: m,
            evidenceType: ev.type,
            result: outcome.result,
            detail: outcome.detail,
          });
        }
      }
    }
  }

  // -- New decisions: memories created within the PR's commit range.
  //    These are DECISION/CONVENTION/ARCHITECTURE/GUARDRAIL memories that
  //    were added in the PR itself — worth highlighting for reviewers.
  let prCommitDates: [string, string] | undefined;
  try {
    const baseDate = execFileSync("git", ["log", "-1", "--format=%cI", base], { cwd: repoRoot, encoding: "utf8" }).trim();
    const headDate = execFileSync("git", ["log", "-1", "--format=%cI", head], { cwd: repoRoot, encoding: "utf8" }).trim();
    prCommitDates = [baseDate, headDate];
  } catch { /* ignore — date comparison won't work */ }

  const newDecisions: ImpactMemory[] = [];
  if (prCommitDates) {
    const [baseDate, headDate] = prCommitDates;
    for (const m of active) {
      if (!["DECISION", "CONVENTION", "ARCHITECTURE", "GUARDRAIL"].includes(m.kind)) continue;
      if (m.createdAt >= baseDate && m.createdAt <= headDate) {
        newDecisions.push({ memory: m, reason: "scope" });
      }
    }
  }

  const byKind: Record<string, number> = {};
  for (const kind of KIND_ORDER) {
    if (affected[kind].length) byKind[kind] = affected[kind].length;
  }

  return {
    base,
    head,
    changedFiles,
    violations: checkReport.violations,
    affected,
    stalePredictions,
    newDecisions,
    summary: {
      total: Object.values(affected).reduce((n, list) => n + list.length, 0),
      byKind,
      staleRisk,
      wouldGoStale: stalePredictions.length,
      newDecisions: newDecisions.length,
    },
  };
}

export function renderImpactReport(r: ImpactReport): string {
  const lines: string[] = [];
  lines.push(`# aiDimag knowledge impact: ${r.head} → ${r.base}`);
  lines.push("");
  lines.push(`**${r.changedFiles.length} file(s)** changed. **${r.summary.total} memory(s)** may be affected.`);;
  if (r.summary.staleRisk > 0) {
    lines.push(`**${r.summary.staleRisk}** of those have machine-checkable evidence and may go stale after merge if the change breaks their checks.`);;
  }
  lines.push("");

  if (r.violations.length > 0) {
    lines.push("## 🚫 Violations detected");
    lines.push("");
    for (const v of r.violations) {
      lines.push(`- **${v.memory.kind}** — ${v.detail}`);
      lines.push(`  > ${v.memory.claim}`);
    }
    lines.push("");
  }

  let hasAny = false;
  for (const kind of KIND_ORDER) {
    const list = r.affected[kind];
    if (list.length === 0) continue;
    hasAny = true;
    lines.push(`## ${kind} (${list.length})`);
    lines.push("");
    for (const { memory: m, reason } of list) {
      const statusIcon = m.status === "VERIFIED" ? "✓" : m.status === "STALE" ? "~" : "?";
      const scope = [...m.scope.paths, ...m.scope.symbols].join(", ") || "repo-wide";
      const reasonTag = reason === "violation" ? " [violation]" : "";
      lines.push(`- ${statusIcon} **${m.claim}**${reasonTag}`);
      lines.push(`  id: \`${m.id.slice(0, 8)}\` · scope: \`${scope}\` · status: ${m.status}`);
    }
    lines.push("");
  }

  if (r.stalePredictions.length > 0) {
    lines.push("## ⚠️ Memories that would go STALE");
    lines.push("");
    lines.push("These memories have evidence that fails against the PR's changes. They will flip to STALE if this PR merges:");
    lines.push("");
    for (const sp of r.stalePredictions) {
      lines.push(`- **${sp.memory.kind}** — ${sp.memory.claim}`);
      lines.push(`  id: \`${sp.memory.id.slice(0, 8)}\` · evidence: ${sp.evidenceType} → ${sp.result} (${sp.detail})`);
    }
    lines.push("");
  }

  if (r.newDecisions.length > 0) {
    lines.push("## 🆕 New decisions in this PR");
    lines.push("");
    lines.push("These memories were created within the PR's commit range — review them for correctness:");
    lines.push("");
    for (const { memory: m } of r.newDecisions) {
      const statusIcon = m.status === "VERIFIED" ? "✓" : m.status === "STALE" ? "~" : "?";
      const scope = [...m.scope.paths, ...m.scope.symbols].join(", ") || "repo-wide";
      lines.push(`- ${statusIcon} **${m.kind}**: ${m.claim}`);
      lines.push(`  id: \`${m.id.slice(0, 8)}\` · scope: \`${scope}\` · created: ${m.createdAt.slice(0, 10)}`);
    }
    lines.push("");
  }

  if (!hasAny && r.violations.length === 0 && r.stalePredictions.length === 0 && r.newDecisions.length === 0) {
    lines.push("No verified memories are scoped to the changed files.");
  }

  return lines.join("\n");
}
