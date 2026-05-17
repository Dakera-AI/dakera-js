/**
 * Admin Operations — backup, quota, maintenance, cluster
 *
 * Run: npx tsx examples/admin_operations.ts
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

  // --- Cluster Status ---
  console.log('\n--- Cluster Status ---');
  const cluster = await client.clusterStatus();
  if (!cluster) { throw new Error('expected non-null cluster status'); }
  console.log(`Cluster state: ${cluster.state}`);
  console.log(`Nodes: ${cluster.nodes?.length ?? 0}`);

  const nodes = await client.clusterNodes();
  for (const node of nodes) {
    console.log(`  Node: ${node.id} — ${node.address} (role: ${node.role})`);
  }

  // --- Quotas ---
  console.log('\n--- Quotas ---');
  const quotas = await client.getQuotas();
  if (!quotas) { throw new Error('expected non-null quotas'); }
  console.log(`Current quotas: ${JSON.stringify(quotas)}`);

  // Update quotas (set a generous default)
  const updated = await client.updateQuotas({
    max_namespaces: 100,
    max_vectors_per_namespace: 10_000_000,
  });
  console.log(`Updated quotas: ${JSON.stringify(updated)}`);

  // --- Maintenance Mode ---
  console.log('\n--- Maintenance Mode ---');
  const mStatus = await client.adminMaintenanceStatus();
  console.log(`Maintenance active: ${mStatus.enabled}`);

  // Enable maintenance with reason
  const enabled = await client.adminEnableMaintenance({ reason: 'sdk-example-test' });
  console.log(`Enabled maintenance: ${enabled.enabled}, reason: ${enabled.reason}`);

  // Disable maintenance
  const disabled = await client.adminDisableMaintenance();
  console.log(`Disabled maintenance: ${disabled.enabled}`);

  // --- Backups ---
  console.log('\n--- Backups ---');
  const backup = await client.createBackup(true);
  if (!backup) { throw new Error('expected non-null backup'); }
  console.log(`Created backup: ${backup.id} (size: ${backup.size_bytes ?? 'unknown'} bytes)`);

  const backups = await client.listBackups();
  console.log(`Total backups: ${backups.length}`);

  // Clean up: delete the backup we just created
  await client.deleteBackup(backup.id);
  console.log(`Deleted backup: ${backup.id}`);

  // --- Server Config ---
  console.log('\n--- Server Config ---');
  const config = await client.getConfig();
  console.log(`Config keys: ${Object.keys(config).join(', ')}`);

  // --- Slow Queries ---
  console.log('\n--- Slow Queries ---');
  const slow = await client.slowQueries({ limit: 5, minDurationMs: 100 });
  console.log(`Slow queries (>100ms): ${slow.length}`);
  for (const q of slow) {
    console.log(`  ${q.namespace} — ${q.duration_ms}ms`);
  }

  console.log('\nAdmin operations completed successfully.');
}

main().catch((e) => { console.error(e); process.exit(1); });
