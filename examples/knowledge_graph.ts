/**
 * Knowledge Graph — build, traverse, query, path, export
 *
 * Run: npx tsx examples/knowledge_graph.ts
 */

import { DakeraClient, agentId, memoryId } from '@dakera-ai/dakera';

async function main() {
  const client = new DakeraClient({
    baseUrl: process.env.DAKERA_API_URL || 'http://localhost:3300',
    apiKey: process.env.DAKERA_API_KEY || 'dk-mykey',
  });

  const health = await client.health();
  console.log(`Server: ${health.version} (status: ${health.status})`);

  const agent = agentId('kg-example-agent');

  // Store some memories so the KG has content to work with
  console.log('\n--- Storing Memories ---');
  const mem1 = await client.store({
    agent_id: agent,
    content: 'TypeScript is a superset of JavaScript that adds static typing',
    memory_type: 'semantic',
    metadata: { topic: 'programming', language: 'typescript' },
  });
  if (!mem1 || !mem1.memory_id) { throw new Error('expected memory_id from store'); }
  console.log(`Stored memory 1: ${mem1.memory_id}`);

  const mem2 = await client.store({
    agent_id: agent,
    content: 'React is a popular UI library built with JavaScript and TypeScript',
    memory_type: 'semantic',
    metadata: { topic: 'frontend', framework: 'react' },
  });
  console.log(`Stored memory 2: ${mem2.memory_id}`);

  const mem3 = await client.store({
    agent_id: agent,
    content: 'Node.js allows running JavaScript on the server side',
    memory_type: 'semantic',
    metadata: { topic: 'backend', runtime: 'nodejs' },
  });
  console.log(`Stored memory 3: ${mem3.memory_id}`);

  // --- Build Knowledge Graph ---
  console.log('\n--- Build Knowledge Graph (from seed) ---');
  const graph = await client.knowledgeGraph({
    agent_id: agent,
    memory_id: memoryId(mem1.memory_id),
    depth: 2,
    min_similarity: 0.3,
  });
  if (!graph) { throw new Error('expected non-null knowledge graph response'); }
  console.log(`Nodes: ${graph.nodes.length}`);
  console.log(`Edges: ${graph.edges.length}`);
  for (const node of graph.nodes) {
    console.log(`  Node: ${node.id} — ${node.label ?? node.id}`);
  }

  // --- Full Knowledge Graph ---
  console.log('\n--- Full Knowledge Graph ---');
  const fullGraph = await client.fullKnowledgeGraph({
    agent_id: agent,
    max_nodes: 50,
    min_similarity: 0.2,
  });
  console.log(`Full graph — Nodes: ${fullGraph.nodes.length}, Edges: ${fullGraph.edges.length}`);

  // --- Query Knowledge Graph ---
  console.log('\n--- Query Knowledge Graph ---');
  const queryResp = await client.knowledgeQuery(agent, {
    maxDepth: 3,
    limit: 20,
  });
  if (!queryResp) { throw new Error('expected non-null KG query response'); }
  console.log(`Query returned ${queryResp.nodes.length} nodes, ${queryResp.edges.length} edges`);

  // --- Find Path between Memories ---
  console.log('\n--- Find Path ---');
  try {
    const path = await client.knowledgePath(agent, mem1.memory_id, mem3.memory_id);
    console.log(`Path length: ${path.path.length} hops`);
    for (const hop of path.path) {
      console.log(`  -> ${hop}`);
    }
  } catch (e: unknown) {
    // Path may not exist if memories are not connected
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`No path found (expected if graph is sparse): ${msg}`);
  }

  // --- Export Knowledge Graph ---
  console.log('\n--- Export Knowledge Graph (JSON) ---');
  const exported = await client.knowledgeExport(agent, 'json');
  if (!exported) { throw new Error('expected non-null KG export'); }
  console.log(`Exported: ${exported.nodes.length} nodes, ${exported.edges.length} edges`);

  // Cleanup: forget the stored memories
  await client.forget({ agent_id: agent, memory_id: memoryId(mem1.memory_id) });
  await client.forget({ agent_id: agent, memory_id: memoryId(mem2.memory_id) });
  await client.forget({ agent_id: agent, memory_id: memoryId(mem3.memory_id) });
  console.log('\nMemories cleaned up. Knowledge graph example completed.');
}

main().catch((e) => { console.error(e); process.exit(1); });
