# aidimag benchmark results

- **Date:** 2026-08-12T01:02:39.612Z
- **Node:** v24.7.0 on darwin arm64
- **CPU:** Apple M4 (10 cores, 16 GB RAM)
- **DB sizes:** 100, 1000, 10000 memories

## Write throughput (`memory-write`)

| DB size | total | writes/s | per write |
|---|---|---|---|
| 100 | 19.53ms | 5122 | 195µs |
| 1000 | 180.46ms | 5541 | 180µs |
| 10000 | 2.28s | 4381 | 228µs |

## Cold DB open (`store-open`)

| DB size | p50 | p95 | max |
|---|---|---|---|
| 100 | 345µs | 861µs | 861µs |
| 1000 | 425µs | 1.20ms | 1.20ms |
| 10000 | 360µs | 4.75ms | 4.75ms |

## FTS5 keyword search (`fts-search`)

| DB size | p50 | p95 | max | avg hits |
|---|---|---|---|---|
| 100 | 405µs | 1.70ms | 5.77ms | 10.0 |
| 1000 | 581µs | 1.70ms | 9.15ms | 10.0 |
| 10000 | 1.45ms | 2.64ms | 7.76ms | 10.0 |

## Path-scoped recall (`path-recall`)

| DB size | p50 | p95 | max |
|---|---|---|---|
| 100 | 478µs | 568µs | 5.70ms |
| 1000 | 882µs | 1.04ms | 12.76ms |
| 10000 | 6.10ms | 8.19ms | 14.70ms |

## Vector KNN (`vector-knn`)

| DB size | p50 | p95 | index rate |
|---|---|---|---|
| 100 | 396µs | 1.51ms | 3047 vec/s (dim 768) |
| 1000 | 345µs | 656µs | 7276 vec/s (dim 768) |
| 10000 | 4.15ms | 4.83ms | 11733 vec/s (dim 768) |

## Review queue (`proposal-flow`)

| proposals | propose/s | approve/s |
|---|---|---|
| 1000 | 10105 | 3380 |

## Full sync delta (`sync-delta`)

| DB size | p50 | p95 | max |
|---|---|---|---|
| 100 | 1.99ms | 2.32ms | 2.32ms |
| 1000 | 19.78ms | 38.32ms | 38.32ms |
| 10000 | 223.29ms | 252.19ms | 252.19ms |

## Dashboard queries (`status-audit`)

| DB size | summary p50 | summary p95 | audit p50 | audit p95 |
|---|---|---|---|---|
| 100 | 71µs | 295µs | 2.51ms | 5.88ms |
| 1000 | 136µs | 153µs | 20.68ms | 30.17ms |
| 10000 | 885µs | 1.12ms | 227.21ms | 321.99ms |

## Knowledge chunking (`chunking`)

| doc size | p50 | throughput | chunks |
|---|---|---|---|
| 5.0 MB | 25.03ms | 199.8 MB/s | 453 |

## CLI cold start (`cli-cold-start`)

| command | p50 | p95 |
|---|---|---|
| `dim --help` | 41.24ms | 57.18ms |

