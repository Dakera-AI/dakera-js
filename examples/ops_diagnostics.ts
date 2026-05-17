/**
 * Ops Diagnostics — system diagnostics, jobs, compaction, cache
 *
 * Run: npx tsx examples/ops_diagnostics.ts
 */

import { DakeraClient } from '@dakera-ai/dakera';

async function main() {
  const client = new DakeraClient({
    baseUrl: process.env.DAKERA_API_URL || 'http://localhost:3300',
    apiKey: process.env.DAKERA_API_KEY || 'dk-mykey',
  });

  // Verify connectivity
  const health = await client.health();
  console.log(`Server: ${health.version} (status: ${health.status})`);

  // --- System Diagnostics ---
  console.log('\n--- System Diagnostics ---');
  const diag = await client.opsDiagnostics();
  if (!diag) { throw new Error('expected non-null diagnostics'); }
  console.log(`Memory used: ${diag.memory_used_bytes ?? 'N/A'} bytes`);
  console.log(`Disk used: ${diag.disk_used_bytes ?? 'N/A'} bytes`);
  console.log(`CPU cores: ${diag.cpu_count ?? 'N/A'}`);
  console.log(`Open files: ${diag.open_file_descriptors ?? 'N/A'}`);

  // --- Ops Stats ---
  console.log('\n--- Ops Stats ---');
  const stats = await client.opsStats();
  if (!stats) { throw new Error('expected non-null ops stats'); }
  console.log(`Version: ${stats.version}`);
  console.log(`Total vectors: ${stats.total_vectors}`);
  console.log(`Namespace count: ${stats.namespace_count}`);
  console.log(`Uptime: ${stats.uptime_seconds}s`);

  // --- Background Jobs ---
  console.log('\n--- Background Jobs ---');
  const jobs = await client.opsListJobs();
  console.log(`Active jobs: ${jobs.length}`);
  for (const job of jobs) {
    console.log(`  Job: ${job.id} — type: ${job.job_type}, status: ${job.status}`);
  }

  // --- Compaction ---
  console.log('\n--- Trigger Compaction ---');
  const compaction = await client.opsCompact();
  if (!compaction) { throw new Error('expected non-null compaction response'); }
  console.log(`Compaction status: ${compaction.status}`);
  console.log(`Reclaimed bytes: ${compaction.reclaimed_bytes ?? 0}`);

  // --- Cache Stats ---
  console.log('\n--- Cache Stats ---');
  const cache = await client.cacheStats();
  if (!cache) { throw new Error('expected non-null cache stats'); }
  console.log(`Cache entries: ${cache.entries}`);
  console.log(`Hit rate: ${(cache.hit_rate * 100).toFixed(1)}%`);
  console.log(`Memory bytes: ${cache.memory_bytes}`);

  // Clear cache for a fresh state
  const cleared = await client.cacheClear();
  console.log(`Cache cleared: ${cleared.status}`);

  console.log('\nOps diagnostics completed successfully.');
}

main().catch((e) => { console.error(e); process.exit(1); });
