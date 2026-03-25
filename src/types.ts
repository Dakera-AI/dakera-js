/**
 * Dakera TypeScript SDK Types
 */

// ============================================================================
// Branded ID Types
//
// Branded types prevent mixing up IDs from different domains at compile time.
// Use the helper factory functions (vectorId, agentId, memoryId, sessionId)
// to create branded IDs from plain strings.
//
// Example:
//   import { vectorId, agentId } from '@dakera-ai/dakera';
//   const id = vectorId('vec-001');          // VectorId (not a plain string)
//   const agent = agentId('my-agent');       // AgentId
// ============================================================================

declare const __brand: unique symbol;
type Brand<B> = { readonly [__brand]: B };

/** A branded string type — T is the nominal tag that prevents cross-assignment. */
export type Branded<T extends string, B> = T & Brand<B>;

/** Opaque ID for a stored vector. */
export type VectorId = Branded<string, 'VectorId'>;

/** Opaque ID for an agent. */
export type AgentId = Branded<string, 'AgentId'>;

/** Opaque ID for a memory entry. */
export type MemoryId = Branded<string, 'MemoryId'>;

/** Opaque ID for a session. */
export type SessionId = Branded<string, 'SessionId'>;

// Factory helpers — cast plain strings into the correct branded type.
// These are zero-cost at runtime (just identity functions).

/** Create a VectorId from a plain string. */
export function vectorId(id: string): VectorId { return id as VectorId; }

/** Create an AgentId from a plain string. */
export function agentId(id: string): AgentId { return id as AgentId; }

/** Create a MemoryId from a plain string. */
export function memoryId(id: string): MemoryId { return id as MemoryId; }

/** Create a SessionId from a plain string. */
export function sessionId(id: string): SessionId { return id as SessionId; }

// ============================================================================
// Consistency & Query Types (Turbopuffer-inspired)
// ============================================================================

/** Read consistency level for queries */
export type ReadConsistency = 'strong' | 'eventual' | 'bounded_staleness';

/** Distance metric for similarity search */
export type DistanceMetric = 'cosine' | 'euclidean' | 'dot_product';

/** Configuration for bounded staleness reads */
export interface StalenessConfig {
  /** Maximum acceptable staleness in milliseconds */
  maxStalenessMs: number;
}

// ============================================================================
// Cache Warming Types (Turbopuffer-inspired)
// ============================================================================

/** Priority level for cache warming operations */
export type WarmingPriority = 'critical' | 'high' | 'normal' | 'low' | 'background';

/** Target cache tier for warming */
export type WarmingTargetTier = 'l1' | 'l2' | 'both';

/** Access pattern hint for cache optimization */
export type AccessPatternHint = 'random' | 'sequential' | 'temporal' | 'spatial';

/** Cache warming request with priority hints */
export interface WarmCacheRequest {
  /** Namespace to warm */
  namespace: string;
  /** Specific vector IDs to warm (undefined = all) */
  vectorIds?: string[];
  /** Warming priority level */
  priority?: WarmingPriority;
  /** Target cache tier */
  targetTier?: WarmingTargetTier;
  /** Run warming in background (non-blocking) */
  background?: boolean;
  /** TTL hint in seconds */
  ttlHintSeconds?: number;
  /** Access pattern hint for optimization */
  accessPattern?: AccessPatternHint;
  /** Maximum vectors to warm */
  maxVectors?: number;
}

/** Cache warming response */
export interface WarmCacheResponse {
  /** Operation success */
  success: boolean;
  /** Number of entries warmed */
  entries_warmed: number;
  /** Number of entries already warm (skipped) */
  entries_skipped: number;
  /** Job ID for tracking background operations */
  job_id?: string;
  /** Status message */
  message: string;
  /** Estimated completion time for background jobs (ISO 8601) */
  estimated_completion?: string;
  /** Target tier that was warmed */
  target_tier: WarmingTargetTier;
  /** Priority that was used */
  priority: WarmingPriority;
  /** Bytes warmed (approximate) */
  bytes_warmed?: number;
}

// ============================================================================
// Vector Types
// ============================================================================

/** Vector with ID, values, and optional metadata */
export interface Vector {
  id: VectorId;
  values: number[];
  metadata?: Record<string, unknown>;
}

/** Input for vector operations - can be Vector object or plain object */
export type VectorInput = Vector | {
  id: VectorId | string;
  values: number[];
  metadata?: Record<string, unknown>;
};

/** Result from a vector query */
export interface QueryResult {
  id: VectorId;
  score: number;
  vector?: number[];
  metadata?: Record<string, unknown>;
}

/** Container for search results */
export interface SearchResult {
  results: QueryResult[];
  /** Cursor for fetching next page of results */
  next_cursor?: string;
  /** Whether there are more results available */
  has_more?: boolean;
}

/** Information about a namespace */
export interface NamespaceInfo {
  namespace: string;
  vector_count: number;
  dimension?: number;
}

/** Index statistics */
export interface IndexStats {
  /** Index type (flat, ivf, hnsw, etc.) */
  index_type: string;
  /** Is index built */
  is_built: boolean;
  /** Index size in bytes */
  size_bytes: number;
  /** Number of indexed vectors */
  indexed_vectors: number;
  /** Last rebuild timestamp */
  last_rebuild?: number;
}

/** Document for full-text search */
export interface Document {
  id: VectorId;
  content: string;
  metadata?: Record<string, unknown>;
}

/** Input for document operations */
export type DocumentInput = Document | {
  id: VectorId | string;
  content: string;
  metadata?: Record<string, unknown>;
};

/** Result from full-text search */
export interface FullTextSearchResult {
  id: VectorId;
  score: number;
  metadata?: Record<string, unknown>;
}

/** Result from hybrid search */
export interface HybridSearchResult {
  id: VectorId;
  /** Combined score */
  score: number;
  /** Vector similarity score (normalized 0-1) */
  vector_score: number;
  /** Text search BM25 score (normalized 0-1) */
  text_score: number;
  metadata?: Record<string, unknown>;
  vector?: number[];
}

/** Health check response */
export interface HealthResponse {
  status: string;
  version?: string;
  uptime?: number;
}

/** Filter operators for metadata queries */
export interface FilterOperators {
  $eq?: unknown;
  $ne?: unknown;
  $gt?: number;
  $gte?: number;
  $lt?: number;
  $lte?: number;
  $in?: unknown[];
  $nin?: unknown[];
  $exists?: boolean;
}

/** Filter expression for queries */
export type FilterExpression = {
  [field: string]: FilterOperators | unknown;
} | {
  $and?: FilterExpression[];
  $or?: FilterExpression[];
  $not?: FilterExpression;
};

/** Options for query operations */
export interface QueryOptions {
  topK?: number;
  filter?: FilterExpression;
  includeValues?: boolean;
  includeMetadata?: boolean;
  /** Distance metric for similarity search */
  distanceMetric?: DistanceMetric;
  /** Read consistency level */
  consistency?: ReadConsistency;
  /** Staleness configuration for bounded staleness reads */
  stalenessConfig?: StalenessConfig;
}

/** Options for delete operations */
export interface DeleteOptions {
  ids?: string[];
  filter?: FilterExpression;
  deleteAll?: boolean;
}

/** Options for upsert operations */
export interface UpsertOptions {
  namespace: string;
  vectors: VectorInput[];
}

/** Response from upsert operation */
export interface UpsertResponse {
  upserted_count: number;
}

/** Response from delete operation */
export interface DeleteResponse {
  deleted_count: number;
}

/** Batch query specification */
export interface BatchQuerySpec {
  vector: number[];
  topK?: number;
  filter?: FilterExpression;
  includeValues?: boolean;
  includeMetadata?: boolean;
  /** Distance metric for similarity search */
  distanceMetric?: DistanceMetric;
  /** Read consistency level */
  consistency?: ReadConsistency;
  /** Staleness configuration for bounded staleness reads */
  stalenessConfig?: StalenessConfig;
}

/** Exponential backoff configuration for retries */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds before the first retry (default: 100) */
  baseDelay?: number;
  /** Maximum delay in milliseconds between retries (default: 60000) */
  maxDelay?: number;
  /** Whether to add random jitter to backoff delay (default: true) */
  jitter?: boolean;
}

/** Client configuration options */
export interface ClientOptions {
  /** Base URL of the Dakera server */
  baseUrl: string;
  /** API key for authentication */
  apiKey?: string;
  /** Per-request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Connection establishment timeout in milliseconds. Defaults to `timeout`. */
  connectTimeout?: number;
  /** Maximum number of retries for transient errors (default: 3).
   *  Ignored when `retryBackoff` is provided. */
  maxRetries?: number;
  /** Fine-grained retry and backoff configuration.
   *  When provided, `maxRetries` is ignored in favour of `retryBackoff.maxRetries`. */
  retryBackoff?: RetryConfig;
  /** Additional headers */
  headers?: Record<string, string>;
}

// =============================================================================
// Text-Based Inference Types (Auto-Embedding)
// =============================================================================

/**
 * Supported embedding models for text-based operations.
 * - minilm: MiniLM-L6 - Fast, good quality (384 dimensions)
 * - bge-small: BGE-small - Balanced performance (384 dimensions)
 * - e5-small: E5-small - High quality (384 dimensions)
 */
export type EmbeddingModel = 'minilm' | 'bge-small' | 'e5-small';

/**
 * Input for upserting a text document with automatic embedding.
 */
export interface TextDocument {
  /** Unique identifier for the document */
  id: string;
  /** Raw text content to be embedded */
  text: string;
  /** Optional metadata for the document */
  metadata?: Record<string, unknown>;
  /** Optional TTL in seconds */
  ttlSeconds?: number;
}

/**
 * Options for text upsert operations.
 */
export interface TextUpsertOptions {
  /** Embedding model to use (default: minilm) */
  model?: EmbeddingModel;
}

/**
 * Response from a text upsert operation.
 */
export interface TextUpsertResponse {
  /** Number of documents upserted */
  upserted_count: number;
  /** Approximate number of tokens processed */
  tokens_processed: number;
  /** Embedding model used */
  model: EmbeddingModel;
  /** Time spent generating embeddings in milliseconds */
  embedding_time_ms: number;
}

/**
 * Options for text query operations.
 */
export interface TextQueryOptions {
  /** Number of results to return (default: 10) */
  topK?: number;
  /** Metadata filter */
  filter?: FilterExpression;
  /** Whether to include the original text in results */
  includeText?: boolean;
  /** Whether to include vectors in results */
  includeVectors?: boolean;
  /** Embedding model to use (default: minilm) */
  model?: EmbeddingModel;
}

/**
 * A single text search result.
 */
export interface TextSearchResult {
  /** Document ID */
  id: VectorId;
  /** Similarity score */
  score: number;
  /** Original text (if includeText was true) */
  text?: string;
  /** Document metadata (excluding internal _text field) */
  metadata?: Record<string, unknown>;
  /** Vector values (if includeVectors was true) */
  vector?: number[];
}

/**
 * Response from a text query operation.
 */
export interface TextQueryResponse {
  /** Search results */
  results: TextSearchResult[];
  /** Embedding model used */
  model: EmbeddingModel;
  /** Time spent generating query embedding in milliseconds */
  embedding_time_ms: number;
  /** Time spent searching in milliseconds */
  search_time_ms: number;
}

/**
 * Options for batch text query operations.
 */
export interface BatchTextQueryOptions {
  /** Number of results per query (default: 10) */
  topK?: number;
  /** Metadata filter applied to all queries */
  filter?: FilterExpression;
  /** Whether to include vectors in results */
  includeVectors?: boolean;
  /** Embedding model to use (default: minilm) */
  model?: EmbeddingModel;
}

/**
 * Response from a batch text query operation.
 */
export interface BatchTextQueryResponse {
  /** Results for each query */
  results: TextSearchResult[][];
  /** Embedding model used */
  model: EmbeddingModel;
  /** Time spent generating all embeddings in milliseconds */
  embedding_time_ms: number;
  /** Time spent on all searches in milliseconds */
  search_time_ms: number;
}

// =============================================================================
// Namespace Configuration Types (v0.6.0)
// =============================================================================

/**
 * Request body for ``PUT /v1/namespaces/:namespace`` (upsert semantics).
 *
 * Creates the namespace if it does not exist, or updates its configuration
 * if it already exists.
 */
export interface ConfigureNamespaceRequest {
  /** Vector dimension. Required on creation; must match on update. */
  dimension: number;
  /** Distance metric (default: cosine). */
  distance?: DistanceMetric;
}

/**
 * Response from ``PUT /v1/namespaces/:namespace``.
 */
export interface ConfigureNamespaceResponse {
  /** Namespace name. */
  namespace: string;
  /** Vector dimension. */
  dimension: number;
  /** Distance metric in use. */
  distance: DistanceMetric;
  /** ``true`` if the namespace was newly created; ``false`` if it already existed. */
  created: boolean;
}

// =============================================================================
// Memory Types
// =============================================================================

/** Memory type classification */
export type MemoryType = 'episodic' | 'semantic' | 'procedural' | 'strategic';

/** Request to store a memory */
export interface StoreMemoryRequest {
  /** Memory content */
  content: string;
  /** Type of memory */
  memory_type?: MemoryType;
  /** Importance score (0-1) */
  importance?: number;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
  /** TTL in seconds — memory is hard-deleted after this many seconds from creation */
  ttl_seconds?: number;
  /**
   * Explicit expiry as a Unix timestamp (seconds).
   * Takes precedence over `ttl_seconds` when both are provided.
   * The memory is hard-deleted by the decay engine on expiry (DECAY-3).
   */
  expires_at?: number;
  /** Associated session ID */
  session_id?: string;
  /** Pre-computed embedding */
  embedding?: number[];
}

/** A stored memory */
export interface Memory {
  /** Memory ID */
  id: MemoryId;
  /** Memory content */
  content: string;
  /** Memory type */
  memory_type: string;
  /** Importance score */
  importance: number;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
  /** Creation timestamp */
  created_at?: string;
  /** Last update timestamp */
  updated_at?: string;
  /** Access count */
  access_count?: number;
}

/** A recalled memory with similarity score */
export interface RecalledMemory {
  /** Memory ID */
  id: MemoryId;
  /** Memory content */
  content: string;
  /** Memory type */
  memory_type: string;
  /** Importance score */
  importance: number;
  /** Similarity score */
  score: number;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
  /** Creation timestamp */
  created_at?: string;
}

/** Response from storing a memory */
export interface StoreMemoryResponse {
  /** Created memory ID */
  memory_id: MemoryId;
  /** Status */
  status: string;
}

/** Request to update a memory */
export interface UpdateMemoryRequest {
  /** Updated content */
  content?: string;
  /** Updated metadata */
  metadata?: Record<string, unknown>;
  /** Updated type */
  memory_type?: MemoryType;
}

/** Request to recall memories */
export interface RecallRequest {
  /** Natural language query */
  query: string;
  /** Number of results */
  top_k?: number;
  /** Filter by memory type */
  memory_type?: string;
  /** Minimum importance threshold */
  min_importance?: number;
}

/** Request to update importance */
export interface UpdateImportanceRequest {
  /** Memory IDs to update */
  memory_ids: MemoryId[];
  /** New importance value */
  importance: number;
}

/** Request to consolidate memories */
export interface ConsolidateRequest {
  /** Filter by memory type */
  memory_type?: string;
  /** Similarity threshold */
  threshold?: number;
  /** Dry run mode */
  dry_run?: boolean;
}

/** Response from consolidation */
export interface ConsolidateResponse {
  /** Number of memories consolidated */
  consolidated_count: number;
  /** Number of memories removed */
  removed_count: number;
  /** IDs of new consolidated memories */
  new_memories: MemoryId[];
}

/** Request for memory feedback */
export interface MemoryFeedbackRequest {
  /** Memory ID */
  memory_id: MemoryId;
  /** Feedback text */
  feedback: string;
  /** Optional relevance score */
  relevance_score?: number;
}

/** Response from feedback */
export interface MemoryFeedbackResponse {
  /** Status */
  status: string;
  /** Updated importance */
  updated_importance?: number;
}

// =============================================================================
// Session Types
// =============================================================================

/** Request to start a session */
export interface StartSessionRequest {
  /** Agent ID */
  agent_id: AgentId;
  /** Optional session metadata */
  metadata?: Record<string, unknown>;
}

/** A session */
export interface Session {
  /** Session ID */
  session_id: SessionId;
  /** Agent ID */
  agent_id: AgentId;
  /** Start timestamp */
  started_at?: string;
  /** End timestamp */
  ended_at?: string;
  /** Session metadata */
  metadata?: Record<string, unknown>;
}

/** Options for listing sessions */
export interface ListSessionsOptions {
  /** Filter by agent ID */
  agent_id?: string;
  /** Only active sessions */
  active_only?: boolean;
  /** Result limit */
  limit?: number;
  /** Result offset */
  offset?: number;
}

// =============================================================================
// Agent Types
// =============================================================================

/** Summary info for an agent */
export interface AgentSummary {
  /** Agent ID */
  agent_id: AgentId;
  /** Total memory count */
  memory_count: number;
  /** Total session count */
  session_count: number;
  /** Active session count */
  active_sessions: number;
}

/** Detailed stats for an agent */
export interface AgentStats {
  /** Agent ID */
  agent_id: AgentId;
  /** Total memory count */
  total_memories: number;
  /** Memories grouped by type */
  memories_by_type: Record<string, number>;
  /** Total session count */
  total_sessions: number;
  /** Active session count */
  active_sessions: number;
  /** Average importance score */
  avg_importance?: number;
  /** Oldest memory timestamp */
  oldest_memory_at?: string;
  /** Newest memory timestamp */
  newest_memory_at?: string;
}

// =============================================================================
// Knowledge Graph Types
// =============================================================================

/** Request to build a knowledge graph */
export interface KnowledgeGraphRequest {
  agent_id: AgentId;
  memory_id?: MemoryId;
  depth?: number;
  min_similarity?: number;
}

/** A node in the knowledge graph */
export interface KnowledgeNode {
  id: MemoryId;
  content: string;
  memory_type?: string;
  importance?: number;
  metadata?: Record<string, unknown>;
}

/** An edge in the knowledge graph */
export interface KnowledgeEdge {
  source: MemoryId;
  target: MemoryId;
  similarity: number;
  relationship?: string;
}

/** Response from knowledge graph operations */
export interface KnowledgeGraphResponse {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  clusters?: string[][];
}

/** Request for full knowledge graph */
export interface FullKnowledgeGraphRequest {
  agent_id: AgentId;
  max_nodes?: number;
  min_similarity?: number;
  cluster_threshold?: number;
  max_edges_per_node?: number;
}

/** Request to summarize memories */
export interface SummarizeRequest {
  agent_id: AgentId;
  memory_ids?: MemoryId[];
  target_type?: string;
  dry_run?: boolean;
}

/** Response from summarization */
export interface SummarizeResponse {
  summary: string;
  source_count: number;
  new_memory_id?: MemoryId;
}

/** Request to deduplicate memories */
export interface DeduplicateRequest {
  agent_id: AgentId;
  threshold?: number;
  memory_type?: string;
  dry_run?: boolean;
}

/** Response from deduplication */
export interface DeduplicateResponse {
  duplicates_found: number;
  removed_count: number;
  groups: string[][];
}

// =============================================================================
// Analytics Types
// =============================================================================

/** Analytics overview response */
export interface AnalyticsOverview {
  total_queries: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  queries_per_second: number;
  error_rate: number;
  cache_hit_rate: number;
  storage_used_bytes: number;
  total_vectors: number;
  total_namespaces: number;
  uptime_seconds: number;
}

/** Latency analytics response */
export interface LatencyAnalytics {
  period: string;
  avg_ms: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  max_ms: number;
  by_operation?: Record<string, { avg_ms: number; p95_ms: number; count: number }>;
}

/** Throughput analytics response */
export interface ThroughputAnalytics {
  period: string;
  total_operations: number;
  operations_per_second: number;
  by_operation?: Record<string, number>;
}

/** Storage analytics response */
export interface StorageAnalytics {
  total_bytes: number;
  index_bytes: number;
  data_bytes: number;
  by_namespace?: Record<string, { bytes: number; vector_count: number }>;
}

/** Options for analytics queries */
export interface AnalyticsOptions {
  period?: string;
  namespace?: string;
}

// =============================================================================
// Advanced Search Types
// =============================================================================

/** Request for multi-vector search */
export interface MultiVectorSearchRequest {
  /** Positive vectors to search towards (required, at least one) */
  positiveVectors: number[][];
  /** Weights for positive vectors (optional, defaults to equal weights) */
  positiveWeights?: number[];
  /** Negative vectors to search away from (optional) */
  negativeVectors?: number[][];
  /** Weights for negative vectors (optional) */
  negativeWeights?: number[];
  /** Number of results to return */
  topK?: number;
  /** Distance metric to use */
  distanceMetric?: DistanceMetric;
  /** Minimum score threshold */
  scoreThreshold?: number;
  /** Enable MMR for diversity */
  enableMmr?: boolean;
  /** Lambda parameter for MMR (0 = max diversity, 1 = max relevance) */
  mmrLambda?: number;
}

/** Result from multi-vector search */
export interface MultiVectorSearchResult {
  /** Vector ID */
  id: string;
  /** Similarity score */
  score: number;
  /** Vector values (if requested) */
  values?: number[];
  /** Vector metadata */
  metadata?: Record<string, unknown>;
}

/** Response from multi-vector search */
export interface MultiVectorSearchResponse {
  /** Search results */
  results: MultiVectorSearchResult[];
  /** The computed query vector (weighted combination) */
  computed_query_vector?: number[];
}

/** Request for unified query */
export interface UnifiedQueryRequest {
  /** How to rank documents (required) - can be vector, text, or combined */
  rankBy: unknown;
  /** Number of results to return */
  topK?: number;
  /** Optional metadata filter */
  filter?: FilterExpression;
  /** Include metadata in results */
  includeMetadata?: boolean;
  /** Include vectors in results */
  includeVectors?: boolean;
  /** Distance metric for vector search */
  distanceMetric?: DistanceMetric;
}

/** Result from unified query */
export interface UnifiedSearchResult {
  /** Vector ID */
  id: string;
  /** Ranking score */
  score: number;
  /** Vector values (if requested) */
  values?: number[];
  /** Vector metadata */
  metadata?: Record<string, unknown>;
}

/** Response from unified query */
export interface UnifiedQueryResponse {
  /** Search results ordered by rank_by score */
  results: UnifiedSearchResult[];
  /** Cursor for pagination */
  next_cursor?: string;
}

/** Request for aggregation */
export interface AggregationRequest {
  /** Named aggregations to compute */
  aggregateBy: Record<string, unknown>;
  /** Fields to group results by (optional) */
  groupBy?: string[];
  /** Filter to apply before aggregation */
  filter?: FilterExpression;
  /** Maximum number of groups to return */
  limit?: number;
}

/** A single group in aggregation results */
export interface AggregationGroup {
  /** Group key values and aggregation results */
  [key: string]: unknown;
}

/** Response from aggregation */
export interface AggregationResponse {
  /** Aggregation results (without grouping) */
  aggregations?: Record<string, unknown>;
  /** Grouped aggregation results (with group_by) */
  aggregation_groups?: AggregationGroup[];
}

/** Request for vector export */
export interface ExportRequest {
  /** Maximum number of vectors per page (default: 1000, max: 10000) */
  topK?: number;
  /** Cursor for pagination */
  cursor?: string;
  /** Include vector values in response */
  includeVectors?: boolean;
  /** Include metadata in response */
  includeMetadata?: boolean;
}

/** An exported vector */
export interface ExportedVector {
  /** Vector ID */
  id: string;
  /** Vector values */
  values?: number[];
  /** Vector metadata */
  metadata?: Record<string, unknown>;
}

/** Response from export */
export interface ExportResponse {
  /** Exported vectors for this page */
  vectors: ExportedVector[];
  /** Cursor for next page (null if last page) */
  next_cursor?: string;
  /** Total vectors in namespace */
  total_count: number;
  /** Number of vectors returned in this page */
  returned_count: number;
}

/** Request for query explain */
export interface QueryExplainRequest {
  /** Type of query to explain */
  queryType?: 'vector_search' | 'full_text_search' | 'hybrid_search';
  /** Query vector (for vector searches) */
  vector?: number[];
  /** Number of results to return */
  topK?: number;
  /** Optional metadata filter */
  filter?: FilterExpression;
  /** Optional text query for hybrid/fulltext search */
  textQuery?: string;
  /** Distance metric */
  distanceMetric?: string;
  /** Whether to actually execute the query */
  execute?: boolean;
  /** Include verbose output */
  verbose?: boolean;
}

/** Response from query explain */
export interface QueryExplainResponse {
  /** Query type being explained */
  query_type: string;
  /** Namespace being queried */
  namespace: string;
  /** Index selection information */
  index_selection: Record<string, unknown>;
  /** Query execution stages */
  stages: Record<string, unknown>[];
  /** Cost estimates */
  cost_estimate: Record<string, unknown>;
  /** Actual execution stats (if execute=true) */
  actual_stats?: Record<string, unknown>;
  /** Performance recommendations */
  recommendations: Record<string, unknown>[];
  /** Query plan summary */
  summary: string;
  /** Raw query parameters */
  query_params: Record<string, unknown>;
}

/** Request for column-format upsert */
export interface ColumnUpsertRequest {
  /** Array of vector IDs */
  ids: string[];
  /** Array of vectors */
  vectors: number[][];
  /** Additional attributes as columns */
  attributes?: Record<string, unknown[]>;
  /** TTL in seconds */
  ttlSeconds?: number;
  /** Expected dimension */
  dimension?: number;
}

// =============================================================================
// SSE Streaming Event Types (CE-1)
// =============================================================================

/** Operation status for ``operation_progress`` events. */
export type OpStatus = 'pending' | 'running' | 'completed' | 'failed';

/** Vector mutation operation type for ``vectors_mutated`` events. */
export type VectorMutationOp = 'upserted' | 'deleted';

/** A namespace was created. */
export interface NamespaceCreatedEvent {
  type: 'namespace_created';
  namespace: string;
  dimension: number;
}

/** A namespace was deleted. */
export interface NamespaceDeletedEvent {
  type: 'namespace_deleted';
  namespace: string;
}

/** Progress update for a long-running operation (0–100). */
export interface OperationProgressEvent {
  type: 'operation_progress';
  operation_id: string;
  namespace?: string;
  op_type: string;
  /** Progress percentage 0–100 */
  progress: number;
  status: OpStatus;
  message?: string;
  /** Unix milliseconds */
  updated_at: number;
}

/** A background job changed status. */
export interface JobProgressEvent {
  type: 'job_progress';
  job_id: string;
  job_type: string;
  namespace?: string;
  progress: number;
  status: string;
}

/** Vectors were upserted or deleted in bulk (threshold: >100 vectors). */
export interface VectorsMutatedEvent {
  type: 'vectors_mutated';
  namespace: string;
  op: VectorMutationOp;
  count: number;
}

/**
 * Subscriber fell too far behind — some events were dropped.
 * Reconnect to resume the stream.
 */
export interface StreamLaggedEvent {
  type: 'stream_lagged';
  dropped: number;
  hint: string;
}

/** Union of all Dakera SSE event types. */
export type DakeraEvent =
  | NamespaceCreatedEvent
  | NamespaceDeletedEvent
  | OperationProgressEvent
  | JobProgressEvent
  | VectorsMutatedEvent
  | StreamLaggedEvent;

// =============================================================================
// DASH-B: Memory Event Types (SSE stream — GET /v1/events/stream)
// =============================================================================

/**
 * A memory lifecycle event emitted on the agent memory SSE stream.
 *
 * event_type values:
 *   connected | stored | recalled | forgotten | consolidated |
 *   importance_updated | session_started | session_ended | stream_lagged
 *
 * The `connected` event is emitted immediately on stream subscription to
 * signal the connection is live. `agent_id` will be an empty string for
 * `connected` events.
 */
export interface MemoryEvent {
  /** Memory lifecycle event type */
  event_type: string;
  /** Agent that owns the memory (empty string for the `connected` handshake) */
  agent_id: string;
  /** Unix milliseconds */
  timestamp: number;
  /** Memory ID (present for most event types) */
  memory_id?: string;
  /** Memory content snapshot */
  content?: string;
  /** Importance score at the time of the event */
  importance?: number;
  /** Tags associated with the memory */
  tags?: string[];
  /** Session ID (present for session_started / session_ended events) */
  session_id?: string;
}

// =============================================================================
// DASH-A: Cross-Agent Network Types (POST /v1/knowledge/network/cross-agent)
// =============================================================================

/** Summary info for one agent in the cross-agent network */
export interface AgentNetworkInfo {
  agent_id: string;
  memory_count: number;
  avg_importance: number;
}

/** A node in the cross-agent memory network graph */
export interface AgentNetworkNode {
  id: string;
  agent_id: string;
  content: string;
  importance: number;
  tags: string[];
  memory_type: string;
  /** Unix milliseconds */
  created_at: number;
}

/** A cross-agent similarity edge */
export interface AgentNetworkEdge {
  source: string;
  target: string;
  source_agent: string;
  target_agent: string;
  similarity: number;
}

/** Aggregate statistics for the cross-agent network */
export interface AgentNetworkStats {
  total_agents: number;
  total_nodes: number;
  total_cross_edges: number;
  density: number;
}

/** Response from the cross-agent network endpoint */
export interface CrossAgentNetworkResponse {
  agents: AgentNetworkInfo[];
  nodes: AgentNetworkNode[];
  edges: AgentNetworkEdge[];
  stats: AgentNetworkStats;
  /** Total number of memory nodes in the network (added in server v0.6.2). */
  node_count: number;
}

/** Request body for POST /v1/knowledge/network/cross-agent */
export interface CrossAgentNetworkRequest {
  /** Agent IDs to include — undefined means all agents */
  agent_ids?: string[];
  /** Minimum similarity threshold for edges (default 0.3) */
  min_similarity?: number;
  /** Maximum nodes to include per agent (default 50) */
  max_nodes_per_agent?: number;
  /** Minimum importance for a node to be included (default 0.0) */
  min_importance?: number;
  /** Maximum cross-agent edges to return (default 200) */
  max_cross_edges?: number;
}

// =============================================================================
// Admin Types
// =============================================================================

/** Ops stats response — Read-scoped; works with read-only API keys */
export interface OpsStats {
  version: string;
  total_vectors: number;
  namespace_count: number;
  uptime_seconds: number;
  timestamp: number;
}

/** Cluster status response */
export interface ClusterStatus {
  status: string;
  nodes: number;
  healthy: boolean;
  version?: string;
}

/** Cluster node info */
export interface ClusterNode {
  id: string;
  address: string;
  status: string;
  role?: string;
}

/** Cache statistics */
export interface CacheStats {
  total_entries: number;
  hit_rate: number;
  memory_bytes: number;
}

/** Slow query info */
export interface SlowQuery {
  query: string;
  duration_ms: number;
  timestamp: string;
  namespace?: string;
}

/** Backup info */
export interface BackupInfo {
  id: string;
  created_at: string;
  size_bytes: number;
  status: string;
  include_data: boolean;
}

/** TTL configuration */
export interface TtlConfig {
  namespace: string;
  ttl_seconds: number;
  strategy?: string;
}

// =============================================================================
// AutoPilot Types (PILOT-1 / PILOT-2 / PILOT-3)
// =============================================================================

/** AutoPilot configuration */
export interface AutoPilotConfig {
  enabled: boolean;
  dedup_threshold: number;
  dedup_interval_hours: number;
  consolidation_interval_hours: number;
}

/** Result snapshot from a deduplication cycle */
export interface DedupResultSnapshot {
  namespaces_processed: number;
  memories_scanned: number;
  duplicates_removed: number;
}

/** Result snapshot from a consolidation cycle */
export interface ConsolidationResultSnapshot {
  namespaces_processed: number;
  memories_scanned: number;
  clusters_merged: number;
  memories_consolidated: number;
}

/** PILOT-1: AutoPilot status response */
export interface AutoPilotStatusResponse {
  config: AutoPilotConfig;
  last_dedup_at?: number;
  last_consolidation_at?: number;
  last_dedup?: DedupResultSnapshot;
  last_consolidation?: ConsolidationResultSnapshot;
  total_dedup_removed: number;
  total_consolidated: number;
}

/** PILOT-2: AutoPilot configuration update request (all fields optional) */
export interface AutoPilotConfigRequest {
  enabled?: boolean;
  dedup_threshold?: number;
  dedup_interval_hours?: number;
  consolidation_interval_hours?: number;
}

/** PILOT-2: AutoPilot configuration update response */
export interface AutoPilotConfigResponse {
  success: boolean;
  config: AutoPilotConfig;
  message: string;
}

/** PILOT-3: Trigger action */
export type AutoPilotTriggerAction = 'dedup' | 'consolidate' | 'all';

/** Dedup result from a manual trigger */
export interface AutoPilotDedupResult {
  namespaces_processed: number;
  memories_scanned: number;
  duplicates_removed: number;
}

/** Consolidation result from a manual trigger */
export interface AutoPilotConsolidationResult {
  namespaces_processed: number;
  memories_scanned: number;
  clusters_merged: number;
  memories_consolidated: number;
}

/** PILOT-3: Trigger response */
export interface AutoPilotTriggerResponse {
  success: boolean;
  action: AutoPilotTriggerAction;
  dedup?: AutoPilotDedupResult;
  consolidation?: AutoPilotConsolidationResult;
  message: string;
}

// =============================================================================
// Decay Engine Types (DECAY-1 / DECAY-2)
// =============================================================================

/** Response from GET /v1/admin/decay/config (DECAY-1) */
export interface DecayConfigResponse {
  /** Decay strategy: "exponential", "linear", or "step" */
  strategy: 'exponential' | 'linear' | 'step';
  /** Half-life in hours */
  half_life_hours: number;
  /** Minimum importance threshold; memories below are hard-deleted on next cycle */
  min_importance: number;
}

/** Request for PUT /v1/admin/decay/config (DECAY-1) */
export interface DecayConfigUpdateRequest {
  /** Decay strategy: "exponential", "linear", or "step" */
  strategy?: 'exponential' | 'linear' | 'step';
  /** Half-life in hours (must be > 0) */
  half_life_hours?: number;
  /** Minimum importance threshold 0.0–1.0 */
  min_importance?: number;
}

/** Response from PUT /v1/admin/decay/config (DECAY-1) */
export interface DecayConfigUpdateResponse {
  success: boolean;
  config: DecayConfigResponse;
  message: string;
}

/** Stats from a single decay cycle */
export interface LastDecayCycleStats {
  namespaces_processed: number;
  memories_processed: number;
  memories_decayed: number;
  memories_deleted: number;
}

/** Response from GET /v1/admin/decay/stats (DECAY-2) */
export interface DecayStatsResponse {
  /** Total memories whose importance was lowered by decay (all-time) */
  total_decayed: number;
  /** Total memories hard-deleted by decay or TTL expiry (all-time) */
  total_deleted: number;
  /** Unix timestamp of the last decay cycle (undefined if never run) */
  last_run_at?: number;
  /** Number of decay cycles completed since startup */
  cycles_run: number;
  /** Stats from the most recent decay cycle (undefined if never run) */
  last_cycle?: LastDecayCycleStats;
}

// =============================================================================
// API Key Types
// =============================================================================

/** API key */
export interface ApiKey {
  id: string;
  name: string;
  key?: string;
  permissions?: string[];
  created_at: string;
  expires_at?: string;
  active: boolean;
}

/** Request to create an API key */
export interface CreateKeyRequest {
  name: string;
  permissions?: string[];
  expires_at?: string;
}

/** API key usage statistics */
export interface KeyUsage {
  key_id: string;
  total_requests: number;
  last_used?: string;
  requests_by_endpoint?: Record<string, number>;
}

// ============================================================================
// OPS-1: Rate-Limit Headers
// ============================================================================

/**
 * Rate-limit and quota headers present on every API response (OPS-1).
 *
 * Fields are `undefined` when the server does not include the header
 * (e.g. non-namespaced endpoints where quota does not apply).
 */
export interface RateLimitHeaders {
  /** `X-RateLimit-Limit` — max requests allowed in the current window. */
  limit?: number;
  /** `X-RateLimit-Remaining` — requests left in the current window. */
  remaining?: number;
  /** `X-RateLimit-Reset` — Unix timestamp (seconds) when the window resets. */
  reset?: number;
  /** `X-Quota-Used` — namespace vectors / storage consumed. */
  quotaUsed?: number;
  /** `X-Quota-Limit` — namespace quota ceiling. */
  quotaLimit?: number;
}

// ============================================================================
// CE-2: Batch Recall / Forget
// ============================================================================

/**
 * Filter predicates for batch memory operations (CE-2).
 *
 * All fields are optional.  For `batchForget` at least one must be set
 * (server-side safety guard).
 */
export interface BatchMemoryFilter {
  /** Restrict to memories that carry **all** listed tags. */
  tags?: string[];
  /** Minimum importance (inclusive). */
  min_importance?: number;
  /** Maximum importance (inclusive). */
  max_importance?: number;
  /** Only memories created at or after this Unix timestamp (seconds). */
  created_after?: number;
  /** Only memories created before or at this Unix timestamp (seconds). */
  created_before?: number;
  /** Restrict to a specific memory type. */
  memory_type?: MemoryType;
  /** Restrict to memories from a specific session. */
  session_id?: string;
}

/** Request body for `POST /v1/memories/recall/batch`. */
export interface BatchRecallRequest {
  /** Agent whose memory namespace to search. */
  agent_id: string;
  /** Filter predicates to apply.  An empty object returns all memories up to `limit`. */
  filter?: BatchMemoryFilter;
  /** Maximum number of results to return (default: 100). */
  limit?: number;
}

/** Response from `POST /v1/memories/recall/batch`. */
export interface BatchRecallResponse {
  memories: Memory[];
  /** Total memories in the agent namespace. */
  total: number;
  /** Number of memories that passed the filter. */
  filtered: number;
}

/** Request body for `DELETE /v1/memories/forget/batch`. */
export interface BatchForgetRequest {
  /** Agent whose memory namespace to purge from. */
  agent_id: string;
  /** Filter predicates — **at least one must be set** (server safety guard). */
  filter: BatchMemoryFilter;
}

/** Response from `DELETE /v1/memories/forget/batch`. */
export interface BatchForgetResponse {
  deleted_count: number;
}
