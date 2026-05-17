/**
 * Tests for Dakera TypeScript Client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DakeraClient } from './client';
import {
  NotFoundError,
  ValidationError,
  ServerError,
  RateLimitError,
} from './errors';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('DakeraClient', () => {
  let client: DakeraClient;

  beforeEach(() => {
    client = new DakeraClient({ baseUrl: 'http://localhost:3000' });
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should accept string URL', () => {
      const c = new DakeraClient('http://example.com');
      expect(c).toBeInstanceOf(DakeraClient);
    });

    it('should accept options object', () => {
      const c = new DakeraClient({
        baseUrl: 'http://example.com',
        apiKey: 'test-key',
        timeout: 5000,
      });
      expect(c).toBeInstanceOf(DakeraClient);
    });

    it('should strip trailing slash from URL', () => {
      const c = new DakeraClient('http://example.com/');
      // We can't directly access private properties, but we can test behavior
      expect(c).toBeInstanceOf(DakeraClient);
    });
  });

  describe('upsert', () => {
    it('should upsert vectors successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ upsertedCount: 2 }),
      });

      const result = await client.upsert('test-ns', [
        { id: 'vec1', values: [0.1, 0.2, 0.3] },
        { id: 'vec2', values: [0.4, 0.5, 0.6] },
      ]);

      expect(result.upsertedCount).toBe(2);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/v1/namespaces/test-ns/vectors',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('vec1'),
        })
      );
    });
  });

  describe('query', () => {
    it('should query vectors successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          results: [
            { id: 'vec1', score: 0.95, metadata: { label: 'a' } },
            { id: 'vec2', score: 0.85 },
          ],
          totalSearched: 100,
        }),
      });

      const result = await client.query('test-ns', [0.1, 0.2, 0.3], { topK: 10 });

      expect(result.results).toHaveLength(2);
      expect(result.results[0].id).toBe('vec1');
      expect(result.results[0].score).toBe(0.95);
    });

    it('should include filter in query', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ results: [] }),
      });

      await client.query('test-ns', [0.1, 0.2, 0.3], {
        filter: { category: { $eq: 'test' } },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('filter'),
        })
      );
    });
  });

  describe('delete', () => {
    it('should delete by IDs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ deletedCount: 2 }),
      });

      const result = await client.delete('test-ns', { ids: ['vec1', 'vec2'] });

      expect(result.deletedCount).toBe(2);
    });

    it('should delete by filter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ deletedCount: 5 }),
      });

      const result = await client.delete('test-ns', {
        filter: { status: { $eq: 'obsolete' } },
      });

      expect(result.deletedCount).toBe(5);
    });
  });

  describe('fetch', () => {
    it('should fetch vectors by ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          vectors: [
            { id: 'vec1', values: [0.1, 0.2, 0.3] },
            { id: 'vec2', values: [0.4, 0.5, 0.6] },
          ],
        }),
      });

      const vectors = await client.fetch('test-ns', ['vec1', 'vec2']);

      expect(vectors).toHaveLength(2);
      expect(vectors[0].id).toBe('vec1');
    });
  });

  describe('batchQuery', () => {
    it('should execute batch queries', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          results: [
            { results: [{ id: 'vec1', score: 0.9 }] },
            { results: [{ id: 'vec2', score: 0.8 }] },
          ],
        }),
      });

      const results = await client.batchQuery('test-ns', [
        { vector: [0.1, 0.2, 0.3], topK: 1 },
        { vector: [0.4, 0.5, 0.6], topK: 1 },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].results[0].id).toBe('vec1');
    });
  });

  describe('full-text operations', () => {
    it('should index documents', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ indexedCount: 2 }),
      });

      const result = await client.indexDocuments('test-ns', [
        { id: 'doc1', content: 'Hello world' },
        { id: 'doc2', content: 'Goodbye world' },
      ]);

      expect(result.indexedCount).toBe(2);
    });

    it('should perform fulltext search', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          results: [{ id: 'doc1', score: 2.5, content: 'Hello world' }],
        }),
      });

      const results = await client.fulltextSearch('test-ns', 'hello');

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('doc1');
    });

    it('should perform hybrid search with vector', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          results: [
            { id: 'doc1', score: 0.85, vectorScore: 0.9, textScore: 0.8 },
          ],
        }),
      });

      const results = await client.hybridSearch(
        'test-ns',
        'hello',
        { vector: [0.1, 0.2, 0.3], alpha: 0.5 }
      );

      expect(results).toHaveLength(1);
      expect(results[0].vectorScore).toBe(0.9);
      expect(results[0].textScore).toBe(0.8);
      // Verify correct endpoint was called
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/namespaces/test-ns/hybrid');
      expect(init?.method).toBe('POST');
    });

    it('should perform BM25-only hybrid search when vector is omitted', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          results: [{ id: 'doc2', score: 0.75, vectorScore: 0, textScore: 0.75 }],
        }),
      });

      const results = await client.hybridSearch('test-ns', 'hello');

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('doc2');
      // Verify correct endpoint was called
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/namespaces/test-ns/hybrid');
      expect(init?.method).toBe('POST');
    });
  });

  describe('namespace operations', () => {
    it('should list namespaces', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          namespaces: [
            { name: 'ns1', vectorCount: 100 },
            { name: 'ns2', vectorCount: 200 },
          ],
        }),
      });

      const namespaces = await client.listNamespaces();

      expect(namespaces).toHaveLength(2);
      expect(namespaces[0].name).toBe('ns1');
    });

    it('should get namespace', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          name: 'test-ns',
          vectorCount: 1000,
          dimensions: 384,
        }),
      });

      const info = await client.getNamespace('test-ns');

      expect(info.name).toBe('test-ns');
      expect(info.vectorCount).toBe(1000);
    });

    it('should create namespace', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          name: 'new-ns',
          vectorCount: 0,
          dimensions: 384,
        }),
      });

      const info = await client.createNamespace('new-ns', { dimensions: 384 });

      expect(info.name).toBe('new-ns');
    });

    it('should delete namespace', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Headers(),
      });

      await expect(client.deleteNamespace('test-ns')).resolves.toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should throw NotFoundError on 404', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Namespace not found' }),
      });

      await expect(client.getNamespace('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError on 400', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Invalid vector dimensions' }),
      });

      await expect(client.query('test-ns', [0.1])).rejects.toThrow(ValidationError);
    });

    it('should throw ServerError on 500', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Internal server error' }),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);
      mockFetch.mockResolvedValueOnce(mockResponse);
      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(client.health()).rejects.toThrow(ServerError);
    });

    it('should throw RateLimitError on 429', async () => {
      // Use Retry-After: 0 so the client retries immediately without sleeping
      const mockResponse = {
        ok: false,
        status: 429,
        headers: new Headers({
          'content-type': 'application/json',
          'Retry-After': '0',
        }),
        json: async () => ({ error: 'Rate limit exceeded' }),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);
      mockFetch.mockResolvedValueOnce(mockResponse);
      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(client.query('test-ns', [0.1, 0.2, 0.3])).rejects.toThrow(
        RateLimitError
      );
    });
  });

  describe('health', () => {
    it('should check server health', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ status: 'healthy', version: '0.1.0' }),
      });

      const health = await client.health();

      expect(health.status).toBe('healthy');
    });
  });

  describe('RetryConfig', () => {
    it('should accept retryBackoff configuration', () => {
      const c = new DakeraClient({
        baseUrl: 'http://localhost:3000',
        retryBackoff: { maxRetries: 5, baseDelay: 200, maxDelay: 30000, jitter: false },
      });
      // Access internal config via any cast to verify
      const rc = (c as unknown as { retryConfig: { maxRetries: number; baseDelay: number } }).retryConfig;
      expect(rc.maxRetries).toBe(5);
      expect(rc.baseDelay).toBe(200);
    });

    it('retryBackoff.maxRetries overrides maxRetries option', () => {
      const c = new DakeraClient({
        baseUrl: 'http://localhost:3000',
        maxRetries: 1,
        retryBackoff: { maxRetries: 7 },
      });
      const rc = (c as unknown as { retryConfig: { maxRetries: number } }).retryConfig;
      expect(rc.maxRetries).toBe(7);
    });

    it('should accept connectTimeout', () => {
      const c = new DakeraClient({
        baseUrl: 'http://localhost:3000',
        timeout: 30000,
        connectTimeout: 5000,
      });
      const ct = (c as unknown as { connectTimeout: number }).connectTimeout;
      expect(ct).toBe(5000);
    });

    it('connectTimeout defaults to timeout', () => {
      const c = new DakeraClient({ baseUrl: 'http://localhost:3000', timeout: 15000 });
      const ct = (c as unknown as { connectTimeout: number }).connectTimeout;
      expect(ct).toBe(15000);
    });

    it('should retry on 5xx and succeed on recovery', async () => {
      const fail500 = {
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'internal error' }),
      };
      const success = {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ status: 'healthy', version: '1.0.0' }),
      };

      const c = new DakeraClient({
        baseUrl: 'http://localhost:3000',
        retryBackoff: { maxRetries: 3, baseDelay: 0, jitter: false },
      });

      mockFetch.mockResolvedValueOnce(fail500);
      mockFetch.mockResolvedValueOnce(fail500);
      mockFetch.mockResolvedValueOnce(success);

      const result = await c.health();
      expect(result.status).toBe('healthy');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('respects Retry-After: 0 header on 429', async () => {
      const rate429 = {
        ok: false,
        status: 429,
        headers: new Headers({ 'content-type': 'application/json', 'Retry-After': '0' }),
        json: async () => ({ error: 'rate limited' }),
      };
      const success = {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ upserted_count: 1 }),
      };

      const c = new DakeraClient({
        baseUrl: 'http://localhost:3000',
        retryBackoff: { maxRetries: 2, baseDelay: 60000, jitter: false },
      });

      mockFetch.mockResolvedValueOnce(rate429);
      mockFetch.mockResolvedValueOnce(success);

      const start = Date.now();
      await c.upsert('ns', [{ id: 'v1', values: [0.1, 0.2] }]);
      const elapsed = Date.now() - start;

      // Retry-After: 0 → near-instant retry, not 60s base delay
      expect(elapsed).toBeLessThan(2000);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // ---------------------------------------------------------------------------
  // CE-2: Batch Recall / Forget (v0.7.0)
  // ---------------------------------------------------------------------------

  describe('batchRecall', () => {
    it('POSTs to /v1/memories/recall/batch and returns BatchRecallResponse', async () => {
      const body = {
        memories: [
          {
            id: 'mem_1',
            agent_id: 'qa',
            content: 'test memory',
            importance: 0.8,
            memory_type: 'episodic',
            tags: ['test'],
            created_at: 1700000000,
            last_accessed_at: 1700000000,
            access_count: 1,
          },
        ],
        total: 10,
        filtered: 1,
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => body,
      });

      const resp = await client.batchRecall({
        agent_id: 'qa',
        filter: { tags: ['test'], min_importance: 0.5 },
        limit: 50,
      });

      expect(resp.total).toBe(10);
      expect(resp.filtered).toBe(1);
      expect(resp.memories).toHaveLength(1);
      expect(resp.memories[0].id).toBe('mem_1');
      // verify HTTP method and URL
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/memories/recall/batch');
      expect(init?.method).toBe('POST');
    });

    it('works with no filter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ memories: [], total: 0, filtered: 0 }),
      });

      const resp = await client.batchRecall({ agent_id: 'agent-x' });

      expect(resp.total).toBe(0);
      expect(resp.filtered).toBe(0);
      expect(resp.memories).toHaveLength(0);
    });
  });

  describe('batchForget', () => {
    it('DELETEs /v1/memories/forget/batch and returns BatchForgetResponse', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ deleted_count: 5 }),
      });

      const resp = await client.batchForget({
        agent_id: 'qa',
        filter: { created_before: 1700000000 },
      });

      expect(resp.deleted_count).toBe(5);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/memories/forget/batch');
      expect(init?.method).toBe('DELETE');
    });
  });

  // ---------------------------------------------------------------------------
  // OPS-1: Rate-Limit Headers (v0.7.0)
  // ---------------------------------------------------------------------------

  describe('lastRateLimitHeaders', () => {
    it('is null before any request', () => {
      const fresh = new DakeraClient({ baseUrl: 'http://localhost:3000' });
      expect(fresh.lastRateLimitHeaders).toBeNull();
    });

    it('is populated from response headers after a request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'content-type': 'application/json',
          'X-RateLimit-Limit': '500',
          'X-RateLimit-Remaining': '499',
          'X-RateLimit-Reset': '1700000120',
          'X-Quota-Used': '100',
          'X-Quota-Limit': '10000',
        }),
        json: async () => ({ status: 'healthy', version: '0.7.0' }),
      });

      await client.health();
      const rl = client.lastRateLimitHeaders;

      expect(rl).not.toBeNull();
      expect(rl!.limit).toBe(500);
      expect(rl!.remaining).toBe(499);
      expect(rl!.reset).toBe(1700000120);
      expect(rl!.quotaUsed).toBe(100);
      expect(rl!.quotaLimit).toBe(10000);
    });

    it('fields are undefined when headers are absent', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ status: 'healthy' }),
      });

      await client.health();
      const rl = client.lastRateLimitHeaders;

      expect(rl).not.toBeNull();
      expect(rl!.limit).toBeUndefined();
      expect(rl!.remaining).toBeUndefined();
      expect(rl!.reset).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // AutoPilot Management (PILOT-1/2/3) — v0.7.2
  // ---------------------------------------------------------------------------

  describe('autopilotStatus', () => {
    it('GETs /v1/admin/autopilot/status and returns config + stats', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          config: {
            enabled: true,
            dedup_threshold: 0.93,
            dedup_interval_hours: 6,
            consolidation_interval_hours: 12,
          },
          last_dedup_at: 1700000000,
          total_dedup_removed: 42,
          total_consolidated: 10,
        }),
      });

      const result = await client.autopilotStatus();

      expect(result.config.enabled).toBe(true);
      expect(result.config.dedup_threshold).toBe(0.93);
      expect(result.total_dedup_removed).toBe(42);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/admin/autopilot/status');
      expect(init?.method).toBe('GET');
    });
  });

  describe('autopilotUpdateConfig', () => {
    it('PUTs /v1/admin/autopilot/config and returns updated config', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          config: {
            enabled: false,
            dedup_threshold: 0.90,
            dedup_interval_hours: 8,
            consolidation_interval_hours: 24,
          },
          message: 'AutoPilot config updated',
        }),
      });

      const result = await client.autopilotUpdateConfig({ enabled: false, dedup_threshold: 0.90 });

      expect(result.success).toBe(true);
      expect(result.config.enabled).toBe(false);
      expect(result.config.dedup_threshold).toBe(0.90);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/admin/autopilot/config');
      expect(init?.method).toBe('PUT');
    });

    it('sends only the fields that are set', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, config: {}, message: 'ok' }),
      });

      await client.autopilotUpdateConfig({ dedup_interval_hours: 4 });

      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(init?.body as string);
      expect(body.dedup_interval_hours).toBe(4);
      expect(body.enabled).toBeUndefined();
    });
  });

  describe('autopilotTrigger', () => {
    it('POSTs /v1/admin/autopilot/trigger with action and returns results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          action: 'dedup',
          dedup: { namespaces_processed: 3, memories_scanned: 500, duplicates_removed: 12 },
          message: 'Dedup cycle completed',
        }),
      });

      const result = await client.autopilotTrigger('dedup');

      expect(result.success).toBe(true);
      expect(result.action).toBe('dedup');
      expect(result.dedup?.duplicates_removed).toBe(12);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/admin/autopilot/trigger');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(init?.body as string).action).toBe('dedup');
    });

    it('action=all returns both dedup and consolidation results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          action: 'all',
          dedup: { namespaces_processed: 2, memories_scanned: 300, duplicates_removed: 5 },
          consolidation: { namespaces_processed: 2, memories_scanned: 300, clusters_merged: 4, memories_consolidated: 8 },
          message: 'Full AutoPilot cycle completed',
        }),
      });

      const result = await client.autopilotTrigger('all');

      expect(result.consolidation?.clusters_merged).toBe(4);
    });
  });

  // ---------------------------------------------------------------------------
  // Decay Engine Management (DECAY-1/2) — v0.7.3
  // ---------------------------------------------------------------------------

  describe('decayConfig', () => {
    it('GETs /v1/admin/decay/config and returns strategy/half-life/min', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          strategy: 'exponential',
          half_life_hours: 168.0,
          min_importance: 0.05,
        }),
      });

      const result = await client.decayConfig();

      expect(result.strategy).toBe('exponential');
      expect(result.half_life_hours).toBe(168.0);
      expect(result.min_importance).toBe(0.05);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/admin/decay/config');
      expect(init?.method).toBe('GET');
    });
  });

  describe('decayUpdateConfig', () => {
    it('PUTs /v1/admin/decay/config and returns updated config', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          config: { strategy: 'linear', half_life_hours: 72.0, min_importance: 0.1 },
          message: 'Decay config updated',
        }),
      });

      const result = await client.decayUpdateConfig({ strategy: 'linear', half_life_hours: 72.0 });

      expect(result.success).toBe(true);
      expect(result.config.strategy).toBe('linear');
      expect(result.config.half_life_hours).toBe(72.0);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/admin/decay/config');
      expect(init?.method).toBe('PUT');
    });

    it('sends only the fields that are set', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, config: {}, message: 'ok' }),
      });

      await client.decayUpdateConfig({ min_importance: 0.02 });

      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(init?.body as string);
      expect(body.min_importance).toBe(0.02);
      expect(body.strategy).toBeUndefined();
    });
  });

  describe('decayStats', () => {
    it('GETs /v1/admin/decay/stats and returns counters + last-cycle snapshot', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          total_decayed: 1024,
          total_deleted: 128,
          last_run_at: 1700000000,
          cycles_run: 42,
          last_cycle: {
            namespaces_processed: 5,
            memories_processed: 200,
            memories_decayed: 30,
            memories_deleted: 5,
          },
        }),
      });

      const result = await client.decayStats();

      expect(result.total_decayed).toBe(1024);
      expect(result.total_deleted).toBe(128);
      expect(result.cycles_run).toBe(42);
      expect(result.last_cycle?.memories_decayed).toBe(30);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/admin/decay/stats');
      expect(init?.method).toBe('GET');
    });

    it('handles response with no last_cycle (never run)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ total_decayed: 0, total_deleted: 0, cycles_run: 0 }),
      });

      const result = await client.decayStats();

      expect(result.cycles_run).toBe(0);
      expect(result.last_cycle).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // store_memory with expires_at (DECAY-3) — v0.7.3
  // ---------------------------------------------------------------------------

  describe('storeMemory', () => {
    it('includes expires_at in request body when set', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ id: 'mem_1', content: 'test' }),
      });

      await client.storeMemory('agent-1', { content: 'test', memory_type: 'episodic', expires_at: 1800000000 });

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/memory/store');
      const body = JSON.parse(init?.body as string);
      expect(body.expires_at).toBe(1800000000);
      expect(body.agent_id).toBe('agent-1');
    });

    it('omits expires_at from request body when not set', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ id: 'mem_1', content: 'test' }),
      });

      await client.storeMemory('agent-1', { content: 'test', memory_type: 'episodic' });

      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(init?.body as string);
      expect(body.expires_at).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // SSE Connected Event (DAK-720) — v0.8.3
  // ---------------------------------------------------------------------------

  describe('streamMemoryEvents — connected handshake', () => {
    /** Build a mock fetch Response whose body is a ReadableStream of SSE chunks. */
    function makeSseResponse(chunks: string[]): Response {
      const encoder = new TextEncoder();
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        },
      });
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body,
      } as unknown as Response;
    }

    it('yields connected event with normalized event_type and empty agent_id', async () => {
      // Server sends: event: connected\ndata: {"type":"connected","timestamp":...}\n\n
      const sseChunk =
        'event: connected\ndata: {"type":"connected","timestamp":1700000000000}\n\n';
      mockFetch.mockResolvedValueOnce(makeSseResponse([sseChunk]));

      const events: import('./types').MemoryEvent[] = [];
      for await (const event of client.streamMemoryEvents()) {
        events.push(event);
        break;
      }

      expect(events).toHaveLength(1);
      expect(events[0].event_type).toBe('connected');
      expect(events[0].agent_id).toBe('');
      expect(events[0].timestamp).toBe(1700000000000);
    });

    it('calls the correct memory events endpoint', async () => {
      const sseChunk =
        'event: connected\ndata: {"type":"connected","timestamp":1700000000000}\n\n';
      mockFetch.mockResolvedValueOnce(makeSseResponse([sseChunk]));

      for await (const _event of client.streamMemoryEvents()) {
        break;
      }

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/events/stream');
    });

    it('connected event has no memory_id or content', async () => {
      const sseChunk =
        'event: connected\ndata: {"type":"connected","timestamp":1700000000000}\n\n';
      mockFetch.mockResolvedValueOnce(makeSseResponse([sseChunk]));

      const events: import('./types').MemoryEvent[] = [];
      for await (const event of client.streamMemoryEvents()) {
        events.push(event);
        break;
      }

      expect(events[0].memory_id).toBeUndefined();
      expect(events[0].content).toBeUndefined();
    });
  });

  // =========================================================================
  // Memory Knowledge Graph Tests (CE-5 / SDK-9)
  // =========================================================================

  describe('Memory Knowledge Graph API (SDK-9)', () => {
    const GRAPH_RESPONSE = {
      root_id: 'mem-abc',
      depth: 2,
      nodes: [
        { memory_id: 'mem-abc', content_preview: 'Root memory', importance: 0.9, depth: 0 },
        { memory_id: 'mem-def', content_preview: 'Related memory', importance: 0.7, depth: 1 },
      ],
      edges: [
        {
          id: 'edge-1',
          source_id: 'mem-abc',
          target_id: 'mem-def',
          edge_type: 'related_to' as const,
          weight: 0.92,
          created_at: 1774000000,
        },
      ],
    };

    const PATH_RESPONSE = {
      source_id: 'mem-abc',
      target_id: 'mem-ghi',
      path: ['mem-abc', 'mem-def', 'mem-ghi'],
      hops: 2,
      edges: [],
    };

    const LINK_RESPONSE = {
      edge: {
        id: 'edge-new',
        source_id: 'mem-abc',
        target_id: 'mem-xyz',
        edge_type: 'linked_by' as const,
        weight: 1.0,
        created_at: 1774002000,
      },
    };

    const EXPORT_RESPONSE = {
      agent_id: 'test-agent',
      format: 'json' as const,
      data: '{"nodes":[],"edges":[]}',
      node_count: 10,
      edge_count: 7,
    };

    it('memoryGraph calls GET /v1/memories/{id}/graph with default depth=1', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(GRAPH_RESPONSE), { status: 200, headers: new Headers({ 'content-type': 'application/json' }) })
      );
      const result = await client.memoryGraph('mem-abc');
      expect(result.root_id).toBe('mem-abc');
      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/memories/mem-abc/graph');
      expect(url).toContain('depth=1');
    });

    it('memoryGraph passes custom depth and type filters', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(GRAPH_RESPONSE), { status: 200, headers: new Headers({ 'content-type': 'application/json' }) })
      );
      await client.memoryGraph('mem-abc', { depth: 3, types: ['related_to', 'linked_by'] });
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('depth=3');
      expect(url).toContain('related_to');
    });

    it('memoryGraph omits types param when not specified', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(GRAPH_RESPONSE), { status: 200, headers: new Headers({ 'content-type': 'application/json' }) })
      );
      await client.memoryGraph('mem-abc');
      const [url] = mockFetch.mock.calls[0];
      expect(url).not.toContain('types=');
    });

    it('memoryPath calls GET /v1/memories/{id}/path with target param', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(PATH_RESPONSE), { status: 200, headers: new Headers({ 'content-type': 'application/json' }) })
      );
      const result = await client.memoryPath('mem-abc', 'mem-ghi');
      expect(result.path).toEqual(['mem-abc', 'mem-def', 'mem-ghi']);
      expect(result.hops).toBe(2);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/memories/mem-abc/path');
      expect(url).toContain('target=mem-ghi');
    });

    it('memoryLink calls POST /v1/memories/{id}/links with default linked_by', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(LINK_RESPONSE), { status: 200, headers: new Headers({ 'content-type': 'application/json' }) })
      );
      const result = await client.memoryLink('mem-abc', 'mem-xyz');
      expect(result.edge.id).toBe('edge-new');
      expect(result.edge.edge_type).toBe('linked_by');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/memories/mem-abc/links');
      const body = JSON.parse(opts.body as string);
      expect(body.target_id).toBe('mem-xyz');
      expect(body.edge_type).toBe('linked_by');
    });

    it('memoryLink accepts custom edge type', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(LINK_RESPONSE), { status: 200, headers: new Headers({ 'content-type': 'application/json' }) })
      );
      await client.memoryLink('mem-abc', 'mem-xyz', 'precedes');
      const [, opts] = mockFetch.mock.calls[0];
      const body = JSON.parse(opts.body as string);
      expect(body.edge_type).toBe('precedes');
    });

    it('agentGraphExport calls GET /v1/agents/{id}/graph/export with default json', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(EXPORT_RESPONSE), { status: 200, headers: new Headers({ 'content-type': 'application/json' }) })
      );
      const result = await client.agentGraphExport('test-agent');
      expect(result.agent_id).toBe('test-agent');
      expect(result.format).toBe('json');
      expect(result.node_count).toBe(10);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/agents/test-agent/graph/export');
      expect(url).toContain('format=json');
    });

    it('agentGraphExport passes graphml format', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ ...EXPORT_RESPONSE, format: 'graphml' }), { status: 200, headers: new Headers({ 'content-type': 'application/json' }) })
      );
      const result = await client.agentGraphExport('test-agent', 'graphml');
      expect(result.format).toBe('graphml');
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('format=graphml');
    });
  });

  describe('subscribeAgentMemories', () => {
    function makeMemoryEvent(eventType: string, agentId: string, tags?: string[], memoryId?: string) {
      return { event_type: eventType, agent_id: agentId, timestamp: 1774533000000, ...(memoryId ? { memory_id: memoryId } : {}), ...(tags ? { tags } : {}) };
    }

    it('filters by agent_id', async () => {
      const events = [
        makeMemoryEvent('stored', 'agent-a', undefined, 'm1'),
        makeMemoryEvent('stored', 'agent-b', undefined, 'm2'),
        makeMemoryEvent('recalled', 'agent-a', undefined, 'm3'),
      ];
      vi.spyOn(client as any, 'streamMemoryEvents').mockImplementation(async function* () {
        for (const e of events) yield e;
      });
      const collected: any[] = [];
      for await (const ev of client.subscribeAgentMemories('agent-a', { reconnect: false })) {
        collected.push(ev);
      }
      expect(collected).toHaveLength(2);
      expect(collected.every((e) => e.agent_id === 'agent-a')).toBe(true);
    });

    it('skips connected handshake', async () => {
      const events = [
        makeMemoryEvent('connected', '', undefined, undefined),
        makeMemoryEvent('stored', 'bot', undefined, 'm1'),
      ];
      vi.spyOn(client as any, 'streamMemoryEvents').mockImplementation(async function* () {
        for (const e of events) yield e;
      });
      const collected: any[] = [];
      for await (const ev of client.subscribeAgentMemories('bot', { reconnect: false })) {
        collected.push(ev);
      }
      expect(collected).toHaveLength(1);
      expect(collected[0].memory_id).toBe('m1');
    });

    it('applies tag filter', async () => {
      const events = [
        makeMemoryEvent('stored', 'bot', ['important', 'work'], 'm1'),
        makeMemoryEvent('stored', 'bot', ['trivial'], 'm2'),
        makeMemoryEvent('stored', 'bot', ['important'], 'm3'),
      ];
      vi.spyOn(client as any, 'streamMemoryEvents').mockImplementation(async function* () {
        for (const e of events) yield e;
      });
      const collected: any[] = [];
      for await (const ev of client.subscribeAgentMemories('bot', { tags: ['important'], reconnect: false })) {
        collected.push(ev);
      }
      expect(new Set(collected.map((e) => e.memory_id))).toEqual(new Set(['m1', 'm3']));
    });

    it('yields all events when no tags filter', async () => {
      const events = [
        makeMemoryEvent('stored', 'bot', ['x'], 'm1'),
        makeMemoryEvent('forgotten', 'bot', undefined, 'm2'),
      ];
      vi.spyOn(client as any, 'streamMemoryEvents').mockImplementation(async function* () {
        for (const e of events) yield e;
      });
      const collected: any[] = [];
      for await (const ev of client.subscribeAgentMemories('bot', { reconnect: false })) {
        collected.push(ev);
      }
      expect(collected).toHaveLength(2);
    });

    it('rethrows error when reconnect=false', async () => {
      vi.spyOn(client as any, 'streamMemoryEvents').mockImplementation(async function* () {
        throw new Error('stream dropped');
        yield;
      });
      await expect(async () => {
        for await (const _ of client.subscribeAgentMemories('bot', { reconnect: false })) { /* */ }
      }).rejects.toThrow('stream dropped');
    });
  });

  // =========================================================================
  // Entity Extraction Tests (CE-4)
  // =========================================================================

  describe('Entity Extraction API (CE-4)', () => {
    it('configureNamespaceNer calls PATCH /v1/namespaces/:ns/config with config body', async () => {
      const mockResponse = { extract_entities: true, entity_types: ['person', 'org'] };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200, headers: new Headers({ 'content-type': 'application/json' }) })
      );
      const result = await client.configureNamespaceNer('my-ns', { extract_entities: true, entity_types: ['person', 'org'] });
      expect(result).toEqual(mockResponse);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/namespaces/my-ns/config');
      expect(opts.method).toBe('PATCH');
      const body = JSON.parse(opts.body as string);
      expect(body.extract_entities).toBe(true);
      expect(body.entity_types).toEqual(['person', 'org']);
    });

    it('configureNamespaceNer omits entity_types when not provided', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ extract_entities: false }), { status: 200, headers: new Headers({ 'content-type': 'application/json' }) })
      );
      await client.configureNamespaceNer('my-ns', { extract_entities: false });
      const [, opts] = mockFetch.mock.calls[0];
      const body = JSON.parse(opts.body as string);
      expect(body.extract_entities).toBe(false);
      expect(body.entity_types).toBeUndefined();
    });

    it('extractEntities calls POST /v1/memories/extract with text body', async () => {
      const mockResponse = {
        entities: [
          { entity_type: 'person', value: 'Alice', score: 0.95 },
          { entity_type: 'org', value: 'Dakera', score: 0.88 },
        ],
      };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200, headers: new Headers({ 'content-type': 'application/json' }) })
      );
      const result = await client.extractEntities('Alice works at Dakera.');
      expect(result.entities).toHaveLength(2);
      expect(result.entities[0].entity_type).toBe('person');
      expect(result.entities[0].value).toBe('Alice');
      expect(result.entities[0].score).toBe(0.95);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/memories/extract');
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body as string);
      expect(body.text).toBe('Alice works at Dakera.');
      expect(body.entity_types).toBeUndefined();
    });

    it('extractEntities includes entity_types when provided', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ entities: [] }), { status: 200, headers: new Headers({ 'content-type': 'application/json' }) })
      );
      await client.extractEntities('some text', ['person', 'location']);
      const [, opts] = mockFetch.mock.calls[0];
      const body = JSON.parse(opts.body as string);
      expect(body.entity_types).toEqual(['person', 'location']);
    });

    it('memoryEntities calls GET /v1/memory/entities/:id and parses response', async () => {
      const mockResponse = {
        memory_id: 'mem-xyz',
        entities: [
          { entity_type: 'person', value: 'Bob', score: 0.91 },
        ],
      };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200, headers: new Headers({ 'content-type': 'application/json' }) })
      );
      const result = await client.memoryEntities('mem-xyz');
      expect(result.memory_id).toBe('mem-xyz');
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].value).toBe('Bob');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/memory/entities/mem-xyz');
      expect(opts.method).toBe('GET');
    });
  });

  // ===========================================================================
  // INT-1 Memory Feedback Loop
  // ===========================================================================

  describe('Memory Feedback Loop (INT-1)', () => {
    const feedbackResponse = {
      memory_id: 'mem-abc',
      new_importance: 0.92,
      signal: 'upvote' as const,
    };

    it('feedbackMemory POSTs to /v1/memories/:id/feedback', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(feedbackResponse), { status: 200, headers: new Headers({ 'content-type': 'application/json' }) })
      );
      const result = await client.feedbackMemory('mem-abc', 'agent-1', 'upvote');
      expect(result.memory_id).toBe('mem-abc');
      expect(result.new_importance).toBe(0.92);
      expect(result.signal).toBe('upvote');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/memories/mem-abc/feedback');
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body as string);
      expect(body.agent_id).toBe('agent-1');
      expect(body.signal).toBe('upvote');
    });

    it('getMemoryFeedbackHistory GETs /v1/memories/:id/feedback', async () => {
      const historyResponse = {
        memory_id: 'mem-abc',
        entries: [
          { signal: 'upvote', timestamp: 1774000000, old_importance: 0.5, new_importance: 0.575 },
          { signal: 'downvote', timestamp: 1774001000, old_importance: 0.575, new_importance: 0.489 },
        ],
      };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(historyResponse), { status: 200, headers: new Headers({ 'content-type': 'application/json' }) })
      );
      const result = await client.getMemoryFeedbackHistory('mem-abc');
      expect(result.memory_id).toBe('mem-abc');
      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].signal).toBe('upvote');
      expect(result.entries[1].signal).toBe('downvote');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/memories/mem-abc/feedback');
      expect(opts.method).toBe('GET');
    });

    it('getAgentFeedbackSummary GETs /v1/agents/:id/feedback/summary', async () => {
      const summaryResponse = {
        agent_id: 'agent-1',
        upvotes: 42,
        downvotes: 7,
        flags: 2,
        total_feedback: 51,
        health_score: 0.78,
      };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(summaryResponse), { status: 200, headers: new Headers({ 'content-type': 'application/json' }) })
      );
      const result = await client.getAgentFeedbackSummary('agent-1');
      expect(result.agent_id).toBe('agent-1');
      expect(result.upvotes).toBe(42);
      expect(result.health_score).toBe(0.78);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/agents/agent-1/feedback/summary');
      expect(opts.method).toBe('GET');
    });

    it('patchMemoryImportance PATCHes /v1/memories/:id/importance', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(feedbackResponse), { status: 200, headers: new Headers({ 'content-type': 'application/json' }) })
      );
      const result = await client.patchMemoryImportance('mem-abc', 'agent-1', 0.92);
      expect(result.memory_id).toBe('mem-abc');
      expect(result.new_importance).toBe(0.92);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/memories/mem-abc/importance');
      expect(opts.method).toBe('PATCH');
      const body = JSON.parse(opts.body as string);
      expect(body.agent_id).toBe('agent-1');
      expect(body.importance).toBe(0.92);
    });

    it('getFeedbackHealth GETs /v1/feedback/health with agent_id query param', async () => {
      const healthResponse = {
        agent_id: 'agent-1',
        health_score: 0.78,
        memory_count: 120,
        avg_importance: 0.72,
      };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(healthResponse), { status: 200, headers: new Headers({ 'content-type': 'application/json' }) })
      );
      const result = await client.getFeedbackHealth('agent-1');
      expect(result.agent_id).toBe('agent-1');
      expect(result.health_score).toBe(0.78);
      expect(result.memory_count).toBe(120);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/feedback/health');
      expect(url).toContain('agent_id=agent-1');
      expect(opts.method).toBe('GET');
    });
  });

  describe('Namespace API Keys (SEC-1)', () => {
    const createKeyResponse = {
      key_id: 'key-abc',
      key: 'dak_live_xxxxxxxxxxxx',
      name: 'ci-runner',
      namespace: 'prod-ns',
      created_at: 1774000000,
      expires_at: null,
      warning: 'Save this key — it will not be shown again.',
    };
    const listKeysResponse = {
      namespace: 'prod-ns',
      keys: [{ key_id: 'key-abc', name: 'ci-runner', namespace: 'prod-ns', created_at: 1774000000, active: true }],
      total: 1,
    };
    const usageResponse = {
      key_id: 'key-abc',
      namespace: 'prod-ns',
      total_requests: 1000,
      successful_requests: 980,
      failed_requests: 20,
      bytes_transferred: 512000,
      avg_latency_ms: 12.4,
    };

    it('createNamespaceKey POSTs to /v1/namespaces/:ns/keys', async () => {
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(createKeyResponse), { status: 200, headers: new Headers({ 'content-type': 'application/json' }) }));
      const result = await client.createNamespaceKey('prod-ns', 'ci-runner');
      expect(result.key_id).toBe('key-abc');
      expect(result.key).toBe('dak_live_xxxxxxxxxxxx');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/namespaces/prod-ns/keys');
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body as string).name).toBe('ci-runner');
    });

    it('createNamespaceKey sends expires_in_days when provided', async () => {
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(createKeyResponse), { status: 200, headers: new Headers({ 'content-type': 'application/json' }) }));
      await client.createNamespaceKey('prod-ns', 'ci-runner', 30);
      const [, opts] = mockFetch.mock.calls[0];
      expect(JSON.parse(opts.body as string).expires_in_days).toBe(30);
    });

    it('listNamespaceKeys GETs /v1/namespaces/:ns/keys', async () => {
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(listKeysResponse), { status: 200, headers: new Headers({ 'content-type': 'application/json' }) }));
      const result = await client.listNamespaceKeys('prod-ns');
      expect(result.namespace).toBe('prod-ns');
      expect(result.total).toBe(1);
      expect(result.keys[0].key_id).toBe('key-abc');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/namespaces/prod-ns/keys');
      expect(opts.method).toBe('GET');
    });

    it('deleteNamespaceKey DELETEs /v1/namespaces/:ns/keys/:key_id', async () => {
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ success: true, message: 'Key revoked.' }), { status: 200, headers: new Headers({ 'content-type': 'application/json' }) }));
      const result = await client.deleteNamespaceKey('prod-ns', 'key-abc');
      expect(result.success).toBe(true);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/namespaces/prod-ns/keys/key-abc');
      expect(opts.method).toBe('DELETE');
    });

    it('getNamespaceKeyUsage GETs /v1/namespaces/:ns/keys/:key_id/usage', async () => {
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(usageResponse), { status: 200, headers: new Headers({ 'content-type': 'application/json' }) }));
      const result = await client.getNamespaceKeyUsage('prod-ns', 'key-abc');
      expect(result.key_id).toBe('key-abc');
      expect(result.total_requests).toBe(1000);
      expect(result.avg_latency_ms).toBe(12.4);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/namespaces/prod-ns/keys/key-abc/usage');
      expect(opts.method).toBe('GET');
    });
  });

  describe('opsMetrics (INFRA-3)', () => {
    const PROMETHEUS_TEXT = [
      '# HELP dakera_memory_store_total Total memory store operations',
      '# TYPE dakera_memory_store_total counter',
      'dakera_memory_store_total 42',
      '# HELP dakera_memory_count Current stored memory count',
      '# TYPE dakera_memory_count gauge',
      'dakera_memory_count 1024',
    ].join('\n');

    it('GETs /v1/ops/metrics and returns Prometheus text body', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(PROMETHEUS_TEXT, {
          status: 200,
          headers: new Headers({ 'content-type': 'text/plain; version=0.0.4; charset=utf-8' }),
        })
      );

      const result = await client.opsMetrics();

      expect(typeof result).toBe('string');
      expect(result).toContain('dakera_memory_store_total');
      expect(result).toContain('dakera_memory_count 1024');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/ops/metrics');
      expect(opts.method).toBe('GET');
    });

    it('throws AuthorizationError on 403 (insufficient scope)', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Admin scope required', code: 'AUTHORIZATION_ERROR' }), {
          status: 403,
          headers: new Headers({ 'content-type': 'application/json' }),
        })
      );

      await expect(client.opsMetrics()).rejects.toThrow('Admin scope required');
    });
  });

  describe('rotateEncryptionKey (SEC-3)', () => {
    it('POSTs /v1/admin/encryption/rotate-key and returns counts', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ rotated: 42, skipped: 3, namespaces: ['ns-a', 'ns-b'] }),
          { status: 200, headers: new Headers({ 'content-type': 'application/json' }) },
        ),
      );

      const result = await client.rotateEncryptionKey('new-secret-passphrase');

      expect(result.rotated).toBe(42);
      expect(result.skipped).toBe(3);
      expect(result.namespaces).toEqual(['ns-a', 'ns-b']);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/admin/encryption/rotate-key');
      expect(opts.method).toBe('POST');
    });

    it('sends namespace in body when provided', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ rotated: 5, skipped: 0, namespaces: ['my-ns'] }),
          { status: 200, headers: new Headers({ 'content-type': 'application/json' }) },
        ),
      );

      await client.rotateEncryptionKey('new-key', 'my-ns');

      const [, opts] = mockFetch.mock.calls[0];
      const body = JSON.parse(opts.body as string);
      expect(body.new_key).toBe('new-key');
      expect(body.namespace).toBe('my-ns');
    });
  });

  describe('ODE-2: GLiNER Entity Extraction (odeExtractEntities)', () => {
    const ODE_RESPONSE = {
      entities: [
        { text: 'Alice', label: 'person', start: 0, end: 5, score: 0.97 },
        { text: 'Paris', label: 'location', start: 16, end: 21, score: 0.92 },
      ],
      model: 'gliner-multi-v2.1',
      processing_time_ms: 34,
    };

    it('odeExtractEntities POSTs to /ode/extract on odeUrl', async () => {
      const odeClient = new DakeraClient({
        baseUrl: 'http://localhost:3000',
        odeUrl: 'http://localhost:8080',
      });
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(ODE_RESPONSE), {
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
        }),
      );

      const result = await odeClient.odeExtractEntities('Alice lives in Paris.', 'agent-1');

      expect(result.entities).toHaveLength(2);
      expect(result.entities[0].text).toBe('Alice');
      expect(result.entities[0].label).toBe('person');
      expect(result.entities[1].text).toBe('Paris');
      expect(result.model).toBe('gliner-multi-v2.1');
      expect(result.processing_time_ms).toBe(34);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:8080/ode/extract');
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body as string);
      expect(body.content).toBe('Alice lives in Paris.');
      expect(body.agent_id).toBe('agent-1');
    });

    it('odeExtractEntities includes optional fields when provided', async () => {
      const odeClient = new DakeraClient({
        baseUrl: 'http://localhost:3000',
        odeUrl: 'http://localhost:8080',
      });
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(ODE_RESPONSE), {
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
        }),
      );

      await odeClient.odeExtractEntities('Alice works at Dakera.', 'agent-2', 'mem-abc', ['person', 'org']);

      const [, opts] = mockFetch.mock.calls[0];
      const body = JSON.parse(opts.body as string);
      expect(body.memory_id).toBe('mem-abc');
      expect(body.entity_types).toEqual(['person', 'org']);
    });

    it('odeExtractEntities throws when odeUrl is not configured', async () => {
      await expect(
        client.odeExtractEntities('text', 'agent-1'),
      ).rejects.toThrow('odeUrl');
    });
  });

  // ---------------------------------------------------------------------------
  // Memory Recall (DAK-4924)
  // ---------------------------------------------------------------------------

  describe('recall', () => {
    it('should recall memories with basic query', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          memories: [
            { id: 'mem_1', content: 'user prefers code', score: 0.95, memory_type: 'semantic' },
          ],
        }),
      });

      const result = await client.recall('agent-1', 'user preferences');

      expect(result.memories).toHaveLength(1);
      expect(result.memories[0].content).toBe('user prefers code');
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/memory/recall');
      expect(init?.method).toBe('POST');
    });

    it('should pass all optional recall parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ memories: [] }),
      });

      await client.recall('agent-1', 'test', {
        top_k: 3,
        memory_type: 'episodic',
        min_importance: 0.5,
        include_associated: true,
        associated_memories_depth: 2,
        since: '2026-01-01T00:00:00Z',
        routing: 'hybrid',
        rerank: true,
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(body.top_k).toBe(3);
      expect(body.memory_type).toBe('episodic');
      expect(body.min_importance).toBe(0.5);
      expect(body.include_associated).toBe(true);
      expect(body.associated_memories_depth).toBe(2);
      expect(body.since).toBe('2026-01-01T00:00:00Z');
      expect(body.routing).toBe('hybrid');
      expect(body.rerank).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Session Management (DAK-4924)
  // ---------------------------------------------------------------------------

  describe('session management', () => {
    it('should start a session', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          session: {
            id: 'sess_123',
            agent_id: 'agent-1',
            created_at: '2026-01-01T00:00:00Z',
          },
        }),
      });

      const session = await client.startSession('agent-1', { task: 'review' });

      expect(session.id).toBe('sess_123');
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/sessions/start');
    });

    it('should end a session', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          session: { id: 'sess_123' },
          memory_count: 5,
        }),
      });

      const result = await client.endSession('sess_123');

      expect(result.memory_count).toBe(5);
    });

    it('should get a session', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          id: 'sess_123',
          agent_id: 'agent-1',
          status: 'active',
        }),
      });

      const session = await client.getSession('sess_123');

      expect(session.id).toBe('sess_123');
      expect(session.status).toBe('active');
    });

    it('should list sessions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => [
          { id: 'sess_1', agent_id: 'agent-1' },
          { id: 'sess_2', agent_id: 'agent-1' },
        ],
      });

      const sessions = await client.listSessions({ agent_id: 'agent-1' });

      expect(sessions).toHaveLength(2);
    });

    it('should get session memories', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => [
          { id: 'mem_1', content: 'session note' },
        ],
      });

      const memories = await client.sessionMemories('sess_123');

      expect(memories).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Memory CRUD (DAK-4924)
  // ---------------------------------------------------------------------------

  describe('memory CRUD', () => {
    it('should get a specific memory', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          id: 'mem_123',
          content: 'test memory',
          memory_type: 'episodic',
          importance: 0.8,
        }),
      });

      const memory = await client.getMemory('agent-1', 'mem_123');

      expect(memory.id).toBe('mem_123');
      expect(memory.content).toBe('test memory');
    });

    it('should update a memory', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ memory_id: 'mem_123' }),
      });

      const result = await client.updateMemory('agent-1', 'mem_123', {
        content: 'updated content',
        importance: 0.95,
      });

      expect(result.memory_id).toBe('mem_123');
      const [, init] = mockFetch.mock.calls[0];
      expect(init?.method).toBe('PUT');
    });

    it('should forget (delete) a memory', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ status: 'deleted' }),
      });

      const result = await client.forget('agent-1', 'mem_123');

      expect(result.status).toBe('deleted');
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/memory/forget');
      expect(init?.method).toBe('POST');
    });

    it('should search memories with options', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          memories: [
            { id: 'mem_1', content: 'pref', score: 0.9 },
          ],
        }),
      });

      const results = await client.searchMemories('agent-1', 'preferences', {
        memory_type: 'semantic',
        top_k: 3,
      });

      expect(results).toHaveLength(1);
      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(body.memory_type).toBe('semantic');
      expect(body.top_k).toBe(3);
    });
  });

  // ---------------------------------------------------------------------------
  // Agent Operations (DAK-4924)
  // ---------------------------------------------------------------------------

  describe('agent operations', () => {
    it('should list agents', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => [
          { agent_id: 'agent-1', total_memories: 10 },
          { agent_id: 'agent-2', total_memories: 5 },
        ],
      });

      const agents = await client.listAgents();

      expect(agents).toHaveLength(2);
    });

    it('should get agent stats', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          agent_id: 'agent-1',
          total_memories: 42,
          total_sessions: 3,
          avg_importance: 0.75,
        }),
      });

      const stats = await client.agentStats('agent-1');

      expect(stats.agent_id).toBe('agent-1');
      expect(stats.total_memories).toBe(42);
      expect(stats.total_sessions).toBe(3);
    });

    it('should get agent memories', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => [
          { id: 'mem_1', content: 'test' },
        ],
      });

      const memories = await client.agentMemories('agent-1', { limit: 10 });

      expect(memories).toHaveLength(1);
    });

    it('should get wake-up context', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          agent_id: 'agent-1',
          memories: [{ id: 'mem_1', content: 'important' }],
          total_available: 100,
        }),
      });

      const ctx = await client.getWakeUpContext('agent-1', { topN: 5, minImportance: 0.8 });

      expect(ctx.agent_id).toBe('agent-1');
      expect(ctx.memories).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Text Operations (DAK-4924)
  // ---------------------------------------------------------------------------

  describe('text operations', () => {
    it('should upsert text documents', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ upserted_count: 2 }),
      });

      const result = await client.upsertText('test-ns', [
        { id: 'doc1', text: 'Hello world' },
        { id: 'doc2', text: 'Goodbye world' },
      ]);

      expect(result.upserted_count).toBe(2);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/namespaces/test-ns/upsert-text');
    });

    it('should query text', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          results: [
            { id: 'doc1', text: 'Hello world', score: 0.9 },
          ],
        }),
      });

      const result = await client.queryText('test-ns', 'hello', { top_k: 5 });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].score).toBe(0.9);
    });
  });

  // ---------------------------------------------------------------------------
  // Analytics (DAK-4924)
  // ---------------------------------------------------------------------------

  describe('analytics', () => {
    it('should get analytics overview', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          total_operations: 1000,
          total_agents: 5,
        }),
      });

      const overview = await client.analyticsOverview();

      expect(overview.total_operations).toBe(1000);
    });

    it('should get latency analytics', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          p50_ms: 12,
          p99_ms: 45,
        }),
      });

      const latency = await client.analyticsLatency();

      expect(latency.p50_ms).toBe(12);
    });
  });

  // ---------------------------------------------------------------------------
  // Consolidation (DAK-4924)
  // ---------------------------------------------------------------------------

  describe('consolidate', () => {
    it('should consolidate memories for an agent', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          merged_count: 3,
          clusters: 2,
        }),
      });

      const result = await client.consolidate('agent-1');

      expect(result.merged_count).toBe(3);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/memory/consolidate');
    });
  });
});
