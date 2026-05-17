/**
 * Vector Operations — bulk upsert, bulk update/delete, count, aggregate, export
 *
 * Run: npx tsx examples/vector_operations.ts
 */

import { DakeraClient } from '@dakera-ai/dakera';

async function main() {
  const client = new DakeraClient({
    baseUrl: process.env.DAKERA_API_URL || 'http://localhost:3300',
    apiKey: process.env.DAKERA_API_KEY || 'dk-mykey',
  });

  const health = await client.health();
  console.log(`Server: ${health.version} (status: ${health.status})`);

  const namespace = 'example-vector-ops';

  // Create namespace
  await client.createNamespace(namespace, { dimensions: 4 });

  // --- Bulk Upsert ---
  console.log('\n--- Bulk Upsert ---');
  const vectors = Array.from({ length: 50 }, (_, i) => ({
    id: `vec-${String(i).padStart(3, '0')}`,
    values: [Math.random(), Math.random(), Math.random(), Math.random()],
    metadata: {
      category: i % 3 === 0 ? 'A' : i % 3 === 1 ? 'B' : 'C',
      score: Math.floor(Math.random() * 100),
      active: i % 2 === 0,
    },
  }));

  const upsertResp = await client.upsert(namespace, vectors);
  if (!upsertResp || upsertResp.upserted_count !== 50) {
    throw new Error(`expected 50 upserted, got ${upsertResp?.upserted_count}`);
  }
  console.log(`Upserted ${upsertResp.upserted_count} vectors`);

  // --- Count Vectors ---
  console.log('\n--- Count Vectors ---');
  const totalCount = await client.countVectors(namespace);
  console.log(`Total vectors: ${totalCount.count}`);
  if (totalCount.count < 50) {
    throw new Error(`expected at least 50 vectors, got ${totalCount.count}`);
  }

  // Count with filter
  const catACount = await client.countVectors(namespace, { category: { $eq: 'A' } });
  console.log(`Category A vectors: ${catACount.count}`);

  // --- Bulk Update ---
  console.log('\n--- Bulk Update ---');
  const updateResp = await client.bulkUpdateVectors(
    namespace,
    { category: { $eq: 'B' } },
    { metadata: { priority: 'high', reviewed: true } }
  );
  if (!updateResp) { throw new Error('expected non-null bulk update response'); }
  console.log(`Updated ${updateResp.updated_count} vectors (category B -> priority high)`);

  // --- Aggregate ---
  console.log('\n--- Aggregate ---');
  const aggResp = await client.aggregate(namespace, {
    aggregateBy: { count: 'Count', avg_score: ['Avg', 'score'] },
    groupBy: ['category'],
  });
  if (!aggResp || !aggResp.groups) {
    throw new Error('expected non-null aggregation response with groups');
  }
  for (const group of aggResp.groups) {
    console.log(`  Category "${group.key}": count=${group.values?.count}, avg_score=${group.values?.avg_score?.toFixed(1) ?? 'N/A'}`);
  }

  // --- Export Vectors ---
  console.log('\n--- Export Vectors (paginated) ---');
  let cursor: string | undefined;
  let totalExported = 0;
  do {
    const exportResp = await client.exportVectors(namespace, {
      topK: 20,
      cursor,
      includeVectors: false,
      includeMetadata: true,
    });
    totalExported += exportResp.returned_count;
    cursor = exportResp.next_cursor ?? undefined;
    console.log(`  Page: ${exportResp.returned_count} vectors (cursor: ${cursor ? 'more' : 'done'})`);
  } while (cursor);
  console.log(`Total exported: ${totalExported}`);

  // --- Bulk Delete ---
  console.log('\n--- Bulk Delete ---');
  const bulkDelResp = await client.bulkDeleteVectors(namespace, { category: { $eq: 'C' } });
  if (!bulkDelResp) { throw new Error('expected non-null bulk delete response'); }
  console.log(`Deleted ${bulkDelResp.deleted_count} vectors (category C)`);

  // Verify count reduced
  const afterCount = await client.countVectors(namespace);
  console.log(`Vectors remaining: ${afterCount.count}`);

  // Cleanup
  await client.deleteNamespace(namespace);
  console.log('\nNamespace deleted. Vector operations example completed.');
}

main().catch((e) => { console.error(e); process.exit(1); });
