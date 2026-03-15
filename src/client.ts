/**
 * Dakera Client
 *
 * Main client class for interacting with Dakera server.
 */

import {
  AuthenticationError,
  ConnectionError,
  NotFoundError,
  RateLimitError,
  ServerError,
  TimeoutError,
  ValidationError,
  DakeraError,
} from './errors';
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
} from './types';

/** Default client options */
const DEFAULT_OPTIONS: Required<Omit<ClientOptions, 'apiKey' | 'headers'>> = {
  baseUrl: 'http://localhost:3000',
  timeout: 30000,
  maxRetries: 3,
};

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
  private readonly maxRetries: number;
  private readonly headers: Record<string, string>;

  constructor(options: ClientOptions | string) {
    if (typeof options === 'string') {
      options = { baseUrl: options };
    }

    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.timeout = options.timeout ?? DEFAULT_OPTIONS.timeout;
    this.maxRetries = options.maxRetries ?? DEFAULT_OPTIONS.maxRetries;

    this.headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.apiKey) {
      this.headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
  }

  /**
   * Make an HTTP request with retry logic.
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          method,
          headers: this.headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        return await this.handleResponse<T>(response);
      } catch (error) {
        if (error instanceof DakeraError) {
          // Don't retry client errors (4xx) except rate limits
          if (
            error.statusCode &&
            error.statusCode >= 400 &&
            error.statusCode < 500 &&
            !(error instanceof RateLimitError)
          ) {
            throw error;
          }
        }

        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            lastError = new TimeoutError(`Request timed out after ${this.timeout}ms`);
          } else if (error.message.includes('fetch')) {
            lastError = new ConnectionError(`Failed to connect to ${url}: ${error.message}`);
          } else {
            lastError = error;
          }
        }

        // Wait before retry (exponential backoff)
        if (attempt < this.maxRetries - 1) {
          await this.sleep(Math.pow(2, attempt) * 100);
        }
      }
    }

    throw lastError ?? new DakeraError('Request failed after retries');
  }

  /**
   * Handle HTTP response and throw appropriate errors.
   */
  private async handleResponse<T>(response: Response): Promise<T> {
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

    switch (response.status) {
      case 400:
        throw new ValidationError(errorMessage, response.status, body);
      case 401:
        throw new AuthenticationError('Authentication failed', response.status, body);
      case 404:
        throw new NotFoundError(errorMessage, response.status, body);
      case 429: {
        const retryAfter = response.headers.get('Retry-After');
        throw new RateLimitError(
          'Rate limit exceeded',
          response.status,
          body,
          retryAfter ? parseInt(retryAfter, 10) : undefined
        );
      }
      default:
        if (response.status >= 500) {
          throw new ServerError(errorMessage, response.status, body);
        }
        throw new DakeraError(errorMessage, response.status, body);
    }
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
   * @param namespace - Target namespace
   * @param vector - Query vector
   * @param query - Text query
   * @param options - Search options including alpha for balance
   * @returns Hybrid search results
   *
   * @example
   * ```typescript
   * const results = await client.hybridSearch('my-namespace', [0.1, 0.2, 0.3], 'machine learning', {
   *   topK: 10,
   *   alpha: 0.7, // 70% text, 30% vector
   * });
   * ```
   */
  async hybridSearch(
    namespace: string,
    vector: number[],
    query: string,
    options: { topK?: number; alpha?: number; filter?: FilterExpression } = {}
  ): Promise<HybridSearchResult[]> {
    const body = {
      vector,
      query,
      top_k: options.topK ?? 10,
      alpha: options.alpha ?? 0.5,
      filter: options.filter,
    };

    const response = await this.request<{ results: HybridSearchResult[] }>(
      'POST',
      `/v1/namespaces/${namespace}/fulltext/hybrid`,
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
}
