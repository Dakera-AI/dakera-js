/**
 * R9 / DAK-10004 — forward-compat: widened wire enums + GET /v1/capabilities.
 *
 * Contract under test (server `routes/capabilities.rs`): every field additive;
 * unknown fields and unknown strings inside lists MUST be ignored; the SDK must
 * never fail on a model / index kind / search mode / metric / representation
 * kind / dtype string it does not know.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DakeraClient } from './client';
import {
  parseCapabilities,
  parseAcceptedValues,
  findModel,
  activeModel,
  supportedValues,
  supportsCapability,
  requireCapability,
} from './capabilities';
import { NotFoundError, UnsupportedCapabilityError, ValidationError } from './errors';
import {
  isKnownEmbeddingModel,
  isKnownIndexKind,
  isKnownSearchMode,
  isKnownDistanceMetric,
  isKnownRepresentationKind,
  isKnownBlockDType,
  KNOWN_EMBEDDING_MODELS,
  KNOWN_INDEX_KINDS,
  KNOWN_SEARCH_MODES,
  KNOWN_REPRESENTATION_KINDS,
  KNOWN_BLOCK_DTYPES,
} from './types';
import type { EmbeddingModel, TextUpsertResponse } from './types';

const mockFetch = vi.fn();
global.fetch = mockFetch;

// A capabilities document as the v0.12 server emits it, PLUS a model string and
// an index kind this SDK does not know, PLUS an extra top-level field, an extra
// model field and an extra records field — all of which must be tolerated.
const FIXTURE = {
  capabilities_version: 1,
  server_version: '0.12.0',
  api_versions: ['v1'],
  default_model: 'bge-large',
  models: [
    {
      name: 'bge-large',
      aliases: ['bge-large-en', 'bge-large-en-v1.5'],
      dimension: 1024,
      max_seq_length: 512,
      effective_max_seq_length: 512,
      active: true,
      modality: 'text',
    },
    {
      name: 'modernbert-embed-base',
      aliases: ['modernbert', 'modern-bert'],
      dimension: 768,
      max_seq_length: 8192,
      effective_max_seq_length: 2048,
      active: false,
      mrl_dimensions: [256, 768],
      modality: 'text',
    },
    {
      name: 'bge-m3',
      aliases: ['bge-m3-dense', 'baai/bge-m3'],
      dimension: 1024,
      max_seq_length: 8192,
      effective_max_seq_length: 2048,
      active: false,
      modality: 'text',
    },
    {
      // A model from a FUTURE server: not declared in this SDK.
      name: 'colmodernvbert-v9',
      aliases: [],
      dimension: 128,
      max_seq_length: 4096,
      effective_max_seq_length: 4096,
      active: false,
      modality: 'image',
      quantised: true, // unknown per-model field
    },
  ],
  index_kinds: ['hnsw', 'pq', 'ivf', 'ivfpq', 'spfresh', 'fulltext', 'muvera_fde'],
  vector_index_kinds: ['hnsw', 'ivf', 'ivfpq', 'spfresh', 'muvera_fde'],
  live_vector_index_kinds: ['hnsw', 'ivf', 'spfresh'],
  distance_metrics: ['cosine', 'euclidean', 'dot_product', 'hamming'],
  search_mode: 'rabitq',
  search_modes_accepted: 'hybrid, binary, float, scalar (alias sq), rabitq, warp9',
  fulltext_language: 'de',
  on_disk_format_version: 1,
  records: {
    enabled: true,
    representation_kinds: ['dense', 'token_multivector', 'patch_multivector', 'holo'],
    dtypes: ['f32', 'f16', 'i8', 'e4m3'],
    max_representations: 8,
    max_vectors: 4096,
    max_bytes: 8388608,
    compression: 'zstd', // unknown field inside records
  },
  query_languages: ['en', 'de', 'fr', 'es', 'it', 'pt', 'nl'],
  reembed_pending: true,
  future_top_level_field: { anything: [1, 2, 3] }, // unknown top-level field
};

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  };
}

function sentRequests(): Array<{ method: string; url: string; body?: unknown }> {
  return mockFetch.mock.calls.map(([url, init]) => ({
    method: init.method,
    url,
    body: init.body ? JSON.parse(init.body) : undefined,
  }));
}

describe('R9 forward-compat', () => {
  let client: DakeraClient;

  beforeEach(() => {
    client = new DakeraClient({ baseUrl: 'http://localhost:3000' });
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // 1. Widened enums + runtime guards
  // ==========================================================================

  describe('widened wire enums', () => {
    it('declares the strings v0.12 adds', () => {
      expect(KNOWN_EMBEDDING_MODELS).toContain('bge-m3');
      expect(KNOWN_INDEX_KINDS).toContain('ivfpq');
      expect(KNOWN_SEARCH_MODES).toContain('rabitq');
      expect(KNOWN_REPRESENTATION_KINDS).toEqual(['dense', 'token_multivector', 'patch_multivector']);
      expect(KNOWN_BLOCK_DTYPES).toEqual(['f32', 'f16', 'i8']);
    });

    it('accepts unknown server strings at the type level and narrows at runtime', () => {
      // Type-level: a string the SDK does not declare is assignable.
      const fromServer: EmbeddingModel = 'colmodernvbert-v9';
      expect(isKnownEmbeddingModel(fromServer)).toBe(false);
      expect(isKnownEmbeddingModel('bge-m3')).toBe(true);
      expect(isKnownIndexKind('muvera_fde')).toBe(false);
      expect(isKnownIndexKind('ivfpq')).toBe(true);
      expect(isKnownSearchMode('warp9')).toBe(false);
      expect(isKnownDistanceMetric('hamming')).toBe(false);
      expect(isKnownRepresentationKind('holo')).toBe(false);
      expect(isKnownBlockDType('e4m3')).toBe(false);
      // Guards reject non-strings too.
      expect(isKnownEmbeddingModel(42)).toBe(false);
      expect(isKnownEmbeddingModel(undefined)).toBe(false);
    });
  });

  describe('server responses carrying an unknown enum string', () => {
    it('upsertText / queryText / batchQueryText round-trip an unknown model', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          upserted_count: 1,
          tokens_processed: 4,
          model: 'colmodernvbert-v9',
          embedding_time_ms: 3,
          new_field_from_future: true,
        })
      );
      const up: TextUpsertResponse = await client.upsertText('ns', [{ id: 'd1', text: 'hi' }]);
      expect(up.model).toBe('colmodernvbert-v9');
      expect(isKnownEmbeddingModel(up.model)).toBe(false);

      mockFetch.mockResolvedValueOnce(
        jsonResponse({ results: [], model: 'bge-m3', embedding_time_ms: 1, search_time_ms: 1 })
      );
      const q = await client.queryText('ns', 'q');
      expect(q.model).toBe('bge-m3');

      mockFetch.mockResolvedValueOnce(
        jsonResponse({ results: [[]], model: 'x-new', embedding_time_ms: 1, search_time_ms: 1 })
      );
      const b = await client.batchQueryText('ns', ['q']);
      expect(b.model).toBe('x-new');
    });

    it('configureNamespace round-trips an unknown metric', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ namespace: 'ns', dimension: 8, distance: 'hamming', created: true })
      );
      const resp = await client.configureNamespace('ns', { dimension: 8 });
      expect(resp.distance).toBe('hamming');
      expect(isKnownDistanceMetric(resp.distance)).toBe(false);
    });

    it('an unknown model can be sent as a plain string', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ upserted_count: 1, tokens_processed: 1, model: 'bge-m3' })
      );
      await client.upsertText('ns', [{ id: 'd', text: 't' }], { model: 'bge-m3' });
      expect(sentRequests()[0].body.model).toBe('bge-m3');
    });
  });

  // ==========================================================================
  // 2. parseCapabilities
  // ==========================================================================

  describe('parseCapabilities', () => {
    it('parses the fixture with unknown strings and unknown fields', () => {
      const caps = parseCapabilities(FIXTURE);
      expect(caps.capabilities_version).toBe(1);
      expect(caps.server_version).toBe('0.12.0');
      expect(caps.api_versions).toEqual(['v1']);
      expect(caps.default_model).toBe('bge-large');
      expect(caps.models.map((m) => m.name)).toEqual([
        'bge-large',
        'modernbert-embed-base',
        'bge-m3',
        'colmodernvbert-v9',
      ]);
      const unknown = findModel(caps, 'colmodernvbert-v9');
      expect(unknown?.modality).toBe('image');
      expect(unknown?.raw.quantised).toBe(true); // unknown per-model field kept, not fatal
      expect(findModel(caps, 'modernbert')?.mrl_dimensions).toEqual([256, 768]); // alias lookup
      expect(findModel(caps, 'bge-large')?.mrl_dimensions).toBeUndefined();
      expect(activeModel(caps)?.name).toBe('bge-large');
      expect(caps.index_kinds).toContain('ivfpq');
      expect(caps.index_kinds).toContain('muvera_fde');
      expect(caps.live_vector_index_kinds).toEqual(['hnsw', 'ivf', 'spfresh']);
      expect(caps.distance_metrics).toContain('hamming');
      expect(caps.search_mode).toBe('rabitq');
      expect(caps.search_modes_accepted).toEqual([
        'hybrid',
        'binary',
        'float',
        'scalar',
        'sq',
        'rabitq',
        'warp9',
      ]);
      expect(caps.fulltext_language).toBe('de');
      expect(caps.on_disk_format_version).toBe(1);
      expect(caps.records.enabled).toBe(true);
      expect(caps.records.representation_kinds).toContain('holo');
      expect(caps.records.dtypes).toContain('e4m3');
      expect(caps.records.max_bytes).toBe(8 * 1024 * 1024);
      expect(caps.records.raw.compression).toBe('zstd');
      expect(caps.query_languages.at(-1)).toBe('nl');
      expect(caps.reembed_pending).toBe(true);
      expect(caps.raw.future_top_level_field).toEqual({ anything: [1, 2, 3] });
    });

    it('never throws on minimal, empty or malformed documents', () => {
      expect(parseCapabilities({}).models).toEqual([]);
      expect(parseCapabilities({}).records.enabled).toBe(false);
      expect(parseCapabilities({}).search_modes_accepted).toEqual([]);
      expect(parseCapabilities(null).reembed_pending).toBe(false);
      expect(parseCapabilities('garbage').models).toEqual([]);
      expect(parseCapabilities({ models: 'not-a-list', records: null, index_kinds: [1, 'hnsw'] }))
        .toMatchObject({ models: [], index_kinds: ['hnsw'] });
    });

    it('parseAcceptedValues handles the prose field and a list', () => {
      expect(parseAcceptedValues('hybrid, binary, float, scalar (alias sq), rabitq')).toEqual([
        'hybrid',
        'binary',
        'float',
        'scalar',
        'sq',
        'rabitq',
      ]);
      expect(parseAcceptedValues(['hybrid', 'float'])).toEqual(['hybrid', 'float']);
      expect(parseAcceptedValues(undefined)).toEqual([]);
      expect(parseAcceptedValues('a (alias b, c)')).toEqual(['a', 'b', 'c']);
    });

    it('supports* helpers', () => {
      const caps = parseCapabilities(FIXTURE);
      expect(supportsCapability(caps, 'model', 'bge-m3')).toBe(true);
      expect(supportsCapability(caps, 'model', 'baai/bge-m3')).toBe(true); // alias
      expect(supportsCapability(caps, 'model', 'minilm')).toBe(false);
      expect(supportsCapability(caps, 'index_kind', 'ivfpq')).toBe(true);
      expect(supportsCapability(caps, 'index_kind', 'flat')).toBe(false);
      expect(supportsCapability(caps, 'distance_metric', 'cosine')).toBe(true);
      expect(supportsCapability(caps, 'search_mode', 'sq')).toBe(true);
      expect(supportsCapability(caps, 'search_mode', 'exact')).toBe(false);
      expect(supportsCapability(caps, 'query_language', 'de')).toBe(true);
      expect(supportedValues(caps, 'query_language')).toHaveLength(7);
      expect(() => requireCapability(caps, 'model', 'minilm')).toThrow(UnsupportedCapabilityError);
    });
  });

  // ==========================================================================
  // 3. client.capabilities() + pre-flight
  // ==========================================================================

  describe('client.capabilities()', () => {
    it('fetches once and caches; refresh re-fetches', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(FIXTURE));
      const first = await client.capabilities();
      const second = await client.capabilities();
      expect(second).toBe(first);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(sentRequests()[0]).toMatchObject({
        method: 'GET',
        url: 'http://localhost:3000/v1/capabilities',
      });
      expect(first.reembed_pending).toBe(true);
      expect(first.records.enabled).toBe(true);

      mockFetch.mockResolvedValueOnce(jsonResponse({ ...FIXTURE, reembed_pending: false }));
      const third = await client.capabilities({ refresh: true });
      expect(third.reembed_pending).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('a pre-0.12 server raises NotFoundError', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'not found' }, 404));
      await expect(client.capabilities()).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('pre-flight validation', () => {
    it('raises a named error BEFORE sending when the model is unsupported', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(FIXTURE));
      await client.capabilities(); // populate the cache; no preflight flag needed
      let caught: unknown;
      try {
        await client.upsertText('ns', [{ id: 'd', text: 't' }], { model: 'minilm' });
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(UnsupportedCapabilityError);
      expect(caught).toBeInstanceOf(ValidationError);
      const err = caught as UnsupportedCapabilityError;
      expect(err.kind).toBe('model');
      expect(err.requested).toBe('minilm');
      expect(err.supported).toEqual([
        'bge-large',
        'modernbert-embed-base',
        'bge-m3',
        'colmodernvbert-v9',
      ]);
      expect(err.message).toContain('minilm');
      expect(err.message).toContain('bge-m3');
      expect(err.message).toContain('v0.12.0');
      // Nothing but the capabilities GET went over the wire.
      expect(sentRequests().map((r) => r.method)).toEqual(['GET']);
    });

    it('supported model and alias pass through', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(FIXTURE));
      await client.capabilities();
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ results: [], model: 'bge-m3', embedding_time_ms: 1, search_time_ms: 1 })
      );
      await client.queryText('ns', 'q', { model: 'bge-m3' });
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ results: [], model: 'bge-m3', embedding_time_ms: 1, search_time_ms: 1 })
      );
      await client.batchQueryText('ns', ['q'], { model: 'baai/bge-m3' }); // alias
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('index kind and distance metric are validated too', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(FIXTURE));
      await client.capabilities();
      await expect(
        client.createNamespace('ns', { dimensions: 8, indexType: 'flat' })
      ).rejects.toMatchObject({ kind: 'index_kind', supported: expect.arrayContaining(['ivfpq']) });
      await expect(
        client.configureNamespace('ns', { dimension: 8, distance: 'manhattan' })
      ).rejects.toMatchObject({ kind: 'distance_metric' });
      await expect(
        client.query('ns', [0.1], { distanceMetric: 'manhattan' })
      ).rejects.toBeInstanceOf(UnsupportedCapabilityError);
      expect(mockFetch).toHaveBeenCalledTimes(1); // only the capabilities fetch
    });

    it('requireSupported covers search_mode and query_language', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(FIXTURE));
      await client.requireSupported('search_mode', 'rabitq');
      await client.requireSupported('search_mode', 'sq'); // alias expanded from the prose field
      await expect(client.requireSupported('search_mode', 'exact')).rejects.toMatchObject({
        supported: ['hybrid', 'binary', 'float', 'scalar', 'sq', 'rabitq', 'warp9'],
      });
      await client.requireSupported('query_language', 'fr');
      await expect(client.requireSupported('query_language', 'ja')).rejects.toBeInstanceOf(
        UnsupportedCapabilityError
      );
    });

    it('does not run without a cache by default', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ upserted_count: 1, tokens_processed: 1, model: 'minilm' })
      );
      await client.upsertText('ns', [{ id: 'd', text: 't' }], { model: 'minilm' });
      expect(sentRequests().map((r) => r.method)).toEqual(['POST']);
    });

    it('preflight: true fetches lazily on first use', async () => {
      const c = new DakeraClient({ baseUrl: 'http://localhost:3000', preflight: true });
      mockFetch.mockResolvedValueOnce(jsonResponse(FIXTURE));
      await expect(
        c.upsertText('ns', [{ id: 'd', text: 't' }], { model: 'minilm' })
      ).rejects.toBeInstanceOf(UnsupportedCapabilityError);
      expect(sentRequests().map((r) => r.method)).toEqual(['GET']);
    });

    it('preflight: true degrades silently on a pre-0.12 server', async () => {
      const c = new DakeraClient({ baseUrl: 'http://localhost:3000', preflight: true });
      mockFetch.mockResolvedValueOnce(jsonResponse({}, 404));
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ upserted_count: 1, tokens_processed: 1, model: 'minilm' })
      );
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ upserted_count: 1, tokens_processed: 1, model: 'minilm' })
      );
      await c.upsertText('ns', [{ id: 'd', text: 't' }], { model: 'minilm' });
      await c.upsertText('ns', [{ id: 'd', text: 't' }], { model: 'minilm' });
      // 404 once, then never asked again for this client.
      expect(sentRequests().map((r) => r.method)).toEqual(['GET', 'POST', 'POST']);
    });
  });
});
