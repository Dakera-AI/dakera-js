/**
 * Dakera JS SDK — Advanced Features
 *
 * Covers: text auto-embedding, full-text search, hybrid search,
 * knowledge graph, feedback loop, analytics
 *
 * Run: npx tsx examples/advanced.ts
 */

import { DakeraClient } from '@dakera-ai/dakera';

async function main() {
  const client = new DakeraClient({
    baseUrl: process.env.DAKERA_API_URL || 'http://localhost:3300',
    apiKey: process.env.DAKERA_API_KEY || 'dk-mykey',
  });

  const namespace = 'example-advanced';

  // -------------------------------------------------------------------------
  // Text auto-embedding (server generates vectors)
  // -------------------------------------------------------------------------
  console.log('--- Text Auto-Embedding ---');

  const textResp = await client.upsertText(namespace, [
    { id: 'doc1', text: 'Rust memory safety prevents data races at compile time.' },
    { id: 'doc2', text: 'Go goroutines enable lightweight concurrency patterns.' },
    { id: 'doc3', text: 'Python asyncio provides cooperative multitasking.' },
  ]);
  console.log(`Upserted ${textResp.upserted_count} text documents`);

  const textResults = await client.queryText(namespace, 'concurrent programming', {
    top_k: 3,
  });
  console.log('Text search results:');
  for (const r of textResults.results) {
    console.log(`  ${r.id}: ${r.text} (score: ${r.score.toFixed(4)})`);
  }

  // -------------------------------------------------------------------------
  // Full-text search (BM25)
  // -------------------------------------------------------------------------
  console.log('\n--- Full-Text Search ---');

  await client.indexDocuments(namespace, [
    { id: 'ft1', text: 'Vector databases enable semantic search over embeddings.' },
    { id: 'ft2', text: 'BM25 ranking uses term frequency and document length.' },
    { id: 'ft3', text: 'Hybrid search combines vector similarity with keyword matching.' },
  ]);

  const ftResults = await client.fulltextSearch(namespace, 'vector search', { topK: 5 });
  console.log('Full-text results:');
  for (const r of ftResults) {
    console.log(`  ${r.id}: score ${r.score.toFixed(4)}`);
  }

  // -------------------------------------------------------------------------
  // Hybrid search (vector + BM25)
  // -------------------------------------------------------------------------
  console.log('\n--- Hybrid Search ---');

  const hybridResults = await client.hybridSearch(namespace, 'semantic search', {
    topK: 5,
    vectorWeight: 0.7,
  });
  console.log('Hybrid results:');
  for (const r of hybridResults) {
    console.log(`  ${r.id}: score ${r.score.toFixed(4)}`);
  }

  // -------------------------------------------------------------------------
  // Knowledge graph
  // -------------------------------------------------------------------------
  console.log('\n--- Knowledge Graph ---');

  const agentId = 'agent-demo';
  let m1Id: string | undefined;
  let m2Id: string | undefined;

  try {
    const m1 = await client.storeMemory(agentId, {
      content: 'User is a senior backend engineer.',
      memory_type: 'semantic',
      importance: 0.9,
    });
    m1Id = m1.memory_id;

    const m2 = await client.storeMemory(agentId, {
      content: 'User works primarily with Go and Rust.',
      memory_type: 'semantic',
      importance: 0.8,
    });
    m2Id = m2.memory_id;

    await client.memoryLink(m1Id, m2Id, 'related_to');

    const graph = await client.memoryGraph(m1Id, { depth: 2 });
    console.log(`Graph nodes: ${graph.nodes.length}, edges: ${graph.edges.length}`);

    const path = await client.memoryPath(m1Id, m2Id);
    console.log(`Path length: ${path.path.length}`);
  } catch (e: any) {
    console.log(`Knowledge graph not fully supported on this server version: ${e.message || e}`);
  }

  // -------------------------------------------------------------------------
  // Feedback loop
  // -------------------------------------------------------------------------
  console.log('\n--- Feedback Loop ---');

  try {
    if (m1Id) {
      await client.feedbackMemory(m1Id, agentId, 'upvote');
      const history = await client.getMemoryFeedbackHistory(m1Id);
      console.log(`Feedback entries: ${history.entries.length}`);
    }

    const summary = await client.getAgentFeedbackSummary(agentId);
    console.log(`Agent feedback — upvotes: ${summary.upvotes}, downvotes: ${summary.downvotes}`);
  } catch (e: any) {
    console.log(`Feedback not fully supported on this server version: ${e.message || e}`);
  }

  // -------------------------------------------------------------------------
  // Analytics
  // -------------------------------------------------------------------------
  console.log('\n--- Analytics ---');

  const overview = await client.analyticsOverview();
  console.log(`Total operations: ${overview.total_operations}`);

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------
  try {
    if (m1Id) await client.forget(agentId, m1Id);
    if (m2Id) await client.forget(agentId, m2Id);
  } catch (_) { /* best effort cleanup */ }
  await client.deleteNamespace(namespace);
  console.log('\nCleaned up');
}

main().catch((e) => { console.error(e); process.exit(1); });
