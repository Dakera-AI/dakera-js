/**
 * Server v0.12.0 support: JSON errors + Retry-After, 413 / 501 / 409 mapping,
 * /health/ready semantics, attachments, records, per-request `lang`,
 * namespace config PUT and the extended capabilities document.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DakeraClient } from './client';
import {
  ConflictError,
  DakeraError,
  ErrorCode,
  NotFoundError,
  NotImplementedError,
  PayloadTooLargeError,
  ServerError,
  TimeoutError,
} from './errors';
import { parseCapabilities } from './capabilities';

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

function lastCall(): { url: string; init: RequestInit } {
  const c = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
  return { url: c[0] as string, init: c[1] as RequestInit };
}

describe('server v0.12.0', () => {
  let client: DakeraClient;
  let sleeps: number[];

  beforeEach(() => {
    mockFetch.mockReset();
    client = new DakeraClient({ baseUrl: 'http://localhost:3000', apiKey: 'k' });
    sleeps = [];
    vi.spyOn(client as any, 'sleep').mockImplementation(async (ms: number) => {
      sleeps.push(ms);
    });
  });

  describe('error mapping', () => {
    it('maps 413 QUOTA_EXCEEDED to PayloadTooLargeError.isQuota', async () => {
      mockFetch.mockResolvedValueOnce(
        json(413, { error: 'Quota exceeded', code: 'QUOTA_EXCEEDED', details: 'namespace: n, reason: hard' })
      );
      const err = await client.upsertRecords('n', []).catch((e) => e);
      expect(err).toBeInstanceOf(PayloadTooLargeError);
      expect(err.isQuota).toBe(true);
      expect(err.code).toBe(ErrorCode.QUOTA_EXCEEDED);
      expect(err.details).toContain('hard');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('maps 413 PAYLOAD_TOO_LARGE (oversize request) distinctly from quota', async () => {
      mockFetch.mockResolvedValueOnce(json(413, { error: 'too big', code: 'PAYLOAD_TOO_LARGE' }));
      const err = await client.upsertRecords('n', []).catch((e) => e);
      expect(err).toBeInstanceOf(PayloadTooLargeError);
      expect(err.isQuota).toBe(false);
      expect(err.code).toBe(ErrorCode.PAYLOAD_TOO_LARGE);
    });

    it('maps 501 FEATURE_DISABLED, never retries it, and keeps details', async () => {
      mockFetch.mockResolvedValue(
        json(501, {
          error: 'The attachments API is not enabled on this server',
          code: 'FEATURE_DISABLED',
          details: 'set DAKERA_ATTACHMENTS to enable it',
        })
      );
      const err = await client.listAttachments('ns').catch((e) => e);
      expect(err).toBeInstanceOf(NotImplementedError);
      expect(err.isFeatureDisabled).toBe(true);
      expect(err.details).toContain('DAKERA_ATTACHMENTS');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('maps 501 NOT_IMPLEMENTED (backend limit)', async () => {
      mockFetch.mockResolvedValueOnce(json(501, { error: 'x', code: 'NOT_IMPLEMENTED' }));
      const err = await client.listAttachments('ns').catch((e) => e);
      expect(err).toBeInstanceOf(NotImplementedError);
      expect(err.isFeatureDisabled).toBe(false);
    });

    it('maps 409 to ConflictError', async () => {
      mockFetch.mockResolvedValueOnce(json(409, { error: 'referenced', code: 'CONFLICT' }));
      const err = await client.deleteAttachment('ns', 'sha256:ab').catch((e) => e);
      expect(err).toBeInstanceOf(ConflictError);
    });

    it('exposes `resource` on 404 and JOB_NOT_FOUND', async () => {
      mockFetch.mockResolvedValueOnce(
        json(404, { error: 'job unknown, server restarted', code: 'JOB_NOT_FOUND', resource: 'job' })
      );
      const err = await client.getTranscriptionJob('ns', 'sha256:ab', 'job_1_0').catch((e) => e);
      expect(err).toBeInstanceOf(NotFoundError);
      expect(err.code).toBe(ErrorCode.JOB_NOT_FOUND);
      expect(err.resource).toBe('job');
    });

    it('survives a malformed JSON error body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => {
          throw new SyntaxError('bad');
        },
      });
      const err = await client.listAttachments('ns').catch((e) => e);
      expect(err).toBeInstanceOf(DakeraError);
      expect(err.statusCode).toBe(400);
    });
  });

  describe('Retry-After', () => {
    it('waits the 503 Retry-After seconds, then succeeds', async () => {
      mockFetch
        .mockResolvedValueOnce(
          json(503, { error: 'Service unavailable', code: 'SERVICE_UNAVAILABLE' }, { 'Retry-After': '7' })
        )
        .mockResolvedValueOnce(json(200, { attachments: [] }));
      const out = await client.listAttachments('ns');
      expect(out).toEqual([]);
      expect(sleeps).toEqual([7000]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('caps an absurd Retry-After at 60 s', async () => {
      mockFetch
        .mockResolvedValueOnce(json(503, { error: 's', code: 'SERVICE_UNAVAILABLE' }, { 'Retry-After': '3600' }))
        .mockResolvedValueOnce(json(200, { attachments: [] }));
      await client.listAttachments('ns');
      expect(sleeps).toEqual([60000]);
    });

    it('surfaces the final 503 with retryAfterSeconds', async () => {
      mockFetch.mockResolvedValue(
        json(503, { error: 's', code: 'SERVICE_UNAVAILABLE' }, { 'Retry-After': '5' })
      );
      const err = await client.listAttachments('ns').catch((e) => e);
      expect(err).toBeInstanceOf(ServerError);
      expect(err.retryAfterSeconds).toBe(5);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('still honours Retry-After on 429', async () => {
      mockFetch
        .mockResolvedValueOnce(json(429, { error: 'rl', code: 'RATE_LIMIT_EXCEEDED' }, { 'Retry-After': '2' }))
        .mockResolvedValueOnce(json(200, { attachments: [] }));
      await client.listAttachments('ns');
      expect(sleeps).toEqual([2000]);
    });
  });

  describe('health', () => {
    it('healthReady returns ready:false for a starting server (503) without retrying', async () => {
      mockFetch.mockResolvedValueOnce(
        json(503, { ready: false, version: '0.12.0', starting: true, reason: 'loading models', downloads: [] }, {
          'Retry-After': '5',
        })
      );
      const r = await client.healthReady();
      expect(r.ready).toBe(false);
      expect(r.starting).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('healthReady throws on a 503 that is not a readiness body', async () => {
      mockFetch.mockResolvedValueOnce(json(503, { error: 'x', code: 'SERVICE_UNAVAILABLE' }));
      await expect(client.healthReady()).rejects.toBeInstanceOf(ServerError);
    });

    it('waitUntilReady polls through 503 and connection errors until ready', async () => {
      mockFetch
        .mockResolvedValueOnce(json(503, { ready: false, version: 'v', starting: true, reason: 'models' }))
        .mockRejectedValueOnce(new Error('fetch failed'))
        .mockResolvedValueOnce(json(200, { ready: true, version: 'v', checks: {} }));
      const r = await client.waitUntilReady({ intervalMs: 10, timeoutMs: 5000 });
      expect(r.ready).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(lastCall().url).toBe('http://localhost:3000/health/ready');
    });

    it('waitUntilReady times out instead of treating 503 as healthy', async () => {
      mockFetch.mockResolvedValue(json(503, { ready: false, version: 'v', starting: true, reason: 'models' }));
      await expect(client.waitUntilReady({ intervalMs: 10, timeoutMs: 15 })).rejects.toBeInstanceOf(TimeoutError);
    });

    it('healthLive hits /health/live', async () => {
      mockFetch.mockResolvedValueOnce(json(200, { alive: true, version: 'v', uptime_seconds: 3 }));
      expect((await client.healthLive()).alive).toBe(true);
      expect(lastCall().url).toBe('http://localhost:3000/health/live');
    });
  });

  describe('attachments', () => {
    const REF = 'sha256:' + 'ab'.repeat(32);

    it('uploads raw bytes with their content type', async () => {
      mockFetch.mockResolvedValueOnce(
        json(201, { attachment_ref: REF, content_type: 'audio/wav', size_bytes: 3, created: true })
      );
      const bytes = new Uint8Array([1, 2, 3]);
      const r = await client.uploadAttachment('up', bytes, 'audio/wav');
      expect(r.created).toBe(true);
      const { url, init } = lastCall();
      expect(url).toBe('http://localhost:3000/v1/namespaces/up/attachments');
      expect(init.method).toBe('POST');
      expect(init.body).toBe(bytes);
      expect((init.headers as Record<string, string>)['Content-Type']).toBe('audio/wav');
      expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer k');
    });

    it('lists, downloads (bytes + type + etag) and deletes', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, { attachments: [{ attachment_ref: REF, content_type: 'image/png', size_bytes: 9 }] })
      );
      expect(await client.listAttachments('up')).toHaveLength(1);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'image/png', etag: `"${REF}"` }),
        arrayBuffer: async () => new Uint8Array([9, 8, 7]).buffer,
      });
      const dl = await client.downloadAttachment('up', REF);
      expect(Array.from(dl.data)).toEqual([9, 8, 7]);
      expect(dl.content_type).toBe('image/png');
      expect(dl.etag).toBe(REF);
      expect(lastCall().url).toBe(`http://localhost:3000/v1/namespaces/up/attachments/${encodeURIComponent(REF)}`);

      mockFetch.mockResolvedValueOnce({ ok: true, status: 204, headers: new Headers() });
      await client.deleteAttachment('up', REF);
      expect(lastCall().init.method).toBe('DELETE');
    });

    it('transcribe + poll until Completed', async () => {
      const accepted = {
        job_id: 'job_1_0',
        attachment_ref: REF,
        agent_id: 'a',
        memory_id: 'mem_1',
        model: 'whisper-tiny.en',
        status_url: `/v1/namespaces/up/attachments/${REF}/transcribe/job_1_0`,
      };
      mockFetch.mockResolvedValueOnce(json(202, accepted));
      const got = await client.transcribeAttachment('up', REF, { agent_id: 'a', tags: ['voice'], lang: 'en' });
      expect(got.memory_id).toBe('mem_1');
      expect(JSON.parse(lastCall().init.body as string)).toEqual({ agent_id: 'a', tags: ['voice'], lang: 'en' });
      expect(lastCall().url).toBe(`http://localhost:3000/v1/namespaces/up/attachments/${encodeURIComponent(REF)}/transcribe`);

      const job = (status: string, progress: number) => ({
        id: 'job_1_0', job_type: 't', status, created_at: 1, progress, metadata: {},
      });
      mockFetch
        .mockResolvedValueOnce(json(200, job('Running', 50)))
        .mockResolvedValueOnce(json(200, job('Completed', 100)));
      const done = await client.waitForAttachmentJob(got, { intervalMs: 1 });
      expect(done.status).toBe('Completed');
      expect(lastCall().url).toBe(`http://localhost:3000${accepted.status_url}`);
    });

    it('waitForAttachmentJob throws with the job error code on Failed', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, {
          id: 'j', job_type: 't', status: 'Failed', created_at: 1, progress: 5, metadata: {},
          message: 'no speech', error: { status: 400, code: 'INVALID_REQUEST' },
        })
      );
      const err = await client
        .waitForAttachmentJob({ status_url: '/x' } as never, { intervalMs: 1 })
        .catch((e) => e);
      expect(err).toBeInstanceOf(DakeraError);
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe(ErrorCode.INVALID_REQUEST);
    });

    it('waitForAttachmentJob times out', async () => {
      mockFetch.mockResolvedValue(
        json(200, { id: 'j', job_type: 't', status: 'Running', created_at: 1, progress: 5, metadata: {} })
      );
      await expect(
        client.waitForAttachmentJob({ status_url: '/x' } as never, { intervalMs: 10, timeoutMs: 5 })
      ).rejects.toBeInstanceOf(TimeoutError);
    });

    it('indexes an image and polls its job route', async () => {
      mockFetch.mockResolvedValueOnce(json(202, { job_id: 'job_2_0', attachment_ref: REF, agent_id: 'a', memory_id: 'm', model: 'colmodernvbert', status_url: 's' }));
      await client.indexImageAttachment('up', REF, { agent_id: 'a', content: 'page 1' });
      expect(lastCall().url).toMatch(/\/attachments\/.+\/index$/);
      mockFetch.mockResolvedValueOnce(json(200, { id: 'job_2_0', job_type: 'i', status: 'Pending', created_at: 1, progress: 0, metadata: {} }));
      await client.getImageIndexJob('up', REF, 'job_2_0');
      expect(lastCall().url).toMatch(/\/attachments\/.+\/index\/job_2_0$/);
    });

    it('stores a memory with attachment_ref and lang', async () => {
      mockFetch.mockResolvedValueOnce(json(200, { memory_id: 'm', agent_id: 'a', namespace: 'n' }));
      await client.storeMemory('a', { content: 'c', attachment_ref: REF, lang: 'de' });
      const body = JSON.parse(lastCall().init.body as string);
      expect(body).toMatchObject({ agent_id: 'a', attachment_ref: REF, lang: 'de' });
    });
  });

  describe('records', () => {
    it('upserts records with named representations', async () => {
      mockFetch.mockResolvedValueOnce(json(200, { upserted_count: 1 }));
      const r = await client.upsertRecords('docs', [
        {
          id: 'r1',
          values: [0.1, 0.2],
          representations: [
            { name: 'tokens', kind: 'token_multivector', vectors: [[0.1, 0.2], [0.3, 0.4]], store_as: 'f16' },
          ],
          metadata: { source: 'demo' },
        },
      ]);
      expect(r.upserted_count).toBe(1);
      const { url, init } = lastCall();
      expect(url).toBe('http://localhost:3000/v1/namespaces/docs/records');
      expect(JSON.parse(init.body as string).records[0].representations[0]).toMatchObject({
        name: 'tokens', kind: 'token_multivector', store_as: 'f16',
      });
    });

    it('gets a record manifest, with vectors only on request', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, {
          id: 'r1', dimension: 2,
          representations: [{ name: 'tokens', kind: 'token_multivector', dim: 2, count: 2, dtype: 'f16', bytes: 8 }],
        })
      );
      const v = await client.getRecord('docs', 'r1');
      expect(v.representations?.[0].dtype).toBe('f16');
      expect(lastCall().url).toBe('http://localhost:3000/v1/namespaces/docs/records/r1');
      mockFetch.mockResolvedValueOnce(json(200, { id: 'r1', dimension: 2, values: [1, 2] }));
      await client.getRecord('docs', 'r1', true);
      expect(lastCall().url).toBe('http://localhost:3000/v1/namespaces/docs/records/r1?include_vectors=true');
    });
  });

  describe('per-request lang', () => {
    it('is sent by recall, searchMemories, extractEntities and batch store', async () => {
      mockFetch.mockResolvedValueOnce(json(200, { memories: [] }));
      await client.recall('a', 'q', { lang: 'fr' });
      expect(JSON.parse(lastCall().init.body as string).lang).toBe('fr');

      mockFetch.mockResolvedValueOnce(json(200, { memories: [] }));
      await client.searchMemories('a', 'q', { lang: 'es' });
      expect(JSON.parse(lastCall().init.body as string).lang).toBe('es');

      mockFetch.mockResolvedValueOnce(json(200, { entities: [] }));
      await client.extractEntities('text', undefined, { lang: 'pt' });
      expect(JSON.parse(lastCall().init.body as string)).toMatchObject({ content: 'text', lang: 'pt' });

      mockFetch.mockResolvedValueOnce(json(200, { stored: [], stored_count: 0, total_embedding_time_ms: 0 }));
      await client.storeMemoriesBatch({ agent_id: 'a', memories: [{ content: 'c' }], lang: 'it' });
      expect(JSON.parse(lastCall().init.body as string).lang).toBe('it');

      mockFetch.mockResolvedValueOnce(json(200, { memory_id: 'm' }));
      await client.updateMemory('a', 'm', { content: 'x', lang: 'nl' });
      expect(JSON.parse(lastCall().init.body as string).lang).toBe('nl');
    });

    it('omits lang when not given (byte-identical to v0.11 requests)', async () => {
      mockFetch.mockResolvedValueOnce(json(200, { memories: [] }));
      await client.recall('a', 'q');
      expect('lang' in JSON.parse(lastCall().init.body as string)).toBe(false);
    });
  });

  describe('namespace entity config', () => {
    it('replaceNamespaceEntityConfig PUTs and clears entity_types', async () => {
      mockFetch.mockResolvedValueOnce(json(200, { namespace: 'n', extract_entities: true, entity_types: [] }));
      await client.replaceNamespaceEntityConfig('n', { extract_entities: true });
      const { url, init } = lastCall();
      expect(init.method).toBe('PUT');
      expect(url).toBe('http://localhost:3000/v1/namespaces/n/config');
      expect(JSON.parse(init.body as string)).toEqual({ extract_entities: true, entity_types: [] });
    });

    it('configureNamespaceNer keeps using PATCH (merge)', async () => {
      mockFetch.mockResolvedValueOnce(json(200, {}));
      await client.configureNamespaceNer('n', { extract_entities: true });
      expect(lastCall().init.method).toBe('PATCH');
    });
  });

  describe('capabilities (v0.12 sections)', () => {
    it('parses scoring, attachments and vision; defaults on a v0.11-shaped document', () => {
      const caps = parseCapabilities({
        capabilities_version: 1,
        scoring: {
          strategy: 'late-interaction', strategies_accepted: 'single-vector, late-interaction',
          late_interaction: { enabled: true, model_supported: true, lane: 'text', future: 1 },
        },
        attachments: {
          enabled: true, max_bytes: 26214400,
          transcription: { model: 'whisper-tiny.en', models: ['whisper-tiny.en'], media_types: ['audio/wav'], languages: ['en'], sample_rate_hz: 16000 },
        },
        vision: { enabled: false, model: 'colmodernvbert', models: ['colmodernvbert'], media_types: ['image/png'], dimension: 128 },
        unreadable_records: 2,
      });
      expect(caps.scoring.late_interaction_enabled).toBe(true);
      expect(caps.attachments.max_bytes).toBe(26214400);
      expect(caps.attachments.transcription.model).toBe('whisper-tiny.en');
      expect(caps.vision.enabled).toBe(false);
      expect(caps.vision.dimension).toBe(128);
      expect(caps.unreadable_records).toBe(2);

      const old = parseCapabilities({});
      expect(old.attachments.enabled).toBe(false);
      expect(old.scoring.strategy).toBe('single-vector');
      expect(old.vision.models).toEqual([]);
    });
  });
});
