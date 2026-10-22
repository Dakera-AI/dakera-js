/**
 * Server v0.12.3 wire additions: event_time on store / batch store, the
 * truncation report, `warnings`, the deduplicated-memory routes, the autopilot
 * dedup fields, get_memory without agent_id, capabilities naming for session
 * ids, audit `reason`, the new error codes and the empty-agent 200. Fixtures
 * follow the server's serialized shapes (Dakera-AI/dakera v0.12.3); every test
 * of a response field also checks an older server's answer without it.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DakeraClient } from './client';
import { ConflictError, DakeraError, ErrorCode, NotFoundError, ValidationError } from './errors';
import { parseCapabilities } from './capabilities';
import { AUDIT_EVENT_DEDUPLICATED, AUTOPILOT_DEDUP_MODES } from './types';
import type { AutoPilotDedupMode, DocumentImportJob } from './types';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json', ...headers }),
    json: async () => body,
  };
}

function lastCall(): { url: string; method: string; body: unknown } {
  const c = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
  const init = c[1] as RequestInit;
  return {
    url: c[0] as string,
    method: init.method as string,
    body: typeof init.body === 'string' ? JSON.parse(init.body) : init.body,
  };
}

const MEMORY = {
  id: 'mem_1',
  memory_type: 'episodic',
  content: 'We moved the launch to Friday.',
  agent_id: 'planner',
  importance: 0.5,
  tags: [],
  metadata: { _dakera_content_date: 1684549260, _dakera_event_time: 1684549260 },
  created_at: 1792643474,
  last_accessed_at: 1792643474,
  access_count: 0,
};

const CUT = {
  truncated: true,
  content_tokens: 2804,
  embedded_tokens: 512,
  max_tokens: 512,
  windows: 0,
};

describe('server v0.12.3 additions', () => {
  let client: DakeraClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new DakeraClient({ baseUrl: 'http://localhost:3000', maxRetries: 1 });
  });

  // ---------------------------------------------------------------------------
  // event_time (#932)
  // ---------------------------------------------------------------------------

  describe('event_time', () => {
    it('storeMemory sends Unix seconds and RFC 3339 strings as given', async () => {
      mockFetch.mockResolvedValue(json(200, { memory: MEMORY, embedding_time_ms: 3 }));
      await client.storeMemory('planner', { content: 'x', event_time: 1684549260.75 });
      expect(lastCall().body).toEqual({ content: 'x', event_time: 1684549260.75, agent_id: 'planner' });

      await client.storeMemory('planner', { content: 'x', event_time: '2023-05-20T02:21:00+02:00' });
      expect((lastCall().body as Record<string, unknown>).event_time).toBe('2023-05-20T02:21:00+02:00');
    });

    it('storeMemory sends a Date as its ISO 8601 string', async () => {
      mockFetch.mockResolvedValueOnce(json(200, { memory: MEMORY, embedding_time_ms: 3 }));
      await client.storeMemory('planner', { content: 'x', event_time: new Date(Date.UTC(2023, 4, 20, 2, 21)) });
      expect((lastCall().body as Record<string, unknown>).event_time).toBe('2023-05-20T02:21:00.000Z');
    });

    it('leaves event_time out when unset', async () => {
      mockFetch.mockResolvedValueOnce(json(200, { memory: MEMORY, embedding_time_ms: 3 }));
      await client.storeMemory('planner', { content: 'x', event_time: undefined });
      expect(lastCall().body).toEqual({ content: 'x', agent_id: 'planner' });
    });

    it('refuses a value that is not a time before sending; bounds are the server\'s', async () => {
      await expect(client.storeMemory('planner', { content: 'x', event_time: Number.NaN })).rejects.toBeInstanceOf(
        ValidationError,
      );
      await expect(
        client.storeMemory('planner', { content: 'x', event_time: new Date('not a date') }),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(mockFetch).not.toHaveBeenCalled();

      // A year-3000 value is the server's to refuse (400 naming the field).
      mockFetch.mockResolvedValueOnce(
        json(400, { error: 'event_time must be at most 9999999999', code: 'INVALID_REQUEST', status: 400 }),
      );
      await expect(
        client.storeMemory('planner', { content: 'x', event_time: 32503680000 }),
      ).rejects.toBeInstanceOf(ValidationError);
      expect((lastCall().body as Record<string, unknown>).event_time).toBe(32503680000);
    });

    it('storeMemoriesBatch converts each item and names the item in errors', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, { stored: [MEMORY, MEMORY], stored_count: 2, total_embedding_time_ms: 9 }),
      );
      await client.storeMemoriesBatch({
        agent_id: 'planner',
        memories: [
          { content: 'a', event_time: new Date(Date.UTC(2023, 0, 1)) },
          { content: 'b', event_time: 1672531200 },
          { content: 'c' },
        ],
      });
      expect(lastCall().body).toEqual({
        agent_id: 'planner',
        memories: [
          { content: 'a', event_time: '2023-01-01T00:00:00.000Z' },
          { content: 'b', event_time: 1672531200 },
          { content: 'c' },
        ],
      });

      const err = await client
        .storeMemoriesBatch({ agent_id: 'planner', memories: [{ content: 'a' }, { content: 'b', event_time: Infinity }] })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as Error).message).toContain('memories[1].event_time');
    });
  });

  // ---------------------------------------------------------------------------
  // Store request fields the server knows (no `warnings` from the SDK itself)
  // ---------------------------------------------------------------------------

  describe('store request fields', () => {
    it('sends a custom id', async () => {
      mockFetch.mockResolvedValueOnce(json(200, { memory: MEMORY, embedding_time_ms: 3 }));
      await client.storeMemory('planner', { content: 'x', id: 'turn-17' });
      expect(lastCall().body).toEqual({ content: 'x', id: 'turn-17', agent_id: 'planner' });
    });

    it('sends the deprecated valid_from as metadata.valid_from, where the server reads it', async () => {
      mockFetch.mockResolvedValue(json(200, { memory: MEMORY, embedding_time_ms: 3 }));
      await client.storeMemory('planner', { content: 'x', valid_from: 1700000000, metadata: { k: 1 } });
      expect(lastCall().body).toEqual({ content: 'x', metadata: { k: 1, valid_from: 1700000000 }, agent_id: 'planner' });

      await client.storeMemory('planner', { content: 'x', valid_from: 1700000000, metadata: { valid_from: 1 } });
      expect((lastCall().body as Record<string, unknown>).metadata).toEqual({ valid_from: 1 });

      await client.storeMemoriesBatch({ agent_id: 'planner', memories: [{ content: 'y', valid_from: 5 } as never] });
      expect((lastCall().body as { memories: unknown[] }).memories[0]).toEqual({ content: 'y', metadata: { valid_from: 5 } });
    });

    it('does not mutate the caller\'s request', async () => {
      mockFetch.mockResolvedValueOnce(json(200, { memory: MEMORY, embedding_time_ms: 3 }));
      const when = new Date(Date.UTC(2023, 0, 1));
      const request = { content: 'x', event_time: when, valid_from: 7, metadata: { a: 1 } };
      await client.storeMemory('planner', request);
      expect(request).toEqual({ content: 'x', event_time: when, valid_from: 7, metadata: { a: 1 } });
    });

    it('session ids with ":" are sent unchanged', async () => {
      mockFetch.mockResolvedValueOnce(json(200, { memory: MEMORY, embedding_time_ms: 3, session_state: 'active' }));
      await client.storeMemory('planner', { content: 'x', session_id: 'eval:run_1:sample:0' });
      expect((lastCall().body as Record<string, unknown>).session_id).toBe('eval:run_1:sample:0');
    });
  });

  // ---------------------------------------------------------------------------
  // Truncation report (#933) and warnings (#938)
  // ---------------------------------------------------------------------------

  describe('truncation report and warnings', () => {
    it('storeMemory exposes the flattened truncation fields and warnings', async () => {
      mockFetch.mockResolvedValueOnce(
        json(
          200,
          { memory: MEMORY, embedding_time_ms: 40, ...CUT, tokens_estimated: true, warnings: ["unknown field 'when' ignored"] },
          { 'x-dakera-ignored-fields': 'when' },
        ),
      );
      const res = await client.storeMemory('planner', { content: 'long' });
      expect(res.truncated).toBe(true);
      expect(res.content_tokens).toBe(2804);
      expect(res.embedded_tokens).toBe(512);
      expect(res.max_tokens).toBe(512);
      expect(res.tokens_estimated).toBe(true);
      expect(res.windows).toBe(0);
      expect(res.warnings).toEqual(["unknown field 'when' ignored"]);
      expect(res.memory.id).toBe('mem_1');
    });

    it('an older server (or a short text) has none of them', async () => {
      mockFetch.mockResolvedValueOnce(json(200, { memory: MEMORY, embedding_time_ms: 3 }));
      const res = await client.storeMemory('planner', { content: 'short' });
      expect(res.truncated).toBeUndefined();
      expect(res.content_tokens).toBeUndefined();
      expect(res.warnings).toBeUndefined();
    });

    it('updateMemory returns the memory with the truncation report', async () => {
      mockFetch.mockResolvedValueOnce(json(200, { ...MEMORY, ...CUT, windows: 11 }));
      const res = await client.updateMemory('planner', 'mem_1', { content: 'long' });
      expect(res.id).toBe('mem_1');
      expect(res.truncated).toBe(true);
      expect(res.windows).toBe(11);

      mockFetch.mockResolvedValueOnce(json(200, MEMORY));
      const old = await client.updateMemory('planner', 'mem_1', { importance: 0.9 });
      expect(old.truncated).toBeUndefined();
      expect(old.content).toBe(MEMORY.content);
    });

    it('storeMemoriesBatch exposes truncated[] and warnings next to ended_sessions', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, {
          stored: [MEMORY],
          stored_count: 1,
          total_embedding_time_ms: 9,
          ended_sessions: ['sess_2'],
          truncated: [{ id: 'mem_1', ...CUT }],
          warnings: ["unknown field 'memories[].when' ignored (in 3 items)"],
        }),
      );
      const res = await client.storeMemoriesBatch({ agent_id: 'planner', memories: [{ content: 'long' }] });
      expect(res.truncated).toEqual([{ id: 'mem_1', ...CUT }]);
      expect(res.truncated?.[0].embedded_tokens).toBe(512);
      expect(res.warnings).toHaveLength(1);
      expect(res.ended_sessions).toEqual(['sess_2']);

      mockFetch.mockResolvedValueOnce(json(200, { stored: [MEMORY], stored_count: 1, total_embedding_time_ms: 9 }));
      const old = await client.storeMemoriesBatch({ agent_id: 'planner', memories: [{ content: 'x' }] });
      expect(old.truncated).toBeUndefined();
      expect(old.warnings).toBeUndefined();
    });

    it('recall keeps warnings and rerank_report.capped; an older server has neither', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, {
          memories: [{ memory: MEMORY, score: 0.9, rank_score: 0.8 }],
          query_embedding_time_ms: 5,
          search_time_ms: 7,
          rerank: { applied: true, candidates: 180, capped: true },
          rerank_report: { applied: true, candidates: 180, capped: true },
          warnings: ["unknown field 'filter.sesion_id' ignored"],
        }),
      );
      const res = await client.recall('planner', 'launch', { rerank_candidates: 500 });
      expect(res.warnings).toEqual(["unknown field 'filter.sesion_id' ignored"]);
      expect(res.rerank_report?.capped).toBe(true);
      expect(res.memories[0].score).toBe(0.8);

      mockFetch.mockResolvedValueOnce(
        json(200, {
          memories: [{ memory: MEMORY, score: 0.9 }],
          query_embedding_time_ms: 5,
          search_time_ms: 7,
          rerank: { applied: true, candidates: 10 },
          rerank_report: { applied: true, candidates: 10 },
        }),
      );
      const old = await client.recall('planner', 'launch');
      expect(old.warnings).toBeUndefined();
      expect(old.rerank_report?.capped).toBeUndefined();
    });

    it('batchRecall keeps warnings next to its own truncated flag', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, { memories: [MEMORY], total: 1, filtered: 1, truncated: false, warnings: ["unknown field 'x' ignored"] }),
      );
      const res = await client.batchRecall({ agent_id: 'planner' });
      expect(res.truncated).toBe(false);
      expect(res.warnings).toEqual(["unknown field 'x' ignored"]);
    });
  });

  // ---------------------------------------------------------------------------
  // Empty agent: 200 with no memories (v0.12.3), 404 on older servers
  // ---------------------------------------------------------------------------

  describe('agent that stored nothing', () => {
    it('recall / search / batch recall return empty results on a v0.12.3 server', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, {
          memories: [],
          query_embedding_time_ms: 56,
          search_time_ms: 0,
          rerank: { applied: false, candidates: 0, skipped: 'no_candidates' },
          rerank_report: { applied: false, candidates: 0, skipped: 'no_candidates' },
        }),
      );
      expect((await client.recall('fresh', 'anything')).memories).toEqual([]);

      mockFetch.mockResolvedValueOnce(json(200, { memories: [] }));
      expect(await client.searchMemories('fresh', 'anything')).toEqual([]);

      mockFetch.mockResolvedValueOnce(json(200, { memories: [], total: 0, filtered: 0, truncated: false }));
      expect((await client.batchRecall({ agent_id: 'fresh' })).memories).toEqual([]);
    });

    it('an older server still answers 404 NAMESPACE_NOT_FOUND, surfaced as NotFoundError', async () => {
      mockFetch.mockResolvedValueOnce(
        json(404, { error: "Namespace '_dakera_agent_fresh' not found", code: 'NAMESPACE_NOT_FOUND', status: 404 }),
      );
      const err = await client.recall('fresh', 'anything').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(NotFoundError);
      expect((err as NotFoundError).code).toBe(ErrorCode.NAMESPACE_NOT_FOUND);
    });
  });

  // ---------------------------------------------------------------------------
  // getMemory without agent_id (#938)
  // ---------------------------------------------------------------------------

  describe('getMemory', () => {
    it('with an agent id: unchanged route', async () => {
      mockFetch.mockResolvedValueOnce(json(200, MEMORY));
      await client.getMemory('my agent', 'mem/1');
      expect(lastCall().url).toBe('http://localhost:3000/v1/memory/get/mem%2F1?agent_id=my%20agent');
      expect(lastCall().method).toBe('GET');
    });

    it('with the id alone (or an undefined agent): no agent_id parameter', async () => {
      mockFetch.mockResolvedValue(json(200, MEMORY));
      const mem = await client.getMemory('mem_1');
      expect(mem.id).toBe('mem_1');
      expect(lastCall().url).toBe('http://localhost:3000/v1/memory/get/mem_1');

      await client.getMemory(undefined, 'mem 2');
      expect(lastCall().url).toBe('http://localhost:3000/v1/memory/get/mem%202');
    });

    it('several holders: 400 ValidationError; none: 404 NotFoundError', async () => {
      mockFetch.mockResolvedValueOnce(
        json(400, { error: 'memory mem_1 is held by agents a, b: pass agent_id', code: 'INVALID_REQUEST', status: 400 }),
      );
      await expect(client.getMemory('mem_1')).rejects.toBeInstanceOf(ValidationError);

      mockFetch.mockResolvedValueOnce(json(404, { error: 'not found', code: 'VECTOR_NOT_FOUND', status: 404 }));
      await expect(client.getMemory('mem_x')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('refuses an empty id before sending', async () => {
      await expect(client.getMemory('')).rejects.toBeInstanceOf(ValidationError);
      await expect(client.getMemory('agent', '')).rejects.toBeInstanceOf(ValidationError);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Deduplicated memories (#930)
  // ---------------------------------------------------------------------------

  describe('deduplicated memories', () => {
    const LIST = {
      agent_id: 'planner',
      memories: [
        {
          id: 'mem_9',
          kind: 'deduplication',
          survivor_id: 'mem_1',
          session_id: 'sess:1',
          deleted_at: 1792643474,
          restorable_until: 1793248274,
        },
        { id: 'mem_8', kind: 'consolidation', survivor_id: 'mem_c', deleted_at: 1792643000, restorable_until: 1793247800 },
      ],
      count: 2,
    };

    it('listDeduplicated reads GET /v1/memory/deduplicated?agent_id=', async () => {
      mockFetch.mockResolvedValueOnce(json(200, LIST));
      const res = await client.listDeduplicated('my agent');
      expect(lastCall().method).toBe('GET');
      expect(lastCall().url).toBe('http://localhost:3000/v1/memory/deduplicated?agent_id=my%20agent');
      expect(res.count).toBe(2);
      expect(res.memories[0].kind).toBe('deduplication');
      expect(res.memories[0].survivor_id).toBe('mem_1');
      expect(res.memories[1].session_id).toBeUndefined();
    });

    it('restoreDeduplicated POSTs with no body, escapes the id, returns the memory', async () => {
      mockFetch.mockResolvedValueOnce(json(200, { ...MEMORY, id: 'a/b c' }));
      const mem = await client.restoreDeduplicated('planner', 'a/b c');
      const call = lastCall();
      expect(call.method).toBe('POST');
      expect(call.url).toBe('http://localhost:3000/v1/memory/deduplicated/a%2Fb%20c/restore?agent_id=planner');
      expect(call.body).toBeUndefined();
      expect(mem.id).toBe('a/b c');
    });

    it('404 without a restorable copy, 409 when the agent holds the id again', async () => {
      mockFetch.mockResolvedValueOnce(
        json(404, { error: 'No restorable copy of memory nope', code: 'VECTOR_NOT_FOUND', status: 404, resource: 'memory' }),
      );
      const err = await client.restoreDeduplicated('planner', 'nope').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(NotFoundError);
      expect((err as NotFoundError).resource).toBe('memory');

      mockFetch.mockResolvedValueOnce(json(409, { error: 'agent holds mem_9 again', code: 'CONFLICT', status: 409 }));
      await expect(client.restoreDeduplicated('planner', 'mem_9')).rejects.toBeInstanceOf(ConflictError);
    });

    it('a restore is a write: not retried after a 500', async () => {
      const retrying = new DakeraClient({ baseUrl: 'http://localhost:3000', maxRetries: 3, retryConfig: { baseDelay: 1, maxDelay: 2 } });
      mockFetch.mockResolvedValue(json(500, { error: 'boom', code: 'INTERNAL_ERROR' }));
      await expect(retrying.restoreDeduplicated('planner', 'mem_9')).rejects.toBeInstanceOf(DakeraError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Autopilot (#930) and runtime config
  // ---------------------------------------------------------------------------

  describe('autopilot', () => {
    const CONFIG = {
      enabled: true,
      dedup_threshold: 0.93,
      dedup_interval_hours: 6,
      consolidation_interval_hours: 12,
      dedup_mode: 'off',
      dedup_cross_session: false,
      consolidate_cross_session: false,
      trash_retention_hours: 168,
    };

    it('status carries the dedup fields; an older server has none', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, {
          config: CONFIG,
          last_dedup_at: 1792643474,
          last_consolidation_at: null,
          last_dedup: { namespaces_processed: 3, memories_scanned: 90, duplicates_removed: 0, duplicates_found: 4 },
          last_consolidation: null,
          total_dedup_removed: 0,
          total_consolidated: 0,
        }),
      );
      const status = await client.autopilotStatus();
      expect(status.config.dedup_mode).toBe('off');
      expect(status.config.trash_retention_hours).toBe(168);
      expect(status.last_dedup?.duplicates_found).toBe(4);

      const { dedup_mode: _m, dedup_cross_session: _d, consolidate_cross_session: _c, trash_retention_hours: _t, ...old } = CONFIG;
      mockFetch.mockResolvedValueOnce(json(200, { config: old, total_dedup_removed: 0, total_consolidated: 0 }));
      const oldStatus = await client.autopilotStatus();
      expect(oldStatus.config.dedup_mode).toBeUndefined();
      expect(oldStatus.config.dedup_threshold).toBe(0.93);
    });

    it('autopilotUpdateConfig sends only the fields that are set', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, { success: true, config: { ...CONFIG, dedup_mode: 'report', trash_retention_hours: 24 }, message: 'ok' }),
      );
      const res = await client.autopilotUpdateConfig({
        dedup_mode: 'report',
        trash_retention_hours: 24,
        dedup_cross_session: undefined,
      });
      expect(lastCall().method).toBe('PUT');
      expect(lastCall().url).toBe('http://localhost:3000/v1/admin/autopilot/config');
      expect(lastCall().body).toEqual({ dedup_mode: 'report', trash_retention_hours: 24 });
      expect(res.config.dedup_mode).toBe('report');

      mockFetch.mockResolvedValueOnce(json(200, { success: true, config: CONFIG, message: 'ok' }));
      await client.autopilotUpdateConfig({ dedup_cross_session: true, consolidate_cross_session: false });
      expect(lastCall().body).toEqual({ dedup_cross_session: true, consolidate_cross_session: false });
    });

    it('refuses an unknown dedup_mode before sending', async () => {
      expect(AUTOPILOT_DEDUP_MODES).toEqual(['off', 'report', 'merge']);
      await expect(
        client.autopilotUpdateConfig({ dedup_mode: 'aggressive' as AutoPilotDedupMode }),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('trigger dedup result carries duplicates_found and mode; an older server has neither', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, {
          success: true,
          action: 'dedup',
          dedup: { namespaces_processed: 2, memories_scanned: 50, duplicates_removed: 0, duplicates_found: 3, mode: 'report' },
          message: 'done',
        }),
      );
      const res = await client.autopilotTrigger('dedup');
      expect(res.dedup?.duplicates_found).toBe(3);
      expect(res.dedup?.mode).toBe('report');

      mockFetch.mockResolvedValueOnce(
        json(200, {
          success: true,
          action: 'dedup',
          dedup: { namespaces_processed: 2, memories_scanned: 50, duplicates_removed: 1 },
          message: 'done',
        }),
      );
      const old = await client.autopilotTrigger('dedup');
      expect(old.dedup?.mode).toBeUndefined();
      expect(old.dedup?.duplicates_removed).toBe(1);
    });

    it('runtime config carries the autopilot_* overrides once set; updateConfig returns {success, config, message}', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, { autopilot_enabled: true, autopilot_dedup_mode: 'merge', autopilot_trash_retention_hours: 24 }),
      );
      const cfg = await client.getConfig();
      expect(cfg.autopilot_dedup_mode).toBe('merge');
      expect(cfg.autopilot_trash_retention_hours).toBe(24);
      expect(cfg.autopilot_dedup_cross_session).toBeUndefined();

      mockFetch.mockResolvedValueOnce(
        json(200, {
          success: true,
          config: { session_idle_timeout_secs: 3600, runtime_overrides: ['session_idle_timeout_secs'] },
          message: 'Configuration updated (1 keys applied)',
          warnings: ["unknown key 'nope'"],
        }),
      );
      const updated = await client.updateConfig({ session_idle_timeout_secs: 3600, nope: 1 });
      expect(updated.success).toBe(true);
      expect(updated.config?.runtime_overrides).toEqual(['session_idle_timeout_secs']);
      expect(updated.warnings).toEqual(["unknown key 'nope'"]);
    });
  });

  // ---------------------------------------------------------------------------
  // Capabilities naming, audit reason, error codes
  // ---------------------------------------------------------------------------

  describe('capabilities, audit, error codes', () => {
    const NAMING = {
      agent_id_pattern: '^[a-zA-Z0-9][a-zA-Z0-9_\\-.]*$',
      agent_id_max_bytes: 241,
      agent_namespace_prefix: '_dakera_agent_',
      agent_namespace_max_bytes: 255,
      namespace_pattern: '^[a-zA-Z0-9][a-zA-Z0-9_-]*$',
      namespace_max_bytes: 255,
      reserved_prefixes: ['_dakera_'],
      internal_namespaces: [],
      internal_prefixes: ['_dakera_trash_'],
    };

    it('naming gains session_id_pattern / session_id_max_bytes (absent on v0.12.2)', () => {
      const caps = parseCapabilities({
        capabilities_version: 2,
        naming: { ...NAMING, session_id_pattern: '^[a-zA-Z0-9][a-zA-Z0-9_\\-:.]*$', session_id_max_bytes: 256 },
      });
      expect(caps.naming?.session_id_pattern).toBe('^[a-zA-Z0-9][a-zA-Z0-9_\\-:.]*$');
      expect(caps.naming?.session_id_max_bytes).toBe(256);
      expect(new RegExp(caps.naming!.session_id_pattern!).test('eval:run_1:sample:0')).toBe(true);
      expect(caps.naming?.internal_prefixes).toContain('_dakera_trash_');

      const old = parseCapabilities({ capabilities_version: 2, naming: NAMING });
      expect(old.naming).toBeDefined();
      expect('session_id_pattern' in old.naming!).toBe(false);
      expect(old.naming?.session_id_max_bytes).toBeUndefined();
    });

    it('audit events carry reason; filter on the new event types', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, {
          events: [
            {
              id: 7,
              event_type: 'deduplicated',
              agent_id: 'planner',
              memory_id: 'mem_9',
              timestamp: 1792643474000,
              reason: 'absorbed into mem_1',
            },
            { id: 6, event_type: 'stored', agent_id: 'planner', memory_id: 'mem_1', timestamp: 1792643470000 },
          ],
          count: 2,
        }),
      );
      const res = await client.listAuditEvents({ agentId: 'planner', eventType: AUDIT_EVENT_DEDUPLICATED });
      expect(lastCall().url).toBe('http://localhost:3000/v1/audit?agent_id=planner&event_type=deduplicated');
      expect(res.events[0].reason).toBe('absorbed into mem_1');
      expect(res.events[1].reason).toBeUndefined();
    });

    it('429 keeps the server message, code and details (admission overload)', async () => {
      mockFetch.mockResolvedValueOnce(
        json(
          429,
          { error: 'Server busy: inference queue full', code: 'RATE_LIMIT_EXCEEDED', status: 429, details: 'embed queue' },
          { 'retry-after': '2' },
        ),
      );
      const err = await client.recall('planner', 'q').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(DakeraError);
      expect((err as DakeraError).message).toBe('Server busy: inference queue full');
      expect((err as DakeraError).code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
      expect((err as DakeraError).details).toBe('embed queue');
      expect((err as DakeraError).retryAfterSeconds).toBe(2);
    });

    it('422 strict-body refusals keep the server message and code', async () => {
      mockFetch.mockResolvedValueOnce(
        json(422, { error: "unknown field 'nope'", code: 'UNPROCESSABLE_CONTENT', status: 422 }),
      );
      const err = await client.health().catch((e: unknown) => e);
      expect((err as DakeraError).statusCode).toBe(422);
      expect((err as DakeraError).message).toContain("unknown field 'nope'");
      expect((err as DakeraError).code).toBe(ErrorCode.UNPROCESSABLE_CONTENT);
    });

    it('421 HOST_NOT_ALLOWED is a typed code', async () => {
      mockFetch.mockResolvedValueOnce(
        json(421, { error: 'host evil.example is not allowed', code: 'HOST_NOT_ALLOWED', status: 421 }),
      );
      const err = await client.health().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(DakeraError);
      expect((err as DakeraError).statusCode).toBe(421);
      expect((err as DakeraError).code).toBe(ErrorCode.HOST_NOT_ALLOWED);
      expect((err as DakeraError).message).toContain('host evil.example is not allowed');
    });

    it('a failed document job keeps UNPROCESSABLE_CONTENT / EXTRACTION_TIMEOUT as typed codes', async () => {
      const failed = (status: number, code: string): DocumentImportJob => ({
        id: 'job_1',
        job_type: 'document_import',
        status: 'Failed',
        created_at: 1792252596,
        progress: 40,
        message: 'failed',
        metadata: { namespace: '_dakera_agent_bot', agent_id: 'bot', document_id: 'd' },
        error: { status, code },
      });
      const accepted = { job_id: 'job_1', document_id: 'd', agent_id: 'bot', status_url: '' };

      mockFetch.mockResolvedValueOnce(json(200, failed(422, 'UNPROCESSABLE_CONTENT')));
      let err = await client.waitForDocumentJob(accepted, { intervalMs: 1 }).catch((e: unknown) => e);
      expect((err as DakeraError).code).toBe(ErrorCode.UNPROCESSABLE_CONTENT);

      mockFetch.mockResolvedValueOnce(json(200, failed(504, 'EXTRACTION_TIMEOUT')));
      err = await client.waitForDocumentJob(accepted, { intervalMs: 1 }).catch((e: unknown) => e);
      expect((err as DakeraError).code).toBe(ErrorCode.EXTRACTION_TIMEOUT);

      expect(ErrorCode.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED');
    });
  });
});
