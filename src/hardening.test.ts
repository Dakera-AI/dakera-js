/**
 * Server v0.12.3+: recall API (`neighborhood_mode`, `include_summaries`,
 * `matched_text` / `matched_ids` / `retrieval` / `context_of`,
 * `context_memories`), the strict admin request bodies (`deny_unknown_fields`
 * → 422), and the SDK's own hardening: the API key never leaves the
 * `Authorization` header, attempts are bounded by AbortController timeouts,
 * only safe requests are retried, the SSE parser follows the WHATWG rules,
 * and JSON from the server cannot touch a prototype.
 */

import { inspect } from 'node:util';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DakeraClient } from './client';
import {
  AuthenticationError,
  AuthorizationError,
  ConnectionError,
  DakeraError,
  TimeoutError,
  ValidationError,
} from './errors';
import type { MemoryEvent } from './types';

const KEY = 'dk_live_SUPERSECRET_0123456789';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function json(status: number, body: unknown, extra: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json', ...extra }),
    json: async () => body,
  };
}

function call(i = mockFetch.mock.calls.length - 1): { url: string; init: RequestInit; body: unknown } {
  const c = mockFetch.mock.calls[i];
  const init = c[1] as RequestInit;
  return {
    url: c[0] as string,
    init,
    body: typeof init.body === 'string' ? JSON.parse(init.body) : init.body,
  };
}

const MEM = (id: string, content = `content ${id}`) => ({
  id,
  memory_type: 'episodic',
  content,
  agent_id: 'a1',
  importance: 0.5,
  tags: [],
  created_at: 1791392203,
  last_accessed_at: 1791392203,
  access_count: 0,
});

const REPORT = { applied: true, candidates: 40 };

describe('recall: neighbourhood mode, summaries and result provenance', () => {
  let client: DakeraClient;
  beforeEach(() => {
    mockFetch.mockReset();
    client = new DakeraClient({ baseUrl: 'http://localhost:3000', maxRetries: 1 });
  });

  it('sends neighborhood_mode and include_summaries in snake_case, nothing undefined', async () => {
    mockFetch.mockResolvedValueOnce(json(200, { memories: [], query_embedding_time_ms: 1, search_time_ms: 2 }));
    await client.recall('a1', 'port', {
      top_k: 3,
      neighborhood_mode: 'separate',
      include_summaries: false,
      session_id: undefined,
      rerank: undefined,
    });
    const { url, body } = call();
    expect(url).toBe('http://localhost:3000/v1/memory/recall');
    expect(body).toEqual({
      query: 'port',
      top_k: 3,
      neighborhood_mode: 'separate',
      include_summaries: false,
      agent_id: 'a1',
    });
  });

  it('omits both fields when not given (server defaults apply)', async () => {
    mockFetch.mockResolvedValueOnce(json(200, { memories: [] }));
    await client.recall('a1', 'q');
    expect(call().body).toEqual({ query: 'q', agent_id: 'a1' });
  });

  it('forwards the other request options the server reads', async () => {
    mockFetch.mockResolvedValueOnce(json(200, { memories: [] }));
    await client.recall('a1', 'q', {
      fusion: 'minmax',
      vector_weight: 0.7,
      iterations: 2,
      neighborhood: false,
      rerank_candidates: 20,
      importance_weighted: false,
      session_id: 's1',
    });
    expect(call().body).toMatchObject({
      fusion: 'minmax',
      vector_weight: 0.7,
      iterations: 2,
      neighborhood: false,
      rerank_candidates: 20,
      importance_weighted: false,
      session_id: 's1',
    });
  });

  it('refuses an unknown neighborhood_mode before sending', async () => {
    await expect(
      client.recall('a1', 'q', { neighborhood_mode: 'sideways' as never }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('separate: context_memories are flattened with context_of and retrieval', async () => {
    mockFetch.mockResolvedValueOnce(
      json(200, {
        memories: [
          {
            memory: MEM('m1', 'deploy uses port 9000'),
            score: 0.8,
            smart_score: 0.9,
            matched_text: 'port 9000',
            matched_ids: ['mem_s1', 'mem_s2'],
          },
        ],
        context_memories: [
          {
            memory: MEM('n1', 'neighbour'),
            score: 0.31,
            retrieval: 'neighborhood',
            context_of: 'm1',
          },
        ],
        query_embedding_time_ms: 4,
        search_time_ms: 9,
        rerank: REPORT,
        rerank_report: REPORT,
      }),
    );
    const res = await client.recall('a1', 'port', { top_k: 1, neighborhood_mode: 'separate' });
    expect(res.memories).toHaveLength(1);
    const m = res.memories[0];
    expect(m.id).toBe('m1');
    expect(m.score).toBe(0.9);
    expect(m.matched_text).toBe('port 9000');
    expect(m.matched_ids).toEqual(['mem_s1', 'mem_s2']);
    expect(m.retrieval).toBeUndefined();
    expect(res.context_memories).toHaveLength(1);
    const ctx = res.context_memories![0];
    expect(ctx.id).toBe('n1');
    expect(ctx.context_of).toBe('m1');
    expect(ctx.retrieval).toBe('neighborhood');
    expect(ctx.score).toBe(0.31);
    expect(res.query_embedding_time_ms).toBe(4);
    expect(res.search_time_ms).toBe(9);
    expect(res.rerank_report).toEqual(REPORT);
    expect(res.rerank).toEqual(REPORT);
  });

  it('rank_score is the ranking score and never rises (#940)', async () => {
    mockFetch.mockResolvedValueOnce(
      json(200, {
        memories: [
          { memory: MEM('m1', 'a'), score: 0.0001, smart_score: 0.3, rank_score: 0.62 },
          { memory: MEM('m2', 'b'), score: 0.0023, smart_score: 0.5, rank_score: 0.41 },
        ],
        query_embedding_time_ms: 1,
        search_time_ms: 1,
        rerank: REPORT,
        rerank_report: REPORT,
      }),
    );
    const res = await client.recall('a1', 'q');
    expect(res.memories.map((m) => m.rank_score)).toEqual([0.62, 0.41]);
    expect(res.memories.map((m) => m.score)).toEqual([0.62, 0.41]);
  });

  it('inline: neighbourhood items after the ranked results keep retrieval', async () => {
    mockFetch.mockResolvedValueOnce(
      json(200, {
        memories: [
          { memory: MEM('m1'), score: 0.7, smart_score: 0.8 },
          { memory: MEM('n1'), score: 0.2, retrieval: 'neighborhood' },
        ],
      }),
    );
    const res = await client.recall('a1', 'q', { top_k: 1, neighborhood_mode: 'inline' });
    expect(res.memories.map((m) => m.retrieval)).toEqual([undefined, 'neighborhood']);
    expect(res.context_memories).toBeUndefined();
  });

  it('an older server (no new fields) yields the same shape as before', async () => {
    mockFetch.mockResolvedValueOnce(
      json(200, {
        memories: [{ memory: MEM('m1'), score: 0.5, weighted_score: 0.6 }],
        query_embedding_time_ms: 3,
        search_time_ms: 5,
      }),
    );
    const res = await client.recall('a1', 'q', { neighborhood_mode: 'separate', include_summaries: true });
    expect(Object.keys(res)).not.toContain('context_memories');
    expect(Object.keys(res)).not.toContain('associated_memories');
    const m = res.memories[0];
    expect(m.score).toBe(0.6);
    for (const k of ['matched_text', 'matched_ids', 'retrieval', 'context_of', 'depth']) {
      expect(Object.keys(m)).not.toContain(k);
    }
  });

  it('keeps vector_score / text_score / depth (they used to be dropped)', async () => {
    mockFetch.mockResolvedValueOnce(
      json(200, {
        memories: [{ memory: MEM('m1'), score: 0.5, vector_score: 0.4, text_score: 0.9 }],
        associated_memories: [{ memory: MEM('m2'), score: 0.3, depth: 2 }],
      }),
    );
    const res = await client.recall('a1', 'q', { include_associated: true });
    expect(res.memories[0].vector_score).toBe(0.4);
    expect(res.memories[0].text_score).toBe(0.9);
    expect(res.associated_memories![0].depth).toBe(2);
  });

  it('searchMemories carries matched_* and still accepts a bare array', async () => {
    mockFetch.mockResolvedValueOnce(
      json(200, {
        memories: [{ memory: MEM('m1'), score: 0.5, matched_ids: ['mem_s9'], matched_text: 's9' }],
        total_count: 1,
        rerank_report: { applied: false, candidates: 0, skipped: 'disabled' },
        effective_top_k: 10,
      }),
    );
    const items = await client.searchMemories('a1', 'q', { created_after: 1, sort_by: 'importance' });
    expect(items[0].matched_ids).toEqual(['mem_s9']);
    expect(items[0].matched_text).toBe('s9');
    expect(call().body).toEqual({ query: 'q', created_after: 1, sort_by: 'importance', agent_id: 'a1' });

    mockFetch.mockResolvedValueOnce(json(200, [{ memory: MEM('m2'), score: 0.1 }]));
    const old = await client.searchMemories('a1', 'q');
    expect(old[0].id).toBe('m2');
    expect(Object.keys(old[0])).not.toContain('matched_text');
  });
});

describe('strict admin request bodies (server answers 422 to unknown fields)', () => {
  let client: DakeraClient;
  beforeEach(() => {
    mockFetch.mockReset();
    client = new DakeraClient({ baseUrl: 'http://localhost:3000', apiKey: KEY, maxRetries: 1 });
  });

  it('createKey sends only name/scope/namespaces/expires_in_days, never undefined', async () => {
    mockFetch.mockResolvedValueOnce(json(201, { key_id: 'k', key: 'dk_new' }));
    await client.createKey({ name: 'ci', scope: 'write', namespaces: undefined, expires_in_days: 30 });
    expect(call().body).toEqual({ name: 'ci', scope: 'write', expires_in_days: 30 });
    expect(call().url).toBe('http://localhost:3000/admin/keys');
  });

  it('createKey keeps namespaces: null (every namespace)', async () => {
    mockFetch.mockResolvedValueOnce(json(201, { key_id: 'k' }));
    await client.createKey({ name: 'root', scope: 'admin', namespaces: null });
    expect(call().body).toEqual({ name: 'root', scope: 'admin', namespaces: null });
  });

  it.each([
    [{ permissions: ['read'] }, /'permissions'.*Use 'scope'/],
    [{ expires_at: '2027-01-01' }, /'expires_at'.*expires_in_days/],
    [{ namespace: 'a' }, /'namespace'.*namespaces/],
  ])('createKey refuses %o before sending', async (extra, msg) => {
    await expect(
      client.createKey({ name: 'x', scope: 'read', ...extra } as never),
    ).rejects.toThrow(msg);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('createKey requires a scope', async () => {
    await expect(client.createKey({ name: 'x' } as never)).rejects.toBeInstanceOf(ValidationError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('createNamespaceKey (number form) sends name, expires_in_days and the least-privilege scope', async () => {
    mockFetch.mockResolvedValueOnce(json(201, { key_id: 'k', key: 'dk' }));
    await client.createNamespaceKey('tenant-a', 'bot', 7);
    expect(call().url).toBe('http://localhost:3000/v1/namespaces/tenant-a/keys');
    expect(call().body).toEqual({ name: 'bot', expires_in_days: 7, scope: 'read' });
  });

  it('createNamespaceKey (options) omits undefined and refuses unknown options', async () => {
    mockFetch.mockResolvedValueOnce(json(201, { key_id: 'k', key: 'dk' }));
    await client.createNamespaceKey('tenant-a', 'bot', {
      scope: 'write',
      extra_namespaces: ['tenant-b'],
      expires_in_days: undefined,
    });
    expect(call().body).toEqual({ name: 'bot', scope: 'write', extra_namespaces: ['tenant-b'] });

    mockFetch.mockReset();
    await expect(
      client.createNamespaceKey('tenant-a', 'bot', { scope: 'read', namespaces: ['x'] } as never),
    ).rejects.toThrow(/'namespaces'.*extra_namespaces/);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('adminCreateBackup sends only defined known fields; `encrypted` is refused', async () => {
    mockFetch.mockResolvedValueOnce(json(200, { backup: { backup_id: 'b1' } }));
    await client.adminCreateBackup({ name: 'nightly', encrypt: true, namespaces: undefined, compression: 'zstd' });
    expect(call().body).toEqual({ name: 'nightly', encrypt: true, compression: 'zstd' });

    mockFetch.mockReset();
    await expect(
      client.adminCreateBackup({ name: 'n', encrypted: true } as never),
    ).rejects.toThrow(/'encrypted'.*Use 'encrypt'/);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('createBackup (deprecated) sends a valid request and returns the backup', async () => {
    mockFetch.mockResolvedValueOnce(json(200, { backup: { backup_id: 'b2', name: 'x' } }));
    const info = await client.createBackup();
    const body = call().body as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(['name']);
    expect(String(body.name)).toMatch(/^backup-\d+$/);
    expect((info as unknown as { backup_id: string }).backup_id).toBe('b2');
    await expect(client.createBackup(false)).rejects.toBeInstanceOf(ValidationError);
  });

  it('listBackups unwraps {backups, total}', async () => {
    mockFetch.mockResolvedValueOnce(json(200, { backups: [{ backup_id: 'b1' }], total: 1 }));
    expect(await client.listBackups()).toHaveLength(1);
  });

  it('rotateEncryptionKey sends only new_key / namespace / wait_secs when defined', async () => {
    const RESP = { rotated: 1, skipped: 0, namespaces: ['n'], key_id: 'k2', scope: 'namespace', reseal: 'done', status_url: '/admin/encryption/status' };
    mockFetch.mockResolvedValueOnce(json(200, RESP));
    const res = await client.rotateEncryptionKey('passphrase', 'tenant-a');
    expect(call().url).toBe('http://localhost:3000/v1/admin/encryption/rotate-key');
    expect(call().body).toEqual({ new_key: 'passphrase', namespace: 'tenant-a' });
    expect(res.key_id).toBe('k2');

    mockFetch.mockResolvedValueOnce(json(200, RESP));
    await client.rotateEncryptionKey({ wait_secs: 0 });
    expect(call().body).toEqual({ wait_secs: 0 });

    mockFetch.mockResolvedValueOnce(json(200, RESP));
    await client.rotateEncryptionKey();
    expect(call().body).toEqual({});

    mockFetch.mockReset();
    await expect(
      client.rotateEncryptionKey({ namespaces: ['a'] } as never),
    ).rejects.toThrow(/'namespaces'/);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('opsShutdown: a 403 for a non-super_admin key is final (one call)', async () => {
    mockFetch.mockResolvedValue(json(403, { error: 'requires super_admin', code: 'INSUFFICIENT_SCOPE' }));
    const c = new DakeraClient({ baseUrl: 'http://localhost:3000', apiKey: KEY, maxRetries: 3 });
    await expect(c.opsShutdown()).rejects.toBeInstanceOf(AuthorizationError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe('the API key never leaks', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  const leaks = (value: unknown): boolean => {
    const err = value as Error;
    const texts = [
      String(value),
      JSON.stringify(value),
      inspect(value, { depth: 5, showHidden: true }),
      err?.message ?? '',
      err?.stack ?? '',
    ];
    return texts.some((t) => t.includes(KEY) || t.includes(encodeURIComponent(KEY)));
  };

  it('not in JSON.stringify / String / inspect / Object.keys of the client', () => {
    const client = new DakeraClient({ baseUrl: 'http://localhost:3000', apiKey: KEY });
    expect(leaks(client)).toBe(false);
    expect(Object.keys(client).join(',')).not.toMatch(/apiKey|headers/);
    expect(JSON.parse(JSON.stringify(client))).toEqual({ baseUrl: 'http://localhost:3000', hasApiKey: true });
  });

  it('sent as Authorization: Bearer, never in the URL', async () => {
    const client = new DakeraClient({ baseUrl: 'http://localhost:3000', apiKey: KEY, maxRetries: 1 });
    mockFetch.mockResolvedValueOnce(json(200, { status: 'ok' }));
    await client.health();
    const { url, init } = call();
    expect(url).not.toContain(KEY);
    expect((init.headers as Record<string, string>)['Authorization']).toBe(`Bearer ${KEY}`);
  });

  it('not in HTTP errors (401, 403, 500)', async () => {
    const client = new DakeraClient({ baseUrl: 'http://localhost:3000', apiKey: KEY, maxRetries: 1 });
    for (const status of [401, 403, 500]) {
      mockFetch.mockResolvedValueOnce(json(status, { error: 'nope', code: 'INVALID_API_KEY' }));
      const err = await client.health().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(DakeraError);
      expect(leaks(err)).toBe(false);
    }
  });

  it('not in connection or timeout errors, and user-info in the base URL is redacted', async () => {
    const client = new DakeraClient({
      baseUrl: 'http://admin:hunter2@localhost:3000',
      apiKey: KEY,
      maxRetries: 1,
    });
    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));
    const err = await client.health().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConnectionError);
    expect(leaks(err)).toBe(false);
    expect(String((err as Error).message)).not.toContain('hunter2');
    expect(String(client)).not.toContain('hunter2');
  });
});

describe('timeouts (AbortController)', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  const abortable = (signal: AbortSignal) =>
    new Promise<never>((_, reject) => {
      signal.addEventListener('abort', () => {
        const e = new Error('This operation was aborted');
        e.name = 'AbortError';
        reject(e);
      });
    });

  it('aborts a request that gets no answer', async () => {
    const client = new DakeraClient({ baseUrl: 'http://localhost:3000', timeout: 20, maxRetries: 1 });
    mockFetch.mockImplementation((_u: string, init: RequestInit) => abortable(init.signal as AbortSignal));
    await expect(client.health()).rejects.toBeInstanceOf(TimeoutError);
  });

  it('the deadline covers reading the body too', async () => {
    const client = new DakeraClient({ baseUrl: 'http://localhost:3000', timeout: 20, maxRetries: 1 });
    mockFetch.mockImplementation(async (_u: string, init: RequestInit) => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => abortable(init.signal as AbortSignal),
    }));
    await expect(client.health()).rejects.toBeInstanceOf(TimeoutError);
  });

  it('defaults to 30 s', () => {
    const client = new DakeraClient('http://localhost:3000');
    expect((client as unknown as { timeout: number }).timeout).toBe(30000);
  });
});

describe('retries: only when safe', () => {
  let client: DakeraClient;
  beforeEach(() => {
    mockFetch.mockReset();
    client = new DakeraClient({
      baseUrl: 'http://localhost:3000',
      retryBackoff: { maxRetries: 3, baseDelay: 0, jitter: false },
    });
  });
  afterEach(() => vi.useRealTimers());

  it('a 500 on a write (POST store) is not repeated', async () => {
    mockFetch.mockResolvedValue(json(500, { error: 'boom' }));
    await expect(client.storeMemory('a1', { content: 'x' } as never)).rejects.toMatchObject({ statusCode: 500 });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('a network error on a write is not repeated', async () => {
    mockFetch.mockRejectedValue(new TypeError('fetch failed'));
    await expect(client.storeMemory('a1', { content: 'x' } as never)).rejects.toBeInstanceOf(ConnectionError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('a 503 on a write is repeated (refused before processing), honouring Retry-After', async () => {
    mockFetch
      .mockResolvedValueOnce(json(503, { error: 'busy' }, { 'Retry-After': '0' }))
      .mockResolvedValueOnce(json(200, { memory: MEM('m1'), embedding_time_ms: 1 }));
    const res = await client.storeMemory('a1', { content: 'x' } as never);
    expect(res.memory.id).toBe('m1');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('a 429 is repeated for any method; an HTTP-date Retry-After is understood', async () => {
    const soon = new Date(Date.now() - 1000).toUTCString();
    mockFetch
      .mockResolvedValueOnce(json(429, { error: 'slow down' }, { 'Retry-After': soon }))
      .mockResolvedValueOnce(json(200, { memory: MEM('m1'), embedding_time_ms: 1 }));
    await client.storeMemory('a1', { content: 'x' } as never);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('a 500 on a read-only POST (recall) and a network error on a GET are repeated', async () => {
    mockFetch
      .mockResolvedValueOnce(json(500, { error: 'boom' }))
      .mockResolvedValueOnce(json(200, { memories: [] }));
    await client.recall('a1', 'q');
    expect(mockFetch).toHaveBeenCalledTimes(2);

    mockFetch.mockReset();
    mockFetch
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(json(200, { status: 'ok' }));
    await client.health();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('a long Retry-After is capped at 60 s', async () => {
    vi.useFakeTimers();
    mockFetch
      .mockResolvedValueOnce(json(429, { error: 'slow down' }, { 'Retry-After': '86400' }))
      .mockResolvedValueOnce(json(200, { status: 'ok' }));
    const p = client.health();
    await vi.advanceTimersByTimeAsync(60_000);
    await expect(p).resolves.toEqual({ status: 'ok' });
  });
});

describe('SSE streams', () => {
  let client: DakeraClient;
  beforeEach(() => {
    mockFetch.mockReset();
    client = new DakeraClient({ baseUrl: 'http://localhost:3000', apiKey: KEY });
  });

  function sse(chunks: string[], onCancel?: () => void): Response {
    const enc = new TextEncoder();
    let i = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (i < chunks.length) controller.enqueue(enc.encode(chunks[i++]));
        else controller.close();
      },
      cancel() {
        onCancel?.();
      },
    });
    return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  }

  async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
    const out: T[] = [];
    for await (const e of gen) out.push(e);
    return out;
  }

  it('sends the key in the Authorization header, not in the URL', async () => {
    mockFetch.mockResolvedValueOnce(sse([]));
    await collect(client.streamNamespaceEvents('ns'));
    const { url, init } = call();
    expect(url).toBe('http://localhost:3000/v1/namespaces/ns/events');
    expect(url).not.toContain('api_key');
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe(`Bearer ${KEY}`);
    expect(headers['Accept']).toBe('text/event-stream');
  });

  it('parses CRLF / CR / LF, a BOM, comments, multi-line data and split chunks', async () => {
    mockFetch.mockResolvedValueOnce(
      sse([
        '﻿: hello\r\n',
        'event: stored\r\ndata: {"event_type":"stored",\r',
        '\ndata:"agent_id":"a1","timestamp":1}\r\n\r\n',
        'event:deleted\rdata: {"agent_id":"a2","timestamp":2}\r\r',
        'data: not json\n\n',
        'event: forgotten\ndata: {"agent_id":"a3","timestamp":3}\n\n',
        'data: {"agent_id":"a4","timestamp":4}', // no terminating blank line: discarded
      ]),
    );
    const events = await collect(client.streamMemoryEvents());
    expect(events.map((e: MemoryEvent) => [e.event_type, e.agent_id])).toEqual([
      ['stored', 'a1'],
      ['deleted', 'a2'],
      ['forgotten', 'a3'],
    ]);
  });

  it('breaking out of the loop cancels the response body (closes the connection)', async () => {
    const cancel = vi.fn();
    mockFetch.mockResolvedValueOnce(
      sse(['data: {"type":"namespace_created","namespace":"a"}\n\n', 'data: {"type":"x"}\n\n'], cancel),
    );
    for await (const _e of client.streamNamespaceEvents('ns')) break;
    expect(cancel).toHaveBeenCalled();
  });

  it('an HTTP error is a typed DakeraError without the key', async () => {
    mockFetch.mockResolvedValueOnce(json(401, { error: 'invalid key', code: 'INVALID_API_KEY' }));
    const err = await collect(client.streamGlobalEvents()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthenticationError);
    expect(String(err)).not.toContain(KEY);
  });

  it('an event over the size cap fails the stream instead of growing without bound', async () => {
    const big = 'x'.repeat(600 * 1024);
    mockFetch.mockResolvedValueOnce(sse([`data: ${big}`, big, '\n\n']));
    await expect(collect(client.streamNamespaceEvents('ns'))).rejects.toThrow(/larger than/);
  });

  it('a "__proto__" key in an event cannot touch a prototype', async () => {
    mockFetch.mockResolvedValueOnce(
      sse(['data: {"type":"x","__proto__":{"polluted":true},"nested":{"__proto__":{"polluted":true}}}\n\n']),
    );
    const [ev] = await collect(client.streamNamespaceEvents('ns'));
    const raw = ev as unknown as Record<string, unknown>;
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(raw)).toBe(Object.prototype);
    expect(raw.polluted).toBeUndefined();
    expect((raw.nested as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('audit stream filters agent_id / event_type client-side (the server ignores them)', async () => {
    mockFetch.mockResolvedValueOnce(
      sse([
        'event: connected\ndata: {"type":"connected","timestamp":0}\n\n',
        'event: stored\ndata: {"event_type":"stored","agent_id":"a1","timestamp":1}\n\n',
        'event: stored\ndata: {"event_type":"stored","agent_id":"a2","timestamp":2}\n\n',
        'event: deleted\ndata: {"event_type":"deleted","agent_id":"a1","timestamp":3}\n\n',
      ]),
    );
    const events = await collect(client.streamAuditEvents({ agentId: 'a1', eventType: 'stored' }));
    expect(events.map((e) => (e as unknown as MemoryEvent).event_type)).toEqual(['connected', 'stored']);
  });
});

describe('JSON from the server cannot pollute prototypes; paths are encoded', () => {
  let client: DakeraClient;
  beforeEach(() => {
    mockFetch.mockReset();
    client = new DakeraClient({ baseUrl: 'http://localhost:3000', maxRetries: 1 });
  });

  it('a "__proto__" key in a recall result stays an own property of that result', async () => {
    const payload = JSON.parse(
      '{"memories":[{"memory":{"id":"m1","content":"c","__proto__":{"polluted":true}},"score":1,"__proto__":{"polluted":true}}]}',
    );
    mockFetch.mockResolvedValueOnce(json(200, payload));
    const res = await client.recall('a1', 'q');
    const m = res.memories[0] as unknown as Record<string, unknown>;
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(m)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(res)).toBe(Object.prototype);
  });

  it('namespace and ids are percent-encoded (no path traversal)', async () => {
    mockFetch.mockResolvedValueOnce(json(200, { namespace: 'x' }));
    await client.getNamespace('../admin/keys');
    expect(call().url).toBe('http://localhost:3000/v1/namespaces/..%2Fadmin%2Fkeys');
    mockFetch.mockResolvedValueOnce(json(200, { key_id: 'x' }));
    await client.getKey('a/b?c');
    expect(call().url).toBe('http://localhost:3000/admin/keys/a%2Fb%3Fc');
  });
});

describe('API parity fixes', () => {
  let client: DakeraClient;
  beforeEach(() => {
    mockFetch.mockReset();
    client = new DakeraClient({ baseUrl: 'http://localhost:3000', maxRetries: 1 });
  });

  it('createNamespace sends dimension and distance only', async () => {
    mockFetch.mockResolvedValueOnce(json(200, { namespace: 'n', dimension: 3, distance: 'cosine', created: true }));
    await client.createNamespace('n', { dimensions: 3, distance: 'cosine', metadata: { a: 1 } });
    expect(call().init.method).toBe('PUT');
    expect(call().body).toEqual({ dimension: 3, distance: 'cosine' });
  });

  it('slowQueries unwraps {queries}, sends the server filters and applies minDurationMs locally', async () => {
    mockFetch.mockResolvedValueOnce(
      json(200, {
        queries: [
          { id: 'q1', duration_ms: 50, timestamp: 1, namespace: 'n' },
          { id: 'q2', duration_ms: 500, timestamp: 2, namespace: 'n' },
        ],
        total: 2,
        threshold_ms: 10,
      }),
    );
    const res = await client.slowQueries({ namespace: 'n', queryType: 'hybrid', minDurationMs: 100 });
    expect(res.map((q) => q.id)).toEqual(['q2']);
    expect(call().url).toBe('http://localhost:3000/v1/admin/slow-queries?namespace=n&query_type=hybrid');
  });

  it('listNamespaces does not read inherited kinds', async () => {
    mockFetch.mockResolvedValueOnce(json(200, { namespaces: ['constructor', 'a'], kinds: { a: 'agent' } }));
    const list = await client.listNamespaces();
    expect(list[0].kind).toBeUndefined();
    expect(list[1].kind).toBe('agent');
  });

  it.each([
    ['adminListNamespaces', [], 'GET', '/v1/admin/namespaces', undefined],
    ['adminDeleteNamespace', ['_dakera_x'], 'DELETE', '/v1/admin/namespaces/_dakera_x', undefined],
    ['adminEncryptionStatus', [], 'GET', '/v1/admin/encryption/status', undefined],
    ['adminResealEncryption', [{ namespace: 'n' }], 'POST', '/v1/admin/encryption/reseal', { namespace: 'n' }],
    ['adminRevokeEncryptionMaster', ['k1'], 'POST', '/v1/admin/encryption/keys/k1/revoke-master', undefined],
    ['adminReembedMigrationStatus', [], 'GET', '/v1/admin/reembed/migration', undefined],
  ])('%s → %s %s', async (method, args, verb, path, body) => {
    mockFetch.mockResolvedValueOnce(json(200, { namespaces: [], total: 0, total_vectors: 0 }));
    await (client as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[method](...args);
    expect(call().init.method).toBe(verb);
    expect(call().url).toBe(`http://localhost:3000${path}`);
    expect(call().body).toEqual(body);
  });
});
