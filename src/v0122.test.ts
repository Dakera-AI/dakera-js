/**
 * Server v0.12.2 support: agents, key PATCH / rotation grace / whoami, grant
 * fields, namespace kinds, capabilities v2, session idle lifecycle, content
 * previews and include_derived, derivation status / drain, and the additive
 * response fields (dedup, compress, `unavailable`). Fixtures follow the
 * server's serialized shapes; requests must omit unset fields.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DakeraClient } from './client';
import { ConflictError, NotFoundError, ValidationError } from './errors';
import { parseCapabilities } from './capabilities';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function json(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
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

const SESSION_OPEN = {
  id: 'sess_1',
  agent_id: 'mlx-dev',
  started_at: 1791392203,
  memory_count: 0,
  last_activity_at: 1791392203,
};

const SESSION_IDLE = {
  id: 'sess_2',
  agent_id: 'mlx-dev',
  started_at: 1791392203,
  ended_at: 1791406603,
  memory_count: 7,
  last_activity_at: 1791392803,
  ended_reason: 'idle',
  idle_since: 1791392803,
  idle_timeout_secs: 7200,
};

const KEY_INFO = {
  key_id: 'dk_key_1a2b3c4d',
  name: 'dev',
  scope: 'write',
  namespaces: ['_dakera_agent_mlx-*'],
  created_at: 1791392203,
  expires_at: null,
  active: true,
  grants_version: 1,
};

describe('server v0.12.2', () => {
  let client: DakeraClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new DakeraClient({ baseUrl: 'http://localhost:3000', maxRetries: 1 });
  });

  // ---------------------------------------------------------------------------
  // Agents
  // ---------------------------------------------------------------------------

  describe('createAgent', () => {
    it('POSTs {agent_id} to /v1/agents and returns created: true', async () => {
      mockFetch.mockResolvedValueOnce(
        json(201, {
          agent_id: 'mlx-dev',
          namespace: '_dakera_agent_mlx-dev',
          created: true,
          dimension: 1024,
          model: 'bge-large',
        })
      );
      const res = await client.createAgent('mlx-dev');
      expect(res.created).toBe(true);
      expect(res.namespace).toBe('_dakera_agent_mlx-dev');
      expect(res.dimension).toBe(1024);
      const call = lastCall();
      expect(call.method).toBe('POST');
      expect(call.url).toBe('http://localhost:3000/v1/agents');
      expect(call.body).toEqual({ agent_id: 'mlx-dev' });
    });

    it('returns created: false for an existing agent (200)', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, {
          agent_id: 'mlx-dev',
          namespace: '_dakera_agent_mlx-dev',
          created: false,
          dimension: null,
          model: 'bge-large',
        })
      );
      const res = await client.createAgent('mlx-dev');
      expect(res.created).toBe(false);
      expect(res.dimension).toBeNull();
    });

    it('surfaces an invalid agent id as ValidationError', async () => {
      mockFetch.mockResolvedValueOnce(
        json(400, { error: 'agent_id: invalid agent id', code: 'INVALID_REQUEST', status: 400 })
      );
      await expect(client.createAgent('_dakera_x')).rejects.toBeInstanceOf(ValidationError);
    });
  });

  it('listAgents keeps vector_count and unavailable', async () => {
    mockFetch.mockResolvedValueOnce(
      json(200, [
        { agent_id: 'a', memory_count: 0, vector_count: 0, session_count: 0, active_sessions: 0 },
        {
          agent_id: 'b',
          memory_count: 3,
          vector_count: 0,
          session_count: 1,
          active_sessions: 0,
          unavailable: 'did not answer within 2000 ms',
        },
      ])
    );
    const agents = await client.listAgents();
    expect(agents[0].vector_count).toBe(0);
    expect(agents[0].unavailable).toBeUndefined();
    expect(agents[1].unavailable).toBe('did not answer within 2000 ms');
  });

  // ---------------------------------------------------------------------------
  // Keys
  // ---------------------------------------------------------------------------

  describe('API keys', () => {
    it('updateKey PATCHes /admin/keys/{id} with only the given fields', async () => {
      mockFetch.mockResolvedValueOnce(json(200, { ...KEY_INFO, name: 'renamed' }));
      const res = await client.updateKey('dk_key_1a2b3c4d', { name: 'renamed' });
      expect(res.name).toBe('renamed');
      expect(res.grants_version).toBe(1);
      const call = lastCall();
      expect(call.method).toBe('PATCH');
      expect(call.url).toBe('http://localhost:3000/admin/keys/dk_key_1a2b3c4d');
      expect(call.body).toEqual({ name: 'renamed' });
    });

    it('updateKey sends namespaces: null (every namespace) explicitly', async () => {
      mockFetch.mockResolvedValueOnce(json(200, { ...KEY_INFO, namespaces: null }));
      await client.updateKey('dk_key_1a2b3c4d', { namespaces: null });
      expect(lastCall().body).toEqual({ namespaces: null });
    });

    it('updateKey sends a pattern list and reads inert_namespaces', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, {
          ...KEY_INFO,
          namespaces: ['team-*', 'docs', '_dakera_sessions'],
          inert_namespaces: ['_dakera_sessions'],
        })
      );
      const res = await client.updateKey('dk_key_1a2b3c4d', {
        namespaces: ['team-*', 'docs', '_dakera_sessions'],
      });
      expect(lastCall().body).toEqual({ namespaces: ['team-*', 'docs', '_dakera_sessions'] });
      expect(res.inert_namespaces).toEqual(['_dakera_sessions']);
    });

    it('updateKey maps an inactive key (409) to ConflictError', async () => {
      mockFetch.mockResolvedValueOnce(
        json(409, { error: "API key 'x' is inactive and cannot be edited", code: 'CONFLICT', status: 409 })
      );
      await expect(client.updateKey('x', { name: 'n' })).rejects.toBeInstanceOf(ConflictError);
    });

    it('updateNamespaceKey PATCHes the namespace route (encoded)', async () => {
      mockFetch.mockResolvedValueOnce(json(200, { ...KEY_INFO, namespaces: ['team-a*'] }));
      const res = await client.updateNamespaceKey('team-a', 'dk_key_1a2b3c4d', {
        namespaces: ['team-a*'],
      });
      expect(res.namespaces).toEqual(['team-a*']);
      const call = lastCall();
      expect(call.method).toBe('PATCH');
      expect(call.url).toBe('http://localhost:3000/v1/namespaces/team-a/keys/dk_key_1a2b3c4d');
      expect(call.body).toEqual({ namespaces: ['team-a*'] });
    });

    it('updateNamespaceKey surfaces a key the caller cannot manage as NotFoundError', async () => {
      mockFetch.mockResolvedValueOnce(
        json(404, { error: "API key 'k' not found in namespace 'n'", code: 'API_KEY_NOT_FOUND', status: 404 })
      );
      await expect(client.updateNamespaceKey('n', 'k', { name: 'x' })).rejects.toBeInstanceOf(
        NotFoundError
      );
    });

    it('rotateKey without options sends no body (behaves as before)', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, { new_key: 'dk_new', key_id: 'dk_key_new', warning: 'Save this new key now!' })
      );
      const res = await client.rotateKey('dk_key_old');
      expect(res.key_id).toBe('dk_key_new');
      expect(res.old_key_id).toBeUndefined();
      const c = mockFetch.mock.calls[0];
      expect(c[0]).toBe('http://localhost:3000/admin/keys/dk_key_old/rotate');
      expect((c[1] as RequestInit).body).toBeUndefined();
    });

    it('rotateKey with grace_secs sends it and reads old_key_id / old_key_expires_at', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, {
          new_key: 'dk_new',
          key_id: 'dk_key_new',
          old_key_id: 'dk_key_old',
          old_key_expires_at: 1791395803,
          warning: 'Save this new key now! The old key keeps working until 1791395803 (Unix seconds).',
        })
      );
      const res = await client.rotateKey('dk_key_old', { grace_secs: 3600 });
      expect(lastCall().body).toEqual({ grace_secs: 3600 });
      expect(res.old_key_id).toBe('dk_key_old');
      expect(res.old_key_expires_at).toBe(1791395803);
    });

    it('rotateKey reads old_key_expires_at: null without a grace period', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, {
          new_key: 'dk_new',
          key_id: 'dk_key_new',
          old_key_id: 'dk_key_old',
          old_key_expires_at: null,
          warning: 'w',
        })
      );
      const res = await client.rotateKey('dk_key_old', { grace_secs: 0 });
      expect(lastCall().body).toEqual({ grace_secs: 0 });
      expect(res.old_key_expires_at).toBeNull();
    });

    it('listKeys unwraps the server {keys, total} answer', async () => {
      mockFetch.mockResolvedValueOnce(json(200, { keys: [KEY_INFO], total: 1 }));
      const keys = await client.listKeys();
      expect(keys).toHaveLength(1);
      expect(keys[0].key_id).toBe('dk_key_1a2b3c4d');
      expect(keys[0].grants_version).toBe(1);
    });

    it('createKey forwards scope / namespaces / expires_in_days', async () => {
      mockFetch.mockResolvedValueOnce(json(200, { ...KEY_INFO, key: 'dk_secret', warning: 'w' }));
      await client.createKey({
        name: 'dev',
        scope: 'write',
        namespaces: ['_dakera_agent_mlx-*'],
        expires_in_days: 30,
      });
      expect(lastCall().body).toEqual({
        name: 'dev',
        scope: 'write',
        namespaces: ['_dakera_agent_mlx-*'],
        expires_in_days: 30,
      });
    });

    it('createNamespaceKey accepts an options object', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, { key_id: 'k', key: 'dk_x', name: 'ci', namespace: 'team-a', created_at: 1, warning: 'w' })
      );
      await client.createNamespaceKey('team-a', 'ci', {
        scope: 'read',
        extra_namespaces: ['team-a-*'],
      });
      expect(lastCall().body).toEqual({ name: 'ci', scope: 'read', extra_namespaces: ['team-a-*'] });
    });

    it('listNamespaceKeys keeps grant fields', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, {
          keys: [{ ...KEY_INFO, grants_version: 0, inert_namespaces: ['foo*'] }],
          total: 1,
        })
      );
      const res = await client.listNamespaceKeys('foo');
      expect(res.keys[0].grants_version).toBe(0);
      expect(res.keys[0].inert_namespaces).toEqual(['foo*']);
    });

    it('whoami GETs /v1/auth/whoami', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, {
          key_id: 'dk_key_1a2b3c4d',
          name: 'dev',
          scope: 'write',
          namespaces: ['foo*', 'docs'],
          unrestricted: false,
          expires_at: null,
          grants_version: 0,
          inert_namespaces: ['foo*'],
          auth_enabled: true,
        })
      );
      const me = await client.whoami();
      expect(me.unrestricted).toBe(false);
      expect(me.inert_namespaces).toEqual(['foo*']);
      expect(me.auth_enabled).toBe(true);
      const call = lastCall();
      expect(call.method).toBe('GET');
      expect(call.url).toBe('http://localhost:3000/v1/auth/whoami');
    });

    it('whoami reads the auth-disabled answer', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, {
          key_id: 'auth-disabled',
          name: 'Auth Disabled',
          scope: 'super_admin',
          namespaces: null,
          unrestricted: true,
          expires_at: null,
          grants_version: 1,
          inert_namespaces: [],
          auth_enabled: false,
        })
      );
      const me = await client.whoami();
      expect(me.auth_enabled).toBe(false);
      expect(me.namespaces).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Namespaces
  // ---------------------------------------------------------------------------

  describe('namespace kinds', () => {
    it('listNamespaces fills kind from the kinds map', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, {
          namespaces: ['docs', '_dakera_agent_a'],
          kinds: { docs: 'data', _dakera_agent_a: 'agent' },
        })
      );
      const list = await client.listNamespaces();
      expect(list).toEqual([
        { namespace: 'docs', vector_count: 0, kind: 'data' },
        { namespace: '_dakera_agent_a', vector_count: 0, kind: 'agent' },
      ]);
    });

    it('listNamespaces omits kind against an older server', async () => {
      mockFetch.mockResolvedValueOnce(json(200, { namespaces: ['docs'] }));
      const list = await client.listNamespaces();
      expect(list).toEqual([{ namespace: 'docs', vector_count: 0 }]);
      expect('kind' in list[0]).toBe(false);
    });

    it('getNamespace keeps kind', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, { namespace: 'docs', kind: 'data', vector_count: 3, dimension: 384 })
      );
      const info = await client.getNamespace('docs');
      expect(info.kind).toBe('data');
    });
  });

  // ---------------------------------------------------------------------------
  // Capabilities v2
  // ---------------------------------------------------------------------------

  describe('capabilities v2', () => {
    it('parses the auth, naming and sessions blocks', () => {
      const caps = parseCapabilities({
        capabilities_version: 2,
        auth: {
          prefix_patterns: true,
          sessions_by_agent: true,
          key_update: true,
          rotation_grace_max_secs: 604800,
          max_grants: 100,
          max_grant_len: 255,
        },
        naming: {
          agent_id_pattern: '^[a-zA-Z0-9][a-zA-Z0-9_\\-.]*$',
          agent_id_max_bytes: 241,
          agent_namespace_prefix: '_dakera_agent_',
          agent_namespace_max_bytes: 255,
          namespace_pattern: '^[a-zA-Z0-9][a-zA-Z0-9_-]*$',
          namespace_max_bytes: 128,
          reserved_prefixes: ['_', 'system_', 'internal_', 'admin_'],
          internal_namespaces: ['_dakera_sessions', '_dakera_embedding_models'],
          internal_prefixes: ['_dakera_reembed_staging_'],
          future_field: 1,
        },
        sessions: {
          idle_timeout_secs: 14400,
          max_idle_timeout_secs: 2592000,
          touch: true,
          ended_reason: true,
        },
      });
      expect(caps.capabilities_version).toBe(2);
      expect(caps.auth?.rotation_grace_max_secs).toBe(604800);
      expect(caps.auth?.key_update).toBe(true);
      expect(caps.naming?.agent_id_max_bytes).toBe(241);
      expect(caps.naming?.internal_namespaces).toContain('_dakera_embedding_models');
      expect(caps.naming?.raw.future_field).toBe(1);
      expect(caps.sessions?.idle_timeout_secs).toBe(14400);
      expect(caps.sessions?.touch).toBe(true);
    });

    it('leaves the v2 blocks undefined on a v1 document', () => {
      const caps = parseCapabilities({ capabilities_version: 1 });
      expect(caps.auth).toBeUndefined();
      expect(caps.naming).toBeUndefined();
      expect(caps.sessions).toBeUndefined();
      expect('auth' in caps).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Sessions
  // ---------------------------------------------------------------------------

  describe('sessions', () => {
    it('startSession omits unset fields', async () => {
      mockFetch.mockResolvedValueOnce(json(200, { session: SESSION_OPEN }));
      const s = await client.startSession('mlx-dev');
      expect(lastCall().body).toEqual({ agent_id: 'mlx-dev' });
      expect(s.last_activity_at).toBe(1791392203);
    });

    it('startSession sends idle_timeout_secs (including 0) and id', async () => {
      mockFetch.mockResolvedValueOnce(json(200, { session: { ...SESSION_OPEN, idle_timeout_secs: 0 } }));
      const s = await client.startSession('mlx-dev', { k: 'v' }, { idle_timeout_secs: 0, id: 'sess_1' });
      expect(lastCall().body).toEqual({
        agent_id: 'mlx-dev',
        metadata: { k: 'v' },
        id: 'sess_1',
        idle_timeout_secs: 0,
      });
      expect(s.idle_timeout_secs).toBe(0);
    });

    it('touchSession POSTs /v1/sessions/{id}/touch with no body', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, {
          session: { ...SESSION_OPEN, last_activity_at: 1791393000 },
          session_state: 'active',
          idle_deadline_at: 1791407400,
        })
      );
      const res = await client.touchSession('sess_1');
      expect(res.session_state).toBe('active');
      expect(res.idle_deadline_at).toBe(1791407400);
      expect(res.session.last_activity_at).toBe(1791393000);
      const c = mockFetch.mock.calls[0];
      expect(c[0]).toBe('http://localhost:3000/v1/sessions/sess_1/touch');
      expect((c[1] as RequestInit).method).toBe('POST');
      expect((c[1] as RequestInit).body).toBeUndefined();
    });

    it('touchSession reports an ended session without re-opening it', async () => {
      mockFetch.mockResolvedValueOnce(json(200, { session: SESSION_IDLE, session_state: 'ended' }));
      const res = await client.touchSession('sess_2');
      expect(res.session_state).toBe('ended');
      expect(res.idle_deadline_at).toBeUndefined();
      expect(res.session.ended_reason).toBe('idle');
      expect(res.session.idle_since).toBe(1791392803);
    });

    it('endSession sends {} by default and the summary when given', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, { session: { ...SESSION_OPEN, ended_at: 1791400000, ended_reason: 'client' }, memory_count: 0 })
      );
      const res = await client.endSession('sess_1');
      expect(lastCall().body).toEqual({});
      expect(res.session.ended_reason).toBe('client');

      mockFetch.mockResolvedValueOnce(json(200, { session: SESSION_IDLE, memory_count: 7 }));
      await client.endSession('sess_2', { summary: 'done' });
      expect(lastCall().body).toEqual({ summary: 'done' });
    });

    it('getSession reads the idle lifecycle fields', async () => {
      mockFetch.mockResolvedValueOnce(json(200, SESSION_IDLE));
      const s = await client.getSession('sess_2');
      expect(s.ended_reason).toBe('idle');
      expect(s.idle_timeout_secs).toBe(7200);
      expect(s.last_activity_at).toBe(1791392803);
    });

    it('listSessions unwraps the server {sessions, total} answer', async () => {
      mockFetch.mockResolvedValueOnce(json(200, { sessions: [SESSION_OPEN, SESSION_IDLE], total: 2 }));
      const list = await client.listSessions({ agent_id: 'mlx-dev' });
      expect(list).toHaveLength(2);
      expect(list[1].ended_reason).toBe('idle');
    });

    it('sessionMemories sends content_preview_chars and unwraps {memories}', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, {
          session: SESSION_OPEN,
          memories: [
            { id: 'm1', content: 'abc', memory_type: 'Episodic', importance: 0.5, content_len: 9000, content_truncated: true },
          ],
          total: 1,
        })
      );
      const mems = await client.sessionMemories('sess_1', { content_preview_chars: 3, limit: 10 });
      expect(mems).toHaveLength(1);
      expect(mems[0].content_len).toBe(9000);
      expect(mems[0].content_truncated).toBe(true);
      const url = new URL(lastCall().url);
      expect(url.pathname).toBe('/v1/sessions/sess_1/memories');
      expect(url.searchParams.get('content_preview_chars')).toBe('3');
      expect(url.searchParams.get('limit')).toBe('10');
    });

    it('sessionMemories sends no query string without options', async () => {
      mockFetch.mockResolvedValueOnce(json(200, { session: SESSION_OPEN, memories: [], total: 0 }));
      await client.sessionMemories('sess_1');
      expect(lastCall().url).toBe('http://localhost:3000/v1/sessions/sess_1/memories');
    });

    it('storeMemory reads session_state', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, {
          memory: { id: 'm1', content: 'x', memory_type: 'Episodic', importance: 0.5 },
          embedding_time_ms: 12,
          session_state: 'ended',
        })
      );
      const res = await client.storeMemory('mlx-dev', { content: 'x', session_id: 'sess_2' });
      expect(res.session_state).toBe('ended');
    });

    it('storeMemoriesBatch reads ended_sessions', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, { stored: [], stored_count: 0, total_embedding_time_ms: 0, ended_sessions: ['sess_2'] })
      );
      const res = await client.storeMemoriesBatch({ agent_id: 'mlx-dev', memories: [] });
      expect(res.ended_sessions).toEqual(['sess_2']);
    });

    it('getConfig / updateConfig carry session_idle_timeout_secs', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, { session_idle_timeout_secs: 14400, query_timeout_ms: 0, cache_enabled: true })
      );
      const cfg = await client.getConfig();
      expect(cfg.session_idle_timeout_secs).toBe(14400);
      expect(cfg.cache_enabled).toBe(true);

      mockFetch.mockResolvedValueOnce(
        json(200, { session_idle_timeout_secs: 3600, runtime_overrides: ['session_idle_timeout_secs'] })
      );
      const updated = await client.updateConfig({ session_idle_timeout_secs: 3600 });
      expect(lastCall().method).toBe('PUT');
      expect(lastCall().body).toEqual({ session_idle_timeout_secs: 3600 });
      expect(updated.runtime_overrides).toEqual(['session_idle_timeout_secs']);
    });
  });

  // ---------------------------------------------------------------------------
  // Derived records / previews
  // ---------------------------------------------------------------------------

  describe('include_derived and content previews', () => {
    it('agentMemories sends include_derived, offset and content_preview_chars', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, [
          { id: 'm1', content: 'ab', memory_type: 'Semantic', importance: 0.9, content_len: 5, content_truncated: true },
        ])
      );
      const mems = await client.agentMemories('mlx-dev', {
        include_derived: true,
        content_preview_chars: 2,
        offset: 50,
        limit: 50,
      });
      expect(mems[0].content_truncated).toBe(true);
      const url = new URL(lastCall().url);
      expect(url.pathname).toBe('/v1/agents/mlx-dev/memories');
      expect(url.searchParams.get('include_derived')).toBe('true');
      expect(url.searchParams.get('content_preview_chars')).toBe('2');
      expect(url.searchParams.get('offset')).toBe('50');
    });

    it('agentMemories omits the new parameters when unset', async () => {
      mockFetch.mockResolvedValueOnce(json(200, []));
      await client.agentMemories('mlx-dev');
      expect(lastCall().url).toBe('http://localhost:3000/v1/agents/mlx-dev/memories');
    });

    it('getWakeUpContext sends include_derived only when set', async () => {
      mockFetch.mockResolvedValueOnce(json(200, { agent_id: 'mlx-dev', memories: [], total_available: 0 }));
      await client.getWakeUpContext('mlx-dev', { include_derived: false });
      expect(new URL(lastCall().url).searchParams.get('include_derived')).toBe('false');

      mockFetch.mockResolvedValueOnce(json(200, { agent_id: 'mlx-dev', memories: [], total_available: 0 }));
      await client.getWakeUpContext('mlx-dev', { top_n: 5 });
      expect(new URL(lastCall().url).searchParams.has('include_derived')).toBe(false);
    });

    it('fullKnowledgeGraph sends content_preview_chars and reads content_len / stats', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, {
          nodes: [
            {
              id: 'mem_a',
              content: 'first',
              content_len: 90000,
              content_truncated: true,
              memory_type: 'Semantic',
              importance: 0.9,
              tags: ['t'],
              created_at: '1700000000',
              cluster_id: 0,
              centrality: 1.0,
            },
          ],
          edges: [],
          clusters: [],
          stats: {
            total_memories: 4,
            included_memories: 1,
            total_edges: 0,
            cluster_count: 1,
            density: 0,
            hub_memory_id: null,
          },
        })
      );
      const graph = await client.fullKnowledgeGraph({ agent_id: 'mlx-dev' as never, content_preview_chars: 5 });
      expect(lastCall().body).toEqual({ agent_id: 'mlx-dev', content_preview_chars: 5 });
      expect(graph.nodes[0].content_len).toBe(90000);
      expect(graph.nodes[0].content_truncated).toBe(true);
      expect(graph.stats?.total_memories).toBe(4);
    });

    it('crossAgentNetwork sends content_preview_chars and reads node preview fields', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, {
          node_count: 1,
          agents: [{ agent_id: 'a', memory_count: 1, avg_importance: 0.7 }],
          nodes: [
            {
              id: 'mem_1',
              agent_id: 'a',
              content: 'abc',
              content_len: 1234,
              content_truncated: true,
              importance: 0.7,
              tags: [],
              memory_type: 'Semantic',
              created_at: 1700000000,
            },
          ],
          edges: [],
          stats: { total_agents: 1, total_nodes: 1, total_cross_edges: 0, density: 0 },
        })
      );
      const net = await client.crossAgentNetwork({ content_preview_chars: 3 });
      expect(lastCall().body).toEqual({ content_preview_chars: 3 });
      expect(net.nodes[0].content_len).toBe(1234);
      expect(net.nodes[0].content_truncated).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Derivations
  // ---------------------------------------------------------------------------

  describe('derivations', () => {
    const STATUS = {
      settled: true,
      pending_sentences: 0,
      pending_parents: 0,
      unmarked_parents: 0,
      stale_children: 0,
      orphan_children: 0,
      remeta_children: 0,
      duplicate_children: 0,
      legacy_children: 0,
      bm25_missing: 0,
      graph_owed: 0,
      in_flight: 0,
      graph_queue_owed: 0,
      dirty_namespaces: [],
      namespaces: 3,
      unreadable_namespaces: [],
      heal: {
        version: 1,
        complete: true,
        namespace: null,
        cursor: null,
        parents_healed: 12,
        graph_adopted: 40,
        started_at: 1760000000,
        completed_at: 1760000010,
      },
      reconciler: { state: 'sleeping', last_tick_at: 1760000100, ticks: 7, next_namespace: '_dakera_agent_x' },
      counters: {
        derived: 0,
        adopted: 0,
        rewritten: 0,
        deleted_stale: 0,
        deleted_orphans: 0,
        recheck_deleted: 0,
        retries: 0,
        deferred: 0,
        stamped: 0,
        superseded: 0,
        bm25_restored: 0,
        graph_rebuilds: 0,
        graph_adopted: 0,
      },
    };

    it('adminDerivationStatus GETs /v1/admin/derivations/status', async () => {
      mockFetch.mockResolvedValueOnce(json(200, STATUS));
      const st = await client.adminDerivationStatus();
      expect(st.settled).toBe(true);
      expect(st.heal?.parents_healed).toBe(12);
      expect(st.reconciler.state).toBe('sleeping');
      const call = lastCall();
      expect(call.method).toBe('GET');
      expect(call.url).toBe('http://localhost:3000/v1/admin/derivations/status');
    });

    it('adminDrainDerivations POSTs {} by default and timeout_secs when given', async () => {
      const drain = {
        settled: true,
        timed_out: false,
        rounds: 1,
        elapsed_ms: 1234,
        parents_run: 17,
        pending_left: 0,
        deleted: 3,
        bm25_restored: 0,
        graph_queued: 1,
        status: STATUS,
      };
      mockFetch.mockResolvedValueOnce(json(200, drain));
      const res = await client.adminDrainDerivations();
      expect(res.parents_run).toBe(17);
      expect(res.status.settled).toBe(true);
      expect(lastCall().url).toBe('http://localhost:3000/v1/admin/derivations/drain');
      expect(lastCall().body).toEqual({});

      mockFetch.mockResolvedValueOnce(json(200, drain));
      await client.adminDrainDerivations({ timeout_secs: 120 });
      expect(lastCall().body).toEqual({ timeout_secs: 120 });
    });

    it('a concurrent drain (409) is a ConflictError', async () => {
      mockFetch.mockResolvedValueOnce(
        json(409, { error: 'a derivation drain is already running', code: 'CONFLICT', status: 409 })
      );
      await expect(client.adminDrainDerivations()).rejects.toBeInstanceOf(ConflictError);
    });
  });

  // ---------------------------------------------------------------------------
  // Additive response fields
  // ---------------------------------------------------------------------------

  describe('additive response fields', () => {
    it('deduplicate reads duplicates_merged / duplicates_skipped_changed', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, { groups: [], duplicates_found: 3, duplicates_merged: 2, duplicates_skipped_changed: 1 })
      );
      const res = await client.deduplicate({ agent_id: 'a' as never });
      expect(res.duplicates_merged).toBe(2);
      expect(res.duplicates_skipped_changed).toBe(1);
    });

    it('compressAgent reads summaries_skipped and the written counts', async () => {
      mockFetch.mockResolvedValueOnce(
        json(200, {
          agent_id: 'a',
          memories_scanned: 40,
          clusters_found: 3,
          summaries_created: 2,
          originals_deprecated: 9,
          summary_ids: ['mem_compress_1', 'mem_compress_2'],
          deprecated_ids: ['m1'],
          summaries_skipped: [
            { summary_id: 'mem_compress_3', reason: 'content: content exceeds maximum of 100000 bytes (100001 bytes)' },
          ],
        })
      );
      const res = await client.compressAgent('a');
      expect(res.summaries_created).toBe(2);
      expect(res.summaries_skipped?.[0].reason).toContain('bytes');
    });

    it('node-wide endpoints keep unavailable', async () => {
      const unavailable = [
        { namespace: '_dakera_agent_y', reason: 'did not answer within 2000 ms' },
      ];
      mockFetch.mockResolvedValueOnce(
        json(200, {
          version: '0.12.2',
          total_vectors: 10,
          namespace_count: 2,
          uptime_seconds: 1,
          timestamp: 1,
          state: 'ok',
          unavailable,
        })
      );
      const ops = await client.opsStats();
      expect(ops.unavailable).toEqual(unavailable);

      mockFetch.mockResolvedValueOnce(
        json(200, { total: 1, working: 0, episodic: 1, semantic: 0, procedural: 0, agent_namespaces: 2, unavailable })
      );
      const mts = await client.adminMemoryTypeStats();
      expect(mts.unavailable?.[0].namespace).toBe('_dakera_agent_y');

      mockFetch.mockResolvedValueOnce(json(200, { namespaces: [], total_with_ttl: 0, total_expired: 0 }));
      const ttl = await client.adminTtlStats();
      expect(ttl.unavailable).toBeUndefined();
    });
  });
});
