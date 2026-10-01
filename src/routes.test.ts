/**
 * Route sweep: every endpoint `DakeraClient` calls must exist in the v0.12.0
 * server router (`crates/api/src/lib.rs`, plus `routes/keys.rs::keys_router`).
 *
 * `V012_ROUTES` is a snapshot of that router (method + path, `{}` for any path
 * parameter). Admin routes are served under both `/admin/*` and `/v1/admin/*`
 * (DAK-6649), which the check below accounts for. Regenerate the snapshot when
 * the server adds routes. This guards against SDK methods that call routes the
 * server never served (found in the v0.12.0 sweep: `PUT /v1/admin/quotas`,
 * `POST /v1/namespaces/{ns}/fetch|flush`, `.../compact`, `.../stats`,
 * `POST /v1/admin/namespaces/{ns}/ttl`, `POST /v1/audit/export`,
 * `GET /v1/extract/providers`).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const V012_ROUTES = [
  'DELETE /admin/backups/{id}',
  'DELETE /admin/keys/{key_id}',
  'DELETE /admin/namespaces/{namespace}',
  'DELETE /admin/quotas/{namespace}',
  'DELETE /admin/slow-queries',
  'DELETE /v1/memories/forget/batch',
  'DELETE /v1/namespaces/{namespace}',
  'DELETE /v1/namespaces/{namespace}/attachments/{reference}',
  'DELETE /v1/namespaces/{namespace}/keys/{key_id}',
  'GET /admin/autopilot/status',
  'GET /admin/background-activity',
  'GET /admin/backups',
  'GET /admin/backups/restore/{restore_id}',
  'GET /admin/backups/schedule',
  'GET /admin/backups/{id}',
  'GET /admin/backups/{id}/download',
  'GET /admin/cache/stats',
  'GET /admin/cluster/maintenance',
  'GET /admin/cluster/nodes',
  'GET /admin/cluster/replication',
  'GET /admin/cluster/shards',
  'GET /admin/cluster/status',
  'GET /admin/config',
  'GET /admin/decay/config',
  'GET /admin/decay/stats',
  'GET /admin/encryption/status',
  'GET /admin/indexes/stats',
  'GET /admin/keys',
  'GET /admin/keys/{key_id}',
  'GET /admin/keys/{key_id}/usage',
  'GET /admin/memory-type-stats',
  'GET /admin/namespaces',
  'GET /admin/quotas',
  'GET /admin/quotas/default',
  'GET /admin/quotas/{namespace}',
  'GET /admin/reembed/migration',
  'GET /admin/reembed/static-count',
  'GET /admin/slow-queries',
  'GET /admin/slow-queries/summary',
  'GET /admin/storage/tiers',
  'GET /admin/ttl/stats',
  'GET /admin/vectors/{namespace}/export',
  'GET /admin/vectors/{namespace}/{id}/versions',
  'GET /admin/vectors/{namespace}/{id}/versions/{version}',
  'GET /debug/config',
  'GET /health',
  'GET /health/live',
  'GET /health/ready',
  'GET /metrics',
  'GET /ops/diagnostics',
  'GET /ops/events',
  'GET /ops/jobs',
  'GET /ops/jobs/{id}',
  'GET /v1/agents',
  'GET /v1/agents/{agent_id}/consolidation/log',
  'GET /v1/agents/{agent_id}/feedback/summary',
  'GET /v1/agents/{agent_id}/graph/export',
  'GET /v1/agents/{agent_id}/memories',
  'GET /v1/agents/{agent_id}/sessions',
  'GET /v1/agents/{agent_id}/stats',
  'GET /v1/agents/{agent_id}/wake-up',
  'GET /v1/analytics/latency',
  'GET /v1/analytics/overview',
  'GET /v1/analytics/storage',
  'GET /v1/analytics/throughput',
  'GET /v1/audit',
  'GET /v1/audit/export',
  'GET /v1/audit/stream',
  'GET /v1/capabilities',
  'GET /v1/events/stream',
  'GET /v1/export',
  'GET /v1/feedback/health',
  'GET /v1/import/{job_id}/status',
  'GET /v1/knowledge/export',
  'GET /v1/knowledge/path',
  'GET /v1/knowledge/query',
  'GET /v1/kpis',
  'GET /v1/memories/{id}/graph',
  'GET /v1/memories/{id}/path',
  'GET /v1/memories/{memory_id}/feedback',
  'GET /v1/memory/entities/{id}',
  'GET /v1/memory/get/{id}',
  'GET /v1/namespaces',
  'GET /v1/namespaces/{namespace}',
  'GET /v1/namespaces/{namespace}/attachments',
  'GET /v1/namespaces/{namespace}/attachments/{reference}',
  'GET /v1/namespaces/{namespace}/attachments/{reference}/index/{job_id}',
  'GET /v1/namespaces/{namespace}/attachments/{reference}/transcribe/{job_id}',
  'GET /v1/namespaces/{namespace}/config',
  'GET /v1/namespaces/{namespace}/events',
  'GET /v1/namespaces/{namespace}/extractor',
  'GET /v1/namespaces/{namespace}/fulltext/stats',
  'GET /v1/namespaces/{namespace}/keys',
  'GET /v1/namespaces/{namespace}/keys/{key_id}/usage',
  'GET /v1/namespaces/{namespace}/memory_policy',
  'GET /v1/namespaces/{namespace}/records/{id}',
  'GET /v1/ops/metrics',
  'GET /v1/ops/stats',
  'GET /v1/sessions',
  'GET /v1/sessions/{id}',
  'GET /v1/sessions/{id}/memories',
  'PATCH /admin/slow-queries/config',
  'PATCH /v1/agents/{agent_id}/consolidation/config',
  'PATCH /v1/memories/{memory_id}/importance',
  'PATCH /v1/namespaces/{namespace}/config',
  'PATCH /v1/namespaces/{namespace}/extractor',
  'POST /admin/autopilot/trigger',
  'POST /admin/backups',
  'POST /admin/backups/restore',
  'POST /admin/backups/schedule',
  'POST /admin/backups/upload',
  'POST /admin/cache/clear',
  'POST /admin/cache/warm',
  'POST /admin/cluster/maintenance/disable',
  'POST /admin/cluster/maintenance/enable',
  'POST /admin/cluster/shards/rebalance',
  'POST /admin/encryption/keys/{key_id}/revoke-master',
  'POST /admin/encryption/reseal',
  'POST /admin/encryption/rotate-key',
  'POST /admin/fulltext/reindex',
  'POST /admin/indexes/rebuild',
  'POST /admin/keys',
  'POST /admin/keys/{key_id}/deactivate',
  'POST /admin/keys/{key_id}/rotate',
  'POST /admin/namespaces/migrate-dimensions',
  'POST /admin/namespaces/{namespace}/optimize',
  'POST /admin/quotas/{namespace}/check',
  'POST /admin/reembed/drain',
  'POST /admin/ttl/cleanup',
  'POST /admin/vectors/{namespace}/import',
  'POST /ops/compact',
  'POST /ops/shutdown',
  'POST /v1/agents/{agent_id}/compress',
  'POST /v1/agents/{agent_id}/consolidate',
  'POST /v1/extract',
  'POST /v1/import',
  'POST /v1/knowledge/deduplicate',
  'POST /v1/knowledge/graph',
  'POST /v1/knowledge/graph/full',
  'POST /v1/knowledge/network/cross-agent',
  'POST /v1/knowledge/summarize',
  'POST /v1/memories/extract',
  'POST /v1/memories/recall/batch',
  'POST /v1/memories/store/batch',
  'POST /v1/memories/{id}/links',
  'POST /v1/memories/{memory_id}/feedback',
  'POST /v1/memory/consolidate',
  'POST /v1/memory/feedback',
  'POST /v1/memory/forget',
  'POST /v1/memory/importance',
  'POST /v1/memory/recall',
  'POST /v1/memory/search',
  'POST /v1/memory/store',
  'POST /v1/namespaces',
  'POST /v1/namespaces/{namespace}/aggregate',
  'POST /v1/namespaces/{namespace}/attachments',
  'POST /v1/namespaces/{namespace}/attachments/{reference}/index',
  'POST /v1/namespaces/{namespace}/attachments/{reference}/transcribe',
  'POST /v1/namespaces/{namespace}/batch-query',
  'POST /v1/namespaces/{namespace}/batch-query-text',
  'POST /v1/namespaces/{namespace}/cache/warm',
  'POST /v1/namespaces/{namespace}/explain',
  'POST /v1/namespaces/{namespace}/export',
  'POST /v1/namespaces/{namespace}/fulltext/delete',
  'POST /v1/namespaces/{namespace}/fulltext/index',
  'POST /v1/namespaces/{namespace}/fulltext/search',
  'POST /v1/namespaces/{namespace}/hybrid',
  'POST /v1/namespaces/{namespace}/keys',
  'POST /v1/namespaces/{namespace}/multi-vector',
  'POST /v1/namespaces/{namespace}/query',
  'POST /v1/namespaces/{namespace}/query-text',
  'POST /v1/namespaces/{namespace}/records',
  'POST /v1/namespaces/{namespace}/unified-query',
  'POST /v1/namespaces/{namespace}/upsert-columns',
  'POST /v1/namespaces/{namespace}/upsert-text',
  'POST /v1/namespaces/{namespace}/vectors',
  'POST /v1/namespaces/{namespace}/vectors/bulk-delete',
  'POST /v1/namespaces/{namespace}/vectors/bulk-update',
  'POST /v1/namespaces/{namespace}/vectors/count',
  'POST /v1/namespaces/{namespace}/vectors/delete',
  'POST /v1/namespaces/{namespace}/warm',
  'POST /v1/route',
  'POST /v1/sessions/start',
  'POST /v1/sessions/{id}/end',
  'PUT /admin/autopilot/config',
  'PUT /admin/config',
  'PUT /admin/decay/config',
  'PUT /admin/quotas/default',
  'PUT /admin/quotas/{namespace}',
  'PUT /v1/memory/update/{id}',
  'PUT /v1/namespaces/{namespace}',
  'PUT /v1/namespaces/{namespace}/config',
  'PUT /v1/namespaces/{namespace}/memory_policy',
];

const known = new Set(
  V012_ROUTES.map((r) => {
    const [method, path] = r.split(' ');
    return `${method} ${path.replace(/\{[^}]*\}/g, '{}')}`;
  })
);

function served(method: string, path: string): boolean {
  if (known.has(`${method} ${path}`)) return true;
  // /v1/admin/* mirrors /admin/*
  if (path.startsWith('/v1/admin/')) return known.has(`${method} ${path.slice(3)}`);
  return false;
}

function sdkCalls(): Array<{ method: string; path: string }> {
  const src = readFileSync(join(__dirname, 'client.ts'), 'utf8');
  const out: Array<{ method: string; path: string }> = [];
  const re = /this\.request(?:<[^(]*?>)?\(\s*'(GET|POST|PUT|PATCH|DELETE)',\s*([`'])((?:(?!\2).)*)\2/gs;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const path = m[3]
      .replace(/\$\{this\.attachmentsPath\([^)]*\)\}/g, '/v1/namespaces/{}/attachments')
      .replace(/\$\{qs[^}]*\}?.*$/s, '')
      .replace(/\$\{[^}]*\}/g, '{}')
      .split('?')[0];
    out.push({ method: m[1], path: path.replace(/\{\}\{\}$/, '{}') });
  }
  return out;
}

describe('SDK endpoints exist in the v0.12.0 router', () => {
  const calls = sdkCalls();

  it('finds the SDK request calls', () => {
    expect(calls.length).toBeGreaterThan(150);
  });

  it('every call matches a served route', () => {
    const missing = calls.filter((c) => !served(c.method, c.path)).map((c) => `${c.method} ${c.path}`);
    expect(missing).toEqual([]);
  });

  it('no longer calls the routes the server never served', () => {
    const paths = calls.map((c) => `${c.method} ${c.path}`);
    for (const dead of [
      'PUT /v1/admin/quotas',
      'POST /v1/audit/export',
      'GET /v1/extract/providers',
      'POST /v1/namespaces/{}/fetch',
      'POST /v1/namespaces/{}/flush',
      'POST /v1/namespaces/{}/compact',
      'GET /v1/namespaces/{}/stats',
      'POST /v1/admin/namespaces/{}/ttl',
    ]) {
      expect(paths).not.toContain(dead);
    }
  });
});
