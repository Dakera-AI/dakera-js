/**
 * Tests for DakeraClient Agent Methods
 * Covers: listAgents, agentMemories, agentStats, agentSessions,
 *         getWakeUpContext, compressAgent
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

describe('Agent Methods', () => {
  let client: DakeraClient;

  beforeEach(() => {
    client = new DakeraClient({ baseUrl: 'http://localhost:3000' });
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // listAgents
  // ---------------------------------------------------------------------------

  describe('listAgents', () => {
    it('should GET /v1/agents and return agent summaries', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([
        { agent_id: 'agent-1', memory_count: 42, session_count: 7, active_sessions: 1 },
        { agent_id: 'agent-2', memory_count: 15, session_count: 3, active_sessions: 0 },
      ]));

      const result = await client.listAgents();

      expect(result).toHaveLength(2);
      expect(result[0].agent_id).toBe('agent-1');
      expect(result[0].memory_count).toBe(42);
      expect(result[1].active_sessions).toBe(0);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/agents');
      expect(opts.method).toBe('GET');
    });

    it('should return empty array when no agents exist', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([]));
      const result = await client.listAgents();
      expect(result).toEqual([]);
    });

    it('should throw on 403', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(403, 'Admin scope required'));
      await expect(client.listAgents()).rejects.toThrow('Admin scope required');
    });
  });

  // ---------------------------------------------------------------------------
  // agentMemories
  // ---------------------------------------------------------------------------

  describe('agentMemories', () => {
    it('should GET /v1/agents/{agentId}/memories', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([
        { id: 'mem-1', content: 'user is a developer', memory_type: 'semantic', importance: 0.8, similarity: 1.0 },
      ]));

      const result = await client.agentMemories('agent-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('mem-1');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/agents/agent-1/memories');
      expect(opts.method).toBe('GET');
    });

    it('should pass memory_type and limit as query params', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([]));

      await client.agentMemories('agent-1', { memory_type: 'episodic', limit: 50 });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('memory_type=episodic');
      expect(url).toContain('limit=50');
    });

    it('should omit query string when no options given', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([]));

      await client.agentMemories('agent-1');

      const [url] = mockFetch.mock.calls[0];
      expect(url).not.toContain('?');
    });

    it('should throw on 404 for unknown agent', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(404, 'Agent not found'));
      await expect(client.agentMemories('missing')).rejects.toThrow('Agent not found');
    });
  });

  // ---------------------------------------------------------------------------
  // agentStats
  // ---------------------------------------------------------------------------

  describe('agentStats', () => {
    it('should GET /v1/agents/{agentId}/stats and return full stats', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        agent_id: 'agent-1',
        total_memories: 100,
        memories_by_type: { episodic: 60, semantic: 40 },
        total_sessions: 15,
        active_sessions: 2,
        avg_importance: 0.72,
        oldest_memory_at: '2026-01-01T00:00:00Z',
        newest_memory_at: '2026-08-06T12:00:00Z',
      }));

      const result = await client.agentStats('agent-1');

      expect(result.agent_id).toBe('agent-1');
      expect(result.total_memories).toBe(100);
      expect(result.memories_by_type.episodic).toBe(60);
      expect(result.avg_importance).toBeCloseTo(0.72);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/agents/agent-1/stats');
      expect(opts.method).toBe('GET');
    });

    it('should handle stats without optional fields', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        agent_id: 'new-agent',
        total_memories: 0,
        memories_by_type: {},
        total_sessions: 0,
        active_sessions: 0,
      }));

      const result = await client.agentStats('new-agent');
      expect(result.avg_importance).toBeUndefined();
      expect(result.oldest_memory_at).toBeUndefined();
    });

    it('should throw on 404 for unknown agent', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(404, 'Agent not found'));
      await expect(client.agentStats('missing')).rejects.toThrow('Agent not found');
    });
  });

  // ---------------------------------------------------------------------------
  // agentSessions
  // ---------------------------------------------------------------------------

  describe('agentSessions', () => {
    it('should GET /v1/agents/{agentId}/sessions', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([
        { id: 'sess-1', agent_id: 'agent-1', started_at: 1700000000 },
        { id: 'sess-2', agent_id: 'agent-1', started_at: 1700001000, ended_at: 1700002000 },
      ]));

      const result = await client.agentSessions('agent-1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('sess-1');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/agents/agent-1/sessions');
      expect(opts.method).toBe('GET');
    });

    it('should pass active_only and limit query params', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([]));

      await client.agentSessions('agent-1', { active_only: true, limit: 10 });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('active_only=true');
      expect(url).toContain('limit=10');
    });

    it('should omit query string when no options given', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([]));

      await client.agentSessions('agent-1');

      const [url] = mockFetch.mock.calls[0];
      expect(url).not.toContain('?');
    });
  });

  // ---------------------------------------------------------------------------
  // getWakeUpContext
  // ---------------------------------------------------------------------------

  describe('getWakeUpContext', () => {
    it('should GET /v1/agents/{agentId}/wake-up and return wake-up context', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        agent_id: 'agent-1',
        memories: [
          { id: 'mem-1', content: 'most important context', memory_type: 'semantic', importance: 0.95, similarity: 1.0 },
        ],
        total_available: 42,
      }));

      const result = await client.getWakeUpContext('agent-1');

      expect(result.agent_id).toBe('agent-1');
      expect(result.memories).toHaveLength(1);
      expect(result.total_available).toBe(42);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/agents/agent-1/wake-up');
      expect(opts.method).toBe('GET');
    });

    it('should pass top_n and min_importance as query params', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ agent_id: 'a', memories: [], total_available: 0 }));

      await client.getWakeUpContext('a', { top_n: 10, min_importance: 0.5 });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('top_n=10');
      expect(url).toContain('min_importance=0.5');
    });

    it('should return empty memories array when agent has no memories', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ agent_id: 'new', memories: [], total_available: 0 }));

      const result = await client.getWakeUpContext('new');
      expect(result.memories).toEqual([]);
      expect(result.total_available).toBe(0);
    });

    it('should throw on 404 for unknown agent', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(404, 'Agent not found'));
      await expect(client.getWakeUpContext('missing')).rejects.toThrow('Agent not found');
    });
  });

  // ---------------------------------------------------------------------------
  // compressAgent
  // ---------------------------------------------------------------------------

  describe('compressAgent', () => {
    it('should POST /v1/agents/{agentId}/compress and return stats', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        agent_id: 'agent-1',
        memories_before: 150,
        memories_after: 120,
        removed_count: 30,
        duration_ms: 245.7,
      }));

      const result = await client.compressAgent('agent-1');

      expect(result.agent_id).toBe('agent-1');
      expect(result.memories_before).toBe(150);
      expect(result.removed_count).toBe(30);
      expect(result.duration_ms).toBeCloseTo(245.7);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/v1/agents/agent-1/compress');
      expect(opts.method).toBe('POST');
    });

    it('should handle response without duration_ms', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({
        agent_id: 'a',
        memories_before: 10,
        memories_after: 10,
        removed_count: 0,
      }));

      const result = await client.compressAgent('a');
      expect(result.removed_count).toBe(0);
      expect(result.duration_ms).toBeUndefined();
    });

    it('should throw on 403 when insufficient scope', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(403, 'Write scope required'));
      await expect(client.compressAgent('a')).rejects.toThrow('Write scope required');
    });
  });
});
