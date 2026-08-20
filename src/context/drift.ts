/**
 * Drift detection for generated context files (CLAUDE.md, .cursorrules, etc.).
 *
 * Compares the canonical memory store against the files on disk so users can see
 * which agents are missing rules or still carrying stale ones.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { MemoryStore } from "../db/store.js";
import type { MemoryEntry } from "../types.js";

export interface FileDrift {
  file: string;
  missing: MemoryEntry[];
  stale: string[];
  totalInStore: number;
}

export interface DriftReport {
  files: FileDrift[];
  summary: {
    checked: number;
    filesWithMissing: number;
    filesWithStale: number;
    totalMissing: number;
    totalStale: number;
  };
}

function normalizeClaim(text: string): string {
  return text
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, "") // remove [VERIFIED], [📌], etc.
    .replace(/[\s\n\r\t]+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

/** Extract candidate memory claims from a generated markdown context file.
 *  Strips guardrail prefixes, scope annotations, and trailing status tags. */
export function extractClaimsFromMarkdown(markdown: string): string[] {
  const claims: string[] = [];
  const lines = markdown.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ")) {
      claims.push(stripDecorations(trimmed.slice(2).trim()));
    } else if (/^\d+\.\s/.test(trimmed)) {
      claims.push(stripDecorations(trimmed.replace(/^\d+\.\s*/, "").trim()));
    }
  }
  return claims;
}

function stripDecorations(raw: string): string {
  return raw
    .replace(/^[\u{1F6AB}\u{2705}\u{1F91A}]\s+/u, "") // guardrail icon prefix
    .replace(/^(NEVER|ALWAYS|ASK FIRST):\s+/i, "") // guardrail level prefix
    .replace(/_\(scope:[^)]+\)_/g, "")
    .replace(/\[[^\]]+\]\s*$/g, "")
    .trim();
}

function fileExists(rel: string, repoRoot: string): string | undefined {
  const abs = path.join(repoRoot, rel);
  return existsSync(abs) ? abs : undefined;
}

const FORMAT_FILES: Record<string, string> = {
  claude: "CLAUDE.md",
  cursorrules: ".cursorrules",
  copilot: path.join(".github", "copilot-instructions.md"),
  windsurfrules: ".windsurfrules",
  agents: "AGENTS.md",
};

function targetsFor(format: string): string[] {
  if (format === "all") return Object.keys(FORMAT_FILES);
  return [format];
}

/** Detect drift between the memory store and generated context files on disk. */
export function detectDrift(store: MemoryStore, repoRoot: string, format: string): DriftReport {
  const active = store.list(10_000).filter((m) => m.status === "VERIFIED" || m.status === "UNVERIFIED");
  const normalizedMemories = new Map<string, MemoryEntry>();
  for (const m of active) {
    normalizedMemories.set(normalizeClaim(m.claim), m);
  }

  const files: FileDrift[] = [];
  for (const target of targetsFor(format)) {
    const rel = FORMAT_FILES[target];
    if (!rel) continue;
    const abs = fileExists(rel, repoRoot);
    if (!abs) {
      files.push({ file: rel, missing: active, stale: [], totalInStore: active.length });
      continue;
    }

    const content = readFileSync(abs, "utf8");
    const fileClaims = extractClaimsFromMarkdown(content).map(normalizeClaim).filter(Boolean);
    const fileClaimSet = new Set(fileClaims);

    const missing: MemoryEntry[] = [];
    for (const m of active) {
      if (!fileClaimSet.has(normalizeClaim(m.claim))) {
        missing.push(m);
      }
    }

    const stale: string[] = [];
    const seen = new Set<string>();
    for (const claim of fileClaims) {
      if (!normalizedMemories.has(claim) && !seen.has(claim)) {
        stale.push(claim);
        seen.add(claim);
      }
    }

    files.push({ file: rel, missing, stale, totalInStore: active.length });
  }

  const totalMissing = files.reduce((n, f) => n + f.missing.length, 0);
  const totalStale = files.reduce((n, f) => n + f.stale.length, 0);
  return {
    files,
    summary: {
      checked: files.length,
      filesWithMissing: files.filter((f) => f.missing.length > 0).length,
      filesWithStale: files.filter((f) => f.stale.length > 0).length,
      totalMissing,
      totalStale,
    },
  };
}
