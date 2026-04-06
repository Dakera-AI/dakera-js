# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
