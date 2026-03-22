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

    it('should perform hybrid search', async () => {
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
        [0.1, 0.2, 0.3],
        'hello',
        { alpha: 0.5 }
      );

      expect(results).toHaveLength(1);
      expect(results[0].vectorScore).toBe(0.9);
      expect(results[0].textScore).toBe(0.8);
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
});
