/**
 * Incident / CI failure capture adapter.
 *
 * Reads a structured incident report (JSON or markdown) or a CI failure log
 * and extracts a FAILED_APPROACH proposal with provenance and applicability
 * conditions. The proposal lands in the review queue — never directly in memory.
 */

import { readFileSync } from "node:fs";
import type { MemoryStore } from "../db/store.js";
import type { Proposal, ProposalInput } from "../types.js";
import { scopeFromFiles } from "./commit-miner.js";

export interface IncidentReport {
  title: string;
  description: string;
  files?: string[];
  failedCommand?: string;
  ciUrl?: string;
  ticketRef?: string;
  commitSha?: string;
}

export interface IncidentMineResult {
  proposed: Proposal[];
  skippedDuplicates: number;
  source: string;
}

/**
 * Parse a raw CI log (e.g. GitHub Actions, Jenkins, CircleCI output) and extract
 * a structured IncidentReport. Looks for error lines, failed commands, file
 * paths, and job/step names.
 */
export function parseCiLog(raw: string): IncidentReport {
  const lines = raw.split("\n");
  const errors: string[] = [];
  const files: string[] = [];
  let failedCommand: string | undefined;
  let jobName: string | undefined;
  let commitSha: string | undefined;
  let ciUrl: string | undefined;

  // Patterns for common CI log formats
  const errorPatterns = [
    /^(?:Error|ERROR|FAILED|Failure|✖|✗)[:\s]/,
    /^\s*at\s/, // stack traces
    /AssertionError[:\s]/,
    /TypeError[:\s]/,
    /ReferenceError[:\s]/,
    /SyntaxError[:\s]/,
  ];

  const commandPatterns = [
    /^(?:Run\s+|\$\s+|>\s+)(.+)/,
    /^(npm|yarn|pnpm|npx|node|python|pip|make|gradle|mvn|cargo|go|rustc)\s+/,
  ];

  const filePattern = /([a-zA-Z0-9_./-]+\.(?:ts|js|py|go|rs|java|rb|php|c|cpp|h|hpp|cs|swift|kt|scala|sh|yml|yaml|json|toml|sql))\b/g;

  const shaPattern = /\b([0-9a-f]{7,40})\b/;
  const urlPattern = /https?:\/\/[\w.-]+[\w./-]*/;

  for (const line of lines) {
    const trimmed = line.trim();

    // Extract commit SHA
    if (!commitSha) {
      const shaMatch = trimmed.match(/(?:commit|sha|ref)[:\s]+([0-9a-f]{7,40})/i);
      if (shaMatch) commitSha = shaMatch[1];
    }

    // Extract CI URL
    if (!ciUrl) {
      const urlMatch = trimmed.match(urlPattern);
      if (urlMatch && /github|jenkins|circleci|gitlab|bitbucket|azure/i.test(urlMatch[0])) {
        ciUrl = urlMatch[0];
      }
    }

    // Extract job name
    if (!jobName) {
      const jobMatch = trimmed.match(/(?:Job|job|step|Step)[:\s]+(.+)/);
      if (jobMatch) jobName = jobMatch[1].slice(0, 100);
    }

    // Extract failed command
    if (!failedCommand) {
      for (const pattern of commandPatterns) {
        const match = trimmed.match(pattern);
        if (match) {
          failedCommand = match[1] || match[0];
          break;
        }
      }
    }

    // Collect error lines
    for (const pattern of errorPatterns) {
      if (pattern.test(trimmed)) {
        errors.push(trimmed.slice(0, 200));
        break;
      }
    }

    // Extract file paths from error lines
    let match: RegExpExecArray | null;
    filePattern.lastIndex = 0;
    while ((match = filePattern.exec(trimmed)) !== null) {
      const f = match[1];
      if (!files.includes(f) && !f.startsWith("node_modules/")) {
        files.push(f);
      }
    }
  }

  // Also try to find SHA generically
  if (!commitSha) {
    const shaMatch = raw.match(shaPattern);
    if (shaMatch) commitSha = shaMatch[1];
  }

  const title = jobName || (errors[0]?.slice(0, 80) ?? "CI failure");
  const description = errors.length > 0
    ? errors.slice(0, 10).join("\n")
    : "CI build failed. See log for details.";

  return {
    title,
    description,
    files: files.length > 0 ? files.slice(0, 10) : undefined,
    failedCommand,
    ciUrl,
    commitSha,
  };
}

/**
 * Parse a JSON incident report file.
 * Expected shape: { title, description, files?, failedCommand?, ciUrl?, ticketRef?, commitSha? }
 */
export function parseJsonReport(raw: string): IncidentReport {
  const obj = JSON.parse(raw);
  if (!obj.title || typeof obj.title !== "string") throw new Error("incident report missing 'title'");
  if (!obj.description || typeof obj.description !== "string") throw new Error("incident report missing 'description'");
  return {
    title: obj.title,
    description: obj.description,
    files: Array.isArray(obj.files) ? obj.files.map(String) : undefined,
    failedCommand: obj.failedCommand ?? obj.command ?? undefined,
    ciUrl: obj.ciUrl ?? obj.url ?? undefined,
    ticketRef: obj.ticketRef ?? obj.ticket ?? undefined,
    commitSha: obj.commitSha ?? obj.sha ?? undefined,
  };
}

/**
 * Parse a markdown incident report. Extracts the first heading as the title
 * and the body as the description. Optional fenced code blocks with `sh` or
 * `bash` are treated as the failed command.
 */
export function parseMarkdownReport(raw: string): IncidentReport {
  const lines = raw.split("\n");
  let title = "";
  let description = "";
  let failedCommand: string | undefined;
  let inCodeBlock = false;
  let codeLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        if (!failedCommand) failedCommand = codeLines.join("\n").trim() || undefined;
        codeLines = [];
      }
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }
    if (!title && line.startsWith("# ")) {
      title = line.slice(2).trim();
      continue;
    }
    description += line + "\n";
  }
  description = description.trim();

  if (!title) throw new Error("markdown report missing a '# heading' title");
  if (!description) throw new Error("markdown report missing a description body");

  return { title, description, failedCommand };
}

export function parseReport(filePath: string): IncidentReport {
  const raw = readFileSync(filePath, "utf8");
  if (filePath.endsWith(".json")) return parseJsonReport(raw);
  if (filePath.endsWith(".log") || filePath.endsWith(".txt")) return parseCiLog(raw);
  return parseMarkdownReport(raw);
}

function buildClaim(report: IncidentReport): string {
  const why = report.description.slice(0, 300);
  return `The approach "${report.title}" failed — ${why}`;
}

function buildEvidence(report: IncidentReport): ProposalInput["evidence"] {
  const evidence: ProposalInput["evidence"] = [];
  if (report.commitSha) evidence.push({ type: "COMMIT_REF", payload: report.commitSha });
  if (report.ticketRef) evidence.push({ type: "TICKET_REF", payload: report.ticketRef });
  if (report.failedCommand) evidence.push({ type: "EXEC_TRACE", payload: report.failedCommand });
  if (report.ciUrl) evidence.push({ type: "TEST_RESULT", payload: report.ciUrl });
  return evidence;
}

function buildAppliesWhen(report: IncidentReport): string[] {
  const conditions: string[] = [];
  if (report.failedCommand) conditions.push(`command:${report.failedCommand.slice(0, 100)}`);
  if (report.commitSha) conditions.push(`original_commit:${report.commitSha}`);
  return conditions;
}

/**
 * Mine an incident report into a FAILED_APPROACH proposal.
 * If an LLM provider is available, it synthesizes a richer claim; otherwise
 * falls back to a heuristic claim built from the title and description.
 */
export async function mineIncident(
  store: MemoryStore,
  report: IncidentReport,
  opts: { llm?: boolean } = {}
): Promise<IncidentMineResult> {
  let claim = buildClaim(report);
  let rationale = `Extracted from incident report: ${report.title}`;

  if (opts.llm) {
    try {
      const { getTextProvider } = await import("../knowledge/llm.js");
      const provider = await getTextProvider();
      if (provider) {
        const prompt = `You are extracting a failed approach from an incident report. Synthesize a falsifiable claim about what went wrong and why it should not be repeated.

Incident title: ${report.title}
Description: ${report.description}
${report.failedCommand ? `Failed command: ${report.failedCommand}` : ""}
${report.files?.length ? `Affected files: ${report.files.join(", ")}` : ""}

Respond with ONLY the claim text (one sentence, starting with "The approach ...").`;
        const llmClaim = (await provider.generate("You are a helpful assistant.", prompt)).trim();
        if (llmClaim) {
          claim = llmClaim;
          rationale = `LLM-synthesized from incident report: ${report.title} (${provider.name}/${provider.model})`;
        }
      }
    } catch {
      // fall back to heuristic claim
    }
  }

  const input: ProposalInput = {
    kind: "FAILED_APPROACH",
    claim,
    paths: scopeFromFiles(report.files ?? []),
    evidence: buildEvidence(report),
    source: "incident-miner",
    sourceRef: report.title.slice(0, 200),
    rationale,
    ticketRef: report.ticketRef,
    appliesWhen: buildAppliesWhen(report),
  };

  const p = store.propose(input);
  return {
    proposed: p ? [p] : [],
    skippedDuplicates: p ? 0 : 1,
    source: "incident-miner",
  };
}
