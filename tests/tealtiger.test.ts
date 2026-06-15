/**
 * Tests for TealTiger governance middleware integration.
 *
 * All tests use a mocked DakeraClient — TealTiger does NOT need to be installed.
 * Tests pass whether or not `tealtiger` is installed locally.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DakeraCostStorage, DakeraDecisionStore, DakeraDelegationHelper } from '../src/integrations/tealtiger';
import type { DakeraClient } from '../src/client';
import type { BatchRecallResponse, BatchForgetResponse, KgQueryResponse } from '../src/types';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const COMPLETE_COST_JSON = {
  id: 'cost-1',
  request_id: 'req-1',
  agent_id: 'ag-1',
  model: 'gpt-4o',
  provider: 'openai',
  actual_tokens: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
  actual_cost: 0.05,
  breakdown: { input_cost: 0.03, output_cost: 0.02 },
  timestamp: '2026-06-14T12:00:00Z',
};

function makeBatchRecallResponse(memories: Array<{ id: string; content: string }>): BatchRecallResponse {
  const mems = memories.map((m) => ({
    id: m.id,
    content: m.content,
    memory_type: 'episodic' as const,
    importance: 0.7,
    created_at: '2026-06-14T12:00:00Z',
    access_count: 0,
  }));
  return { memories: mems as never, total: mems.length, filtered: mems.length };
}

function makeMockClient(): DakeraClient {
  return {
    storeMemory: vi.fn().mockResolvedValue({ memory: { id: 'mem-1', content: '', memory_type: 'episodic', importance: 0.5 }, embedding_time_ms: 5 }),
    batchRecall: vi.fn().mockResolvedValue(makeBatchRecallResponse([])),
    batchForget: vi.fn().mockResolvedValue({ deleted_count: 0 } satisfies BatchForgetResponse),
    memoryLink: vi.fn().mockResolvedValue({ edge: null }),
    knowledgeQuery: vi.fn().mockResolvedValue({ agent_id: 'ag-1', node_count: 0, edge_count: 0, edges: [] } satisfies KgQueryResponse),
  } as unknown as DakeraClient;
}

function makeCostRecord(overrides: Partial<typeof COMPLETE_COST_JSON> = {}): Record<string, unknown> {
  const data = { ...COMPLETE_COST_JSON, ...overrides };
  return {
    ...data,
    toJSON: () => data,
  };
}

function makeMemory(content: string, id = 'mem-1') {
  return { id, content };
}

function completeCostPayload(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({ ...COMPLETE_COST_JSON, ...overrides });
}

// ---------------------------------------------------------------------------
// DakeraCostStorage — store()
// ---------------------------------------------------------------------------

describe('DakeraCostStorage.store', () => {
  it('calls storeMemory with correct tags', async () => {
    const client = makeMockClient();
    const storage = new DakeraCostStorage(client, 'test-ns');
    const record = makeCostRecord();

    await storage.store(record);

    expect(client.storeMemory).toHaveBeenCalledOnce();
    const [agentId, req] = (client.storeMemory as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(agentId).toBe('test-ns');
    expect((req as Record<string, unknown>)['importance']).toBe(0.7);
    const tags = (req as Record<string, unknown>)['tags'] as string[];
    expect(tags).toContain('governance');
    expect(tags).toContain('cost');
    expect(tags).toContain('model:gpt-4o');
    expect(tags).toContain('provider:openai');
    expect(tags).toContain('cost_id:cost-1');
    expect(tags).toContain('request_id:req-1');
    expect(tags).toContain('agent:ag-1');
  });

  it('content is valid JSON', async () => {
    const client = makeMockClient();
    const storage = new DakeraCostStorage(client);
    const record = makeCostRecord({ id: 'c-99' });

    await storage.store(record);

    const req = (client.storeMemory as ReturnType<typeof vi.fn>).mock.calls[0][1];
    const parsed = JSON.parse((req as Record<string, unknown>)['content'] as string);
    expect(parsed['id']).toBe('c-99');
  });

  it('store() returns a Promise (async method)', async () => {
    const client = makeMockClient();
    const storage = new DakeraCostStorage(client);
    const record = makeCostRecord();

    const result = storage.store(record);
    expect(result).toBeInstanceOf(Promise);
    await result;

    expect(client.storeMemory).toHaveBeenCalledOnce();
  });

  it('uses default governance agent id when not overridden', async () => {
    const client = makeMockClient();
    const storage = new DakeraCostStorage(client);
    await storage.store(makeCostRecord());

    const agentId = (client.storeMemory as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(agentId).toBe('governance');
  });
});

// ---------------------------------------------------------------------------
// DakeraCostStorage — get()
// ---------------------------------------------------------------------------

describe('DakeraCostStorage.get', () => {
  it('returns null when not found', async () => {
    const client = makeMockClient();
    const storage = new DakeraCostStorage(client);

    const result = await storage.get('missing-id');

    expect(result).toBeNull();
    expect(client.batchRecall).toHaveBeenCalledOnce();
  });

  it('passes correct filter with cost_id tag', async () => {
    const client = makeMockClient();
    (client.batchRecall as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeBatchRecallResponse([makeMemory(completeCostPayload())]),
    );
    const storage = new DakeraCostStorage(client);

    const result = await storage.get('cost-1');

    expect(result).not.toBeNull();
    const req = (client.batchRecall as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect((req as Record<string, unknown>)['filter']).toMatchObject({ tags: expect.arrayContaining(['cost_id:cost-1']) });
  });

  it('returns parsed JSON when TealTiger not installed', async () => {
    const payload = JSON.stringify({ id: 'cost-1', actual_cost: 0.05, model: 'gpt-4o' });
    const client = makeMockClient();
    (client.batchRecall as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeBatchRecallResponse([makeMemory(payload)]),
    );
    const storage = new DakeraCostStorage(client);

    const result = await storage.get('cost-1') as Record<string, unknown>;

    expect(typeof result).toBe('object');
    expect(result['model']).toBe('gpt-4o');
  });
});

// ---------------------------------------------------------------------------
// DakeraCostStorage — getByRequestId()
// ---------------------------------------------------------------------------

describe('DakeraCostStorage.getByRequestId', () => {
  it('returns empty array when none found', async () => {
    const client = makeMockClient();
    const storage = new DakeraCostStorage(client);

    const result = await storage.getByRequestId('req-xyz');

    expect(result).toEqual([]);
  });

  it('filter includes request_id tag', async () => {
    const client = makeMockClient();
    const storage = new DakeraCostStorage(client);

    await storage.getByRequestId('req-abc');

    const req = (client.batchRecall as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect((req as Record<string, unknown>)['filter']).toMatchObject({ tags: expect.arrayContaining(['request_id:req-abc']) });
  });
});

// ---------------------------------------------------------------------------
// DakeraCostStorage — getByAgentId()
// ---------------------------------------------------------------------------

describe('DakeraCostStorage.getByAgentId', () => {
  it('filter includes agent tag', async () => {
    const client = makeMockClient();
    const storage = new DakeraCostStorage(client);

    await storage.getByAgentId('my-agent');

    const req = (client.batchRecall as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect((req as Record<string, unknown>)['filter']).toMatchObject({ tags: expect.arrayContaining(['agent:my-agent']) });
  });

  it('date bounds forwarded as Unix timestamps', async () => {
    const client = makeMockClient();
    const storage = new DakeraCostStorage(client);

    await storage.getByAgentId('ag-1', '2026-01-01T00:00:00Z', '2026-12-31T23:59:59Z');

    const req = (client.batchRecall as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const filter = (req as Record<string, unknown>)['filter'] as Record<string, unknown>;
    expect(filter['created_after']).toBeDefined();
    expect(filter['created_before']).toBeDefined();
    expect(typeof filter['created_after']).toBe('number');
    expect(typeof filter['created_before']).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// DakeraCostStorage — getByDateRange()
// ---------------------------------------------------------------------------

describe('DakeraCostStorage.getByDateRange', () => {
  it('filter uses governance tags with date bounds', async () => {
    const client = makeMockClient();
    const storage = new DakeraCostStorage(client);

    await storage.getByDateRange('2026-01-01T00:00:00Z', '2026-12-31T23:59:59Z');

    const req = (client.batchRecall as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const filter = (req as Record<string, unknown>)['filter'] as Record<string, unknown>;
    expect((filter['tags'] as string[])).toContain('governance');
    expect((filter['tags'] as string[])).toContain('cost');
    expect(filter['created_after']).toBeDefined();
    expect(filter['created_before']).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// DakeraCostStorage — getSummary()
// ---------------------------------------------------------------------------

describe('DakeraCostStorage.getSummary', () => {
  it('returns correct aggregation for two records', async () => {
    const payload = JSON.stringify({
      actual_cost: 0.10,
      model: 'gpt-4o',
      provider: 'openai',
      agent_id: 'ag-1',
    });
    const client = makeMockClient();
    (client.batchRecall as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeBatchRecallResponse([makeMemory(payload), makeMemory(payload, 'mem-2')]),
    );
    const storage = new DakeraCostStorage(client);

    const result = await storage.getSummary('2026-01-01T00:00:00Z', '2026-12-31T23:59:59Z');

    expect(typeof result).toBe('object');
    expect(Math.abs(result.total_cost - 0.20)).toBeLessThan(1e-9);
    expect(result.total_requests).toBe(2);
    expect(result.by_model['gpt-4o']).toBeDefined();
  });

  it('applies agent_id filter when provided', async () => {
    const client = makeMockClient();
    const storage = new DakeraCostStorage(client);

    await storage.getSummary('2026-01-01T00:00:00Z', '2026-12-31T23:59:59Z', 'ag-X');

    const req = (client.batchRecall as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const filter = (req as Record<string, unknown>)['filter'] as Record<string, unknown>;
    expect((filter['tags'] as string[])).toContain('agent:ag-X');
  });

  it('period is an object with start and end', async () => {
    const client = makeMockClient();
    const storage = new DakeraCostStorage(client);

    const result = await storage.getSummary('2026-01-01T00:00:00Z', '2026-12-31T23:59:59Z');

    expect(result.period).toMatchObject({ start: expect.any(String), end: expect.any(String) });
  });

  it('total_tokens contains total, input, and output', async () => {
    const client = makeMockClient();
    const storage = new DakeraCostStorage(client);

    const result = await storage.getSummary('2026-01-01T00:00:00Z', '2026-12-31T23:59:59Z');

    expect(result.total_tokens).toMatchObject({
      total: expect.any(Number),
      input: expect.any(Number),
      output: expect.any(Number),
    });
  });

  it('aggregates token counts from records', async () => {
    const payload = JSON.stringify({
      actual_cost: 0.05,
      model: 'gpt-4o',
      provider: 'openai',
      agent_id: 'ag-1',
      actual_tokens: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
    });
    const client = makeMockClient();
    (client.batchRecall as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeBatchRecallResponse([makeMemory(payload), makeMemory(payload, 'mem-2')]),
    );
    const storage = new DakeraCostStorage(client);

    const result = await storage.getSummary('2026-01-01T00:00:00Z', '2026-12-31T23:59:59Z');

    expect(result.total_tokens.total).toBe(300);
    expect(result.total_tokens.input).toBe(200);
    expect(result.total_tokens.output).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// DakeraCostStorage — deleteOlderThan() / clear()
// ---------------------------------------------------------------------------

describe('DakeraCostStorage.deleteOlderThan', () => {
  it('calls batchForget with created_before and returns count', async () => {
    const client = makeMockClient();
    (client.batchForget as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ deleted_count: 3 });
    const storage = new DakeraCostStorage(client);

    const count = await storage.deleteOlderThan('2026-01-01T00:00:00Z');

    expect(count).toBe(3);
    const req = (client.batchForget as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const filter = (req as Record<string, unknown>)['filter'] as Record<string, unknown>;
    expect(filter['created_before']).toBeDefined();
    expect((filter['tags'] as string[])).toContain('governance');
  });
});

describe('DakeraCostStorage.clear', () => {
  it('calls batchForget with governance tags', async () => {
    const client = makeMockClient();
    (client.batchForget as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ deleted_count: 10 });
    const storage = new DakeraCostStorage(client);

    await storage.clear();

    expect(client.batchForget).toHaveBeenCalledOnce();
    const req = (client.batchForget as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const filter = (req as Record<string, unknown>)['filter'] as Record<string, unknown>;
    expect((filter['tags'] as string[])).toContain('governance');
    expect((filter['tags'] as string[])).toContain('cost');
  });
});

// ---------------------------------------------------------------------------
// DakeraDecisionStore — storeReceipt()
// ---------------------------------------------------------------------------

function makeDecision(action = 'DENY', correlationId = 'corr-1', policyId = 'policy-1') {
  return {
    action: { value: action },
    correlation_id: correlationId,
    policy_id: policyId,
    toJSON: () => ({ action, correlation_id: correlationId, policy_id: policyId }),
  };
}

describe('DakeraDecisionStore.storeReceipt', () => {
  it('DENY uses highest importance (0.95)', async () => {
    const client = makeMockClient();
    const ds = new DakeraDecisionStore(client);

    await ds.storeReceipt('ag-1', makeDecision('DENY'));

    const req = (client.storeMemory as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect((req as Record<string, unknown>)['importance']).toBe(0.95);
  });

  it('REQUIRE_APPROVAL uses 0.90', async () => {
    const client = makeMockClient();
    const ds = new DakeraDecisionStore(client);
    await ds.storeReceipt('ag-1', makeDecision('REQUIRE_APPROVAL'));
    const req = (client.storeMemory as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect((req as Record<string, unknown>)['importance']).toBe(0.90);
  });

  it('REDACT uses 0.90', async () => {
    const client = makeMockClient();
    const ds = new DakeraDecisionStore(client);
    await ds.storeReceipt('ag-1', makeDecision('REDACT'));
    const req = (client.storeMemory as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect((req as Record<string, unknown>)['importance']).toBe(0.90);
  });

  it('TRANSFORM uses 0.85', async () => {
    const client = makeMockClient();
    const ds = new DakeraDecisionStore(client);
    await ds.storeReceipt('ag-1', makeDecision('TRANSFORM'));
    const req = (client.storeMemory as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect((req as Record<string, unknown>)['importance']).toBe(0.85);
  });

  it('DEGRADE uses 0.85', async () => {
    const client = makeMockClient();
    const ds = new DakeraDecisionStore(client);
    await ds.storeReceipt('ag-1', makeDecision('DEGRADE'));
    const req = (client.storeMemory as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect((req as Record<string, unknown>)['importance']).toBe(0.85);
  });

  it('ALLOW uses lowest importance (0.80)', async () => {
    const client = makeMockClient();
    const ds = new DakeraDecisionStore(client);
    await ds.storeReceipt('ag-1', makeDecision('ALLOW'));
    const req = (client.storeMemory as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect((req as Record<string, unknown>)['importance']).toBe(0.80);
  });

  it('tags include decision, action, and ids', async () => {
    const client = makeMockClient();
    const ds = new DakeraDecisionStore(client);

    await ds.storeReceipt('ag-1', makeDecision('DENY', 'corr-99', 'policy-99'));

    const req = (client.storeMemory as ReturnType<typeof vi.fn>).mock.calls[0][1];
    const tags = (req as Record<string, unknown>)['tags'] as string[];
    expect(tags).toContain('governance');
    expect(tags).toContain('decision');
    expect(tags).toContain('decision:deny');
    expect(tags).toContain('correlation_id:corr-99');
    expect(tags).toContain('policy_id:policy-99');
  });

  it('returns the memory ID string', async () => {
    const client = makeMockClient();
    (client.storeMemory as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      memory: { id: 'mem-abc', content: '', memory_type: 'episodic', importance: 0.95 },
    });
    const ds = new DakeraDecisionStore(client);

    const memId = await ds.storeReceipt('ag-1', makeDecision());

    expect(memId).toBe('mem-abc');
  });

  it('sets memory_type to episodic', async () => {
    const client = makeMockClient();
    const ds = new DakeraDecisionStore(client);
    await ds.storeReceipt('ag-1', makeDecision('DENY'));
    const req = (client.storeMemory as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect((req as Record<string, unknown>)['memory_type']).toBe('episodic');
  });
});

// ---------------------------------------------------------------------------
// DakeraDecisionStore — lookupReceipt()
// ---------------------------------------------------------------------------

describe('DakeraDecisionStore.lookupReceipt', () => {
  it('returns null when not found', async () => {
    const client = makeMockClient();
    const ds = new DakeraDecisionStore(client);

    expect(await ds.lookupReceipt('ag-1', 'corr-missing')).toBeNull();
  });

  it('filter includes correlation_id tag', async () => {
    const payload = JSON.stringify({ action: 'ALLOW', correlation_id: 'corr-42', policy_id: 'p-1' });
    const client = makeMockClient();
    (client.batchRecall as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeBatchRecallResponse([makeMemory(payload)]),
    );
    const ds = new DakeraDecisionStore(client);

    const result = await ds.lookupReceipt('ag-1', 'corr-42');

    expect(result).not.toBeNull();
    const req = (client.batchRecall as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect((req as Record<string, unknown>)['filter']).toMatchObject({
      tags: expect.arrayContaining(['correlation_id:corr-42']),
    });
  });
});

// ---------------------------------------------------------------------------
// DakeraDecisionStore — isTerminal()
// ---------------------------------------------------------------------------

describe('DakeraDecisionStore.isTerminal', () => {
  it('returns false when no receipt exists', async () => {
    const client = makeMockClient();
    const ds = new DakeraDecisionStore(client);
    expect(await ds.isTerminal('ag-1', 'corr-new')).toBe(false);
  });

  it.each(['ALLOW', 'DENY', 'TIMED_OUT'])('%s is a terminal action', async (action) => {
    const payload = JSON.stringify({ action, correlation_id: 'corr-exists' });
    const client = makeMockClient();
    (client.batchRecall as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeBatchRecallResponse([makeMemory(payload)]),
    );
    const ds = new DakeraDecisionStore(client);
    expect(await ds.isTerminal('ag-1', 'corr-exists')).toBe(true);
  });

  it('REQUIRE_APPROVAL is NOT terminal (pending state)', async () => {
    const payload = JSON.stringify({ action: 'REQUIRE_APPROVAL', correlation_id: 'corr-pending' });
    const client = makeMockClient();
    (client.batchRecall as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeBatchRecallResponse([makeMemory(payload)]),
    );
    const ds = new DakeraDecisionStore(client);
    expect(await ds.isTerminal('ag-1', 'corr-pending')).toBe(false);
  });

  it('returns false when action field is missing', async () => {
    const payload = JSON.stringify({ correlation_id: 'corr-exists' });
    const client = makeMockClient();
    (client.batchRecall as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeBatchRecallResponse([makeMemory(payload)]),
    );
    const ds = new DakeraDecisionStore(client);
    expect(await ds.isTerminal('ag-1', 'corr-exists')).toBe(false);
  });

  it('filter includes correlation_id tag', async () => {
    const client = makeMockClient();
    const ds = new DakeraDecisionStore(client);

    await ds.isTerminal('ag-1', 'corr-xyz');

    const req = (client.batchRecall as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect((req as Record<string, unknown>)['filter']).toMatchObject({
      tags: expect.arrayContaining(['correlation_id:corr-xyz']),
    });
  });
});

// ---------------------------------------------------------------------------
// DakeraDelegationHelper
// ---------------------------------------------------------------------------

describe('DakeraDelegationHelper.linkDelegation', () => {
  it('calls memoryLink with correct args', async () => {
    const client = makeMockClient();
    const helper = new DakeraDelegationHelper(client);

    await helper.linkDelegation({ childId: 'child-mem', parentId: 'parent-mem' });

    expect(client.memoryLink).toHaveBeenCalledOnce();
    const [sourceId, targetId, edgeType] = (client.memoryLink as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(sourceId).toBe('child-mem');
    expect(targetId).toBe('parent-mem');
    expect(edgeType).toBe('delegated_from');
  });
});

describe('DakeraDelegationHelper.getDelegationChain', () => {
  function makeKgResponse(root: string, hops: string[]): KgQueryResponse {
    const edges = hops.map((hop, i) => ({
      id: `edge-${i}`,
      source_id: i === 0 ? root : hops[i - 1],
      target_id: hop,
      edge_type: 'linked_by' as const,
      weight: 1.0,
      created_at: 0,
    }));
    return { agent_id: 'ag-1', node_count: hops.length + 1, edge_count: edges.length, edges };
  }

  it('chain starts with the root decision ID', async () => {
    const client = makeMockClient();
    (client.knowledgeQuery as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeKgResponse('root', ['parent', 'grandparent']),
    );
    const helper = new DakeraDelegationHelper(client);

    const chain = await helper.getDelegationChain('ag-1', 'root', 5);

    expect(chain[0]).toBe('root');
    expect(chain).toContain('parent');
    expect(chain).toContain('grandparent');
  });

  it('max_depth is clamped to 5', async () => {
    const client = makeMockClient();
    const helper = new DakeraDelegationHelper(client);

    await helper.getDelegationChain('ag-1', 'root', 20);

    const opts = (client.knowledgeQuery as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect((opts as Record<string, unknown>)['maxDepth']).toBeLessThanOrEqual(5);
  });

  it('no edges returns single-item chain', async () => {
    const client = makeMockClient();
    const helper = new DakeraDelegationHelper(client);

    const chain = await helper.getDelegationChain('ag-1', 'root-only', 3);

    expect(chain).toEqual(['root-only']);
  });

  it('deduplicates node IDs in chain', async () => {
    const client = makeMockClient();
    (client.knowledgeQuery as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      agent_id: 'ag-1',
      node_count: 2,
      edge_count: 2,
      edges: [
        { id: 'e1', source_id: 'root', target_id: 'child', edge_type: 'linked_by', weight: 1, created_at: 0 },
        { id: 'e2', source_id: 'root', target_id: 'child', edge_type: 'linked_by', weight: 1, created_at: 0 },
      ],
    } satisfies KgQueryResponse);
    const helper = new DakeraDelegationHelper(client);

    const chain = await helper.getDelegationChain('ag-1', 'root', 2);

    const childCount = chain.filter((id) => id === 'child').length;
    expect(childCount).toBe(1);
  });
});
