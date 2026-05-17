/**
 * Dakera JS SDK — Memory & Session Operations
 *
 * Run: npx tsx examples/memory.ts
 */

import { DakeraClient } from '@dakera-ai/dakera';

async function main() {
  const client = new DakeraClient({
    baseUrl: process.env.DAKERA_API_URL || 'http://localhost:3300',
    apiKey: process.env.DAKERA_API_KEY || 'dk-mykey',
  });

  const agentId = 'agent-demo';

  // -------------------------------------------------------------------------
  // Store memories
  // -------------------------------------------------------------------------
  console.log('--- Storing Memories ---');

  const mem1 = await client.storeMemory(agentId, {
    content: 'The user prefers concise responses with code examples.',
    memory_type: 'semantic',
    importance: 0.9,
    metadata: { source: 'user-feedback' },
  });
  console.log(`Stored memory: ${mem1.memory_id}`);

  const mem2 = await client.storeMemory(agentId, {
    content: 'User is building a TypeScript microservice with Express.',
    memory_type: 'episodic',
    importance: 0.7,
  });
  console.log(`Stored memory: ${mem2.memory_id}`);

  // -------------------------------------------------------------------------
  // Recall memories (semantic search)
  // -------------------------------------------------------------------------
  console.log('\n--- Recalling Memories ---');

  const recalled = await client.recall(agentId, 'What does the user prefer?', {
    top_k: 5,
  });
  for (const m of recalled.memories) {
    console.log(`  [${m.score?.toFixed(2)}] ${m.memory_type} — ${m.content}`);
  }

  // Recall with time window
  const recent = await client.recall(agentId, 'user context', {
    top_k: 5,
    since: new Date(Date.now() - 3600_000).toISOString(),
  });
  console.log(`Recent memories: ${recent.memories.length}`);

  // -------------------------------------------------------------------------
  // Search memories by type
  // -------------------------------------------------------------------------
  console.log('\n--- Search Memories (type=semantic) ---');

  const searched = await client.searchMemories(agentId, 'user preferences', {
    memory_type: 'semantic',
    top_k: 3,
  });
  for (const m of searched) {
    console.log(`  [${m.score?.toFixed(2)}] ${m.content}`);
  }

  // -------------------------------------------------------------------------
  // Batch recall (filter-based, no embedding)
  // -------------------------------------------------------------------------
  console.log('\n--- Batch Recall ---');

  const batchResp = await client.batchRecall({
    agent_id: agentId,
    filter: { min_importance: 0.8 },
    limit: 10,
  });
  console.log(`Batch recall found ${batchResp.filtered} memories`);

  // -------------------------------------------------------------------------
  // Session management
  // -------------------------------------------------------------------------
  console.log('\n--- Session Management ---');

  const session = await client.startSession(agentId, { task: 'code-review' });
  console.log(`Started session: ${session.id}`);

  // Store a session-scoped memory
  await client.storeMemory(agentId, {
    content: 'Reviewing PR #42: refactor authentication middleware.',
    session_id: session.id,
  });
  console.log('Stored session-scoped memory');

  // End the session
  const endResp = await client.endSession(session.id);
  console.log(`Ended session (memories: ${endResp.memory_count})`);

  // -------------------------------------------------------------------------
  // Agent stats
  // -------------------------------------------------------------------------
  console.log('\n--- Agent Stats ---');

  const stats = await client.agentStats(agentId);
  console.log(`Agent: ${stats.agent_id}`);
  console.log(`  Total memories: ${stats.total_memories}`);
  console.log(`  Total sessions: ${stats.total_sessions}`);

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------
  await client.forget(agentId, mem1.memory_id);
  await client.forget(agentId, mem2.memory_id);
  console.log('\nCleaned up memories');
}

main().catch((e) => { console.error(e); process.exit(1); });
