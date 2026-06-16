/**
 * Dakera JS SDK — Playground Quickstart
 *
 * Demonstrates the 4 core memory operations against the Dakera Playground.
 *
 * Run:
 *   npm install @dakera-ai/dakera@0.11.92
 *   npx tsx examples/playground/quickstart.ts
 */

import { randomBytes } from 'crypto';
import { DakeraClient } from '@dakera-ai/dakera';

const PLAYGROUND_URL = process.env.DAKERA_API_URL ?? 'https://5-75-177-31.sslip.io';
const PLAYGROUND_KEY = process.env.DAKERA_API_KEY ?? 'playground-demo';
const AGENT_ID = 'playground-agent';

async function main() {
  // Generate a unique session ID so the sandbox proxy can isolate this run's
  // memories from other concurrent playground sessions (DAK-6806).
  const sessionId = `pg_${randomBytes(12).toString('hex')}`;

  const client = new DakeraClient({
    baseUrl: PLAYGROUND_URL,
    apiKey: PLAYGROUND_KEY,
    headers: { 'X-Playground-Session': sessionId },
  });

  const health = await client.health();
  console.log(`Playground: ${health.status} (${health.version})`);

  // -------------------------------------------------------------------------
  // 1. Store memories
  // -------------------------------------------------------------------------
  console.log('\n--- 1. Store Memories ---');

  const mem1 = await client.storeMemory(AGENT_ID, {
    content: 'Dakera provides persistent, decay-weighted memory for AI agents.',
    memory_type: 'semantic',
    importance: 0.9,
    tags: ['dakera', 'memory', 'overview'],
  });
  console.log(`Stored: ${mem1.memory.id}`);

  const mem2 = await client.storeMemory(AGENT_ID, {
    content: 'The recall API returns semantically similar memories ranked by relevance.',
    memory_type: 'semantic',
    importance: 0.8,
    tags: ['dakera', 'recall', 'api'],
  });
  console.log(`Stored: ${mem2.memory.id}`);

  const mem3 = await client.storeMemory(AGENT_ID, {
    content: 'Session scoping lets agents isolate memories per task or conversation.',
    memory_type: 'episodic',
    importance: 0.7,
    tags: ['sessions', 'isolation'],
  });
  console.log(`Stored: ${mem3.memory.id}`);

  // -------------------------------------------------------------------------
  // 2. Recall by query (semantic search)
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Recall by Query ---');

  const recalled = await client.recall(AGENT_ID, 'How does Dakera memory work?', {
    top_k: 5,
  });
  console.log(`Recalled ${recalled.memories.length} memories:`);
  for (const m of recalled.memories) {
    console.log(`  [${m.score?.toFixed(3) ?? 'n/a'}] ${m.content.slice(0, 80)}`);
  }

  // -------------------------------------------------------------------------
  // 3. Search with filters
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Search with Filters ---');

  const filtered = await client.searchMemories(AGENT_ID, 'memory API', {
    memory_type: 'semantic',
    top_k: 3,
  });
  console.log(`Filtered search (${filtered.length} results):`);
  for (const m of filtered) {
    console.log(`  [${m.score?.toFixed(3) ?? 'n/a'}] ${m.content.slice(0, 80)}`);
  }

  // -------------------------------------------------------------------------
  // 4. Knowledge graph link
  // Note: requires a full Dakera account; not available on the public sandbox.
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Knowledge Graph Link ---');

  try {
    const link = await client.memoryLink(mem1.memory.id, mem2.memory.id, 'related_to');
    console.log(`Linked ${mem1.memory.id} → ${mem2.memory.id}`);
    console.log(`  Edge: ${link.edge?.edge_type ?? 'created'}`);
  } catch (kgErr: unknown) {
    const msg = kgErr instanceof Error ? kgErr.message : String(kgErr);
    console.log(`KG link not available in sandbox: ${msg}`);
    console.log('  Sign up at https://dakera.ai for full knowledge graph access.');
  }

  console.log('\nPlayground quickstart complete! Visit https://dakera.ai to learn more.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
