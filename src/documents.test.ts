/**
 * Document import (server v0.12.3, Dakera-AI/dakera#923). Fixtures follow the
 * engine's wire types (`crates/common/src/types/document.rs`) and the job
 * record (`operations::JobInfo`); requests must carry only known fields.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DakeraClient } from './client';
import { DakeraError, NotFoundError, TimeoutError, ValidationError } from './errors';
import { parseCapabilities } from './capabilities';
import { documentChunkMeta, DOCUMENT_META_KEY } from './types';
import type { DocumentImportJob } from './types';

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

function call(i = mockFetch.mock.calls.length - 1): { url: string; method: string; body: unknown } {
  const c = mockFetch.mock.calls[i];
  const init = c[1] as RequestInit;
  return {
    url: c[0] as string,
    method: init.method as string,
    body: typeof init.body === 'string' ? JSON.parse(init.body) : init.body,
  };
}

const ACCEPTED = {
  job_id: 'job_1',
  document_id: 'manual-v3',
  agent_id: 'docs bot',
  status_url: '/v1/memory/documents/jobs/job_1?agent_id=docs bot',
};

function job(status: DocumentImportJob['status'], extra: Partial<DocumentImportJob> = {}): DocumentImportJob {
  return {
    id: 'job_1',
    job_type: 'document_import',
    status,
    created_at: 1792252596,
    started_at: 1792252596,
    completed_at: status === 'Completed' || status === 'Failed' ? 1792252600 : null,
    progress: status === 'Completed' ? 100 : 40,
    message: status === 'Completed' ? 'document imported: 3 chunks (3 written, 0 unchanged, 0 stale removed); chunks_stored 3/3' : 'chunks_stored 1/3',
    metadata: { namespace: '_dakera_agent_docs bot', agent_id: 'docs bot', document_id: 'manual-v3' },
    ...extra,
  };
}

const SUMMARY = {
  document_id: 'manual-v3',
  title: 'Field Manual',
  media_type: 'application/pdf',
  chunk_count: 212,
  bytes: 1843311,
  pages: 212,
  created_at: 1792252596,
  updated_at: 1792252596,
  sha256: 'ab12',
  attachment_ref: 'sha256:ab12',
};

const META = {
  id: 'manual-v3',
  title: 'Field Manual',
  media_type: 'application/pdf',
  chunk_index: 41,
  chunk_count: 212,
  page_start: 39,
  page_end: 40,
  heading_path: ['Field Manual', 'Install'],
  char_start: 80412,
  char_end: 81733,
  sha256: 'ab12',
  bytes: 1843311,
  pages: 212,
  created_at: 1792252596,
  updated_at: 1792252596,
  fingerprint: 'ff',
};

describe('document import', () => {
  let client: DakeraClient;
  beforeEach(() => {
    mockFetch.mockReset();
    client = new DakeraClient({ baseUrl: 'http://localhost:3000', maxRetries: 1 });
  });

  it('importDocument POSTs agent_id + the defined fields, chunking included', async () => {
    mockFetch.mockResolvedValueOnce(json(202, ACCEPTED));
    const res = await client.importDocument('docs bot', {
      content: '# Manual\n\ntext',
      media_type: 'text/markdown',
      title: undefined,
      tags: ['manual'],
      chunking: { max_tokens: 300, strategy: 'fixed', overlap_tokens: undefined },
      decompose: false,
    });
    expect(res).toEqual(ACCEPTED);
    const c = call();
    expect(c.method).toBe('POST');
    expect(c.url).toBe('http://localhost:3000/v1/memory/documents');
    expect(c.body).toEqual({
      agent_id: 'docs bot',
      content: '# Manual\n\ntext',
      media_type: 'text/markdown',
      tags: ['manual'],
      chunking: { max_tokens: 300, strategy: 'fixed' },
      decompose: false,
    });
  });

  it('refuses an unknown field or chunking option before sending', async () => {
    await expect(
      client.importDocument('a', { content: 'x', chunk_size: 3 } as never),
    ).rejects.toThrow(/'chunk_size'.*chunking: \{ max_tokens \}/);
    await expect(
      client.importDocument('a', { content: 'x', chunking: { size: 3 } } as never),
    ).rejects.toThrow(/chunking does not accept the field 'size'.*max_tokens/);
    await expect(
      client.importAttachmentDocument('ns', 'sha256:1', 'a', { content: 'x' } as never),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('importAttachmentDocument POSTs to the attachment route, path segments encoded', async () => {
    mockFetch.mockResolvedValueOnce(json(202, ACCEPTED));
    await client.importAttachmentDocument('library', 'sha256:ab12', 'docs bot', {
      document_id: 'manual-v3',
      importance: 0.7,
    });
    const c = call();
    expect(c.url).toBe('http://localhost:3000/v1/namespaces/library/attachments/sha256%3Aab12/document');
    expect(c.body).toEqual({ agent_id: 'docs bot', document_id: 'manual-v3', importance: 0.7 });

    mockFetch.mockResolvedValueOnce(json(202, ACCEPTED));
    await client.importAttachmentDocument('library', 'sha256:ab12', 'docs bot');
    expect(call().body).toEqual({ agent_id: 'docs bot' });
  });

  it('an older server (404 ROUTE_NOT_FOUND) is reported as needing v0.12.3+', async () => {
    mockFetch.mockResolvedValueOnce(json(404, { error: 'No route for POST /v1/memory/documents', code: 'ROUTE_NOT_FOUND' }));
    const err = await client.importDocument('a', { content: 'x' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NotFoundError);
    expect((err as Error).message).toMatch(/needs Dakera server v0\.12\.3\+/);

    // A missing document stays a plain 404.
    mockFetch.mockResolvedValueOnce(json(404, { error: 'document not found', code: 'NOT_FOUND' }));
    const err2 = await client.getDocument('a', 'nope').catch((e: unknown) => e);
    expect((err2 as Error).message).toBe('document not found');
  });

  it('501 FEATURE_DISABLED and 413 surface as typed errors', async () => {
    mockFetch.mockResolvedValueOnce(json(501, { error: 'documents are off', code: 'FEATURE_DISABLED', details: 'DAKERA_DOCUMENTS' }));
    await expect(client.importDocument('a', { content: 'x' })).rejects.toMatchObject({
      name: 'NotImplementedError',
      isFeatureDisabled: true,
    });
    mockFetch.mockResolvedValueOnce(json(413, { error: 'too big', code: 'PAYLOAD_TOO_LARGE' }));
    await expect(client.importDocument('a', { content: 'x' })).rejects.toMatchObject({
      name: 'PayloadTooLargeError',
    });
  });

  it('a 503 admission refusal is retried after Retry-After (the import was not started)', async () => {
    const c = new DakeraClient({ baseUrl: 'http://localhost:3000', retryBackoff: { maxRetries: 2, baseDelay: 0 } });
    mockFetch
      .mockResolvedValueOnce(json(503, { error: 'busy', code: 'SERVICE_UNAVAILABLE' }, { 'Retry-After': '0' }))
      .mockResolvedValueOnce(json(202, ACCEPTED));
    await expect(c.importDocument('a', { content: 'x' })).resolves.toEqual(ACCEPTED);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('getDocumentJob builds an encoded URL (not the server status_url)', async () => {
    mockFetch.mockResolvedValueOnce(json(200, job('Running')));
    const j = await client.getDocumentJob('docs bot', 'job_1');
    expect(j.status).toBe('Running');
    expect(call().url).toBe('http://localhost:3000/v1/memory/documents/jobs/job_1?agent_id=docs%20bot');
  });

  it('waitForDocumentJob polls until Completed', async () => {
    mockFetch
      .mockResolvedValueOnce(json(200, job('Pending')))
      .mockResolvedValueOnce(json(200, job('Running')))
      .mockResolvedValueOnce(json(200, job('Completed')));
    const done = await client.waitForDocumentJob(ACCEPTED, { intervalMs: 1 });
    expect(done.status).toBe('Completed');
    expect(done.progress).toBe(100);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('waitForDocumentJob throws the job error of a Failed job', async () => {
    mockFetch.mockResolvedValueOnce(
      json(200, job('Failed', { message: 'extraction timed out', error: { status: 504, code: 'EXTRACTION_TIMEOUT' } })),
    );
    const err = await client.waitForDocumentJob(ACCEPTED, { intervalMs: 1 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DakeraError);
    expect(err).toMatchObject({ statusCode: 504, details: 'extraction timed out' });
    expect((err as DakeraError).responseBody).toMatchObject({ status: 'Failed' });
  });

  it('waitForDocumentJob is bounded by timeoutMs', async () => {
    mockFetch.mockResolvedValue(json(200, job('Running')));
    await expect(
      client.waitForDocumentJob(ACCEPTED, { intervalMs: 20, timeoutMs: 30 }),
    ).rejects.toBeInstanceOf(TimeoutError);
  });

  it('waitForDocumentJob stops at once when the signal aborts (sleep or poll in flight)', async () => {
    mockFetch.mockResolvedValue(json(200, job('Running')));
    const ctl = new AbortController();
    const p = client.waitForDocumentJob(ACCEPTED, { intervalMs: 60_000, signal: ctl.signal });
    setTimeout(() => ctl.abort(new Error('user cancelled')), 10);
    await expect(p).rejects.toThrow('user cancelled');

    // Aborted while the poll itself is in flight.
    mockFetch.mockReset();
    mockFetch.mockImplementation(
      (_u: string, init: RequestInit) =>
        new Promise((_, reject) => {
          init.signal?.addEventListener('abort', () => {
            const e = new Error('aborted');
            e.name = 'AbortError';
            reject(e);
          });
        }),
    );
    const ctl2 = new AbortController();
    const p2 = client.waitForDocumentJob(ACCEPTED, { signal: ctl2.signal });
    setTimeout(() => ctl2.abort(), 10);
    await expect(p2).rejects.toMatchObject({ name: 'AbortError' });

    // Already aborted: no request at all.
    mockFetch.mockReset();
    const ctl3 = new AbortController();
    ctl3.abort();
    await expect(client.waitForDocumentJob(ACCEPTED, { signal: ctl3.signal })).rejects.toBeDefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('listDocuments sends agent_id / cursor / limit and reads next_cursor', async () => {
    mockFetch.mockResolvedValueOnce(json(200, { documents: [SUMMARY], next_cursor: 'manual-v3' }));
    const page = await client.listDocuments('docs bot', { cursor: 'a b', limit: 1 });
    expect(page.documents[0].attachment_ref).toBe('sha256:ab12');
    expect(page.next_cursor).toBe('manual-v3');
    expect(call().url).toBe('http://localhost:3000/v1/memory/documents?agent_id=docs+bot&cursor=a+b&limit=1');
  });

  it('iterateDocuments follows the cursor to the last page', async () => {
    mockFetch
      .mockResolvedValueOnce(json(200, { documents: [SUMMARY], next_cursor: 'manual-v3' }))
      .mockResolvedValueOnce(json(200, { documents: [{ ...SUMMARY, document_id: 'notes' }] }));
    const ids: string[] = [];
    for await (const d of client.iterateDocuments('a', { limit: 1 })) ids.push(d.document_id);
    expect(ids).toEqual(['manual-v3', 'notes']);
    expect(call(1).url).toContain('cursor=manual-v3');
  });

  it('getDocument and deleteDocument', async () => {
    mockFetch.mockResolvedValueOnce(
      json(200, {
        document: SUMMARY,
        chunks: [{ id: 'doc_1', chunk_index: 0, page_start: 1, page_end: 1, heading_path: ['Field Manual'], char_start: 0, char_end: 900 }],
      }),
    );
    const detail = await client.getDocument('docs bot', 'manual/v3');
    expect(call().url).toBe('http://localhost:3000/v1/memory/documents/manual%2Fv3?agent_id=docs%20bot');
    expect(detail.chunks[0].heading_path).toEqual(['Field Manual']);

    mockFetch.mockResolvedValueOnce(json(200, { document_id: 'manual-v3', deleted_chunks: 212 }));
    const del = await client.deleteDocument('docs bot', 'manual-v3');
    expect(call().method).toBe('DELETE');
    expect(del.deleted_chunks).toBe(212);
  });
});

describe('documentChunkMeta()', () => {
  it('reads _dakera_document from a recalled memory', async () => {
    mockFetch.mockReset();
    const client = new DakeraClient({ baseUrl: 'http://localhost:3000', maxRetries: 1 });
    mockFetch.mockResolvedValueOnce(
      json(200, {
        memories: [
          {
            memory: {
              id: 'doc_9',
              content: 'Field Manual › Install\n\ntext',
              memory_type: 'episodic',
              importance: 0.5,
              metadata: { team: 'x', [DOCUMENT_META_KEY]: META },
            },
            score: 0.8,
          },
          { memory: { id: 'm2', content: 'plain', memory_type: 'episodic', importance: 0.5 }, score: 0.2 },
        ],
      }),
    );
    const res = await client.recall('docs bot', 'install');
    const meta = documentChunkMeta(res.memories[0]);
    expect(meta).toEqual(META);
    expect(meta?.decompose).toBeUndefined();
    expect(documentChunkMeta(res.memories[1])).toBeUndefined();
  });

  it('is undefined for malformed or inherited values, and defaults optional fields', () => {
    expect(documentChunkMeta(undefined)).toBeUndefined();
    expect(documentChunkMeta({ metadata: null })).toBeUndefined();
    expect(documentChunkMeta({ metadata: { [DOCUMENT_META_KEY]: 'x' } })).toBeUndefined();
    expect(documentChunkMeta({ metadata: { [DOCUMENT_META_KEY]: { id: 'd' } } })).toBeUndefined();
    expect(documentChunkMeta({ metadata: Object.create({ [DOCUMENT_META_KEY]: META }) })).toBeUndefined();
    const minimal = documentChunkMeta({
      metadata: {
        [DOCUMENT_META_KEY]: { id: 'd', media_type: 'text/plain', chunk_index: 0, chunk_count: 1, char_start: 0, char_end: 5, sha256: 'h' },
      },
    });
    expect(minimal).toEqual({
      id: 'd', media_type: 'text/plain', chunk_index: 0, chunk_count: 1, heading_path: [],
      char_start: 0, char_end: 5, sha256: 'h', bytes: 0, created_at: 0, updated_at: 0,
    });
  });
});

describe('capabilities.documents', () => {
  it('parses the documents block, and is undefined on an older server', () => {
    const caps = parseCapabilities({
      capabilities_version: 2,
      documents: {
        enabled: true,
        text_media_types: ['text/plain', 'text/markdown', 'text/html'],
        media_types: ['application/pdf', 'text/plain'],
        max_bytes: 26214400,
        max_text_bytes: 20971520,
        max_chunks: 5000,
        default_chunk_tokens: 400,
        default_overlap_tokens: 50,
        strategies: ['structure', 'fixed'],
      },
    });
    expect(caps.documents?.enabled).toBe(true);
    expect(caps.documents?.max_chunks).toBe(5000);
    expect(caps.documents?.strategies).toEqual(['structure', 'fixed']);
    expect(parseCapabilities({ capabilities_version: 2 }).documents).toBeUndefined();
  });
});
