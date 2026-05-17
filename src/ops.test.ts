/**
 * Tests for DakeraClient Ops Methods
 * Covers: diagnostics, jobs, compact, shutdown, fulltextStats, fulltextDelete,
 *         routeQuery, importJobStatus
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

describe('Ops Methods', () => {
  let client: DakeraClient;

  beforeEach(() => {
    client = new DakeraClient({ baseUrl: 'http://localhost:3000' });
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Diagnostics & Jobs
  // ---------------------------------------------------------------------------

  describe('opsDiagnostics', () => {
    it('should get system diagnostics', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        cpu_usage_percent: 35.2,
        memory_usage_bytes: 1073741824,
        disk_usage_bytes: 10737418240,
        open_file_descriptors: 256,
        goroutines: 42,
        uptime_seconds: 86400,
      }));

      const result = await client.opsDiagnostics();

      expect(result.cpu_usage_percent).toBe(35.2);
      expect(result.uptime_seconds).toBe(86400);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/ops/diagnostics');
      expect(opts.method).toBe('GET');
    });
  });

  describe('opsListJobs', () => {
    it('should list background jobs', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([
        { id: 'job-1', type: 'compaction', status: 'running', progress: 50, started_at: 1700000000 },
        { id: 'job-2', type: 'reindex', status: 'completed', progress: 100, started_at: 1700000000 },
      ]));

      const result = await client.opsListJobs();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('job-1');
      expect(result[0].status).toBe('running');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/ops/jobs');
      expect(opts.method).toBe('GET');
    });

    it('should return empty array when no jobs', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([]));

      const result = await client.opsListJobs();

      expect(result).toHaveLength(0);
    });
  });

  describe('opsGetJob', () => {
    it('should get a specific job by ID', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        id: 'job-1',
        type: 'compaction',
        status: 'running',
        progress: 75,
        started_at: 1700000000,
        namespace: 'ns-a',
      }));

      const result = await client.opsGetJob('job-1');

      expect(result.id).toBe('job-1');
      expect(result.progress).toBe(75);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/ops/jobs/job-1');
      expect(opts.method).toBe('GET');
    });
  });

  describe('opsCompact', () => {
    it('should trigger compaction with request', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        job_id: 'job-3',
        status: 'started',
        namespace: 'ns-a',
      }));

      const result = await client.opsCompact({ namespace: 'ns-a' });

      expect(result.job_id).toBe('job-3');
      expect(result.status).toBe('started');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/ops/compact');
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body as string);
      expect(body.namespace).toBe('ns-a');
    });

    it('should trigger compaction with no request', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ job_id: 'job-4', status: 'started' }));

      const result = await client.opsCompact();

      expect(result.job_id).toBe('job-4');
    });
  });

  describe('opsShutdown', () => {
    it('should request graceful shutdown', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'Shutdown initiated', grace_period_s: 30 }));

      const result = await client.opsShutdown();

      expect(result.message).toBe('Shutdown initiated');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/ops/shutdown');
      expect(opts.method).toBe('POST');
    });
  });

  // ---------------------------------------------------------------------------
  // Fulltext Operations (Phase 3)
  // ---------------------------------------------------------------------------

  describe('fulltextStats', () => {
    it('should get fulltext index statistics', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        namespace: 'ns-a',
        document_count: 5000,
        total_terms: 125000,
        avg_document_length: 250,
        index_size_bytes: 1048576,
      }));

      const result = await client.fulltextStats('ns-a');

      expect(result.namespace).toBe('ns-a');
      expect(result.document_count).toBe(5000);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/namespaces/ns-a/fulltext/stats');
      expect(opts.method).toBe('GET');
    });
  });

  describe('fulltextDelete', () => {
    it('should delete documents from fulltext index', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        deleted_count: 3,
        namespace: 'ns-a',
      }));

      const result = await client.fulltextDelete('ns-a', ['doc-1', 'doc-2', 'doc-3']);

      expect(result.deleted_count).toBe(3);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/namespaces/ns-a/fulltext/delete');
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body as string);
      expect(body.ids).toEqual(['doc-1', 'doc-2', 'doc-3']);
    });
  });

  // ---------------------------------------------------------------------------
  // Route & Import (Phase 3)
  // ---------------------------------------------------------------------------

  describe('routeQuery', () => {
    it('should route a query to best namespace', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        selected_namespace: 'ns-a',
        confidence: 0.92,
        candidates: [
          { namespace: 'ns-a', score: 0.92 },
          { namespace: 'ns-b', score: 0.45 },
        ],
      }));

      const result = await client.routeQuery({ query: 'machine learning basics', top_k: 3 });

      expect(result.selected_namespace).toBe('ns-a');
      expect(result.confidence).toBe(0.92);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/route');
      expect(opts.method).toBe('POST');
    });
  });

  describe('importJobStatus', () => {
    it('should check import job progress', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        job_id: 'imp-1',
        status: 'running',
        total_records: 10000,
        processed_records: 7500,
        failed_records: 12,
        progress_percent: 75,
      }));

      const result = await client.importJobStatus('imp-1');

      expect(result.job_id).toBe('imp-1');
      expect(result.status).toBe('running');
      expect(result.progress_percent).toBe(75);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/import/imp-1/status');
      expect(opts.method).toBe('GET');
    });
  });
});
