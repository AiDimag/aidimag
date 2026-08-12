#!/usr/bin/env node
/**
 * aidimag retrieval-quality + staleness-detection benchmark.
 *
 * Unlike benchmark/run.mjs (speed), this measures whether the engine returns
 * the RIGHT memories and notices when they stop being true:
 *
 *   1. retrieval — labeled query set (benchmark/quality-dataset.json) scored
 *      with Recall@1/5/10 and MRR, per category:
 *        keyword    — query shares vocabulary with the claim (FTS home turf)
 *        paraphrase — different wording (where semantic search should shine)
 *        scoped     — path-filtered recall
 *      Runs the FTS-only path always, and the hybrid (FTS + vector KNN) path
 *      when an embedding provider is available (OpenAI key or local Ollama).
 *
 *   2. staleness — builds a real git fixture repo, writes memories grounded in
 *      STATIC_CHECK / COMMIT_REF evidence, verifies (all should hold), then
 *      mutates the repo to break half the claims and re-verifies. Scores:
 *        detection rate  — broken claims correctly flipped to STALE
 *        false positives — intact claims wrongly flipped to STALE
 *
 * Usage:
 *   npm run bench:quality
 *   node benchmark/quality.mjs --distractors 500
 *   node benchmark/quality.mjs --json
 *
 * Results: benchmark/results/quality-latest.{md,json}. Throwaway temp dirs
 * only — never touches your real .aidimag/ brain.
 */

import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, unlinkSync } from "node:fs";
import { tmpdir, cpus, platform, arch } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const RESULTS_DIR = path.join(__dirname, "results");

const { MemoryStore } = await import(path.join(ROOT, "dist/db/store.js"));
const { hybridSearch, reindexAll } = await import(path.join(ROOT, "dist/embeddings/search.js"));
const { verifyAll } = await import(path.join(ROOT, "dist/verify/engine.js"));

// ---------------------------------------------------------------- CLI args

const args = process.argv.slice(2);
const JSON_ONLY = args.includes("--json");
const dArg = args.find((a) => a.startsWith("--distractors"));
const DISTRACTORS = dArg
  ? parseInt(dArg.includes("=") ? dArg.split("=")[1] : args[args.indexOf(dArg) + 1], 10)
  : 200;
const K_VALUES = [1, 5, 10];

function log(...parts) {
  if (!JSON_ONLY) console.log(...parts);
}

// ---------------------------------------------------------------- fixture

const dataset = JSON.parse(readFileSync(path.join(__dirname, "quality-dataset.json"), "utf8"));

const workDir = mkdtempSync(path.join(tmpdir(), "aidimag-quality-"));
process.on("exit", () => {
  try {
    rmSync(workDir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
});

/** Deterministic PRNG for reproducible distractors. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x9e37);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

// Distractor vocabulary deliberately avoids the labeled claims' key terms so
// distractors add realistic index noise without becoming accidental relevants.
const D_SUBJECTS = ["build pipeline", "asset bundler", "search indexer", "notification fan-out", "image resizer", "cron scheduler", "backup job", "metrics collector", "tracing exporter", "sitemap generator"];
const D_VERBS = ["compresses", "shards", "prefetches", "debounces", "memoizes", "streams", "throttles", "replays", "mirrors", "compacts"];
const D_OBJECTS = ["thumbnail variants", "gzip artifacts", "trace spans", "daily snapshots", "sitemap entries", "brotli bundles", "prometheus counters", "webhook fan-out batches", "cold-storage archives", "cdn purge lists"];
const D_DIRS = ["src/build", "src/assets", "src/metrics", "src/cron", "src/backup", "src/tracing", "src/thumbs", "src/sitemap", "src/cdn", "src/notify"];
const D_KINDS = ["DECISION", "CONVENTION", "GOTCHA", "ARCHITECTURE", "TODO_CONTEXT"];

// ---------------------------------------------------------------- 1. retrieval

log(`aidimag quality benchmark — ${dataset.queries.length} labeled queries, ${DISTRACTORS} distractors`);
log(`temp dir: ${workDir}\n`);

const brainDir = path.join(workDir, "brain");
mkdirSync(path.join(brainDir, ".aidimag"), { recursive: true });
const store = new MemoryStore(path.join(brainDir, ".aidimag", "memory.db"));

const keyToId = new Map();
for (const m of dataset.memories) {
  const entry = store.write({
    kind: m.kind,
    claim: m.claim,
    paths: m.paths ?? [],
    symbols: [],
    evidence: [],
    createdBy: "human",
  });
  keyToId.set(m.key, entry.id);
}
for (let i = 0; i < DISTRACTORS; i++) {
  store.write({
    kind: pick(D_KINDS),
    claim: `${pick(D_SUBJECTS)} ${pick(D_VERBS)} ${pick(D_OBJECTS)} (note ${i})`,
    paths: rand() < 0.5 ? [pick(D_DIRS)] : [],
    symbols: [],
    evidence: [],
    createdBy: "agent:bench",
  });
}

// Try to enable the semantic path (requires OpenAI key or local Ollama).
let semanticAvailable = false;
let providerLabel = "none";
try {
  const { indexed, provider } = await reindexAll(store);
  if (provider) {
    semanticAvailable = true;
    providerLabel = `${provider.model} (dim ${provider.dim})`;
    log(`embedding provider: ${providerLabel} — indexed ${indexed} memories\n`);
  } else {
    log("embedding provider: none detected — scoring FTS-only path\n");
  }
} catch (err) {
  log(`embedding provider: failed (${err?.message ?? err}) — scoring FTS-only path\n`);
}

function scoreRanking(rankedIds, relevantIds) {
  const relevant = new Set(relevantIds);
  let firstRank = null;
  rankedIds.forEach((id, i) => {
    if (firstRank === null && relevant.has(id)) firstRank = i + 1;
  });
  const recallAt = {};
  for (const k of K_VALUES) {
    const topK = new Set(rankedIds.slice(0, k));
    const hit = relevantIds.filter((id) => topK.has(id)).length;
    recallAt[k] = hit / relevantIds.length;
  }
  return { recallAt, rr: firstRank ? 1 / firstRank : 0, firstRank };
}

async function evaluate(mode) {
  const perQuery = [];
  for (const q of dataset.queries) {
    const relevantIds = q.relevant.map((k) => keyToId.get(k)).filter(Boolean);
    const opts = { query: q.query, paths: q.paths, limit: 10 };
    let results;
    if (mode === "fts") {
      results = store.search(opts);
    } else {
      ({ results } = await hybridSearch(store, opts));
    }
    const score = scoreRanking(results.map((m) => m.id), relevantIds);
    perQuery.push({ category: q.category, query: q.query, ...score });
  }
  return perQuery;
}

function aggregate(perQuery) {
  const groups = new Map([["ALL", perQuery]]);
  for (const q of perQuery) {
    if (!groups.has(q.category)) groups.set(q.category, []);
    groups.get(q.category).push(q);
  }
  const out = {};
  for (const [cat, rows] of groups) {
    const agg = { n: rows.length, mrr: rows.reduce((a, r) => a + r.rr, 0) / rows.length };
    for (const k of K_VALUES) {
      agg[`recall@${k}`] = rows.reduce((a, r) => a + r.recallAt[k], 0) / rows.length;
    }
    out[cat] = agg;
  }
  return out;
}

const retrieval = {};
{
  const per = await evaluate("fts");
  retrieval.fts = { perQuery: per, aggregate: aggregate(per) };
  logRetrieval("FTS-only", retrieval.fts.aggregate);
}
if (semanticAvailable) {
  const per = await evaluate("hybrid");
  retrieval.hybrid = { perQuery: per, aggregate: aggregate(per) };
  logRetrieval(`Hybrid (${providerLabel})`, retrieval.hybrid.aggregate);
}

function logRetrieval(label, agg) {
  log(`retrieval — ${label}`);
  for (const cat of ["ALL", "keyword", "paraphrase", "scoped"]) {
    const a = agg[cat];
    if (!a) continue;
    log(
      `  ${cat.padEnd(10)} n=${String(a.n).padStart(2)}  R@1 ${a["recall@1"].toFixed(2)}  R@5 ${a["recall@5"].toFixed(2)}  R@10 ${a["recall@10"].toFixed(2)}  MRR ${a.mrr.toFixed(2)}`
    );
  }
  log("");
}

store.close();

// ---------------------------------------------------------------- 2. staleness

// A real git repo whose files ground STATIC_CHECK / COMMIT_REF evidence.
// `break: fn` mutates the repo so the claim SHOULD flip STALE; cases without
// `break` must stay VERIFIED (false-positive controls).

const fixRepo = path.join(workDir, "fixture-repo");
mkdirSync(path.join(fixRepo, ".aidimag"), { recursive: true });
mkdirSync(path.join(fixRepo, "src"), { recursive: true });

const git = (...a) =>
  execFileSync("git", a, { cwd: fixRepo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

writeFileSync(path.join(fixRepo, "src/config.js"), "export const MAX_RETRIES = 3;\nexport const TIMEOUT_MS = 5000;\n");
writeFileSync(path.join(fixRepo, "src/auth.js"), "export function verifyToken(t) { return t.length > 0; }\n");
writeFileSync(path.join(fixRepo, "src/legacy.js"), "// legacy shim, kept until v2\n");
writeFileSync(path.join(fixRepo, "src/db.js"), "import { pool } from './pool.js';\nexport const query = (sql) => pool.query(sql);\n");
writeFileSync(path.join(fixRepo, "src/logger.js"), "export const log = (m) => console.log(JSON.stringify(m));\n");
writeFileSync(path.join(fixRepo, "src/api.js"), "export const PAGE_SIZE = 50;\n");
git("init", "-q");
git("-c", "user.email=bench@aidimag.test", "-c", "user.name=bench", "add", "-A");
git("-c", "user.email=bench@aidimag.test", "-c", "user.name=bench", "commit", "-qm", "fixture");
const sha = git("rev-parse", "HEAD");

const cases = [
  {
    name: "grep constant (drifts)",
    evidence: { type: "STATIC_CHECK", payload: "grep -q 'MAX_RETRIES = 3' src/config.js" },
    break: () => writeFileSync(path.join(fixRepo, "src/config.js"), "export const MAX_RETRIES = 5;\nexport const TIMEOUT_MS = 5000;\n"),
  },
  {
    name: "file exists (deleted)",
    evidence: { type: "STATIC_CHECK", payload: "test -f src/legacy.js" },
    break: () => unlinkSync(path.join(fixRepo, "src/legacy.js")),
  },
  {
    name: "function name (renamed)",
    evidence: { type: "STATIC_CHECK", payload: "grep -q 'function verifyToken' src/auth.js" },
    break: () => writeFileSync(path.join(fixRepo, "src/auth.js"), "export function validateToken(t) { return t.length > 0; }\n"),
  },
  {
    name: "commit-anchored file (edited)",
    evidence: { type: "COMMIT_REF", payload: `${sha}:src/db.js` },
    break: () => writeFileSync(path.join(fixRepo, "src/db.js"), "export const query = () => { throw new Error('rewritten'); };\n"),
  },
  {
    name: "grep constant (holds)",
    evidence: { type: "STATIC_CHECK", payload: "grep -q 'PAGE_SIZE = 50' src/api.js" },
  },
  {
    name: "file exists (holds)",
    evidence: { type: "STATIC_CHECK", payload: "test -f src/logger.js" },
  },
  {
    name: "structured logging grep (holds)",
    evidence: { type: "STATIC_CHECK", payload: "grep -q 'JSON.stringify' src/logger.js" },
  },
  {
    name: "commit-anchored file (untouched)",
    evidence: { type: "COMMIT_REF", payload: `${sha}:src/logger.js` },
  },
];

const fixStore = new MemoryStore(path.join(fixRepo, ".aidimag", "memory.db"));
const caseIds = new Map();
for (const c of cases) {
  const entry = fixStore.write({
    kind: "INVARIANT",
    claim: `staleness case: ${c.name}`,
    paths: [],
    symbols: [],
    evidence: [c.evidence],
    createdBy: "human",
    trustExecutableEvidence: true,
  });
  caseIds.set(c.name, entry.id);
}

// Baseline verify: every claim should hold (anything else is a harness bug).
const baseline = verifyAll(fixStore, fixRepo);
const baselineOk = baseline.results.every((r) => r.after === "VERIFIED");

// Mutate the repo (committed, as real drift arrives — COMMIT_REF diffs
// sha..HEAD, not the working tree), then re-verify.
for (const c of cases) c.break?.();
git("-c", "user.email=bench@aidimag.test", "-c", "user.name=bench", "add", "-A");
git("-c", "user.email=bench@aidimag.test", "-c", "user.name=bench", "commit", "-qm", "drift");
const after = verifyAll(fixStore, fixRepo);
const statusOf = (name) => after.results.find((r) => r.memoryId === caseIds.get(name))?.after;

const shouldBreak = cases.filter((c) => c.break);
const shouldHold = cases.filter((c) => !c.break);
const truePositives = shouldBreak.filter((c) => statusOf(c.name) === "STALE");
const falsePositives = shouldHold.filter((c) => statusOf(c.name) === "STALE");
const staleProposals = fixStore.listProposals("PENDING").filter((p) => p.source === "verify:stale");

const staleness = {
  baselineAllVerified: baselineOk,
  cases: cases.map((c) => ({
    name: c.name,
    evidenceType: c.evidence.type,
    expected: c.break ? "STALE" : "VERIFIED",
    actual: statusOf(c.name),
    correct: statusOf(c.name) === (c.break ? "STALE" : "VERIFIED"),
  })),
  detectionRate: truePositives.length / shouldBreak.length,
  falsePositiveRate: falsePositives.length / shouldHold.length,
  recoveryProposalsDrafted: staleProposals.length,
};

log("staleness detection");
log(`  baseline verify: ${baselineOk ? "all VERIFIED ✓" : "UNEXPECTED non-VERIFIED baseline ✗"}`);
for (const c of staleness.cases) {
  log(`  ${c.correct ? "✓" : "✗"} ${c.name.padEnd(32)} expected ${c.expected.padEnd(8)} got ${c.actual}`);
}
log(`  detection rate: ${(staleness.detectionRate * 100).toFixed(0)}%  false positives: ${(staleness.falsePositiveRate * 100).toFixed(0)}%  recovery proposals drafted: ${staleness.recoveryProposalsDrafted}`);

fixStore.close();

// ---------------------------------------------------------------- output

const env = {
  date: new Date().toISOString(),
  node: process.version,
  platform: `${platform()} ${arch()}`,
  cpu: cpus()[0]?.model ?? "unknown",
  distractors: DISTRACTORS,
  embeddingProvider: providerLabel,
};
const payload = { env, retrieval, staleness };

if (JSON_ONLY) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  mkdirSync(RESULTS_DIR, { recursive: true });
  const jsonPath = path.join(RESULTS_DIR, "quality-latest.json");
  writeFileSync(jsonPath, JSON.stringify(payload, null, 2) + "\n");
  const mdPath = path.join(RESULTS_DIR, "quality-latest.md");
  writeFileSync(mdPath, renderMarkdown(payload));
  log(`\nresults written:\n  ${mdPath}\n  ${jsonPath}`);
}

function renderMarkdown({ env, retrieval, staleness }) {
  const lines = [];
  lines.push("# aidimag retrieval-quality benchmark results");
  lines.push("");
  lines.push(`- **Date:** ${env.date}`);
  lines.push(`- **Node:** ${env.node} on ${env.platform} (${env.cpu})`);
  lines.push(`- **Corpus:** ${dataset.memories.length} labeled memories + ${env.distractors} distractors`);
  lines.push(`- **Queries:** ${dataset.queries.length} labeled (keyword / paraphrase / scoped)`);
  lines.push(`- **Embedding provider:** ${env.embeddingProvider}`);
  lines.push("");

  const table = (label, agg) => {
    lines.push(`## Retrieval — ${label}`);
    lines.push("");
    lines.push("| Category | n | Recall@1 | Recall@5 | Recall@10 | MRR |");
    lines.push("|---|---|---|---|---|---|");
    for (const cat of ["ALL", "keyword", "paraphrase", "scoped"]) {
      const a = agg[cat];
      if (!a) continue;
      lines.push(
        `| ${cat} | ${a.n} | ${a["recall@1"].toFixed(2)} | ${a["recall@5"].toFixed(2)} | ${a["recall@10"].toFixed(2)} | ${a.mrr.toFixed(2)} |`
      );
    }
    lines.push("");
  };
  table("FTS-only", retrieval.fts.aggregate);
  if (retrieval.hybrid) table(`Hybrid (${env.embeddingProvider})`, retrieval.hybrid.aggregate);
  else {
    lines.push("_Hybrid (semantic) path skipped — no embedding provider detected. Set `OPENAI_API_KEY` or run Ollama and re-run._");
    lines.push("");
  }

  lines.push("## Staleness detection");
  lines.push("");
  lines.push(`- Baseline verification (pre-mutation): ${staleness.baselineAllVerified ? "all VERIFIED" : "FAILED — harness bug"}`);
  lines.push(`- **Detection rate:** ${(staleness.detectionRate * 100).toFixed(0)}% of broken claims flipped STALE`);
  lines.push(`- **False-positive rate:** ${(staleness.falsePositiveRate * 100).toFixed(0)}% of intact claims wrongly flipped`);
  lines.push(`- Recovery proposals auto-drafted: ${staleness.recoveryProposalsDrafted}`);
  lines.push("");
  lines.push("| Case | Evidence | Expected | Actual | |");
  lines.push("|---|---|---|---|---|");
  for (const c of staleness.cases) {
    lines.push(`| ${c.name} | ${c.evidenceType} | ${c.expected} | ${c.actual} | ${c.correct ? "✓" : "✗"} |`);
  }
  lines.push("");
  return lines.join("\n") + "\n";
}

