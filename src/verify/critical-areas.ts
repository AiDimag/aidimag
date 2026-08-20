/**
 * Protected code boundaries — critical-area config and enforcement.
 *
 * Reads `.aidimag/critical-areas.yml` (or `.json`) and exposes helpers to
 * check whether a set of changed files touches a critical area, and whether
 * the change is approved (e.g. has a co-authored guardrail memory or an
 * explicit approval token in the commit message).
 *
 * Enforcement is wired into `dim check` and the GitHub Action so that
 * unapproved changes to critical paths are blocked (or warned) before merge.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

export interface CriticalArea {
  /** glob-style path prefix, e.g. "src/auth", "src/payments/**" */
  paths: string[];
  /** human-readable label, e.g. "Authentication" */
  label: string;
  /** GitHub handles or emails of required approvers (at least one must approve) */
  owners?: string[];
  /** names of tests that must pass for changes in this area */
  requiredTests?: string[];
  /** if true, `dim check --block` exits 1 on any change without approval; if false, warn only */
  block?: boolean;
  /** commit-message token that marks a change as explicitly approved (e.g. "[CRITICAL-OK]") */
  approvalToken?: string;
}

export interface CriticalAreasConfig {
  areas: CriticalArea[];
}

/**
 * Read the critical-areas config from `.aidimag/critical-areas.yml` or
 * `.aidimag/critical-areas.json`. Returns an empty config if neither file
 * exists.
 */
export function readCriticalAreas(repoRoot: string): CriticalAreasConfig {
  const ymlPath = path.join(repoRoot, ".aidimag", "critical-areas.yml");
  const yamlPath = path.join(repoRoot, ".aidimag", "critical-areas.yaml");
  const jsonPath = path.join(repoRoot, ".aidimag", "critical-areas.json");

  if (existsSync(jsonPath)) {
    try {
      const raw = JSON.parse(readFileSync(jsonPath, "utf8"));
      return normalizeConfig(raw);
    } catch {
      return { areas: [] };
    }
  }

  for (const p of [ymlPath, yamlPath]) {
    if (existsSync(p)) {
      try {
        const raw = readFileSync(p, "utf8");
        return normalizeConfig(parseSimpleYaml(raw));
      } catch {
        return { areas: [] };
      }
    }
  }

  return { areas: [] };
}

function normalizeConfig(raw: unknown): CriticalAreasConfig {
  if (!raw || typeof raw !== "object") return { areas: [] };
  const obj = raw as Record<string, unknown>;
  const areasRaw = obj.areas;
  if (!Array.isArray(areasRaw)) return { areas: [] };
  const areas: CriticalArea[] = [];
  for (const a of areasRaw) {
    if (!a || typeof a !== "object") continue;
    const area = a as Record<string, unknown>;
    const paths = Array.isArray(area.paths) ? area.paths.map(String).filter(Boolean) : [];
    if (paths.length === 0) continue;
    areas.push({
      paths,
      label: typeof area.label === "string" ? area.label : paths[0],
      owners: Array.isArray(area.owners) ? area.owners.map(String) : undefined,
      requiredTests: Array.isArray(area.requiredTests) ? area.requiredTests.map(String) : undefined,
      block: typeof area.block === "boolean" ? area.block : undefined,
      approvalToken: typeof area.approvalToken === "string" ? area.approvalToken : undefined,
    });
  }
  return { areas };
}

export interface CriticalAreaViolation {
  area: CriticalArea;
  changedFiles: string[];
  severity: "fail" | "warn";
  detail: string;
}

/**
 * Check whether any of the changed files fall inside a critical area.
 * Returns violations for each touched area.
 */
export function checkCriticalAreas(
  config: CriticalAreasConfig,
  changedFiles: string[],
  opts: { commitMessage?: string } = {}
): CriticalAreaViolation[] {
  const violations: CriticalAreaViolation[] = [];

  for (const area of config.areas) {
    const touched = changedFiles.filter((f) => matchesArea(f, area.paths));
    if (touched.length === 0) continue;

    const hasApprovalToken =
      area.approvalToken && opts.commitMessage?.includes(area.approvalToken);

    if (hasApprovalToken) continue;

    const shouldBlock = area.block ?? true;
    violations.push({
      area,
      changedFiles: touched,
      severity: shouldBlock ? "fail" : "warn",
      detail:
        `Change touches critical area "${area.label}" (${touched.length} file(s))` +
        (area.owners?.length ? ` — requires approval from: ${area.owners.join(", ")}` : "") +
        (area.approvalToken ? ` or include "${area.approvalToken}" in the commit message` : "") +
        (area.requiredTests?.length ? `; required tests: ${area.requiredTests.join(", ")}` : ""),
    });
  }

  return violations;
}

/** Check if a file path matches any of the area's path patterns. */
function matchesArea(filePath: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    // Normalize pattern — strip leading /
    const p = pattern.replace(/^\//, "").replace(/\/+$/, "");
    // glob ** matches everything
    if (p === "**" || p === "*") return true;
    // prefix match: "src/auth" matches "src/auth/login.ts"
    if (filePath.startsWith(p)) return true;
    // also check if pattern with /** suffix
    const cleanPattern = p.replace(/\/\*+$/, "");
    if (filePath.startsWith(cleanPattern + "/")) return true;
    // exact match
    if (filePath === p) return true;
  }
  return false;
}

/**
 * Minimal YAML parser for the critical-areas config. Supports the subset
 * needed: top-level `areas:` list with nested keys and list values.
 * Not a general-purpose YAML parser — intentionally tiny.
 */
function parseSimpleYaml(raw: string): Record<string, unknown> {
  const lines = raw.split("\n");
  const result: Record<string, unknown> = {};
  let currentArea: Record<string, unknown> | null = null;
  let areas: Record<string, unknown>[] = [];
  let inList = false;
  let listKey = "";
  let areaEntryIndent = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const indent = line.length - line.trimStart().length;

    if (indent === 0) {
      // top-level key
      const [key, ...rest] = trimmed.split(":");
      const value = rest.join(":").trim();
      if (key === "areas" && !value) {
        areas = [];
        result.areas = areas;
        currentArea = null;
        inList = false;
        areaEntryIndent = -1;
      } else if (value) {
        result[key.trim()] = value;
      }
      continue;
    }

    if (trimmed.startsWith("- ")) {
      // Determine if this is a new area entry or a list item under a key
      if (areaEntryIndent === -1) {
        // First "- " after "areas:" — record the indent level
        areaEntryIndent = indent;
      }

      if (indent === areaEntryIndent) {
        // New area entry
        currentArea = {};
        areas.push(currentArea);
        const rest = trimmed.slice(2);
        if (rest.includes(":")) {
          const [key, ...valParts] = rest.split(":");
          const val = valParts.join(":").trim();
          if (val) {
            currentArea[key.trim()] = parseScalar(val);
            inList = false;
          } else {
            listKey = key.trim();
            currentArea[listKey] = [];
            inList = true;
          }
        }
        continue;
      }
      // Deeper indent — list item under a key
      if (inList && currentArea) {
        const arr = currentArea[listKey];
        if (Array.isArray(arr)) {
          arr.push(parseScalar(trimmed.replace(/^-\s*/, "")));
        }
      }
      continue;
    }

    // nested key inside an area
    if (currentArea && trimmed.includes(":")) {
      const [key, ...valParts] = trimmed.split(":");
      const val = valParts.join(":").trim();
      if (val) {
        currentArea[key.trim()] = parseScalar(val);
        inList = false;
      } else {
        listKey = key.trim();
        currentArea[listKey] = [];
        inList = true;
      }
    } else if (inList && currentArea && trimmed) {
      // list item under a key like "paths:" or "owners:"
      const arr = currentArea[listKey];
      if (Array.isArray(arr)) {
        arr.push(parseScalar(trimmed.replace(/^-\s*/, "")));
      }
    }
  }

  return result;
}

function parseScalar(val: string): string | boolean | number {
  const v = val.replace(/^["']|["']$/g, "");
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+$/.test(v)) return parseInt(v, 10);
  return v;
}

/**
 * Write the critical-areas config to `.aidimag/critical-areas.yml` (or
 * `.json` if that's what already exists). Creates the `.aidimag` directory
 * if needed.
 */
export function writeCriticalAreas(repoRoot: string, config: CriticalAreasConfig): void {
  const aidimagDir = path.join(repoRoot, ".aidimag");
  const jsonPath = path.join(aidimagDir, "critical-areas.json");
  const ymlPath = path.join(aidimagDir, "critical-areas.yml");

  // If .json exists, write JSON; otherwise write YAML
  if (existsSync(jsonPath) && !existsSync(ymlPath)) {
    writeFileSync(jsonPath, JSON.stringify(config, null, 2) + "\n");
  } else {
    writeFileSync(ymlPath, serializeYaml(config));
  }
}

function serializeYaml(config: CriticalAreasConfig): string {
  const lines: string[] = ["areas:"];
  for (const area of config.areas) {
    lines.push(`  - label: "${area.label.replace(/"/g, '\\"')}"`);
    lines.push(`    paths:`);
    for (const p of area.paths) lines.push(`      - "${p}"`);
    if (area.owners?.length) {
      lines.push(`    owners:`);
      for (const o of area.owners) lines.push(`      - "${o}"`);
    }
    if (area.requiredTests?.length) {
      lines.push(`    requiredTests:`);
      for (const t of area.requiredTests) lines.push(`      - "${t}"`);
    }
    if (area.block !== undefined) lines.push(`    block: ${area.block}`);
    if (area.approvalToken) lines.push(`    approvalToken: "${area.approvalToken}"`);
  }
  if (config.areas.length === 0) lines.push("  []");
  return lines.join("\n") + "\n";
}
