/**
 * Tests for DakeraClient Admin Methods
 * Covers: backups, quotas, maintenance, cluster, slow queries, storage, TTL, migrations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DakeraClient } from './client';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  };
}

function errorResponse(status: number, error: string) {
  return {
    ok: false,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ error }),
  };
}

describe('Admin Methods', () => {
  let client: DakeraClient;

  beforeEach(() => {
    client = new DakeraClient({ baseUrl: 'http://localhost:3000' });
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Backups
  // ---------------------------------------------------------------------------

  describe('adminListBackups', () => {
    it('should list all backups', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        backups: [
          { id: 'bk-1', created_at: 1700000000, size_bytes: 1024, status: 'completed' },
          { id: 'bk-2', created_at: 1700001000, size_bytes: 2048, status: 'completed' },
        ],
        total: 2,
      }));

      const result = await client.adminListBackups();

      expect(result.backups).toHaveLength(2);
      expect(result.backups[0].id).toBe('bk-1');
      expect(result.total).toBe(2);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/admin/backups');
      expect(opts.method).toBe('GET');
    });

    it('should throw on 403', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(403, 'Admin scope required'));
      await expect(client.adminListBackups()).rejects.toThrow('Admin scope required');
    });
  });

  describe('adminCreateBackup', () => {
    it('should create a backup', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        id: 'bk-new',
        status: 'in_progress',
        created_at: 1700002000,
      }));

      const result = await client.adminCreateBackup({ label: 'pre-deploy', namespaces: ['ns-a'] });

      expect(result.id).toBe('bk-new');
      expect(result.status).toBe('in_progress');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/admin/backups');
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body as string);
      expect(body.label).toBe('pre-deploy');
      expect(body.namespaces).toEqual(['ns-a']);
    });
  });

  describe('adminGetBackup', () => {
    it('should get backup details by ID', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        id: 'bk-1',
        created_at: 1700000000,
        size_bytes: 1024,
        status: 'completed',
        namespaces: ['ns-a', 'ns-b'],
      }));

      const result = await client.adminGetBackup('bk-1');

      expect(result.id).toBe('bk-1');
      expect(result.status).toBe('completed');
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/admin/backups/bk-1');
    });
  });

  describe('adminDeleteBackup', () => {
    it('should delete a backup', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ success: true }));

      const result = await client.adminDeleteBackup('bk-1');

      expect(result.success).toBe(true);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/admin/backups/bk-1');
      expect(opts.method).toBe('DELETE');
    });
  });

  describe('adminGetBackupSchedule', () => {
    it('should get backup schedule', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        enabled: true,
        cron: '0 2 * * *',
        retention_days: 30,
        max_backups: 10,
      }));

      const result = await client.adminGetBackupSchedule();

      expect(result.enabled).toBe(true);
      expect(result.cron).toBe('0 2 * * *');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/admin/backups/schedule');
      expect(opts.method).toBe('GET');
    });
  });

  describe('adminUpdateBackupSchedule', () => {
    it('should update backup schedule', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        enabled: true,
        cron: '0 3 * * *',
        retention_days: 14,
        max_backups: 5,
      }));

      const result = await client.adminUpdateBackupSchedule({
        cron: '0 3 * * *',
        retention_days: 14,
      });

      expect(result.cron).toBe('0 3 * * *');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/admin/backups/schedule');
      expect(opts.method).toBe('POST');
    });
  });

  describe('adminRestoreBackup', () => {
    it('should initiate a restore from backup', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        restore_id: 'rst-1',
        status: 'in_progress',
        backup_id: 'bk-1',
      }));

      const result = await client.adminRestoreBackup({ backup_id: 'bk-1' });

      expect(result.restore_id).toBe('rst-1');
      expect(result.status).toBe('in_progress');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/admin/backups/restore');
      expect(opts.method).toBe('POST');
    });
  });

  describe('adminGetRestoreStatus', () => {
    it('should get restore operation status', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        restore_id: 'rst-1',
        status: 'completed',
        backup_id: 'bk-1',
        progress_percent: 100,
      }));

      const result = await client.adminGetRestoreStatus('rst-1');

      expect(result.restore_id).toBe('rst-1');
      expect(result.status).toBe('completed');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/admin/backups/restore/rst-1');
      expect(opts.method).toBe('GET');
    });
  });

  describe('adminDownloadBackup', () => {
    it('should download backup as binary', async () => {
      const mockBuffer = new ArrayBuffer(8);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/octet-stream' }),
        arrayBuffer: async () => mockBuffer,
      });

      const result = await client.adminDownloadBackup('bk-1');

      expect(result).toBe(mockBuffer);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/admin/backups/bk-1/download');
    });

    it('should throw on failed download', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers(),
      });

      await expect(client.adminDownloadBackup('bk-missing')).rejects.toThrow('Download failed: 404');
    });
  });

  describe('adminUploadBackup', () => {
    it('should upload a backup archive', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ id: 'bk-uploaded', status: 'completed' }),
      });

      const data = new Uint8Array([1, 2, 3, 4]);
      const result = await client.adminUploadBackup(data);

      expect(result.id).toBe('bk-uploaded');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/admin/backups/upload');
      expect(opts.method).toBe('POST');
      expect(opts.headers['Content-Type']).toBe('application/gzip');
    });

    it('should throw on failed upload', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 413,
        headers: new Headers(),
      });

      const data = new ArrayBuffer(8);
      await expect(client.adminUploadBackup(data)).rejects.toThrow('Upload failed: 413');
    });
  });

  // ---------------------------------------------------------------------------
  // Quotas
  // ---------------------------------------------------------------------------

  describe('adminListQuotas', () => {
    it('should list all namespace quotas', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        quotas: [
          { namespace: 'ns-a', max_vectors: 100000, used_vectors: 5000 },
          { namespace: 'ns-b', max_vectors: 50000, used_vectors: 2000 },
        ],
      }));

      const result = await client.adminListQuotas();

      expect(result.quotas).toHaveLength(2);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/admin/quotas');
      expect(opts.method).toBe('GET');
    });
  });

  describe('adminGetDefaultQuota', () => {
    it('should get default quota configuration', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        max_vectors: 1000000,
        max_namespaces: 100,
        max_queries_per_second: 500,
      }));

      const result = await client.adminGetDefaultQuota();

      expect(result.max_vectors).toBe(1000000);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/admin/quotas/default');
      expect(opts.method).toBe('GET');
    });
  });

  describe('adminSetDefaultQuota', () => {
    it('should set default quota', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ success: true, message: 'Default quota updated' }));

      const result = await client.adminSetDefaultQuota({ max_vectors: 2000000 });

      expect(result.success).toBe(true);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/admin/quotas/default');
      expect(opts.method).toBe('PUT');
    });
  });

  describe('adminGetQuota', () => {
    it('should get quota for a namespace', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        namespace: 'ns-a',
        max_vectors: 100000,
        used_vectors: 5000,
        usage_percent: 5.0,
      }));

      const result = await client.adminGetQuota('ns-a');

      expect(result.namespace).toBe('ns-a');
      expect(result.usage_percent).toBe(5.0);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/admin/quotas/ns-a');
    });
  });

  describe('adminSetQuota', () => {
    it('should set quota for a namespace', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ success: true, message: 'Quota set' }));

      const result = await client.adminSetQuota('ns-a', { max_vectors: 200000 });

      expect(result.success).toBe(true);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/admin/quotas/ns-a');
      expect(opts.method).toBe('PUT');
    });
  });

  describe('adminDeleteQuota', () => {
    it('should delete quota for a namespace', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ success: true }));

      const result = await client.adminDeleteQuota('ns-a');

      expect(result.success).toBe(true);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/admin/quotas/ns-a');
      expect(opts.method).toBe('DELETE');
    });
  });

  describe('adminCheckQuota', () => {
    it('should check if operation would exceed quota', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        allowed: true,
        remaining: 95000,
        usage_after: 5100,
      }));

      const result = await client.adminCheckQuota('ns-a', { operation: 'upsert', count: 100 });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(95000);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/admin/quotas/ns-a/check');
      expect(opts.method).toBe('POST');
    });

    it('should return allowed=false when quota would be exceeded', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        allowed: false,
        remaining: 0,
        usage_after: 100001,
      }));

      const result = await client.adminCheckQuota('ns-a', { operation: 'upsert', count: 100000 });

      expect(result.allowed).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Maintenance
  // ---------------------------------------------------------------------------

  describe('adminMaintenanceStatus', () => {
    it('should get maintenance mode status', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        enabled: false,
        last_enabled_at: null,
        reason: null,
      }));

      const result = await client.adminMaintenanceStatus();

      expect(result.enabled).toBe(false);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/admin/cluster/maintenance');
      expect(opts.method).toBe('GET');
    });
  });

  describe('adminEnableMaintenance', () => {
    it('should enable maintenance mode', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        enabled: true,
        reason: 'Rolling upgrade',
        enabled_at: 1700000000,
      }));

      const result = await client.adminEnableMaintenance({ reason: 'Rolling upgrade' });

      expect(result.enabled).toBe(true);
      expect(result.reason).toBe('Rolling upgrade');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/admin/cluster/maintenance/enable');
      expect(opts.method).toBe('POST');
    });
  });

  describe('adminDisableMaintenance', () => {
    it('should disable maintenance mode', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        enabled: false,
        reason: null,
      }));

      const result = await client.adminDisableMaintenance();

      expect(result.enabled).toBe(false);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/admin/cluster/maintenance/disable');
      expect(opts.method).toBe('POST');
    });
  });

  // ---------------------------------------------------------------------------
  // Cluster — Replication & Shards
  // ---------------------------------------------------------------------------

  describe('adminClusterReplication', () => {
    it('should get cluster replication status', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        replication_factor: 3,
        in_sync_replicas: 3,
        out_of_sync_replicas: 0,
        lag_ms: 0,
      }));

      const result = await client.adminClusterReplication();

      expect(result.replication_factor).toBe(3);
      expect(result.in_sync_replicas).toBe(3);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/admin/cluster/replication');
      expect(opts.method).toBe('GET');
    });
  });

  describe('adminListShards', () => {
    it('should list all shards', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        shards: [
          { id: 'shard-0', node_id: 'node-1', status: 'active', vector_count: 5000 },
          { id: 'shard-1', node_id: 'node-2', status: 'active', vector_count: 4800 },
        ],
        total: 2,
      }));

      const result = await client.adminListShards();

      expect(result.shards).toHaveLength(2);
      expect(result.shards[0].id).toBe('shard-0');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/admin/cluster/shards');
      expect(opts.method).toBe('GET');
    });
  });

  describe('adminRebalanceShards', () => {
    it('should rebalance shards', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        status: 'rebalancing',
        moves: 3,
        estimated_time_s: 120,
      }));

      const result = await client.adminRebalanceShards({ strategy: 'even' });

      expect(result.status).toBe('rebalancing');
      expect(result.moves).toBe(3);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/admin/cluster/shards/rebalance');
      expect(opts.method).toBe('POST');
    });

    it('should rebalance with no request body', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ status: 'rebalancing', moves: 0 }));

      const result = await client.adminRebalanceShards();

      expect(result.status).toBe('rebalancing');
    });
  });

  // ---------------------------------------------------------------------------
  // Slow Queries
  // ---------------------------------------------------------------------------

  describe('adminListSlowQueries', () => {
    it('should list slow queries without params', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([
        { query_id: 'q1', duration_ms: 500, namespace: 'ns-a', query_type: 'vector_search' },
        { query_id: 'q2', duration_ms: 800, namespace: 'ns-b', query_type: 'hybrid_search' },
      ]));

      const result = await client.adminListSlowQueries();

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('query_id', 'q1');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/admin/slow-queries');
      expect(opts.method).toBe('GET');
    });

    it('should list slow queries with filter params', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([]));

      await client.adminListSlowQueries({ namespace: 'ns-a', limit: 5 });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('namespace=ns-a');
      expect(url).toContain('limit=5');
    });
  });

  describe('adminSlowQuerySummary', () => {
    it('should get slow query summary', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        total_slow_queries: 42,
        avg_duration_ms: 350,
        top_namespaces: ['ns-a', 'ns-b'],
      }));

      const result = await client.adminSlowQuerySummary();

      expect(result.total_slow_queries).toBe(42);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/admin/slow-queries/summary');
      expect(opts.method).toBe('GET');
    });
  });

  describe('adminClearSlowQueries', () => {
    it('should clear all slow queries', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ cleared: 42 }));

      const result = await client.adminClearSlowQueries();

      expect(result.cleared).toBe(42);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/admin/slow-queries');
      expect(url).not.toContain('namespace=');
      expect(opts.method).toBe('DELETE');
    });

    it('should clear slow queries for a specific namespace', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ cleared: 10 }));

      await client.adminClearSlowQueries('ns-a');

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('namespace=ns-a');
    });
  });

  describe('adminUpdateSlowQueryConfig', () => {
    it('should update slow query configuration', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        threshold_ms: 200,
        max_log_size: 1000,
      }));

      const result = await client.adminUpdateSlowQueryConfig({ threshold_ms: 200, max_log_size: 1000 });

      expect(result.threshold_ms).toBe(200);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/admin/slow-queries/config');
      expect(opts.method).toBe('PATCH');
    });
  });

  // ---------------------------------------------------------------------------
  // Storage, TTL, Background, Memory Type Stats, Migrate Dimensions
  // ---------------------------------------------------------------------------

  describe('adminStorageTierOverview', () => {
    it('should get storage tier overview', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        tiers: [
          { name: 'hot', size_bytes: 1048576, vector_count: 5000 },
          { name: 'warm', size_bytes: 2097152, vector_count: 10000 },
        ],
      }));

      const result = await client.adminStorageTierOverview();

      expect(result.tiers).toHaveLength(2);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/admin/storage/tiers');
      expect(opts.method).toBe('GET');
    });
  });

  describe('adminBackgroundActivity', () => {
    it('should get current background activity', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        active_jobs: 2,
        jobs: [
          { type: 'compaction', namespace: 'ns-a', progress: 45 },
          { type: 'reindex', namespace: 'ns-b', progress: 80 },
        ],
      }));

      const result = await client.adminBackgroundActivity();

      expect(result.active_jobs).toBe(2);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/admin/background-activity');
      expect(opts.method).toBe('GET');
    });
  });

  describe('adminMemoryTypeStats', () => {
    it('should get memory type distribution stats', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        episodic: 500,
        semantic: 300,
        procedural: 100,
        total: 900,
      }));

      const result = await client.adminMemoryTypeStats();

      expect(result.episodic).toBe(500);
      expect(result.total).toBe(900);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/admin/memory-type-stats');
      expect(opts.method).toBe('GET');
    });
  });

  describe('adminTtlStats', () => {
    it('should get TTL statistics', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        total_with_ttl: 200,
        expired_pending_cleanup: 15,
        namespaces: ['ns-a', 'ns-b'],
      }));

      const result = await client.adminTtlStats();

      expect(result.total_with_ttl).toBe(200);
      expect(result.expired_pending_cleanup).toBe(15);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/admin/ttl/stats');
      expect(opts.method).toBe('GET');
    });
  });

  describe('adminMigrateNamespaceDimensions', () => {
    it('should migrate namespace dimensions', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        status: 'completed',
        migrated_count: 5000,
        namespace: 'ns-a',
        old_dimension: 384,
        new_dimension: 768,
      }));

      const result = await client.adminMigrateNamespaceDimensions({
        namespace: 'ns-a',
        new_dimension: 768,
      });

      expect(result.status).toBe('completed');
      expect(result.migrated_count).toBe(5000);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/admin/namespaces/migrate-dimensions');
      expect(opts.method).toBe('POST');
    });

    it('should work with no request body', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ status: 'no_op' }));

      const result = await client.adminMigrateNamespaceDimensions();

      expect(result.status).toBe('no_op');
    });
  });
});
