# aidimag retrieval-quality benchmark results

- **Date:** 2026-08-12T02:06:38.714Z
- **Node:** v24.7.0 on darwin arm64 (Apple M4)
- **Corpus:** 20 labeled memories + 200 distractors
- **Queries:** 20 labeled (keyword / paraphrase / scoped)
- **Embedding provider:** amazon.titan-embed-text-v2:0 (dim 1024)

## Retrieval — FTS-only

| Category | n | Recall@1 | Recall@5 | Recall@10 | MRR |
|---|---|---|---|---|---|
| ALL | 20 | 0.65 | 0.65 | 0.70 | 0.66 |
| keyword | 8 | 1.00 | 1.00 | 1.00 | 1.00 |
| paraphrase | 8 | 0.25 | 0.25 | 0.38 | 0.27 |
| scoped | 4 | 0.75 | 0.75 | 0.75 | 0.75 |

## Retrieval — Hybrid (amazon.titan-embed-text-v2:0 (dim 1024))

| Category | n | Recall@1 | Recall@5 | Recall@10 | MRR |
|---|---|---|---|---|---|
| ALL | 20 | 0.80 | 0.90 | 1.00 | 0.85 |
| keyword | 8 | 1.00 | 1.00 | 1.00 | 1.00 |
| paraphrase | 8 | 0.50 | 0.75 | 1.00 | 0.62 |
| scoped | 4 | 1.00 | 1.00 | 1.00 | 1.00 |

## Staleness detection

- Baseline verification (pre-mutation): all VERIFIED
- **Detection rate:** 100% of broken claims flipped STALE
- **False-positive rate:** 0% of intact claims wrongly flipped
- Recovery proposals auto-drafted: 4

| Case | Evidence | Expected | Actual | |
|---|---|---|---|---|
| grep constant (drifts) | STATIC_CHECK | STALE | STALE | ✓ |
| file exists (deleted) | STATIC_CHECK | STALE | STALE | ✓ |
| function name (renamed) | STATIC_CHECK | STALE | STALE | ✓ |
| commit-anchored file (edited) | COMMIT_REF | STALE | STALE | ✓ |
| grep constant (holds) | STATIC_CHECK | VERIFIED | VERIFIED | ✓ |
| file exists (holds) | STATIC_CHECK | VERIFIED | VERIFIED | ✓ |
| structured logging grep (holds) | STATIC_CHECK | VERIFIED | VERIFIED | ✓ |
| commit-anchored file (untouched) | COMMIT_REF | VERIFIED | VERIFIED | ✓ |

