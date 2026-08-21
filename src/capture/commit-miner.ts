/**
 * Commit miner (Phase 2 capture pipeline).
 *
 * Walks git history since the last mined commit and heuristically extracts
 * memory-worthy candidates from commit messages + touched files. Candidates
 * land in the proposal queue (human-in-the-loop) — never directly in memory.
 *
 * Each proposal is anchored with COMMIT_REF evidence so Phase 3 verification
 * can re-check it against history.
 */

import { execFileSync } from "node:child_process";
import { extractTicketId, readTicketsConfig, DEFAULT_TICKET_PATTERN } from "../tickets/provider.js";
import { debugLog } from "../debug.js";
import type { MemoryKind, Proposal, ProposalInput } from "../types.js";
import type { MemoryStore } from "../db/store.js";

const MINER_CURSOR_KEY = "commit_miner_last_sha";
const COMMIT_SEP = "\x1e"; // record separator
const FIELD_SEP = "\x1f"; // unit separator

export interface MinedCommit {
  sha: string;
  subject: string;
  body: string;
  files: string[];
}

export interface RevertInfo {
  originalSubject: string;
  /** SHA of the commit being reverted, when detectable. */
  originalSha?: string;
  /** Free-text reason extracted from the revert body. */
  reason?: string;
}

export interface MineResult {
  scanned: number;
  proposed: Proposal[];
  skippedDuplicates: number;
  lastSha: string | null;
  /** True when the repo is a git repo but has no commits yet (HEAD does not exist). */
  noCommits?: boolean;
  /** True when incremental mining found no commits newer than the stored cursor. */
  noNewCommits?: boolean;
}

/**
 * Heuristic signal patterns → memory kind.
 * Order matters: first match wins.
 */
const SIGNALS: Array<{ kind: MemoryKind; patterns: RegExp[] }> = [
  {
    kind: "FAILED_APPROACH",
    patterns: [
      /\brevert(s|ed|ing)?\b/i,
      /\bback(\s|-)?out\b/i,
      /\bdidn'?t work\b/i,
      /\babandon(s|ed|ing)?\b/i,
    ],
  },
  {
    kind: "GOTCHA",
    patterns: [
      /\bworkaround\b/i,
      /\bhack\b/i,
      /\bgotcha\b/i,
      /\bedge case\b/i,
      /\brace condition\b/i,
      /\bfoot(\s|-)?gun\b/i,
      /\bsubtle\b/i,
      /\bcareful\b/i,
      /\bdo not\b.*\bbecause\b/i,
    ],
  },
  {
    kind: "DECISION",
    patterns: [
      /\bdecid(e|ed|ing)\b/i,
      /\bswitch(ed|ing)? (from|to)\b/i,
      /\bmigrat(e|ed|ing) (from|to)\b/i,
      /\breplac(e|ed|ing) .+ with\b/i,
      /\binstead of\b/i,
      /\bchose\b/i,
      /\badopt(s|ed|ing)?\b/i,
      /\bADR\b/,
    ],
  },
  {
    kind: "CONVENTION",
    patterns: [
      /\bconvention\b/i,
      /\balways\b.+\b(use|go|import|call)\b/i,
      /\bnever\b.+\b(use|import|call)\b/i,
      /\bstandardiz(e|ed|ing)\b/i,
      /\benforce(s|d)?\b/i,
      /\blint rule\b/i,
    ],
  },
  {
    kind: "INVARIANT",
    patterns: [/\binvariant\b/i, /\bmust (always|never)\b/i, /\bguarantee(s|d)?\b/i],
  },
];

/** Why-markers: a commit explaining reasoning is more memory-worthy. */
const WHY_MARKERS = /\b(because|so that|otherwise|due to|the reason|to avoid|to prevent)\b/i;

function git(repoRoot: string, args: string[]): string {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

/** False when the repo is initialized but has no commits yet (no HEAD). */
export function hasGitCommits(repoRoot: string): boolean {
  try {
    execFileSync("git", ["rev-parse", "--verify", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return true;
  } catch {
    return false;
  }
}

export function readCommits(repoRoot: string, sinceSha: string | null, maxCommits = 500): MinedCommit[] {
  if (!hasGitCommits(repoRoot)) return [];
  const range = sinceSha ? `${sinceSha}..HEAD` : "HEAD";
  let raw: string;
  try {
    // NOTE: merges are included on purpose — GitHub "merge pull request"
    // commits carry the PR title in the body, and squash-merges carry the
    // full PR description. Pure merge noise ("Merge branch 'x'") has no
    // signal words, so classifyCommit filters it naturally.
    raw = git(repoRoot, [
      "log",
      range,
      `--max-count=${maxCommits}`,
      `--pretty=format:${COMMIT_SEP}%H${FIELD_SEP}%s${FIELD_SEP}%b${FIELD_SEP}`,
      "--name-only",
    ]);
  } catch (err) {
    // sinceSha may no longer exist (rebase/gc) — fall back to full history
    if (sinceSha) return readCommits(repoRoot, null, maxCommits);
    throw err;
  }
  const commits: MinedCommit[] = [];
  for (const chunk of raw.split(COMMIT_SEP)) {
    if (!chunk.trim()) continue;
    const [sha, subject, body, fileBlock] = chunk.split(FIELD_SEP);
    if (!sha) continue;
    const files = (fileBlock ?? "")
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);
    commits.push({ sha: sha.trim(), subject: subject ?? "", body: body ?? "", files });
  }
  return commits;
}

const REVERT_SUBJECT_RE = /^Revert\s+["'](.+?)["']\s*(?:\([^)]*\))?\s*$/i;
const REVERT_BODY_RE = /This\s+reverts\s+commit\s+([a-f0-9]{7,40})/i;

/** Detect a git revert commit and, when possible, link it back to the original commit. */
export function detectRevert(c: MinedCommit, repoRoot: string): RevertInfo | null {
  const subjectMatch = c.subject.match(REVERT_SUBJECT_RE);
  if (!subjectMatch) return null;
  const originalSubject = subjectMatch[1].trim();

  let originalSha: string | undefined;
  const bodyMatch = c.body.match(REVERT_BODY_RE);
  if (bodyMatch) {
    originalSha = bodyMatch[1];
  } else {
    // Fallback: search history for a commit with the same subject.
    try {
      const found = git(repoRoot, ["log", "--all", "--format=%H", "--grep", originalSubject, "-1"]).trim();
      if (found) originalSha = found;
    } catch {
      // ignore — original commit may be unreachable
    }
  }

  const reason = c.body
    .split("\n")
    .map((l) => l.trim())
    .filter(
      (l) =>
        l &&
        !l.startsWith("This reverts commit") &&
        !l.startsWith("Co-authored-by") &&
        !l.startsWith("Signed-off-by")
    )
    .join(" ")
    .slice(0, 200);

  return { originalSubject, originalSha, reason: reason || undefined };
}

export function classifyCommit(c: MinedCommit): { kind: MemoryKind; matched: string } | null {
  const text = `${c.subject}\n${c.body}`;
  for (const { kind, patterns } of SIGNALS) {
    for (const re of patterns) {
      const m = text.match(re);
      if (m) return { kind, matched: m[0] };
    }
  }
  // a long explanatory body with why-markers is a DECISION candidate even without keywords
  if (c.body.length > 120 && WHY_MARKERS.test(c.body)) {
    return { kind: "DECISION", matched: "explanatory body" };
  }
  return null;
}

function buildFailedApproachClaim(c: MinedCommit, revertInfo?: RevertInfo | null): string {
  const subject = revertInfo
    ? revertInfo.originalSubject.replace(/\.+$/, "")
    : c.subject.trim().replace(/^Revert\s+["']?|["']?\s*$/g, "").replace(/\.+$/, "");
  const why = revertInfo?.reason ? ` — ${revertInfo.reason}` : "";
  return `The approach "${subject}" was tried and reverted${why}`;
}

function buildClaim(c: MinedCommit, kind: MemoryKind, revertInfo?: RevertInfo | null): string {
  if (kind === "FAILED_APPROACH") return buildFailedApproachClaim(c, revertInfo);

  let subject = c.subject.trim().replace(/\.+$/, "");
  let bodyLines = c.body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("Co-authored-by") && !l.startsWith("Signed-off-by"));
  // merge commits: the subject is boilerplate ("Merge pull request #123 …");
  // the PR title is the first body line — promote it.
  if (/^Merge (pull request|branch)/i.test(subject) && bodyLines.length) {
    subject = bodyLines[0].replace(/\.+$/, "");
    bodyLines = bodyLines.slice(1);
  }
  const why = bodyLines.join(" ").slice(0, 300);
  const prefix =
    kind === "GOTCHA"
      ? "There is a gotcha"
      : kind === "DECISION"
        ? "A decision was made"
        : kind === "CONVENTION"
          ? "A convention applies"
          : "An invariant holds";
  return why ? `${prefix}: ${subject} — ${why}` : `${prefix}: ${subject}`;
}

/** Files that say nothing about the code — never useful as memory scope. */
const SCOPE_NOISE = /^(\.idea\/|\.vscode\/|\.aidimag\/|\.github\/workflows\/.*\.lock|\.gitignore$|\.DS_Store$|node_modules\/)/;

/** Reduce touched files to a few representative scope paths (common directories). */
export function scopeFromFiles(files: string[], maxPaths = 4): string[] {
  files = files.filter((f) => !SCOPE_NOISE.test(f));
  if (files.length === 0) return [];
  if (files.length <= maxPaths) return files;
  const dirs = new Map<string, number>();
  for (const f of files) {
    const dir = f.includes("/") ? f.slice(0, f.lastIndexOf("/")) : ".";
    dirs.set(dir, (dirs.get(dir) ?? 0) + 1);
  }
  return [...dirs.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxPaths)
    .map(([d]) => d);
}

const STOP_WORDS = new Set([
  "the", "this", "that", "with", "from", "have", "will", "must", "should",
  "project", "memory", "system", "using", "uses", "used", "code", "file",
  "files", "when", "then", "into", "onto", "over", "under", "they", "them",
  "their", "there", "here", "what", "which", "where", "been", "were", "your",
  "about", "above", "below", "after", "before", "between", "through", "during",
  "claim", "ticket", "branch", "commit", "verify", "verified", "stale",
]);

/**
 * Try to find files relevant to a claim by extracting keywords and running
 * `git grep`. Returns scoped paths (via scopeFromFiles) if matches are found,
 * otherwise returns [] (repo-wide). Never throws.
 */
export function scopeFromClaim(claim: string, repoRoot: string, maxPaths = 4): string[] {
  const words = claim
    .replace(/[^a-zA-Z0-9_/.]/g, " ")
    .split(/\s+/)
    .filter(w => w.length >= 4 && !STOP_WORDS.has(w.toLowerCase()));
  if (words.length === 0) return [];

  // Try the most distinctive keywords (longest first), a few at a time
  const keywords = [...new Set(words)].sort((a, b) => b.length - a.length).slice(0, 3);
  for (const kw of keywords) {
    try {
      const out = execFileSync("git", ["grep", "-l", "--cached", "-i", kw], {
        cwd: repoRoot, encoding: "utf8", maxBuffer: 4 * 1024 * 1024, timeout: 3000,
      }).trim();
      if (out) {
        const files = out.split("\n").filter(Boolean);
        if (files.length > 0) return scopeFromFiles(files, maxPaths);
      }
    } catch { /* grep found nothing or git not available — try next keyword */ }
  }
  return [];
}

export function mineCommits(
  store: MemoryStore,
  repoRoot: string,
  opts: { maxCommits?: number; full?: boolean } = {}
): MineResult {
  if (!hasGitCommits(repoRoot)) {
    return { scanned: 0, proposed: [], skippedDuplicates: 0, lastSha: null, noCommits: true };
  }
  const sinceSha = opts.full ? null : store.getMeta(MINER_CURSOR_KEY);
  const commits = readCommits(repoRoot, sinceSha, opts.maxCommits ?? 500);

  if (commits.length === 0 && sinceSha) {
    return {
      scanned: 0,
      proposed: [],
      skippedDuplicates: 0,
      lastSha: sinceSha,
      noNewCommits: true,
    };
  }

  // T1 ticket extraction (offline): per-commit from the message; for
  // incremental mining (the post-commit hook path) the current branch name is
  // a trustworthy fallback — for full-history scans it would mislabel.
  const ticketPattern = readTicketsConfig(repoRoot).pattern ?? DEFAULT_TICKET_PATTERN;
  let branchTicket: string | null = null;
  if (sinceSha) {
    try {
      const branch = git(repoRoot, ["rev-parse", "--abbrev-ref", "HEAD"]).trim();
      branchTicket = extractTicketId(branch, ticketPattern);
    } catch {
      // detached HEAD etc — message extraction still applies
    }
  }

  const proposed: Proposal[] = [];
  let skippedDuplicates = 0;

  for (const c of commits) {
    const hit = classifyCommit(c);
    if (!hit) continue;
    const ticketRef = extractTicketId(`${c.subject}\n${c.body}`, ticketPattern) ?? branchTicket ?? undefined;

    let revertInfo: RevertInfo | null | undefined;
    let appliesWhen: string[] | undefined;
    const evidence: ProposalInput["evidence"] = [
      { type: "COMMIT_REF", payload: c.sha },
      ...(ticketRef ? [{ type: "TICKET_REF" as const, payload: ticketRef }] : []),
    ];
    let rationale = `Matched signal "${hit.matched}" in commit ${c.sha.slice(0, 8)}: ${c.subject}`;

    if (hit.kind === "FAILED_APPROACH") {
      revertInfo = detectRevert(c, repoRoot);
      if (revertInfo) {
        if (revertInfo.originalSha) {
          evidence.push({ type: "COMMIT_REF", payload: revertInfo.originalSha });
          // Semantics: the failed approach applies when the original (reverted) approach is present.
          appliesWhen = [`original_commit:${revertInfo.originalSha}`];
        }
        if (revertInfo.reason) {
          rationale += ` — reason: ${revertInfo.reason}`;
        }
      }
    }

    const input: ProposalInput = {
      kind: hit.kind,
      claim: buildClaim(c, hit.kind, revertInfo),
      paths: scopeFromFiles(c.files),
      evidence,
      source: "commit-miner",
      sourceRef: c.sha,
      rationale,
      ticketRef,
      appliesWhen,
    };
    const p = store.propose(input);
    if (p) proposed.push(p);
    else skippedDuplicates++;
  }

  // advance cursor to current HEAD (newest commit is first in `git log` output)
  const head = commits.length > 0 ? commits[0].sha : sinceSha;
  if (head) store.setMeta(MINER_CURSOR_KEY, head);

  return { scanned: commits.length, proposed, skippedDuplicates, lastSha: head ?? null };
}

// ---------------------------------------------------------------- LLM mining (deep tier)

const LLM_DIFF_CHARS = 6_000;
const LLM_MAX_COMMITS = 40; // per run — LLM mining is the deep tier

export const COMMIT_EXTRACT_INSTRUCTIONS = `You are mining a git commit for durable, project-specific knowledge worth remembering across AI coding sessions: decisions (and rejected alternatives), conventions, gotchas, failed approaches, invariants, architecture facts.

Rules:
1. Most commits contain NOTHING durable — routine features/fixes/refactors. Return zero claims for those. Do NOT invent.
2. When there IS signal, SYNTHESIZE a falsifiable claim about the codebase — do not parrot the commit message. Bad: "A decision was made: use Redis". Good: "Rate limiting uses Redis (src/limits); the in-memory limiter was abandoned because multi-instance deploys need shared counters".
3. BE SPECIFIC. Every claim must name concrete files, modules, functions, config keys, or commands. Bad: "The project uses a specific tool for code completion" (useless). Good: "The UI is a single-page app generated from src/ui/page.ts which inlines all CSS and JS into one HTML file served by the Express server in src/ui/server.ts".
4. REJECT generic statements. If a claim could apply to any repo, discard it. "Uses TypeScript" is useless. "All API handlers in src/api/ must extend BaseHandler and register via src/api/registry.ts" is useful.
5. Use the DIFF, not just the message — renamed modules, deleted approaches, and added config tell the real story.
6. kinds: DECISION, CONVENTION, GOTCHA, FAILED_APPROACH, ARCHITECTURE, INVARIANT, GUARDRAIL (guardrail_level never|ask-first|always), SKILL, TODO_CONTEXT.
7. Scope with the touched paths; add "static_check" (cheap shell command, exit 0 iff true) when an honest one exists.
8. 0–2 claims per commit. Zero is the common case.

Respond with ONLY: {"claims":[{"kind":"DECISION","claim":"Rate limiting uses Redis (src/limits); the in-memory limiter was abandoned because multi-instance deploys need shared counters","paths":["src/limits"],"symbols":[],"guardrail_level":null,"applies_when":[],"rationale":"commit switched from in-memory limiter to Redis","static_check":"grep -r 'redis' src/limits/"}]}`;

function commitDiff(repoRoot: string, sha: string): string {
  try {
    return git(repoRoot, ["show", sha, "--stat", "--patch", "--format="]).slice(0, LLM_DIFF_CHARS);
  } catch {
    return "";
  }
}

/**
 * LLM-powered deep mining: reads message + diff, synthesizes claims with
 * suggested STATIC_CHECKs. Requires a text provider (OpenAI/Ollama); the
 * caller falls back to regex mining when none is available. Same cursor as
 * regex mining — the two modes are alternatives over the same history.
 */
export async function mineCommitsLlm(
  store: MemoryStore,
  repoRoot: string,
  opts: { maxCommits?: number; full?: boolean } = {}
): Promise<MineResult & { provider: string | null }> {
  const { getTextProvider } = await import("../knowledge/llm.js");
  const { parseClaims } = await import("../knowledge/extract.js");
  const provider = await getTextProvider();
  if (!provider) {
    const r = mineCommits(store, repoRoot, opts);
    return { ...r, provider: null };
  }

  if (!hasGitCommits(repoRoot)) {
    return { scanned: 0, proposed: [], skippedDuplicates: 0, lastSha: null, noCommits: true, provider: null };
  }

  const sinceSha = opts.full ? null : store.getMeta(MINER_CURSOR_KEY);
  const commits = readCommits(repoRoot, sinceSha, Math.min(opts.maxCommits ?? LLM_MAX_COMMITS, LLM_MAX_COMMITS));
  if (commits.length === 0 && sinceSha) {
    return {
      scanned: 0,
      proposed: [],
      skippedDuplicates: 0,
      lastSha: sinceSha,
      noNewCommits: true,
      provider: `${provider.name}/${provider.model}`,
    };
  }
  const ticketPattern = readTicketsConfig(repoRoot).pattern ?? DEFAULT_TICKET_PATTERN;

  const proposed: Proposal[] = [];
  let skippedDuplicates = 0;

  for (const c of commits) {
    // Pure merge noise never carries signal — skip the LLM call entirely.
    if (/^Merge branch /i.test(c.subject) && !c.body.trim()) continue;
    const user =
      `Commit ${c.sha.slice(0, 12)}\nSubject: ${c.subject}\nBody:\n${c.body || "(none)"}\n\n` +
      `Diff (truncated):\n${commitDiff(repoRoot, c.sha)}`;
    let claims;
    try {
      claims = parseClaims(await provider.generate(COMMIT_EXTRACT_INSTRUCTIONS, user));
    } catch (err) {
      debugLog(`llm mining commit ${c.sha.slice(0, 8)} (skipped)`, err);
      continue; // provider hiccup on one commit shouldn't kill the run
    }
    const ticketRef = extractTicketId(`${c.subject}\n${c.body}`, ticketPattern) ?? undefined;
    for (const cl of claims.slice(0, 2)) {
      const evidence: ProposalInput["evidence"] = [{ type: "COMMIT_REF", payload: c.sha }];
      if (cl.staticCheck) evidence.push({ type: "STATIC_CHECK", payload: cl.staticCheck });
      if (ticketRef) evidence.push({ type: "TICKET_REF", payload: ticketRef });
      const p = store.propose({
        kind: cl.kind,
        claim: cl.claim,
        paths: cl.paths ?? scopeFromFiles(c.files),
        symbols: cl.symbols,
        guardrailLevel: cl.guardrailLevel,
        appliesWhen: cl.appliesWhen,
        evidence,
        source: "commit-miner",
        sourceRef: c.sha,
        rationale: cl.rationale ?? `LLM-mined from commit ${c.sha.slice(0, 8)}: ${c.subject}`,
        ticketRef,
      });
      if (p) proposed.push(p);
      else skippedDuplicates++;
    }
  }

  const head = commits.length > 0 ? commits[0].sha : sinceSha;
  if (head) store.setMeta(MINER_CURSOR_KEY, head);

  return {
    scanned: commits.length,
    proposed,
    skippedDuplicates,
    lastSha: head ?? null,
    provider: `${provider.name}/${provider.model}`,
  };
}

/** Human-readable summary of a mine run (CLI + MCP). */
export function describeMineResult(
  r: MineResult,
  opts: { llmProvider?: string | null; llmRequested?: boolean } = {}
): string {
  if (r.noCommits) return "No git commits yet — make an initial commit before mining history.";
  if (r.noNewCommits) {
    return (
      `No new commits since the last mine (cursor @ ${r.lastSha?.slice(0, 8) ?? "?"}). ` +
      "Use full=true (or `dim mine --full`) to rescan all history."
    );
  }
  const llmNote =
    opts.llmRequested && !opts.llmProvider
      ? " (no LLM provider — fell back to keyword mining; run Ollama or set OPENAI_API_KEY for llm=true)"
      : opts.llmProvider
        ? ` with ${opts.llmProvider}`
        : "";
  let msg =
    `Scanned ${r.scanned} commit(s)${llmNote}: ${r.proposed.length} proposal(s) queued` +
    (r.skippedDuplicates ? `, ${r.skippedDuplicates} duplicate(s) skipped` : "") +
    (r.lastSha ? ` (cursor @ ${r.lastSha.slice(0, 8)})` : "");
  if (r.proposed.length === 0 && r.scanned > 0) {
    msg +=
      "\nNone matched memory-worthy signals — try descriptive commit messages" +
      (opts.llmRequested ? "." : " or enable llm=true / `dim mine --llm`.");
  } else if (r.proposed.length > 0) {
    msg += "\nReview with `dim review`.";
  }
  return msg;
}

