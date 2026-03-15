# Dakera TypeScript SDK

[![CI](https://github.com/dakera-ai/dakera-js/actions/workflows/ci.yml/badge.svg)](https://github.com/dakera-ai/dakera-js/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/dakera)](https://www.npmjs.com/package/dakera)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)

Official TypeScript/JavaScript client for [Dakera](https://github.com/dakera/dakera) - a high-performance vector database.

## Installation

```bash
npm install dakera
# or
yarn add dakera
# or
pnpm add dakera
```

## Quick Start

```typescript
import { DakeraClient } from 'dakera';

// Connect to Dakera
const client = new DakeraClient('http://localhost:3000');

// Upsert vectors
await client.upsert('my-namespace', [
  { id: 'vec1', values: [0.1, 0.2, 0.3], metadata: { label: 'a' } },
  { id: 'vec2', values: [0.4, 0.5, 0.6], metadata: { label: 'b' } },
]);

// Query similar vectors
const results = await client.query('my-namespace', [0.1, 0.2, 0.3], {
  topK: 10,
});

for (const result of results.results) {
  console.log(`${result.id}: ${result.score}`);
}
```

## Features

- **Full TypeScript Support**: Complete type definitions for all operations
- **Vector Operations**: Upsert, query, delete, fetch vectors
- **Full-Text Search**: Index documents and perform BM25 search
- **Hybrid Search**: Combine vector and text search with configurable weights
- **Namespace Management**: Create, list, delete namespaces
- **Metadata Filtering**: Filter queries by metadata fields
- **Automatic Retries**: Built-in retry logic with exponential backoff
- **Error Handling**: Typed exceptions for different error scenarios

## Usage Examples

### Vector Operations

```typescript
import { DakeraClient } from 'dakera';

const client = new DakeraClient({
  baseUrl: 'http://localhost:3000',
  apiKey: 'your-api-key', // optional
  timeout: 30000,
});

// Upsert vectors
await client.upsert('my-namespace', [
  { id: 'vec1', values: [0.1, 0.2, 0.3], metadata: { category: 'A' } },
  { id: 'vec2', values: [0.4, 0.5, 0.6], metadata: { category: 'B' } },
]);

// Query with metadata filter
const results = await client.query('my-namespace', [0.1, 0.2, 0.3], {
  topK: 5,
  filter: { category: { $eq: 'A' } },
  includeMetadata: true,
});

// Batch query
const batchResults = await client.batchQuery('my-namespace', [
  { vector: [0.1, 0.2, 0.3], topK: 5 },
  { vector: [0.4, 0.5, 0.6], topK: 3 },
]);

// Fetch vectors by ID
const vectors = await client.fetch('my-namespace', ['vec1', 'vec2']);

// Delete vectors
await client.delete('my-namespace', { ids: ['vec1', 'vec2'] });
await client.delete('my-namespace', { filter: { category: { $eq: 'obsolete' } } });
```

### Full-Text Search

```typescript
// Index documents
await client.indexDocuments('my-namespace', [
  { id: 'doc1', content: 'Machine learning is transforming industries' },
  { id: 'doc2', content: 'Vector databases enable semantic search' },
]);

// Search
const results = await client.fulltextSearch('my-namespace', 'machine learning', {
  topK: 10,
});

for (const result of results) {
  console.log(`${result.id}: ${result.score}`);
}
```

### Hybrid Search

```typescript
// Combine vector and text search
const results = await client.hybridSearch(
  'my-namespace',
  [0.1, 0.2, 0.3], // Query vector
  'machine learning', // Text query
  {
    topK: 10,
    alpha: 0.7, // 0 = pure vector, 1 = pure text
  }
);

for (const result of results) {
  console.log(`${result.id}: score=${result.score}, vector=${result.vectorScore}, text=${result.textScore}`);
}
```

### Namespace Management

```typescript
// Create namespace
await client.createNamespace('embeddings', {
  dimensions: 384,
  indexType: 'hnsw',
});

// List namespaces
const namespaces = await client.listNamespaces();
for (const ns of namespaces) {
  console.log(`${ns.name}: ${ns.vectorCount} vectors`);
}

// Get namespace info
const info = await client.getNamespace('embeddings');
console.log(`Dimensions: ${info.dimensions}, Index: ${info.indexType}`);

// Delete namespace
await client.deleteNamespace('old-namespace');
```

### Metadata Filtering

Dakera supports rich metadata filtering:

```typescript
// Equality
const filter1 = { status: { $eq: 'active' } };

// Comparison
const filter2 = { price: { $gt: 100, $lt: 500 } };

// In list
const filter3 = { category: { $in: ['electronics', 'books'] } };

// Logical operators
const filter4 = {
  $and: [
    { status: { $eq: 'active' } },
    { price: { $lt: 1000 } },
  ],
};

const results = await client.query('products', queryVector, {
  filter: filter4,
  topK: 20,
});
```

### Error Handling

```typescript
import {
  DakeraClient,
  NotFoundError,
  ValidationError,
  RateLimitError,
  ServerError,
} from 'dakera';

const client = new DakeraClient('http://localhost:3000');

try {
  const results = await client.query('nonexistent', [0.1, 0.2]);
} catch (error) {
  if (error instanceof NotFoundError) {
    console.log(`Namespace not found: ${error.message}`);
  } else if (error instanceof ValidationError) {
    console.log(`Invalid request: ${error.message}`);
  } else if (error instanceof RateLimitError) {
    console.log(`Rate limited, retry after ${error.retryAfter} seconds`);
  } else if (error instanceof ServerError) {
    console.log(`Server error: ${error.message}`);
  }
}
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `baseUrl` | string | required | Dakera server URL |
| `apiKey` | string | undefined | API key for authentication |
| `timeout` | number | 30000 | Request timeout in milliseconds |
| `maxRetries` | number | 3 | Max retries for failed requests |
| `headers` | object | undefined | Additional HTTP headers |

## API Reference

### DakeraClient

#### Vector Operations
- `upsert(namespace, vectors)` - Insert or update vectors
- `query(namespace, vector, options?)` - Query similar vectors
- `delete(namespace, options)` - Delete vectors
- `fetch(namespace, ids, options?)` - Fetch vectors by ID
- `batchQuery(namespace, queries)` - Execute multiple queries

#### Full-Text Operations
- `indexDocuments(namespace, documents)` - Index documents
- `fulltextSearch(namespace, query, options?)` - Text search
- `hybridSearch(namespace, vector, query, options?)` - Hybrid search

#### Namespace Operations
- `listNamespaces()` - List all namespaces
- `getNamespace(namespace)` - Get namespace info
- `createNamespace(namespace, options?)` - Create namespace
- `deleteNamespace(namespace)` - Delete namespace

#### Admin Operations
- `health()` - Check server health
- `getIndexStats(namespace)` - Get index statistics
- `compact(namespace)` - Trigger compaction
- `flush(namespace)` - Flush pending writes

## TypeScript Types

All types are exported for use in your application:

```typescript
import type {
  Vector,
  VectorInput,
  QueryResult,
  SearchResult,
  NamespaceInfo,
  IndexStats,
  Document,
  FilterExpression,
  QueryOptions,
  ClientOptions,
} from 'dakera';
```

## Browser Support

This SDK uses the Fetch API and works in:
- Node.js 18+
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Deno
- Bun

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Type check
npm run typecheck

# Lint
npm run lint
```

## Related Repositories

| Repository | Description |
|------------|-------------|
| [dakera](https://github.com/dakera-ai/dakera) | Core vector database engine (Rust) |
| [dakera-py](https://github.com/dakera-ai/dakera-py) | Python SDK |
| [dakera-go](https://github.com/dakera-ai/dakera-go) | Go SDK |
| [dakera-rs](https://github.com/dakera-ai/dakera-rs) | Rust SDK |
| [dakera-cli](https://github.com/dakera-ai/dakera-cli) | Command-line interface |
| [dakera-mcp](https://github.com/dakera-ai/dakera-mcp) | MCP Server for AI agent memory |
| [dakera-dashboard](https://github.com/dakera-ai/dakera-dashboard) | Admin dashboard (Leptos/WASM) |
| [dakera-docs](https://github.com/dakera-ai/dakera-docs) | Documentation |
| [dakera-deploy](https://github.com/dakera-ai/dakera-deploy) | Deployment configs and Docker Compose |
| [dakera-cortex](https://github.com/dakera-ai/dakera-cortex) | Flagship demo with AI agents |

## License

MIT License - see [LICENSE](LICENSE) for details.
