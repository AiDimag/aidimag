#!/usr/bin/env node
/**
 * aidimag benchmark harness.
 *
 * Measures the performance-critical surfaces of the local-first engine:
 *
 *   1. store-open      — cold DB open + schema/migration checks (per DB size)
 *   2. memory-write    — write() throughput (insert + scopes + evidence + event log)
 *   3. fts-search      — FTS5 keyword search latency p50/p95 (per DB size)
 *   4. path-recall     — path-scoped recall (getForFiles) latency
 *   5. vector-knn      — sqlite-vec KNN latency over synthetic embeddings
 *   6. proposal-flow   — propose() + approveProposal() review-queue throughput
 *   7. sync-delta      — changedSince(null) full-delta computation
 *   8. status-audit    — statusSummary() + auditMemories() dashboard queries
 *   9. chunking        — knowledge-doc chunkText() throughput (MB/s)
 *  10. cli-cold-start  — `dim --help` process spawn-to-exit wall time
 *
 * Usage:
 *   npm run build && node benchmark/run.mjs                 # full run (100 / 1k / 10k)
 *   node benchmark/run.mjs --sizes 100,1000                 # custom DB sizes
 *   node benchmark/run.mjs --quick                          # small sizes, fewer iterations
 *   node benchmark/run.mjs --json                           # JSON to stdout only
 *
 * Results are written to benchmark/results/latest.{md,json} (and a timestamped
 * copy) so they can be diffed across versions.
 *
 * All benchmarks run against throwaway databases in a temp directory — nothing
 * touches your real .aidimag/ brain.
 */

import { mkdtempSync, mkdirSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir, cpus, platform, arch, totalmem } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const RESULTS_DIR = path.join(__dirname, "results");

const { MemoryStore } = await import(path.join(ROOT, "dist/db/store.js"));
const { chunkText } = await import(path.join(ROOT, "dist/knowledge/chunk.js"));

// ---------------------------------------------------------------- CLI args

const args = process.argv.slice(2);
const QUICK = args.includes("--quick");
const JSON_ONLY = args.includes("--json");
const sizesArg = args.find((a) => a.startsWith("--sizes"));
const SIZES = sizesArg
  ? (sizesArg.includes("=") ? sizesArg.split("=")[1] : args[args.indexOf(sizesArg) + 1])
      .split(",")
      .map((n) => parseInt(n, 10))
      .filter((n) => Number.isFinite(n) && n > 0)
  : QUICK
    ? [100, 1000]
    : [100, 1000, 10000];

const SEARCH_ITERS = QUICK ? 50 : 200;
const KNN_ITERS = QUICK ? 50 : 200;
const EMBED_DIM = 768;

// ---------------------------------------------------------------- helpers

/** Deterministic PRNG so runs are reproducible across machines. */
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
const rand = mulberry32(0xa1d1);

const VERBS = ["uses", "requires", "forbids", "wraps", "validates", "caches", "retries", "escapes", "batches", "normalizes"];
const SUBJECTS = ["auth middleware", "db layer", "sync client", "payment webhook", "rate limiter", "config loader", "session store", "queue consumer", "http client", "migration runner"];
const OBJECTS = ["parameterized queries", "exponential backoff", "UTC timestamps", "zod schemas", "prepared statements", "idempotency keys", "structured logging", "feature flags", "connection pooling", "optimistic locking"];
const DIRS = ["src/db", "src/auth", "src/sync", "src/api", "src/queue", "src/config", "src/payments", "src/http", "src/session", "src/migrations"];
const KINDS = ["DECISION", "CONVENTION", "GOTCHA", "FAILED_APPROACH", "ARCHITECTURE", "INVARIANT", "TODO_CONTEXT"];

function pick(arr) {
  return arr[Math.floor(rand() * arr.length)];
}

function syntheticClaim(i) {
  return `${pick(SUBJECTS)} ${pick(VERBS)} ${pick(OBJECTS)} (case ${i})`;
}

function syntheticInput(i) {
  return {
    kind: pick(KINDS),
    claim: syntheticClaim(i),
    paths: rand() < 0.6 ? [pick(DIRS)] : [],
    symbols: [],
    evidence: rand() < 0.3 ? [{ type: "HUMAN_ATTESTED", payload: `bench attestation ${i}` }] : [],
    createdBy: rand() < 0.5 ? "human" : "agent:bench",
  };
}

function randomVector(dim) {
  const v = new Array(dim);
  for (let i = 0; i < dim; i++) v[i] = rand() * 2 - 1;
  return v;
}

function percentile(sorted, p) {
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function stats(samplesMs) {
  const sorted = [...samplesMs].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    n: sorted.length,
    mean: sum / sorted.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    max: sorted[sorted.length - 1],
  };
}

function fmt(ms) {
  if (ms < 0.001) return `${(ms * 1000).toFixed(2)}µs`;
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function log(...parts) {
  if (!JSON_ONLY) console.log(...parts);
}

// ---------------------------------------------------------------- fixture

const workDir = mkdtempSync(path.join(tmpdir(), "aidimag-bench-"));
process.on("exit", () => {
  try {
    rmSync(workDir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
});

function freshStore(name) {
  const repo = path.join(workDir, name);
  mkdirSync(path.join(repo, ".aidimag"), { recursive: true });
  return new MemoryStore(path.join(repo, ".aidimag", "memory.db"));
}

/** Populate a store with n synthetic memories. Returns wall ms. */
function populate(store, n) {
  const start = performance.now();
  for (let i = 0; i < n; i++) store.write(syntheticInput(i));
  return performance.now() - start;
}

// ---------------------------------------------------------------- benchmarks

const results = [];

function record(suite, size, metrics) {
  results.push({ suite, size, ...metrics });
}

log(`aidimag benchmark — sizes: ${SIZES.join(", ")}${QUICK ? " (quick)" : ""}`);
log(`temp dir: ${workDir}\n`);

// -- 2. memory-write (also builds the per-size stores used below)
const stores = new Map();
for (const size of SIZES) {
  const store = freshStore(`db-${size}`);
  const ms = populate(store, size);
  stores.set(size, store);
  record("memory-write", size, {
    totalMs: ms,
    opsPerSec: (size / ms) * 1000,
    perOpMs: ms / size,
  });
  log(`memory-write      n=${String(size).padStart(6)}  ${fmt(ms)} total  ${((size / ms) * 1000).toFixed(0)} writes/s`);
}

// -- 1. store-open (cold open of the already-populated DBs)
for (const size of SIZES) {
  const dbPath = stores.get(size).dbPath;
  const samples = [];
  for (let i = 0; i < 10; i++) {
    const t0 = performance.now();
    const s = new MemoryStore(dbPath);
    samples.push(performance.now() - t0);
    s.close();
  }
  const st = stats(samples);
  record("store-open", size, st);
  log(`store-open        n=${String(size).padStart(6)}  p50 ${fmt(st.p50)}  p95 ${fmt(st.p95)}`);
}

// -- 3. fts-search
for (const size of SIZES) {
  const store = stores.get(size);
  const samples = [];
  let hits = 0;
  for (let i = 0; i < SEARCH_ITERS; i++) {
    const query = `${pick(SUBJECTS)} ${pick(OBJECTS)}`;
    const t0 = performance.now();
    const res = store.search({ query, limit: 10 });
    samples.push(performance.now() - t0);
    hits += res.length;
  }
  const st = stats(samples);
  record("fts-search", size, { ...st, avgHits: hits / SEARCH_ITERS });
  log(`fts-search        n=${String(size).padStart(6)}  p50 ${fmt(st.p50)}  p95 ${fmt(st.p95)}  avg hits ${(hits / SEARCH_ITERS).toFixed(1)}`);
}

// -- 4. path-recall
for (const size of SIZES) {
  const store = stores.get(size);
  const samples = [];
  for (let i = 0; i < SEARCH_ITERS; i++) {
    const p = `${pick(DIRS)}/file${i % 7}.ts`;
    const t0 = performance.now();
    store.getForFiles([p], 20);
    samples.push(performance.now() - t0);
  }
  const st = stats(samples);
  record("path-recall", size, st);
  log(`path-recall       n=${String(size).padStart(6)}  p50 ${fmt(st.p50)}  p95 ${fmt(st.p95)}`);
}

// -- 5. vector-knn (synthetic embeddings; requires sqlite-vec)
for (const size of SIZES) {
  const store = stores.get(size);
  if (!store.vecAvailable) {
    record("vector-knn", size, { skipped: true, reason: "sqlite-vec unavailable" });
    log(`vector-knn        n=${String(size).padStart(6)}  SKIPPED (sqlite-vec unavailable)`);
    continue;
  }
  store.ensureVecTable("bench-synthetic", EMBED_DIM);
  const ids = store.list(size).map((m) => m.id);
  const tIndex0 = performance.now();
  for (const id of ids) store.upsertEmbedding(id, randomVector(EMBED_DIM));
  const indexMs = performance.now() - tIndex0;
  const samples = [];
  for (let i = 0; i < KNN_ITERS; i++) {
    const q = randomVector(EMBED_DIM);
    const t0 = performance.now();
    store.knn(q, 10);
    samples.push(performance.now() - t0);
  }
  const st = stats(samples);
  record("vector-knn", size, { ...st, indexMs, indexPerSec: (ids.length / indexMs) * 1000, dim: EMBED_DIM });
  log(`vector-knn        n=${String(size).padStart(6)}  p50 ${fmt(st.p50)}  p95 ${fmt(st.p95)}  (index: ${((ids.length / indexMs) * 1000).toFixed(0)} vec/s, dim ${EMBED_DIM})`);
}

// -- 6. proposal-flow
{
  const store = freshStore("proposals");
  const N = QUICK ? 200 : 1000;
  const tP0 = performance.now();
  const ids = [];
  for (let i = 0; i < N; i++) {
    const p = store.propose({
      kind: pick(KINDS),
      claim: syntheticClaim(100_000 + i),
      paths: [pick(DIRS)],
      symbols: [],
      evidence: [],
      source: "agent:bench",
      sourceRef: `bench-${i}`,
    });
    if (p) ids.push(p.id);
  }
  const proposeMs = performance.now() - tP0;
  const tA0 = performance.now();
  for (const id of ids) store.approveProposal(id);
  const approveMs = performance.now() - tA0;
  record("proposal-flow", N, {
    proposeMs,
    proposePerSec: (N / proposeMs) * 1000,
    approveMs,
    approvePerSec: (ids.length / approveMs) * 1000,
  });
  log(`proposal-flow     n=${String(N).padStart(6)}  propose ${((N / proposeMs) * 1000).toFixed(0)}/s  approve ${((ids.length / approveMs) * 1000).toFixed(0)}/s`);
  store.close();
}

// -- 7. sync-delta
for (const size of SIZES) {
  const store = stores.get(size);
  const samples = [];
  for (let i = 0; i < 10; i++) {
    const t0 = performance.now();
    store.changedSince(null);
    samples.push(performance.now() - t0);
  }
  const st = stats(samples);
  record("sync-delta", size, st);
  log(`sync-delta        n=${String(size).padStart(6)}  p50 ${fmt(st.p50)}  p95 ${fmt(st.p95)}`);
}

// -- 8. status-audit
for (const size of SIZES) {
  const store = stores.get(size);
  const sumSamples = [];
  const auditSamples = [];
  for (let i = 0; i < 20; i++) {
    let t0 = performance.now();
    store.statusSummary();
    sumSamples.push(performance.now() - t0);
    t0 = performance.now();
    store.auditMemories({ limit: 20 });
    auditSamples.push(performance.now() - t0);
  }
  const s1 = stats(sumSamples);
  const s2 = stats(auditSamples);
  record("status-audit", size, { summaryP50: s1.p50, summaryP95: s1.p95, auditP50: s2.p50, auditP95: s2.p95 });
  log(`status-audit      n=${String(size).padStart(6)}  summary p50 ${fmt(s1.p50)}  audit p50 ${fmt(s2.p50)}`);
}

// -- 9. chunking (synthesized 5 MB markdown design doc)
{
  const para = () =>
    Array.from({ length: 8 }, () => `${pick(SUBJECTS)} ${pick(VERBS)} ${pick(OBJECTS)}.`).join(" ");
  let doc = "";
  let h = 0;
  while (Buffer.byteLength(doc, "utf8") < 5 * 1024 * 1024) {
    doc += `\n\n## Section ${++h}\n\n${para()}\n\n${para()}`;
  }
  const bytes = Buffer.byteLength(doc, "utf8");
  const samples = [];
  let chunks = 0;
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    chunks = chunkText(doc, 12_000).length;
    samples.push(performance.now() - t0);
  }
  const st = stats(samples);
  record("chunking", bytes, { ...st, chunks, mbPerSec: bytes / 1024 / 1024 / (st.p50 / 1000) });
  log(`chunking          ${(bytes / 1024 / 1024).toFixed(1)}MB doc  p50 ${fmt(st.p50)}  ${(bytes / 1024 / 1024 / (st.p50 / 1000)).toFixed(1)} MB/s  ${chunks} chunks`);
}

// -- 10. cli-cold-start
{
  const cli = path.join(ROOT, "dist/cli/index.js");
  const samples = [];
  for (let i = 0; i < (QUICK ? 3 : 5); i++) {
    const t0 = performance.now();
    spawnSync(process.execPath, [cli, "--help"], { stdio: "ignore" });
    samples.push(performance.now() - t0);
  }
  const st = stats(samples);
  record("cli-cold-start", 0, st);
  log(`cli-cold-start    dim --help  p50 ${fmt(st.p50)}  p95 ${fmt(st.p95)}`);
}

for (const store of stores.values()) store.close();

// ---------------------------------------------------------------- output

const env = {
  date: new Date().toISOString(),
  node: process.version,
  platform: `${platform()} ${arch()}`,
  cpu: cpus()[0]?.model ?? "unknown",
  cores: cpus().length,
  memGB: Math.round(totalmem() / 1024 ** 3),
  quick: QUICK,
  sizes: SIZES,
};

const payload = { env, results };

if (JSON_ONLY) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  mkdirSync(RESULTS_DIR, { recursive: true });
  const jsonPath = path.join(RESULTS_DIR, "latest.json");
  writeFileSync(jsonPath, JSON.stringify(payload, null, 2) + "\n");

  const md = renderMarkdown(payload);
  const mdPath = path.join(RESULTS_DIR, "latest.md");
  writeFileSync(mdPath, md);
  const stamp = env.date.slice(0, 10);
  copyFileSync(jsonPath, path.join(RESULTS_DIR, `${stamp}.json`));

  log(`\nresults written:\n  ${mdPath}\n  ${jsonPath}`);
}

function renderMarkdown({ env, results }) {
  const lines = [];
  lines.push(`# aidimag benchmark results`);
  lines.push("");
  lines.push(`- **Date:** ${env.date}`);
  lines.push(`- **Node:** ${env.node} on ${env.platform}`);
  lines.push(`- **CPU:** ${env.cpu} (${env.cores} cores, ${env.memGB} GB RAM)`);
  lines.push(`- **DB sizes:** ${env.sizes.join(", ")} memories${env.quick ? " (quick mode)" : ""}`);
  lines.push("");

  const bySuite = new Map();
  for (const r of results) {
    if (!bySuite.has(r.suite)) bySuite.set(r.suite, []);
    bySuite.get(r.suite).push(r);
  }

  const latencyTable = (rows, label = "DB size") => {
    lines.push(`| ${label} | p50 | p95 | max |`);
    lines.push("|---|---|---|---|");
    for (const r of rows) lines.push(`| ${r.size} | ${fmt(r.p50)} | ${fmt(r.p95)} | ${fmt(r.max)} |`);
    lines.push("");
  };

  lines.push("## Write throughput (`memory-write`)");
  lines.push("");
  lines.push("| DB size | total | writes/s | per write |");
  lines.push("|---|---|---|---|");
  for (const r of bySuite.get("memory-write") ?? [])
    lines.push(`| ${r.size} | ${fmt(r.totalMs)} | ${r.opsPerSec.toFixed(0)} | ${fmt(r.perOpMs)} |`);
  lines.push("");

  lines.push("## Cold DB open (`store-open`)");
  lines.push("");
  latencyTable(bySuite.get("store-open") ?? []);

  lines.push("## FTS5 keyword search (`fts-search`)");
  lines.push("");
  lines.push("| DB size | p50 | p95 | max | avg hits |");
  lines.push("|---|---|---|---|---|");
  for (const r of bySuite.get("fts-search") ?? [])
    lines.push(`| ${r.size} | ${fmt(r.p50)} | ${fmt(r.p95)} | ${fmt(r.max)} | ${r.avgHits.toFixed(1)} |`);
  lines.push("");

  lines.push("## Path-scoped recall (`path-recall`)");
  lines.push("");
  latencyTable(bySuite.get("path-recall") ?? []);

  lines.push("## Vector KNN (`vector-knn`)");
  lines.push("");
  lines.push(`| DB size | p50 | p95 | index rate |`);
  lines.push("|---|---|---|---|");
  for (const r of bySuite.get("vector-knn") ?? []) {
    if (r.skipped) lines.push(`| ${r.size} | — | — | skipped: ${r.reason} |`);
    else lines.push(`| ${r.size} | ${fmt(r.p50)} | ${fmt(r.p95)} | ${r.indexPerSec.toFixed(0)} vec/s (dim ${r.dim}) |`);
  }
  lines.push("");

  lines.push("## Review queue (`proposal-flow`)");
  lines.push("");
  lines.push("| proposals | propose/s | approve/s |");
  lines.push("|---|---|---|");
  for (const r of bySuite.get("proposal-flow") ?? [])
    lines.push(`| ${r.size} | ${r.proposePerSec.toFixed(0)} | ${r.approvePerSec.toFixed(0)} |`);
  lines.push("");

  lines.push("## Full sync delta (`sync-delta`)");
  lines.push("");
  latencyTable(bySuite.get("sync-delta") ?? []);

  lines.push("## Dashboard queries (`status-audit`)");
  lines.push("");
  lines.push("| DB size | summary p50 | summary p95 | audit p50 | audit p95 |");
  lines.push("|---|---|---|---|---|");
  for (const r of bySuite.get("status-audit") ?? [])
    lines.push(`| ${r.size} | ${fmt(r.summaryP50)} | ${fmt(r.summaryP95)} | ${fmt(r.auditP50)} | ${fmt(r.auditP95)} |`);
  lines.push("");

  lines.push("## Knowledge chunking (`chunking`)");
  lines.push("");
  lines.push("| doc size | p50 | throughput | chunks |");
  lines.push("|---|---|---|---|");
  for (const r of bySuite.get("chunking") ?? [])
    lines.push(`| ${(r.size / 1024 / 1024).toFixed(1)} MB | ${fmt(r.p50)} | ${r.mbPerSec.toFixed(1)} MB/s | ${r.chunks} |`);
  lines.push("");

  lines.push("## CLI cold start (`cli-cold-start`)");
  lines.push("");
  lines.push("| command | p50 | p95 |");
  lines.push("|---|---|---|");
  for (const r of bySuite.get("cli-cold-start") ?? [])
    lines.push(`| \`dim --help\` | ${fmt(r.p50)} | ${fmt(r.p95)} |`);
  lines.push("");

  return lines.join("\n") + "\n";
}

