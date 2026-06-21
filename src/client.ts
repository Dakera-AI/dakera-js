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

/** Flatten server's nested recall item `{memory: {...}, score}` to flat `RecalledMemory`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function flattenRecalledMemory(item: any): any {
  if (item && typeof item === 'object' && item.memory && typeof item.memory === 'object') {
    return { ...item.memory, score: item.score, depth: item.depth };
  }
  return item;
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
  KgExportResponse,
  KgPathResponse,
  KgQueryResponse,
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
  RecallResponse,
  SearchResult,
  Session,
  SessionStartResponse,
  SessionEndResponse,
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
  WakeUpOptions,
  WakeUpResponse,
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
  BatchStoreMemoryRequest,
  BatchStoreMemoryResponse,
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
  KpiSnapshot,
  OpsStats,
  EdgeType,
  GraphExport,
  GraphLinkResponse,
  GraphPath,
  MemoryGraph,
  MemoryGraphOptions,
  NamespaceNerConfig,
  EntityExtractionResponse,
  MemoryEntitiesResponse,
  FeedbackSignal,
  FeedbackResponse,
  FeedbackHistoryResponse,
  AgentFeedbackSummary,
  FeedbackHealthResponse,
  TifScore,
  CreateNamespaceKeyResponse,
  ListNamespaceKeysResponse,
  NamespaceKeyUsageResponse,
  // DX-1
  MemoryImportResponse,
  MemoryExportResponse,
  // OBS-1
  AuditListResponse,
  AuditExportResponse,
  // EXT-1
  ExtractionResult,
  ExtractionProviderInfo,
  // CE-54
  FulltextReindexResponse,
  // SEC-3
  RotateEncryptionKeyRequest,
  RotateEncryptionKeyResponse,
  // ODE-2
  ExtractEntitiesRequest,
  ExtractEntitiesResponse,
  // COG-1
  MemoryPolicy,
  // CE-12
  CompressResponse,
  // Engine parity — Phase 1
  ReadinessResponse,
  LivenessResponse,
  BulkUpdateResponse,
  BulkDeleteResponse,
  CountVectorsResponse,
  AgentConsolidateResponse,
  AgentConsolidationLogEntry,
  ConsolidationConfigPatch,
  AgentConsolidationConfig,
  NamespaceEntityConfig,
  ExtractorConfig,
  // Engine parity — Phase 2
  ReplicationStatus,
  ShardListResponse,
  ShardRebalanceRequest,
  ShardRebalanceResponse,
  MaintenanceStatus,
  EnableMaintenanceRequest,
  DisableMaintenanceRequest,
  QuotaListResponse,
  DefaultQuotaResponse,
  SetDefaultQuotaRequest,
  QuotaStatus,
  SetQuotaRequest,
  SetQuotaResponse,
  QuotaCheckRequest,
  QuotaCheckResult,
  BackupListResponse,
  CreateBackupRequest,
  CreateBackupResponse,
  BackupSchedule,
  UpdateBackupScheduleRequest,
  RestoreBackupRequest,
  RestoreBackupResponse,
  SystemDiagnostics,
  JobInfo,
  CompactionRequest,
  CompactionResponse,
  // Engine parity — Phase 3
  FullTextIndexStats,
  FulltextDeleteResponse,
  TtlStatsResponse,
  RouteRequest,
  RouteResponse,
  ImportJobStatus,
  StorageTierOverview,
  MemoryTypeStatsResponse,
  MigrateNamespaceDimensionsRequest,
  MigrateDimensionsResponse,
  DrainReembedRequest,
  DrainReembedResponse,
  StaticCountResponse,
} from './types';
import { computeTifScore } from './types';

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
  /** ODE-2: base URL of the dakera-ode sidecar. */
  private readonly odeUrl?: string;
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
    this.odeUrl = options.odeUrl?.replace(/\/$/, '');

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

    return this.request<DeleteResponse>('POST', `/v1/namespaces/${namespace}/vectors/delete`, body);
  }

  /** Bulk update vector metadata matching a filter. */
  async bulkUpdateVectors(
    namespace: string,
    filter: Record<string, unknown>,
    update: Record<string, unknown>
  ): Promise<BulkUpdateResponse> {
    return this.request<BulkUpdateResponse>(
      'POST',
      `/v1/namespaces/${encodeURIComponent(namespace)}/vectors/bulk-update`,
      { filter, update }
    );
  }

  /** Bulk delete vectors matching a filter. */
  async bulkDeleteVectors(
    namespace: string,
    filter: Record<string, unknown>
  ): Promise<BulkDeleteResponse> {
    return this.request<BulkDeleteResponse>(
      'POST',
      `/v1/namespaces/${encodeURIComponent(namespace)}/vectors/bulk-delete`,
      { filter }
    );
  }

  /** Count vectors in a namespace, optionally filtered. */
  async countVectors(
    namespace: string,
    filter?: Record<string, unknown>
  ): Promise<CountVectorsResponse> {
    const body: Record<string, unknown> = {};
    if (filter) body.filter = filter;
    return this.request<CountVectorsResponse>(
      'POST',
      `/v1/namespaces/${encodeURIComponent(namespace)}/vectors/count`,
      body
    );
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
   * according to `vectorWeight`.
   *
   * @param namespace - Target namespace
   * @param query - Text query
   * @param options - Search options: vector (optional), topK, vectorWeight, filter
   * @returns Hybrid search results
   *
   * @example
   * ```typescript
   * // Hybrid (vector + text)
   * const results = await client.hybridSearch('my-namespace', 'machine learning', {
   *   vector: [0.1, 0.2, 0.3],
   *   topK: 10,
   *   vectorWeight: 0.7, // 70% vector, 30% text
   * });
   * // BM25-only (no vector)
   * const results = await client.hybridSearch('my-namespace', 'machine learning');
   * ```
   */
  async hybridSearch(
    namespace: string,
    query: string,
    options: { vector?: number[]; topK?: number; vectorWeight?: number; filter?: FilterExpression } = {}
  ): Promise<HybridSearchResult[]> {
    const body: Record<string, unknown> = {
      text: query,
      top_k: options.topK ?? 10,
      vector_weight: options.vectorWeight ?? 0.5,
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
    const response = await this.request<{ namespaces: string[] }>(
      'GET',
      '/v1/namespaces'
    );
    return response.namespaces.map((ns) => ({ namespace: ns, vector_count: 0 }));
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
    const body: Record<string, unknown> = {};
    if (options.dimensions) body.dimension = options.dimensions;
    if (options.indexType) body.index_type = options.indexType;
    if (options.metadata) body.metadata = options.metadata;

    const response = await this.request<ConfigureNamespaceResponse>(
      'PUT',
      `/v1/namespaces/${namespace}`,
      body
    );
    return { namespace: response.namespace, vector_count: 0, dimension: response.dimension };
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

  /** K8s readiness probe — checks storage and dependencies. */
  async healthReady(): Promise<ReadinessResponse> {
    return this.request<ReadinessResponse>('GET', '/health/ready');
  }

  /** K8s liveness probe — checks process is alive. */
  async healthLive(): Promise<LivenessResponse> {
    return this.request<LivenessResponse>('GET', '/health/live');
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
    return this.request<StoreMemoryResponse>('POST', '/v1/memory/store', { ...request, agent_id: agentId });
  }

  /**
   * Recall memories for an agent.
   *
   * @param agentId - Agent identifier
   * @param query - Semantic query text
   * @param options - Optional recall parameters
   * @param options.top_k - Number of primary results (default: 5)
   * @param options.memory_type - Filter by memory type
   * @param options.min_importance - Minimum importance threshold
   * @param options.include_associated - COG-2: traverse KG and include
   *   associatively linked memories in `associated_memories` (default: false)
   * @param options.associated_memories_cap - COG-2: max associated memories (default: 10, max: 10)
   * @param options.associated_memories_depth - KG-3: traversal depth 1–3 (default: 1); requires include_associated
   * @param options.associated_memories_min_weight - KG-3: minimum edge weight for KG traversal (default: 0.0)
   * @param options.since - CE-7: only recall memories created at or after this ISO-8601 timestamp
   * @param options.until - CE-7: only recall memories created at or before this ISO-8601 timestamp
   * @returns RecallResponse with `memories` and optionally `associated_memories` (each with `depth` field)
   */
  async recall(agentId: string, query: string, options?: { top_k?: number; memory_type?: string; min_importance?: number; include_associated?: boolean; associated_memories_cap?: number; associated_memories_depth?: number; associated_memories_min_weight?: number; since?: string; until?: string; routing?: import('./types').RoutingMode; rerank?: boolean }): Promise<RecallResponse> {
    const body: Record<string, unknown> = { query };
    if (options?.top_k !== undefined) body['top_k'] = options.top_k;
    if (options?.memory_type !== undefined) body['memory_type'] = options.memory_type;
    if (options?.min_importance !== undefined) body['min_importance'] = options.min_importance;
    if (options?.include_associated) body['include_associated'] = true;
    if (options?.associated_memories_cap !== undefined) body['associated_memories_cap'] = options.associated_memories_cap;
    if (options?.associated_memories_depth !== undefined) body['associated_memories_depth'] = options.associated_memories_depth;
    if (options?.associated_memories_min_weight !== undefined) body['associated_memories_min_weight'] = options.associated_memories_min_weight;
    if (options?.since !== undefined) body['since'] = options.since;
    if (options?.until !== undefined) body['until'] = options.until;
    if (options?.routing !== undefined) body['routing'] = options.routing;
    if (options?.rerank !== undefined) body['rerank'] = options.rerank;
    const raw = await this.request<{ memories: Array<unknown>; associated_memories?: Array<unknown> }>('POST', '/v1/memory/recall', { ...body, agent_id: agentId });
    return {
      memories: (raw.memories ?? []).map(flattenRecalledMemory),
      ...(raw.associated_memories ? { associated_memories: raw.associated_memories.map(flattenRecalledMemory) } : {}),
    };
  }

  /** Get a specific memory */
  async getMemory(agentId: string, memoryId: string): Promise<Memory> {
    return this.request<Memory>('GET', `/v1/memory/get/${memoryId}?agent_id=${encodeURIComponent(agentId)}`);
  }

  /** Update an existing memory */
  async updateMemory(_agentId: string, memoryId: string, request: UpdateMemoryRequest): Promise<StoreMemoryResponse> {
    return this.request<StoreMemoryResponse>('PUT', `/v1/memory/update/${memoryId}`, request);
  }

  /** Delete a memory */
  async forget(agentId: string, memoryId: string): Promise<{ status: string }> {
    return this.request<{ status: string }>('POST', '/v1/memory/forget', { agent_id: agentId, memory_ids: [memoryId] });
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

  /**
   * Store multiple memories in a single request (DAK-5508).
   *
   * Uses `POST /v1/memories/store/batch`. The server embeds all contents in a
   * single ONNX inference pass, yielding ≥100× throughput vs. N sequential
   * single-store calls. Accepts up to 1 000 memories per call.
   *
   * @example
   * ```ts
   * const resp = await client.storeMemoriesBatch({
   *   agent_id: 'agent-1',
   *   memories: [
   *     { content: 'The user prefers dark mode', importance: 0.8 },
   *     { content: 'The user is based in Berlin', importance: 0.7 },
   *   ],
   * });
   * console.log(`Stored ${resp.stored_count} memories`);
   * ```
   */
  async storeMemoriesBatch(request: BatchStoreMemoryRequest): Promise<BatchStoreMemoryResponse> {
    return this.request<BatchStoreMemoryResponse>('POST', '/v1/memories/store/batch', request);
  }

  /** Search memories for an agent */
  async searchMemories(agentId: string, query: string, options?: { top_k?: number; memory_type?: string; min_importance?: number; routing?: import('./types').RoutingMode; rerank?: boolean }): Promise<RecalledMemory[]> {
    const body: Record<string, unknown> = { query };
    if (options?.top_k !== undefined) body['top_k'] = options.top_k;
    if (options?.memory_type !== undefined) body['memory_type'] = options.memory_type;
    if (options?.min_importance !== undefined) body['min_importance'] = options.min_importance;
    if (options?.routing !== undefined) body['routing'] = options.routing;
    if (options?.rerank !== undefined) body['rerank'] = options.rerank;
    const result = await this.request<{ memories: Array<unknown> } | Array<unknown>>('POST', '/v1/memory/search', { ...body, agent_id: agentId });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- backward-compat: older servers return flat array
    const items: Array<unknown> = (result as any).memories ?? result;
    return (Array.isArray(items) ? items : []).map(flattenRecalledMemory);
  }

  /** Update importance of memories */
  async updateImportance(agentId: string, request: UpdateImportanceRequest): Promise<{ status: string }> {
    let result: { status: string } = { status: 'ok' };
    for (const memoryId of request.memory_ids) {
      result = await this.request<{ status: string }>('POST', '/v1/memory/importance', {
        agent_id: agentId,
        memory_id: memoryId,
        importance: request.importance,
      });
    }
    return result;
  }

  /** Consolidate memories for an agent */
  async consolidate(agentId: string, request?: ConsolidateRequest): Promise<ConsolidateResponse> {
    return this.request<ConsolidateResponse>('POST', '/v1/memory/consolidate', { ...(request ?? {}), agent_id: agentId });
  }

  /** Consolidate memories directly for an agent (DBSCAN clustering). */
  async consolidateAgent(agentId: string): Promise<AgentConsolidateResponse> {
    return this.request<AgentConsolidateResponse>('POST', `/v1/agents/${encodeURIComponent(agentId)}/consolidate`);
  }

  /** Get the consolidation execution log for an agent. */
  async getConsolidationLog(agentId: string): Promise<AgentConsolidationLogEntry[]> {
    return this.request<AgentConsolidationLogEntry[]>('GET', `/v1/agents/${encodeURIComponent(agentId)}/consolidation/log`);
  }

  /** Update the consolidation configuration for an agent. */
  async patchConsolidationConfig(
    agentId: string,
    config: ConsolidationConfigPatch
  ): Promise<AgentConsolidationConfig> {
    return this.request<AgentConsolidationConfig>(
      'PATCH',
      `/v1/agents/${encodeURIComponent(agentId)}/consolidation/config`,
      config as Record<string, unknown>
    );
  }

  /** Submit feedback on a memory recall */
  async memoryFeedback(agentId: string, request: MemoryFeedbackRequest): Promise<MemoryFeedbackResponse> {
    return this.request<MemoryFeedbackResponse>('POST', '/v1/memory/feedback', { ...request, agent_id: agentId });
  }

  // ===========================================================================
  // Memory Feedback Loop — INT-1
  // ===========================================================================

  /**
   * Submit upvote/downvote/flag feedback on a memory (INT-1).
   *
   * - `upvote`: boosts importance ×1.15 (capped at 1.0).
   * - `downvote`: penalises importance ×0.85 (floor 0.0).
   * - `flag`: marks as irrelevant — accelerates decay on next cycle.
   *
   * @param memoryId  The memory to give feedback on.
   * @param agentId   The agent that owns the memory.
   * @param signal    Feedback signal.
   */
  async feedbackMemory(memoryId: string, agentId: string, signal: FeedbackSignal): Promise<FeedbackResponse> {
    return this.request<FeedbackResponse>('POST', `/v1/memories/${memoryId}/feedback`, { agent_id: agentId, signal });
  }

  /**
   * Get the full feedback history for a memory (INT-1).
   *
   * @param memoryId  The memory whose feedback history to retrieve.
   */
  async getMemoryFeedbackHistory(memoryId: string): Promise<FeedbackHistoryResponse> {
    return this.request<FeedbackHistoryResponse>('GET', `/v1/memories/${memoryId}/feedback`);
  }

  /**
   * Compute a T-I-F reliability score for a memory (T-I-F RFC Phase 3).
   *
   * Fetches the memory's full feedback history and reduces it to a
   * {@link TifScore} with truth/indeterminacy/falsity proportions and a
   * human-readable {@link TifScore.classification}.
   *
   * @param memoryId  The memory to score.
   */
  async evaluateTif(memoryId: string): Promise<TifScore> {
    const history = await this.getMemoryFeedbackHistory(memoryId);
    return computeTifScore(history);
  }

  /**
   * Get aggregate feedback counts and health score for an agent (INT-1).
   *
   * @param agentId  The agent to summarise feedback for.
   */
  async getAgentFeedbackSummary(agentId: string): Promise<AgentFeedbackSummary> {
    return this.request<AgentFeedbackSummary>('GET', `/v1/agents/${agentId}/feedback/summary`);
  }

  /**
   * Directly override a memory's importance score (INT-1).
   *
   * @param memoryId    The memory to update.
   * @param agentId     The agent that owns the memory.
   * @param importance  New importance value (0.0–1.0).
   */
  async patchMemoryImportance(memoryId: string, agentId: string, importance: number): Promise<FeedbackResponse> {
    return this.request<FeedbackResponse>('PATCH', `/v1/memories/${memoryId}/importance`, { agent_id: agentId, importance });
  }

  /**
   * Get overall feedback health score for an agent (INT-1).
   *
   * The health score is the mean importance of all non-expired memories (0.0–1.0).
   * A higher score indicates a healthier, more relevant memory store.
   *
   * @param agentId  The agent to get health score for.
   */
  async getFeedbackHealth(agentId: string): Promise<FeedbackHealthResponse> {
    const params = new URLSearchParams({ agent_id: agentId });
    return this.request<FeedbackHealthResponse>('GET', `/v1/feedback/health?${params}`);
  }

  // ===========================================================================
  // Memory Knowledge Graph Operations (CE-5 / SDK-9)
  // ===========================================================================

  /**
   * Traverse the knowledge graph from a memory node.
   *
   * Requires CE-5 (Memory Knowledge Graph) on the server.
   *
   * @param memoryId  Root memory ID to start traversal from.
   * @param options   `depth` (default 1, max 3) and optional `types` filter.
   *
   * @example
   * const graph = await client.memories.graph(memoryId, { depth: 2 });
   * console.log(`${graph.nodes.length} nodes, ${graph.edges.length} edges`);
   */
  async memoryGraph(memoryId: string, options?: MemoryGraphOptions): Promise<MemoryGraph> {
    const params = new URLSearchParams();
    params.set('depth', String(options?.depth ?? 1));
    if (options?.types?.length) {
      params.set('types', options.types.join(','));
    }
    return this.request<MemoryGraph>('GET', `/v1/memories/${memoryId}/graph?${params}`);
  }

  /**
   * Find the shortest path between two memories in the knowledge graph.
   *
   * Requires CE-5 (Memory Knowledge Graph) on the server.
   *
   * @param sourceId  Starting memory ID.
   * @param targetId  Destination memory ID.
   */
  async memoryPath(sourceId: string, targetId: string): Promise<GraphPath> {
    return this.request<GraphPath>('GET', `/v1/memories/${sourceId}/path?target=${encodeURIComponent(targetId)}`);
  }

  /**
   * Create an explicit edge between two memories.
   *
   * Requires CE-5 (Memory Knowledge Graph) on the server.
   *
   * @param sourceId  Source memory ID.
   * @param targetId  Target memory ID.
   * @param edgeType  Edge type — must be `"linked_by"` for explicit links.
   */
  async memoryLink(
    sourceId: string,
    targetId: string,
    edgeType: EdgeType = 'linked_by',
  ): Promise<GraphLinkResponse> {
    return this.request<GraphLinkResponse>('POST', `/v1/memories/${sourceId}/links`, {
      target_id: targetId,
      edge_type: edgeType,
    });
  }

  /**
   * Export the full knowledge graph for an agent.
   *
   * Requires CE-5 (Memory Knowledge Graph) on the server.
   *
   * @param agentId  Agent whose graph to export.
   * @param format   Export format — `"json"` (default), `"graphml"`, or `"csv"`.
   */
  async agentGraphExport(
    agentId: string,
    format: 'json' | 'graphml' | 'csv' = 'json',
  ): Promise<GraphExport> {
    return this.request<GraphExport>('GET', `/v1/agents/${agentId}/graph/export?format=${format}`);
  }

  // =========================================================================
  // Entity Extraction Operations (CE-4)
  // =========================================================================

  /** Get entity extraction configuration for a namespace. */
  async getNamespaceEntityConfig(namespace: string): Promise<NamespaceEntityConfig> {
    return this.request<NamespaceEntityConfig>('GET', `/v1/namespaces/${encodeURIComponent(namespace)}/config`);
  }

  /** Get the extractor provider configuration for a namespace. */
  async getNamespaceExtractor(namespace: string): Promise<ExtractorConfig> {
    return this.request<ExtractorConfig>('GET', `/v1/namespaces/${encodeURIComponent(namespace)}/extractor`);
  }

  /**
   * Configure entity extraction for a namespace.
   *
   * @param namespace - Target namespace
   * @param config - NER configuration (extract_entities flag + entity_types)
   * @returns Updated namespace config
   *
   * @note Requires CE-4 (GLiNER) on the server.
   */
  async configureNamespaceNer(
    namespace: string,
    config: NamespaceNerConfig,
  ): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'PATCH',
      `/v1/namespaces/${namespace}/config`,
      config,
    );
  }

  /**
   * Extract entities from arbitrary text without storing a memory.
   *
   * @param text - Text to extract entities from
   * @param entityTypes - Entity types to extract (defaults to server defaults)
   * @returns EntityExtractionResponse with extracted entities
   *
   * @note Requires CE-4 (GLiNER) on the server.
   */
  async extractEntities(
    text: string,
    entityTypes?: string[],
  ): Promise<EntityExtractionResponse> {
    const body: Record<string, unknown> = { content: text };
    if (entityTypes !== undefined) {
      body['entity_types'] = entityTypes;
    }
    return this.request<EntityExtractionResponse>('POST', '/v1/memories/extract', body);
  }

  /**
   * Get entity tags attached to a stored memory.
   *
   * @param memoryId - Memory ID to fetch entities for
   * @returns MemoryEntitiesResponse with entity list
   *
   * @note Requires CE-4 (GLiNER) on the server.
   */
  async memoryEntities(memoryId: string): Promise<MemoryEntitiesResponse> {
    return this.request<MemoryEntitiesResponse>('GET', `/v1/memory/entities/${memoryId}`);
  }

  // ===========================================================================
  // Session Operations
  // ===========================================================================

  /** Start a new session */
  async startSession(agentId: string, metadata?: Record<string, unknown>): Promise<Session> {
    const resp = await this.request<SessionStartResponse>('POST', '/v1/sessions/start', { agent_id: agentId, metadata });
    return resp.session;
  }

  /** End a session. Returns the session state and total memory count at close. */
  async endSession(sessionId: string): Promise<SessionEndResponse> {
    return this.request<SessionEndResponse>('POST', `/v1/sessions/${sessionId}/end`, {});
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

  /**
   * Return top-N wake-up context memories for an agent (DAK-1690).
   *
   * Calls `GET /v1/agents/{agentId}/wake-up`. Returns memories ranked by
   * `importance × exp(-ln2 × age / 14d)` — no embedding inference, served
   * from the metadata index for sub-millisecond latency.
   *
   * Requires Read scope on the agent namespace.
   *
   * @param agentId - Agent identifier.
   * @param options - Optional `top_n` (default 20, max 100) and `min_importance` (default 0.0).
   */
  async getWakeUpContext(agentId: string, options?: WakeUpOptions): Promise<WakeUpResponse> {
    const params = new URLSearchParams();
    if (options?.top_n !== undefined) params.set('top_n', String(options.top_n));
    if (options?.min_importance !== undefined) params.set('min_importance', String(options.min_importance));
    const qs = params.toString();
    return this.request<WakeUpResponse>('GET', `/v1/agents/${agentId}/wake-up${qs ? `?${qs}` : ''}`);
  }

  /**
   * Compress the memory namespace for an agent (CE-12).
   *
   * Runs a server-side compression pass that removes low-value or redundant
   * memories, returning statistics about the operation.
   *
   * @param agentId - Agent whose namespace to compress.
   * @returns {@link CompressResponse} with before/after counts and timing.
   */
  async compressAgent(agentId: string): Promise<CompressResponse> {
    return this.request<CompressResponse>('POST', `/v1/agents/${agentId}/compress`);
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

  // -------------------------------------------------------------------------
  // KG-2: Graph Query & Export
  // -------------------------------------------------------------------------

  /**
   * Query the memory knowledge graph using a filter DSL (KG-2).
   *
   * Calls `GET /v1/knowledge/query`.
   *
   * @param agentId - Agent whose graph to query.
   * @param options - Optional filters: `rootId`, `edgeType`, `minWeight`,
   *   `maxDepth` (default 3), `limit` (default 100, max 1000).
   */
  async knowledgeQuery(
    agentId: string,
    options?: {
      rootId?: string;
      edgeType?: string;
      minWeight?: number;
      maxDepth?: number;
      limit?: number;
    },
  ): Promise<KgQueryResponse> {
    const params = new URLSearchParams({ agent_id: agentId });
    if (options?.rootId != null) params.set('root_id', options.rootId);
    if (options?.edgeType != null) params.set('edge_type', options.edgeType);
    if (options?.minWeight != null) params.set('min_weight', String(options.minWeight));
    if (options?.maxDepth != null) params.set('max_depth', String(options.maxDepth));
    if (options?.limit != null) params.set('limit', String(options.limit));
    return this.request<KgQueryResponse>('GET', `/v1/knowledge/query?${params}`);
  }

  /**
   * Find the BFS shortest path between two memory IDs (KG-2).
   *
   * Calls `GET /v1/knowledge/path`.
   *
   * @param agentId - Agent whose graph to traverse.
   * @param fromId  - Source memory ID.
   * @param toId    - Target memory ID.
   * @throws {@link NotFoundError} if no path exists between the two memories.
   */
  async knowledgePath(agentId: string, fromId: string, toId: string): Promise<KgPathResponse> {
    const params = new URLSearchParams({
      agent_id: agentId,
      from: fromId,
      to: toId,
    });
    return this.request<KgPathResponse>('GET', `/v1/knowledge/path?${params}`);
  }

  /**
   * Export the memory knowledge graph as JSON or GraphML (KG-2).
   *
   * Calls `GET /v1/knowledge/export`.
   *
   * @param agentId - Agent whose graph to export.
   * @param format  - `"json"` (default) or `"graphml"`.
   *
   * @returns `KgExportResponse` for `format="json"`. For `format="graphml"`
   *   the server returns `application/xml` — use the raw fetch API if you
   *   need the GraphML XML string.
   */
  async knowledgeExport(agentId: string, format = 'json'): Promise<KgExportResponse> {
    const params = new URLSearchParams({ agent_id: agentId, format });
    return this.request<KgExportResponse>('GET', `/v1/knowledge/export?${params}`);
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

  /** Get Prometheus metrics in text exposition format (INFRA-3).
   *  Requires Admin scope. Returns the raw Prometheus text exposition
   *  format string suitable for scraping by a Prometheus server. */
  async opsMetrics(): Promise<string> {
    return this.request<string>('GET', '/v1/ops/metrics');
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

  /** Get index statistics across all namespaces */
  async adminIndexStats(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('GET', '/v1/admin/indexes/stats');
  }

  /** Rebuild indexes, optionally for a specific namespace */
  async rebuildIndexes(namespace?: string): Promise<{ status: string }> {
    const body = namespace ? { namespace } : undefined;
    return this.request<{ status: string }>('POST', '/v1/admin/indexes/rebuild', body);
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
    return this.request<{ status: string }>('POST', '/v1/admin/backups/restore', { backup_id: backupId });
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

  /**
   * Return a point-in-time product KPI snapshot (OBS-2).
   *
   * Calls `GET /v1/kpis`. Returns 8 operational metrics covering latency,
   * error rate, and retention. Sub-millisecond — served from in-memory
   * counters. Requires Admin scope.
   */
  async getKpis(): Promise<KpiSnapshot> {
    return this.request<KpiSnapshot>('GET', '/v1/kpis');
  }

  /**
   * Re-encrypt all memory content blobs with a new AES-256-GCM key (SEC-3).
   *
   * After this call the new key is active in the running process.
   * The operator must update `DAKERA_ENCRYPTION_KEY` and restart to make the
   * rotation durable across restarts. Requires Admin scope.
   *
   * @param newKey - New passphrase or 64-char hex key.
   * @param namespace - Rotate only this namespace. Omit to rotate all.
   */
  async rotateEncryptionKey(
    newKey: string,
    namespace?: string,
  ): Promise<RotateEncryptionKeyResponse> {
    const body: RotateEncryptionKeyRequest = { new_key: newKey };
    if (namespace !== undefined) body.namespace = namespace;
    return this.request<RotateEncryptionKeyResponse>(
      'POST',
      '/v1/admin/encryption/rotate-key',
      body,
    );
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
   * Subscribe to real-time memory lifecycle events for a specific agent.
   *
   * Wraps `GET /v1/events/stream`, filtering events by `agentId` and
   * optional `tags`.  Reconnects automatically on connection drop when
   * `reconnect` is `true`.
   *
   * Requires a Read-scoped API key.
   *
   * @param agentId - Agent whose events to receive.
   * @param options.tags - Optional tag filter: only events whose tags overlap
   *   this array are yielded.
   * @param options.reconnect - Auto-reconnect on connection drop. Default `true`.
   * @param options.reconnectDelay - Milliseconds to wait between reconnection
   *   attempts. Default `1000`.
   *
   * @example
   * ```ts
   * for await (const event of client.subscribeAgentMemories('my-bot', { tags: ['important'] })) {
   *   console.log(event.event_type, event.memory_id);
   * }
   * ```
   */
  async *subscribeAgentMemories(
    agentId: string,
    options: { tags?: string[]; reconnect?: boolean; reconnectDelay?: number } = {},
  ): AsyncGenerator<MemoryEvent> {
    const { tags, reconnect = true, reconnectDelay = 1000 } = options;
    while (true) {
      try {
        for await (const event of this.streamMemoryEvents()) {
          if (event.event_type === 'connected') continue;
          if (event.agent_id !== agentId) continue;
          if (tags && tags.length > 0) {
            const eventTags: string[] = event.tags ?? [];
            if (!tags.some((t) => eventTags.includes(t))) continue;
          }
          yield event;
        }
        // Stream closed cleanly.
        if (!reconnect) return;
      } catch (err) {
        if (!reconnect) throw err;
      }
      await new Promise<void>((r) => setTimeout(r, reconnectDelay));
    }
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

  // ===========================================================================
  // Namespace API Keys — SEC-1
  // ===========================================================================

  /**
   * Create a namespace-scoped API key (SEC-1).
   *
   * The `key` field in the response is shown **only once** — store it securely.
   *
   * @param namespace     The namespace to scope this key to.
   * @param name          Human-readable label for the key.
   * @param expiresInDays Optional expiry in days from now.
   */
  async createNamespaceKey(
    namespace: string,
    name: string,
    expiresInDays?: number,
  ): Promise<CreateNamespaceKeyResponse> {
    const body: Record<string, unknown> = { name };
    if (expiresInDays !== undefined) body.expires_in_days = expiresInDays;
    return this.request<CreateNamespaceKeyResponse>('POST', `/v1/namespaces/${namespace}/keys`, body);
  }

  /**
   * List all API keys scoped to a namespace (SEC-1).
   *
   * @param namespace  The namespace whose keys to list.
   */
  async listNamespaceKeys(namespace: string): Promise<ListNamespaceKeysResponse> {
    return this.request<ListNamespaceKeysResponse>('GET', `/v1/namespaces/${namespace}/keys`);
  }

  /**
   * Revoke a namespace-scoped API key (SEC-1).
   *
   * @param namespace  The namespace the key belongs to.
   * @param keyId      The key to revoke.
   */
  async deleteNamespaceKey(namespace: string, keyId: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('DELETE', `/v1/namespaces/${namespace}/keys/${keyId}`);
  }

  /**
   * Get usage statistics for a namespace-scoped API key (SEC-1).
   *
   * @param namespace  The namespace the key belongs to.
   * @param keyId      The key whose usage to retrieve.
   */
  async getNamespaceKeyUsage(namespace: string, keyId: string): Promise<NamespaceKeyUsageResponse> {
    return this.request<NamespaceKeyUsageResponse>('GET', `/v1/namespaces/${namespace}/keys/${keyId}/usage`);
  }

  // ===========================================================================
  // DX-1: Memory Import / Export
  // ===========================================================================

  /**
   * Import memories from an external format (DX-1).
   *
   * @param data     Serialised memories (list of objects for jsonl/mem0/zep, or a CSV string).
   * @param format   One of `"jsonl"`, `"mem0"`, `"zep"`, `"csv"`. Defaults to `"jsonl"`.
   * @param agentId  Assign all imported memories to this agent.
   * @param namespace Target namespace (defaults to the client's configured namespace).
   */
  async importMemories(
    data: unknown,
    format: 'jsonl' | 'mem0' | 'zep' | 'csv' = 'jsonl',
    agentId?: string,
    namespace?: string,
  ): Promise<MemoryImportResponse> {
    const body: Record<string, unknown> = { data, format };
    if (agentId !== undefined) body.agent_id = agentId;
    if (namespace !== undefined) body.namespace = namespace;
    return this.request<MemoryImportResponse>('POST', '/v1/import', body);
  }

  /**
   * Export memories in a portable format (DX-1).
   *
   * @param format    One of `"jsonl"`, `"mem0"`, `"zep"`, `"csv"`. Defaults to `"jsonl"`.
   * @param agentId   Export only memories for this agent.
   * @param namespace Source namespace (defaults to client namespace).
   * @param limit     Maximum number of memories to export.
   */
  async exportMemories(
    format: 'jsonl' | 'mem0' | 'zep' | 'csv' = 'jsonl',
    agentId?: string,
    namespace?: string,
    limit?: number,
  ): Promise<MemoryExportResponse> {
    const params = new URLSearchParams({ format });
    if (agentId !== undefined) params.set('agent_id', agentId);
    if (namespace !== undefined) params.set('namespace', namespace);
    if (limit !== undefined) params.set('limit', String(limit));
    return this.request<MemoryExportResponse>('GET', `/v1/export?${params}`);
  }

  // ===========================================================================
  // OBS-1: Business-Event Audit Log
  // ===========================================================================

  /**
   * List paginated audit log entries (OBS-1).
   *
   * @param agentId   Filter to events from this agent.
   * @param eventType Filter to a specific event type string.
   * @param fromTs    Unix timestamp lower bound (inclusive).
   * @param toTs      Unix timestamp upper bound (exclusive).
   * @param limit     Maximum number of events to return.
   * @param cursor    Pagination cursor from a previous response.
   */
  async listAuditEvents(opts?: {
    agentId?: string;
    eventType?: string;
    fromTs?: number;
    toTs?: number;
    limit?: number;
    cursor?: string;
  }): Promise<AuditListResponse> {
    const params = new URLSearchParams();
    if (opts?.agentId) params.set('agent_id', opts.agentId);
    if (opts?.eventType) params.set('event_type', opts.eventType);
    if (opts?.fromTs !== undefined) params.set('from', String(opts.fromTs));
    if (opts?.toTs !== undefined) params.set('to', String(opts.toTs));
    if (opts?.limit !== undefined) params.set('limit', String(opts.limit));
    if (opts?.cursor) params.set('cursor', opts.cursor);
    const qs = params.toString();
    return this.request<AuditListResponse>('GET', qs ? `/v1/audit?${qs}` : '/v1/audit');
  }

  /**
   * Stream live audit events via SSE (OBS-1).
   *
   * Opens a long-lived connection to `GET /v1/audit/stream` and yields
   * {@link DakeraEvent} objects as they arrive.
   *
   * @param agentId   Scope the stream to a specific agent.
   * @param eventType Scope the stream to a specific event type.
   */
  async *streamAuditEvents(opts?: {
    agentId?: string;
    eventType?: string;
  }): AsyncGenerator<DakeraEvent> {
    const params = new URLSearchParams();
    if (opts?.agentId) params.set('agent_id', opts.agentId);
    if (opts?.eventType) params.set('event_type', opts.eventType);
    const qs = params.toString();
    const url = `${this.baseUrl}/v1/audit/stream${qs ? `?${qs}` : ''}`;
    yield* this._streamSse(url);
  }

  /**
   * Bulk-export audit log entries (OBS-1).
   *
   * @param format    `"jsonl"` (default) or `"csv"`.
   * @param agentId   Filter to a specific agent.
   * @param eventType Filter to a specific event type.
   * @param fromTs    Unix timestamp lower bound.
   * @param toTs      Unix timestamp upper bound.
   */
  async exportAudit(opts?: {
    format?: 'jsonl' | 'csv';
    agentId?: string;
    eventType?: string;
    fromTs?: number;
    toTs?: number;
  }): Promise<AuditExportResponse> {
    const body: Record<string, unknown> = { format: opts?.format ?? 'jsonl' };
    if (opts?.agentId) body.agent_id = opts.agentId;
    if (opts?.eventType) body.event_type = opts.eventType;
    if (opts?.fromTs !== undefined) body.from = opts.fromTs;
    if (opts?.toTs !== undefined) body.to = opts.toTs;
    return this.request<AuditExportResponse>('POST', '/v1/audit/export', body);
  }

  // ===========================================================================
  // EXT-1: External Extraction Providers
  // ===========================================================================

  /**
   * Extract entities from text using a pluggable provider (EXT-1).
   *
   * Provider hierarchy: per-request override > namespace default > GLiNER (bundled).
   *
   * @param text      Input text to extract from.
   * @param namespace Namespace whose default extractor to inherit.
   * @param provider  Override provider: `"gliner"`, `"openai"`, `"anthropic"`,
   *                  `"openrouter"`, or `"ollama"`.
   * @param model     Override model within the chosen provider.
   */
  async extractText(
    text: string,
    namespace?: string,
    provider?: 'gliner' | 'openai' | 'anthropic' | 'openrouter' | 'ollama',
    model?: string,
  ): Promise<ExtractionResult> {
    const body: Record<string, unknown> = { text };
    if (namespace !== undefined) body.namespace = namespace;
    if (provider !== undefined) body.provider = provider;
    if (model !== undefined) body.model = model;
    return this.request<ExtractionResult>('POST', '/v1/extract', body);
  }

  /**
   * List available extraction providers and their supported models (EXT-1).
   */
  async listExtractProviders(): Promise<ExtractionProviderInfo[]> {
    const result = await this.request<ExtractionProviderInfo[] | { providers: ExtractionProviderInfo[] }>(
      'GET', '/v1/extract/providers',
    );
    return Array.isArray(result) ? result : result.providers;
  }

  /**
   * Set the default extraction provider for a namespace (EXT-1).
   *
   * @param namespace The namespace to configure.
   * @param provider  Default provider.
   * @param model     Default model within the provider (optional).
   */
  async configureNamespaceExtractor(
    namespace: string,
    provider: 'gliner' | 'openai' | 'anthropic' | 'openrouter' | 'ollama',
    model?: string,
  ): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = { provider };
    if (model !== undefined) body.model = model;
    return this.request<Record<string, unknown>>('PATCH', `/v1/namespaces/${encodeURIComponent(namespace)}/extractor`, body);
  }

  // ===========================================================================
  // ODE-2: GLiNER Entity Extraction (dakera-ode sidecar)
  // ===========================================================================

  /**
   * Extract named entities from text using the GLiNER sidecar (ODE-2).
   *
   * Calls `POST /ode/extract` on the dakera-ode sidecar. Requires
   * `odeUrl` to be configured in {@link ClientOptions}.
   *
   * Unlike `extractEntities` (CE-4, server-side NER), this method calls the
   * dedicated GLiNER sidecar and returns character offsets, model name, and
   * processing time.
   *
   * @param content      The text to extract entities from.
   * @param agentId      Agent context for the extraction.
   * @param memoryId     Optional memory ID to associate with the extraction.
   * @param entityTypes  Optional list of entity type labels to extract.
   *                     When omitted the ODE sidecar uses its default set.
   * @throws {Error} If `odeUrl` is not configured.
   */
  async odeExtractEntities(
    content: string,
    agentId: string,
    memoryId?: string,
    entityTypes?: string[],
  ): Promise<ExtractEntitiesResponse> {
    if (!this.odeUrl) {
      throw new Error(
        'odeUrl must be configured to use extractEntities(). ' +
        "Pass odeUrl: 'http://localhost:8080' in ClientOptions.",
      );
    }
    const body: ExtractEntitiesRequest = { content, agent_id: agentId };
    if (memoryId !== undefined) body.memory_id = memoryId;
    if (entityTypes !== undefined) body.entity_types = entityTypes;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const resp = await fetch(`${this.odeUrl}/ode/extract`, {
        method: 'POST',
        headers: { ...this.headers },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`ODE sidecar returned ${resp.status}: ${text}`);
      }
      return resp.json() as Promise<ExtractEntitiesResponse>;
    } finally {
      clearTimeout(timer);
    }
  }

  // =========================================================================
  // COG-1: Per-namespace Memory Lifecycle Policy
  // =========================================================================

  /**
   * Return the memory lifecycle policy for a namespace (COG-1).
   *
   * `GET /v1/namespaces/{namespace}/memory_policy`
   *
   * When no explicit policy has been configured the server returns COG-1
   * defaults: working=4 h, episodic=30 d, semantic=365 d, procedural=730 d;
   * exponential / power_law / logarithmic / flat decay; SR factor 1.0.
   *
   * @param namespace  Namespace to inspect.
   */
  async getMemoryPolicy(namespace: string): Promise<MemoryPolicy> {
    return this.request<MemoryPolicy>(
      'GET',
      `/v1/namespaces/${encodeURIComponent(namespace)}/memory_policy`,
    );
  }

  /**
   * Set the memory lifecycle policy for a namespace (COG-1).
   *
   * `PUT /v1/namespaces/{namespace}/memory_policy`
   *
   * The policy is persisted in namespace config and applied immediately to
   * the decay engine background task.  Only populate the fields you want to
   * override — all fields have safe server-side defaults.
   *
   * @param namespace  Namespace to configure.
   * @param policy     {@link MemoryPolicy} with the desired settings.
   * @returns          The updated policy as confirmed by the server.
   */
  async setMemoryPolicy(namespace: string, policy: MemoryPolicy): Promise<MemoryPolicy> {
    return this.request<MemoryPolicy>(
      'PUT',
      `/v1/namespaces/${encodeURIComponent(namespace)}/memory_policy`,
      policy,
    );
  }

  /**
   * Backfill the BM25 fulltext index for memories stored before CE-12 auto-indexing (CE-54).
   *
   * `POST /admin/fulltext/reindex`
   *
   * Scans all memories in `namespace` (or every agent namespace when omitted) and adds
   * any that are missing from the BM25 index. Safe to call multiple times.
   *
   * Requires Admin scope.
   *
   * @param namespace  Target namespace. Omit to reindex all agent namespaces.
   * @returns          {@link FulltextReindexResponse} with per-namespace breakdown.
   */
  async adminFulltextReindex(namespace?: string): Promise<FulltextReindexResponse> {
    const body = namespace ? { namespace } : {};
    return this.request<FulltextReindexResponse>('POST', '/v1/admin/fulltext/reindex', body);
  }

  // ---------------------------------------------------------------------------
  // Admin — Cluster & Maintenance
  // ---------------------------------------------------------------------------

  /** GET /admin/cluster/replication — cluster replication status. */
  async adminClusterReplication(): Promise<ReplicationStatus> {
    return this.request<ReplicationStatus>('GET', '/v1/admin/cluster/replication');
  }

  /** GET /admin/cluster/shards — list shards. */
  async adminListShards(): Promise<ShardListResponse> {
    return this.request<ShardListResponse>('GET', '/v1/admin/cluster/shards');
  }

  /** POST /admin/cluster/shards/rebalance — rebalance shards. */
  async adminRebalanceShards(request?: ShardRebalanceRequest): Promise<ShardRebalanceResponse> {
    return this.request<ShardRebalanceResponse>('POST', '/v1/admin/cluster/shards/rebalance', request ?? {});
  }

  /** GET /admin/cluster/maintenance — maintenance mode status. */
  async adminMaintenanceStatus(): Promise<MaintenanceStatus> {
    return this.request<MaintenanceStatus>('GET', '/v1/admin/cluster/maintenance');
  }

  /** POST /admin/cluster/maintenance/enable — enable maintenance mode. */
  async adminEnableMaintenance(request: EnableMaintenanceRequest): Promise<MaintenanceStatus> {
    return this.request<MaintenanceStatus>('POST', '/v1/admin/cluster/maintenance/enable', request);
  }

  /** POST /admin/cluster/maintenance/disable — disable maintenance mode. */
  async adminDisableMaintenance(request?: DisableMaintenanceRequest): Promise<MaintenanceStatus> {
    return this.request<MaintenanceStatus>('POST', '/v1/admin/cluster/maintenance/disable', request ?? {});
  }

  // ---------------------------------------------------------------------------
  // Admin — Quotas
  // ---------------------------------------------------------------------------

  /** GET /admin/quotas — list all namespace quotas. */
  async adminListQuotas(): Promise<QuotaListResponse> {
    return this.request<QuotaListResponse>('GET', '/v1/admin/quotas');
  }

  /** GET /admin/quotas/default — get default quota configuration. */
  async adminGetDefaultQuota(): Promise<DefaultQuotaResponse> {
    return this.request<DefaultQuotaResponse>('GET', '/v1/admin/quotas/default');
  }

  /** PUT /admin/quotas/default — set default quota configuration. */
  async adminSetDefaultQuota(request: SetDefaultQuotaRequest): Promise<SetQuotaResponse> {
    return this.request<SetQuotaResponse>('PUT', '/v1/admin/quotas/default', request);
  }

  /** GET /admin/quotas/{namespace} — get namespace quota. */
  async adminGetQuota(namespace: string): Promise<QuotaStatus> {
    return this.request<QuotaStatus>('GET', `/v1/admin/quotas/${namespace}`);
  }

  /** PUT /admin/quotas/{namespace} — set namespace quota. */
  async adminSetQuota(namespace: string, request: SetQuotaRequest): Promise<SetQuotaResponse> {
    return this.request<SetQuotaResponse>('PUT', `/v1/admin/quotas/${namespace}`, request);
  }

  /** DELETE /admin/quotas/{namespace} — remove namespace quota. */
  async adminDeleteQuota(namespace: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('DELETE', `/v1/admin/quotas/${namespace}`);
  }

  /** POST /admin/quotas/{namespace}/check — check if operation would exceed quota. */
  async adminCheckQuota(namespace: string, request: QuotaCheckRequest): Promise<QuotaCheckResult> {
    return this.request<QuotaCheckResult>('POST', `/v1/admin/quotas/${namespace}/check`, request);
  }

  // ---------------------------------------------------------------------------
  // Admin — Slow Queries
  // ---------------------------------------------------------------------------

  /** GET /admin/slow-queries — list recent slow queries. */
  async adminListSlowQueries(params?: { namespace?: string; query_type?: string; limit?: number }): Promise<unknown[]> {
    const qs = params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString() : '';
    const path = qs ? `/v1/admin/slow-queries?${qs}` : '/v1/admin/slow-queries';
    return this.request<unknown[]>('GET', path);
  }

  /** GET /admin/slow-queries/summary — slow query summary. */
  async adminSlowQuerySummary(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('GET', '/v1/admin/slow-queries/summary');
  }

  /** DELETE /admin/slow-queries — clear slow query log. */
  async adminClearSlowQueries(namespace?: string): Promise<Record<string, unknown>> {
    const path = namespace ? `/v1/admin/slow-queries?namespace=${encodeURIComponent(namespace)}` : '/v1/admin/slow-queries';
    return this.request<Record<string, unknown>>('DELETE', path);
  }

  /** PATCH /admin/slow-queries/config — update slow query configuration. */
  async adminUpdateSlowQueryConfig(config: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('PATCH', '/v1/admin/slow-queries/config', config);
  }

  // ---------------------------------------------------------------------------
  // Admin — Backups
  // ---------------------------------------------------------------------------

  /** GET /admin/backups — list all backups. */
  async adminListBackups(): Promise<BackupListResponse> {
    return this.request<BackupListResponse>('GET', '/v1/admin/backups');
  }

  /** POST /admin/backups — create a new backup. */
  async adminCreateBackup(request: CreateBackupRequest): Promise<CreateBackupResponse> {
    return this.request<CreateBackupResponse>('POST', '/v1/admin/backups', request);
  }

  /** GET /admin/backups/{id} — get backup details. */
  async adminGetBackup(backupId: string): Promise<BackupInfo> {
    return this.request<BackupInfo>('GET', `/v1/admin/backups/${backupId}`);
  }

  /** DELETE /admin/backups/{id} — delete a backup. */
  async adminDeleteBackup(backupId: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('DELETE', `/v1/admin/backups/${backupId}`);
  }

  /** GET /admin/backups/schedule — get backup schedule. */
  async adminGetBackupSchedule(): Promise<BackupSchedule> {
    return this.request<BackupSchedule>('GET', '/v1/admin/backups/schedule');
  }

  /** POST /admin/backups/schedule — update backup schedule. */
  async adminUpdateBackupSchedule(request: UpdateBackupScheduleRequest): Promise<BackupSchedule> {
    return this.request<BackupSchedule>('POST', '/v1/admin/backups/schedule', request);
  }

  /** POST /admin/backups/restore — restore from backup. */
  async adminRestoreBackup(request: RestoreBackupRequest): Promise<RestoreBackupResponse> {
    return this.request<RestoreBackupResponse>('POST', '/v1/admin/backups/restore', request);
  }

  /** GET /admin/backups/restore/{id} — restore operation status. */
  async adminGetRestoreStatus(restoreId: string): Promise<RestoreBackupResponse> {
    return this.request<RestoreBackupResponse>('GET', `/v1/admin/backups/restore/${restoreId}`);
  }

  // ---------------------------------------------------------------------------
  // Ops — Diagnostics & Jobs
  // ---------------------------------------------------------------------------

  /** GET /ops/diagnostics — system diagnostics. */
  async opsDiagnostics(): Promise<SystemDiagnostics> {
    return this.request<SystemDiagnostics>('GET', '/ops/diagnostics');
  }

  /** GET /ops/jobs — list background jobs. */
  async opsListJobs(): Promise<JobInfo[]> {
    return this.request<JobInfo[]>('GET', '/ops/jobs');
  }

  /** GET /ops/jobs/{id} — get job status. */
  async opsGetJob(jobId: string): Promise<JobInfo> {
    return this.request<JobInfo>('GET', `/ops/jobs/${jobId}`);
  }

  /** POST /ops/compact — trigger compaction. */
  async opsCompact(request?: CompactionRequest): Promise<CompactionResponse> {
    return this.request<CompactionResponse>('POST', '/ops/compact', request ?? {});
  }

  /** POST /ops/shutdown — request graceful shutdown. */
  async opsShutdown(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/ops/shutdown');
  }

  // ────────────────────────────────────────────────────────────
  // Phase 3 — Engine Parity
  // ────────────────────────────────────────────────────────────

  /** GET /v1/namespaces/{namespace}/fulltext/stats — full-text index statistics. */
  async fulltextStats(namespace: string): Promise<FullTextIndexStats> {
    return this.request<FullTextIndexStats>(
      'GET',
      `/v1/namespaces/${encodeURIComponent(namespace)}/fulltext/stats`,
    );
  }

  /** POST /v1/namespaces/{namespace}/fulltext/delete — delete documents from full-text index. */
  async fulltextDelete(namespace: string, ids: string[]): Promise<FulltextDeleteResponse> {
    return this.request<FulltextDeleteResponse>(
      'POST',
      `/v1/namespaces/${encodeURIComponent(namespace)}/fulltext/delete`,
      { ids },
    );
  }

  /** GET /admin/ttl/stats — TTL statistics across all namespaces. */
  async adminTtlStats(): Promise<TtlStatsResponse> {
    return this.request<TtlStatsResponse>('GET', '/v1/admin/ttl/stats');
  }

  /** POST /v1/route — route a query to the best-matching namespace(s). */
  async routeQuery(request: RouteRequest): Promise<RouteResponse> {
    return this.request<RouteResponse>('POST', '/v1/route', request);
  }

  /** GET /v1/import/{job_id}/status — check import job progress. */
  async importJobStatus(jobId: string): Promise<ImportJobStatus> {
    return this.request<ImportJobStatus>(
      'GET',
      `/v1/import/${encodeURIComponent(jobId)}/status`,
    );
  }

  /** GET /admin/backups/{id}/download — download a backup as binary data. */
  async adminDownloadBackup(backupId: string): Promise<ArrayBuffer> {
    const url = `${this.baseUrl}/v1/admin/backups/${encodeURIComponent(backupId)}/download`;
    const response = await fetch(url, {
      headers: { ...this.headers, Accept: 'application/octet-stream' },
    });
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }
    return response.arrayBuffer();
  }

  /** POST /admin/backups/upload — upload a backup archive. */
  async adminUploadBackup(data: ArrayBuffer | Uint8Array): Promise<CreateBackupResponse> {
    const url = `${this.baseUrl}/v1/admin/backups/upload`;
    const headers: Record<string, string> = {};
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    headers['Content-Type'] = 'application/gzip';
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: data instanceof ArrayBuffer ? data : (data as unknown as BodyInit),
    });
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }
    return response.json() as Promise<CreateBackupResponse>;
  }

  /** GET /admin/storage/tiers — storage tier overview. */
  async adminStorageTierOverview(): Promise<StorageTierOverview> {
    return this.request<StorageTierOverview>('GET', '/v1/admin/storage/tiers');
  }

  /** GET /admin/background-activity — current background activity. */
  async adminBackgroundActivity(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('GET', '/v1/admin/background-activity');
  }

  /** GET /admin/memory-type-stats — memory type distribution statistics. */
  async adminMemoryTypeStats(): Promise<MemoryTypeStatsResponse> {
    return this.request<MemoryTypeStatsResponse>('GET', '/v1/admin/memory-type-stats');
  }

  /** POST /admin/namespaces/migrate-dimensions — migrate namespace embedding dimensions. */
  async adminMigrateNamespaceDimensions(
    request?: MigrateNamespaceDimensionsRequest,
  ): Promise<MigrateDimensionsResponse> {
    return this.request<MigrateDimensionsResponse>(
      'POST',
      '/v1/admin/namespaces/migrate-dimensions',
      request ?? {},
    );
  }

  /**
   * POST /admin/reembed/drain — synchronously drain all static vectors to full ONNX quality (v0.11.82+).
   *
   * Runs the re-embedding upgrade loop until zero `_embedding_kind=static` vectors remain
   * across all namespaces, or `timeout_secs` elapses. Requires Admin scope. Useful as a
   * pre-benchmark steady-state gate when `DAKERA_TIERED=1`.
   *
   * A `remaining: 0` result means all vectors are at full ONNX quality.
   */
  async adminDrainReembed(request?: DrainReembedRequest): Promise<DrainReembedResponse> {
    return this.request<DrainReembedResponse>('POST', '/v1/admin/reembed/drain', request ?? {});
  }

  /**
   * GET /admin/reembed/static-count — count of static vectors pending re-embedding (v0.11.91+).
   *
   * Returns the number of `_embedding_kind=static` vectors awaiting ONNX upgrade.
   * Poll alongside `adminDrainReembed` to monitor drain progress. A `static_count`
   * of 0 means steady state. Requires Admin scope.
   */
  async adminReembedStaticCount(): Promise<StaticCountResponse> {
    return this.request<StaticCountResponse>('GET', '/v1/admin/reembed/static-count');
  }
}
