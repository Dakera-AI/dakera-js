/**
 * Session management helpers for Dakera SDK.
 *
 * Provides a high-level {@link ChatMemorySession} class that wraps the
 * low-level session/memory API into the three-step pattern used by the
 * playground LLM chat comparison feature:
 *
 * 1. Create a session (bound to an agent)
 * 2. Store conversation turns in the session
 * 3. Recall relevant context before generating the next response
 *
 * @example
 * ```typescript
 * import { DakeraClient, ChatMemorySession } from '@dakera-ai/dakera';
 *
 * const client = new DakeraClient({ baseUrl: 'http://localhost:3000', apiKey: '...' });
 *
 * const session = await ChatMemorySession.create(client, 'chat-agent');
 * try {
 *   await session.store('user', 'My name is Alice and I like TypeScript.');
 *   const context = await session.recall('user preferences');
 *   // pass context to your LLM — or skip for the baseline arm
 * } finally {
 *   await session.close();
 * }
 * ```
 */

import type { DakeraClient } from './client';
import type {
  RecalledMemory,
  SessionEndResponse,
  StoreMemoryResponse,
} from './types';

export interface StoreOptions {
  /** Importance score 0.0–1.0. Defaults to 0.6. */
  importance?: number;
  /** Additional tags; the role is always appended automatically. */
  tags?: string[];
}

export interface RecallOptions {
  /** Maximum number of memories to return (default: 5). */
  topK?: number;
}

/**
 * High-level session helper for LLM chat comparison patterns.
 *
 * Groups conversation turns under a single Dakera session so that:
 *
 * - Every stored message is associated with `sessionId` for scoped retrieval.
 * - `recall` queries the agent's full memory — not just this session — so
 *   prior conversations inform the current exchange.
 * - Clean async factory via {@link ChatMemorySession.create} avoids
 *   constructor async anti-patterns.
 */
export class ChatMemorySession {
  private readonly _client: DakeraClient;
  private readonly _agentId: string;
  private readonly _sessionId: string;

  constructor(client: DakeraClient, agentId: string, sessionId: string) {
    this._client = client;
    this._agentId = agentId;
    this._sessionId = sessionId;
  }

  // -------------------------------------------------------------------------
  // Factory
  // -------------------------------------------------------------------------

  /**
   * Create a new Dakera session and return a `ChatMemorySession`.
   *
   * @param client   Configured {@link DakeraClient} instance.
   * @param agentId  Identifier for the agent whose memory to use.
   * @param metadata Optional metadata attached to the session record.
   *
   * @example
   * ```typescript
   * const session = await ChatMemorySession.create(client, 'my-agent');
   * try {
   *   await session.store('user', 'Hello!');
   *   const ctx = await session.recall('greeting');
   * } finally {
   *   await session.close();
   * }
   * ```
   */
  static async create(
    client: DakeraClient,
    agentId: string,
    metadata?: Record<string, unknown>,
  ): Promise<ChatMemorySession> {
    const session = await client.startSession(agentId, metadata);
    return new ChatMemorySession(client, agentId, session.id);
  }

  // -------------------------------------------------------------------------
  // Core operations
  // -------------------------------------------------------------------------

  /**
   * Store a conversation turn in the session.
   *
   * @param role     Speaker role — e.g. `"user"` or `"assistant"`.
   * @param content  The message text to persist.
   * @param options  Optional importance (default: 0.6) and extra tags.
   *
   * @returns The stored memory response from the server.
   */
  async store(
    role: string,
    content: string,
    options: StoreOptions = {},
  ): Promise<StoreMemoryResponse> {
    const effectiveTags = Array.from(new Set([...(options.tags ?? []), role]));
    return this._client.storeMemory(this._agentId, {
      content,
      memory_type: 'episodic',
      importance: options.importance ?? 0.6,
      session_id: this._sessionId,
      tags: effectiveTags,
    });
  }

  /**
   * Recall memories relevant to `query` for this agent.
   *
   * Searches the agent's full memory (not just the current session) so
   * that context from prior conversations is surfaced when relevant.
   *
   * @param query  Natural-language query to find relevant memories.
   * @param options Optional `topK` (default: 5).
   *
   * @returns Array of {@link RecalledMemory} objects ordered by relevance.
   */
  async recall(
    query: string,
    options: RecallOptions = {},
  ): Promise<RecalledMemory[]> {
    const response = await this._client.recall(this._agentId, query, {
      top_k: options.topK ?? 5,
    });
    return response.memories;
  }

  /**
   * End the Dakera session.
   *
   * @returns The session end response from the server.
   */
  async close(): Promise<SessionEndResponse> {
    return this._client.endSession(this._sessionId);
  }

  // -------------------------------------------------------------------------
  // Properties
  // -------------------------------------------------------------------------

  /** The underlying Dakera session ID. */
  get sessionId(): string {
    return this._sessionId;
  }

  /** The agent ID this session is bound to. */
  get agentId(): string {
    return this._agentId;
  }
}
