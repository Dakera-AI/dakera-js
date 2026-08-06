/**
 * Tests for DakeraClient Knowledge Graph Methods
 * Covers: knowledgeGraph, fullKnowledgeGraph, summarize, deduplicate,
 *         knowledgeQuery, knowledgePath, knowledgeExport, crossAgentNetwork
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

describe('Knowledge Graph Methods', () => {
  let client: DakeraClient;

  beforeEach(() => {
    client = new DakeraClient({ baseUrl: 'http://localhost:3000' });
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // knowledgeGraph
  // ---------------------------------------------------------------------------

  describe('knowledgeGraph', () => {
    it('should POST to /v1/knowledge/graph and return graph response', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        nodes: [
          { id: 'mem-1', content: 'user is a developer', memory_type: 'semantic', importance: 0.9 },
          { id: 'mem-2', content: 'user works at Dakera', memory_type: 'episodic' },
        ],
        edges: [
          { source: 'mem-1', target: 'mem-2', similarity: 0.85 },
        ],
      }));

      const result = await client.knowledgeGraph({ agent_id: 'agent-1' });

      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].similarity).toBe(0.85);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/knowledge/graph');
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body);
      expect(body.agent_id).toBe('agent-1');
    });

    it('should pass optional memory_id and depth', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ nodes: [], edges: [] }));

      await client.knowledgeGraph({ agent_id: 'a', memory_id: 'mem-x', depth: 2, min_similarity: 0.7 });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.memory_id).toBe('mem-x');
      expect(body.depth).toBe(2);
      expect(body.min_similarity).toBe(0.7);
    });

    it('should include clusters when returned by server', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        nodes: [{ id: 'n1', content: 'x' }, { id: 'n2', content: 'y' }],
        edges: [],
        clusters: [['n1', 'n2']],
      }));

      const result = await client.knowledgeGraph({ agent_id: 'a' });
      expect(result.clusters).toBeDefined();
      expect(result.clusters![0]).toContain('n1');
    });

    it('should throw on 404', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(404, 'Agent not found'));
      await expect(client.knowledgeGraph({ agent_id: 'missing' })).rejects.toThrow('Agent not found');
    });
  });

  // ---------------------------------------------------------------------------
  // fullKnowledgeGraph
  // ---------------------------------------------------------------------------

  describe('fullKnowledgeGraph', () => {
    it('should POST to /v1/knowledge/graph/full', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ nodes: [], edges: [] }));

      await client.fullKnowledgeGraph({ agent_id: 'a', max_nodes: 100, min_similarity: 0.5 });

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/knowledge/graph/full');
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body);
      expect(body.max_nodes).toBe(100);
      expect(body.min_similarity).toBe(0.5);
    });

    it('should pass all optional fields', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ nodes: [], edges: [] }));

      await client.fullKnowledgeGraph({
        agent_id: 'a',
        max_nodes: 200,
        min_similarity: 0.4,
        cluster_threshold: 0.8,
        max_edges_per_node: 10,
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.cluster_threshold).toBe(0.8);
      expect(body.max_edges_per_node).toBe(10);
    });
  });

  // ---------------------------------------------------------------------------
  // summarize
  // ---------------------------------------------------------------------------

  describe('summarize', () => {
    it('should POST to /v1/knowledge/summarize and return summary', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        summary: 'User is a developer working on AI products.',
        source_count: 5,
        new_memory_id: 'mem-sum-1',
      }));

      const result = await client.summarize({ agent_id: 'a', dry_run: false });

      expect(result.summary).toContain('developer');
      expect(result.source_count).toBe(5);
      expect(result.new_memory_id).toBe('mem-sum-1');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/knowledge/summarize');
      expect(opts.method).toBe('POST');
    });

    it('should pass memory_ids and target_type when provided', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ summary: 'x', source_count: 2 }));

      await client.summarize({
        agent_id: 'a',
        memory_ids: ['m1', 'm2'],
        target_type: 'semantic',
        dry_run: true,
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.memory_ids).toEqual(['m1', 'm2']);
      expect(body.target_type).toBe('semantic');
      expect(body.dry_run).toBe(true);
    });

    it('should handle response without new_memory_id (dry run)', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ summary: 'dry run result', source_count: 3 }));

      const result = await client.summarize({ agent_id: 'a', dry_run: true });
      expect(result.new_memory_id).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // deduplicate
  // ---------------------------------------------------------------------------

  describe('deduplicate', () => {
    it('should POST to /v1/knowledge/deduplicate and return dedup response', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        duplicates_found: 3,
        removed_count: 2,
        groups: [['mem-a', 'mem-b'], ['mem-c', 'mem-d', 'mem-e']],
      }));

      const result = await client.deduplicate({ agent_id: 'a' });

      expect(result.duplicates_found).toBe(3);
      expect(result.removed_count).toBe(2);
      expect(result.groups).toHaveLength(2);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/knowledge/deduplicate');
      expect(opts.method).toBe('POST');
    });

    it('should pass threshold and memory_type', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ duplicates_found: 0, removed_count: 0, groups: [] }));

      await client.deduplicate({ agent_id: 'a', threshold: 0.92, memory_type: 'episodic', dry_run: true });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.threshold).toBe(0.92);
      expect(body.memory_type).toBe('episodic');
      expect(body.dry_run).toBe(true);
    });

    it('should return empty groups when no duplicates found', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ duplicates_found: 0, removed_count: 0, groups: [] }));

      const result = await client.deduplicate({ agent_id: 'a' });
      expect(result.groups).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // knowledgeQuery
  // ---------------------------------------------------------------------------

  describe('knowledgeQuery', () => {
    it('should GET /v1/knowledge/query with agent_id param', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        agent_id: 'a',
        node_count: 4,
        edge_count: 3,
        edges: [],
      }));

      const result = await client.knowledgeQuery('a');

      expect(result.agent_id).toBe('a');
      expect(result.node_count).toBe(4);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/knowledge/query');
      expect(url).toContain('agent_id=a');
      expect(opts.method).toBe('GET');
    });

    it('should pass all optional query params', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ agent_id: 'a', node_count: 1, edge_count: 1, edges: [] }));

      await client.knowledgeQuery('a', {
        rootId: 'mem-root',
        edgeType: 'linked_by',
        minWeight: 0.6,
        maxDepth: 2,
        limit: 50,
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('root_id=mem-root');
      expect(url).toContain('edge_type=linked_by');
      expect(url).toContain('min_weight=0.6');
      expect(url).toContain('max_depth=2');
      expect(url).toContain('limit=50');
    });

    it('should throw on 404 when agent not found', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(404, 'Agent not found'));
      await expect(client.knowledgeQuery('missing')).rejects.toThrow('Agent not found');
    });
  });

  // ---------------------------------------------------------------------------
  // knowledgePath
  // ---------------------------------------------------------------------------

  describe('knowledgePath', () => {
    it('should GET /v1/knowledge/path with from/to params', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        agent_id: 'a',
        from_id: 'mem-1',
        to_id: 'mem-5',
        hop_count: 2,
        path: ['mem-1', 'mem-3', 'mem-5'],
      }));

      const result = await client.knowledgePath('a', 'mem-1', 'mem-5');

      expect(result.hop_count).toBe(2);
      expect(result.path).toEqual(['mem-1', 'mem-3', 'mem-5']);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/knowledge/path');
      expect(url).toContain('agent_id=a');
      expect(url).toContain('from=mem-1');
      expect(url).toContain('to=mem-5');
      expect(opts.method).toBe('GET');
    });

    it('should return hop_count=0 and single-element path for same source/target', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        agent_id: 'a',
        from_id: 'mem-1',
        to_id: 'mem-1',
        hop_count: 0,
        path: ['mem-1'],
      }));

      const result = await client.knowledgePath('a', 'mem-1', 'mem-1');
      expect(result.hop_count).toBe(0);
      expect(result.path).toHaveLength(1);
    });

    it('should throw NotFoundError when no path exists', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(404, 'No path between memories'));
      await expect(client.knowledgePath('a', 'mem-1', 'mem-999')).rejects.toThrow('No path between memories');
    });
  });

  // ---------------------------------------------------------------------------
  // knowledgeExport
  // ---------------------------------------------------------------------------

  describe('knowledgeExport', () => {
    it('should GET /v1/knowledge/export with json format by default', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        agent_id: 'a',
        format: 'json',
        node_count: 10,
        edge_count: 15,
        edges: [],
      }));

      const result = await client.knowledgeExport('a');

      expect(result.format).toBe('json');
      expect(result.node_count).toBe(10);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/knowledge/export');
      expect(url).toContain('format=json');
      expect(url).toContain('agent_id=a');
      expect(opts.method).toBe('GET');
    });

    it('should pass graphml format when specified', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ agent_id: 'a', format: 'graphml', node_count: 5, edge_count: 4, edges: [] }));

      await client.knowledgeExport('a', 'graphml');

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('format=graphml');
    });

    it('should throw on 403 when insufficient scope', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(403, 'Read scope required'));
      await expect(client.knowledgeExport('a')).rejects.toThrow('Read scope required');
    });
  });

  // ---------------------------------------------------------------------------
  // crossAgentNetwork
  // ---------------------------------------------------------------------------

  describe('crossAgentNetwork', () => {
    it('should POST to /v1/knowledge/network/cross-agent with empty body when no args', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        agents: [],
        nodes: [],
        edges: [],
        stats: { total_agents: 0, total_nodes: 0, total_cross_edges: 0, density: 0 },
        node_count: 0,
      }));

      const result = await client.crossAgentNetwork();

      expect(result.node_count).toBe(0);
      expect(result.agents).toHaveLength(0);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/knowledge/network/cross-agent');
      expect(opts.method).toBe('POST');
    });

    it('should pass filter parameters when provided', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        agents: [],
        nodes: [],
        edges: [],
        stats: { total_agents: 2, total_nodes: 50, total_cross_edges: 10, density: 0.1 },
        node_count: 50,
      }));

      await client.crossAgentNetwork({
        agent_ids: ['agent-1', 'agent-2'],
        min_similarity: 0.5,
        max_nodes_per_agent: 25,
        min_importance: 0.3,
        max_cross_edges: 100,
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.agent_ids).toEqual(['agent-1', 'agent-2']);
      expect(body.min_similarity).toBe(0.5);
      expect(body.max_nodes_per_agent).toBe(25);
    });

    it('should throw on 403 when non-admin key used', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(403, 'Admin scope required'));
      await expect(client.crossAgentNetwork()).rejects.toThrow('Admin scope required');
    });
  });
});
