# ⚡ dakera-js

[![CI](https://github.com/Dakera-AI/dakera-js/actions/workflows/ci.yml/badge.svg)](https://github.com/Dakera-AI/dakera-js/actions/workflows/ci.yml) [![npm](https://img.shields.io/npm/v/dakera?logo=npm)](https://www.npmjs.com/package/dakera) [![Downloads](https://img.shields.io/npm/dm/dakera)](https://www.npmjs.com/package/dakera) [![License: MIT](https://img.shields.io/github/license/Dakera-AI/dakera-js)](LICENSE)

TypeScript SDK for Dakera AI — store, recall, and search agent memories against a Dakera instance.

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

curl http://localhost:3300/health  # → {"status":"ok"}
```

Full deployment guide (Docker Compose, Kubernetes, Helm): [dakera-deploy](https://github.com/Dakera-AI/dakera-deploy)

---

## Install

```bash
npm install dakera
```

## Quick Start

```typescript
import { DakeraClient } from 'dakera';

const client = new DakeraClient({
  baseUrl: 'http://localhost:3300',
  apiKey: 'your-key',
});

// Store a vector
await client.vectors.upsert({
  id: 'vec-001',
  values: [0.1, 0.2, 0.3],
  metadata: { text: 'agent completed task', agentId: 'my-agent' },
});

// Full-text search
const results = await client.fulltext.search({ query: 'completed task', topK: 5 });
results.forEach(r => console.log(r.id, r.score));

// Store an agent memory
await client.memories.store({
  agentId: 'my-agent',
  content: 'User prefers concise responses',
  importance: 0.8,
  tags: ['preference', 'ux'],
});
```

## Connect to Dakera

```typescript
import { DakeraClient } from 'dakera';

// Self-hosted
const client = new DakeraClient({ baseUrl: 'http://your-server:3300', apiKey: 'your-key' });

// Cloud (early access)
const client = new DakeraClient({ baseUrl: 'https://api.dakera.ai', apiKey: 'your-key' });
```

## Documentation

→ [Full docs](https://dakera.ai/docs)  
→ [API reference](https://dakera.ai/docs/api)  
→ [TypeScript SDK reference](https://dakera.ai/docs/sdk/typescript)

## Related

| Repo | What it is |
|---|---|
| [dakera-py](https://github.com/dakera-ai/dakera-py) | Python SDK |
| [dakera-go](https://github.com/dakera-ai/dakera-go) | Go SDK |
| [dakera-rs](https://github.com/dakera-ai/dakera-rs) | Rust client |
| [dakera-cli](https://github.com/dakera-ai/dakera-cli) | CLI |
| [dakera-mcp](https://github.com/dakera-ai/dakera-mcp) | MCP server · 83 tools |
| [dakera-deploy](https://github.com/dakera-ai/dakera-deploy) | Self-host Dakera |

---

*Part of the Dakera AI open core. The engine is proprietary. The tools are yours.*
