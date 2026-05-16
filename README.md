[![Docs](https://img.shields.io/badge/docs-dakera.ai-D4A843)](https://dakera.ai/docs)
# dakera-js



[![CI](https://github.com/Dakera-AI/dakera-js/actions/workflows/ci.yml/badge.svg)](https://github.com/Dakera-AI/dakera-js/actions/workflows/ci.yml) [![npm](https://img.shields.io/npm/v/dakera?logo=npm)](https://www.npmjs.com/package/dakera) [![Downloads](https://img.shields.io/npm/dm/dakera)](https://www.npmjs.com/package/dakera) [![License: MIT](https://img.shields.io/github/license/Dakera-AI/dakera-js)](LICENSE)
[![dakera.ai](https://img.shields.io/badge/dakera.ai-website-22c55e?style=flat-square)](https://dakera.ai) [![Docs](https://img.shields.io/badge/docs-dakera.ai%2Fdocs-3b82f6?style=flat-square)](https://dakera.ai/docs)
[![Docs](https://img.shields.io/badge/docs-dakera.ai-D4A843)](https://dakera.ai/docs)

TypeScript/JavaScript SDK for Dakera AI — store, recall, and search agent memories against a Dakera instance.

Part of [Dakera AI](https://dakera.ai) — the memory engine for AI agents.

> The Dakera memory engine scores **87.6% on LoCoMo** (1,540 questions, standard eval) — [benchmark details](https://dakera.ai/benchmark)

---

## Run Dakera

You need a running Dakera server before using this SDK. The fastest way:

```bash
docker run -d \
  --name dakera \
  -p 3300:3300 \
  -e DAKERA_ROOT_API_KEY=dk-mykey \
  ghcr.io/dakera-ai/dakera:latest
```

For persistent storage (recommended for anything beyond a quick test):

```bash
curl -sSfL https://raw.githubusercontent.com/Dakera-AI/dakera-deploy/main/docker-compose.yml \
  -o docker-compose.yml
DAKERA_API_KEY=dk-mykey docker compose up -d

curl http://localhost:3300/health  # -> {"status":"ok"}
```

Full deployment guide (Docker Compose, Kubernetes, Helm): [dakera-deploy](https://github.com/Dakera-AI/dakera-deploy)

---

## Install

```bash
npm install @dakera-ai/dakera
```

## Quick Start

```typescript
import { DakeraClient } from '@dakera-ai/dakera';

const client = new DakeraClient({
  baseUrl: 'http://localhost:3300',
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

// Full-text search
const results = await client.fulltextSearch('my-namespace', 'completed task', { topK: 5 });
for (const r of results) {
  console.log(r.id, r.score);
}
```

## Features

- **Agent Memory** — store, recall, search, and forget memories with importance scoring
- **Sessions** — group memories by conversation with auto-consolidation on session end
- **Knowledge Graph** — traverse memory relationships, find paths, export graphs
- **Vector Search** — ANN queries with metadata filters and batch operations
- **Full-Text Search** — BM25 ranking with stemming and stop-word filtering
- **Hybrid Search** — combine vector similarity with keyword matching
- **Text Auto-Embedding** — server-side embedding generation (no local model needed)
- **Feedback Loop** — upvote/downvote/flag memories to improve recall quality
- **Entity Extraction** — GLiNER NER for automatic entity detection
- **Streaming** — SSE event subscriptions via async generators
- **Branded Types** — `VectorId`, `AgentId`, `MemoryId`, `SessionId` for compile-time safety
- **CJS + ESM** — dual bundle output, works in Node.js and browsers
- **Retry & Rate Limiting** — built-in exponential backoff and rate-limit header tracking
- **Zero Runtime Deps** — uses native `fetch`, no external HTTP libraries

## Examples

See the [`examples/`](examples/) directory:

- [`basic.ts`](examples/basic.ts) — vectors, namespaces, queries, filters, batch operations
- [`memory.ts`](examples/memory.ts) — store/recall memories, sessions, agent stats
- [`advanced.ts`](examples/advanced.ts) — text embedding, full-text, hybrid search, knowledge graph, feedback

Run examples with:

```bash
npx tsx examples/basic.ts
```

## Connect to Dakera

```typescript
import { DakeraClient } from '@dakera-ai/dakera';

// Self-hosted
const client = new DakeraClient({
  baseUrl: 'http://your-server:3300',
  apiKey: 'your-key',
});

// Cloud (early access)
const client = new DakeraClient({
  baseUrl: 'https://api.dakera.ai',
  apiKey: 'your-key',
});

// With custom retry config
const client = new DakeraClient({
  baseUrl: 'http://localhost:3300',
  apiKey: 'your-key',
  retryBackoff: { maxRetries: 5, baseDelayMs: 200, maxDelayMs: 10000 },
});
```

## Documentation

-> [Full docs](https://dakera.ai/docs)  
-> [API reference](https://dakera.ai/docs/api)  
-> [TypeScript SDK reference](https://dakera.ai/docs/sdk/typescript)

## Related

| Repo | What it is |
|---|---|
| [dakera-py](https://github.com/dakera-ai/dakera-py) | Python SDK |
| [dakera-go](https://github.com/dakera-ai/dakera-go) | Go SDK |
| [dakera-rs](https://github.com/dakera-ai/dakera-rs) | Rust client |
| [dakera-cli](https://github.com/dakera-ai/dakera-cli) | CLI |
| [dakera-mcp](https://github.com/dakera-ai/dakera-mcp) | MCP server |
| [dakera-deploy](https://github.com/dakera-ai/dakera-deploy) | Self-host Dakera |

---

**[dakera.ai](https://dakera.ai)** · [Documentation](https://dakera.ai/docs) · [Request Early Access](https://dakera.ai#cta)

<sub>Part of the Dakera AI open-source ecosystem. Built with Rust. Self-hosted. Zero dependencies.</sub>
