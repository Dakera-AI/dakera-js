/**
 * Analytics — agent stats, KPIs, analytics, sessions
 *
 * Run: npx tsx examples/analytics.ts
 */

import { DakeraClient, agentId } from '@dakera-ai/dakera';

async function main() {
  const client = new DakeraClient({
    baseUrl: process.env.DAKERA_API_URL || 'http://localhost:3300',
    apiKey: process.env.DAKERA_API_KEY || 'dk-mykey',
  });

  const health = await client.health();
  console.log(`Server: ${health.version} (status: ${health.status})`);

  const agent = agentId('analytics-example-agent');

  // Store a memory and create a session so analytics has data
  console.log('\n--- Setup: store memory + session ---');
  const stored = await client.store({
    agent_id: agent,
    content: 'The user prefers dark mode and compact layouts',
    memory_type: 'preference',
  });
  if (!stored || !stored.memory_id) { throw new Error('expected memory_id'); }
  console.log(`Stored memory: ${stored.memory_id}`);

  // --- Sessions ---
  console.log('\n--- Sessions ---');
  const session = await client.startSession(agent, { source: 'sdk-example' });
  if (!session || !session.id) { throw new Error('expected session with id'); }
  console.log(`Started session: ${session.id}`);

  // Get session details
  const details = await client.getSession(session.id);
  console.log(`Session agent: ${details.agent_id}, started: ${details.started_at}`);

  // List sessions for agent
  const sessions = await client.agentSessions(agent, { limit: 10 });
  console.log(`Agent sessions: ${sessions.length}`);

  // End session
  const ended = await client.endSession(session.id);
  console.log(`Session ended — memories in session: ${ended.memory_count ?? 0}`);

  // --- Agent Stats ---
  console.log('\n--- Agent Stats ---');
  const stats = await client.agentStats(agent);
  if (!stats) { throw new Error('expected non-null agent stats'); }
  console.log(`Total memories: ${stats.total_memories}`);
  console.log(`Total sessions: ${stats.total_sessions}`);
  console.log(`Total recalls: ${stats.total_recalls}`);

  // --- Product KPIs ---
  console.log('\n--- Product KPIs ---');
  const kpis = await client.getKpis();
  if (!kpis) { throw new Error('expected non-null KPI snapshot'); }
  console.log(`P50 latency: ${kpis.p50_latency_ms}ms`);
  console.log(`P99 latency: ${kpis.p99_latency_ms}ms`);
  console.log(`Error rate: ${(kpis.error_rate * 100).toFixed(2)}%`);
  console.log(`Requests/sec: ${kpis.requests_per_second}`);

  // --- Analytics Overview ---
  console.log('\n--- Analytics Overview ---');
  const overview = await client.analyticsOverview({ period: '24h' });
  if (!overview) { throw new Error('expected non-null analytics overview'); }
  console.log(`Total requests: ${overview.total_requests}`);
  console.log(`Total errors: ${overview.total_errors}`);

  // --- Latency Analytics ---
  console.log('\n--- Latency Analytics ---');
  const latency = await client.analyticsLatency({ period: '24h' });
  console.log(`Avg latency: ${latency.avg_ms?.toFixed(1) ?? 'N/A'}ms`);
  console.log(`P95 latency: ${latency.p95_ms?.toFixed(1) ?? 'N/A'}ms`);

  // --- Throughput Analytics ---
  console.log('\n--- Throughput Analytics ---');
  const throughput = await client.analyticsThroughput({ period: '24h' });
  console.log(`Reads/sec: ${throughput.reads_per_second ?? 'N/A'}`);
  console.log(`Writes/sec: ${throughput.writes_per_second ?? 'N/A'}`);

  // --- Storage Analytics ---
  console.log('\n--- Storage Analytics ---');
  const storage = await client.analyticsStorage();
  console.log(`Total size: ${storage.total_bytes ?? 'N/A'} bytes`);
  console.log(`Namespaces: ${storage.namespace_count ?? 'N/A'}`);

  // Cleanup
  await client.forget({ agent_id: agent, memory_id: stored.memory_id as any });
  console.log('\nCleanup done. Analytics example completed.');
}

main().catch((e) => { console.error(e); process.exit(1); });
