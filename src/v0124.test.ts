/**
 * Server v0.12.4 wire additions: forget by description / by request and the
 * forget-request detector, restorable and dry-run forgets, the store's
 * `forget_request` and the batch's `forget_requests` / `duplicates`, recall's
 * `rerank_head`, `instructions` and `degraded`, `projection_days`, the async
 * import (and the multipart upload the server reads), the export file, session
 * `summary_pending`, key change answers, autopilot consolidation mode and the
 * smaller response fields. Fixtures follow the server's serialized shapes
 * (Dakera-AI/dakera v0.12.4); response-field tests also check an older
 * server's answer without them.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DakeraClient } from './client';
import { ConflictError, ServerError, ValidationError } from './errors';
import { AUTOPILOT_CONSOLIDATION_MODES } from './types';
import type { AutoPilotConsolidationMode, MemoryPolicy } from './types';

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

function file(text: string, contentType: string, headers: Record<string, string> = {}) {
  const bytes = new TextEncoder().encode(text);
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': contentType, ...headers }),
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}

function lastCall(): { url: string; method: string; body: unknown; headers: Record<string, string> } {
  const c = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
  const init = c[1] as RequestInit;
  return {
    url: c[0] as string,
    method: init.method as string,
    body: typeof init.body === 'string' ? JSON.parse(init.body) : init.body,
    headers: init.headers as Record<string, string>,
  };
}

const MEMORY = {
  id: 'mem_1',
  memory_type: 'episodic',
  content: 'I love sushi',
  agent_id: 'planner',
  importance: 0.5,
  tags: [],
  created_at: 1792643474,
  last_accessed_at: 1792643474,
  access_count: 0,
};

const CAPS = (version: string) => ({ capabilities_version: 2, server_version: version });

describe('server v0.12.4 additions', () => {
  let client: DakeraClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new DakeraClient({ baseUrl: 'http://localhost:3000', maxRetries: 1 });
  });

  // ---------------------------------------------------------------------------
  // Forget
  // ---------------------------------------------------------------------------

  describe('forgetMemories', () => {
    it('forgets by description: sends only the fields set, returns forgotten_ids', async () => {
      mockFetch.mockResolvedValueOnce(json(200, { deleted_count: 2, forgotten_ids: ['m2', 'm1'] }));
      const res = await client.forgetMemories('planner', {
        about: 'I love sushi',
        min_score: 0.6,
        limit: 5,
        until: 1792643474,
        restorable: true,
      });
      expect(lastCall().url).toBe('http://localhost:3000/v1/memory/forget');
      expect(lastCall().method).toBe('POST');
      expect(lastCall().body).toEqual({
        agent_id: 'planner',
        about: 'I love sushi',
        until: 1792643474,
        min_score: 0.6,
        limit: 5,
        restorable: true,
      });
      expect(res.deleted_count).toBe(2);
      expect(res.forgotten_ids).toEqual(['m2', 'm1']);
      // No filter: no version check was needed.
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('forgets by request and returns how the message was read', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, {
          deleted_count: 0,
          forgotten_ids: [],
          intent: { probability: 0.12, threshold: 0.5, is_request: false },
        }),
      );
      const res = await client.forgetMemories('planner', { request: "Don't forget my keys", dry_run: true });
      expect(lastCall().body).toEqual({ agent_id: 'planner', request: "Don't forget my keys", dry_run: true });
      expect(res.intent).toEqual({ probability: 0.12, threshold: 0.5, is_request: false });
      expect(res.intent?.sentence).toBeUndefined();
    });

    it('refuses about together with request before sending', async () => {
      await expect(
        client.forgetMemories('planner', { about: 'x', request: 'forget x' }),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('a filter-only forget is sent as is (no version check)', async () => {
      mockFetch.mockResolvedValueOnce(json(200, { deleted_count: 3 }));
      const res = await client.forgetMemories('planner', { tags: ['tmp'], memory_type: 'working' });
      expect(lastCall().body).toEqual({ agent_id: 'planner', memory_type: 'working', tags: ['tmp'] });
      expect(res).toEqual({ deleted_count: 3 });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('a v0.12.4 field with a filter checks the server version first', async () => {
      mockFetch
        .mockResolvedValueOnce(json(200, CAPS('0.12.4')))
        .mockResolvedValueOnce(json(200, { deleted_count: 0, forgotten_ids: ['a', 'b'] }));
      const res = await client.forgetMemories('planner', { session_id: 's1', dry_run: true });
      expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:3000/v1/capabilities');
      expect(lastCall().body).toEqual({ agent_id: 'planner', session_id: 's1', dry_run: true });
      expect(res.forgotten_ids).toEqual(['a', 'b']);
    });

    it('refuses a dry run with a filter on an older server (it would delete)', async () => {
      mockFetch.mockResolvedValueOnce(json(200, CAPS('0.12.3')));
      await expect(
        client.forgetMemories('planner', { memory_ids: ['m1'], dry_run: true }),
      ).rejects.toThrow(/v0\.12\.4\+.*v0\.12\.3/);
      // Only the capabilities read; no forget was sent.
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('refuses on a server without the capabilities route', async () => {
      mockFetch.mockResolvedValueOnce(json(404, { error: 'not found', code: 'ROUTE_NOT_FOUND' }));
      await expect(
        client.forgetMemories('planner', { tags: ['a'], restorable: true }),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('forget() returns the server answer { deleted_count }', async () => {
      mockFetch.mockResolvedValueOnce(json(200, { deleted_count: 1 }));
      const res = await client.forget('planner', 'mem_1');
      expect(res.deleted_count).toBe(1);
      expect(lastCall().body).toEqual({ agent_id: 'planner', memory_ids: ['mem_1'] });
    });

    it('a 503 (reranker unavailable) is retried after Retry-After, then surfaces', async () => {
      const c = new DakeraClient({ baseUrl: 'http://localhost:3000', maxRetries: 2 });
      mockFetch.mockResolvedValue(
        json(503, { error: 'no reranker', code: 'SERVICE_UNAVAILABLE' }, { 'Retry-After': '0' }),
      );
      const err = await c.forgetMemories('planner', { about: 'x' }).catch((e) => e);
      expect(err).toBeInstanceOf(ServerError);
      expect(err.statusCode).toBe(503);
      expect(err.retryAfterSeconds).toBe(0);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('detectForgetRequests', () => {
    it('posts the texts and returns one verdict per text', async () => {
      const answer = {
        model: 'multilingual-minilm',
        threshold: 0.5,
        sentence_threshold: 0.7,
        results: [
          { probability: 0.97, is_request: true },
          { probability: 0.02, is_request: false },
          { probability: 0.81, is_request: true, sentence: 'Oublie mon adresse.' },
        ],
      };
      mockFetch.mockResolvedValueOnce(json(200, answer));
      const res = await client.detectForgetRequests(['Forget that I love sushi', 'hi', 'long… Oublie mon adresse.']);
      expect(lastCall().url).toBe('http://localhost:3000/v1/memory/forget/detect');
      expect(lastCall().method).toBe('POST');
      expect(lastCall().body).toEqual({ texts: ['Forget that I love sushi', 'hi', 'long… Oublie mon adresse.'] });
      expect(res).toEqual(answer);
    });

    it('is retried after a timeout-like 5xx (it only reads)', async () => {
      const c = new DakeraClient({ baseUrl: 'http://localhost:3000', retryBackoff: { maxRetries: 2, baseDelay: 0, jitter: false } });
      mockFetch
        .mockResolvedValueOnce(json(502, { error: 'bad gateway' }))
        .mockResolvedValueOnce(json(200, { model: 'm', threshold: 0.5, sentence_threshold: 0.7, results: [] }));
      await c.detectForgetRequests(['x']);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('refuses an empty list before sending', async () => {
      await expect(client.detectForgetRequests([])).rejects.toBeInstanceOf(ValidationError);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Store / batch store
  // ---------------------------------------------------------------------------

  it('storeMemory passes forget_request through; absent from older servers', async () => {
    mockFetch.mockResolvedValueOnce(
      json(200, {
        memory: MEMORY,
        forget_request: { probability: 0.93, threshold: 0.5, is_request: true },
      }),
    );
    const res = await client.storeMemory('planner', { content: 'Please forget my address' });
    expect(res.forget_request?.is_request).toBe(true);

    mockFetch.mockResolvedValueOnce(json(200, { memory: MEMORY }));
    expect((await client.storeMemory('planner', { content: 'x' })).forget_request).toBeUndefined();
  });

  it('storeMemoriesBatch passes forget_requests and duplicates through', async () => {
    mockFetch.mockResolvedValueOnce(
      json(200, {
        stored: [],
        stored_count: 1,
        total_embedding_time_ms: 4,
        forget_requests: [{ id: 'm9', probability: 0.9, threshold: 0.5, is_request: true }],
        duplicates: [{ index: 1, existing_id: 'm3' }],
      }),
    );
    const res = await client.storeMemoriesBatch({
      agent_id: 'planner',
      memories: [{ content: 'Forget my address' }, { content: 'I love sushi' }],
    });
    expect(res.forget_requests?.[0]).toEqual({ id: 'm9', probability: 0.9, threshold: 0.5, is_request: true });
    expect(res.duplicates).toEqual([{ index: 1, existing_id: 'm3' }]);
  });

  // ---------------------------------------------------------------------------
  // Recall
  // ---------------------------------------------------------------------------

  describe('recall', () => {
    it('sends rerank_head when set; never sends importance_weighted / include_associated unless set', async () => {
      mockFetch.mockResolvedValue(json(200, { memories: [] }));
      await client.recall('planner', 'q');
      expect(lastCall().body).toEqual({ query: 'q', agent_id: 'planner' });

      await client.recall('planner', 'q', { top_k: 25, rerank_head: 0, include_associated: false });
      expect(lastCall().body).toEqual({
        query: 'q',
        top_k: 25,
        include_associated: false,
        rerank_head: 0,
        agent_id: 'planner',
      });
    });

    it('flattens instructions and passes degraded through', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, {
          memories: [{ memory: MEMORY, score: 0.8, rank_score: 0.8 }],
          associated_memories: [{ memory: { ...MEMORY, id: 'a1' }, score: 0, depth: 1 }],
          instructions: [
            {
              memory: { ...MEMORY, id: 'i1', content: 'From now on, answer in French', tags: ['dakera-instruction'] },
              score: 0.7,
              retrieval: 'instruction',
            },
          ],
          degraded: ['graph: storage read failed'],
        }),
      );
      const res = await client.recall('planner', 'q');
      expect(res.instructions).toHaveLength(1);
      expect(res.instructions?.[0].id).toBe('i1');
      expect(res.instructions?.[0].content).toBe('From now on, answer in French');
      expect(res.instructions?.[0].retrieval).toBe('instruction');
      expect(res.associated_memories?.[0].id).toBe('a1');
      expect(res.degraded).toEqual(['graph: storage read failed']);
    });

    it('an older server answer has neither instructions nor degraded', async () => {
      mockFetch.mockResolvedValueOnce(json(200, { memories: [{ memory: MEMORY, score: 0.8 }] }));
      const res = await client.recall('planner', 'q');
      expect(res.instructions).toBeUndefined();
      expect(res.degraded).toBeUndefined();
      expect('instructions' in res).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // getMemory projection
  // ---------------------------------------------------------------------------

  describe('getMemory projection_days', () => {
    it('sends projection_days and returns strength_projection', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, {
          ...MEMORY,
          strength_projection: [
            { day: 0, importance: 0.5 },
            { day: 1, importance: 0.48 },
          ],
        }),
      );
      const mem = await client.getMemory('planner', 'mem_1', { projection_days: 1 });
      expect(lastCall().url).toBe('http://localhost:3000/v1/memory/get/mem_1?agent_id=planner&projection_days=1');
      expect(mem.strength_projection).toEqual([
        { day: 0, importance: 0.5 },
        { day: 1, importance: 0.48 },
      ]);
    });

    it('works without the agent id', async () => {
      mockFetch.mockResolvedValueOnce(json(200, MEMORY));
      const mem = await client.getMemory(undefined, 'mem_1', { projection_days: 30 });
      expect(lastCall().url).toBe('http://localhost:3000/v1/memory/get/mem_1?projection_days=30');
      expect(mem.strength_projection).toBeUndefined();
    });

    it.each([0, 366, 1.5, Number.NaN])('refuses projection_days %s before sending', async (days) => {
      await expect(client.getMemory('planner', 'mem_1', { projection_days: days })).rejects.toBeInstanceOf(
        ValidationError,
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Deduplicated / restorable trash
  // ---------------------------------------------------------------------------

  it('listDeduplicated passes content and the deletion kind through', async () => {
    mockFetch.mockResolvedValueOnce(
      json(200, {
        agent_id: 'planner',
        memories: [
          {
            id: 'm1',
            kind: 'deletion',
            survivor_id: '',
            deleted_at: 1792643474,
            restorable_until: 1793248274,
            content: 'I love sushi',
          },
          { id: 'm2', kind: 'deduplication', survivor_id: 'm3', deleted_at: 1, restorable_until: 2 },
        ],
        count: 2,
      }),
    );
    const res = await client.listDeduplicated('planner');
    expect(res.memories[0].kind).toBe('deletion');
    expect(res.memories[0].content).toBe('I love sushi');
    expect(res.memories[1].content).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // Sessions
  // ---------------------------------------------------------------------------

  it('endSession: auto_summarize false is sent; summary_pending passes through', async () => {
    mockFetch.mockResolvedValueOnce(
      json(200, {
        session: { id: 's1', agent_id: 'planner', started_at: 1, ended_at: 2 },
        memory_count: 5,
        summary_pending: 'the store refused the summary memory; it is logged and stored once the store recovers',
      }),
    );
    const res = await client.endSession('s1', { auto_summarize: false });
    expect(lastCall().body).toEqual({ auto_summarize: false });
    expect(res.summary_pending).toMatch(/logged/);

    mockFetch.mockResolvedValueOnce(json(200, { session: { id: 's1' }, memory_count: 0 }));
    await client.endSession('s1');
    expect(lastCall().body).toEqual({});
  });

  // ---------------------------------------------------------------------------
  // Import / export
  // ---------------------------------------------------------------------------

  describe('importMemories', () => {
    it('uploads multipart with agent_id and format in the query', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, {
          job_id: 'j1',
          status: 'done',
          format: 'jsonl',
          total: 2,
          imported: 2,
          skipped: 0,
          errors: [],
          started_at: 10,
          finished_at: 11,
        }),
      );
      const res = await client.importMemories([{ content: 'a' }, { content: 'b' }], 'jsonl', 'planner');
      const call = lastCall();
      expect(call.url).toBe('http://localhost:3000/v1/import?agent_id=planner&format=jsonl');
      expect(call.method).toBe('POST');
      const contentType = call.headers['Content-Type'];
      expect(contentType).toMatch(/^multipart\/form-data; boundary=dakera-/);
      const boundary = contentType.split('boundary=')[1];
      const text = new TextDecoder().decode(call.body as Uint8Array);
      expect(text.startsWith(`--${boundary}\r\n`)).toBe(true);
      expect(text).toContain('Content-Disposition: form-data; name="file"; filename="import.jsonl"');
      expect(text).toContain('{"content":"a"}\n{"content":"b"}');
      expect(text.endsWith(`\r\n--${boundary}--\r\n`)).toBe(true);
      expect(res).toEqual({
        imported_count: 2,
        skipped_count: 0,
        errors: [],
        job_id: 'j1',
        status: 'done',
        format: 'jsonl',
        total: 2,
        started_at: 10,
        finished_at: 11,
      });
    });

    it('async: true answers the running job (202)', async () => {
      mockFetch.mockResolvedValueOnce(
        json(202, {
          job_id: 'j2',
          status: 'running',
          format: 'mem0',
          total: 1,
          imported: 0,
          skipped: 0,
          errors: [],
          started_at: 10,
          finished_at: null,
        }),
      );
      const res = await client.importMemories([{ memory: 'x' }], 'mem0', 'planner', undefined, { async: true });
      expect(lastCall().url).toBe('http://localhost:3000/v1/import?agent_id=planner&format=mem0&async=true');
      const text = new TextDecoder().decode(lastCall().body as Uint8Array);
      expect(text).toContain('{"memories":[{"memory":"x"}]}');
      expect(res.status).toBe('running');
      expect(res.job_id).toBe('j2');
      expect(res.finished_at).toBeUndefined();
    });

    it('needs agentId, and the CSV text for csv', async () => {
      await expect(client.importMemories([], 'jsonl')).rejects.toBeInstanceOf(ValidationError);
      await expect(client.importMemories([{ a: 1 }], 'csv', 'planner')).rejects.toBeInstanceOf(ValidationError);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('waitForImportJob polls until the job is not running', async () => {
      const status = (s: string, imported: number) => ({
        job_id: 'j2',
        status: s,
        format: 'jsonl',
        total: 2,
        imported,
        skipped: 0,
        errors: [],
        started_at: 10,
      });
      mockFetch
        .mockResolvedValueOnce(json(200, status('running', 1)))
        .mockResolvedValueOnce(json(200, { ...status('done', 2), finished_at: 12 }));
      const res = await client.waitForImportJob('j2', { intervalMs: 0 });
      expect(res.status).toBe('done');
      expect(lastCall().url).toBe('http://localhost:3000/v1/import/j2/status');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('exportMemories', () => {
    it('reads the JSON-lines file and the skipped header', async () => {
      mockFetch.mockResolvedValueOnce(
        file('{"id":"m1","content":"a"}\n{"id":"m2","content":"b"}\n', 'application/x-ndjson', {
          'x-dakera-export-skipped': '1',
        }),
      );
      const res = await client.exportMemories('jsonl', 'planner', undefined, 1);
      expect(lastCall().url).toBe('http://localhost:3000/v1/export?agent_id=planner&format=jsonl');
      expect(res.data).toEqual([{ id: 'm1', content: 'a' }]);
      expect(res.count).toBe(1);
      expect(res.skipped).toBe(1);
      expect(res.raw).toContain('"m2"');
    });

    it('reads CSV (quoted fields) and the Mem0 document', async () => {
      mockFetch.mockResolvedValueOnce(file('id,content\nm1,"a, ""quoted""\nline"\n', 'text/csv'));
      const csv = await client.exportMemories('csv', 'planner');
      expect(csv.data).toEqual([{ id: 'm1', content: 'a, "quoted"\nline' }]);
      expect(csv.skipped).toBe(0);

      mockFetch.mockResolvedValueOnce(file('{"memories":[{"id":"m1","memory":"a"}]}', 'application/json'));
      const mem0 = await client.exportMemories('mem0', 'planner');
      expect(mem0.data).toEqual([{ id: 'm1', memory: 'a' }]);
    });

    it('needs agentId', async () => {
      await expect(client.exportMemories('jsonl')).rejects.toBeInstanceOf(ValidationError);
    });
  });

  // ---------------------------------------------------------------------------
  // Smaller response fields
  // ---------------------------------------------------------------------------

  it('passes the smaller v0.12.4 response fields through', async () => {
    mockFetch.mockResolvedValueOnce(
      json(200, { namespace: 'ns', extract_entities: true, entity_types: ['person'], source: 'server_default' }),
    );
    expect((await client.getNamespaceEntityConfig('ns')).source).toBe('server_default');

    mockFetch.mockResolvedValueOnce(
      json(200, { entities: [], count: 0, extractor: 'rule_based', warnings: ['neural pass failed'] }),
    );
    const ext = await client.extractEntities('x', ['person']);
    expect(ext.extractor).toBe('rule_based');
    expect(ext.warnings).toEqual(['neural pass failed']);

    mockFetch.mockResolvedValueOnce(
      json(200, {
        duplicates_found: 2,
        removed_count: 0,
        groups: [],
        groups_failed: [{ canonical_id: 'c', duplicate_ids: ['d'], reason: 'write failed' }],
      }),
    );
    expect((await client.deduplicate({ agent_id: 'planner' })).groups_failed?.[0].reason).toBe('write failed');

    mockFetch.mockResolvedValueOnce(
      json(200, {
        agents: [],
        nodes: [],
        edges: [],
        stats: {},
        node_count: 0,
        unavailable: [{ agent_id: 'a', reason: 'read failed' }],
      }),
    );
    expect((await client.crossAgentNetwork()).unavailable).toEqual([{ agent_id: 'a', reason: 'read failed' }]);

    mockFetch.mockResolvedValueOnce(
      json(200, {
        agent_id: 'planner',
        memories_before: 3,
        memories_after: 2,
        removed_count: 1,
        deprecated_ids: ['m1'],
        deprecation_skipped: ['m2'],
        deprecation_error: null,
      }),
    );
    const comp = await client.compressAgent('planner');
    expect(comp.deprecation_skipped).toEqual(['m2']);
    expect(comp.deprecation_error).toBeNull();

    mockFetch.mockResolvedValueOnce(json(200, { from_id: 'a', to_id: 'b', edge_type: 'linked_by', label: 'caused' }));
    const link = await client.memoryLink('a', 'b', { agentId: 'planner', label: 'caused' });
    expect(lastCall().body).toEqual({ target_id: 'b', agent_id: 'planner', label: 'caused' });
    expect(link.label).toBe('caused');
    expect(link.edge.label).toBe('caused');

    mockFetch.mockResolvedValueOnce(
      json(200, { total_queries: 1, period: '1h', namespace: 'ns', uptime_seconds: 5 }),
    );
    const ov = await client.analyticsOverview({ period: '1h', namespace: 'ns' });
    expect(lastCall().url).toBe('http://localhost:3000/v1/analytics/overview?period=1h&namespace=ns');
    expect(ov.period).toBe('1h');
    expect(ov.namespace).toBe('ns');
  });

  // ---------------------------------------------------------------------------
  // Memory policy
  // ---------------------------------------------------------------------------

  it('getMemoryPolicy reads stored; setMemoryPolicy never sends it', async () => {
    mockFetch.mockResolvedValueOnce(json(200, { working_ttl_seconds: null, stored: false }));
    const policy = await client.getMemoryPolicy('ns');
    expect(policy.stored).toBe(false);
    expect(policy.working_ttl_seconds).toBeNull();

    mockFetch.mockResolvedValueOnce(json(200, { semantic_ttl_seconds: 86400 }));
    const toSet: MemoryPolicy = { ...policy, semantic_ttl_seconds: 86400 };
    await client.setMemoryPolicy('ns', toSet);
    expect(lastCall().method).toBe('PUT');
    expect(lastCall().body).toEqual({ working_ttl_seconds: null, semantic_ttl_seconds: 86400 });
  });

  // ---------------------------------------------------------------------------
  // Admin
  // ---------------------------------------------------------------------------

  describe('admin', () => {
    it('key revocation: 202 resolves with the server message; 409 is a ConflictError', async () => {
      mockFetch.mockResolvedValueOnce(
        json(202, { success: true, message: "API key 'k1' has been revoked on every node now; it could not be stored yet" }),
      );
      const res = await client.deleteKey('k1');
      expect(res.success).toBe(true);
      expect(res.message).toMatch(/could not be stored yet/);

      mockFetch.mockResolvedValueOnce(json(409, { error: 'a later change took over', code: 'CONFLICT' }));
      await expect(client.deactivateKey('k1')).rejects.toBeInstanceOf(ConflictError);
      expect(lastCall().url).toBe('http://localhost:3000/admin/keys/k1/deactivate');
    });

    it('autopilot consolidation_mode is validated and sent', async () => {
      expect(AUTOPILOT_CONSOLIDATION_MODES).toEqual(['off', 'report', 'merge']);
      await expect(
        client.autopilotUpdateConfig({ consolidation_mode: 'squash' as AutoPilotConsolidationMode }),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(mockFetch).not.toHaveBeenCalled();

      mockFetch.mockResolvedValueOnce(
        json(200, {
          success: true,
          message: 'ok',
          config: { enabled: true, dedup_threshold: 0.93, dedup_interval_hours: 6, consolidation_interval_hours: 12, consolidation_mode: 'merge' },
        }),
      );
      const res = await client.autopilotUpdateConfig({ consolidation_mode: 'merge' });
      expect(lastCall().body).toEqual({ consolidation_mode: 'merge' });
      expect(res.config.consolidation_mode).toBe('merge');
    });

    it('autopilot trigger and decay stats pass failures through', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, {
          success: false,
          action: 'all',
          dedup: { namespaces_processed: 1, memories_scanned: 2, duplicates_removed: 0, duplicates_found: 0, mode: 'report', failures: ['ns: read failed'] },
          consolidation: {
            namespaces_processed: 1,
            memories_scanned: 2,
            clusters_merged: 0,
            memories_consolidated: 0,
            clusters_found: 1,
            memories_in_clusters: 3,
            mode: 'report',
          },
          message: 'partial',
        }),
      );
      const trig = await client.autopilotTrigger('all');
      expect(trig.dedup?.failures).toEqual(['ns: read failed']);
      expect(trig.consolidation?.clusters_found).toBe(1);

      mockFetch.mockResolvedValueOnce(
        json(200, {
          total_decayed: 1,
          total_deleted: 0,
          cycles_run: 3,
          cycles_failed: 1,
          last_cycle: { namespaces_processed: 1, memories_processed: 1, memories_decayed: 1, memories_deleted: 0, failures: ['x'] },
        }),
      );
      const decay = await client.decayStats();
      expect(decay.cycles_failed).toBe(1);
      expect(decay.last_cycle?.failures).toEqual(['x']);
    });

    it('warmCache sends the v0.12.4 fields only when set', async () => {
      mockFetch.mockResolvedValue(
        json(200, { success: true, entries_warmed: 0, entries_skipped: 0, message: '', target_tier: 'l1', priority: 'normal' }),
      );
      await client.warmCache('ns');
      expect(lastCall().body).toEqual({
        namespace: 'ns',
        priority: 'normal',
        target_tier: 'l2',
        background: false,
        access_pattern: 'random',
      });
      await client.warmCache('ns', { queryVector: [0.1, 0.2], minScoreThreshold: 0.8, recentlyAccessedWithin: 3600 });
      expect(lastCall().body).toMatchObject({
        query_vector: [0.1, 0.2],
        min_score_threshold: 0.8,
        recently_accessed_within: 3600,
      });
    });

    it('adminRestoreBackup takes a point in time without a backup id', async () => {
      await expect(client.adminRestoreBackup({ overwrite: true })).rejects.toBeInstanceOf(ValidationError);
      expect(mockFetch).not.toHaveBeenCalled();
      mockFetch.mockResolvedValueOnce(
        json(202, { restore_id: 'r1', status: 'in_progress', backup_id: 'b1', namespaces: ['ns'], started_at: 1, total_expired: 0 }),
      );
      const res = await client.adminRestoreBackup({ point_in_time: 1792643474, overwrite: true });
      expect(lastCall().body).toEqual({ point_in_time: 1792643474, overwrite: true });
      expect(res.backup_id).toBe('b1');
    });

    it('ttl cleanup and derivation status pass the new fields through', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, {
          success: false,
          vectors_removed: 0,
          namespaces_cleaned: [],
          message: '1 namespace failed',
          failed: [{ namespace: 'ns', reason: 'read failed' }],
        }),
      );
      const ttl = await client.adminTtlCleanup();
      expect(ttl.success).toBe(false);
      expect(ttl.failed).toEqual([{ namespace: 'ns', reason: 'read failed' }]);

      mockFetch.mockResolvedValueOnce(
        json(200, {
          settled: false,
          entity_tagging: {
            mode: 'background',
            pending: 4,
            sweep_namespaces: [],
            tagged: 10,
            already_tagged: 0,
            superseded: 0,
            retried: 1,
            dropped_to_sweep: 0,
            failed: 0,
            extractor_gave_up: 0,
          },
        }),
      );
      const status = await client.adminDerivationStatus();
      expect(status.entity_tagging?.pending).toBe(4);
    });

    it('health passes degraded and config_warnings through', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, {
          status: 'healthy',
          degraded: [{ component: 'pending_writes', reason: '1 change not stored yet' }],
          config_warnings: [{ component: 'sizing', reason: '2 CPUs, 4 wanted' }],
        }),
      );
      const h = await client.health();
      expect(h.degraded?.[0].component).toBe('pending_writes');
      expect(h.config_warnings?.[0].component).toBe('sizing');
    });
  });

  // ---------------------------------------------------------------------------
  // Errors
  // ---------------------------------------------------------------------------

  it('a fenced namespace (503 + Retry-After: 5) is retried and its Retry-After surfaced', async () => {
    vi.useFakeTimers();
    try {
      const c = new DakeraClient({ baseUrl: 'http://localhost:3000', maxRetries: 2 });
      mockFetch.mockResolvedValue(
        json(503, { error: 'namespace is being torn down', code: 'SERVICE_UNAVAILABLE' }, { 'Retry-After': '5' }),
      );
      const pending = c.createNamespace('ns', { dimensions: 3 }).catch((e) => e);
      await vi.advanceTimersByTimeAsync(5000);
      const err = await pending;
      expect(err).toBeInstanceOf(ServerError);
      expect(err.retryAfterSeconds).toBe(5);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
