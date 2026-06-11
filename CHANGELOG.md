# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.11.89] - 2026-06-11

### Changed

- **Server compatibility**: tracks Dakera server v0.11.86–v0.11.89.
  - v0.11.86: CE-OVERHAUL safe subset — RRF single-modality virtual ranking, temporal
    date-range inference, cross-session entity bridging. All engine-internal; no client
    API changes required.
  - v0.11.87: Honor cross-session `fetch_n` override in session-scoped recall path — inert
    for SDK consumers; server-side env knob only.
  - v0.11.88: Opt-in CE-31 sentence decomposition on batch ingest
    (`DAKERA_BATCH_SENTENCE_DECOMP` server env) — no client API changes.
  - v0.11.89: List-aware CE-31 decomposition + hardened supersession demotion, both
    inert-by-default server-side env flags — no client API changes.

## [0.11.85] - 2026-06-05

### Added

- **`HealthResponse.build_sha`** — new optional field (`string | undefined`) on the
  `HealthResponse` interface, populated since server v0.11.84. Contains the git commit
  SHA baked into the server binary; useful for verifying expected commit is running after
  a hotfix rollout.

### Changed

- **Server compatibility**: tracks Dakera server v0.11.84–v0.11.85.
  - v0.11.84: Entity vector search for temporal queries (automatic routing, no client
    changes); reranker queues instead of dropping under load; `build_sha` in `/health`.
  - v0.11.85: Server-side fetch-n env knobs — no client API changes.

## [0.11.83] - 2026-06-04

### Added

- **`adminDrainReembed()`** — new `DakeraClient` method for `POST /admin/reembed/drain`
  (v0.11.82+). Synchronously runs the re-embedding upgrade loop until all
  `_embedding_kind=static` vectors are upgraded to full ONNX quality, or the optional
  `timeout_secs` cap is reached. Accepts an optional `DrainReembedRequest` and returns a
  `DrainReembedResponse` with `processed`, `remaining`, `elapsed_ms`, `cycles`, and
  `timed_out` fields. Requires Admin scope. Useful as a pre-benchmark steady-state gate
  when `DAKERA_TIERED=1`.
- **`DrainReembedRequest` / `DrainReembedResponse`** — new types exported from the package.

### Changed

- **Server compatibility**: tracks Dakera server v0.11.76–v0.11.83.
  - v0.11.76: `search_hybrid()` binary overselection formula corrected (Recall@10 restored).
  - v0.11.77: `SearchMode` default flipped to `Hybrid`; `is_static` flag on write path.
  - v0.11.78–v0.11.79: TieredEngine pre-warm; GPU inference semaphore; batch store via TieredEngine.
  - v0.11.80: SIMD HNSW distance (3–8× throughput); ONNX memory fixes.
  - v0.11.81: `OnnxBackend` GPU pool=1; BFCArena retry extended.
  - v0.11.82: Model2Vec static-write tier (`DAKERA_TIERED=1`); `/health/ready` adds
    `tiered_engine` field.
  - v0.11.83: Deterministic HNSW (CE-127); raw-fs 9× writes; O(namespace) list removed.
  No breaking changes to existing method signatures.

## [0.11.75] - 2026-05-31

### Changed

- **Server compatibility**: tracks Dakera server v0.11.75 (TieredEngine registered in
  AppState, binary HNSW dispatch wired in search paths, ReembedJob spawned at startup).
  No client API surface changes required — all existing calls work unchanged. Binary HNSW
  is opt-in server-side via `DAKERA_SEARCH_MODE=hybrid`; the SDK sends requests identically
  regardless of server search mode.

## [0.11.57] - 2026-05-22

### Added

- **`storeMemoriesBatch()`** — new `DakeraClient` method for `POST /v1/memories/store/batch`,
  enabling high-throughput batch memory ingestion (DAK-5508)
  - `BatchStoreMemoryItem` — per-item fields matching the server batch schema
  - `BatchStoreMemoryRequest` — `agentId` + `BatchStoreMemoryItem[]`
  - `BatchStoredMemory` / `BatchStoreMemoryResponse` — response types

## [0.11.56] - 2026-05-17

### Changed

- **BREAKING: `hybridSearch` option renamed `alpha` → `vectorWeight`** — the blending
  parameter that controls the vector-vs-BM25 weight has been renamed from `alpha` to
  `vectorWeight` for consistency with `recall()`'s existing `vectorWeight` option. Update
  all call sites:
  ```ts
  // Before
  client.hybridSearch('ns', 'query', { vector: [...], alpha: 0.7 })
  // After
  client.hybridSearch('ns', 'query', { vector: [...], vectorWeight: 0.7 })
  ```

### Added

- **40+ new client methods** for full engine parity:
  - **Health probes**: `healthReady()`, `healthLive()`
  - **Vector bulk ops**: `bulkUpdateVectors()`, `bulkDeleteVectors()`, `countVectors()`
  - **Agent consolidation**: `consolidateAgent()`, `getConsolidationLog()`, `patchConsolidationConfig()`
  - **Namespace config**: `getNamespaceEntityConfig()`, `getNamespaceExtractor()`
  - **Admin cluster**: `adminClusterReplication()`, `adminListShards()`, `adminRebalanceShards()`
  - **Admin maintenance**: `adminMaintenanceStatus()`, `adminEnableMaintenance()`, `adminDisableMaintenance()`
  - **Admin quotas**: `adminListQuotas()`, `adminGetDefaultQuota()`, `adminSetDefaultQuota()`, `adminGetQuota()`, `adminSetQuota()`, `adminDeleteQuota()`, `adminCheckQuota()`
  - **Admin slow queries**: `adminListSlowQueries()`, `adminSlowQuerySummary()`, `adminClearSlowQueries()`, `adminUpdateSlowQueryConfig()`
  - **Admin backups**: `adminListBackups()`, `adminCreateBackup()`, `adminGetBackup()`, `adminDeleteBackup()`, `adminGetBackupSchedule()`, `adminUpdateBackupSchedule()`, `adminRestoreBackup()`, `adminGetRestoreStatus()`
  - **Ops**: `opsDiagnostics()`, `opsListJobs()`, `opsGetJob()`, `opsCompact()`, `opsShutdown()`
  - **Fulltext**: `fulltextStats()`, `fulltextDelete()`
  - **TTL**: `adminTtlStats()`
  - **Query routing**: `routeQuery()`
  - **Import jobs**: `importJobStatus()`
  - **Backup I/O**: `adminDownloadBackup()`, `adminUploadBackup()`
  - **Storage tiers**: `adminStorageTierOverview()`
  - **Background activity**: `adminBackgroundActivity()`
  - **Memory type stats**: `adminMemoryTypeStats()`
  - **Namespace migration**: `adminMigrateNamespaceDimensions()`
- **16 new TypeScript interfaces** for structured responses
- **173 unit tests** covering all SDK methods
- **6 new examples**: admin operations, analytics, fulltext search, knowledge graph, ops diagnostics, vector operations
- **Docker integration tests in CI** — full end-to-end integration tests against a live
  Dakera server container on every PR and push.

## [0.11.54] - 2026-05-13

### Notes
- Version bump to match server v0.11.54 (CE-115: INFERENCE_TEMPORAL_MULT_BETA 0.5→0.65, Cat3 +2.2pp to 73.9%). Scoring-only change — no API changes.

## [0.11.53] - 2026-05-08

### Notes
- Version bump to match server v0.11.53. Server improvements v0.11.52–v0.11.53:
  - **v0.11.53** — CE-106 entity+year co-occurrence BM25 boost for Cat2 multi-hop queries; CE-94 temporal-inference centroid tightening (12 patterns, -14.7pp Cat2 false-positive rate); distribution week1 (crate metadata, MCP registry, Docker Hub workflows).
  - **v0.11.52** — CE-86 multiplicative post-reranker temporal scaling (+2.2pp Cat3); complete recall/search metrics coverage (4 PRs).

## [0.11.51] - 2026-05-06

### Added
- **`adminFulltextReindex(namespace?: string)`**: backfill the BM25 fulltext index for memories
  stored before CE-12 auto-indexing (CE-54). Omit `namespace` to reindex all agent namespaces.
  Returns `FulltextReindexResponse` with per-namespace breakdown.
- **`FulltextReindexResponse`** and **`FulltextReindexNamespaceResult`** interfaces (CE-54),
  exported from the package root.

### Notes
- Version bump to match server v0.11.51. Server improvements v0.11.47–v0.11.51:
  - **v0.11.51** — Fix flaky SEC-5 rate-limit tests (configurable window).
  - **v0.11.50** — DAK-3430 S3 retry cap (OpenDAL retry 10→3, MinIO limit 1500→6000).
  - **v0.11.49** — Dependency bumps (governor, opendal, redis, criterion).
  - **v0.11.48** — Security: openssl 0.10.78→0.10.79.
  - **v0.11.47** — ArrayContains HNSW pre-filter (SDK already exposed in v0.11.46 via
    `$arrayContains` / `$arrayContainsAll` / `$arrayContainsAny` in `FilterOperators`).

## [0.11.46] - 2026-04-30

### Added
- **Filter types**: `FilterOperators` now includes all server-supported operators:
  - String operators: `$contains`, `$icontains`, `$startsWith`, `$endsWith`, `$glob`, `$regex`
  - Array operators: `$arrayContains`, `$arrayContainsAll`, `$arrayContainsAny` — match
    memories whose metadata array field contains a given value or set of values; enables
    tag-based HNSW pre-filtering (CE-79).

### Notes
- Version bump to match server v0.11.46. Server improvements v0.11.37–v0.11.46:
  - **CE-79 — ArrayContains filter operators**: New `$arrayContains`, `$arrayContainsAll`,
    `$arrayContainsAny` filter conditions for HNSW pre-filtering on array metadata fields.
  - **CE-73 — Auto-PRF for hybrid inference queries**: Cat3 +4.2pp.
  - **CE-71 — ML query classifier**: Internal embedding-centroid classifier; temporal
    inference detection enabled by default (`DAKERA_TEMPORAL_INFERENCE=true`).
  - **CE-68/69/70 — Temporal boost + recency bias + S3 retry backoff**.
  - **CE-58 — Configurable RRF k-parameter** (`DAKERA_RRF_K` env var, default 60).

## [0.11.36] - 2026-04-26

### Notes
- Version bump to match server v0.11.36. No SDK API changes.
- Server improvements v0.11.32–v0.11.36 (all transparent to SDK callers):
  - **CE-53 — BM25 session pre-filter**: BM25 full-text candidates constrained to the
    active `session_id` before cross-encoder ranking, closing the symmetry gap with HNSW
    session pre-filter (CE-52). Session-scoped queries no longer bleed cross-session results.
  - **CE-53 — fetch_n 20×→5×**: Cross-encoder candidate workload cut by 4×, eliminating
    408 timeouts on high-memory conversations (1200+ memories). Full 1540Q bench: **82.4%
    overall** (Cat1 80.1%, Cat2 85.7%, Cat3 55.2%, Cat4 85.0%).
  - **CE-52 — Session HNSW pre-filter**: HNSW ANN search pre-filtered by `session_id`
    for multi-session namespaces, eliminating cross-session bleed at scale.
  - **CE-51 — Entity-prioritized PRF term extraction**: Hybrid PRF now prioritises
    entity tokens during pseudo-relevance feedback expansion.
  - **CE-49 — Hybrid PRF honors `iterations`**: `iterations` param now correctly applied
    in Hybrid routing mode (was silently ignored in some PRF paths).
  - **CE-33 — HNSW cache invalidation**: All write endpoints (store, update, delete,
    consolidate, feedback) now invalidate the cached HNSW index, preventing stale search
    results during high-throughput ingestion.
  - **Parallel S3/Minio reads**: `ObjectStorage::get_all()` uses `buffer_unordered(32)` —
    ~32× throughput improvement for bulk reads, fixing recall timeouts at 1000+ memories.

## [0.11.31] - 2026-04-25

### Notes
- Version bump to match server v0.11.31. No SDK API changes.
- Server improvements (all transparent to SDK callers):
  - **CE-48 — BM25 English stemming for new fulltext indices**: All new fulltext indices
    now use Snowball English stemmer at both index and query time. Morphological variants
    (e.g. "running"→"run", "memories"→"memori") are normalized, increasing BM25 term
    overlap. Only affects NEW indices — persisted indices retain their original config.
    Expect +3–5pp on Cat1 (factual) and Cat4 (multi-hop) queries.

## [0.11.30] - 2026-04-25

### Notes
- Version bump to match server v0.11.30. No SDK API changes.
- Server improvements since v0.11.4 (all transparent to SDK callers):
  - **CE-48 — Hybrid PRF for inference queries (Cat3 +24pp)**: Pseudo-relevance
    feedback now applied to `routing="auto"` Hybrid queries classified as temporal/inference.
    Pass-1 Hybrid results seed a BM25 expansion pass; RRF-merged (k=60). Gated behind
    `QueryClassifier::Temporal` to prevent Cat1 regression.
  - **CE-47a — Cross-encoder reranking for BM25 temporal queries**: Cross-encoder reranker
    now fires on temporal BM25 queries (was previously skipped for BM25 paths), correcting
    BM25 rank-order errors caused by date-prefixed memories.
  - **CE-43/39/35 — Temporal PRF hardening**: Auto-PRF (iterations=2) applied server-side
    for all temporal BM25 queries. Pass-1 pool widened to 40 candidates. Date-window
    narrowing (±90 days from anchor date) applied to pass-2 BM25.
  - **CE-34 v2 — Tighter MultiHop classifier**: Structural-context guards on pronoun-after-
    sequential-marker patterns protect Cat2 multi-hop queries from misrouting.
  - **CE-31 — Sentence decomposition at store**: Content ≥80 chars is split into up to 5
    atomic sentences, each embedded and indexed independently as sibling memories. Individual
    facts become independently retrievable without scoring the full parent blob.
  - **SEC-3 hardening (v0.11.30)**: Empty or short encryption passphrases are now rejected
    at the API boundary (NIST 800-63B). Affects callers of `rotateEncryptionKey()` — supply
    a passphrase ≥ 8 chars or a full 64-hex raw key.
  - **Security (v0.11.29)**: Server dep bumps: rustls-webpki 0.103.13 (RUSTSEC-2026-0104),
    rand 0.9.1 (RUSTSEC-2026-0097). No SDK impact.

## [0.11.4] - 2026-04-18

### Added
- **CE-23 — PRF iterative BM25 `iterations` param**: `RecallRequest` now accepts an optional
  `iterations?: number` field (1–3, default: 1). Pass `2` or `3` for multi-hop or temporal
  queries to enable server-side pseudo-relevance feedback (PRF): a second BM25 pass over
  entities extracted from the first pass improves recall on evidence-chain queries. Only
  effective when `routing="bm25"`; omitting the field preserves single-pass behaviour —
  zero breaking changes.
  (server: [#175](https://github.com/Dakera-AI/dakera/pull/175))

## [0.11.3] - 2026-04-18

### Added
- **CE-17 — Explicit `vector_weight` for Hybrid recall**: `RecallRequest` now accepts an
  optional `vector_weight?: number` field (0.0–1.0). When set, overrides the server's adaptive
  vector/BM25 heuristic for `routing="hybrid"` calls, giving callers per-query control over
  retrieval balance. Omitting the field preserves existing adaptive behaviour — zero breaking changes.
  (server: [#173](https://github.com/Dakera-AI/dakera/pull/173))

## [0.11.2] - 2026-04-16

### Changed
- **v0.11.2:** Server default fusion strategy changed from `"rrf"` to `"minmax"`
  (CEO architecture decision, DAK-1948). MinMax +6.3pp overall Recall@10, +13.5pp temporal.
  Callers that omit `fusion` will now use MinMax on the server. Pass `"rrf"` explicitly to
  keep RRF behaviour. Updated JSDoc comments to reflect the new server default.

## [0.11.1] - 2026-04-16

### Fixed
- No code changes in this release. Version bump for parity with `dakera-rs` v0.11.1, which
  fixed a serialization bug where `FusionStrategy::MinMax` was sent as `"min_max"` instead of
  `"minmax"`. TypeScript/JavaScript serialized `"minmax"` correctly in v0.11.0 (string literal
  types have no serialization layer) — no action required if you are using this SDK.

## [0.11.0] - 2026-04-15

### Added
- **CE-14:** `FusionStrategy` type (`'rrf' | 'minmax'`) — controls hybrid score fusion in `RecallRequest`.
- **CE-14:** `fusion?: FusionStrategy` field on `RecallRequest`. `undefined` uses server default (`'rrf'`).
- **v0.11.0:** `neighborhood?: boolean` field on `RecallRequest`. Session-adjacent memory enrichment (±5 min). `undefined` uses server default (`true`). Pass `false` to disable.


## [0.10.2] - 2026-04-13

### Added
- **CE-13:** `rerank?: boolean` option on `recall()` and `searchMemories()`. Enables cross-encoder reranking via `Xenova/bge-reranker-base`. `undefined` uses server default (`true` for recall, `false` for search). Pass `false` to disable on latency-sensitive paths.
- **CE-13:** `EmbeddingModel` union extended with `'bge-large'` (1024 dimensions) — new server-default embedding model.

## [0.10.1] - 2026-04-13

### Fixed
- **`StoreMemoryResponse`:** Corrected interface to match actual server response shape — server returns `{"memory": {...}, "embedding_time_ms": N}` (nested), not flat `{"memory_id": "...", "status": "..."}`. Access via `result.memory.id`.
- **`ConsolidateResponse`:** Corrected field names — `memories_removed` (was `consolidated_count`), `source_memory_ids` (was `new_memories`), `consolidated_memory?: Memory` (was `removed_count: number`).

## [0.10.0] - 2026-04-12

### Added
- **CE-10:** `RoutingMode` union type (`'auto' | 'vector' | 'bm25' | 'hybrid'`) — controls which retrieval index to use for recall and search.
- **CE-10:** `routing?: RoutingMode` option on `recall()` and `searchMemories()`. Defaults to `undefined` (server picks `'auto'`).
- **CE-12:** `compressAgent(agentId)` method — calls `POST /v1/agents/{id}/compress` and returns a `CompressResponse`.
- **CE-12:** `CompressResponse` interface with `agent_id`, `memories_before`, `memories_after`, `removed_count`, `duration_ms?`.
- **CE-10:** `MemoryPolicy.dedup_on_store?: boolean` — enable similarity deduplication at store time.
- **CE-10:** `MemoryPolicy.dedup_threshold?: number` — cosine-similarity threshold for store-time deduplication.
- **CE-10:** `routing?: RoutingMode` added to `RecallRequest` interface.

## [0.9.15] - 2026-04-08

### Notes
- Version bump to match server v0.9.15. No SDK API changes.
- Server changes (transparent to SDK callers):
  - **DAK-1691:** Session-end auto-consolidation — `endSession` now triggers server-side DBSCAN clustering of near-duplicate session memories, soft-expiring them with a 30-day TTL. High-importance memories (>0.8) are protected. No request/response signature change.
  - **DAK-1689:** HNSW post-filter ANN fix — filtered vector queries are now O(N·ANN) instead of O(N·linear). No SDK change.

## [0.9.14] - 2026-04-07

### Added
- **DAK-1690: Agent wake-up context endpoint:**
  - `DakeraClient.getWakeUpContext(agentId, options?)` — `GET /v1/agents/{agentId}/wake-up` — returns a `WakeUpResponse` with top-N memories ranked by importance × recency decay. Sub-millisecond; no embedding inference. Requires Read scope.
  - `WakeUpResponse` and `WakeUpOptions` interfaces exported from `@dakera-ai/dakera`: `agentId`, `memories: Memory[]`, `totalAvailable: number`.

## [0.9.13] - 2026-04-07

### Fixed
- **Session type fix (DAK-1548):** `Session.id` is now correctly mapped (was `session_id`). `startSession()` and `endSession()` now correctly deserialize wrapped server responses (`{"session": {...}}` / `{"session": ..., "memory_count": ...}`). Added `SessionStartResponse` and `SessionEndResponse` types — `endSession()` now returns `SessionEndResponse` exposing `memoryCount`.

## [0.9.12] - 2026-04-06

### Added
- **OBS-2: Product KPI Snapshot endpoint:**
  - `DakeraClient.getKpis()` — `GET /v1/kpis` — returns a `KpiSnapshot` with 8 real-time
    operational metrics. Sub-millisecond; served from in-memory counters. Requires Admin scope.
  - `KpiSnapshot` interface exported from `@dakera-ai/dakera`:
    - `recall_latency_p50_ms` / `recall_latency_p99_ms` — median/p99 recall latency (ms)
    - `store_latency_p50_ms` — median store latency (ms)
    - `api_error_rate_5xx_pct` — 5xx error rate as a percentage of total requests
    - `active_agents_count` — distinct agents active in the last 24 hours
    - `session_count_week` — sessions created in the rolling 7-day window
    - `cross_agent_network_node_count` — nodes in the cross-agent knowledge graph
    - `memory_retention_7d_pct` — percentage of memories from 7 days ago still active

### Server-side only (no SDK changes required)
- **v0.9.12 performance fixes:** session-agent index lookup reduced to O(1); memory counters
  now updated via atomic increments; S3 flushes are async (non-blocking).

## [0.9.11] - 2026-04-01

### Added
- **KG-3: Deep Associative Recall bindings:**
  - `RecalledMemory` interface gains `depth?: number` — the KG hop at which an associated memory was found.
  - `RecallRequest` interface gains `associated_memories_depth?: number` and `associated_memories_min_weight?: number`.
  - `DakeraClient.recall()` options object accepts `associated_memories_depth` (1–3, default `1`) and `associated_memories_min_weight` (default `0.0`).
  - Fully backward-compatible: omitting both new fields retains depth-1 (COG-2) behaviour.
- **COG-3: Proactive Memory Consolidation bindings:**
  - `MemoryPolicy` interface gains four new optional fields:
    - `consolidation_enabled?: boolean` — opt-in background DBSCAN deduplication (server default: `false`).
    - `consolidation_threshold?: number` — cosine-similarity epsilon (server default: `0.92`).
    - `consolidation_interval_hours?: number` — background job interval in hours (server default: `24`).
    - `consolidated_count?: number` — **read-only** lifetime count of merged memories (server-managed).
- **SEC-5: Per-namespace rate limiting bindings:**
  - `MemoryPolicy` interface gains three new optional fields:
    - `rate_limit_enabled?: boolean` — opt-in per-namespace rate limiting (server default: `false`).
    - `rate_limit_stores_per_minute?: number` — max store ops/min; `undefined` = unlimited (server default).
    - `rate_limit_recalls_per_minute?: number` — max recall ops/min; `undefined` = unlimited (server default).
  - When a limit is exceeded the server returns HTTP 429; the existing `RateLimitError` is thrown with `retryAfter: 60`.

## [0.9.9] - 2026-03-31

### Added
- **CE-7: Time-Window Recall bindings:**
  - `recall()` options now accept `since?: string` and `until?: string`
    ISO-8601 timestamp parameters.
  - `RecallRequest` interface gains `since?` and `until?` fields.
  - Filters are applied server-side before semantic ranking — only memories
    created within the specified window are considered.
  - Invalid ISO-8601 values produce a `400` error from the server.

## [0.9.8] - 2026-03-31

### Added
- **COG-2: Associative Recall bindings:**
  - `recall()` options now accept `include_associated?: boolean` and
    `associated_memories_cap?: number`.
  - When `include_associated: true`, the server performs a KG depth-1
    traversal and returns linked memories in `associated_memories`.
  - Return type changed from `Promise<RecalledMemory[]>` to
    `Promise<RecallResponse>` — `{ memories: RecalledMemory[],
    associated_memories?: RecalledMemory[] }`.
  - New export: `RecallResponse`.
- **COG-1: Cognitive Memory Lifecycle bindings:**
  - `getMemoryPolicy(namespace)` — retrieve the memory lifecycle policy
    (`GET /v1/namespaces/{namespace}/memory_policy`). Returns `MemoryPolicy`.
  - `setMemoryPolicy(namespace, policy)` — set the lifecycle policy
    (`PUT /v1/namespaces/{namespace}/memory_policy`).
  - New types: `MemoryPolicy`, `DecayStrategyName` (extends existing
    `"exponential" | "linear" | "step"` with `"power_law"`, `"logarithmic"`,
    `"flat"` — the three new COG-1 per-type decay strategies).

## [0.9.7] - 2026-03-31

### Added
- **KG-2: Graph Query & Export bindings:**
  - `knowledgeQuery(agentId, options?)` — filter-based DSL query over the memory
    knowledge graph (`GET /v1/knowledge/query`). Options: `rootId`, `edgeType`,
    `minWeight`, `maxDepth`, `limit`. Returns `Promise<KgQueryResponse>`.
  - `knowledgePath(agentId, fromId, toId)` — BFS shortest path between two memory
    IDs (`GET /v1/knowledge/path`). Returns `Promise<KgPathResponse>`.
  - `knowledgeExport(agentId, format?)` — export the full graph as JSON or GraphML
    (`GET /v1/knowledge/export`). Returns `Promise<KgExportResponse>` for
    `format="json"` (default).
  - New types: `KgQueryResponse`, `KgPathResponse`, `KgExportResponse`.

## [0.9.6] - 2026-03-30

### Added
- **GLiNER Entity Extraction via ODE sidecar (ODE-2):**
  - `odeExtractEntities(content, agentId, memoryId?, entityTypes?)` — extract
    named entities from text using the dakera-ode GLiNER sidecar
    (`POST /ode/extract`). Returns `Promise<ExtractEntitiesResponse>` with
    per-entity character offsets, confidence scores, model variant, and
    processing time in ms.
  - New `odeUrl` option in `ClientOptions`.
  - New types: `OdeEntity`, `ExtractEntitiesRequest`, `ExtractEntitiesResponse`.

## [0.9.5] - 2026-03-30

### Added
- **AES-256-GCM Encryption Key Rotation (SEC-3):**
  - `rotateEncryptionKey(newKey, namespace?)` — re-encrypt all memory content
    blobs with a new AES-256-GCM key (`POST /v1/admin/encryption/rotate-key`).
    Pass `namespace` as `undefined` to rotate all namespaces. Returns
    `Promise<RotateEncryptionKeyResponse>`. Requires Admin scope.
  - New types: `RotateEncryptionKeyRequest`, `RotateEncryptionKeyResponse`
    (fields: `rotated`, `skipped`, `namespaces`).

## [0.9.4] - 2026-03-30

### Added
- **Memory Import/Export (DX-1):**
  - `importMemories(data, format?, agentId?, namespace?)` — import memories from
    Mem0, Zep, JSONL, or CSV format (`POST /v1/import`). Returns
    `MemoryImportResponse` with counts and errors.
  - `exportMemories(format?, agentId?, namespace?, limit?)` — export memories to
    a portable format (`GET /v1/export`). Returns `MemoryExportResponse`.
  - New types: `MemoryImportResponse`, `MemoryExportResponse`.
- **Business-Event Audit Log (OBS-1):**
  - `listAuditEvents(opts?)` — paginated audit log query (`GET /v1/audit`).
    Returns `AuditListResponse`.
  - `streamAuditEvents(opts?)` — live SSE stream of audit events
    (`GET /v1/audit/stream`). Yields `DakeraEvent` objects.
  - `exportAudit(opts?)` — bulk export audit entries (`POST /v1/audit/export`).
    Returns `AuditExportResponse`.
  - New types: `AuditEvent`, `AuditListResponse`, `AuditExportResponse`.
- **DBSCAN Adaptive Consolidation (CE-6):** `ConsolidateRequest` now accepts
  optional `config: ConsolidationConfig` (algorithm, min_samples, eps).
  `ConsolidateResponse` may include a `log: ConsolidationLogEntry[]` field.
  New types: `ConsolidationConfig`, `ConsolidationLogEntry`.
- **External Extraction Providers (EXT-1):**
  - `extractText(text, namespace?, provider?, model?)` — extract entities via
    a pluggable provider (`POST /v1/extract`). Providers: `gliner` (bundled
    zero-config), `openai`, `anthropic`, `openrouter`, `ollama`. Returns
    `ExtractionResult`.
  - `listExtractProviders()` — list available providers and models
    (`GET /v1/extract/providers`). Returns `ExtractionProviderInfo[]`.
  - `configureNamespaceExtractor(namespace, provider, model?)` — set namespace
    default extractor (`PATCH /v1/namespaces/{ns}/extractor`).
  - New types: `ExtractionResult`, `ExtractionProviderInfo`.
- **Redis Health (OPS-3):** `clusterStatus()` response includes `redis_healthy`
  boolean field.
- **Cluster Env Aliases (DIST-1):** Documented `DAKERA_CLUSTER_NODE_ID`,
  `SEED_NODES`, `BIND_ADDR` server environment variables.
- **Memory Encryption (SEC-3):** Server supports AES-256-GCM at-rest encryption
  via `DAKERA_ENCRYPTION_KEY` — transparent to SDK clients.

## [0.9.3] - 2026-03-29

### Added
- **Prometheus Metrics (INFRA-3):** `opsMetrics()` — returns the raw Prometheus
  text exposition format string from `GET /v1/ops/metrics` (Admin scope).

## [0.9.2] - 2026-03-27

### Added
- **Namespace-scoped API Keys (SEC-1):**
  - `createNamespaceKey(namespace, name, expiresInDays?)` — create a scoped API
    key for a namespace (`POST /v1/namespaces/{ns}/keys`). Returns
    `CreateNamespaceKeyResponse`. The raw key is shown **only once**.
  - `listNamespaceKeys(namespace)` — list all API keys for a namespace
    (`GET /v1/namespaces/{ns}/keys`). Returns `ListNamespaceKeysResponse`.
  - `deleteNamespaceKey(namespace, keyId)` — revoke a namespace API key
    (`DELETE /v1/namespaces/{ns}/keys/{keyId}`). Returns
    `{ success: boolean; message: string }`.
  - `getNamespaceKeyUsage(namespace, keyId)` — retrieve usage stats for a key
    (`GET /v1/namespaces/{ns}/keys/{keyId}/usage`). Returns
    `NamespaceKeyUsageResponse`.
  - New types exported from `@dakera-ai/dakera`: `NamespaceKeyInfo`,
    `CreateNamespaceKeyResponse`, `ListNamespaceKeysResponse`,
    `NamespaceKeyUsageResponse`.

## [0.9.1] - 2026-03-26

### Added
- **Memory Feedback Loop (INT-1):**
  - `client.feedbackMemory(memoryId, agentId, signal, note?)` — submit feedback
    (upvote/downvote/flag) for a memory (`POST /v1/memories/{id}/feedback`). Returns
    `FeedbackResponse`.
  - `client.patchMemoryImportance(memoryId, agentId, importance)` — directly set a memory's
    importance score (`PATCH /v1/memories/{id}/importance`). Returns `FeedbackResponse`.
  - `client.getMemoryFeedbackHistory(memoryId)` — retrieve all feedback events for a memory
    (`GET /v1/memories/{id}/feedback/history`). Returns `FeedbackHistoryResponse`.
  - `client.getAgentFeedbackSummary(agentId)` — aggregate feedback counts and health score for
    an agent (`GET /v1/agents/{id}/feedback/summary`). Returns `AgentFeedbackSummary`.
  - `client.getFeedbackHealth(agentId)` — health score (mean importance of non-expired
    memories) for an agent (`GET /v1/feedback/health`). Returns `FeedbackHealthResponse`.
  - New types: `FeedbackSignal` (enum: `upvote` / `downvote` / `flag`), `FeedbackResponse`,
    `FeedbackHistoryEntry`, `FeedbackHistoryResponse`, `MemoryFeedbackBody`,
    `MemoryImportancePatch`, `AgentFeedbackSummary`, `FeedbackHealthResponse` — all exported
    from the package root.

## [0.9.0] - 2026-03-26

### Added
- **Memory Knowledge Graph API (SDK-9 / CE-5 pre-impl):**
  - `client.memoryGraph(memoryId, depth?, types?)` — returns the graph of memories connected to
    `memoryId` (`GET /v1/memories/{id}/graph`). Depth and edge-type filters are optional.
  - `client.memoryPath(sourceId, targetId)` — shortest path between two memory nodes
    (`GET /v1/memories/{id}/path`).
  - `client.memoryLink(sourceId, targetId, edgeType)` — create a directed edge between two
    memories (`POST /v1/memories/{id}/links`).
  - `client.agentGraphExport(agentId, format?)` — export the full memory graph for an agent
    as JSON or CSV (`GET /v1/agents/{id}/graph/export`).
  - New types: `EdgeType`, `GraphEdge`, `GraphNode`, `MemoryGraph`, `GraphPath`,
    `GraphLinkResponse`, `GraphExport` — all exported from the package root.
  - **Note:** requires server CE-5 for end-to-end functionality; unit tests use mocked
    responses and pass fully against the current server (server CE-5 / DAK-1002).
- **Real-time memory event streaming (SDK-10):**
  - `client.subscribeAgentMemories(agentId, tagFilter?, reconnect?)` — async generator
    yielding `MemoryEvent` objects from `GET /v1/events/stream`. Supports tag-based filtering
    and optional auto-reconnect. Skips the `connected` handshake event automatically.
- **Security:** bumped `picomatch` to `>=4.0.4` (HIGH ReDoS + MEDIUM method injection).

## [0.8.6] - 2026-03-25

### Changed
- `OpsStats` interface — added `state: string` field (`"healthy"` | `"degraded"`) reflecting
  storage health. Syncs with core DAK-918 (`/v1/ops/stats` fix).

## [0.8.5] - 2026-03-25

### Added
- `client.opsStats()` — new Read-scoped endpoint `GET /v1/ops/stats` returning `OpsStats`
  (`version`, `total_vectors`, `namespace_count`, `uptime_seconds`, `timestamp`). Works with
  read-only API keys; use instead of `clusterStatus()` when Admin scope is unavailable
  (core DAK-852).
- `OpsStats` type exported from the package root.

> **Note:** v0.8.4 was a Python-only security patch (urllib3 CVE) and was not released for
> this SDK. This release jumps from v0.8.3 to v0.8.5 to realign all SDKs at the same version.

## [0.8.2] - 2026-03-23

### Added
- `MemoryEvent`: SSE `connected` handshake event is now surfaced. When the server emits
  `event: connected` on stream subscription, callers receive a `MemoryEvent` with
  `event_type: "connected"` and `agent_id: ""` (core DAK-720).
- `StoreMemoryRequest.expires_at` — optional explicit expiry Unix timestamp (seconds).
  Takes precedence over `ttl_seconds` when both are set (core DECAY-3 / DAK-740).

### Changed
- `MemoryEvent.agent_id` — documented as empty string for `connected` handshake events.

## [0.8.1] - 2026-03-23

### Fixed
- `DakeraClient.hybridSearch()` — corrected endpoint URL from
  `/v1/namespaces/${ns}/fulltext/hybrid` to `/v1/namespaces/${ns}/hybrid` (DAK-679).
  Hybrid search was returning HTTP 404 in production since v0.8.0.

## [0.8.0] - 2026-03-23

### Changed
- `DakeraClient.hybridSearch()` — signature changed: `vector` moves from the second positional
  argument into `options.vector` (optional). When omitted the server performs BM25-only
  full-text search. Existing callers using `{ vector: [...] }` in options continue to work.
  (core v0.8.0 / dakera-mcp PR#20)

## [0.7.3] - 2026-03-23

### Added
- `StoreMemoryRequest.expires_at` — optional Unix timestamp (seconds); takes precedence over
  `ttl_seconds` when both are set; memory is hard-deleted by the decay engine on expiry (DECAY-3)
- `DecayConfigResponse`, `DecayConfigUpdateRequest`, `DecayConfigUpdateResponse` types
- `LastDecayCycleStats`, `DecayStatsResponse` types
- `DakeraClient.decayConfig()` — `GET /v1/admin/decay/config` — current strategy, half-life,
  and min-importance threshold (DECAY-1). Requires Admin scope.
- `DakeraClient.decayUpdateConfig()` — `PUT /v1/admin/decay/config` — live config update with
  no restart required (DECAY-1). All fields optional.
- `DakeraClient.decayStats()` — `GET /v1/admin/decay/stats` — cumulative counters and
  last-cycle snapshot (DECAY-2). Requires Admin scope.

## [0.7.2] - 2026-03-23

### Added
- `AutoPilotConfig`, `AutoPilotStatusResponse`, `DedupResultSnapshot`, `ConsolidationResultSnapshot`
  interface types
- `AutoPilotConfigRequest`, `AutoPilotConfigResponse` types for runtime configuration updates
- `AutoPilotTriggerAction` type union, `AutoPilotDedupResult`, `AutoPilotConsolidationResult`,
  `AutoPilotTriggerResponse` types
- `DakeraClient.autopilotStatus()` — `GET /v1/admin/autopilot/status` (PILOT-1)
- `DakeraClient.autopilotUpdateConfig()` — `PUT /v1/admin/autopilot/config` (PILOT-2)
- `DakeraClient.autopilotTrigger()` — `POST /v1/admin/autopilot/trigger` (PILOT-3)

## [0.7.1] - 2026-03-22

### Added
- `BatchMemoryFilter` / `BatchRecallRequest` / `BatchRecallResponse` / `BatchForgetRequest` /
  `BatchForgetResponse` — typed models for batch memory operations
- `DakeraClient.batchRecall()` — `POST /v1/memories/recall/batch` — recall memories for
  multiple agents in a single request
- `DakeraClient.batchForget()` — `DELETE /v1/memories/forget/batch` — forget memories for
  multiple agents in a single request
- `RateLimitHeaders` type + `lastRateLimitHeaders` property — exposes
  `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` from the last response

## [0.7.0] - 2026-03-22

### Added
- `RetryConfig` class with `maxRetries`, `baseDelay`, `maxDelay`, and `jitter` fields for
  fine-grained exponential-backoff control
- `DakeraClientOptions.retryBackoff` (`RetryConfig`) — overrides `maxRetries` when set
- `DakeraClientOptions.connectTimeout` — sets TCP connection timeout independently of the
  overall request timeout
- HTTP 429 responses respect the `Retry-After` header; falls back to exponential backoff
- 5xx responses retried up to `maxRetries` times; 4xx (except 429) never retried

## [0.6.2] - 2026-03-21

### Added
- `CrossAgentNetworkResponse.node_count` field — reflects the `node_count` field added in
  dakera server v0.6.2 (PR #26). Previously the field was silently ignored.
- `DakeraClient.sseUrl(path)` helper — returns a fully-qualified SSE URL with `?api_key=`
  appended. Use this to construct URLs for browser-native `EventSource`, which cannot send
  custom request headers.
- `_streamSse` and `_streamSseMemory` now authenticate via `?api_key=` query parameter
  instead of the `Authorization` header, making internally streamed URLs compatible with
  native `EventSource` clients.

## [0.2.0] - 2026-03-19

### Security
- Bump `flatted` 3.3.3 → 3.4.2 (CVE-2026-32141: DoS via unbounded recursion in parse())
- Add explicit `GITHUB_TOKEN` permissions (`contents: read`) to CI workflow

### Changed
- Drop Node 18 from CI test matrix (EOL 2025-04-30; new deps require Node ≥20)
- Bump `engines.node` from `>=18.0.0` to `>=20.12.0`
- Bump `esbuild` and `vitest` (required Node 20+ for rolldown/styleText)
- Bump `rollup` 4.56.0 → 4.59.0
- Bump `ajv` 6.12.6 → 6.14.0
- Bump `minimatch` 3.1.2 → 3.1.5

## [0.1.0] - 2025-03-15

### Added
- Initial release of Dakera TypeScript SDK
- Full TypeScript type definitions
- Vector operations: upsert, query, fetch, delete
- Namespace management
- Full-text search support
- Agent memory operations
- Session management
- Knowledge graph operations
- Inference (auto-embedding) support
- Error handling with typed exceptions
- Comprehensive test suite
