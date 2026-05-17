/**
 * Basic Dakera JS SDK usage — vectors, namespaces, search
 *
 * Run: npx tsx examples/basic.ts
 */

import { DakeraClient } from '@dakera-ai/dakera';

async function main() {
  const client = new DakeraClient({
    baseUrl: process.env.DAKERA_API_URL || 'http://localhost:3300',
    apiKey: process.env.DAKERA_API_KEY || 'dk-mykey',
  });

  // Check server health
  const health = await client.health();
  console.log(`Server: ${health.version} (status: ${health.status})`);

  const namespace = 'example-vectors';

  // Create namespace
  await client.createNamespace(namespace, { dimensions: 3 });

  // Upsert vectors with metadata
  const upsertResp = await client.upsert(namespace, [
    {
      id: 'vec1',
      values: [0.1, 0.2, 0.3],
      metadata: { category: 'electronics', price: 299.99 },
    },
    {
      id: 'vec2',
      values: [0.4, 0.5, 0.6],
      metadata: { category: 'books', price: 19.99 },
    },
    {
      id: 'vec3',
      values: [0.15, 0.25, 0.35],
      metadata: { category: 'electronics', price: 599.99 },
    },
  ]);
  console.log(`Upserted ${upsertResp.upserted_count} vectors`);

  // Query similar vectors
  console.log('\n--- Query Results ---');
  const results = await client.query(namespace, [0.1, 0.2, 0.3], {
    topK: 10,
    includeMetadata: true,
  });
  for (const match of results.results) {
    console.log(`ID: ${match.id}, Score: ${match.score.toFixed(4)}`);
  }

  // Query with metadata filter
  console.log('\n--- Filtered Query (electronics only) ---');
  const filtered = await client.query(namespace, [0.1, 0.2, 0.3], {
    topK: 10,
    filter: { category: { $eq: 'electronics' } },
    includeMetadata: true,
  });
  for (const match of filtered.results) {
    console.log(`ID: ${match.id}, Score: ${match.score.toFixed(4)}, Category: ${match.metadata?.category}`);
  }

  // Batch query
  console.log('\n--- Batch Query ---');
  const batchResults = await client.batchQuery(namespace, [
    { vector: [0.1, 0.2, 0.3], topK: 2 },
    { vector: [0.4, 0.5, 0.6], topK: 2 },
  ]);
  batchResults.forEach((result, i) => {
    console.log(`Query ${i + 1}:`);
    for (const r of result.results) {
      console.log(`  ID: ${r.id}, Score: ${r.score.toFixed(4)}`);
    }
  });

  // Delete specific vectors by ID
  console.log('\n--- Delete Vectors ---');
  const deleteResp = await client.delete(namespace, { ids: ['vec1', 'vec2'] });
  console.log(`Deleted ${deleteResp.deleted_count} vectors`);

  // Cleanup
  await client.deleteNamespace(namespace);
  console.log('Namespace deleted');
}

main().catch((e) => { console.error(e); process.exit(1); });
