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
  <a href="https://playground.dakera.ai"><img alt="Playground" src="https://img.shields.io/badge/playground-try_it-ff6b35?style=flat-square" /></a>
</p>

---

## Why Dakera?

| | Dakera | Others |
|---|---|---|
| **LoCoMo accuracy** | **88.2%** (1,540 Q standard eval) | 60–92% |
| **Deployment** | Single binary, Docker one-liner | External vector DB + embedding service required |
| **Embeddings** | Built-in — no OpenAI key needed | Requires external embedding API |
| **Search modes** | Vector · BM25 · Hybrid · Knowledge Graph | Usually one or two |
| **Bundle** | ESM + CJS, browser-compatible | Often Node-only |

→ [Try the playground](https://playground.dakera.ai) · [Full benchmark results](https://dakera.ai/benchmark) · [dakera.ai](https://dakera.ai)

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
curl -sSfL https://raw.githubusercontent.com/Dakera-AI/dakera-deploy/main/docker-compose.yml \
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
| [TypeScript SDK docs](https://dakera.ai/docs/sdk/typescript) | TypeScript-specific reference |
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
