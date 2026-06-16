import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DakeraClient } from './client';
import type { RecallResponse, Session, StoreMemoryResponse, SessionEndResponse } from './types';
import { ChatMemorySession } from './session';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'sess_test123',
    agent_id: 'agent-1',
    started_at: 1781000000,
    ...overrides,
  } as Session;
}

function makeMockClient(overrides: Partial<DakeraClient> = {}): DakeraClient {
  return {
    startSession: vi.fn().mockResolvedValue(makeSession()),
    storeMemory: vi.fn().mockResolvedValue({ id: 'mem_1', content: 'test' } as StoreMemoryResponse),
    recall: vi.fn().mockResolvedValue({ memories: [] } as RecallResponse),
    endSession: vi.fn().mockResolvedValue({ session_id: 'sess_test123' } as SessionEndResponse),
    ...overrides,
  } as unknown as DakeraClient;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChatMemorySession.create', () => {
  it('calls startSession and stores session id', async () => {
    const client = makeMockClient();
    const session = await ChatMemorySession.create(client, 'agent-1');

    expect(client.startSession).toHaveBeenCalledWith('agent-1', undefined);
    expect(session.sessionId).toBe('sess_test123');
    expect(session.agentId).toBe('agent-1');
  });

  it('forwards metadata to startSession', async () => {
    const client = makeMockClient();
    await ChatMemorySession.create(client, 'agent-2', { source: 'playground' });

    expect(client.startSession).toHaveBeenCalledWith('agent-2', { source: 'playground' });
  });
});

describe('ChatMemorySession.store', () => {
  let client: DakeraClient;
  let session: ChatMemorySession;

  beforeEach(() => {
    client = makeMockClient();
    session = new ChatMemorySession(client, 'agent-1', 'sess_abc');
  });

  it('attaches session_id, agent_id, and role tag', async () => {
    await session.store('user', 'Hello!');

    expect(client.storeMemory).toHaveBeenCalledWith('agent-1', expect.objectContaining({
      content: 'Hello!',
      session_id: 'sess_abc',
      memory_type: 'episodic',
      tags: expect.arrayContaining(['user']),
    }));
  });

  it('applies default importance of 0.6', async () => {
    await session.store('assistant', 'I understand.');

    expect(client.storeMemory).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ importance: 0.6 }),
    );
  });

  it('respects custom importance', async () => {
    await session.store('user', 'Important message', { importance: 0.9 });

    expect(client.storeMemory).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ importance: 0.9 }),
    );
  });

  it('deduplicates role tag', async () => {
    await session.store('user', 'test', { tags: ['user', 'extra'] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = (client.storeMemory as any).mock.calls[0][1];
    const userCount = (call.tags as string[]).filter((t: string) => t === 'user').length;
    expect(userCount).toBe(1);
    expect(call.tags).toContain('extra');
  });
});

describe('ChatMemorySession.recall', () => {
  let client: DakeraClient;
  let session: ChatMemorySession;

  beforeEach(() => {
    client = makeMockClient({
      recall: vi.fn().mockResolvedValue({
        memories: [
          { id: 'mem_1', content: 'Alice likes TypeScript', score: 0.9 },
        ],
      } as RecallResponse),
    });
    session = new ChatMemorySession(client, 'agent-1', 'sess_abc');
  });

  it('calls recall with agent id and default top_k 5', async () => {
    const memories = await session.recall('user preferences');

    expect(client.recall).toHaveBeenCalledWith('agent-1', 'user preferences', { top_k: 5 });
    expect(memories).toHaveLength(1);
    expect(memories[0].content).toBe('Alice likes TypeScript');
  });

  it('passes custom topK', async () => {
    await session.recall('something', { topK: 10 });

    expect(client.recall).toHaveBeenCalledWith(expect.anything(), expect.anything(), { top_k: 10 });
  });
});

describe('ChatMemorySession.close', () => {
  it('calls endSession with session id', async () => {
    const client = makeMockClient();
    const session = new ChatMemorySession(client, 'agent-1', 'sess_close');

    await session.close();

    expect(client.endSession).toHaveBeenCalledWith('sess_close');
  });
});

describe('ChatMemorySession properties', () => {
  it('exposes sessionId and agentId', () => {
    const client = makeMockClient();
    const session = new ChatMemorySession(client, 'my-agent', 'my-sess');

    expect(session.sessionId).toBe('my-sess');
    expect(session.agentId).toBe('my-agent');
  });
});
