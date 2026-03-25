/**
 * Dakera Client
 *
 * Main client class for interacting with Dakera server.
 */

import {
  AuthenticationError,
  AuthorizationError,
  ConnectionError,
  ErrorCode,
  NotFoundError,
  RateLimitError,
  ServerError,
  TimeoutError,
  ValidationError,
  DakeraError,
} from './errors';

/** Map a raw server code string to a typed ErrorCode, defaulting to UNKNOWN. */
function parseErrorCode(raw: unknown): ErrorCode {
  if (typeof raw === 'string' && raw in ErrorCode) {
    return raw as ErrorCode;
  }
  return ErrorCode.UNKNOWN;
}
import type {
  AgentStats,
  AgentSummary,
  AnalyticsOptions,
  AnalyticsOverview,
  ApiKey,
  BackupInfo,
  BatchQuerySpec,
  BatchTextQueryOptions,
  BatchTextQueryResponse,
  CacheStats,
  ClientOptions,
  ClusterNode,
  ClusterStatus,
  ConsolidateRequest,
  ConsolidateResponse,
  CreateKeyRequest,
  DeduplicateRequest,
  DeduplicateResponse,
  DeleteOptions,
  DeleteResponse,
  DocumentInput,
  FilterExpression,
  FullKnowledgeGraphRequest,
  FullTextSearchResult,
  HealthResponse,
  HybridSearchResult,
  IndexStats,
  KeyUsage,
  KnowledgeGraphRequest,
  KnowledgeGraphResponse,
  LatencyAnalytics,
  ListSessionsOptions,
  Memory,
  MemoryFeedbackRequest,
  MemoryFeedbackResponse,
  NamespaceInfo,
  QueryOptions,
  RecalledMemory,
  SearchResult,
  Session,
  SlowQuery,
  StorageAnalytics,
  StoreMemoryRequest,
  StoreMemoryResponse,
  SummarizeRequest,
  SummarizeResponse,
  TextDocument,
  TextQueryOptions,
  TextQueryResponse,
  TextUpsertOptions,
  TextUpsertResponse,
  ThroughputAnalytics,
  TtlConfig,
  UpdateImportanceRequest,
  UpdateMemoryRequest,
  UpsertResponse,
  Vector,
  VectorInput,
  WarmCacheResponse,
  WarmingPriority,
  WarmingTargetTier,
  AccessPatternHint,
  AggregationResponse,
  ExportResponse,
  MultiVectorSearchResponse,
  QueryExplainResponse,
  UnifiedQueryResponse,
  DakeraEvent,
  MemoryEvent,
  CrossAgentNetworkRequest,
  CrossAgentNetworkResponse,
  ConfigureNamespaceRequest,
  ConfigureNamespaceResponse,
  BatchRecallRequest,
  BatchRecallResponse,
  BatchForgetRequest,
  BatchForgetResponse,
  RateLimitHeaders,
  AutoPilotStatusResponse,
  AutoPilotConfigRequest,
  AutoPilotConfigResponse,
  AutoPilotTriggerAction,
  AutoPilotTriggerResponse,
  DecayConfigResponse,
  DecayConfigUpdateRequest,
  DecayConfigUpdateResponse,
  DecayStatsResponse,
  OpsStats,
} from './types';

const DEFAULT_TIMEOUT = 30000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY = 100;
const DEFAULT_MAX_DELAY = 60000;

/**
 * Dakera client for interacting with the AI memory platform.
 *
 * @example
 * ```typescript
 * const client = new DakeraClient({ baseUrl: 'http://localhost:3000' });
 *
 * // Upsert vectors
 * await client.upsert('my-namespace', [
 *   { id: 'vec1', values: [0.1, 0.2, 0.3] },
 *   { id: 'vec2', values: [0.4, 0.5, 0.6] },
 * ]);
 *
 * // Query similar vectors
 * const results = await client.query('my-namespace', [0.1, 0.2, 0.3], { topK: 10 });
 * ```
 */
export class DakeraClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeout: number;
  private readonly connectTimeout: number;
  private readonly retryConfig: Required<import('./types').RetryConfig>;
  private readonly headers: Record<string, string>;
  /** OPS-1: rate-limit headers from the most recent API response. */
  private _lastRateLimitHeaders: RateLimitHeaders | null = null;

  constructor(options: ClientOptions | string) {
    if (typeof options === 'string') {
      options = { baseUrl: options };
    }

    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this.connectTimeout = options.connectTimeout ?? this.timeout;

    const rb = options.retryBackoff ?? {};
    this.retryConfig = {
      maxRetries: rb.maxRetries ?? options.maxRetries ?? DEFAULT_MAX_RETRIES,
      baseDelay: rb.baseDelay ?? DEFAULT_BASE_DELAY,
      maxDelay: rb.maxDelay ?? DEFAULT_MAX_DELAY,
      jitter: rb.jitter ?? true,
    };

    this.headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.apiKey) {
      this.headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
  }

  /**
   * Rate-limit headers from the most recent API response (OPS-1).
   *
   * Returns `null` until the first successful request has been made.
   */
  get lastRateLimitHeaders(): RateLimitHeaders | null {
    return this._lastRateLimitHeaders;
  }

  private computeBackoff(attempt: number): number {
    const { baseDelay, maxDelay, jitter } = this.retryConfig;
    let delay = Math.min(maxDelay, baseDelay * Math.pow(2, attempt));
    if (jitter) {
      delay *= 0.5 + Math.random();
    }
    return delay;
  }

  /**
   * Make an HTTP request with retry logic and exponential backoff.
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const { maxRetries } = this.retryConfig;
    // connectTimeout governs the initial connection phase; timeout governs the full request
    const connectMs = Math.min(this.connectTimeout, this.timeout);
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        // connectTimeout governs TCP connect; timeout governs the full request.
        // fetch does not expose a separate connect phase so we use the shorter
        // of the two as a conservative bound for the entire round trip.
        const timerId = setTimeout(() => controller.abort(), connectMs);

        const response = await fetch(url, {
          method,
          headers: this.headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timerId);

        return await this.handleResponse<T>(response);
      } catch (error) {
        if (error instanceof RateLimitError) {
          if (attempt === maxRetries - 1) throw error;
          const wait =
            error.retryAfter != null
              ? error.retryAfter * 1000
              : this.computeBackoff(attempt);
          await this.sleep(wait);
          continue;
        }

        if (error instanceof DakeraError) {
          if (
            error.statusCode &&
            error.statusCode >= 400 &&
            error.statusCode < 500
          ) {
            throw error;
          }
          if (attempt === maxRetries - 1) throw error;
          lastError = error;
        } else if (error instanceof Error) {
          if (attempt === maxRetries - 1) {
            if (error.name === 'AbortError') {
              throw new TimeoutError(`Request timed out after ${connectMs}ms`);
            }
            if (error.message.includes('fetch')) {
              throw new ConnectionError(`Failed to connect to ${url}: ${error.message}`);
            }
            throw error;
          }
          if (error.name === 'AbortError') {
            lastError = new TimeoutError(`Request timed out after ${connectMs}ms`);
          } else if (error.message.includes('fetch')) {
            lastError = new ConnectionError(`Failed to connect to ${url}: ${error.message}`);
          } else {
            lastError = error;
          }
        }

        await this.sleep(this.computeBackoff(attempt));
      }
    }

    throw lastError ?? new DakeraError('Request failed after retries');
  }

  /**
   * Handle HTTP response and throw appropriate errors.
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    // OPS-1: capture rate-limit headers before consuming the body
    this._lastRateLimitHeaders = {
      limit: this._parseHeaderInt(response.headers.get('X-RateLimit-Limit')),
      remaining: this._parseHeaderInt(response.headers.get('X-RateLimit-Remaining')),
      reset: this._parseHeaderInt(response.headers.get('X-RateLimit-Reset')),
      quotaUsed: this._parseHeaderInt(response.headers.get('X-Quota-Used')),
      quotaLimit: this._parseHeaderInt(response.headers.get('X-Quota-Limit')),
    };

    let body: unknown;
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      body = await response.json();
    } else if (response.status !== 204) {
      body = await response.text();
    }

    if (response.ok) {
      return body as T;
    }

    const errorMessage =
      typeof body === 'object' && body !== null && 'error' in body
        ? String((body as { error: unknown }).error)
        : typeof body === 'string'
          ? body
          : `HTTP ${response.status}`;

    const code = parseErrorCode(
      typeof body === 'object' && body !== null && 'code' in body
        ? (body as { code: unknown }).code
        : undefined
    );

    switch (response.status) {
      case 400:
        throw new ValidationError(errorMessage, response.status, body, code);
      case 401:
        throw new AuthenticationError('Authentication failed', response.status, body, code);
      case 403:
        throw new AuthorizationError(errorMessage, response.status, body, code);
      case 404:
        throw new NotFoundError(errorMessage, response.status, body, code);
      case 429: {
        const retryAfter = response.headers.get('Retry-After');
        throw new RateLimitError(
          'Rate limit exceeded',
          response.status,
          body,
          retryAfter ? parseInt(retryAfter, 10) : undefined,
          code
        );
      }
      default:
        if (response.status >= 500) {
          throw new ServerError(errorMessage, response.status, body, code);
        }
        throw new DakeraError(errorMessage, response.status, body, code);
    }
  }

  private _parseHeaderInt(value: string | null): number | undefined {
    if (value === null) return undefined;
    const n = parseInt(value, 10);
    return isNaN(n) ? undefined : n;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ===========================================================================
  // Vector Operations
  // ===========================================================================

  /**
   * Upsert vectors into a namespace.
   *
   * @param namespace - Target namespace
   * @param vectors - Vectors to upsert
   * @returns Upsert response with count
   *
   * @example
   * ```typescript
   * await client.upsert('my-namespace', [
   *   { id: 'vec1', values: [0.1, 0.2, 0.3], metadata: { label: 'a' } },
   *   { id: 'vec2', values: [0.4, 0.5, 0.6] },
   * ]);
   * ```
   */
  async upsert(namespace: string, vectors: VectorInput[]): Promise<UpsertResponse> {
    return this.request<UpsertResponse>(
      'POST',
      `/v1/namespaces/${namespace}/vectors`,
      { vectors }
    );
  }

  /**
   * Query vectors by similarity.
   *
   * @param namespace - Target namespace
   * @param vector - Query vector
   * @param options - Query options
   * @returns Search results
   *
   * @example
   * ```typescript
   * const results = await client.query('my-namespace', [0.1, 0.2, 0.3], {
   *   topK: 10,
   *   filter: { category: { $eq: 'electronics' } },
   *   includeMetadata: true,
   * });
   * ```
   */
  async query(
    namespace: string,
    vector: number[],
    options: QueryOptions = {}
  ): Promise<SearchResult> {
    const body: Record<string, unknown> = {
      vector,
      top_k: options.topK ?? 10,
      filter: options.filter,
      include_values: options.includeValues ?? false,
      include_metadata: options.includeMetadata ?? true,
    };

    if (options.distanceMetric) {
      body.distance_metric = options.distanceMetric;
    }
    if (options.consistency) {
      body.consistency = options.consistency;
    }
    if (options.stalenessConfig) {
      body.staleness_config = {
        max_staleness_ms: options.stalenessConfig.maxStalenessMs,
      };
    }

    return this.request<SearchResult>('POST', `/v1/namespaces/${namespace}/query`, body);
  }

  /**
   * Delete vectors from a namespace.
   *
   * @param namespace - Target namespace
   * @param options - Delete options (ids, filter, or deleteAll)
   * @returns Delete response with count
   *
   * @example
   * ```typescript
   * // Delete by IDs
   * await client.delete('my-namespace', { ids: ['vec1', 'vec2'] });
   *
   * // Delete by filter
   * await client.delete('my-namespace', { filter: { status: { $eq: 'obsolete' } } });
   *
   * // Delete all
   * await client.delete('my-namespace', { deleteAll: true });
   * ```
   */
  async delete(namespace: string, options: DeleteOptions): Promise<DeleteResponse> {
    const body: Record<string, unknown> = {};
    if (options.ids) body.ids = options.ids;
    if (options.filter) body.filter = options.filter;
    if (options.deleteAll) body.delete_all = true;

    return this.request<DeleteResponse>('POST', `/v1/namespaces/${namespace}/delete`, body);
  }

  /**
   * Fetch vectors by ID.
   *
   * @param namespace - Target namespace
   * @param ids - Vector IDs to fetch
   * @param options - Fetch options
   * @returns Fetched vectors
   */
  async fetch(
    namespace: string,
    ids: string[],
    options: { includeValues?: boolean; includeMetadata?: boolean } = {}
  ): Promise<Vector[]> {
    const body = {
      ids,
      include_values: options.includeValues ?? true,
      include_metadata: options.includeMetadata ?? true,
    };

    const response = await this.request<{ vectors: Vector[] }>(
      'POST',
      `/v1/namespaces/${namespace}/fetch`,
      body
    );
    return response.vectors;
  }

  /**
   * Execute multiple queries in a single request.
   *
   * @param namespace - Target namespace
   * @param queries - Array of query specifications
   * @returns Array of search results
   *
   * @example
   * ```typescript
   * const results = await client.batchQuery('my-namespace', [
   *   { vector: [0.1, 0.2, 0.3], topK: 5 },
   *   { vector: [0.4, 0.5, 0.6], topK: 3 },
   * ]);
   * ```
   */
  async batchQuery(namespace: string, queries: BatchQuerySpec[]): Promise<SearchResult[]> {
    const body = {
      queries: queries.map((q) => {
        const query: Record<string, unknown> = {
          vector: q.vector,
          top_k: q.topK ?? 10,
          filter: q.filter,
          include_values: q.includeValues ?? false,
          include_metadata: q.includeMetadata ?? true,
        };

        if (q.distanceMetric) {
          query.distance_metric = q.distanceMetric;
        }
        if (q.consistency) {
          query.consistency = q.consistency;
        }
        if (q.stalenessConfig) {
          query.staleness_config = {
            max_staleness_ms: q.stalenessConfig.maxStalenessMs,
          };
        }

        return query;
      }),
    };

    const response = await this.request<{ results: SearchResult[] }>(
      'POST',
      `/v1/namespaces/${namespace}/batch-query`,
      body
    );
    return response.results;
  }

  // ===========================================================================
  // Full-Text Search Operations
  // ===========================================================================

  /**
   * Index documents for full-text search.
   *
   * @param namespace - Target namespace
   * @param documents - Documents to index
   * @returns Indexing response
   */
  async indexDocuments(
    namespace: string,
    documents: DocumentInput[]
  ): Promise<{ indexed_count: number }> {
    return this.request<{ indexed_count: number }>(
      'POST',
      `/v1/namespaces/${namespace}/fulltext/index`,
      { documents }
    );
  }

  /**
   * Perform full-text search.
   *
   * @param namespace - Target namespace
   * @param query - Search query string
   * @param options - Search options
   * @returns Search results
   */
  async fulltextSearch(
    namespace: string,
    query: string,
    options: { topK?: number; filter?: FilterExpression } = {}
  ): Promise<FullTextSearchResult[]> {
    const body = {
      query,
      top_k: options.topK ?? 10,
      filter: options.filter,
    };

    const response = await this.request<{ results: FullTextSearchResult[] }>(
      'POST',
      `/v1/namespaces/${namespace}/fulltext/search`,
      body
    );
    return response.results;
  }

  /**
   * Perform hybrid search combining vector and full-text.
   *
   * When `vector` is omitted the server falls back to BM25-only full-text
   * search. When provided, results are blended with vector similarity
   * according to `alpha`.
   *
   * @param namespace - Target namespace
   * @param query - Text query
   * @param options - Search options: vector (optional), topK, alpha, filter
   * @returns Hybrid search results
   *
   * @example
   * ```typescript
   * // Hybrid (vector + text)
   * const results = await client.hybridSearch('my-namespace', 'machine learning', {
   *   vector: [0.1, 0.2, 0.3],
   *   topK: 10,
   *   alpha: 0.7, // 70% text, 30% vector
   * });
   * // BM25-only (no vector)
   * const results = await client.hybridSearch('my-namespace', 'machine learning');
   * ```
   */
  async hybridSearch(
    namespace: string,
    query: string,
    options: { vector?: number[]; topK?: number; alpha?: number; filter?: FilterExpression } = {}
  ): Promise<HybridSearchResult[]> {
    const body: Record<string, unknown> = {
      query,
      top_k: options.topK ?? 10,
      alpha: options.alpha ?? 0.5,
    };
    if (options.vector != null) {
      body['vector'] = options.vector;
    }
    if (options.filter !== undefined) {
      body['filter'] = options.filter;
    }

    const response = await this.request<{ results: HybridSearchResult[] }>(
      'POST',
      `/v1/namespaces/${namespace}/hybrid`,
      body
    );
    return response.results;
  }

  // ===========================================================================
  // Namespace Operations
  // ===========================================================================

  /**
   * List all namespaces.
   *
   * @returns Array of namespace info
   */
  async listNamespaces(): Promise<NamespaceInfo[]> {
    const response = await this.request<{ namespaces: NamespaceInfo[] }>(
      'GET',
      '/v1/namespaces'
    );
    return response.namespaces;
  }

  /**
   * Get namespace information.
   *
   * @param namespace - Namespace name
   * @returns Namespace info
   */
  async getNamespace(namespace: string): Promise<NamespaceInfo> {
    return this.request<NamespaceInfo>('GET', `/v1/namespaces/${namespace}`);
  }

  /**
   * Create a new namespace.
   *
   * @param namespace - Namespace name
   * @param options - Creation options
   * @returns Created namespace info
   */
  async createNamespace(
    namespace: string,
    options: { dimensions?: number; indexType?: string; metadata?: Record<string, unknown> } = {}
  ): Promise<NamespaceInfo> {
    const body: Record<string, unknown> = { name: namespace };
    if (options.dimensions) body.dimensions = options.dimensions;
    if (options.indexType) body.index_type = options.indexType;
    if (options.metadata) body.metadata = options.metadata;

    return this.request<NamespaceInfo>('POST', '/v1/namespaces', body);
  }

  /**
   * Create or update a namespace configuration (upsert semantics).
   *
   * Creates the namespace if it does not exist, or updates its configuration
   * if it already exists.  Requires Write scope.
   *
   * @param namespace - Namespace name
   * @param request - dimension and optional distance metric
   * @returns ConfigureNamespaceResponse with ``created: true`` if newly created
   */
  async configureNamespace(
    namespace: string,
    request: ConfigureNamespaceRequest
  ): Promise<ConfigureNamespaceResponse> {
    return this.request<ConfigureNamespaceResponse>('PUT', `/v1/namespaces/${namespace}`, request);
  }

  /**
   * Delete a namespace.
   *
   * @param namespace - Namespace name
   */
  async deleteNamespace(namespace: string): Promise<void> {
    await this.request<void>('DELETE', `/v1/namespaces/${namespace}`);
  }

  // ===========================================================================
  // Admin Operations
  // ===========================================================================

  /**
   * Check server health.
   *
   * @returns Health status
   */
  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>('GET', '/health');
  }

  /**
   * Get index statistics for a namespace.
   *
   * @param namespace - Namespace name
   * @returns Index statistics
   */
  async getIndexStats(namespace: string): Promise<IndexStats> {
    return this.request<IndexStats>('GET', `/v1/namespaces/${namespace}/stats`);
  }

  /**
   * Trigger compaction for a namespace.
   *
   * @param namespace - Namespace name
   * @returns Compaction status
   */
  async compact(namespace: string): Promise<{ status: string }> {
    return this.request<{ status: string }>('POST', `/v1/namespaces/${namespace}/compact`);
  }

  /**
   * Flush pending writes for a namespace.
   *
   * @param namespace - Namespace name
   * @returns Flush status
   */
  async flush(namespace: string): Promise<{ status: string }> {
    return this.request<{ status: string }>('POST', `/v1/namespaces/${namespace}/flush`);
  }

  // ===========================================================================
  // Cache Warming Operations
  // ===========================================================================

  /**
   * Warm cache for vectors in a namespace.
   *
   * @param namespace - Target namespace
   * @param options - Cache warming options
   * @returns Cache warming response
   *
   * @example
   * ```typescript
   * const response = await client.warmCache('my-namespace', {
   *   priority: 'high',
   *   targetTier: 'both',
   *   background: true,
   * });
   * console.log(`Warmed ${response.entriesWarmed} entries`);
   * ```
   */
  async warmCache(
    namespace: string,
    options: {
      vectorIds?: string[];
      priority?: WarmingPriority;
      targetTier?: WarmingTargetTier;
      background?: boolean;
      ttlHintSeconds?: number;
      accessPattern?: AccessPatternHint;
      maxVectors?: number;
    } = {}
  ): Promise<WarmCacheResponse> {
    const body: Record<string, unknown> = {
      namespace,
      priority: options.priority ?? 'normal',
      target_tier: options.targetTier ?? 'l2',
      background: options.background ?? false,
      access_pattern: options.accessPattern ?? 'random',
    };

    if (options.vectorIds) {
      body.vector_ids = options.vectorIds;
    }
    if (options.ttlHintSeconds !== undefined) {
      body.ttl_hint_seconds = options.ttlHintSeconds;
    }
    if (options.maxVectors !== undefined) {
      body.max_vectors = options.maxVectors;
    }

    return this.request<WarmCacheResponse>(
      'POST',
      `/v1/namespaces/${namespace}/cache/warm`,
      body
    );
  }

  // ===========================================================================
  // Advanced Search Operations
  // ===========================================================================

  /**
   * Multi-vector search with positive and negative vectors.
   *
   * Searches using multiple vectors with optional weighting and MMR diversity.
   *
   * @param namespace - Target namespace
   * @param options - Multi-vector search options
   * @returns Multi-vector search response
   *
   * @example
   * ```typescript
   * const response = await client.multiVectorSearch('my-namespace', {
   *   positiveVectors: [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]],
   *   negativeVectors: [[0.9, 0.8, 0.7]],
   *   topK: 10,
   *   enableMmr: true,
   * });
   * ```
   */
  async multiVectorSearch(
    namespace: string,
    options: {
      positiveVectors: number[][];
      positiveWeights?: number[];
      negativeVectors?: number[][];
      negativeWeights?: number[];
      topK?: number;
      distanceMetric?: string;
      scoreThreshold?: number;
      enableMmr?: boolean;
      mmrLambda?: number;
    }
  ): Promise<MultiVectorSearchResponse> {
    const body: Record<string, unknown> = {
      positive_vectors: options.positiveVectors,
      top_k: options.topK ?? 10,
    };

    if (options.positiveWeights) {
      body.positive_weights = options.positiveWeights;
    }
    if (options.negativeVectors) {
      body.negative_vectors = options.negativeVectors;
    }
    if (options.negativeWeights) {
      body.negative_weights = options.negativeWeights;
    }
    if (options.distanceMetric) {
      body.distance_metric = options.distanceMetric;
    }
    if (options.scoreThreshold !== undefined) {
      body.score_threshold = options.scoreThreshold;
    }
    if (options.enableMmr !== undefined) {
      body.enable_mmr = options.enableMmr;
    }
    if (options.mmrLambda !== undefined) {
      body.mmr_lambda = options.mmrLambda;
    }

    return this.request<MultiVectorSearchResponse>(
      'POST',
      `/v1/namespaces/${namespace}/multi-vector`,
      body
    );
  }

  /**
   * Unified query combining vector and text search with flexible ranking.
   *
   * @param namespace - Target namespace
   * @param options - Unified query options
   * @returns Unified query response
   *
   * @example
   * ```typescript
   * const response = await client.unifiedQuery('my-namespace', {
   *   rankBy: { vector: [0.1, 0.2, 0.3] },
   *   topK: 10,
   *   includeMetadata: true,
   * });
   * ```
   */
  async unifiedQuery(
    namespace: string,
    options: {
      rankBy: unknown;
      topK?: number;
      filter?: Record<string, unknown>;
      includeMetadata?: boolean;
      includeVectors?: boolean;
      distanceMetric?: string;
    }
  ): Promise<UnifiedQueryResponse> {
    const body: Record<string, unknown> = {
      rank_by: options.rankBy,
      top_k: options.topK ?? 10,
      include_metadata: options.includeMetadata ?? true,
      include_vectors: options.includeVectors ?? false,
    };

    if (options.filter) {
      body.filter = options.filter;
    }
    if (options.distanceMetric) {
      body.distance_metric = options.distanceMetric;
    }

    return this.request<UnifiedQueryResponse>(
      'POST',
      `/v1/namespaces/${namespace}/unified-query`,
      body
    );
  }

  /**
   * Aggregate data with grouping and filtering.
   *
   * @param namespace - Target namespace
   * @param options - Aggregation options
   * @returns Aggregation response
   *
   * @example
   * ```typescript
   * const response = await client.aggregate('my-namespace', {
   *   aggregateBy: { count: 'Count', avg_score: ['Avg', 'score'] },
   *   groupBy: ['category'],
   * });
   * ```
   */
  async aggregate(
    namespace: string,
    options: {
      aggregateBy: Record<string, unknown>;
      groupBy?: string[];
      filter?: Record<string, unknown>;
      limit?: number;
    }
  ): Promise<AggregationResponse> {
    const body: Record<string, unknown> = {
      aggregate_by: options.aggregateBy,
    };

    if (options.groupBy) {
      body.group_by = options.groupBy;
    }
    if (options.filter) {
      body.filter = options.filter;
    }
    if (options.limit !== undefined) {
      body.limit = options.limit;
    }

    return this.request<AggregationResponse>(
      'POST',
      `/v1/namespaces/${namespace}/aggregate`,
      body
    );
  }

  /**
   * Export vectors from a namespace with pagination.
   *
   * @param namespace - Target namespace
   * @param options - Export options
   * @returns Export response with vectors and pagination cursor
   *
   * @example
   * ```typescript
   * let cursor: string | undefined;
   * do {
   *   const response = await client.exportVectors('my-namespace', {
   *     topK: 1000,
   *     cursor,
   *   });
   *   console.log(`Exported ${response.returned_count} vectors`);
   *   cursor = response.next_cursor ?? undefined;
   * } while (cursor);
   * ```
   */
  async exportVectors(
    namespace: string,
    options: {
      topK?: number;
      cursor?: string;
      includeVectors?: boolean;
      includeMetadata?: boolean;
    } = {}
  ): Promise<ExportResponse> {
    const body: Record<string, unknown> = {
      top_k: options.topK ?? 1000,
      include_vectors: options.includeVectors ?? true,
      include_metadata: options.includeMetadata ?? true,
    };

    if (options.cursor) {
      body.cursor = options.cursor;
    }

    return this.request<ExportResponse>(
      'POST',
      `/v1/namespaces/${namespace}/export`,
      body
    );
  }

  /**
   * Explain a query execution plan.
   *
   * @param namespace - Target namespace
   * @param options - Explain options
   * @returns Query explain response with execution plan
   *
   * @example
   * ```typescript
   * const plan = await client.explainQuery('my-namespace', {
   *   queryType: 'vector_search',
   *   vector: [0.1, 0.2, 0.3],
   *   topK: 10,
   *   execute: true,
   *   verbose: true,
   * });
   * console.log(plan.summary);
   * ```
   */
  async explainQuery(
    namespace: string,
    options: {
      queryType?: 'vector_search' | 'full_text_search' | 'hybrid_search';
      vector?: number[];
      topK?: number;
      filter?: Record<string, unknown>;
      textQuery?: string;
      distanceMetric?: string;
      execute?: boolean;
      verbose?: boolean;
    } = {}
  ): Promise<QueryExplainResponse> {
    const body: Record<string, unknown> = {
      top_k: options.topK ?? 10,
    };

    if (options.queryType) {
      body.query_type = options.queryType;
    }
    if (options.vector) {
      body.vector = options.vector;
    }
    if (options.filter) {
      body.filter = options.filter;
    }
    if (options.textQuery) {
      body.text_query = options.textQuery;
    }
    if (options.distanceMetric) {
      body.distance_metric = options.distanceMetric;
    }
    if (options.execute !== undefined) {
      body.execute = options.execute;
    }
    if (options.verbose !== undefined) {
      body.verbose = options.verbose;
    }

    return this.request<QueryExplainResponse>(
      'POST',
      `/v1/namespaces/${namespace}/explain`,
      body
    );
  }

  /**
   * Upsert vectors in column format.
   *
   * Instead of row-based [{id, values, metadata}], this accepts
   * columnar data: separate arrays for IDs, vectors, and attributes.
   *
   * @param namespace - Target namespace
   * @param options - Column upsert options
   * @returns Upsert response with count
   *
   * @example
   * ```typescript
   * await client.upsertColumns('my-namespace', {
   *   ids: ['vec1', 'vec2'],
   *   vectors: [[0.1, 0.2], [0.3, 0.4]],
   *   attributes: { category: ['a', 'b'], score: [0.9, 0.8] },
   * });
   * ```
   */
  async upsertColumns(
    namespace: string,
    options: {
      ids: string[];
      vectors: number[][];
      attributes?: Record<string, unknown[]>;
      ttlSeconds?: number;
      dimension?: number;
    }
  ): Promise<UpsertResponse> {
    const body: Record<string, unknown> = {
      ids: options.ids,
      vectors: options.vectors,
    };

    if (options.attributes) {
      body.attributes = options.attributes;
    }
    if (options.ttlSeconds !== undefined) {
      body.ttl_seconds = options.ttlSeconds;
    }
    if (options.dimension !== undefined) {
      body.dimension = options.dimension;
    }

    return this.request<UpsertResponse>(
      'POST',
      `/v1/namespaces/${namespace}/upsert-columns`,
      body
    );
  }

  // ===========================================================================
  // Text-Based Inference Operations (Auto-Embedding)
  // ===========================================================================

  /**
   * Upsert text documents with automatic embedding generation.
   *
   * The text is embedded using the specified model (default: MiniLM)
   * and stored as vectors. Original text is preserved in metadata.
   *
   * @param namespace - Target namespace
   * @param documents - Text documents to upsert
   * @param options - Upsert options including model selection
   * @returns Upsert response with token and timing info
   *
   * @example
   * ```typescript
   * const response = await client.upsertText('my-namespace', [
   *   { id: 'doc1', text: 'Machine learning is fascinating', metadata: { topic: 'ai' } },
   *   { id: 'doc2', text: 'Vector databases enable semantic search' },
   * ]);
   * console.log(`Upserted ${response.upserted_count} documents`);
   * console.log(`Processed ${response.tokens_processed} tokens in ${response.embedding_time_ms}ms`);
   * ```
   */
  async upsertText(
    namespace: string,
    documents: TextDocument[],
    options: TextUpsertOptions = {}
  ): Promise<TextUpsertResponse> {
    const body: Record<string, unknown> = {
      documents: documents.map((doc) => ({
        id: doc.id,
        text: doc.text,
        metadata: doc.metadata,
        ttl_seconds: doc.ttlSeconds,
      })),
    };

    if (options.model) {
      body.model = options.model;
    }

    return this.request<TextUpsertResponse>(
      'POST',
      `/v1/namespaces/${namespace}/upsert-text`,
      body
    );
  }

  /**
   * Query using natural language text with automatic embedding.
   *
   * The query text is embedded and used for similarity search.
   * Results can include the original text stored during upsert.
   *
   * @param namespace - Target namespace
   * @param text - Query text (will be embedded automatically)
   * @param options - Query options
   * @returns Text query response with results and timing info
   *
   * @example
   * ```typescript
   * const response = await client.queryText('my-namespace', 'What is semantic search?', {
   *   topK: 5,
   *   includeText: true,
   *   filter: { topic: { $eq: 'ai' } },
   * });
   *
   * for (const result of response.results) {
   *   console.log(`${result.id}: ${result.score}`);
   *   console.log(`  Text: ${result.text}`);
   * }
   * ```
   */
  async queryText(
    namespace: string,
    text: string,
    options: TextQueryOptions = {}
  ): Promise<TextQueryResponse> {
    const body: Record<string, unknown> = {
      text,
      top_k: options.topK ?? 10,
      include_text: options.includeText ?? true,
      include_vectors: options.includeVectors ?? false,
    };

    if (options.filter) {
      body.filter = options.filter;
    }
    if (options.model) {
      body.model = options.model;
    }

    return this.request<TextQueryResponse>(
      'POST',
      `/v1/namespaces/${namespace}/query-text`,
      body
    );
  }

  /**
   * Execute multiple text queries in a single request.
   *
   * All queries are embedded in a single batch for efficiency.
   * Useful for processing multiple search queries simultaneously.
   *
   * @param namespace - Target namespace
   * @param queries - Array of query texts
   * @param options - Batch query options
   * @returns Batch response with results for each query
   *
   * @example
   * ```typescript
   * const response = await client.batchQueryText('my-namespace', [
   *   'What is machine learning?',
   *   'How do vector databases work?',
   *   'Explain semantic search',
   * ], { topK: 3 });
   *
   * response.results.forEach((queryResults, i) => {
   *   console.log(`Query ${i + 1} results:`);
   *   queryResults.forEach((r) => console.log(`  ${r.id}: ${r.score}`));
   * });
   * ```
   */
  async batchQueryText(
    namespace: string,
    queries: string[],
    options: BatchTextQueryOptions = {}
  ): Promise<BatchTextQueryResponse> {
    const body: Record<string, unknown> = {
      queries,
      top_k: options.topK ?? 10,
      include_vectors: options.includeVectors ?? false,
    };

    if (options.filter) {
      body.filter = options.filter;
    }
    if (options.model) {
      body.model = options.model;
    }

    return this.request<BatchTextQueryResponse>(
      'POST',
      `/v1/namespaces/${namespace}/batch-query-text`,
      body
    );
  }

  // ===========================================================================
  // Memory Operations
  // ===========================================================================

  /** Store a memory for an agent */
  async storeMemory(agentId: string, request: StoreMemoryRequest): Promise<StoreMemoryResponse> {
    return this.request<StoreMemoryResponse>('POST', `/v1/agents/${agentId}/memories`, request);
  }

  /** Recall memories for an agent */
  async recall(agentId: string, query: string, options?: { top_k?: number; memory_type?: string; min_importance?: number }): Promise<RecalledMemory[]> {
    const body = { query, ...options };
    const result = await this.request<{ memories: RecalledMemory[] }>('POST', `/v1/agents/${agentId}/memories/recall`, body);
    return result.memories ?? result as any;
  }

  /** Get a specific memory */
  async getMemory(agentId: string, memoryId: string): Promise<Memory> {
    return this.request<Memory>('GET', `/v1/agents/${agentId}/memories/${memoryId}`);
  }

  /** Update an existing memory */
  async updateMemory(agentId: string, memoryId: string, request: UpdateMemoryRequest): Promise<StoreMemoryResponse> {
    return this.request<StoreMemoryResponse>('PUT', `/v1/agents/${agentId}/memories/${memoryId}`, request);
  }

  /** Delete a memory */
  async forget(agentId: string, memoryId: string): Promise<{ status: string }> {
    return this.request<{ status: string }>('DELETE', `/v1/agents/${agentId}/memories/${memoryId}`);
  }

  /**
   * Bulk-recall memories using filter predicates (CE-2).
   *
   * Uses `POST /v1/memories/recall/batch` — no embedding required.
   *
   * @example
   * ```typescript
   * const resp = await client.batchRecall({
   *   agent_id: 'agent-1',
   *   filter: { tags: ['preferences'], min_importance: 0.7 },
   *   limit: 50,
   * });
   * console.log(`Found ${resp.filtered} memories`);
   * ```
   */
  async batchRecall(request: BatchRecallRequest): Promise<BatchRecallResponse> {
    return this.request<BatchRecallResponse>('POST', '/v1/memories/recall/batch', request);
  }

  /**
   * Bulk-delete memories using filter predicates (CE-2).
   *
   * Uses `DELETE /v1/memories/forget/batch`.  At least one filter predicate
   * must be set (server safety guard).
   *
   * @example
   * ```typescript
   * const resp = await client.batchForget({
   *   agent_id: 'agent-1',
   *   filter: { created_before: Math.floor(Date.now() / 1000) - 86400 },
   * });
   * console.log(`Deleted ${resp.deleted_count} memories`);
   * ```
   */
  async batchForget(request: BatchForgetRequest): Promise<BatchForgetResponse> {
    return this.request<BatchForgetResponse>('DELETE', '/v1/memories/forget/batch', request);
  }

  /** Search memories for an agent */
  async searchMemories(agentId: string, query: string, options?: { top_k?: number; memory_type?: string; min_importance?: number }): Promise<RecalledMemory[]> {
    const body = { query, ...options };
    const result = await this.request<{ memories: RecalledMemory[] }>('POST', `/v1/agents/${agentId}/memories/search`, body);
    return result.memories ?? result as any;
  }

  /** Update importance of memories */
  async updateImportance(agentId: string, request: UpdateImportanceRequest): Promise<{ status: string }> {
    return this.request<{ status: string }>('PUT', `/v1/agents/${agentId}/memories/importance`, request);
  }

  /** Consolidate memories for an agent */
  async consolidate(agentId: string, request?: ConsolidateRequest): Promise<ConsolidateResponse> {
    return this.request<ConsolidateResponse>('POST', `/v1/agents/${agentId}/memories/consolidate`, request ?? {});
  }

  /** Submit feedback on a memory recall */
  async memoryFeedback(agentId: string, request: MemoryFeedbackRequest): Promise<MemoryFeedbackResponse> {
    return this.request<MemoryFeedbackResponse>('POST', `/v1/agents/${agentId}/memories/feedback`, request);
  }

  // ===========================================================================
  // Session Operations
  // ===========================================================================

  /** Start a new session */
  async startSession(agentId: string, metadata?: Record<string, unknown>): Promise<Session> {
    return this.request<Session>('POST', '/v1/sessions/start', { agent_id: agentId, metadata });
  }

  /** End a session */
  async endSession(sessionId: string): Promise<{ status: string }> {
    return this.request<{ status: string }>('POST', `/v1/sessions/${sessionId}/end`);
  }

  /** Get session details */
  async getSession(sessionId: string): Promise<Session> {
    return this.request<Session>('GET', `/v1/sessions/${sessionId}`);
  }

  /** List sessions */
  async listSessions(options?: ListSessionsOptions): Promise<Session[]> {
    const params = new URLSearchParams();
    if (options?.agent_id) params.set('agent_id', options.agent_id);
    if (options?.active_only !== undefined) params.set('active_only', String(options.active_only));
    if (options?.limit !== undefined) params.set('limit', String(options.limit));
    if (options?.offset !== undefined) params.set('offset', String(options.offset));
    const qs = params.toString();
    return this.request<Session[]>('GET', `/v1/sessions${qs ? `?${qs}` : ''}`);
  }

  /** Get memories for a session */
  async sessionMemories(sessionId: string): Promise<RecalledMemory[]> {
    return this.request<RecalledMemory[]>('GET', `/v1/sessions/${sessionId}/memories`);
  }

  // ===========================================================================
  // Agent Operations
  // ===========================================================================

  /** List all agents */
  async listAgents(): Promise<AgentSummary[]> {
    return this.request<AgentSummary[]>('GET', '/v1/agents');
  }

  /** Get memories for an agent */
  async agentMemories(agentId: string, options?: { memory_type?: string; limit?: number }): Promise<RecalledMemory[]> {
    const params = new URLSearchParams();
    if (options?.memory_type) params.set('memory_type', options.memory_type);
    if (options?.limit !== undefined) params.set('limit', String(options.limit));
    const qs = params.toString();
    return this.request<RecalledMemory[]>('GET', `/v1/agents/${agentId}/memories${qs ? `?${qs}` : ''}`);
  }

  /** Get stats for an agent */
  async agentStats(agentId: string): Promise<AgentStats> {
    return this.request<AgentStats>('GET', `/v1/agents/${agentId}/stats`);
  }

  /** Get sessions for an agent */
  async agentSessions(agentId: string, options?: { active_only?: boolean; limit?: number }): Promise<Session[]> {
    const params = new URLSearchParams();
    if (options?.active_only !== undefined) params.set('active_only', String(options.active_only));
    if (options?.limit !== undefined) params.set('limit', String(options.limit));
    const qs = params.toString();
    return this.request<Session[]>('GET', `/v1/agents/${agentId}/sessions${qs ? `?${qs}` : ''}`);
  }

  // ===========================================================================
  // Knowledge Graph Operations
  // ===========================================================================

  /** Build a knowledge graph from a seed memory */
  async knowledgeGraph(request: KnowledgeGraphRequest): Promise<KnowledgeGraphResponse> {
    return this.request<KnowledgeGraphResponse>('POST', '/v1/knowledge/graph', request);
  }

  /** Build a full knowledge graph for an agent */
  async fullKnowledgeGraph(request: FullKnowledgeGraphRequest): Promise<KnowledgeGraphResponse> {
    return this.request<KnowledgeGraphResponse>('POST', '/v1/knowledge/graph/full', request);
  }

  /** Summarize memories */
  async summarize(request: SummarizeRequest): Promise<SummarizeResponse> {
    return this.request<SummarizeResponse>('POST', '/v1/knowledge/summarize', request);
  }

  /** Deduplicate memories */
  async deduplicate(request: DeduplicateRequest): Promise<DeduplicateResponse> {
    return this.request<DeduplicateResponse>('POST', '/v1/knowledge/deduplicate', request);
  }

  /**
   * Build a cross-agent memory network graph (DASH-A).
   *
   * Calls `POST /v1/knowledge/network/cross-agent` and returns a graph
   * containing every agent's nodes and the cross-agent similarity edges that
   * connect them.
   *
   * Requires an Admin-scoped API key.
   *
   * @example
   * ```ts
   * const network = await client.crossAgentNetwork({ min_similarity: 0.5 });
   * console.log(`${network.stats.total_cross_edges} cross-agent edges`);
   * ```
   */
  async crossAgentNetwork(req?: CrossAgentNetworkRequest): Promise<CrossAgentNetworkResponse> {
    return this.request<CrossAgentNetworkResponse>(
      'POST',
      '/v1/knowledge/network/cross-agent',
      req ?? {},
    );
  }

  // ===========================================================================
  // Analytics Operations
  // ===========================================================================

  /** Get analytics overview */
  async analyticsOverview(options?: AnalyticsOptions): Promise<AnalyticsOverview> {
    const params = new URLSearchParams();
    if (options?.period) params.set('period', options.period);
    if (options?.namespace) params.set('namespace', options.namespace);
    const qs = params.toString();
    return this.request<AnalyticsOverview>('GET', `/v1/analytics/overview${qs ? `?${qs}` : ''}`);
  }

  /** Get latency analytics */
  async analyticsLatency(options?: AnalyticsOptions): Promise<LatencyAnalytics> {
    const params = new URLSearchParams();
    if (options?.period) params.set('period', options.period);
    if (options?.namespace) params.set('namespace', options.namespace);
    const qs = params.toString();
    return this.request<LatencyAnalytics>('GET', `/v1/analytics/latency${qs ? `?${qs}` : ''}`);
  }

  /** Get throughput analytics */
  async analyticsThroughput(options?: AnalyticsOptions): Promise<ThroughputAnalytics> {
    const params = new URLSearchParams();
    if (options?.period) params.set('period', options.period);
    if (options?.namespace) params.set('namespace', options.namespace);
    const qs = params.toString();
    return this.request<ThroughputAnalytics>('GET', `/v1/analytics/throughput${qs ? `?${qs}` : ''}`);
  }

  /** Get storage analytics */
  async analyticsStorage(namespace?: string): Promise<StorageAnalytics> {
    const params = new URLSearchParams();
    if (namespace) params.set('namespace', namespace);
    const qs = params.toString();
    return this.request<StorageAnalytics>('GET', `/v1/analytics/storage${qs ? `?${qs}` : ''}`);
  }

  // ===========================================================================
  // Admin Operations (Extended)
  // ===========================================================================

  /** Get server stats (version, total_vectors, namespace_count, uptime_seconds, timestamp).
   *  Requires Read scope — works with read-only API keys, unlike clusterStatus. */
  async opsStats(): Promise<OpsStats> {
    return this.request<OpsStats>('GET', '/v1/ops/stats');
  }

  /** Get cluster status */
  async clusterStatus(): Promise<ClusterStatus> {
    return this.request<ClusterStatus>('GET', '/v1/admin/cluster/status');
  }

  /** Get cluster nodes */
  async clusterNodes(): Promise<ClusterNode[]> {
    return this.request<ClusterNode[]>('GET', '/v1/admin/cluster/nodes');
  }

  /** Optimize a namespace */
  async optimizeNamespace(namespace: string): Promise<{ status: string }> {
    return this.request<{ status: string }>('POST', `/v1/admin/namespaces/${namespace}/optimize`);
  }

  /** Get index stats for a namespace */
  async adminIndexStats(namespace: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('GET', `/v1/admin/namespaces/${namespace}/index/stats`);
  }

  /** Rebuild indexes for a namespace */
  async rebuildIndexes(namespace: string): Promise<{ status: string }> {
    return this.request<{ status: string }>('POST', `/v1/admin/namespaces/${namespace}/index/rebuild`);
  }

  /** Get cache statistics */
  async cacheStats(): Promise<CacheStats> {
    return this.request<CacheStats>('GET', '/v1/admin/cache/stats');
  }

  /** Clear cache, optionally for a specific namespace */
  async cacheClear(namespace?: string): Promise<{ status: string }> {
    const body = namespace ? { namespace } : undefined;
    return this.request<{ status: string }>('POST', '/v1/admin/cache/clear', body);
  }

  /** Get server configuration */
  async getConfig(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('GET', '/v1/admin/config');
  }

  /** Update server configuration */
  async updateConfig(config: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('PUT', '/v1/admin/config', config);
  }

  /** Get quota settings */
  async getQuotas(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('GET', '/v1/admin/quotas');
  }

  /** Update quota settings */
  async updateQuotas(quotas: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('PUT', '/v1/admin/quotas', quotas);
  }

  /** Get slow queries */
  async slowQueries(options?: { limit?: number; minDurationMs?: number }): Promise<SlowQuery[]> {
    const params = new URLSearchParams();
    if (options?.limit !== undefined) params.set('limit', String(options.limit));
    if (options?.minDurationMs !== undefined) params.set('min_duration_ms', String(options.minDurationMs));
    const qs = params.toString();
    return this.request<SlowQuery[]>('GET', `/v1/admin/slow-queries${qs ? `?${qs}` : ''}`);
  }

  /** Create a backup */
  async createBackup(includeData: boolean = true): Promise<BackupInfo> {
    return this.request<BackupInfo>('POST', '/v1/admin/backups', { include_data: includeData });
  }

  /** List all backups */
  async listBackups(): Promise<BackupInfo[]> {
    return this.request<BackupInfo[]>('GET', '/v1/admin/backups');
  }

  /** Restore a backup */
  async restoreBackup(backupId: string): Promise<{ status: string }> {
    return this.request<{ status: string }>('POST', `/v1/admin/backups/${backupId}/restore`);
  }

  /** Delete a backup */
  async deleteBackup(backupId: string): Promise<{ status: string }> {
    return this.request<{ status: string }>('DELETE', `/v1/admin/backups/${backupId}`);
  }

  /** Configure TTL for a namespace */
  async configureTtl(namespace: string, ttlSeconds: number, strategy?: string): Promise<TtlConfig> {
    const body: Record<string, unknown> = { ttl_seconds: ttlSeconds };
    if (strategy) body.strategy = strategy;
    return this.request<TtlConfig>('POST', `/v1/admin/namespaces/${namespace}/ttl`, body);
  }

  /** Get AutoPilot status: current config and last-run statistics (PILOT-1) */
  async autopilotStatus(): Promise<AutoPilotStatusResponse> {
    return this.request<AutoPilotStatusResponse>('GET', '/v1/admin/autopilot/status');
  }

  /** Update AutoPilot configuration at runtime (PILOT-2) */
  async autopilotUpdateConfig(request: AutoPilotConfigRequest): Promise<AutoPilotConfigResponse> {
    return this.request<AutoPilotConfigResponse>('PUT', '/v1/admin/autopilot/config', request);
  }

  /** Manually trigger an AutoPilot dedup or consolidation cycle (PILOT-3) */
  async autopilotTrigger(action: AutoPilotTriggerAction): Promise<AutoPilotTriggerResponse> {
    return this.request<AutoPilotTriggerResponse>('POST', '/v1/admin/autopilot/trigger', { action });
  }

  /** Get current decay engine configuration (DECAY-1). Requires Admin scope. */
  async decayConfig(): Promise<DecayConfigResponse> {
    return this.request<DecayConfigResponse>('GET', '/v1/admin/decay/config');
  }

  /**
   * Update decay engine configuration at runtime (DECAY-1). Requires Admin scope.
   * Changes take effect on the next decay cycle — no restart required.
   * All fields are optional; omit any to keep its current value.
   */
  async decayUpdateConfig(request: DecayConfigUpdateRequest): Promise<DecayConfigUpdateResponse> {
    return this.request<DecayConfigUpdateResponse>('PUT', '/v1/admin/decay/config', request);
  }

  /** Get decay activity counters and last-cycle snapshot (DECAY-2). Requires Admin scope. */
  async decayStats(): Promise<DecayStatsResponse> {
    return this.request<DecayStatsResponse>('GET', '/v1/admin/decay/stats');
  }

  // ===========================================================================
  // API Key Operations
  // ===========================================================================

  /** Create a new API key */
  async createKey(request: CreateKeyRequest): Promise<ApiKey> {
    return this.request<ApiKey>('POST', '/v1/keys', request);
  }

  /** List all API keys */
  async listKeys(): Promise<ApiKey[]> {
    return this.request<ApiKey[]>('GET', '/v1/keys');
  }

  /** Get an API key by ID */
  async getKey(keyId: string): Promise<ApiKey> {
    return this.request<ApiKey>('GET', `/v1/keys/${keyId}`);
  }

  /** Delete an API key */
  async deleteKey(keyId: string): Promise<{ status: string }> {
    return this.request<{ status: string }>('DELETE', `/v1/keys/${keyId}`);
  }

  /** Deactivate an API key */
  async deactivateKey(keyId: string): Promise<ApiKey> {
    return this.request<ApiKey>('POST', `/v1/keys/${keyId}/deactivate`);
  }

  /** Rotate an API key */
  async rotateKey(keyId: string): Promise<ApiKey> {
    return this.request<ApiKey>('POST', `/v1/keys/${keyId}/rotate`);
  }

  /** Get usage statistics for an API key */
  async keyUsage(keyId: string): Promise<KeyUsage> {
    return this.request<KeyUsage>('GET', `/v1/keys/${keyId}/usage`);
  }

  // ===========================================================================
  // SSE Streaming (CE-1)
  // ===========================================================================

  /**
   * Stream SSE events scoped to a namespace.
   *
   * Opens a long-lived connection to `GET /v1/namespaces/{namespace}/events`
   * and yields {@link DakeraEvent} objects as they arrive.  The async
   * generator runs until the connection closes or the caller breaks the loop.
   *
   * Requires a Read-scoped API key.
   *
   * @example
   * ```ts
   * for await (const event of client.streamNamespaceEvents('my-ns')) {
   *   if (event.type === 'vectors_mutated') {
   *     console.log(`${event.count} vectors ${event.op} in ${event.namespace}`);
   *   }
   * }
   * ```
   */
  async *streamNamespaceEvents(namespace: string): AsyncGenerator<DakeraEvent> {
    const url = `${this.baseUrl}/v1/namespaces/${encodeURIComponent(namespace)}/events`;
    yield* this._streamSse(url);
  }

  /**
   * Stream all system events from the global event bus.
   *
   * Opens a long-lived connection to `GET /ops/events` and yields
   * {@link DakeraEvent} objects as they arrive.
   *
   * Requires an Admin-scoped API key.
   *
   * @example
   * ```ts
   * for await (const event of client.streamGlobalEvents()) {
   *   console.log(event.type, event);
   * }
   * ```
   */
  async *streamGlobalEvents(): AsyncGenerator<DakeraEvent> {
    const url = `${this.baseUrl}/ops/events`;
    yield* this._streamSse(url);
  }

  /**
   * Stream memory lifecycle events for all agents (DASH-B).
   *
   * Opens a long-lived connection to `GET /v1/events/stream` and yields
   * {@link MemoryEvent} objects as they arrive.  Each SSE frame uses the
   * `event:` field for the event_type and a JSON `data:` payload.
   *
   * Requires a Read-scoped API key.
   *
   * @example
   * ```ts
   * for await (const ev of client.streamMemoryEvents()) {
   *   if (ev.event_type === 'stored') {
   *     console.log(`Memory stored for agent ${ev.agent_id}: ${ev.content}`);
   *   }
   * }
   * ```
   */
  async *streamMemoryEvents(): AsyncGenerator<MemoryEvent> {
    const url = `${this.baseUrl}/v1/events/stream`;
    yield* this._streamSseMemory(url);
  }

  /**
   * Return a URL with `?api_key=<key>` appended for use with browser-native
   * `EventSource`, which cannot send custom request headers.
   *
   * @example
   * ```ts
   * const src = new EventSource(client.sseUrl('/v1/namespaces/my-ns/events'));
   * ```
   */
  sseUrl(path: string): string {
    const base = `${this.baseUrl}${path}`;
    if (!this.apiKey) return base;
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}api_key=${encodeURIComponent(this.apiKey)}`;
  }

  /** Low-level SSE streaming helper — parses the SSE wire format. */
  private async *_streamSse(url: string): AsyncGenerator<DakeraEvent> {
    // Append ?api_key= so the URL is compatible with browser-native EventSource
    // (which cannot send custom headers). fetch() also accepts the header form,
    // but the query-param form works for both transports.
    const sseUrl = this.apiKey
      ? `${url}${url.includes('?') ? '&' : '?'}api_key=${encodeURIComponent(this.apiKey)}`
      : url;
    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
      'Cache-Control': 'no-cache',
    };

    const response = await fetch(sseUrl, { headers });
    if (!response.ok || !response.body) {
      throw new Error(`SSE connection failed: ${response.status} ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE events are separated by a blank line (\n\n)
        let boundary: number;
        while ((boundary = buffer.indexOf('\n\n')) !== -1) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const event = this._parseSseBlock(block);
          if (event !== null) yield event;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /** Parse a single SSE event block into a {@link DakeraEvent}. */
  private _parseSseBlock(block: string): DakeraEvent | null {
    const dataLines: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith(':')) continue; // SSE comment / heartbeat
      if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    }
    if (dataLines.length === 0) return null;
    try {
      return JSON.parse(dataLines.join('\n')) as DakeraEvent;
    } catch {
      return null;
    }
  }

  /**
   * Low-level SSE streaming helper for the memory event stream.
   *
   * The memory event stream sets the SSE `event:` field to the event_type
   * and the `data:` field to the JSON payload.  This helper merges the two
   * so callers receive a fully-populated {@link MemoryEvent}.
   */
  private async *_streamSseMemory(url: string): AsyncGenerator<MemoryEvent> {
    const sseUrl = this.apiKey
      ? `${url}${url.includes('?') ? '&' : '?'}api_key=${encodeURIComponent(this.apiKey)}`
      : url;
    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
      'Cache-Control': 'no-cache',
    };

    const response = await fetch(sseUrl, { headers });
    if (!response.ok || !response.body) {
      throw new Error(`SSE connection failed: ${response.status} ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let boundary: number;
        while ((boundary = buffer.indexOf('\n\n')) !== -1) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const event = this._parseSseMemoryBlock(block);
          if (event !== null) yield event;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /** Parse a single SSE event block into a {@link MemoryEvent}. */
  private _parseSseMemoryBlock(block: string): MemoryEvent | null {
    let eventType: string | undefined;
    const dataLines: string[] = [];

    for (const line of block.split('\n')) {
      if (line.startsWith(':')) continue; // SSE comment / heartbeat
      if (line.startsWith('event:')) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart());
      }
    }

    if (dataLines.length === 0) return null;

    try {
      const raw = JSON.parse(dataLines.join('\n')) as Record<string, unknown>;
      // Build a MemoryEvent, normalising the connected handshake event which
      // uses {"type":"connected","timestamp":...} instead of the normal shape.
      const parsed = raw as unknown as MemoryEvent;
      // Ensure event_type is populated — prefer the SSE event: field when set.
      if (eventType && !parsed.event_type) {
        parsed.event_type = eventType;
      }
      // connected event uses "type" key; fall back to it if event_type still unset.
      if (!parsed.event_type && typeof raw['type'] === 'string') {
        parsed.event_type = raw['type'] as string;
      }
      // agent_id is absent on connected events — default to empty string.
      if (parsed.agent_id === undefined) {
        parsed.agent_id = '';
      }
      return parsed;
    } catch {
      return null;
    }
  }
}
