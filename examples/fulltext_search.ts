/**
 * Full-Text Search — index documents, search, stats, delete
 *
 * Run: npx tsx examples/fulltext_search.ts
 */

import { DakeraClient } from '@dakera-ai/dakera';

async function main() {
  const client = new DakeraClient({
    baseUrl: process.env.DAKERA_API_URL || 'http://localhost:3300',
    apiKey: process.env.DAKERA_API_KEY || 'dk-mykey',
  });

  const health = await client.health();
  console.log(`Server: ${health.version} (status: ${health.status})`);

  const namespace = 'example-fulltext';

  // Create namespace for full-text indexing
  await client.createNamespace(namespace, { dimensions: 3 });

  // --- Index Documents ---
  console.log('\n--- Indexing Documents ---');
  const indexResp = await client.indexDocuments(namespace, [
    { id: 'doc1', text: 'The quick brown fox jumps over the lazy dog', metadata: { topic: 'animals' } },
    { id: 'doc2', text: 'Machine learning enables computers to learn from data', metadata: { topic: 'tech' } },
    { id: 'doc3', text: 'Neural networks are inspired by biological neurons', metadata: { topic: 'tech' } },
    { id: 'doc4', text: 'The fox ran swiftly through the dense forest', metadata: { topic: 'animals' } },
    { id: 'doc5', text: 'Deep learning is a subset of machine learning algorithms', metadata: { topic: 'tech' } },
  ]);
  if (!indexResp || indexResp.indexed_count !== 5) {
    throw new Error(`expected 5 indexed, got ${indexResp?.indexed_count}`);
  }
  console.log(`Indexed ${indexResp.indexed_count} documents`);

  // --- Full-Text Search ---
  console.log('\n--- Search: "machine learning" ---');
  const results = await client.fulltextSearch(namespace, 'machine learning', { topK: 5 });
  if (!results || results.length === 0) {
    throw new Error('expected non-empty search results');
  }
  for (const r of results) {
    console.log(`  ID: ${r.id}, Score: ${r.score.toFixed(4)}`);
  }

  // Search with metadata filter
  console.log('\n--- Filtered Search: "fox" (topic=animals) ---');
  const filtered = await client.fulltextSearch(namespace, 'fox', {
    topK: 5,
    filter: { topic: { $eq: 'animals' } },
  });
  for (const r of filtered) {
    console.log(`  ID: ${r.id}, Score: ${r.score.toFixed(4)}`);
  }
  if (filtered.length < 1) {
    throw new Error('expected at least 1 result for "fox" in animals');
  }

  // --- Index Stats ---
  console.log('\n--- Full-Text Index Stats ---');
  const stats = await client.fulltextStats(namespace);
  if (!stats) { throw new Error('expected non-null fulltext stats'); }
  console.log(`Documents indexed: ${stats.document_count}`);
  console.log(`Total terms: ${stats.total_terms ?? 'N/A'}`);

  // --- Delete Documents from Index ---
  console.log('\n--- Delete Documents ---');
  const delResp = await client.fulltextDelete(namespace, ['doc1', 'doc2']);
  if (!delResp) { throw new Error('expected non-null delete response'); }
  console.log(`Deleted ${delResp.deleted_count} documents from full-text index`);

  // Verify reduced count
  const statsAfter = await client.fulltextStats(namespace);
  console.log(`Documents remaining: ${statsAfter.document_count}`);

  // Cleanup
  await client.deleteNamespace(namespace);
  console.log('\nNamespace deleted. Full-text search example completed.');
}

main().catch((e) => { console.error(e); process.exit(1); });
