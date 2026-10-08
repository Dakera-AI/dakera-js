<p align="center">
  <img src="https://github.com/dakera-ai.png" alt="Dakera AI" width="80" />
</p>

<h1 align="center">dakera-js</h1>

<p align="center">
  TypeScript/JavaScript SDK for <a href="https://dakera.ai">Dakera AI</a> — the memory engine for AI agents
</p>

<p align="center">
  <a href="https://github.com/Dakera-AI/dakera-js/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Dakera-AI/dakera-js/actions/workflows/ci.yml/badge.svg" /></a>
  <a href="https://www.npmjs.com/package/@dakera-ai/dakera"><img alt="npm" src="https://img.shields.io/npm/v/%40dakera-ai%2Fdakera?logo=npm" /></a>
  <a href="https://www.npmjs.com/package/@dakera-ai/dakera"><img alt="Downloads" src="https://img.shields.io/npm/dm/%40dakera-ai%2Fdakera" /></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/github/license/Dakera-AI/dakera-js" /></a>
  <a href="https://dakera.ai/docs"><img alt="Docs" src="https://img.shields.io/badge/docs-dakera.ai%2Fdocs-3b82f6?style=flat-square" /></a>
  <a href="https://dakera.ai/benchmark"><img alt="LoCoMo 88.2%" src="https://img.shields.io/badge/LoCoMo-88.2%25-22c55e?style=flat-square" /></a>
  <a href="https://dakera.ai/playground"><img alt="Playground" src="https://img.shields.io/badge/playground-try_it-ff6b35?style=flat-square" /></a>
</p>

---

## Why Dakera?

| | Dakera | Others |
|---|---|---|
| **LoCoMo Recall@20** | **88.2%** (1,536 Q, LLM-judged retrieval recall) | not directly comparable |
| **Deployment** | Single binary, Docker one-liner | External vector DB + embedding service required |
| **Embeddings** | Built-in — no OpenAI key needed | Requires external embedding API |
| **Search modes** | Vector · BM25 · Hybrid · Knowledge Graph | Usually one or two |
| **Bundle** | ESM + CJS, browser-compatible | Often Node-only |

→ [Try the playground](https://dakera.ai/playground) · [Full benchmark results](https://dakera.ai/benchmark) · [dakera.ai](https://dakera.ai)

---

## Run Dakera

```bash
docker run -d \
  --name dakera \
  -p 3000:3000 \
  -e DAKERA_ROOT_API_KEY=dk-mykey \
  ghcr.io/dakera-ai/dakera:latest

curl http://localhost:3000/health  # → {"status":"ok"}
```

For persistent storage with Docker Compose:

```bash
curl -sSfL https://raw.githubusercontent.com/Dakera-AI/dakera-deploy/main/docker/docker-compose.yml \
  -o docker-compose.yml
DAKERA_API_KEY=dk-mykey docker compose up -d
```

Full deployment guide (Docker Compose, Kubernetes, Helm): [dakera-deploy](https://github.com/Dakera-AI/dakera-deploy)

---

## Install

```bash
npm install @dakera-ai/dakera
```

Works with **Node.js** (20+), **Deno**, **Bun**, **Cloudflare Workers**, and modern browsers. Ships ESM + CJS with full TypeScript declarations.

---

## Quick Start

```typescript
import { DakeraClient } from '@dakera-ai/dakera';
const client = new DakeraClient({ baseUrl: 'http://localhost:3000', apiKey: 'dk-mykey' });
await client.storeMemory('my-agent', { content: 'User prefers brevity', importance: 0.9 });
```

Full example — store, recall, upsert, and hybrid search:

```typescript
import { DakeraClient } from '@dakera-ai/dakera';

const client = new DakeraClient({
  baseUrl: 'http://localhost:3000',
  apiKey: 'dk-mykey',
});

// Store an agent memory
await client.storeMemory('my-agent', {
  content: 'User prefers concise responses with code examples',
  importance: 0.9,
  memory_type: 'semantic',
});

// Recall memories (semantic search)
const response = await client.recall('my-agent', 'what does the user prefer?', {
  top_k: 5,
});
for (const m of response.memories) {
  console.log(`[${m.score?.toFixed(2)}] ${m.content}`);
}

// Upsert vectors
await client.upsert('my-namespace', [
  { id: 'vec1', values: [0.1, 0.2, 0.3], metadata: { category: 'docs' } },
]);

// Hybrid search (vector + BM25)
const results = await client.hybridSearch('my-namespace', 'completed task', { topK: 5, vectorWeight: 0.7 });
for (const r of results) {
  console.log(r.id, r.score);
}
```

### SSE Streaming

```typescript
// Subscribe to real-time memory events
const stream = client.subscribeMemoryEvents('my-agent');
for await (const event of stream) {
  console.log(event.type, event.memory_id);
}
```

---

## What's new for Dakera server v0.12.2

This SDK release (0.12.2) targets Dakera server **v0.12.2** and stays **compatible with v0.12.0 and
v0.12.1 servers**: every new request field is optional and left out when unset, every new response field
is optional, and the new routes answer 404/405 on an older server. Operator upgrade path: "Upgrading from
v0.12.1 to v0.12.2" in the server's `docs/v0.12/UPGRADE.md`.

- **Agents** — `createAgent(agentId)` (`POST /v1/agents`) creates an agent's memory namespace before its
  first memory; idempotent (`created: false` for an existing agent).
- **Keys** — `updateKey()` / `updateNamespaceKey()` (`PATCH`) rename a key or replace its grants
  (`namespaces: null` = every namespace); `rotateKey(id, { grace_secs })` keeps the old key working for up
  to 7 days (`old_key_id`, `old_key_expires_at`); `whoami()` (`GET /v1/auth/whoami`). Key grants may hold
  prefix patterns (`team-*`); `KeyInfo` carries `grants_version` and `inert_namespaces`.
- **Sessions** — `startSession(agentId, metadata, { idle_timeout_secs })`, `touchSession(id)`, and
  `last_activity_at` / `ended_reason` / `idle_since` / `idle_timeout_secs` on sessions. Store answers say
  `session_state`, batch stores list `ended_sessions`. `getConfig()` / `updateConfig()` carry
  `session_idle_timeout_secs`.
- **Listings** — `include_derived` on `agentMemories()` / `getWakeUpContext()`; `content_preview_chars`
  (with `content_len` / `content_truncated` on each item) on `agentMemories()`, `sessionMemories()`,
  `fullKnowledgeGraph()` and `crossAgentNetwork()`.
- **Admin** — `adminDerivationStatus()` / `adminDrainDerivations()`; `unavailable` on node-wide answers;
  `duplicates_skipped_changed` on `deduplicate()`, `summaries_skipped` on `compressAgent()`; namespace
  `kind`; `capabilities()` v2 `auth`, `naming` and `sessions` blocks.

### Behaviour changes you may hit with a v0.12.2 server

- **Sessions are authorized by their agent.** A key needs access to `_dakera_agent_<agent_id>` (Write to
  start, end and touch; Read to read and list) and no longer a `_dakera_sessions` grant, which is now inert.
  A key without grants lists no sessions. `endSession()` with a Read key is a 403 for any id; ending a
  session of an agent the key cannot reach returns the same empty 200 as an unknown session.
- **Sessions end after 4 hours idle by default** (`ended_reason: "idle"`). Activity is a memory stored or
  updated with the session, a session-scoped recall or search, or `touchSession()`. Keep a long-lived idle
  session open with `touchSession()`, or start it with `idle_timeout_secs: 0`. Storing into an ended
  session still succeeds; check `session_state` / `ended_sessions`.
- **Stricter validation (400, the message names the field).** Key `namespaces` entries are checked
  (junk entries, internal namespaces, mixed `"*"`); agent ids are at most 241 bytes; the `dakera-curated`
  tag, `_dakera_*` metadata keys (except `_dakera_content_date` / `_dakera_lang`), ids shaped
  `mem_s` + 24 hex and TTLs over 100 years are refused; `_dakera_embedding_models` is reserved.
- **The memory content limit is in bytes** (UTF-8, `DAKERA_MAX_MEMORY_CONTENT_BYTES`, default 100000), now
  also on `updateMemory()` and on the `endSession()` summary.
- **Listings exclude derived records** (sentence sub-memories) unless `include_derived: true`
  (`agentMemories()`, `getWakeUpContext()`; wake-up `total_available` counts memories only).
- Keys created before v0.12.2 keep reading `foo*` entries as literal names (`grants_version: 0`, listed in
  `inert_namespaces`) until their `namespaces` are saved with `updateKey()`.

```ts
const agent = await client.createAgent('mlx-dev');                    // 201 created / 200 existing
const session = await client.startSession('mlx-dev', undefined, { idle_timeout_secs: 3600 });
const { session_state } = await client.touchSession(session.id);     // 'active' | 'ended'
const page = await client.agentMemories('mlx-dev', { content_preview_chars: 200 });
const full = page[0]?.content_truncated ? await client.getMemory('mlx-dev', page[0].id) : page[0];
```

---

## What's new for Dakera server v0.12.0

This SDK release (0.12.0) targets Dakera server **v0.12.0** and is **compatible with both v0.11.108
and v0.12.0 servers**: every addition is opt-in or additive, requests that do not use them are
byte-identical to before, and the v0.12-only routes simply answer 404/501 on an older server.
Upgrade guide for operators: `docs/v0.12/UPGRADE.md` in the server release (the server repository is private;
see the public [Dakera changelog](https://dakera.ai/docs/changelog) for release notes).

- **Capabilities** — `client.capabilities()` (`GET /v1/capabilities`): models (`bge-m3`, `colbert-small`),
  index kinds (`ivfpq`), search modes (`rabitq`), record kinds/dtypes, query languages, and the
  attachment / transcription / vision / scoring sections. Unknown values from a newer server never throw.
- **Health** — `healthReady()` / `healthLive()` / `waitUntilReady()`. A starting v0.12 server answers
  `/health/ready` with `503` + `Retry-After`: that means *not ready*, never healthy.
- **Errors** — every v0.12 error is JSON and every `503` carries `Retry-After`; the retry loop now waits
  that long. New typed errors: `PayloadTooLargeError` (413: `isQuota` for a full namespace, otherwise an
  oversize request), `NotImplementedError` (501: `isFeatureDisabled`, `details` names the env var),
  `ConflictError` (409); `err.details`, `err.resource` (404) and `err.retryAfterSeconds`.
- **Attachments** (server `DAKERA_ATTACHMENTS=1`) — `uploadAttachment`, `listAttachments`,
  `downloadAttachment`, `deleteAttachment`, `transcribeAttachment` (WAV), `indexImageAttachment` (PNG, needs
  `DAKERA_VISION=1`), job polling with `waitForAttachmentJob`, and `attachment_ref` on `storeMemory`.
- **Records** (server `DAKERA_RECORDS=1`) — `upsertRecords` / `getRecord`: one primary vector plus named
  representations (`dense`, `token_multivector`, `patch_multivector`; stored as `f32`, `f16`, `i8`).
- **Per-request `lang`** on `storeMemory`, `storeMemoriesBatch`, `updateMemory`, `recall`, `searchMemories`
  and `extractEntities` (see `capabilities().query_languages`).
- **Namespace entity config** — `replaceNamespaceEntityConfig()` is `PUT /v1/namespaces/{ns}/config`
  (full replacement; clears `entity_types`). `configureNamespaceNer()` stays a merging `PATCH`.

```ts
await client.waitUntilReady();                       // never treats a starting server as healthy
const up = await client.uploadAttachment('uploads', wavBytes, 'audio/wav');
const job = await client.transcribeAttachment('uploads', up.attachment_ref, { agent_id: 'my-agent' });
await client.waitForAttachmentJob(job);              // the transcript is now a memory
await client.recall('my-agent', 'was ist gesagt worden?', { lang: 'de' });
```

---

## Features

- **Agent Memory** — store, recall, search, and forget memories with importance scoring
- **Sessions** — group memories by conversation with auto-consolidation on session end
- **Knowledge Graph** — traverse memory relationships, find paths, export graphs
- **Vector Search** — ANN queries with metadata filters and batch operations
- **Full-Text Search** — BM25 ranking with stemming and stop-word filtering
- **Hybrid Search** — combine vector similarity with keyword matching
- **Text Auto-Embedding** — server-side embedding generation (no local model needed)
- **Namespaces** — isolated vector stores per project, tenant, or use case
- **Feedback Loop** — upvote/downvote/flag memories to improve recall quality
- **T-I-F Reliability** — `TifScore` type and `evaluateTif()` for Truth-Indeterminacy-Falsity scoring of memory reliability
- **Entity Extraction** — GLiNER NER for automatic entity detection
- **Attachments & Records** — audio transcription, image indexing, multi-representation records (server v0.12)
- **SSE Streaming** — async generator event subscriptions, browser-compatible
- **Branded Types** — `VectorId`, `AgentId`, `MemoryId`, `SessionId` for compile-time safety
- **ESM + CJS** — dual bundle output, works in Node.js and browsers
- **Retry & Rate Limiting** — built-in exponential backoff and rate-limit header tracking
- **Zero Runtime Deps** — uses native `fetch`, no external HTTP libraries

---

## Connect to Dakera

```typescript
import { DakeraClient } from '@dakera-ai/dakera';

// Self-hosted
const client = new DakeraClient({
  baseUrl: 'http://your-server:3000',
  apiKey: 'your-key',
});

// Cloud (early access)
const client = new DakeraClient({
  baseUrl: 'http://<your-server-ip>:3000',
  apiKey: 'your-key',
});

// With custom retry config
const client = new DakeraClient({
  baseUrl: 'http://localhost:3000',
  apiKey: 'your-key',
  retryBackoff: { maxRetries: 5, baseDelayMs: 200, maxDelayMs: 10000 },
});
```

---

## Examples

See the [`examples/`](examples/) directory:

- [`basic.ts`](examples/basic.ts) — vectors, namespaces, queries, filters, batch operations
- [`memory.ts`](examples/memory.ts) — store/recall memories, sessions, agent stats
- [`advanced.ts`](examples/advanced.ts) — text embedding, full-text, hybrid search, knowledge graph, feedback

Run examples with:

```bash
npx tsx examples/basic.ts
```

---

## Resources

| | |
|---|---|
| [Documentation](https://dakera.ai/docs) | Full API reference and guides |
| [TypeScript SDK docs](https://dakera.ai/docs/typescript-sdk) | TypeScript-specific reference |
| [Benchmark](https://dakera.ai/benchmark) | LoCoMo evaluation results |
| [dakera.ai](https://dakera.ai) | Website and early access |
| [GitHub Org](https://github.com/dakera-ai) | All public repos |
| [dakera-deploy](https://github.com/Dakera-AI/dakera-deploy) | Self-hosting guide |

### Other SDKs

| SDK | Package |
|---|---|
| [dakera-py](https://github.com/dakera-ai/dakera-py) | `dakera` (PyPI) |
| [dakera-rs](https://github.com/dakera-ai/dakera-rs) | `dakera-client` (crates.io) |
| [dakera-go](https://github.com/dakera-ai/dakera-go) | `github.com/dakera-ai/dakera-go` |
| [dakera-cli](https://github.com/dakera-ai/dakera-cli) | CLI tool |
| [dakera-mcp](https://github.com/dakera-ai/dakera-mcp) | MCP server for Claude/Cursor |

---

<p align="center">
  <a href="https://dakera.ai">dakera.ai</a> ·
  <a href="https://dakera.ai/docs">Docs</a> ·
  <a href="https://dakera.ai/benchmark">Benchmark</a> ·
  <a href="https://dakera.ai#cta">Request Early Access</a>
</p>

<p align="center"><sub>Built with Rust. Single binary. Zero external dependencies.</sub></p>
