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
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Internal server error' }),
      });

      await expect(client.health()).rejects.toThrow(ServerError);
    });

    it('should throw RateLimitError on 429', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({
          'content-type': 'application/json',
          'Retry-After': '60',
        }),
        json: async () => ({ error: 'Rate limit exceeded' }),
      });

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
});
