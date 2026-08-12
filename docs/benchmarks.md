# Benchmarks

AI Dimag is a local-first tool that sits in your inner development loop — it runs on
every `dim recall`, every MCP `memory_search`, and (via git hooks) on every pull,
checkout, and rebase. Latency matters. This page publishes reproducible measurements
of the performance-critical surfaces of the engine.

## How to reproduce

```sh
git clone https://github.com/AiDimag/aidimag
cd aidimag && npm install
npm run bench            # performance: 100 / 1,000 / 10,000-memory brains
npm run bench:quality    # quality: recall@k / MRR + staleness detection
npm run bench:quick      # faster performance smoke run
node benchmark/run.mjs --sizes 100,50000   # custom brain sizes
node benchmark/run.mjs --json              # machine-readable output
```

Two harnesses live in [`benchmark/`](https://github.com/AiDimag/aidimag/tree/main/benchmark):

- **`run.mjs`** — performance (how fast the engine answers)
- **`quality.mjs`** — retrieval quality and staleness detection (whether it answers
  *correctly*), scored against the labeled query set in `quality-dataset.json`

Both build throwaway databases in a temp directory — they never touch your real
`.aidimag/` brain — and use a seeded PRNG so the synthetic corpus is identical
across machines. Results are written to `benchmark/results/`.

## What is measured

| Suite | What it exercises | Why it matters |
|---|---|---|
| `memory-write` | `write()` — insert + scopes + evidence + event log, in a transaction | `dim remember`, proposal approval, sync apply |
| `store-open` | Cold DB open incl. schema/migration checks | Every CLI invocation and MCP server start |
| `fts-search` | SQLite FTS5 keyword search with status/provenance/recency ranking | `dim recall`, `memory_search` |
| `path-recall` | Path-scoped recall (`getForFiles`) | Session briefings, `dim check`, context generation |
| `vector-knn` | sqlite-vec KNN over 768-dim embeddings + index build rate | The semantic half of hybrid search |
| `proposal-flow` | `propose()` + `approveProposal()` throughput | Commit/PR mining and batch review |
| `sync-delta` | `changedSince(null)` — full-brain delta hydration | First push in `dim sync` |
| `status-audit` | `statusSummary()` + `auditMemories()` | `dim status`, `dim audit`, the web dashboard |
| `chunking` | Structure-aware `chunkText()` over a 5 MB markdown doc | Knowledgebase ingestion |
| `cli-cold-start` | `dim --help` process spawn-to-exit wall time | The floor under every CLI command |
| `retrieval` (quality) | Recall@1/5/10 + MRR over a labeled query set, per category | Does `dim recall` return the *right* memory? |
| `staleness` (quality) | Real git fixture repo mutated after verification | Does `dim verify` catch drift without crying wolf? |

::: tip Not covered (by design)
Anything dominated by external systems is excluded: embedding-provider latency
(OpenAI/Ollama), LLM extraction, network sync round-trips, and the shell commands
your `STATIC_CHECK` evidence runs. Those measure your network and your checks, not
the engine.
:::

## Results

> Apple M4 (10 cores, 16 GB RAM), macOS arm64, Node v24.7.0 — 2026-08-12, aidimag v1.0.22.
> Latencies are per-operation percentiles. A "brain" is one `.aidimag/memory.db`.

### Write throughput

| Brain size | total | writes/s | per write |
|---|---|---|---|
| 100 | 19.5ms | 5,122 | 195µs |
| 1,000 | 180ms | 5,541 | 180µs |
| 10,000 | 2.28s | 4,381 | 228µs |

### Cold DB open

| Brain size | p50 | p95 |
|---|---|---|
| 100 | 345µs | 861µs |
| 1,000 | 425µs | 1.20ms |
| 10,000 | 360µs | 4.75ms |

### FTS5 keyword search

| Brain size | p50 | p95 | max |
|---|---|---|---|
| 100 | 405µs | 1.70ms | 5.77ms |
| 1,000 | 581µs | 1.70ms | 9.15ms |
| 10,000 | 1.45ms | 2.64ms | 7.76ms |

### Path-scoped recall

| Brain size | p50 | p95 |
|---|---|---|
| 100 | 478µs | 568µs |
| 1,000 | 882µs | 1.04ms |
| 10,000 | 6.10ms | 8.19ms |

### Vector KNN (768-dim, sqlite-vec)

| Brain size | query p50 | query p95 | index build |
|---|---|---|---|
| 100 | 396µs | 1.51ms | 3,047 vec/s |
| 1,000 | 345µs | 656µs | 7,276 vec/s |
| 10,000 | 4.15ms | 4.83ms | 11,733 vec/s |

### Review queue

| Proposals | propose/s | approve/s |
|---|---|---|
| 1,000 | 10,105 | 3,380 |

### Full sync delta (`changedSince`)

| Brain size | p50 | p95 |
|---|---|---|
| 100 | 1.99ms | 2.32ms |
| 1,000 | 19.8ms | 38.3ms |
| 10,000 | 223ms | 252ms |

### Dashboard queries

| Brain size | status summary p50 | provenance audit p50 |
|---|---|---|
| 100 | 71µs | 2.51ms |
| 1,000 | 136µs | 20.7ms |
| 10,000 | 885µs | 227ms |

### Knowledge chunking

| Doc size | p50 | throughput | chunks |
|---|---|---|---|
| 5.0 MB | 25.0ms | ~200 MB/s | 453 |

### CLI cold start

| Command | p50 | p95 |
|---|---|---|
| `dim --help` | 41.2ms | 57.2ms |

## Quality results

The quality harness (`npm run bench:quality`) inserts 20 labeled memories plus 200
synthetic distractors into a throwaway brain and scores 20 labeled queries in three
categories, then runs a staleness-detection eval against a real git fixture repo.

### Retrieval — FTS-only vs Hybrid

Hybrid = FTS5 + vector KNN with reciprocal-rank fusion. Measured with AWS Bedrock
Titan Embed v2 (1024-dim) via `AIDIMAG_EMBEDDINGS=bedrock`; OpenAI and Ollama
providers use the same path.

| Category | n | FTS R@1 | FTS MRR | **Hybrid R@1** | **Hybrid R@10** | **Hybrid MRR** |
|---|---|---|---|---|---|---|
| **ALL** | 20 | 0.65 | 0.66 | **0.80** | **1.00** | **0.85** |
| keyword | 8 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| paraphrase | 8 | 0.25 | 0.27 | **0.50** | **1.00** | **0.62** |
| scoped | 4 | 0.75 | 0.75 | **1.00** | 1.00 | **1.00** |

The paraphrase row is the headline: keyword-only search misses reworded queries by
design (MRR 0.27); the hybrid path recovers every one of them within the top 10
(R@10 1.00) and more than doubles MRR. Enabling any embedding provider —
`OPENAI_API_KEY`, local Ollama, or `AIDIMAG_EMBEDDINGS=bedrock` — buys this
improvement with zero configuration changes elsewhere.

### Staleness detection

8 memories grounded in `STATIC_CHECK` / `COMMIT_REF` evidence against a real git
repo; all verify green, then the repo is mutated (constant changed, file deleted,
function renamed, anchored file edited) with 4 intact controls:

| Metric | Result |
|---|---|
| Detection rate (broken claims → STALE) | **100%** (4/4) |
| False positives (intact claims → STALE) | **0%** (0/4) |
| Recovery proposals auto-drafted | 4 |

## Reading the numbers

- **Recall is interactive at any realistic brain size.** Even at 10,000 memories —
  far beyond a typical repo's brain — keyword search answers in ~1.5ms and vector
  KNN in ~4ms. The end-to-end `dim recall` you feel is dominated by Node process
  startup (~40ms) and, with semantic search on, one embedding-provider round trip.
- **Writes are transactional and still fast.** ~200µs per memory includes the FTS
  index update, scope rows, evidence rows, and the sync event log.
- **Full sync delta and provenance audit scale linearly** with brain size because
  they hydrate every memory (scopes + evidence + links per row). At 10,000 memories
  both sit around 220ms — fine for their use (occasional `dim sync` first-push and
  explicit `dim audit`), and the numbers to watch if brains grow much larger.
- **Ingestion won't bottleneck on chunking.** A 5 MB design doc splits in 25ms;
  knowledgebase time is spent in the LLM, not the splitter.
- **Keyword search is perfect on keyword queries and weak on paraphrases** —
  that gap (MRR 1.00 vs 0.27) is the measured, quantified case for enabling an
  embedding provider. Re-run `bench:quality` with one configured to see the
  hybrid path close it.
- **The claim-and-verify loop works as designed:** every broken claim was caught,
  no intact claim was falsely flagged, and each STALE flip auto-drafted a recovery
  proposal for `dim review`. Unlike chat-memory benchmarks (LoCoMo, LongMemEval),
  this measures staleness against an actual mutating repository.

Raw data for every run lives in
[`benchmark/results/`](https://github.com/AiDimag/aidimag/tree/main/benchmark/results)
as versioned JSON so regressions can be diffed release-over-release.

