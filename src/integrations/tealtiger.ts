/**
 * TealTiger governance middleware integration for Dakera.
 *
 * Provides persistent, decay-weighted storage for TealTiger governance artefacts
 * using Dakera's memory API. Three classes are exported:
 *
 * - {@link DakeraCostStorage} — TealTiger `CostStorage` backend
 * - {@link DakeraDecisionStore} — audit decision storage with KG-linked retrieval
 * - {@link DakeraDelegationHelper} — delegation chain management via memory KG
 *
 * @example
 * ```typescript
 * import { DakeraClient } from '@dakera-ai/dakera';
 * import { DakeraCostStorage, DakeraDecisionStore } from '@dakera-ai/dakera/integrations/tealtiger';
 * import { TealOpenAI, TealOpenAIConfig } from 'tealtiger';
 *
 * const client = new DakeraClient('http://localhost:3000', { apiKey: 'dk-mykey' });
 * const storage = new DakeraCostStorage(client);
 *
 * const tealClient = new TealOpenAI({ config: new TealOpenAIConfig({ costStorage: storage }) });
 * ```
 */

import type { DakeraClient } from '../client';
import type { StoreMemoryRequest } from '../types';

// ---------------------------------------------------------------------------
// Importance weights by decision severity (mirrors Python tealtiger.py)
// ---------------------------------------------------------------------------
const DECISION_IMPORTANCE: Record<string, number> = {
  DENY: 0.95,
  REQUIRE_APPROVAL: 0.90,
  REDACT: 0.90,
  TRANSFORM: 0.85,
  DEGRADE: 0.85,
  ALLOW: 0.80,
};

const COST_IMPORTANCE = 0.7;
const GOVERNANCE_TAGS = ['governance', 'cost'];

// Terminal actions for is_terminal() check.
// REQUIRE_APPROVAL is explicitly excluded — it is a pending state, not terminal.
const TERMINAL_ACTIONS = new Set(['ALLOW', 'DENY', 'TIMED_OUT']);

// ---------------------------------------------------------------------------
// Internal helper — extends StoreMemoryRequest to carry tags
// (server accepts tags; the public TS type doesn't list the field yet)
// ---------------------------------------------------------------------------
type TaggedStoreRequest = StoreMemoryRequest & { tags?: string[] };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toUnix(dt: Date | string | number | undefined | null): number | undefined {
  if (dt == null) return undefined;
  if (typeof dt === 'number') return dt;
  if (dt instanceof Date) return Math.floor(dt.getTime() / 1000);
  const ms = Date.parse(dt);
  if (isNaN(ms)) return undefined;
  return Math.floor(ms / 1000);
}

function providerStr(provider: unknown): string {
  if (provider && typeof provider === 'object' && 'value' in provider) {
    return String((provider as { value: unknown }).value);
  }
  return String(provider ?? '');
}

function serialize(obj: unknown): string {
  if (obj && typeof obj === 'object') {
    const o = obj as Record<string, unknown>;
    if (typeof o['toJSON'] === 'function') return JSON.stringify(o['toJSON']());
    if (typeof o['model_dump_json'] === 'function') return String(o['model_dump_json']());
  }
  return JSON.stringify(obj);
}

// ---------------------------------------------------------------------------
// DakeraCostStorage
// ---------------------------------------------------------------------------

/**
 * TealTiger `CostStorage` backed by Dakera persistent agent memory.
 *
 * All cost records are stored in a Dakera namespace (configurable via
 * `dakeraAgentId`, default `"governance"`) and tagged with provider, model,
 * agent, and cost_id for efficient lookups without full-table scans.
 *
 * The class works whether or not `tealtiger` is installed. When TealTiger is
 * absent, raw JSON objects are returned instead of typed `CostRecord` instances.
 *
 * @example
 * ```typescript
 * const client = new DakeraClient('http://localhost:3000', { apiKey: 'dk-key' });
 * const storage = new DakeraCostStorage(client);
 *
 * // Plug into a TealTiger client
 * const teal = new TealOpenAI({ config: new TealOpenAIConfig({ costStorage: storage }) });
 * ```
 */
export class DakeraCostStorage {
  private readonly client: DakeraClient;
  private readonly agentId: string;

  constructor(client: DakeraClient, dakeraAgentId = 'governance') {
    this.client = client;
    this.agentId = dakeraAgentId;
  }

  /** Persist a `CostRecord` as a tagged Dakera memory. */
  async store(record: unknown): Promise<void> {
    const r = record as Record<string, unknown>;
    const tags = [
      ...GOVERNANCE_TAGS,
      `model:${r['model']}`,
      `provider:${providerStr(r['provider'])}`,
      `cost_id:${r['id']}`,
      `request_id:${r['request_id']}`,
      `agent:${r['agent_id']}`,
    ];
    await this.client.storeMemory(this.agentId, {
      content: serialize(record),
      importance: COST_IMPORTANCE,
      tags,
    } as TaggedStoreRequest as StoreMemoryRequest);
  }

  /** Retrieve a single `CostRecord` by its ID. */
  async get(id: string): Promise<unknown> {
    const resp = await this.client.batchRecall({
      agent_id: this.agentId,
      filter: { tags: ['cost', `cost_id:${id}`] },
      limit: 1,
    });
    if (resp.memories.length === 0) return null;
    return this._deserialize(resp.memories[0].content);
  }

  /** Retrieve all `CostRecord`s for a given request ID. */
  async getByRequestId(requestId: string): Promise<unknown[]> {
    const resp = await this.client.batchRecall({
      agent_id: this.agentId,
      filter: { tags: ['cost', `request_id:${requestId}`] },
      limit: 1000,
    });
    return resp.memories.map((m) => this._deserialize(m.content)).filter((r) => r !== null);
  }

  /** Retrieve all `CostRecord`s for a specific agent, with optional date bounds. */
  async getByAgentId(
    agentId: string,
    startDate?: Date | string | number,
    endDate?: Date | string | number,
  ): Promise<unknown[]> {
    const resp = await this.client.batchRecall({
      agent_id: this.agentId,
      filter: {
        tags: ['cost', `agent:${agentId}`],
        created_after: toUnix(startDate),
        created_before: toUnix(endDate),
      },
      limit: 1000,
    });
    return resp.memories.map((m) => this._deserialize(m.content)).filter((r) => r !== null);
  }

  /** Retrieve all `CostRecord`s within a date range. */
  async getByDateRange(
    startDate: Date | string | number,
    endDate: Date | string | number,
  ): Promise<unknown[]> {
    const resp = await this.client.batchRecall({
      agent_id: this.agentId,
      filter: {
        tags: GOVERNANCE_TAGS,
        created_after: toUnix(startDate),
        created_before: toUnix(endDate),
      },
      limit: 1000,
    });
    return resp.memories.map((m) => this._deserialize(m.content)).filter((r) => r !== null);
  }

  /**
   * Return aggregated cost statistics for a date range.
   *
   * Performs client-side aggregation matching `InMemoryCostStorage` logic.
   * Returns a plain object summary (typed `CostSummary` shape).
   */
  async getSummary(
    startDate: Date | string | number,
    endDate: Date | string | number,
    agentId?: string,
  ): Promise<CostSummary> {
    const tags = agentId ? ['cost', `agent:${agentId}`] : GOVERNANCE_TAGS;
    const resp = await this.client.batchRecall({
      agent_id: this.agentId,
      filter: {
        tags,
        created_after: toUnix(startDate),
        created_before: toUnix(endDate),
      },
      limit: 1000,
    });
    const records = resp.memories
      .map((m) => this._deserialize(m.content))
      .filter((r) => r !== null) as Record<string, unknown>[];
    return this._aggregateSummary(records, startDate, endDate);
  }

  /** Delete all `CostRecord`s older than `beforeDate`. Returns deleted count. */
  async deleteOlderThan(beforeDate: Date | string | number): Promise<number> {
    const resp = await this.client.batchForget({
      agent_id: this.agentId,
      filter: {
        tags: GOVERNANCE_TAGS,
        created_before: toUnix(beforeDate),
      },
    });
    return resp.deleted_count;
  }

  /** Delete all `CostRecord`s in this storage. */
  async clear(): Promise<void> {
    await this.client.batchForget({
      agent_id: this.agentId,
      filter: { tags: GOVERNANCE_TAGS },
    });
  }

  // ------------------------------------------------------------------
  // Private helpers
  // ------------------------------------------------------------------

  private _deserialize(content: string): unknown {
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private _aggregateSummary(
    records: Record<string, unknown>[],
    startDate: Date | string | number,
    endDate: Date | string | number,
  ): CostSummary {
    let totalCost = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalTokenCount = 0;
    const byModel: Record<string, number> = {};
    const byProvider: Record<string, number> = {};
    const byAgent: Record<string, number> = {};

    for (const rec of records) {
      const cost = typeof rec['actual_cost'] === 'number' ? rec['actual_cost'] : 0;
      const model = String(rec['model'] ?? 'unknown');
      const provider = String(rec['provider'] ?? 'unknown');
      const agent = String(rec['agent_id'] ?? 'unknown');

      const tokens = rec['actual_tokens'] as Record<string, number> | null | undefined;
      if (tokens && typeof tokens === 'object') {
        totalTokenCount += (tokens['total_tokens'] ?? 0) as number;
        totalInputTokens += (tokens['input_tokens'] ?? 0) as number;
        totalOutputTokens += (tokens['output_tokens'] ?? 0) as number;
      }

      totalCost += cost;
      byModel[model] = (byModel[model] ?? 0) + cost;
      byProvider[provider] = (byProvider[provider] ?? 0) + cost;
      byAgent[agent] = (byAgent[agent] ?? 0) + cost;
    }

    const total = records.length;
    const averageCostPerRequest = total > 0 ? totalCost / total : 0;

    return {
      total_cost: totalCost,
      total_requests: total,
      average_cost_per_request: averageCostPerRequest,
      by_model: byModel,
      by_provider: byProvider,
      by_agent: byAgent,
      period: { start: String(startDate), end: String(endDate) },
      total_tokens: {
        total: totalTokenCount,
        input: totalInputTokens,
        output: totalOutputTokens,
      },
    };
  }
}

/** Shape returned by {@link DakeraCostStorage.getSummary}. */
export interface CostSummary {
  total_cost: number;
  total_requests: number;
  average_cost_per_request: number;
  by_model: Record<string, number>;
  by_provider: Record<string, number>;
  by_agent: Record<string, number>;
  period: { start: string; end: string };
  total_tokens: { total: number; input: number; output: number };
}

// ---------------------------------------------------------------------------
// DakeraDecisionStore
// ---------------------------------------------------------------------------

/**
 * Stores and retrieves TealTiger governance decisions in Dakera memory.
 *
 * Decision records are stored as episodic memories with importance weighted
 * by `DecisionAction` severity:
 *
 * - `DENY` → 0.95 (highest importance, longest retention)
 * - `REQUIRE_APPROVAL` / `REDACT` → 0.90
 * - `TRANSFORM` / `DEGRADE` → 0.85
 * - `ALLOW` → 0.80
 *
 * `REQUIRE_APPROVAL` is **not** considered terminal — it is a pending state.
 * Use {@link isTerminal} to guard idempotent re-evaluation.
 *
 * @example
 * ```typescript
 * const store = new DakeraDecisionStore(client);
 * const memId = await store.storeReceipt('my-agent', decision);
 * const found = await store.lookupReceipt('my-agent', decision.correlation_id);
 * const done = await store.isTerminal('my-agent', decision.correlation_id);
 * ```
 */
export class DakeraDecisionStore {
  private readonly client: DakeraClient;

  constructor(client: DakeraClient) {
    this.client = client;
  }

  /**
   * Persist a TealTiger `Decision` in Dakera memory.
   *
   * @param agentId - Dakera namespace to store the decision under.
   * @param decision - A TealTiger `Decision` object with `.action` and `.correlation_id`.
   * @returns The Dakera memory ID of the stored decision.
   */
  async storeReceipt(agentId: string, decision: unknown): Promise<string> {
    const d = decision as Record<string, unknown>;
    const actionRaw = d['action'];
    const actionStr =
      actionRaw && typeof actionRaw === 'object' && 'value' in actionRaw
        ? String((actionRaw as { value: unknown }).value)
        : String(actionRaw ?? '');
    const importance = DECISION_IMPORTANCE[actionStr.toUpperCase()] ?? DECISION_IMPORTANCE['ALLOW'];
    const correlationId = String(d['correlation_id'] ?? '');
    const policyId = String(d['policy_id'] ?? '');
    const tags = [
      'governance',
      'decision',
      `decision:${actionStr.toLowerCase()}`,
      `correlation_id:${correlationId}`,
      `policy_id:${policyId}`,
    ];
    const resp = await this.client.storeMemory(agentId, {
      content: serialize(decision),
      importance,
      memory_type: 'episodic',
      tags,
    } as TaggedStoreRequest as StoreMemoryRequest);
    return String(resp.memory.id ?? '');
  }

  /**
   * Look up a governance decision by correlation ID.
   *
   * @returns The decision object (or a raw dict), or `null` if not found.
   */
  async lookupReceipt(agentId: string, correlationId: string): Promise<unknown> {
    const resp = await this.client.batchRecall({
      agent_id: agentId,
      filter: {
        tags: ['governance', 'decision', `correlation_id:${correlationId}`],
      },
      limit: 1,
    });
    if (resp.memories.length === 0) return null;
    try {
      return JSON.parse(resp.memories[0].content);
    } catch {
      return null;
    }
  }

  /**
   * Return `true` if a *terminal* decision for `correlationId` is stored.
   *
   * Terminal actions are `ALLOW`, `DENY`, and `TIMED_OUT`.
   * `REQUIRE_APPROVAL` is **not** terminal — it is a pending state and returns
   * `false` so the request continues to be evaluated.
   */
  async isTerminal(agentId: string, correlationId: string): Promise<boolean> {
    const resp = await this.client.batchRecall({
      agent_id: agentId,
      filter: {
        tags: ['governance', 'decision', `correlation_id:${correlationId}`],
      },
      limit: 1,
    });
    if (resp.memories.length === 0) return false;
    try {
      const content = JSON.parse(resp.memories[0].content) as Record<string, unknown>;
      const action = String(content['action'] ?? '').toUpperCase();
      return TERMINAL_ACTIONS.has(action);
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// DakeraDelegationHelper
// ---------------------------------------------------------------------------

/**
 * Manages agent delegation chains using the Dakera memory knowledge graph.
 *
 * Creates typed `delegated_from` edges between decision memory nodes,
 * enabling audit-trail traversal across arbitrarily deep delegation hierarchies.
 *
 * @example
 * ```typescript
 * const helper = new DakeraDelegationHelper(client);
 *
 * // Link child decision to parent
 * await helper.linkDelegation({ childId: childMemId, parentId: parentMemId });
 *
 * // Traverse the full chain
 * const chain = await helper.getDelegationChain('my-agent', rootMemId, 5);
 * // ['root-mem-id', 'parent-mem-id', 'grandparent-mem-id']
 * ```
 */
export class DakeraDelegationHelper {
  private static readonly EDGE_TYPE = 'delegated_from';

  private readonly client: DakeraClient;

  constructor(client: DakeraClient) {
    this.client = client;
  }

  /**
   * Create a `delegated_from` KG edge from `childId` to `parentId`.
   *
   * @param childId - Dakera memory ID of the child (delegated) decision.
   * @param parentId - Dakera memory ID of the parent (delegating) decision.
   */
  async linkDelegation({ childId, parentId }: { childId: string; parentId: string }): Promise<void> {
    await this.client.memoryLink(
      childId,
      parentId,
      DakeraDelegationHelper.EDGE_TYPE as import('../types').EdgeType,
    );
  }

  /**
   * Traverse the delegation chain from a root decision memory.
   *
   * Performs a BFS traversal over `delegated_from` edges in the memory KG,
   * returning an ordered list of memory IDs from root outward.
   *
   * @param agentId - Dakera namespace containing the decision memories.
   * @param decisionId - Dakera memory ID of the root decision.
   * @param maxDepth - Maximum hops to traverse (clamped to 5 by the KG API).
   * @returns Ordered list of memory IDs starting with `decisionId`.
   */
  async getDelegationChain(agentId: string, decisionId: string, maxDepth = 10): Promise<string[]> {
    const result = await this.client.knowledgeQuery(agentId, {
      rootId: decisionId,
      edgeType: DakeraDelegationHelper.EDGE_TYPE,
      maxDepth: Math.min(maxDepth, 5),
    });
    const seen = new Set<string>([decisionId]);
    const chain: string[] = [decisionId];
    for (const edge of result.edges) {
      for (const nid of [edge.source_id, edge.target_id]) {
        if (!seen.has(nid)) {
          seen.add(nid);
          chain.push(nid);
        }
      }
    }
    return chain;
  }
}
