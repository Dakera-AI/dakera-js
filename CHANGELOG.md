# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
