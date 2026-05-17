/**
 * Tests for DakeraClient Analytics, Vector Bulk, KG, and Memory Extended Methods
 * Covers: analytics (throughput, storage, KPIs), vector bulk ops, KG operations,
 *         consolidation extended, compress, updateImportance
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

describe('Analytics, Vector Bulk, KG, and Memory Extended Methods', () => {
  let client: DakeraClient;

  beforeEach(() => {
    client = new DakeraClient({ baseUrl: 'http://localhost:3000' });
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Analytics (untested: throughput, storage, getKpis)
  // ---------------------------------------------------------------------------

  describe('analyticsThroughput', () => {
    it('should get throughput analytics', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        queries_per_second: 120,
        upserts_per_second: 45,
        peak_qps: 250,
      }));

      const result = await client.analyticsThroughput();

      expect(result.queries_per_second).toBe(120);
      expect(result.peak_qps).toBe(250);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/analytics/throughput');
      expect(opts.method).toBe('GET');
    });

    it('should pass period and namespace options', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ queries_per_second: 50 }));

      await client.analyticsThroughput({ period: '1h', namespace: 'ns-a' });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('period=1h');
      expect(url).toContain('namespace=ns-a');
    });
  });

  describe('analyticsStorage', () => {
    it('should get storage analytics', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        total_bytes: 10737418240,
        vector_bytes: 8589934592,
        metadata_bytes: 2147483648,
        namespace_count: 5,
      }));

      const result = await client.analyticsStorage();

      expect(result.total_bytes).toBe(10737418240);
      expect(result.namespace_count).toBe(5);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/analytics/storage');
      expect(opts.method).toBe('GET');
    });

    it('should pass namespace filter', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ total_bytes: 1024 }));

      await client.analyticsStorage('ns-a');

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('namespace=ns-a');
    });
  });

  describe('getKpis', () => {
    it('should get KPI snapshot', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        total_memories: 50000,
        total_agents: 12,
        queries_last_hour: 1500,
        avg_latency_ms: 15.3,
        error_rate: 0.002,
        retention_rate: 0.95,
      }));

      const result = await client.getKpis();

      expect(result.total_memories).toBe(50000);
      expect(result.avg_latency_ms).toBe(15.3);
      expect(result.error_rate).toBe(0.002);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/kpis');
      expect(opts.method).toBe('GET');
    });
  });

  // ---------------------------------------------------------------------------
  // Vector Bulk Operations
  // ---------------------------------------------------------------------------

  describe('bulkUpdateVectors', () => {
    it('should bulk update vectors matching a filter', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        updated_count: 150,
      }));

      const result = await client.bulkUpdateVectors(
        'ns-a',
        { category: { $eq: 'old' } },
        { category: 'updated' }
      );

      expect(result.updated_count).toBe(150);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/namespaces/ns-a/vectors/bulk-update');
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body as string);
      expect(body.filter).toEqual({ category: { $eq: 'old' } });
      expect(body.update).toEqual({ category: 'updated' });
    });
  });

  describe('bulkDeleteVectors', () => {
    it('should bulk delete vectors matching a filter', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        deleted_count: 75,
      }));

      const result = await client.bulkDeleteVectors('ns-a', { status: { $eq: 'expired' } });

      expect(result.deleted_count).toBe(75);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/namespaces/ns-a/vectors/bulk-delete');
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body as string);
      expect(body.filter).toEqual({ status: { $eq: 'expired' } });
    });
  });

  describe('countVectors', () => {
    it('should count all vectors in a namespace', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ count: 10000 }));

      const result = await client.countVectors('ns-a');

      expect(result.count).toBe(10000);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/namespaces/ns-a/vectors/count');
      expect(opts.method).toBe('POST');
    });

    it('should count vectors with a filter', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ count: 500 }));

      const result = await client.countVectors('ns-a', { category: { $eq: 'active' } });

      expect(result.count).toBe(500);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.filter).toEqual({ category: { $eq: 'active' } });
    });
  });

  describe('multiVectorSearch', () => {
    it('should search with multiple positive vectors', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        results: [
          { id: 'vec-1', score: 0.95 },
          { id: 'vec-2', score: 0.88 },
        ],
      }));

      const result = await client.multiVectorSearch('ns-a', {
        positiveVectors: [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]],
        topK: 5,
      });

      expect(result.results).toHaveLength(2);
      expect(result.results[0].score).toBe(0.95);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/namespaces/ns-a/multi-vector');
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body as string);
      expect(body.positive_vectors).toHaveLength(2);
      expect(body.top_k).toBe(5);
    });

    it('should include negative vectors and MMR options', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ results: [] }));

      await client.multiVectorSearch('ns-a', {
        positiveVectors: [[0.1, 0.2]],
        negativeVectors: [[0.9, 0.8]],
        enableMmr: true,
        mmrLambda: 0.7,
        scoreThreshold: 0.5,
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.negative_vectors).toEqual([[0.9, 0.8]]);
      expect(body.enable_mmr).toBe(true);
      expect(body.mmr_lambda).toBe(0.7);
      expect(body.score_threshold).toBe(0.5);
    });
  });

  describe('unifiedQuery', () => {
    it('should execute a unified query', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        results: [{ id: 'vec-1', score: 0.92, metadata: { label: 'test' } }],
        total_searched: 5000,
      }));

      const result = await client.unifiedQuery('ns-a', {
        rankBy: { vector: [0.1, 0.2, 0.3] },
        topK: 10,
        includeMetadata: true,
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].id).toBe('vec-1');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/namespaces/ns-a/unified-query');
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body as string);
      expect(body.rank_by).toEqual({ vector: [0.1, 0.2, 0.3] });
      expect(body.include_metadata).toBe(true);
    });

    it('should include filter and distance metric', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ results: [] }));

      await client.unifiedQuery('ns-a', {
        rankBy: { text: 'hello' },
        filter: { status: { $eq: 'active' } },
        distanceMetric: 'cosine',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.filter).toEqual({ status: { $eq: 'active' } });
      expect(body.distance_metric).toBe('cosine');
    });
  });

  describe('aggregate', () => {
    it('should aggregate data with grouping', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        groups: [
          { key: { category: 'a' }, count: 100, avg_score: 0.8 },
          { key: { category: 'b' }, count: 50, avg_score: 0.6 },
        ],
      }));

      const result = await client.aggregate('ns-a', {
        aggregateBy: { count: 'Count', avg_score: ['Avg', 'score'] },
        groupBy: ['category'],
        limit: 10,
      });

      expect(result.groups).toHaveLength(2);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/namespaces/ns-a/aggregate');
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body as string);
      expect(body.aggregate_by).toEqual({ count: 'Count', avg_score: ['Avg', 'score'] });
      expect(body.group_by).toEqual(['category']);
      expect(body.limit).toBe(10);
    });

    it('should aggregate without groupBy', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ groups: [{ count: 5000 }] }));

      await client.aggregate('ns-a', {
        aggregateBy: { count: 'Count' },
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.group_by).toBeUndefined();
    });
  });

  describe('exportVectors', () => {
    it('should export vectors with pagination', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        vectors: [
          { id: 'vec-1', values: [0.1, 0.2] },
          { id: 'vec-2', values: [0.3, 0.4] },
        ],
        returned_count: 2,
        next_cursor: 'cursor-abc',
      }));

      const result = await client.exportVectors('ns-a', { topK: 100 });

      expect(result.returned_count).toBe(2);
      expect(result.next_cursor).toBe('cursor-abc');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/namespaces/ns-a/export');
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body as string);
      expect(body.top_k).toBe(100);
    });

    it('should pass cursor for pagination', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        vectors: [],
        returned_count: 0,
        next_cursor: null,
      }));

      await client.exportVectors('ns-a', { cursor: 'cursor-abc' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.cursor).toBe('cursor-abc');
    });
  });

  describe('explainQuery', () => {
    it('should explain a vector search query', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        summary: 'Vector search over 5000 vectors using cosine similarity',
        steps: [
          { name: 'index_scan', duration_ms: 2.1 },
          { name: 'score_compute', duration_ms: 0.5 },
        ],
        total_duration_ms: 2.6,
      }));

      const result = await client.explainQuery('ns-a', {
        queryType: 'vector_search',
        vector: [0.1, 0.2, 0.3],
        topK: 10,
        execute: true,
        verbose: true,
      });

      expect(result.summary).toContain('Vector search');
      expect(result.total_duration_ms).toBe(2.6);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/namespaces/ns-a/explain');
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body as string);
      expect(body.query_type).toBe('vector_search');
      expect(body.execute).toBe(true);
      expect(body.verbose).toBe(true);
    });

    it('should work with minimal options', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ summary: 'scan', steps: [], total_duration_ms: 0 }));

      await client.explainQuery('ns-a');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.top_k).toBe(10);
      expect(body.query_type).toBeUndefined();
    });
  });

  describe('upsertColumns', () => {
    it('should upsert vectors in column format', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ upsertedCount: 2 }));

      const result = await client.upsertColumns('ns-a', {
        ids: ['vec-1', 'vec-2'],
        vectors: [[0.1, 0.2], [0.3, 0.4]],
        attributes: { category: ['a', 'b'], score: [0.9, 0.8] },
      });

      expect(result.upsertedCount).toBe(2);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/namespaces/ns-a/upsert-columns');
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body as string);
      expect(body.ids).toEqual(['vec-1', 'vec-2']);
      expect(body.vectors).toEqual([[0.1, 0.2], [0.3, 0.4]]);
      expect(body.attributes).toEqual({ category: ['a', 'b'], score: [0.9, 0.8] });
    });

    it('should include ttlSeconds and dimension', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ upsertedCount: 1 }));

      await client.upsertColumns('ns-a', {
        ids: ['vec-1'],
        vectors: [[0.1, 0.2]],
        ttlSeconds: 3600,
        dimension: 2,
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.ttl_seconds).toBe(3600);
      expect(body.dimension).toBe(2);
    });
  });

  describe('warmCache', () => {
    it('should warm cache for a namespace', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        entries_warmed: 500,
        duration_ms: 120,
        target_tier: 'l2',
      }));

      const result = await client.warmCache('ns-a', {
        priority: 'high',
        targetTier: 'both',
        background: true,
      });

      expect(result.entries_warmed).toBe(500);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/namespaces/ns-a/cache/warm');
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body as string);
      expect(body.priority).toBe('high');
      expect(body.target_tier).toBe('both');
      expect(body.background).toBe(true);
    });

    it('should warm specific vector IDs', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ entries_warmed: 3, duration_ms: 5 }));

      await client.warmCache('ns-a', {
        vectorIds: ['v1', 'v2', 'v3'],
        ttlHintSeconds: 300,
        maxVectors: 100,
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.vector_ids).toEqual(['v1', 'v2', 'v3']);
      expect(body.ttl_hint_seconds).toBe(300);
      expect(body.max_vectors).toBe(100);
    });

    it('should use defaults when no options provided', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ entries_warmed: 1000 }));

      await client.warmCache('ns-a');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.priority).toBe('normal');
      expect(body.target_tier).toBe('l2');
      expect(body.background).toBe(false);
      expect(body.access_pattern).toBe('random');
    });
  });

  // ---------------------------------------------------------------------------
  // Knowledge Graph Operations
  // ---------------------------------------------------------------------------

  describe('knowledgeGraph', () => {
    it('should build a knowledge graph from a seed memory', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        nodes: [{ id: 'mem-1', label: 'root' }],
        edges: [{ source: 'mem-1', target: 'mem-2', weight: 0.8 }],
      }));

      const result = await client.knowledgeGraph({ agent_id: 'agent-1', seed_memory_id: 'mem-1' });

      expect(result.nodes).toHaveLength(1);
      expect(result.edges).toHaveLength(1);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/knowledge/graph');
      expect(opts.method).toBe('POST');
    });
  });

  describe('fullKnowledgeGraph', () => {
    it('should build a full knowledge graph for an agent', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        nodes: [
          { id: 'mem-1', label: 'fact' },
          { id: 'mem-2', label: 'concept' },
        ],
        edges: [{ source: 'mem-1', target: 'mem-2', weight: 0.9 }],
      }));

      const result = await client.fullKnowledgeGraph({ agent_id: 'agent-1' });

      expect(result.nodes).toHaveLength(2);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/knowledge/graph/full');
      expect(opts.method).toBe('POST');
    });
  });

  describe('summarize', () => {
    it('should summarize memories', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        summary: 'The agent has learned about TypeScript and testing.',
        memory_count: 15,
        topics: ['typescript', 'testing'],
      }));

      const result = await client.summarize({ agent_id: 'agent-1', limit: 20 });

      expect(result.summary).toContain('TypeScript');
      expect(result.topics).toContain('testing');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/knowledge/summarize');
      expect(opts.method).toBe('POST');
    });
  });

  describe('deduplicate', () => {
    it('should deduplicate memories', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        duplicates_found: 8,
        duplicates_removed: 8,
        clusters: 3,
      }));

      const result = await client.deduplicate({ agent_id: 'agent-1', threshold: 0.95 });

      expect(result.duplicates_found).toBe(8);
      expect(result.duplicates_removed).toBe(8);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/knowledge/deduplicate');
      expect(opts.method).toBe('POST');
    });
  });

  describe('crossAgentNetwork', () => {
    it('should build a cross-agent network graph', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        nodes: [
          { agent_id: 'agent-1', memory_count: 50 },
          { agent_id: 'agent-2', memory_count: 30 },
        ],
        edges: [{ source: 'agent-1', target: 'agent-2', weight: 0.7 }],
        stats: { total_cross_edges: 5 },
      }));

      const result = await client.crossAgentNetwork({ min_similarity: 0.5 });

      expect(result.nodes).toHaveLength(2);
      expect(result.stats.total_cross_edges).toBe(5);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/knowledge/network/cross-agent');
      expect(opts.method).toBe('POST');
    });

    it('should work with no request body', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ nodes: [], edges: [], stats: { total_cross_edges: 0 } }));

      const result = await client.crossAgentNetwork();

      expect(result.stats.total_cross_edges).toBe(0);
    });
  });

  describe('knowledgeQuery', () => {
    it('should query the knowledge graph with filters', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        nodes: [{ id: 'mem-1' }, { id: 'mem-2' }],
        edges: [{ source: 'mem-1', target: 'mem-2', type: 'related_to', weight: 0.85 }],
      }));

      const result = await client.knowledgeQuery('agent-1', {
        rootId: 'mem-1',
        edgeType: 'related_to',
        minWeight: 0.5,
        maxDepth: 2,
        limit: 50,
      });

      expect(result.nodes).toHaveLength(2);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/knowledge/query');
      expect(url).toContain('agent_id=agent-1');
      expect(url).toContain('root_id=mem-1');
      expect(url).toContain('edge_type=related_to');
      expect(url).toContain('min_weight=0.5');
      expect(url).toContain('max_depth=2');
      expect(url).toContain('limit=50');
      expect(opts.method).toBe('GET');
    });

    it('should query with only agent_id', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ nodes: [], edges: [] }));

      await client.knowledgeQuery('agent-1');

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('agent_id=agent-1');
      expect(url).not.toContain('root_id');
    });
  });

  describe('knowledgePath', () => {
    it('should find shortest path between two memories', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        path: ['mem-1', 'mem-3', 'mem-5'],
        hops: 2,
        total_weight: 1.7,
      }));

      const result = await client.knowledgePath('agent-1', 'mem-1', 'mem-5');

      expect(result.path).toEqual(['mem-1', 'mem-3', 'mem-5']);
      expect(result.hops).toBe(2);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/knowledge/path');
      expect(url).toContain('agent_id=agent-1');
      expect(url).toContain('from=mem-1');
      expect(url).toContain('to=mem-5');
      expect(opts.method).toBe('GET');
    });
  });

  describe('knowledgeExport', () => {
    it('should export knowledge graph as JSON', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        agent_id: 'agent-1',
        format: 'json',
        nodes: [{ id: 'mem-1' }],
        edges: [],
        node_count: 1,
        edge_count: 0,
      }));

      const result = await client.knowledgeExport('agent-1');

      expect(result.agent_id).toBe('agent-1');
      expect(result.format).toBe('json');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/knowledge/export');
      expect(url).toContain('agent_id=agent-1');
      expect(url).toContain('format=json');
      expect(opts.method).toBe('GET');
    });

    it('should export as graphml format', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ format: 'graphml', data: '<graphml/>' }));

      await client.knowledgeExport('agent-1', 'graphml');

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('format=graphml');
    });
  });

  // ---------------------------------------------------------------------------
  // Memory Extended: consolidation, compress, updateImportance
  // ---------------------------------------------------------------------------

  describe('consolidateAgent', () => {
    it('should consolidate memories directly for an agent', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        clusters_found: 5,
        memories_merged: 12,
        total_processed: 100,
      }));

      const result = await client.consolidateAgent('agent-1');

      expect(result.clusters_found).toBe(5);
      expect(result.memories_merged).toBe(12);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/agents/agent-1/consolidate');
      expect(opts.method).toBe('POST');
    });
  });

  describe('getConsolidationLog', () => {
    it('should get consolidation execution log', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([
        { timestamp: 1700000000, clusters_found: 3, memories_merged: 6, duration_ms: 250 },
        { timestamp: 1700001000, clusters_found: 2, memories_merged: 4, duration_ms: 180 },
      ]));

      const result = await client.getConsolidationLog('agent-1');

      expect(result).toHaveLength(2);
      expect(result[0].clusters_found).toBe(3);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/agents/agent-1/consolidation/log');
      expect(opts.method).toBe('GET');
    });
  });

  describe('patchConsolidationConfig', () => {
    it('should update consolidation config for an agent', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        agent_id: 'agent-1',
        min_cluster_size: 3,
        similarity_threshold: 0.85,
        max_cluster_size: 10,
      }));

      const result = await client.patchConsolidationConfig('agent-1', {
        min_cluster_size: 3,
        similarity_threshold: 0.85,
      });

      expect(result.min_cluster_size).toBe(3);
      expect(result.similarity_threshold).toBe(0.85);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/agents/agent-1/consolidation/config');
      expect(opts.method).toBe('PATCH');
    });
  });

  describe('updateImportance', () => {
    it('should update importance for multiple memories', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ status: 'ok' }));
      mockFetch.mockResolvedValueOnce(jsonResponse({ status: 'ok' }));

      const result = await client.updateImportance('agent-1', {
        memory_ids: ['mem-1', 'mem-2'],
        importance: 0.9,
      });

      expect(result.status).toBe('ok');
      // Should have been called once per memory_id
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const body1 = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body1.agent_id).toBe('agent-1');
      expect(body1.memory_id).toBe('mem-1');
      expect(body1.importance).toBe(0.9);
    });
  });

  describe('compressAgent', () => {
    it('should compress memories for an agent', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        compressed_count: 15,
        saved_bytes: 4096,
        agent_id: 'agent-1',
      }));

      const result = await client.compressAgent('agent-1');

      expect(result.compressed_count).toBe(15);
      expect(result.saved_bytes).toBe(4096);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/agents/agent-1/compress');
      expect(opts.method).toBe('POST');
    });
  });
});
