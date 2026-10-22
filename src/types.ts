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

// ============================================================================
// Forward-compatible wire enums (R9 / DAK-10004)
//
// The server's registries grow over time and the capabilities contract says
// clients MUST ignore strings they do not know. Every wire enum below is
// therefore a `Known*` literal union (what this SDK declares — autocomplete,
// exhaustiveness in *your* code) widened with `(string & {})` so a newer server
// string type-checks and never fails at runtime. Use the `isKnown*` guards to
// narrow.
// ============================================================================

/** Distance metrics this SDK declares. */
export type KnownDistanceMetric = 'cosine' | 'euclidean' | 'dot_product';
/** Distance metric for similarity search — a known value or any newer server string. */
export type DistanceMetric = KnownDistanceMetric | (string & {});
export const KNOWN_DISTANCE_METRICS: readonly KnownDistanceMetric[] = [
  'cosine',
  'euclidean',
  'dot_product',
];
export function isKnownDistanceMetric(value: unknown): value is KnownDistanceMetric {
  return (KNOWN_DISTANCE_METRICS as readonly unknown[]).includes(value);
}

/** Index kinds this SDK declares (server storage keys; `index_type` values). */
export type KnownIndexKind = 'hnsw' | 'pq' | 'ivf' | 'ivfpq' | 'spfresh' | 'fulltext';
/** An index kind — a known value or any newer server string. */
export type IndexKind = KnownIndexKind | (string & {});
export const KNOWN_INDEX_KINDS: readonly KnownIndexKind[] = [
  'hnsw',
  'pq',
  'ivf',
  'ivfpq',
  'spfresh',
  'fulltext',
];
export function isKnownIndexKind(value: unknown): value is KnownIndexKind {
  return (KNOWN_INDEX_KINDS as readonly unknown[]).includes(value);
}

/** Vector search modes this SDK declares (`DAKERA_SEARCH_MODE`; process-wide on the server). */
export type KnownSearchMode = 'hybrid' | 'binary' | 'float' | 'scalar' | 'rabitq';
/** A search mode — a known value or any newer server string. */
export type SearchMode = KnownSearchMode | (string & {});
export const KNOWN_SEARCH_MODES: readonly KnownSearchMode[] = [
  'hybrid',
  'binary',
  'float',
  'scalar',
  'rabitq',
];
export function isKnownSearchMode(value: unknown): value is KnownSearchMode {
  return (KNOWN_SEARCH_MODES as readonly unknown[]).includes(value);
}

/** Record representation kinds this SDK declares (R2 records surface). */
export type KnownRepresentationKind = 'dense' | 'token_multivector' | 'patch_multivector';
/** A representation kind — a known value or any newer server string. */
export type RepresentationKind = KnownRepresentationKind | (string & {});
export const KNOWN_REPRESENTATION_KINDS: readonly KnownRepresentationKind[] = [
  'dense',
  'token_multivector',
  'patch_multivector',
];
export function isKnownRepresentationKind(value: unknown): value is KnownRepresentationKind {
  return (KNOWN_REPRESENTATION_KINDS as readonly unknown[]).includes(value);
}

/** Record block dtypes this SDK declares (`store_as` encodings). */
export type KnownBlockDType = 'f32' | 'f16' | 'i8';
/** A block dtype — a known value or any newer server string. */
export type BlockDType = KnownBlockDType | (string & {});
export const KNOWN_BLOCK_DTYPES: readonly KnownBlockDType[] = ['f32', 'f16', 'i8'];
export function isKnownBlockDType(value: unknown): value is KnownBlockDType {
  return (KNOWN_BLOCK_DTYPES as readonly unknown[]).includes(value);
}

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

/** Known namespace kinds (server v0.12.2+). */
export type KnownNamespaceKind = 'agent' | 'data' | 'system';

/**
 * What a namespace is (server v0.12.2+): `agent` (an agent's memory namespace,
 * `_dakera_agent_<id>`), `data` (a client namespace) or `system`
 * (server-internal, only on `/admin/namespaces`). Widened so a newer server's
 * kind type-checks.
 */
export type NamespaceKind = KnownNamespaceKind | (string & {});

/** Runtime list of the namespace kinds this SDK declares. */
export const KNOWN_NAMESPACE_KINDS: readonly KnownNamespaceKind[] = ['agent', 'data', 'system'];

/** Whether `value` is a namespace kind this SDK declares. */
export function isKnownNamespaceKind(value: unknown): value is KnownNamespaceKind {
  return (KNOWN_NAMESPACE_KINDS as readonly unknown[]).includes(value);
}

/** Information about a namespace */
export interface NamespaceInfo {
  namespace: string;
  vector_count: number;
  dimension?: number;
  /**
   * Server v0.12.2+: what the namespace is (`GET /v1/namespaces/{ns}` `kind`,
   * and the `kinds` map of `GET /v1/namespaces`). Absent on older servers.
   */
  kind?: NamespaceKind;
}

/**
 * A namespace a node-wide endpoint left out of its answer (server v0.12.2+):
 * it errored or did not answer within the per-namespace deadline (2 s). Its
 * records are not in the totals of that response. `reason` never carries
 * paths, URLs or credentials.
 */
export interface UnavailableNamespace {
  namespace: string;
  reason: string;
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
  text: string;
  metadata?: Record<string, unknown>;
}

/** Input for document operations */
export type DocumentInput = Document | {
  id: VectorId | string;
  text: string;
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
  /** Git commit SHA baked into the binary at build time. Available since server v0.11.84. */
  build_sha?: string;
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
  /** Contains substring (case-sensitive) */
  $contains?: string;
  /** Contains substring (case-insensitive) */
  $icontains?: string;
  /** Starts with prefix */
  $startsWith?: string;
  /** Ends with suffix */
  $endsWith?: string;
  /** Glob pattern matching (supports * and ? wildcards) */
  $glob?: string;
  /** Regular expression matching */
  $regex?: string;
  /** Array field contains a value */
  $arrayContains?: unknown;
  /** Array field contains all specified values */
  $arrayContainsAll?: unknown[];
  /** Array field contains any of the specified values */
  $arrayContainsAny?: unknown[];
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
  /**
   * API key for authentication, sent as `Authorization: Bearer <key>` (never
   * in a URL). The client keeps it in a private field: it does not appear in
   * `JSON.stringify(client)`, `console.log(client)` or in any error the SDK
   * throws.
   *
   * **Browsers:** a key given to code running in a browser is readable by
   * anyone who can open the page (devtools, extensions, XSS). Keep keys on a
   * server: call Dakera from your backend, or put a proxy in front that adds
   * the key server-side (the Dakera dashboard does this), and construct the
   * browser client without `apiKey`.
   */
  apiKey?: string;
  /**
   * Timeout in milliseconds for one attempt of a request, from sending it to
   * reading the whole response body (default: 30000). On expiry the request is
   * aborted (AbortController) and a `TimeoutError` is thrown.
   */
  timeout?: number;
  /**
   * Bound in milliseconds for one attempt when shorter than `timeout`. `fetch`
   * has no separate connect phase, so the shorter of the two bounds the whole
   * attempt. Defaults to `timeout`.
   */
  connectTimeout?: number;
  /**
   * Maximum number of attempts per request (default: 3). Ignored when
   * `retryBackoff` is provided.
   *
   * Only safe retries are made: a 429, and a 503 (both mean the server did not
   * process the request), are retried for every method, honouring
   * `Retry-After` (capped at 60 s); other 5xx answers, timeouts and network
   * errors are retried only for idempotent requests (GET, HEAD, PUT, DELETE,
   * and read-only POST routes such as recall, search and query). Other 4xx
   * answers and 501 are never retried.
   */
  maxRetries?: number;
  /** Fine-grained retry and backoff configuration.
   *  When provided, `maxRetries` is ignored in favour of `retryBackoff.maxRetries`. */
  retryBackoff?: RetryConfig;
  /** Additional headers */
  headers?: Record<string, string>;
  /** Base URL of the dakera-ode sidecar (e.g. `"http://localhost:8080"`).
   *  Required to call {@link DakeraClient.extractEntities}.
   *  Note: requests to the ODE sidecar currently carry the Dakera API key
   *  (`Authorization` header); tracked in https://github.com/Dakera-AI/dakera/issues/924. */
  odeUrl?: string;
  /**
   * R9: validate the requested embedding model, index kind and distance metric
   * against `GET /v1/capabilities` *before* sending a request, throwing
   * `UnsupportedCapabilityError` that names what the server supports.
   * Capabilities are fetched lazily on first use and cached (see
   * {@link DakeraClient.capabilities}); a server that predates the endpoint
   * (404) disables the check silently. When `false` (default) the check still
   * runs whenever capabilities have already been fetched through `capabilities()`.
   */
  preflight?: boolean;
}

// =============================================================================
// Text-Based Inference Types (Auto-Embedding)
// =============================================================================

/**
 * Embedding models this SDK declares for text-based operations.
 * - bge-large: BGE-large - Best quality, server default (1024 dimensions)
 * - minilm: MiniLM-L6 - Fast, good quality (384 dimensions)
 * - bge-small: BGE-small - Balanced performance (384 dimensions)
 * - e5-small: E5-small - High quality (384 dimensions)
 * - modernbert-embed-base: ModernBERT-embed-base - 768 dimensions, MRL, 8192 tokens
 * - gte-modernbert-base: GTE-ModernBERT-base - 768 dimensions, MTEB retrieval 64.38
 * - bge-m3: BGE-M3 multilingual - 1024 dimensions, 8192-token window (server v0.12+)
 *
 * The list the *server* supports is authoritative — read it from
 * {@link DakeraClient.capabilities}.
 */
export type KnownEmbeddingModel =
  | 'bge-large'
  | 'minilm'
  | 'bge-small'
  | 'e5-small'
  | 'modernbert-embed-base'
  | 'gte-modernbert-base'
  | 'bge-m3';
/**
 * An embedding model — a known value or any newer server string (a newer
 * server may return a model this SDK does not declare; that must not fail).
 */
export type EmbeddingModel = KnownEmbeddingModel | (string & {});
export const KNOWN_EMBEDDING_MODELS: readonly KnownEmbeddingModel[] = [
  'bge-large',
  'minilm',
  'bge-small',
  'e5-small',
  'modernbert-embed-base',
  'gte-modernbert-base',
  'bge-m3',
];
export function isKnownEmbeddingModel(value: unknown): value is KnownEmbeddingModel {
  return (KNOWN_EMBEDDING_MODELS as readonly unknown[]).includes(value);
}

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

/**
 * Memory type classification. The server knows `episodic` (its default),
 * `semantic`, `procedural` and `working`; `strategic` is kept for source
 * compatibility but the server refuses it.
 */
export type MemoryType = 'episodic' | 'semantic' | 'procedural' | 'working' | 'strategic';

/**
 * When a memory's event happened (server v0.12.3+, `event_time` on
 * `POST /v1/memory/store` and on each `POST /v1/memories/store/batch` item):
 *
 * - a `number`: Unix **seconds** (a fractional part is dropped by the server;
 *   milliseconds are refused with a 400),
 * - a `string`: an RFC 3339 timestamp such as `2023-05-20T02:21:00Z`,
 * - a `Date`: sent as its ISO 8601 / RFC 3339 string (`toISOString()`).
 *
 * The bounds (1970 to 2286; a future time is accepted) are the server's: an
 * out-of-range value is a 400 naming the field. The SDK only refuses values
 * that are not a time at all (`NaN`, an invalid `Date`).
 */
export type EventTime = number | string | Date;

/**
 * How the embedding model cut a memory's text (server v0.12.3+,
 * Dakera-AI/dakera#933): the vector covers its first `embedded_tokens` only.
 * Flattened into the store and update responses; every field is absent when
 * the model reads the whole text (and on older servers).
 */
export interface EmbedTruncationReport {
  /** `true` when the text is longer than the embedding model reads. */
  truncated?: boolean;
  /** Tokens of the whole text (document prefix and special tokens included). */
  content_tokens?: number;
  /** Tokens the model embedded: the vector covers this prefix of the text. */
  embedded_tokens?: number;
  /** The model's token cap (`effective_max_seq_length` in `capabilities()`). */
  max_tokens?: number;
  /** The counts are the server's model-free estimate (the model is not loaded on that node). Absent = false. */
  tokens_estimated?: boolean;
  /**
   * Overlapping windows of the text derived as sub-memories so its tail is
   * searchable (`DAKERA_LONG_CONTENT_WINDOWS`); `0` with that switch off.
   */
  windows?: number;
}

/** One memory of a batch whose text the embedding model cut (`BatchStoreMemoryResponse.truncated`). */
export interface TruncatedMemory {
  /** The memory's id. */
  id: MemoryId;
  /** Always `true`. */
  truncated: boolean;
  content_tokens: number;
  embedded_tokens: number;
  max_tokens: number;
  /** Absent = false. */
  tokens_estimated?: boolean;
  windows: number;
}

/** Request to store a memory */
export interface StoreMemoryRequest {
  /**
   * Memory content. Server v0.12.2 limits it in UTF-8 **bytes**
   * (`DAKERA_MAX_MEMORY_CONTENT_BYTES`, default 100000; 400 above).
   */
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
  /** Optional tags to associate with the memory */
  tags?: string[];
  /**
   * Optional custom memory id (the server generates one when omitted). A
   * re-store of an existing id is a full replacement.
   */
  id?: string;
  /**
   * Server v0.12.3+ (Dakera-AI/dakera#932): when the memory's event HAPPENED,
   * for a client that writes history (an import, a backfill, a replayed
   * conversation). See {@link EventTime}. The server records it as the
   * server-owned metadata key `_dakera_event_time` (integer Unix seconds, also
   * the event date `_dakera_content_date` unless the metadata names one);
   * recency, `since` / `until`, the query-inferred time range and the
   * temporal graph edges then read it instead of the ingest time.
   * `created_at` stays the ingest time (TTL and decay count from it). Out of
   * the server's bounds (before 1970, after 2286): 400 naming the field. A
   * client cannot set `_dakera_event_time` in `metadata` itself. Not sent when
   * undefined; older servers ignore it.
   */
  event_time?: EventTime;
  /**
   * @deprecated No server reads a pre-computed embedding on a memory store
   * (the server embeds `content` itself), so the SDK does not send it.
   */
  embedding?: number[];
  /**
   * @deprecated Use {@link StoreMemoryRequest.event_time}. Bi-temporal validity
   * start (Unix seconds). The server reads it from the memory's metadata, not
   * from the request, so the SDK sends it as `metadata.valid_from` (an explicit
   * `metadata.valid_from` wins). Before 0.12.3 the SDK sent it at the top level,
   * where no server read it.
   */
  valid_from?: number;
  /**
   * v0.12: language of `content` (ISO 639-1 code, English or native name,
   * optionally with a region such as `pt-BR`). Selects the parsing of content
   * dates and rule-based entities and is recorded on the memory. Omitted: the
   * server-wide `DAKERA_QUERY_LANG` (default English). Unsupported: 400.
   * `GET /v1/capabilities` lists `query_languages`.
   */
  lang?: string;
  /**
   * v0.12: `sha256:<hex>` reference of an attachment already uploaded to this
   * agent's namespace (`_dakera_agent_{agent_id}`). Needs `DAKERA_ATTACHMENTS`
   * on the server (else 501 FEATURE_DISABLED); an unknown reference is a 404.
   */
  attachment_ref?: string;
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
  /** The agent the memory belongs to. */
  agent_id?: string;
  /** The memory's session, when it has one. */
  session_id?: string;
  /** The memory's tags. */
  tags?: string[];
  /** Last access (Unix seconds). */
  last_accessed_at?: number;
  /** Time to live in seconds, when set. */
  ttl_seconds?: number;
  /** Expiry (Unix seconds), when set. */
  expires_at?: number;
  /** v0.12: the memory's attachment reference, when it has one. */
  attachment_ref?: string;
  /**
   * Server v0.12.2+, listings asked with `content_preview_chars` only: length
   * of the FULL content in characters (Unicode scalar values).
   */
  content_len?: number;
  /**
   * Server v0.12.2+, listings asked with `content_preview_chars` only: whether
   * `content` is a cut preview. Read the whole memory with `getMemory()` when
   * true.
   */
  content_truncated?: boolean;
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
  /**
   * Ranking score — the server's `rank_score` when present (v0.12.3+: non-increasing over a
   * recall's results, in order), else smart_score, then weighted_score, then raw score.
   */
  score: number;
  /**
   * The server's ranking field (recall, v0.12.3+, #940): non-increasing over `memories` in
   * response order — sort or threshold on this. Absent from older servers and from search.
   */
  rank_score?: number;
  /** Raw smart_score from the server. */
  smart_score?: number;
  /** Raw weighted_score from the server. */
  weighted_score?: number;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
  /** Creation timestamp */
  created_at?: string;
  /** KG-3: hop depth at which this memory was found (only set on associated memories) */
  depth?: number;
  /** Hybrid sub-score: vector similarity component (server v0.11.98+, absent when BM25-only) */
  vector_score?: number;
  /** Hybrid sub-score: BM25 text component (server v0.11.98+, absent when vector-only) */
  text_score?: number;
  /**
   * Server v0.12.2+, `agentMemories()` / `sessionMemories()` with
   * `content_preview_chars` only: length of the FULL content in characters.
   */
  content_len?: number;
  /**
   * Server v0.12.2+, with `content_preview_chars` only: whether `content` is a
   * cut preview (read the whole memory with `getMemory()` when true).
   */
  content_truncated?: boolean;
  /**
   * Server v0.12.3+: when derived sentence sub-memories are collapsed into
   * their source (server flag `DAKERA_RECALL_COLLAPSE_DERIVED`, default off),
   * the best-matching sentence, set when it outranked the source's own text.
   * The result itself (`id`, `content`) is then the source memory. Absent on
   * older servers and when nothing was collapsed.
   */
  matched_text?: string;
  /**
   * Server v0.12.3+: ids of the sentence sub-memories collapsed into this
   * result, best first. Absent when none matched (and on older servers).
   */
  matched_ids?: string[];
  /**
   * Server v0.12.3+: how the item got into the response when it is not a
   * ranked result — `"neighborhood"` for neighbourhood context returned inline
   * (`neighborhood_mode: "inline"`, after the `top_k` ranked results). Its
   * `score` is then the raw similarity of a different search and is NOT
   * comparable with the ranked results' scores. Absent on ranked results.
   */
  retrieval?: RecallRetrieval;
  /**
   * Server v0.12.3+: on a {@link RecallResponse.context_memories} entry,
   * the id of the ranked memory it is context for.
   */
  context_of?: MemoryId;
}

/**
 * Where a recall returns its neighbourhood context (session-adjacent memories
 * of the top results), server v0.12.3+ (`neighborhood_mode`):
 *
 * - `inline`: appended to `memories` after the `top_k` ranked results, each
 *   marked `retrieval: "neighborhood"` (the v0.11/v0.12 behaviour, and the
 *   server default unless `DAKERA_NEIGHBORHOOD_MODE` says otherwise);
 * - `separate`: `memories` holds at most `top_k` results and the context comes
 *   back in `context_memories`, each entry with `context_of`;
 * - `off`: no neighbourhood context.
 *
 * `neighborhood: false` still means `off` and wins over this field. Older
 * servers ignore the field (they behave as `inline`).
 */
export type NeighborhoodMode = 'inline' | 'separate' | 'off';
/** Every {@link NeighborhoodMode}. */
export const NEIGHBORHOOD_MODES: readonly NeighborhoodMode[] = ['inline', 'separate', 'off'];
/** Whether `value` is a {@link NeighborhoodMode}. */
export function isNeighborhoodMode(value: unknown): value is NeighborhoodMode {
  return (NEIGHBORHOOD_MODES as readonly unknown[]).includes(value);
}

/**
 * `RecalledMemory.retrieval`: `"neighborhood"` today; kept open for newer
 * server strings.
 */
export type RecallRetrieval = 'neighborhood' | (string & {});

/** What the cross-encoder did for one recall or search (server v0.12+). */
export interface RerankReport {
  /** The cross-encoder rescored candidates and its order was used. */
  applied: boolean;
  /** How many candidates it scored. */
  candidates: number;
  /**
   * Why it did not run (`disabled`, `bm25_routing`, `visual_lane`,
   * `no_candidates`, `no_query`, `unavailable`, `failed`), or why its order was
   * not used (`low_confidence`). Absent when it ran and was used.
   */
  skipped?: string;
  /**
   * Server v0.12.3+ (Dakera-AI/dakera#926): `true` when the server's candidate
   * cap (`DAKERA_RERANK_MAX_CANDIDATES`) left part of the pool unscored, or
   * lowered the request's `rerank_candidates` to it. Absent otherwise.
   */
  capped?: boolean;
}

/**
 * Options of {@link DakeraClient.recall} (`POST /v1/memory/recall`). Every
 * field is optional and left out of the request when `undefined`, so the
 * server default applies.
 */
export interface MemoryRecallOptions {
  /** v0.12: language of `query` (see {@link RecallRequest.lang}). */
  lang?: string;
  /**
   * Number of ranked results (server default 10). The ranking of the first `k`
   * results does not depend on `top_k` for `k <= 10` (server v0.12.3+).
   * Under `neighborhood_mode: "inline"` (the default) neighbourhood context is
   * appended AFTER these `top_k` results, so `memories` can be longer; ask for
   * `neighborhood_mode: "separate"` when `top_k` must be the maximum number of
   * results.
   */
  top_k?: number;
  /** Filter by memory type. */
  memory_type?: string;
  /** Recall within one session only. */
  session_id?: string;
  /** Only memories carrying these tags. */
  tags?: string[];
  /** Minimum importance threshold. */
  min_importance?: number;
  /** Importance-weighted re-ranking (server default `true`). */
  importance_weighted?: boolean;
  /** COG-2: include KG-linked memories in `associated_memories` (default false). */
  include_associated?: boolean;
  /** COG-2: max associated memories (default 10, max 10). */
  associated_memories_cap?: number;
  /** KG-3: traversal depth 1–3 (default 1); requires `include_associated`. */
  associated_memories_depth?: number;
  /** KG-3: minimum edge weight for KG traversal (default 0.0). */
  associated_memories_min_weight?: number;
  /** CE-7: only memories created at or after this ISO-8601 timestamp. */
  since?: string;
  /** CE-7: only memories created at or before this ISO-8601 timestamp. */
  until?: string;
  /** CE-10: retrieval routing mode (server default `auto`). */
  routing?: RoutingMode;
  /**
   * CE-13: rescore the candidate pool with the cross-encoder (server default
   * `true`). The pool is sized from the ranking depth (`max(top_k, 10)`): on
   * hybrid routing 10x that depth (not `top_k * 3`).
   */
  rerank?: boolean;
  /** Rerank at most this many candidates (server default: the whole pool). */
  rerank_candidates?: number;
  /** CE-14: fusion when routing is hybrid (server default `minmax`, not `rrf`). */
  fusion?: FusionStrategy;
  /** CE-17: explicit vector weight for hybrid routing (0.0–1.0). */
  vector_weight?: number;
  /** CE-23: pseudo-relevance feedback passes (1–3, default 1). */
  iterations?: number;
  /**
   * v0.11: fetch session-adjacent memories of the top results as context
   * (server default `true`). `false` means no neighbourhood whatever
   * `neighborhood_mode` says.
   */
  neighborhood?: boolean;
  /**
   * Server v0.12.3+: where the neighbourhood context goes — see
   * {@link NeighborhoodMode}. Omitted: the server default
   * (`DAKERA_NEIGHBORHOOD_MODE`, default `inline`).
   */
  neighborhood_mode?: NeighborhoodMode;
  /**
   * Server v0.12.3+: whether session-summary memories may be recalled.
   * Omitted: the server's choice (`DAKERA_RECALL_EXCLUDE_SUMMARIES`, default:
   * they may).
   */
  include_summaries?: boolean;
}

/** COG-2 / KG-3: Response from the recall endpoint with optional associative memories */
export interface RecallResponse {
  /**
   * Ranked memories (at most `top_k`), followed under
   * `neighborhood_mode: "inline"` by neighbourhood context items, each with
   * `retrieval: "neighborhood"`.
   */
  memories: RecalledMemory[];
  /** COG-2 / KG-3: KG associated memories at configurable depth (only present when include_associated was true) */
  associated_memories?: RecalledMemory[];
  /**
   * Server v0.12.3+, `neighborhood_mode: "separate"` only: neighbourhood
   * context of the ranked results, each entry with `context_of` (the ranked
   * memory it belongs to) and `retrieval: "neighborhood"`. Absent otherwise
   * and on older servers.
   */
  context_memories?: RecalledMemory[];
  /** Query embedding time in milliseconds. */
  query_embedding_time_ms?: number;
  /** Search time in milliseconds. */
  search_time_ms?: number;
  /** v0.12: what the cross-encoder did (same content as `rerank_report`). */
  rerank?: RerankReport;
  /** v0.12: what the cross-encoder did. */
  rerank_report?: RerankReport;
  /** Late-interaction strategy only: the first stage that served the recall. */
  late_interaction_first_stage?: string;
  /**
   * Server v0.12.3+ (Dakera-AI/dakera#938): request fields the server ignored
   * (`"unknown field 'x' ignored"`). Absent when it ignored nothing (and on
   * older servers). The SDK sends only fields the server knows.
   */
  warnings?: string[];
}

/**
 * Options of {@link DakeraClient.searchMemories} (`POST /v1/memory/search`).
 * Undefined fields are not sent.
 */
export interface SearchMemoriesOptions {
  /** v0.12: language of `query`. */
  lang?: string;
  /** Maximum results (server default 10; at most 500 with a query). */
  top_k?: number;
  /** Filter by memory type. */
  memory_type?: string;
  /** Only memories of this session. */
  session_id?: string;
  /** Only memories carrying these tags. */
  tags?: string[];
  /** Minimum importance. */
  min_importance?: number;
  /** Maximum importance. */
  max_importance?: number;
  /** Only memories created after this unix time (seconds). */
  created_after?: number;
  /** Only memories created before this unix time (seconds). */
  created_before?: number;
  /** Sort field: `created_at`, `last_accessed_at`, `importance`, `access_count`. */
  sort_by?: 'created_at' | 'last_accessed_at' | 'importance' | 'access_count';
  /** CE-10: retrieval routing mode. */
  routing?: RoutingMode;
  /** CE-13: cross-encoder reranking (server default `false` for search). */
  rerank?: boolean;
}

/** Response from storing a memory.
 *
 * The server wraps the created memory in a nested `memory` object:
 * `{"memory": {"id": "...", "agent_id": "...", ...}, "embedding_time_ms": N}`.
 */
export interface StoreMemoryResponse extends EmbedTruncationReport {
  /** The stored memory object */
  memory: Memory;
  /**
   * Server v0.12.3+ (Dakera-AI/dakera#938): request fields the server ignored.
   * Absent when it ignored nothing (and on older servers).
   */
  warnings?: string[];
  /** Embedding latency in milliseconds */
  embedding_time_ms?: number;
  /**
   * Server v0.12.2+: state of the session the memory was stored with (the
   * given `session_id`, or the agent's active session the server resolved).
   * `"ended"` means the store succeeded into a session that had already ended
   * (for example after the idle timeout). Absent without a started session.
   */
  session_state?: SessionState;
}

/**
 * Answer of `PUT /v1/memory/update/{id}`: the updated memory (its fields at
 * the top level, as before) and, server v0.12.3+, the truncation report of its
 * new content when that content was re-embedded and is longer than the
 * embedding model reads.
 */
export interface UpdateMemoryResponse extends Memory, EmbedTruncationReport {}

/** Request to update a memory */
export interface UpdateMemoryRequest {
  /** Updated content */
  content?: string;
  /** Updated metadata */
  metadata?: Record<string, unknown>;
  /** Updated type */
  memory_type?: MemoryType;
  /** Updated importance (0-1) */
  importance?: number;
  /** Replacement tags */
  tags?: string[];
  /** v0.12: language of the content (see {@link StoreMemoryRequest.lang}). */
  lang?: string;
}

/** Request to recall memories */
/**
 * Retrieval routing mode for recall and search (CE-10).
 *
 * Controls which retrieval index the server uses. `"auto"` (default) lets the
 * server pick the best strategy based on the query.
 */
export type KnownRoutingMode = 'auto' | 'vector' | 'bm25' | 'hybrid';
/** A routing mode — a known value or any newer server string. */
export type RoutingMode = KnownRoutingMode | (string & {});
export const KNOWN_ROUTING_MODES: readonly KnownRoutingMode[] = ['auto', 'vector', 'bm25', 'hybrid'];
export function isKnownRoutingMode(value: unknown): value is KnownRoutingMode {
  return (KNOWN_ROUTING_MODES as readonly unknown[]).includes(value);
}

/**
 * Fusion strategy for hybrid recall (CE-14).
 *
 * Controls how vector and BM25 scores are combined when `routing = "hybrid"`.
 * `"minmax"` (server default since v0.11.2) uses min-max score normalization;
 * `"rrf"` uses Reciprocal Rank Fusion (Cormack et al., SIGIR 2009).
 */
export type KnownFusionStrategy = 'rrf' | 'minmax';
/** A fusion strategy — a known value or any newer server string. */
export type FusionStrategy = KnownFusionStrategy | (string & {});
export const KNOWN_FUSION_STRATEGIES: readonly KnownFusionStrategy[] = ['rrf', 'minmax'];
export function isKnownFusionStrategy(value: unknown): value is KnownFusionStrategy {
  return (KNOWN_FUSION_STRATEGIES as readonly unknown[]).includes(value);
}

export interface RecallRequest extends MemoryRecallOptions {
  /** Natural language query */
  query: string;
  /** Number of results (server default 10). */
  top_k?: number;
  /** Filter by memory type */
  memory_type?: string;
  /** Minimum importance threshold */
  min_importance?: number;
  /** CE-7: only recall memories created at or after this ISO-8601 timestamp */
  since?: string;
  /** CE-7: only recall memories created at or before this ISO-8601 timestamp */
  until?: string;
  /** KG-3: traversal depth 1–3 (default: 1); requires include_associated */
  associated_memories_depth?: number;
  /** KG-3: minimum edge weight for KG traversal (default: 0.0) */
  associated_memories_min_weight?: number;
  /** CE-10: retrieval routing mode. Default: `"auto"` (server picks best strategy). */
  routing?: RoutingMode;
  /**
   * CE-13: enable cross-encoder reranking. Default: `undefined` (server uses
   * `true` for recall). The candidate pool is sized from the ranking depth
   * `max(top_k, 10)` — on hybrid routing 10x that depth, not `top_k * 3`.
   * Pass `false` to disable on latency-sensitive paths.
   */
  rerank?: boolean;
  /** CE-14: fusion strategy when routing=`"hybrid"`. Default: `undefined` (server uses `"minmax"` since v0.11.2; `"rrf"` is not the default). */
  fusion?: FusionStrategy;
  /** CE-17: explicit vector/BM25 weight for Hybrid routing (0.0–1.0). When set, overrides the adaptive heuristic from QueryClassifier. Omit for adaptive defaults (recommended). Only effective when `routing="hybrid"`. */
  vector_weight?: number;
  /** CE-23: pseudo-relevance feedback (PRF) passes for BM25 routing (1–3, default: 1). Pass `2` or `3` for multi-hop or temporal queries. Only effective when `routing="bm25"`. */
  iterations?: number;
  /** v0.11.0: session-adjacent memory enrichment (±5 min). Default: `undefined` (server uses `true`). Pass `false` to disable on latency-sensitive paths. */
  neighborhood?: boolean;
  /**
   * v0.12: language of `query` for rule-based routing and temporal expressions
   * (`"when", "how long ago"`). Does not translate or filter. Omitted: the
   * server-wide `DAKERA_QUERY_LANG`. Unsupported: 400.
   */
  lang?: string;
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
  /** Optional DBSCAN algorithm config (CE-6) */
  config?: ConsolidationConfig;
}

/** Response from consolidation */
export interface ConsolidateResponse {
  /** Number of source memories removed during consolidation */
  memories_removed: number;
  /** IDs of the source memories that were consolidated */
  source_memory_ids: MemoryId[];
  /** The resulting consolidated memory (if any) */
  consolidated_memory?: Memory;
  /** Step-by-step consolidation log (CE-6) */
  log?: ConsolidationLogEntry[];
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
  /** Optional caller-chosen session id */
  id?: string;
  /**
   * Server v0.12.2+: this session's idle timeout in seconds. `0` = never
   * ended for inactivity; at most 2592000 (30 days, 400 above). Omitted: the
   * server's timeout applies (`capabilities.sessions.idle_timeout_secs`,
   * 4 hours by default).
   */
  idle_timeout_secs?: number;
}

/** Options for {@link DakeraClient.startSession} beyond the agent and metadata. */
export interface StartSessionOptions {
  /** Caller-chosen session id (the server generates one when omitted). */
  id?: string;
  /**
   * Server v0.12.2+: idle timeout in seconds for this session (`0` = never
   * ended for inactivity, at most 2592000). Omitted: the server's timeout.
   * Not sent when undefined.
   */
  idle_timeout_secs?: number;
}

/** Options for {@link DakeraClient.endSession}. */
export interface EndSessionOptions {
  /**
   * Summary stored on the session. Server v0.12.2+ refuses a summary above the
   * memory content limit (`DAKERA_MAX_MEMORY_CONTENT_BYTES`, bytes) with 400.
   * Ignored when the session has already ended.
   */
  summary?: string;
  /** Let the server generate the summary from the session's memories. */
  auto_summarize?: boolean;
}

/** Known values of {@link Session.ended_reason}. */
export type KnownSessionEndedReason = 'client' | 'idle';

/**
 * Who ended a session (server v0.12.2+): `client` (`POST /v1/sessions/{id}/end`)
 * or `idle` (the server, after the idle timeout).
 */
export type SessionEndedReason = KnownSessionEndedReason | (string & {});

/** Known values of a session state on store / touch responses. */
export type KnownSessionState = 'active' | 'ended';

/** State of a session as the server reports it on store and touch responses (v0.12.2+). */
export type SessionState = KnownSessionState | (string & {});

/** A session */
export interface Session {
  /** Session ID */
  id: SessionId;
  /** Agent ID */
  agent_id: AgentId;
  /** Start timestamp (Unix epoch seconds) */
  started_at?: number;
  /** End timestamp (Unix epoch seconds) */
  ended_at?: number;
  /** Optional session summary */
  summary?: string;
  /** Session metadata */
  metadata?: Record<string, unknown>;
  /** Number of memories stored in this session */
  memory_count?: number;
  /**
   * Server v0.12.2+: the last activity the server knows of (Unix seconds): a
   * memory stored / updated / imported with the session, a session-scoped
   * recall or search, or `touchSession()`. Sessions written before v0.12.2
   * read their `started_at`.
   */
  last_activity_at?: number;
  /** Server v0.12.2+: who ended the session (`client` or `idle`). Absent while open. */
  ended_reason?: SessionEndedReason;
  /** Server v0.12.2+: for `ended_reason: "idle"`, the last activity it was idle since (Unix seconds). */
  idle_since?: number;
  /**
   * Server v0.12.2+: the session's own idle timeout, when it set one at start
   * (`0` = never ended for inactivity). Absent: the server's timeout applies.
   */
  idle_timeout_secs?: number;
}

/** Response from POST /v1/sessions/start */
export interface SessionStartResponse {
  session: Session;
}

/** Response from POST /v1/sessions/{id}/end */
export interface SessionEndResponse {
  session: Session;
  memory_count: number;
}

/** Response from `POST /v1/sessions/{id}/touch` (server v0.12.2+). */
export interface SessionTouchResponse {
  /** The session; `last_activity_at` raised to now when it is open. */
  session: Session;
  /** `"active"`, or `"ended"` — a touch never re-opens an ended session. */
  session_state: SessionState;
  /**
   * When the server ends the session if nothing else happens (Unix seconds).
   * Absent when the session never times out or has ended.
   */
  idle_deadline_at?: number;
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

/** Options for {@link DakeraClient.sessionMemories}. */
export interface SessionMemoriesOptions {
  /** Page size (server default 50). */
  limit?: number;
  /** Page offset. */
  offset?: number;
  /**
   * Server v0.12.2+: cut each memory's `content` to this many characters
   * (1..=10000, 400 outside) and add `content_len` / `content_truncated`.
   */
  content_preview_chars?: number;
}

/** Options for {@link DakeraClient.agentMemories}. */
export interface AgentMemoriesOptions {
  /** Not a server filter on `GET /v1/agents/{id}/memories`; kept for compatibility. */
  memory_type?: string;
  /** Page size (server default 50, at most 1000). */
  limit?: number;
  /** Page offset (counts memories; derived records are not counted unless `include_derived`). */
  offset?: number;
  /**
   * Server v0.12.2+: also list derived records (CE-31 sentence sub-memories),
   * which the listing leaves out by default. Not sent when undefined.
   */
  include_derived?: boolean;
  /**
   * Server v0.12.2+: cut each memory's `content` to this many characters
   * (1..=10000, 400 outside) and add `content_len` / `content_truncated`.
   */
  content_preview_chars?: number;
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
  /**
   * Records in the agent's memory namespace (memories, sub-memories and
   * bookkeeping records). Server v0.12.2 no longer counts the namespace seed,
   * so an empty agent reports 0.
   */
  vector_count?: number;
  /**
   * Server v0.12.2+: why `vector_count` is unknown (`0`) — the agent's
   * namespace could not be counted in time. Absent when it was counted.
   */
  unavailable?: string;
}

/** Request for `POST /v1/agents` (server v0.12.2+). */
export interface CreateAgentRequest {
  /**
   * Agent id: `^[a-zA-Z0-9][a-zA-Z0-9_\-.]*$`, at most 241 bytes, not starting
   * with `_dakera_`.
   */
  agent_id: string;
}

/** Response from `POST /v1/agents` (server v0.12.2+). */
export interface CreateAgentResponse {
  agent_id: AgentId;
  /** The agent's memory namespace (`_dakera_agent_<agent_id>`). */
  namespace: string;
  /** `true` (HTTP 201) when created; `false` (HTTP 200) when it already existed and was left untouched. */
  created: boolean;
  /** Dimension of the namespace's vectors (`null` if it cannot be read). */
  dimension: number | null;
  /** The embedding model the agent's memories are embedded with. */
  model: EmbeddingModel;
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

/** Options for `getWakeUpContext` (DAK-1690) */
export interface WakeUpOptions {
  /** Maximum number of memories to return (default 20, max 100) */
  top_n?: number;
  /** Only return memories with importance ≥ this value (default 0.0) */
  min_importance?: number;
  /**
   * Server v0.12.2+: also rank derived records (CE-31 sentence sub-memories),
   * which wake-up leaves out by default. Not sent when undefined.
   */
  include_derived?: boolean;
}

/**
 * Response from `GET /v1/agents/{agent_id}/wake-up` (DAK-1690).
 *
 * Returns top-N memories ranked by `importance × exp(-ln2 × age / 14d)` for
 * fast agent start-up context loading. No embedding inference — served from
 * the metadata index for sub-millisecond latency.
 *
 * Requires Read scope on the agent namespace.
 */
export interface WakeUpResponse {
  /** The agent whose memories are returned */
  agent_id: AgentId;
  /** Top-N memories ranked by recency-weighted importance */
  memories: Memory[];
  /** Total memories available before top_n cap was applied */
  total_available: number;
}

/**
 * Response from `POST /v1/agents/{id}/compress` (CE-12).
 *
 * Contains compression statistics for the agent's memory namespace after the
 * server runs the compression pass.
 */
export interface CompressResponse {
  /** The agent whose namespace was compressed */
  agent_id: AgentId;
  /** Number of memories before compression */
  memories_before: number;
  /** Number of memories after compression */
  memories_after: number;
  /** Number of memories removed during compression */
  removed_count: number;
  /** Wall-clock duration of the compression pass in milliseconds */
  duration_ms?: number;
  /** Memories the server scanned. */
  memories_scanned?: number;
  /** Clusters found. */
  clusters_found?: number;
  /** Summaries written (server v0.12.2: what was actually written). */
  summaries_created?: number;
  /** Originals deprecated (server v0.12.2: only those of written summaries). */
  originals_deprecated?: number;
  /** Ids of the summaries written. */
  summary_ids?: string[];
  /** Ids of the originals deprecated. */
  deprecated_ids?: string[];
  /**
   * Server v0.12.2+: summaries refused by validation or not storable; the
   * originals of their clusters were NOT deprecated.
   */
  summaries_skipped?: CompressSkippedSummary[];
}

/** A summary `compressAgent()` did not write (server v0.12.2+). */
export interface CompressSkippedSummary {
  summary_id: string;
  /** Why, e.g. a `content: … bytes …` validation message. */
  reason: string;
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
  /**
   * Full graph, server v0.12.2+: length of the FULL content in characters
   * (Unicode scalar values), whether or not a preview was asked for.
   */
  content_len?: number;
  /** Full graph, server v0.12.2+: whether `content` was cut to `content_preview_chars`. */
  content_truncated?: boolean;
  /** Full graph: the memory's tags. */
  tags?: string[];
  /** Full graph: creation time (string seconds) or null. */
  created_at?: string | null;
  /** Full graph: cluster the node belongs to. */
  cluster_id?: number;
  /** Full graph: centrality of the node. */
  centrality?: number;
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
  /** Full graph: graph statistics. */
  stats?: FullKnowledgeGraphStats;
}

/** Statistics of `POST /v1/knowledge/graph/full`. */
export interface FullKnowledgeGraphStats {
  /**
   * User memories of the agent (server v0.12.2: no sentence sub-memories, no
   * namespace seed — the same count as `listAgents()` `memory_count`).
   */
  total_memories: number;
  included_memories: number;
  total_edges: number;
  cluster_count: number;
  density: number;
  hub_memory_id: string | null;
}

/** Request for full knowledge graph */
export interface FullKnowledgeGraphRequest {
  agent_id: AgentId;
  max_nodes?: number;
  min_similarity?: number;
  cluster_threshold?: number;
  max_edges_per_node?: number;
  /**
   * Server v0.12.2+: cut each node's `content` to this many characters
   * (1..=10000, 400 outside). Omitted: full content.
   */
  content_preview_chars?: number;
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
  /** Duplicates merged (the server's name for the merged count). */
  duplicates_merged?: number;
  /**
   * Server v0.12.2+: candidates not merged because the canonical memory or the
   * duplicate changed (edited, expired, forgotten) between the scan and the
   * write. Always 0 on a dry run.
   */
  duplicates_skipped_changed?: number;
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
  /** Server v0.12.2+: namespaces left out of the totals (absent when every namespace answered). */
  unavailable?: UnavailableNamespace[];
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
  /** Server v0.12.2+: namespaces left out of the totals (absent when every namespace answered). */
  unavailable?: UnavailableNamespace[];
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
  /** Pagination cursor from a previous UnifiedQueryResponse.next_cursor */
  cursor?: string;
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
 *   importance_updated | session_started | session_ended | stream_lagged |
 *   deduplicated | restored (server v0.12.3+, Dakera-AI/dakera#930)
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
  /**
   * Why the event happened, when the server says: `session_ended` →
   * `"client"` or `"idle"` (v0.12.2+); `deduplicated` →
   * `"absorbed into <survivor>"`, `consolidated` → `"merged into <id>"`
   * (v0.12.3+). Absent otherwise.
   */
  reason?: string;
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
  /** Server v0.12.2+: length of the FULL content in characters (Unicode scalar values). */
  content_len?: number;
  /** Server v0.12.2+: whether `content` was cut to `content_preview_chars`. */
  content_truncated?: boolean;
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
  /**
   * Server v0.12.2+: cut each node's `content` to this many characters
   * (1..=10000, 400 outside). Omitted: full content.
   */
  content_preview_chars?: number;
}

// =============================================================================
// Admin Types
// =============================================================================

/** Ops stats response — Read-scoped; works with read-only API keys */
export interface OpsStats {
  version: string;
  total_vectors: number;
  /** Still counts an unavailable namespace (server v0.12.2). */
  namespace_count: number;
  uptime_seconds: number;
  timestamp: number;
  state: string;
  /**
   * Server v0.12.2+: namespaces whose records are not in `total_vectors`
   * (absent when every namespace answered).
   */
  unavailable?: UnavailableNamespace[];
}

/** Cluster status response */
export interface ClusterStatus {
  status: string;
  nodes: number;
  healthy: boolean;
  version?: string;
  /** Server v0.12.2+: namespaces left out (absent when every namespace answered). */
  unavailable?: UnavailableNamespace[];
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
/** One slow-query log entry (`GET /admin/slow-queries` → `queries[]`). */
export interface SlowQuery {
  /** Entry id (server `id`). */
  id?: string;
  /** @deprecated Not sent by the server; see `parameters` / `query_type`. */
  query?: string;
  duration_ms: number;
  /** Unix time as the server sends it. */
  timestamp: string | number;
  namespace?: string;
  /** `vector_search`, `full_text_search`, `hybrid_search`, ... */
  query_type?: string;
  /** Query parameters the server recorded. */
  parameters?: unknown;
  results_count?: number;
  vectors_scanned?: number;
  /** Fields of newer servers. */
  [key: string]: unknown;
}

/** Backup type. */
export type BackupType = 'full' | 'incremental' | 'snapshot';

/** Backup status. */
export type BackupStatus = 'inprogress' | 'completed' | 'failed' | 'deleting';

/** Compression type. */
export type CompressionType = 'none' | 'zstd' | 'lz4';

/** Restore status. */
export type RestoreStatus = 'inprogress' | 'completed' | 'failed';

/** Backup info */
export interface BackupInfo {
  backup_id: string;
  name: string;
  backup_type: BackupType;
  status: BackupStatus;
  namespaces: string[];
  vector_count: number;
  size_bytes: number;
  created_at: number;
  completed_at?: number;
  duration_seconds?: number;
  storage_path?: string;
  error?: string;
  encrypted: boolean;
  compression?: CompressionType;
}

// =============================================================================
// AutoPilot Types (PILOT-1 / PILOT-2 / PILOT-3)
// =============================================================================

/**
 * What the autopilot dedup pass does (server v0.12.3+, Dakera-AI/dakera#930):
 * `off` (the server default since v0.12.3: no pass), `report` (finds duplicate
 * groups and reports them, changes nothing) or `merge` (folds and deletes, the
 * behaviour of every earlier release).
 */
export type AutoPilotDedupMode = 'off' | 'report' | 'merge';
/** Every {@link AutoPilotDedupMode}. */
export const AUTOPILOT_DEDUP_MODES: readonly AutoPilotDedupMode[] = ['off', 'report', 'merge'];

/** AutoPilot configuration */
export interface AutoPilotConfig {
  enabled: boolean;
  dedup_threshold: number;
  dedup_interval_hours: number;
  consolidation_interval_hours: number;
  /** Server v0.12.3+: the dedup mode ({@link AutoPilotDedupMode}). Absent on older servers. */
  dedup_mode?: AutoPilotDedupMode | (string & {});
  /** Server v0.12.3+: whether dedup may fold memories of different sessions (default false). */
  dedup_cross_session?: boolean;
  /** Server v0.12.3+: whether consolidation may merge memories of different sessions (default false). */
  consolidate_cross_session?: boolean;
  /**
   * Server v0.12.3+: hours a memory deleted by dedup or consolidation stays
   * restorable ({@link DakeraClient.listDeduplicated}); `0` = no copy (hard delete).
   */
  trash_retention_hours?: number;
}

/** Result snapshot from a deduplication cycle */
export interface DedupResultSnapshot {
  namespaces_processed: number;
  memories_scanned: number;
  duplicates_removed: number;
  /** Server v0.12.3+: duplicates the pass found (in `report` mode none is removed). */
  duplicates_found?: number;
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
  /** Server v0.12.3+: `off`, `report` or `merge`. */
  dedup_mode?: AutoPilotDedupMode;
  /** Server v0.12.3+: let dedup fold memories of different sessions. */
  dedup_cross_session?: boolean;
  /** Server v0.12.3+: let consolidation merge memories of different sessions. */
  consolidate_cross_session?: boolean;
  /** Server v0.12.3+: hours a deleted memory stays restorable (0..=8760; 0 = no copy). */
  trash_retention_hours?: number;
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
  /** Server v0.12.3+: duplicates found (in `report` mode none is removed). */
  duplicates_found?: number;
  /** Server v0.12.3+: the mode the pass ran in (`report` or `merge`). */
  mode?: AutoPilotDedupMode | (string & {});
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
  /** Key id as the server sends it (`dk_key_…`). See {@link KeyInfo}. */
  key_id?: string;
  /** Scope as the server sends it (`read`, `write`, `admin`, `super_admin`). */
  scope?: string;
  /** Namespace grants (`null` = every namespace). See {@link KeyInfo.namespaces}. */
  namespaces?: string[] | null;
  /** Server v0.12.2+: grant syntax version. See {@link KeyInfo.grants_version}. */
  grants_version?: number;
  /** Server v0.12.2+: grant entries that grant nothing. See {@link KeyInfo.inert_namespaces}. */
  inert_namespaces?: string[];
}

/**
 * An API key as the server describes it (`GET`/`PATCH /admin/keys/{id}`,
 * `PATCH /v1/namespaces/{ns}/keys/{id}`, list items). Never holds the secret.
 */
export interface KeyInfo {
  key_id: string;
  name: string;
  /** `read`, `write`, `admin` or `super_admin`. */
  scope: string;
  /**
   * Namespace grants. `null` or `["*"]` = every namespace; `[]` = none. Server
   * v0.12.2+ accepts prefix patterns `p*` (one trailing star after a non-empty
   * prefix): `team-*` reaches `team-a` and `team-a.b`, not `team-` or `team`.
   * A pattern never reaches a server-internal namespace.
   */
  namespaces: string[] | null;
  /** Unix seconds. */
  created_at: number;
  /** Unix seconds, or null. */
  expires_at: number | null;
  active: boolean;
  /**
   * Server v0.12.2+: grant syntax version. `1` = patterns are active; `0` = a
   * key created before v0.12.2, whose `foo*` entries are literal names that
   * grant nothing until its `namespaces` are saved (PATCH). Absent on older
   * servers.
   */
  grants_version?: number;
  /**
   * Server v0.12.2+: entries that grant nothing (a legacy `foo*`, or a
   * server-internal name such as `_dakera_sessions`). Omitted when empty.
   */
  inert_namespaces?: string[];
}

/**
 * Request to create an API key (`POST /admin/keys`).
 *
 * The server refuses unknown fields with 422 (server v0.12.3+), and the
 * SDK sends only these four. The former `permissions` and `expires_at` fields
 * were never read by any server (a key created with `expires_at` never
 * expired): use `scope` and `expires_in_days`. Passing them now throws a
 * `ValidationError` before anything is sent.
 */
export interface CreateKeyRequest {
  name: string;
  /** Scope of the new key (`read`, `write`, `admin`, `super_admin`). Required by the server. */
  scope: string;
  /**
   * Namespace grants (`null` = every namespace, `[]` = none). Server v0.12.2+
   * validates every entry (400 naming it) and accepts prefix patterns `p*`.
   */
  namespaces?: string[] | null;
  /** Expiry in days from now. */
  expires_in_days?: number;
}

/**
 * Body of `PATCH /admin/keys/{id}` and `PATCH /v1/namespaces/{ns}/keys/{id}`
 * (server v0.12.2+). At least one field; the scope cannot be changed.
 */
export interface UpdateKeyRequest {
  /** New name. */
  name?: string;
  /**
   * Replace the grants: an array replaces the list, `null` means every
   * namespace (unrestricted callers only), and leaving it `undefined` keeps the
   * list unchanged (the field is not sent). Saving `namespaces` moves the key
   * to `grants_version: 1`, which activates its `p*` patterns.
   */
  namespaces?: string[] | null;
}

/** Options for {@link DakeraClient.rotateKey}. */
export interface RotateKeyOptions {
  /**
   * Server v0.12.2+: seconds (0..=604800) the OLD key keeps working after the
   * rotation (until `min(its own expiry, now + grace_secs)`). `0` or undefined
   * deactivates it at once (no body is sent, as before).
   */
  grace_secs?: number;
}

/** Response from `POST /admin/keys/{id}/rotate`. */
export interface RotateKeyResponse {
  /** The new secret — shown only once. */
  new_key: string;
  /** Id of the NEW key. */
  key_id: string;
  /** Server v0.12.2+: id of the rotated (old) key. */
  old_key_id?: string;
  /**
   * Server v0.12.2+: when the old key stops working (Unix seconds); `null`
   * without a grace period (it was deactivated at once).
   */
  old_key_expires_at?: number | null;
  warning: string;
}

/** Response from `GET /v1/auth/whoami` (server v0.12.2+). */
export interface WhoamiResponse {
  key_id: string;
  name: string;
  scope: string;
  /** Grants as the server reads them (`null` = every namespace). */
  namespaces: string[] | null;
  /** Whether the key reaches every namespace. */
  unrestricted: boolean;
  expires_at: number | null;
  grants_version: number;
  /** Entries that grant nothing (always present here, possibly `[]`). */
  inert_namespaces: string[];
  /** `false` when the server runs with authentication off (`key_id: "auth-disabled"`). */
  auth_enabled: boolean;
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
  /** True when the result set was capped by `limit` and more matching memories exist. */
  truncated: boolean;
  /**
   * Server v0.12.3+: request fields the server ignored (top level and
   * `filter`). Absent when it ignored nothing.
   */
  warnings?: string[];
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

// ============================================================================
// Batch Store Memory Types (DAK-5508)
// ============================================================================

/**
 * A single memory entry within a {@link BatchStoreMemoryRequest}.
 *
 * Mirrors `StoreMemoryRequest` but omits `agent_id` — supplied at batch level.
 */
export interface BatchStoreMemoryItem {
  /** Memory content text (required, max 100 000 chars). */
  content: string;
  /** One of `"episodic"`, `"semantic"`, `"procedural"`, or `"working"`. */
  memory_type?: MemoryType;
  /** Importance score 0.0–1.0 (default: 0.5). */
  importance?: number;
  /** Optional tags to associate with the memory. */
  tags?: string[];
  /** Optional session ID to associate with. */
  session_id?: string;
  /** Arbitrary metadata dictionary. */
  metadata?: Record<string, unknown>;
  /** Optional TTL in seconds. */
  ttl_seconds?: number;
  /** Optional explicit expiry as a Unix timestamp (seconds). */
  expires_at?: number;
  /** Optional custom ID. Auto-generated if not provided. */
  id?: string;
  /** v0.12: `sha256:<hex>` attachment reference (see {@link StoreMemoryRequest.attachment_ref}). */
  attachment_ref?: string;
  /**
   * Server v0.12.3+: when this memory's event happened ({@link EventTime},
   * see {@link StoreMemoryRequest.event_time}). Out of bounds: 400 naming
   * `memories[i].event_time`. Not sent when undefined.
   */
  event_time?: EventTime;
}

/**
 * Request body for `POST /v1/memories/store/batch` (DAK-5508).
 *
 * Accepts up to 1 000 memories per call. The server embeds all contents in a
 * single ONNX inference pass, yielding ≥100× throughput vs. N sequential
 * single-store calls.
 */
export interface BatchStoreMemoryRequest {
  /** Agent namespace to store the memories in. */
  agent_id: string;
  /** Memories to store (1–1000 items). */
  memories: BatchStoreMemoryItem[];
  /** v0.12: language of the batch's contents; applies to every item. */
  lang?: string;
}

/** A single stored memory returned in a {@link BatchStoreMemoryResponse}. */
export interface BatchStoredMemory {
  id: string;
  content: string;
  agent_id: string;
  tags: string[];
  importance: number;
  created_at: number;
}

/** Response from `POST /v1/memories/store/batch`. */
export interface BatchStoreMemoryResponse {
  /** Stored memories in the same order as the request items. */
  stored: BatchStoredMemory[];
  /** Number of memories successfully stored. */
  stored_count: number;
  /** Time spent on ONNX embedding for the entire batch (milliseconds). */
  total_embedding_time_ms: number;
  /**
   * Server v0.12.2+: sessions the batch stored into that had already ended
   * (the stores still succeeded). Omitted when none.
   */
  ended_sessions?: string[];
  /**
   * Server v0.12.3+ (Dakera-AI/dakera#933): the stored memories whose text is
   * longer than the embedding model reads. Absent when there are none.
   * (Not the `truncated: boolean` of {@link BatchRecallResponse}.)
   */
  truncated?: TruncatedMemory[];
  /**
   * Server v0.12.3+: request fields the server ignored (top level and each
   * `memories[]` item). Absent when it ignored nothing.
   */
  warnings?: string[];
}

// ============================================================================
// Memory Knowledge Graph Types (CE-5 / SDK-9)
// ============================================================================

/**
 * Edge type for memory knowledge graph relationships (CE-5).
 *
 * - `related_to`: Cosine similarity ≥ 0.85 between two memories.
 * - `shares_entity`: Both memories reference the same named entity (CE-4).
 * - `precedes`: Temporal ordering — source was created before target.
 * - `linked_by`: Explicit user/agent-created link.
 */
export type EdgeType = 'related_to' | 'shares_entity' | 'precedes' | 'linked_by';

/**
 * A directed edge in the memory knowledge graph.
 *
 * The server sends `from_id`, `to_id`, `edge_type`, `weight` and `created_at`
 * (no edge id). The client also fills `source_id` / `target_id` (same values
 * as `from_id` / `to_id`) and `id` (`''`: the server has no edge ids) so code
 * written against the older field names keeps working.
 */
export interface GraphEdge {
  /** Source memory ID, as the server names it. */
  from_id: string;
  /** Target memory ID, as the server names it. */
  to_id: string;
  /** Source memory ID (same as `from_id`). */
  source_id: string;
  /** Target memory ID (same as `to_id`). */
  target_id: string;
  /** Always `''`: the server does not identify edges. */
  id: string;
  /** Relationship type between the two memories. */
  edge_type: EdgeType;
  /** Edge weight (0.0–1.0). For `related_to` this is the cosine similarity score; 1.0 for explicit links. */
  weight: number;
  /** Unix timestamp (seconds) of edge creation; 0 when the server did not say. */
  created_at: number;
}

/** A node (memory) in the knowledge graph traversal result. */
export interface GraphNode {
  /** Memory identifier. */
  memory_id: string;
  /** Traversal depth from the root node (root = 0). */
  depth: number;
  /** Edges that reached this node during the traversal (empty for the root). */
  edges: GraphEdge[];
  /** Not sent by the server (v0.11.108 / v0.12); kept for older code. */
  content_preview?: string;
  /** Not sent by the server (v0.11.108 / v0.12); kept for older code. */
  importance?: number;
}

/** Graph traversal result from `GET /v1/memories/{id}/graph`. */
export interface MemoryGraph {
  /** The root memory ID from which traversal started. */
  root_id: string;
  /** Maximum traversal depth used. */
  depth: number;
  /** Number of nodes returned. */
  node_count: number;
  /** All memory nodes reachable within the requested depth. */
  nodes: GraphNode[];
  /** Every node's edges, collected by the client (the server lists them per node). */
  edges: GraphEdge[];
}

/** Shortest path result from `GET /v1/memories/{id}/path`. */
export interface GraphPath {
  /** Starting memory ID. */
  from_id: string;
  /** Destination memory ID. */
  to_id: string;
  /** Ordered list of memory IDs from source to target (inclusive). */
  path: string[];
  /** Number of edges traversed (`path.length - 1`). */
  hop_count: number;
  /** Starting memory ID (same as `from_id`). */
  source_id: string;
  /** Destination memory ID (same as `to_id`). */
  target_id: string;
  /** Same as `hop_count`. */
  hops: number;
}

/** Response from `POST /v1/memories/{id}/links`. */
export interface GraphLinkResponse {
  /** Source memory ID. */
  from_id: string;
  /** Target memory ID. */
  to_id: string;
  /** Always `linked_by`: the server records explicit links with that type. */
  edge_type: EdgeType;
  /**
   * The created edge, built by the client from the answer (weight 1.0, as the
   * server stores explicit links; `created_at` 0 because the answer omits it).
   */
  edge: GraphEdge;
}

/** Options for {@link DakeraClient.memoryLink}. */
export interface MemoryLinkOptions {
  /** Agent that owns both memories (required by the server). */
  agentId: string;
  /** Optional human-readable label. */
  label?: string;
}

/** Agent graph export from `GET /v1/agents/{id}/graph/export`. */
export interface GraphExport {
  /** Agent whose graph was exported. */
  agent_id: string;
  /** The agent's memory namespace (`_dakera_agent_{agent_id}`). */
  namespace: string;
  /** Total number of memory nodes in the export. */
  node_count: number;
  /** Total number of edges in the export. */
  edge_count: number;
  /** All graph edges for the agent. */
  edges: GraphEdge[];
}

// ============================================================================
// KG-2: Graph Query & Export Types
// ============================================================================

/** Response from `GET /v1/knowledge/query` (KG-2). */
export interface KgQueryResponse {
  /** Agent whose graph was queried. */
  agent_id: string;
  /** Number of unique memory node IDs referenced by the returned edges. */
  node_count: number;
  /** Number of edges returned. */
  edge_count: number;
  /** Matching edges, up to `limit`. */
  edges: GraphEdge[];
}

/** Response from `GET /v1/knowledge/path` (KG-2). */
export interface KgPathResponse {
  /** Agent whose graph was traversed. */
  agent_id: string;
  /** Source memory ID. */
  from_id: string;
  /** Target memory ID. */
  to_id: string;
  /** Number of edges in the shortest path (0 if source === target). */
  hop_count: number;
  /** Ordered list of memory IDs from source to target (inclusive). */
  path: string[];
}

/** Response from `GET /v1/knowledge/export` with `format=json` (KG-2). */
export interface KgExportResponse {
  /** Agent whose graph was exported. */
  agent_id: string;
  /** Export format used (`"json"` when this interface is returned). */
  format: string;
  /** Total number of unique memory node IDs in the export. */
  node_count: number;
  /** Total number of edges in the export. */
  edge_count: number;
  /** All graph edges for the agent. */
  edges: GraphEdge[];
}

/** Options for `client.memoryGraph()`. */
export interface MemoryGraphOptions {
  /** Maximum traversal depth (default: 1; the server caps it). */
  depth?: number;
  /**
   * Keep only edges of these types. Applied by the client: the server's
   * traversal route has no type filter.
   */
  types?: EdgeType[];
}

/** Configuration for namespace-level entity extraction (CE-4). */
export interface NamespaceNerConfig {
  extract_entities: boolean;
  entity_types?: string[];
}

/** A single extracted entity from GLiNER or rule-based pipeline. */
export interface ExtractedEntity {
  entity_type: string;
  value: string;
  score: number;
}

/** Response from POST /v1/memories/extract */
export interface EntityExtractionResponse {
  entities: ExtractedEntity[];
}

/** Response from GET /v1/memory/entities/:id */
export interface MemoryEntitiesResponse {
  /** The requested memory ID (filled by the client; the server omits it). */
  memory_id: string;
  entities: ExtractedEntity[];
  /** Number of entities. */
  count: number;
}

// =============================================================================
// Memory Feedback Loop (INT-1)
// =============================================================================

/**
 * Feedback signal for memory active learning (INT-1).
 *
 * - `upvote`: Boost importance ×1.15, capped at 1.0.
 * - `downvote`: Penalise importance ×0.85, floor 0.0.
 * - `flag`: Mark as irrelevant — sets `decay_flag=true`, no immediate importance change.
 * - `positive`: Backward-compatible alias for `upvote`.
 * - `negative`: Backward-compatible alias for `downvote`.
 */
export type FeedbackSignal = 'upvote' | 'downvote' | 'flag' | 'positive' | 'negative';

/** A single recorded feedback event stored in memory metadata (INT-1). */
export interface FeedbackHistoryEntry {
  /** Feedback signal that was applied. */
  signal: FeedbackSignal;
  /** Unix timestamp (seconds) when feedback was submitted. */
  timestamp: number;
  /** Memory importance before this feedback was applied. */
  old_importance: number;
  /** Memory importance after this feedback was applied. */
  new_importance: number;
}

/** Request body for POST /v1/memories/:id/feedback (INT-1). */
export interface MemoryFeedbackBodyRequest {
  agent_id: string;
  signal: FeedbackSignal;
}

/** Request body for PATCH /v1/memories/:id/importance (INT-1). */
export interface MemoryImportancePatchRequest {
  agent_id: string;
  importance: number;
}

/** Response from POST /v1/memories/:id/feedback and PATCH /v1/memories/:id/importance (INT-1). */
export interface FeedbackResponse {
  /** ID of the memory that was updated. */
  memory_id: string;
  /** New importance score after the feedback was applied (0.0–1.0). */
  new_importance: number;
  /** The feedback signal that was recorded. */
  signal: FeedbackSignal;
}

/** Response from GET /v1/memories/:id/feedback (INT-1). */
export interface FeedbackHistoryResponse {
  memory_id: string;
  /** Ordered list of feedback events (oldest first, capped at 100). */
  entries: FeedbackHistoryEntry[];
}

/** Response from GET /v1/agents/:id/feedback/summary (INT-1). */
export interface AgentFeedbackSummary {
  agent_id: string;
  upvotes: number;
  downvotes: number;
  flags: number;
  total_feedback: number;
  /** Weighted-average importance across all non-expired memories (0.0–1.0). */
  health_score: number;
}

/** Response from GET /v1/feedback/health (INT-1). */
export interface FeedbackHealthResponse {
  agent_id: string;
  /** Mean importance of all non-expired memories (0.0–1.0). Higher = healthier. */
  health_score: number;
  memory_count: number;
  avg_importance: number;
}

// =============================================================================
// Namespace API Keys (SEC-1)
// =============================================================================

/** Namespace-scoped API key metadata (no secret). Returned by listNamespaceKeys (SEC-1). */
export interface NamespaceKeyInfo {
  key_id: string;
  name: string;
  namespace: string;
  created_at: number;
  active: boolean;
  expires_at?: number;
  /** Scope as the server sends it. */
  scope?: string;
  /** The key's grants (`null` = every namespace). */
  namespaces?: string[] | null;
  /** Server v0.12.2+: grant syntax version (see {@link KeyInfo.grants_version}). */
  grants_version?: number;
  /** Server v0.12.2+: entries that grant nothing (omitted when empty). */
  inert_namespaces?: string[];
}

/** Options for {@link DakeraClient.createNamespaceKey}. */
export interface CreateNamespaceKeyOptions {
  /** Scope of the new key, at most `admin`. */
  scope?: string;
  /**
   * Namespaces beyond the path namespace. Server v0.12.2+ accepts prefix
   * patterns here, validates them (400) and requires them to be contained in
   * the caller's own grants (403).
   */
  extra_namespaces?: string[];
  /** Expiry in days from now. */
  expires_in_days?: number;
}

/**
 * Response from POST /v1/namespaces/:namespace/keys (SEC-1).
 * The `key` field is shown **only once** — store it securely.
 */
export interface CreateNamespaceKeyResponse {
  key_id: string;
  /** The raw API key. Shown only on creation — cannot be retrieved again. */
  key: string;
  name: string;
  namespace: string;
  created_at: number;
  expires_at?: number;
  warning: string;
}

/** Response from GET /v1/namespaces/:namespace/keys (SEC-1). */
export interface ListNamespaceKeysResponse {
  namespace: string;
  keys: NamespaceKeyInfo[];
  total: number;
}

/** Response from GET /v1/namespaces/:namespace/keys/:key_id/usage (SEC-1). */
export interface NamespaceKeyUsageResponse {
  key_id: string;
  namespace: string;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  bytes_transferred: number;
  avg_latency_ms: number;
}

// =============================================================================
// CE-6: DBSCAN Adaptive Consolidation
// =============================================================================

/** Algorithm config for DBSCAN adaptive consolidation (CE-6). */
export interface ConsolidationConfig {
  /** Clustering algorithm: `"dbscan"` (default) or `"greedy"`. */
  algorithm?: 'dbscan' | 'greedy';
  /** Minimum cluster samples for DBSCAN. */
  min_samples?: number;
  /** Epsilon distance parameter for DBSCAN. */
  eps?: number;
}

/** One step in the consolidation execution log (CE-6). */
export interface ConsolidationLogEntry {
  step: string;
  memories_before: number;
  memories_after: number;
  duration_ms: number;
}

// =============================================================================
// DX-1: Memory Import / Export
// =============================================================================

/** Response from POST /v1/import (DX-1). */
export interface MemoryImportResponse {
  imported_count: number;
  skipped_count: number;
  errors: string[];
}

/** Response from GET /v1/export (DX-1). */
export interface MemoryExportResponse {
  data: Record<string, unknown>[];
  format: string;
  count: number;
}

// =============================================================================
// OBS-1: Business-Event Audit Log
// =============================================================================

/** A single business-event entry from the audit log (OBS-1). */
export interface AuditEvent {
  id: number;
  event_type: string;
  agent_id: string;
  memory_id?: string;
  session_id?: string;
  importance?: number;
  /** Unix milliseconds. */
  timestamp: number;
  /**
   * Server v0.12.3+: why the event happened, when the writer says
   * (`deduplicated` → `"absorbed into <survivor>"`, `consolidated` →
   * `"merged into <id>"`). Absent on older rows and servers.
   */
  reason?: string;
}

/**
 * Audit `event_type` values a v0.12.3 server writes for deletions and
 * restores (Dakera-AI/dakera#930); filter with `listAuditEvents({ eventType })`.
 */
export const AUDIT_EVENT_DEDUPLICATED = 'deduplicated';
export const AUDIT_EVENT_CONSOLIDATED = 'consolidated';
export const AUDIT_EVENT_RESTORED = 'restored';

/** Response from GET /v1/audit (OBS-1). */
export interface AuditListResponse {
  events: AuditEvent[];
  count: number;
}

/** Result of `exportAudit` (`GET /v1/audit/export`, OBS-1). */
export interface AuditExportResponse {
  /** `json` or `csv`. */
  format: string;
  /** The export as text (CSV, or the JSON events serialised). */
  data: string;
  count: number;
  /** Parsed rows, for the JSON format. */
  events?: AuditEvent[];
}

// =============================================================================
// EXT-1: External Extraction Providers
// =============================================================================

/** Result from POST /v1/extract (EXT-1). */
export interface ExtractionResult {
  entities: Record<string, unknown>[];
  provider: string;
  model?: string;
  duration_ms: number;
}

// =============================================================================
// SEC-3: AES-256-GCM Encryption Key Rotation
// =============================================================================

/**
 * Request body for POST /v1/admin/encryption/rotate-key (SEC-3). The server
 * refuses unknown fields with 422 (server v0.12.3+); the SDK sends only
 * these, and only when defined.
 */
export interface RotateEncryptionKeyRequest {
  /**
   * New passphrase or 64-char hex key to derive the new data key from.
   * Omitted: the server generates a random 256-bit key.
   */
  new_key?: string;
  /** If set, rotate only this namespace. Omit to rotate the global key (every namespace). */
  namespace?: string;
  /** Seconds to wait for the re-seal before answering (server default 10, max 300, 0 = answer at once). */
  wait_secs?: number;
}

/** Response from POST /v1/admin/encryption/rotate-key (SEC-3). */
export interface RotateEncryptionKeyResponse {
  rotated: number;
  skipped: number;
  namespaces: string[];
  /** v0.12: id of the new data key. */
  key_id?: string;
  /** v0.12: id of the key it replaced. */
  previous_key_id?: string;
  /** v0.12: `global` or `namespace`. */
  scope?: string;
  /** v0.12: the namespace rotated on its own, when `scope` is `namespace`. */
  namespace?: string;
  /** v0.12: state of the background re-seal. */
  reseal?: string;
  /** v0.12: BM25 indexes re-sealed. */
  fulltext_indices_rotated?: number;
  /** v0.12: namespaces whose re-seal failed (omitted when empty). */
  failed_namespaces?: string[];
  /** v0.12: what the operator must still do (e.g. set `DAKERA_ENCRYPTION_KEY`). */
  action_required?: string;
  /** v0.12: where to follow the re-seal (`GET /admin/encryption/status`). */
  status_url?: string;
}

// =============================================================================
// ODE-2: GLiNER Entity Extraction (dakera-ode sidecar)
// =============================================================================

/** A single entity extracted by the GLiNER model (ODE-2). */
export interface OdeEntity {
  /** Span text as it appears in the input. */
  text: string;
  /** Entity type label (e.g. `"person"`, `"organization"`). */
  label: string;
  /** Start character offset (inclusive) within the input text. */
  start: number;
  /** End character offset (exclusive) within the input text. */
  end: number;
  /** Confidence score in the range [0, 1]. */
  score: number;
}

/** Request body for POST /ode/extract (ODE-2). */
export interface ExtractEntitiesRequest {
  /** The text to extract entities from. */
  content: string;
  /** Agent context for the extraction. */
  agent_id: string;
  /** Optional memory ID to associate with the extraction. */
  memory_id?: string;
  /** Optional list of entity type labels to extract. */
  entity_types?: string[];
}

/** Response from POST /ode/extract on the ODE sidecar (ODE-2). */
export interface ExtractEntitiesResponse {
  /** Extracted entities ordered by their start offset. */
  entities: OdeEntity[];
  /** GLiNER model variant used for extraction. */
  model: string;
  /** Wall-clock time taken by the ODE sidecar in milliseconds. */
  processing_time_ms: number;
}

// =============================================================================
// COG-1: Cognitive Memory Lifecycle — per-namespace memory policy
// =============================================================================

/**
 * Decay strategy name.  The COG-1 variants (power_law, logarithmic, flat) are
 * only valid inside MemoryPolicy per-type fields; the global DecayConfig
 * endpoint still accepts only "exponential" | "linear" | "step".
 */
export type DecayStrategyName =
  | 'exponential'
  | 'linear'
  | 'step'
  | 'power_law'
  | 'logarithmic'
  | 'flat';

/**
 * Per-namespace memory lifecycle policy (COG-1).
 *
 * Controls type-specific TTLs, decay curves, and spaced repetition behaviour.
 * All fields are optional and have sensible server-side defaults; only set the
 * ones you want to override.
 *
 * Used by {@link DakeraClient.getMemoryPolicy} and
 * {@link DakeraClient.setMemoryPolicy}.
 */
export interface MemoryPolicy {
  // Differential TTLs ---------------------------------------------------------
  /** Default TTL for `working` memories in seconds (default: 14 400 = 4 h). */
  working_ttl_seconds?: number;
  /** Default TTL for `episodic` memories in seconds (default: 2 592 000 = 30 d). */
  episodic_ttl_seconds?: number;
  /** Default TTL for `semantic` memories in seconds (default: 31 536 000 = 365 d). */
  semantic_ttl_seconds?: number;
  /** Default TTL for `procedural` memories in seconds (default: 63 072 000 = 730 d). */
  procedural_ttl_seconds?: number;

  // Decay curves --------------------------------------------------------------
  /** Decay strategy for `working` memories (default: `"exponential"`). */
  working_decay?: DecayStrategyName;
  /** Decay strategy for `episodic` memories (default: `"power_law"`). */
  episodic_decay?: DecayStrategyName;
  /** Decay strategy for `semantic` memories (default: `"logarithmic"`). */
  semantic_decay?: DecayStrategyName;
  /** Decay strategy for `procedural` memories (default: `"flat"` — no decay). */
  procedural_decay?: DecayStrategyName;

  // Spaced repetition ---------------------------------------------------------
  /**
   * Multiplier for the TTL extension on each recall hit.
   * Extension = `access_count × sr_factor × sr_base_interval_seconds`.
   * Set to 0 to disable. Default: 1.0.
   */
  spaced_repetition_factor?: number;
  /** Base interval in seconds for spaced repetition (default: 86 400 = 1 d). */
  spaced_repetition_base_interval_seconds?: number;

  // Proactive consolidation (COG-3) ------------------------------------------
  /**
   * Enable background DBSCAN deduplication for this namespace.
   * When `true` the server merges semantically near-duplicate memories every
   * `consolidation_interval_hours` hours. Default: `false`.
   */
  consolidation_enabled?: boolean;
  /**
   * DBSCAN epsilon — cosine-similarity threshold to consider two memories
   * duplicates (default: `0.92`; higher = only merge very close neighbours).
   */
  consolidation_threshold?: number;
  /**
   * How often (in hours) the background consolidation job runs for this
   * namespace (default: `24`).
   */
  consolidation_interval_hours?: number;
  /**
   * **Read-only.** Lifetime count of memories merged by the consolidation
   * engine. The server manages this field; any value you send is ignored.
   */
  consolidated_count?: number;

  // Per-namespace rate limiting (SEC-5) --------------------------------------
  /** Enable per-namespace store/recall rate limiting (default: `false`). */
  rate_limit_enabled?: boolean;
  /** Max store operations per minute for this namespace. `undefined` = unlimited (default). */
  rate_limit_stores_per_minute?: number;
  /** Max recall operations per minute for this namespace. `undefined` = unlimited (default). */
  rate_limit_recalls_per_minute?: number;

  // Store-time deduplication (CE-10) ----------------------------------------
  /**
   * Deduplicate against existing memories at store time (CE-10, default: `false`).
   *
   * When `true` the server computes a similarity check before persisting a new
   * memory and drops it if a near-duplicate already exists (threshold controlled
   * by `dedup_threshold`).
   */
  dedup_on_store?: boolean;
  /**
   * Cosine-similarity threshold for store-time deduplication (default: `0.92`).
   *
   * Memories with similarity ≥ this value are considered duplicates and the
   * incoming memory is dropped. Only active when `dedup_on_store` is `true`.
   */
  dedup_threshold?: number;
}

// ============================================================================
// Product KPIs (OBS-2)
// ============================================================================

/**
 * Point-in-time product KPI snapshot returned by `GET /v1/kpis` (OBS-2).
 *
 * All latency values are in milliseconds. Rate/percentage values are in the
 * range `0.0`–`100.0`. Integer counts are unsigned.
 *
 * Requires Admin scope.
 */
export interface KpiSnapshot {
  /** Median recall latency across all namespaces over the last minute (ms). */
  recall_latency_p50_ms: number;
  /** 99th-percentile recall latency across all namespaces over the last minute (ms). */
  recall_latency_p99_ms: number;
  /** Median store latency across all namespaces over the last minute (ms). */
  store_latency_p50_ms: number;
  /** 5xx error rate as a percentage of total API requests over the last minute. */
  api_error_rate_5xx_pct: number;
  /** Distinct agent identifiers that stored or recalled a memory in the last 24 hours. */
  active_agents_count: number;
  /** Total sessions created in the rolling 7-day window. */
  session_count_week: number;
  /** Current number of nodes in the cross-agent knowledge graph. */
  cross_agent_network_node_count: number;
  /** Percentage of memories created 7 days ago that are still active. */
  memory_retention_7d_pct: number;
}

// ============================================================================
// CE-54: Fulltext Reindex (Admin)
// ============================================================================

/** Per-namespace result from `POST /admin/fulltext/reindex` (CE-54). */
export interface FulltextReindexNamespaceResult {
  /** Namespace that was scanned. */
  namespace: string;
  /** Total vectors examined. */
  vectors_scanned: number;
  /** Memories newly added to the BM25 index. */
  newly_indexed: number;
  /** Memories already in the BM25 index (skipped). */
  already_indexed: number;
  /** Memories that could not be parsed. */
  parse_failures: number;
}

/**
 * Response from `POST /admin/fulltext/reindex` (CE-54).
 *
 * Returned by {@link DakeraClient.adminFulltextReindex}.
 */
export interface FulltextReindexResponse {
  /** Number of namespaces scanned. */
  namespaces_processed: number;
  /** Total memories newly added to BM25 across all namespaces. */
  total_indexed: number;
  /** Total memories already in the BM25 index (skipped). */
  total_skipped: number;
  /** Per-namespace breakdown. */
  details: FulltextReindexNamespaceResult[];
}

// =============================================================================
// Engine Parity — Health Probes, Vector Bulk Ops, Agent Consolidation
// =============================================================================

/** Response from GET /health/ready. */
export interface ReadinessResponse {
  ready: boolean;
  version: string;
  /** Storage / embedding engine / tiered engine checks. Absent while the server is starting. */
  checks?: Record<string, { status: string; message?: string }>;
  /** v0.12: `true` while the server has bound its port but is still loading models. */
  starting?: boolean;
  /** v0.12: why the server is not ready yet (only while `starting`). */
  reason?: string;
  /** v0.12: model downloads in progress (only while `starting`). */
  downloads?: unknown;
}

/** Response from GET /health/live. */
export interface LivenessResponse {
  alive: boolean;
  version: string;
  uptime_seconds: number;
}

/** Request for POST /v1/namespaces/{ns}/vectors/bulk-update. */
export interface BulkUpdateRequest {
  filter: Record<string, unknown>;
  update: Record<string, unknown>;
}

/** Response from POST /v1/namespaces/{ns}/vectors/bulk-update. */
export interface BulkUpdateResponse {
  updated: number;
  failed: number;
  errors: string[];
}

/** Request for POST /v1/namespaces/{ns}/vectors/bulk-delete. */
export interface BulkDeleteRequest {
  filter: Record<string, unknown>;
}

/** Response from POST /v1/namespaces/{ns}/vectors/bulk-delete. */
export interface BulkDeleteResponse {
  deleted: number;
  failed: number;
  errors: string[];
}

/** Request for POST /v1/namespaces/{ns}/vectors/count. */
export interface CountVectorsRequest {
  filter?: Record<string, unknown>;
}

/** Response from POST /v1/namespaces/{ns}/vectors/count. */
export interface CountVectorsResponse {
  count: number;
  namespace: string;
}

/** Response from POST /v1/agents/{agent_id}/consolidate. */
export interface AgentConsolidateResponse {
  agent_id: string;
  memories_scanned: number;
  clusters_found: number;
  memories_deprecated: number;
  anchor_ids: string[];
  deprecated_ids: string[];
  skipped?: boolean;
  reason?: string;
}

/** One entry in the agent consolidation log. */
export interface AgentConsolidationLogEntry {
  timestamp: number;
  clusters_found: number;
  memories_deprecated: number;
  anchor_ids: string[];
  deprecated_ids: string[];
}

/** Request for PATCH /v1/agents/{agent_id}/consolidation/config. */
export interface ConsolidationConfigPatch {
  enabled?: boolean;
  epsilon?: number;
  min_samples?: number;
  soft_deprecation_days?: number;
}

/** Response from PATCH /v1/agents/{agent_id}/consolidation/config. */
export interface AgentConsolidationConfig {
  enabled: boolean;
  epsilon: number;
  min_samples: number;
  soft_deprecation_days: number;
}

/** Response from GET /v1/namespaces/{ns}/config. */
export interface NamespaceEntityConfig {
  namespace: string;
  extract_entities: boolean;
  entity_types: string[];
}

/** Response from GET /v1/namespaces/{ns}/extractor. */
export interface ExtractorConfig {
  provider: string;
  model?: string;
  base_url?: string;
}

/** Cluster replication status. */
export interface ReplicationStatus {
  replication_factor: number;
  healthy_replicas: number;
  total_nodes: number;
  replication_lag: NodeReplicationLag[];
}

/** Per-node replication lag. */
export interface NodeReplicationLag {
  node_id: string;
  lag_ms: number;
  status: string;
}

/** Shard information. */
export interface ShardInfo {
  shard_id: string;
  namespace: string;
  primary_node: string;
  replica_nodes: string[];
  state: string;
  vector_count: number;
  size_bytes: number;
}

/** Response from GET /admin/cluster/shards. */
export interface ShardListResponse {
  shards: ShardInfo[];
  total: number;
  /** Server v0.12.2+: namespaces left out (absent when every namespace answered). */
  unavailable?: UnavailableNamespace[];
}

/** Request for POST /admin/cluster/shards/rebalance. */
export interface ShardRebalanceRequest {
  shard_ids?: string[];
  dry_run?: boolean;
}

/** Response from POST /admin/cluster/shards/rebalance. */
export interface ShardRebalanceResponse {
  initiated: boolean;
  operation_id: string;
  shards_affected: number;
  estimated_seconds?: number;
  planned_moves: Array<{ shard_id: string; from_node: string; to_node: string }>;
}

/** Maintenance mode status. */
export interface MaintenanceStatus {
  enabled: boolean;
  reason?: string;
  enabled_at?: number;
  scheduled_end?: number;
  nodes_in_maintenance: string[];
  rejecting_requests: boolean;
}

/** Request for POST /admin/cluster/maintenance/enable. */
export interface EnableMaintenanceRequest {
  reason: string;
  node_ids?: string[];
  reject_requests?: boolean;
  duration_minutes?: number;
}

/** Request for POST /admin/cluster/maintenance/disable. */
export interface DisableMaintenanceRequest {
  force?: boolean;
}

/** Quota enforcement mode. */
export type QuotaEnforcement = 'none' | 'soft' | 'hard';

/** Quota configuration for a namespace. */
export interface QuotaConfig {
  max_vectors?: number;
  max_storage_bytes?: number;
  max_dimensions?: number;
  max_metadata_bytes?: number;
  enforcement?: QuotaEnforcement;
}

/** Quota usage for a namespace. */
export interface QuotaUsage {
  vector_count: number;
  storage_bytes: number;
  avg_dimensions?: number;
  avg_metadata_bytes?: number;
  last_updated: number;
}

/** Combined quota status. */
export interface QuotaStatus {
  namespace: string;
  config: QuotaConfig;
  usage: QuotaUsage;
  vector_usage_percent?: number;
  storage_usage_percent?: number;
  is_exceeded: boolean;
  exceeded_quotas: string[];
}

/** Response from GET /admin/quotas. */
export interface QuotaListResponse {
  quotas: QuotaStatus[];
  total: number;
  default_config?: QuotaConfig;
}

/** Response from GET /admin/quotas/default. */
export interface DefaultQuotaResponse {
  config?: QuotaConfig;
}

/** Request for PUT /admin/quotas/default. */
export interface SetDefaultQuotaRequest {
  config?: QuotaConfig;
}

/** Request for PUT /admin/quotas/{namespace}. */
export interface SetQuotaRequest {
  config: QuotaConfig;
}

/** Response from PUT /admin/quotas. */
export interface SetQuotaResponse {
  success: boolean;
  namespace: string;
  config: QuotaConfig;
  message: string;
}

/** Request for POST /admin/quotas/{namespace}/check. */
export interface QuotaCheckRequest {
  vector_ids: string[];
  dimensions?: number;
  metadata_bytes?: number;
}

/** Response from POST /admin/quotas/{namespace}/check. */
export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  usage: QuotaUsage;
  exceeded_quota?: string;
}

/** Response from GET /admin/namespaces (server admin listing). */
export interface AdminNamespaceList {
  /** Every namespace with its stats (fields as the server sends them). */
  namespaces: Array<Record<string, unknown>>;
  /** Total namespace count. */
  total: number;
  /** Total vectors across all namespaces. */
  total_vectors: number;
  /** Fields of newer servers. */
  [key: string]: unknown;
}

/** Response from GET /admin/backups. */
export interface BackupListResponse {
  backups: BackupInfo[];
  total: number;
}

/**
 * Request for POST /admin/backups. The server refuses unknown fields with 422
 * (server v0.12.3+; `encrypted` for `encrypt` used to write a plaintext
 * backup in silence); the SDK sends only these, and only when defined.
 */
export interface CreateBackupRequest {
  name: string;
  backup_type?: BackupType;
  namespaces?: string[];
  encrypt?: boolean;
  compression?: CompressionType;
}

/** Response from POST /admin/backups. */
export interface CreateBackupResponse {
  backup: BackupInfo;
  estimated_completion?: number;
}

/** Request for POST /admin/backups/restore. */
export interface RestoreBackupRequest {
  backup_id: string;
  target_namespaces?: string[];
  overwrite?: boolean;
  point_in_time?: number;
}

/** Response from POST /admin/backups/restore. */
export interface RestoreBackupResponse {
  restore_id: string;
  status: RestoreStatus;
  backup_id: string;
  namespaces: string[];
  started_at: number;
  estimated_completion?: number;
  progress_percent?: number;
  vectors_restored?: number;
  completed_at?: number;
  duration_seconds?: number;
  error?: string;
}

/** Backup schedule configuration. */
export interface BackupSchedule {
  enabled: boolean;
  cron?: string;
  backup_type: BackupType;
  retention_days: number;
  max_backups: number;
  namespaces: string[];
  encrypt: boolean;
  compression?: CompressionType;
  last_backup_at?: number;
  next_backup_at?: number;
}

/** Request for POST /admin/backups/schedule. */
export interface UpdateBackupScheduleRequest {
  enabled?: boolean;
  cron?: string;
  backup_type?: BackupType;
  retention_days?: number;
  max_backups?: number;
  namespaces?: string[];
  encrypt?: boolean;
  compression?: CompressionType;
}

/** Ops job info. */
export interface JobInfo {
  id: string;
  job_type: string;
  /** `Pending` | `Running` | `Completed` | `Failed` | `Cancelled` */
  status: string;
  created_at: number;
  started_at?: number;
  completed_at?: number;
  progress: number;
  message?: string;
  metadata: Record<string, string>;
  /** v0.12: why a `Failed` job failed (HTTP status and error code). */
  error?: { status: number; code: string };
}

/** System diagnostics. */
export interface SystemDiagnostics {
  system: {
    version: string;
    rust_version: string;
    build_time: string;
    uptime_seconds: number;
    pid: number;
  };
  resources: {
    memory_bytes: number;
    memory_total_bytes: number;
    thread_count: number;
    open_fds: number;
    cpu_percent?: number;
  };
  components: {
    storage: { healthy: boolean; message: string; last_check: number };
    search_engine: { healthy: boolean; message: string; last_check: number };
    cache: { healthy: boolean; message: string; last_check: number };
    grpc: { healthy: boolean; message: string; last_check: number };
  };
  active_jobs: number;
  active_connections: number;
  max_connections: number;
  fragmentation_percent: number;
}

/** Request for POST /ops/compact. */
export interface CompactionRequest {
  namespace?: string;
  force?: boolean;
}

/** Response from POST /ops/compact. */
export interface CompactionResponse {
  job_id: string;
  message: string;
}

// ────────────────────────────────────────────────────────────
// Phase 3 — Engine Parity
// ────────────────────────────────────────────────────────────

/** GET /v1/namespaces/{namespace}/fulltext/stats */
export interface FullTextIndexStats {
  /** Number of documents in the full-text index. */
  document_count: number;
  /** Number of unique terms across all documents. */
  unique_terms: number;
  /** Average document length (in terms). */
  avg_doc_length: number;
}

/** Request body for POST /v1/namespaces/{namespace}/fulltext/delete */
export interface FulltextDeleteRequest {
  /** IDs of documents to delete from the full-text index. */
  ids: string[];
}

/** Response from POST /v1/namespaces/{namespace}/fulltext/delete */
export interface FulltextDeleteResponse {
  /** Number of documents deleted. */
  deleted_count: number;
}

/** Per-namespace TTL statistics. */
export interface TtlNamespaceStats {
  namespace: string;
  vectors_with_ttl: number;
  expiring_within_hour: number;
  expiring_within_day: number;
  expired_pending_cleanup: number;
}

/** Response from GET /admin/ttl/stats */
export interface TtlStatsResponse {
  namespaces: TtlNamespaceStats[];
  total_with_ttl: number;
  total_expired: number;
  /** Server v0.12.2+: namespaces left out (absent when every namespace answered). */
  unavailable?: UnavailableNamespace[];
}

/** Response from POST /v1/admin/ttl/cleanup */
export interface TtlCleanupResponse {
  success: boolean;
  vectors_removed: number;
  namespaces_cleaned: string[];
  message: string;
}

/** A single route match from the query router. */
export interface RouteMatch {
  namespace: string;
  similarity: number;
  description?: string;
}

/** Response from POST /v1/route */
export interface RouteResponse {
  routes: RouteMatch[];
  model: string;
  embedding_time_ms: number;
}

/** Request body for POST /v1/route */
export interface RouteRequest {
  query: string;
  top_k?: number;
  min_similarity?: number;
  model?: string;
}

/** Response from GET /v1/import/{job_id}/status */
export interface ImportJobStatus {
  job_id: string;
  status: string;
  format: string;
  total: number;
  imported: number;
  skipped: number;
  errors: string[];
  started_at: number;
  finished_at?: number;
}

/** Information about a storage tier. */
export interface TierInfo {
  name: string;
  tier_type: string;
  technology: string;
  description: string;
  target_latency: string;
  capacity?: string;
  status: string;
  current_count: number;
  hit_count: number;
  hit_rate: number;
}

/** Storage tier configuration. */
export interface TierConfig {
  hot_tier_capacity: number;
  hot_to_warm_threshold_secs: number;
  warm_to_cold_threshold_secs: number;
  auto_tier_enabled: boolean;
  tier_check_interval_secs: number;
}

/** Storage tier activity metrics. */
export interface TierActivity {
  promotions: number;
  demotions: number;
  cache_hit_rate: number;
  storage_backend: string;
  promotions_to_hot: number;
  demotions_to_warm: number;
  demotions_to_cold: number;
}

/** Response from GET /admin/storage/tiers */
export interface StorageTierOverview {
  tiers_enabled: boolean;
  architecture: TierInfo[];
  config: TierConfig;
  activity: TierActivity;
  /** Server v0.12.2+: namespaces left out (absent when every namespace answered). */
  unavailable?: UnavailableNamespace[];
}

/** Response from GET /admin/memory-type-stats */
export interface MemoryTypeStatsResponse {
  total: number;
  working: number;
  episodic: number;
  semantic: number;
  procedural: number;
  agent_namespaces: number;
  /** Server v0.12.2+: namespaces left out (absent when every namespace answered). */
  unavailable?: UnavailableNamespace[];
}

/** Request body for POST /admin/namespaces/migrate-dimensions */
export interface MigrateNamespaceDimensionsRequest {
  namespaces?: string[];
  target_dimension?: number;
}

/** Result of migrating a single namespace's dimensions. */
export interface NamespaceMigrationResult {
  namespace: string;
  original_dimension: number;
  vectors_migrated: number;
  vectors_skipped: number;
  status: string;
  error?: string;
}

/** Response from POST /admin/namespaces/migrate-dimensions */
export interface MigrateDimensionsResponse {
  migrated: number;
  failed: number;
  already_current: number;
  results: NamespaceMigrationResult[];
}

/** Request body for POST /admin/reembed/drain (all fields optional, v0.11.82+) */
export interface DrainReembedRequest {
  /** Hard wall-clock cap in seconds (default 600). */
  timeout_secs?: number;
  /** Candidates upgraded per cycle (default 10000). */
  batch_size?: number;
  /** Min importance to upgrade (default 0.0 — upgrade all statics). */
  min_importance?: number;
}

/** Response from POST /admin/reembed/drain (v0.11.82+) */
export interface DrainReembedResponse {
  /** Total vectors upgraded across all cycles. */
  processed: number;
  /** Static candidates still remaining (0 on a full drain). */
  remaining: number;
  /** Wall-clock duration of the drain in milliseconds. */
  elapsed_ms: number;
  /** Number of upgrade cycles executed. */
  cycles: number;
  /** True if the drain stopped on the timeout rather than reaching zero. */
  timed_out: boolean;
}

/** Response from GET /admin/reembed/static-count (v0.11.91+) */
export interface StaticCountResponse {
  /** Number of static vectors pending re-embedding. 0 means steady state. */
  static_count: number;
}

// =============================================================================
// T-I-F Reliability Scoring (Phase 3 T-I-F RFC)
// =============================================================================

/** Classification labels from a TifScore. */
export type TifClassification =
  | 'surface_contradiction'
  | 'ask_clarification'
  | 'confident_reuse'
  | 'verify_before_use';

/**
 * Truth-Indeterminacy-Falsity reliability score for a memory (T-I-F RFC Phase 3).
 *
 * All three proportions (truth / indeterminacy / falsity) sum to 1.0.
 * Build via {@link computeTifScore} from a {@link FeedbackHistoryResponse}, or
 * deserialise from stored metadata with {@link tifScoreFromMetadata}.
 */
export interface TifScore {
  /** Proportion of positive feedback signals (upvote / positive). */
  truth: number;
  /** Proportion of uncertainty signals (flag). */
  indeterminacy: number;
  /** Proportion of negative feedback signals (downvote / negative). */
  falsity: number;
  /** Total feedback events used to compute this score. */
  feedbackCount: number;
  /** Human-readable reliability classification derived from the proportions. */
  classification: TifClassification;
}

function classifyTif(truth: number, indeterminacy: number, falsity: number): TifClassification {
  if (falsity >= 0.5) return 'surface_contradiction';
  if (indeterminacy >= 0.5) return 'ask_clarification';
  if (truth >= 0.7) return 'confident_reuse';
  return 'verify_before_use';
}

/**
 * Compute a {@link TifScore} from a memory's {@link FeedbackHistoryResponse}.
 *
 * Signals bucketed as:
 * - `upvote` / `positive`   → truth
 * - `downvote` / `negative` → falsity
 * - `flag`                  → indeterminacy
 *
 * When there is no feedback the score is
 * `{ truth: 0, indeterminacy: 1, falsity: 0, feedbackCount: 0 }`.
 */
export function computeTifScore(history: FeedbackHistoryResponse): TifScore {
  let upvotes = 0;
  let downvotes = 0;
  let flags = 0;
  for (const entry of history.entries) {
    if (entry.signal === 'upvote' || entry.signal === 'positive') upvotes++;
    else if (entry.signal === 'downvote' || entry.signal === 'negative') downvotes++;
    else if (entry.signal === 'flag') flags++;
  }
  const total = upvotes + downvotes + flags;
  if (total === 0) {
    return { truth: 0, indeterminacy: 1, falsity: 0, feedbackCount: 0, classification: 'ask_clarification' };
  }
  const baseIndeterminacy = total < 3 ? (3 - total) * 0.25 : 0;
  let truth = upvotes / total;
  let falsity = downvotes / total;
  let indeterminacy = flags / total + baseIndeterminacy;
  const sum = truth + falsity + indeterminacy;
  truth /= sum;
  falsity /= sum;
  indeterminacy /= sum;
  return { truth, indeterminacy, falsity, feedbackCount: total, classification: classifyTif(truth, indeterminacy, falsity) };
}

/**
 * Deserialise a {@link TifScore} from a `metadata.reliability` object.
 *
 * Expected keys: `truth`, `indeterminacy`, `falsity`, `feedback_count` (snake_case as stored).
 */
export function tifScoreFromMetadata(data: Record<string, unknown>): TifScore {
  const truth = Number(data['truth'] ?? 0);
  const indeterminacy = Number(data['indeterminacy'] ?? 0);
  const falsity = Number(data['falsity'] ?? 0);
  const feedbackCount = Number(data['feedback_count'] ?? 0);
  return { truth, indeterminacy, falsity, feedbackCount, classification: classifyTif(truth, indeterminacy, falsity) };
}

// =============================================================================
// Server v0.12.0 — attachments, transcription, image indexing, records
// =============================================================================

/** One attachment of a namespace (`GET /v1/namespaces/{ns}/attachments`). */
export interface AttachmentEntry {
  /** `sha256:<hex of the bytes>` — what a memory's `attachment_ref` carries. */
  attachment_ref: string;
  content_type: string;
  size_bytes: number;
}

/** Response of `POST /v1/namespaces/{ns}/attachments` (201 new, 200 already held). */
export interface AttachmentUploadResponse extends AttachmentEntry {
  /** `false` when the namespace already held these bytes (the upload was a no-op). */
  created: boolean;
}

/** Response of `GET /v1/namespaces/{ns}/attachments`. */
export interface AttachmentListResponse {
  attachments: AttachmentEntry[];
}

/** Bytes of an attachment, with the media type it was uploaded with. */
export interface AttachmentDownload {
  data: Uint8Array;
  content_type: string;
  /** The ETag (the hash), without quotes, when the server sent one. */
  etag?: string;
}

/** Input accepted as attachment bytes by `uploadAttachment`. */
export type AttachmentBytes = Uint8Array | ArrayBuffer | Blob;

/**
 * Body of `POST .../attachments/{ref}/transcribe` and `.../index`: the memory
 * the result becomes. Same fields and defaults as a memory store, minus the
 * content (that is the transcript / caption).
 */
export interface AttachmentJobRequest {
  /** The agent whose memory the job stores (required). */
  agent_id: string;
  /** Custom memory id; else one is derived deterministically from the request. */
  id?: string;
  memory_type?: MemoryType;
  session_id?: string;
  importance?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
  ttl_seconds?: number;
  expires_at?: number;
  /** Language of the transcript / caption for write-time derivations. */
  lang?: string;
}

/** Body of `POST .../attachments/{ref}/transcribe` (WAV audio; English-only model). */
export type TranscribeRequest = AttachmentJobRequest;

/** Body of `POST .../attachments/{ref}/index` (PNG image; needs `DAKERA_VISION`). */
export interface IndexImageRequest extends AttachmentJobRequest {
  /** Caption stored as the memory text (default `[image sha256:...]`); not what is embedded. */
  content?: string;
}

/** The 202 body of the transcribe and image-index routes. */
export interface AttachmentJobAccepted {
  job_id: string;
  attachment_ref: string;
  agent_id: string;
  /** The memory the job stores; look it up with this id after a server restart. */
  memory_id: string;
  /** Wire name of the model the job runs. */
  model: string;
  /** Route to poll (`GET`). */
  status_url: string;
}

/** Status of a transcription / image-index job. Jobs live in server memory. */
export type AttachmentJob = JobInfo;

/** Options for `waitForAttachmentJob`. */
export interface WaitForJobOptions {
  /** Poll interval in ms (default 1000). */
  intervalMs?: number;
  /** Give up after this many ms (default 600000). */
  timeoutMs?: number;
}

/** Options for `waitUntilReady`. */
export interface WaitUntilReadyOptions {
  /** Poll interval in ms (default 1000). */
  intervalMs?: number;
  /** Give up after this many ms (default 120000). */
  timeoutMs?: number;
}

/** One extra representation of a record on the write path (`POST .../records`). */
export interface RepresentationInput {
  /** Slot name, unique within the record; never `"dense"`; `colbert.fde` / `patch.fde` are server-derived. */
  name: string;
  /** `dense` | `token_multivector` | `patch_multivector` (default `dense`). */
  kind?: RepresentationKind;
  /** Registry name of the model that produced the vectors; empty = the namespace default. */
  model?: string;
  /** The vectors, row-major; every row the same non-zero length. */
  vectors: number[][];
  /** On-disk packing: `f32` (lossless, default), `f16` or `i8`. */
  store_as?: BlockDType;
}

/** One record on the write path: one primary vector plus named representations. */
export interface RecordInput {
  id: string;
  /** The primary dense vector — the one that is indexed and searched. */
  values: number[];
  representations?: RepresentationInput[];
  metadata?: Record<string, unknown>;
  ttl_seconds?: number;
}

/** Response of `POST /v1/namespaces/{ns}/records`. */
export interface RecordUpsertResponse {
  upserted_count: number;
}

/** What a record carries in one slot (`GET .../records/{id}`). */
export interface RepresentationInfo {
  name: string;
  kind: RepresentationKind;
  model?: string;
  dim: number;
  count: number;
  dtype: BlockDType;
  /** Packed size on disk. */
  bytes: number;
  /** Decoded rows — only with `includeVectors`. */
  vectors?: number[][];
}

/** Response of `GET /v1/namespaces/{ns}/records/{id}`. */
export interface RecordView {
  id: string;
  /** The primary vector — only with `includeVectors`. */
  values?: number[];
  dimension: number;
  representations?: RepresentationInfo[];
  /** Slots written by a newer server that this one skipped. */
  unsupported_representations?: number;
  metadata?: Record<string, unknown>;
  ttl_seconds?: number;
  expires_at?: number;
}

// =============================================================================
// Server v0.12.2: runtime config, derived-data reconciliation
// =============================================================================

/**
 * The runtime configuration document (`GET` / `PUT /admin/config`). Typed for
 * the fields the SDK documents; every other field the server sends is kept.
 */
export interface AdminConfig {
  /**
   * Server v0.12.2+: seconds of inactivity after which the server ends an open
   * session that did not set its own timeout (`0` = never; at most 2592000).
   * `DAKERA_SESSION_IDLE_TIMEOUT_SECS` at startup, 14400 (4 h) by default.
   */
  session_idle_timeout_secs?: number;
  /** Live settings changed through `PUT /admin/config` (re-applied at startup). */
  runtime_overrides?: string[];
  /**
   * Server v0.12.3+: autopilot settings set through `PUT /admin/autopilot/config`
   * (`autopilot_dedup_mode`, `autopilot_dedup_cross_session`,
   * `autopilot_consolidate_cross_session`, `autopilot_trash_retention_hours`);
   * absent until set there (the environment rules).
   */
  autopilot_dedup_mode?: AutoPilotDedupMode | (string & {});
  autopilot_dedup_cross_session?: boolean;
  autopilot_consolidate_cross_session?: boolean;
  autopilot_trash_retention_hours?: number;
  [key: string]: unknown;
}

/**
 * Answer of `PUT /admin/config` (`updateConfig()`): `{success, config,
 * message, warnings?}`. Typed as an {@link AdminConfig} too for source
 * compatibility with SDK releases that declared that return type; read the
 * applied configuration from `config`.
 */
export interface AdminConfigUpdateResponse extends AdminConfig {
  success?: boolean;
  /** The configuration after the update. */
  config?: AdminConfig;
  message?: string;
  /** Unknown or invalid keys the server did not apply. */
  warnings?: string[];
}

// =============================================================================
// Deduplicated memories (server v0.12.3+, Dakera-AI/dakera#930)
// =============================================================================

/** Which pass deleted a {@link DeduplicatedMemory}. */
export type DeduplicatedKind = 'deduplication' | 'consolidation';

/**
 * A memory deduplication or consolidation deleted that can still be restored
 * (`GET /v1/memory/deduplicated`).
 */
export interface DeduplicatedMemory {
  /** The deleted memory's id (restore it under this id). */
  id: MemoryId;
  /** Which pass deleted it. */
  kind: DeduplicatedKind | (string & {});
  /** The memory it was folded (deduplication) or merged (consolidation) into. */
  survivor_id: MemoryId;
  /** Its session, if it had one. */
  session_id?: string;
  /** When it was deleted (Unix seconds). */
  deleted_at: number;
  /** Until when it can be restored (Unix seconds); purged after. */
  restorable_until: number;
}

/** Answer of `GET /v1/memory/deduplicated?agent_id=`. */
export interface DeduplicatedListResponse {
  agent_id: string;
  /** Restorable memories, newest first. */
  memories: DeduplicatedMemory[];
  count: number;
}

/** Derived data still owed (part of {@link DerivationStatus}). */
export interface DerivationOwed {
  /** Sentences marked parents call for with no child yet. */
  pending_sentences: number;
  /** Parents with at least one pending sentence. */
  pending_parents: number;
  /** Memories with text and no derivation marker. */
  unmarked_parents: number;
  /** Children whose sentence the parent's text no longer has. */
  stale_children: number;
  /** Children whose parent is not stored. */
  orphan_children: number;
  /** Kept children whose inherited fields are out of date. */
  remeta_children: number;
  /** Second children of one sentence. */
  duplicate_children: number;
  /** Children without a marker under a marked parent. */
  legacy_children: number;
  /** Memory records missing from the full-text index. */
  bm25_missing: number;
  /** Memories whose graph edges are owed and not queued. */
  graph_owed: number;
}

/** The node's one-time derivation heal. */
export interface DerivationHealState {
  version: number;
  complete: boolean;
  /** The namespace being healed. */
  namespace: string | null;
  /** The last parent of `namespace` handled. */
  cursor: string | null;
  parents_healed: number;
  graph_adopted: number;
  started_at: number | null;
  completed_at: number | null;
}

/** The derivation reconciler's state. */
export interface DerivationReconcilerStatus {
  /** `idle`, `waiting`, `standby`, `deferred`, `running` or `sleeping`. */
  state: string;
  /** Unix seconds of the last tick. */
  last_tick_at: number | null;
  ticks: number;
  /** The namespace the round-robin visits next. */
  next_namespace: string | null;
}

/** Derivation counters since the process started. */
export interface DerivationCounters {
  derived: number;
  adopted: number;
  rewritten: number;
  deleted_stale: number;
  deleted_orphans: number;
  recheck_deleted: number;
  retries: number;
  deferred: number;
  stamped: number;
  superseded: number;
  bm25_restored: number;
  graph_rebuilds: number;
  graph_adopted: number;
}

/** Response from `GET /admin/derivations/status` (server v0.12.2+). */
export interface DerivationStatus extends DerivationOwed {
  /** Nothing owed, nothing in flight, the graph edge queue empty. */
  settled: boolean;
  /** Derivation runs in flight. */
  in_flight: number;
  /** Memories whose edges the edge queue holds. */
  graph_queue_owed: number;
  /** Namespaces marked for the reconciler. */
  dirty_namespaces: string[];
  /** Agent namespaces counted. */
  namespaces: number;
  /** Namespaces whose index could not be built (not counted). */
  unreadable_namespaces: string[];
  /** This node's heal; `null` until loaded. */
  heal: DerivationHealState | null;
  reconciler: DerivationReconcilerStatus;
  counters: DerivationCounters;
}

/** Body of `POST /admin/derivations/drain` (server v0.12.2+). */
export interface DrainDerivationsRequest {
  /** Default 600, capped by the server at 4/5 of its request timeout. Not sent when undefined. */
  timeout_secs?: number;
}

/** Response from `POST /admin/derivations/drain` (server v0.12.2+). */
export interface DrainDerivationsResponse {
  /** Whether nothing is owed any more. */
  settled: boolean;
  /** `true` only when it stopped on the timeout unsettled. */
  timed_out: boolean;
  rounds: number;
  elapsed_ms: number;
  /** Parents run by the drain. */
  parents_run: number;
  /** Sentences the last round could not derive. */
  pending_left: number;
  /** Stale, orphaned and duplicate children deleted. */
  deleted: number;
  /** Full-text documents restored. */
  bm25_restored: number;
  /** Memories queued for a graph-edge rebuild. */
  graph_queued: number;
  /** The status after the drain. */
  status: DerivationStatus;
}

// =============================================================================
// Document import (server v0.12.3+, Dakera-AI/dakera#923)
// =============================================================================

/** User-metadata key every document chunk memory carries ({@link DocumentChunkMeta}). */
export const DOCUMENT_META_KEY = '_dakera_document';

/** Prefix of the tag every chunk of a document carries: `document:<document_id>`. */
export const DOCUMENT_TAG_PREFIX = 'document:';

/** Media types `POST /v1/memory/documents` accepts as text (`text/plain` is the default). */
export type DocumentTextMediaType = 'text/plain' | 'text/markdown' | 'text/html';

/** Every {@link DocumentTextMediaType}. */
export const DOCUMENT_TEXT_MEDIA_TYPES: readonly DocumentTextMediaType[] = [
  'text/plain',
  'text/markdown',
  'text/html',
];

/**
 * How the extracted text is split: `structure` (default: sections at
 * headings, then paragraphs, sentences, words) or `fixed` (plain token
 * windows with overlap; headings are text).
 */
export type ChunkStrategy = 'structure' | 'fixed';

/**
 * The `chunking` field of an import request. The server refuses any other
 * field with 422 (`deny_unknown_fields`); the SDK refuses it before sending.
 */
export interface ChunkingOptions {
  /**
   * Token budget of one chunk's text (default `DAKERA_DOCUMENT_CHUNK_TOKENS`,
   * 400), clamped to the embedding model's token cap.
   */
  max_tokens?: number;
  /**
   * Tokens repeated from the end of the previous chunk (default
   * `DAKERA_DOCUMENT_CHUNK_OVERLAP_TOKENS`, 50; at most a quarter of the budget).
   */
  overlap_tokens?: number;
  /** `structure` (default) or `fixed`. */
  strategy?: ChunkStrategy;
}

/**
 * Fields both import requests share: what every chunk memory carries (as on
 * `POST /v1/memory/store`), the chunking options and `decompose`. Undefined
 * fields are not sent (the server defaults apply).
 */
export interface DocumentImportCommon {
  /** Memory type of every chunk (server default `episodic`). */
  memory_type?: MemoryType;
  /** Session every chunk belongs to. */
  session_id?: string;
  /** Importance of every chunk, 0–1 (server default 0.5). */
  importance?: number;
  /** Tags of every chunk; the server adds `document:<document_id>`. */
  tags?: string[];
  /** User metadata of every chunk; the server adds `_dakera_document`. */
  metadata?: Record<string, unknown>;
  /** Time to live of every chunk, in seconds. */
  ttl_seconds?: number;
  /** Expiry of every chunk (unix seconds). */
  expires_at?: number;
  /** Language of the document for the write-time derivations. */
  lang?: string;
  /** Chunking options ({@link ChunkingOptions}). */
  chunking?: ChunkingOptions;
  /**
   * Derive CE-31 sentence sub-memories from every chunk (default `false`: a
   * chunk is already a retrieval unit, and up to 16 sentences per chunk would
   * multiply the index up to 17-fold).
   */
  decompose?: boolean;
}

/**
 * Body of `POST /v1/memory/documents` (without `agent_id`, which is the
 * method's first argument): a document given as text.
 */
export interface ImportDocumentRequest extends DocumentImportCommon {
  /** The document itself (at most `DAKERA_DOCUMENT_MAX_BYTES` bytes, default 25 MiB). */
  content: string;
  /** `text/plain` (default), `text/markdown` or `text/html`. */
  media_type?: DocumentTextMediaType;
  /**
   * Title (else taken from the document: Markdown front matter or first `#`
   * heading, HTML `<title>`). The root of every chunk's breadcrumb.
   */
  title?: string;
  /**
   * Document id. Default: derived from the agent and the content's SHA-256,
   * so importing the same bytes again replaces the document with itself.
   */
  document_id?: string;
}

/**
 * Body of `POST /v1/namespaces/{ns}/attachments/{ref}/document` (without
 * `agent_id`). The format comes from the attachment's stored media type: PDF,
 * DOCX, HTML, Markdown or text.
 */
export interface ImportAttachmentDocumentRequest extends DocumentImportCommon {
  /** Title (else taken from the document: PDF `Title`, DOCX `dc:title`, ...). */
  title?: string;
  /** Document id. Default: derived from the agent and the attachment's content hash. */
  document_id?: string;
}

/** `202` answer of both import routes. */
export interface ImportDocumentAccepted {
  job_id: string;
  document_id: string;
  agent_id: string;
  /** Route to poll for the job (`GET`, a key that may read the agent). */
  status_url: string;
}

/** State of a document import job. */
export type DocumentJobStatus = 'Pending' | 'Running' | 'Completed' | 'Failed' | 'Cancelled';

/**
 * A document import job (`GET /v1/memory/documents/jobs/{job_id}`), the
 * server's job record.
 */
export interface DocumentImportJob {
  id: string;
  /** `document_import`. */
  job_type: string;
  status: DocumentJobStatus;
  /** Unix seconds. */
  created_at: number;
  started_at?: number | null;
  completed_at?: number | null;
  /** 0–100. */
  progress: number;
  /**
   * Progress (`chunks_stored n/total`) or, when completed, what the import did
   * (`document imported: N chunks (W written, U unchanged, S stale removed)`).
   */
  message?: string | null;
  /**
   * `namespace`, `agent_id`, `document_id`, and for an attachment import
   * `source_namespace` and `attachment_ref`.
   */
  metadata: Record<string, string>;
  /**
   * Why a `Failed` job failed: the HTTP status and error code the request
   * would have answered (413 too big / too many chunks, 422
   * `UNPROCESSABLE_CONTENT`, 504 `EXTRACTION_TIMEOUT`, ...).
   */
  error?: { status: number; code: string };
}

/**
 * What `_dakera_document` holds on every chunk memory. The document-level
 * fields are repeated on every chunk, so one chunk describes its document.
 */
export interface DocumentChunkMeta {
  /** The document id. */
  id: string;
  title?: string;
  media_type: string;
  /** Position of this chunk, from 0. */
  chunk_index: number;
  /** Chunks of the document. */
  chunk_count: number;
  /** First page the chunk's text comes from (PDF; form-feed pages of plain text). */
  page_start?: number;
  /** Last page the chunk's text comes from. */
  page_end?: number;
  /** Headings above the chunk, outermost first (the title included). */
  heading_path: string[];
  /** Character range of the chunk's text in the extracted text. */
  char_start: number;
  char_end: number;
  /** SHA-256 (hex) of the source document's bytes. */
  sha256: string;
  /** Bytes of the source document. */
  bytes: number;
  /** Pages of the source document, when it has pages. */
  pages?: number;
  /** When the document was first imported (unix seconds). */
  created_at: number;
  /** When the document was last imported (unix seconds). */
  updated_at: number;
  /** Whether CE-31 sentence sub-memories are derived from this chunk (absent = false). */
  decompose?: boolean;
  /** Hash of everything the chunk memory was written from. */
  fingerprint?: string;
}

/** One document of `GET /v1/memory/documents`. */
export interface DocumentSummary {
  document_id: string;
  title?: string;
  media_type: string;
  chunk_count: number;
  bytes: number;
  pages?: number;
  /** Unix seconds. */
  created_at: number;
  /** Unix seconds. */
  updated_at: number;
  sha256: string;
  /** The attachment the document was imported from. */
  attachment_ref?: string;
}

/** `GET /v1/memory/documents` answer. */
export interface DocumentListResponse {
  /** Sorted by document id. */
  documents: DocumentSummary[];
  /** Pass as `cursor` for the next page; absent on the last one. */
  next_cursor?: string;
}

/** Options of {@link DakeraClient.listDocuments}. */
export interface ListDocumentsOptions {
  /** The `next_cursor` of the previous page. */
  cursor?: string;
  /** Page size, 1–500 (server default 50). */
  limit?: number;
}

/** One chunk of `GET /v1/memory/documents/{id}`. */
export interface DocumentChunkInfo {
  /** The chunk's memory id (`doc_<hash>`). */
  id: string;
  chunk_index: number;
  page_start?: number;
  page_end?: number;
  heading_path: string[];
  char_start: number;
  char_end: number;
}

/** `GET /v1/memory/documents/{id}` answer: one document and its chunks. */
export interface DocumentDetail {
  document: DocumentSummary;
  chunks: DocumentChunkInfo[];
}

/** `DELETE /v1/memory/documents/{id}` answer. */
export interface DeleteDocumentResponse {
  document_id: string;
  /** Chunk memories removed. */
  deleted_chunks: number;
}

/** Options of {@link DakeraClient.waitForDocumentJob}. */
export interface WaitForDocumentJobOptions {
  /** Poll interval in ms (default 1000). */
  intervalMs?: number;
  /** Give up after this many ms with a `TimeoutError` (default 600000). */
  timeoutMs?: number;
  /** Stop waiting (and abort the poll in flight) when this signal aborts. */
  signal?: AbortSignal;
}

/**
 * The `_dakera_document` metadata of a memory (a recall or search result, a
 * listed or fetched memory) when it is a document chunk; `undefined`
 * otherwise, or when the value does not have the chunk shape. Only own
 * properties are read.
 *
 * @example
 * ```ts
 * for (const m of (await client.recall('docs-bot', 'install on linux')).memories) {
 *   const doc = documentChunkMeta(m);
 *   if (doc) console.log(`${doc.title} p.${doc.page_start ?? '-'} › ${doc.heading_path.join(' › ')}`);
 * }
 * ```
 */
export function documentChunkMeta(
  memory: { metadata?: Record<string, unknown> | null } | null | undefined,
): DocumentChunkMeta | undefined {
  const metadata = memory?.metadata;
  if (metadata === null || typeof metadata !== 'object') return undefined;
  if (!Object.prototype.hasOwnProperty.call(metadata, DOCUMENT_META_KEY)) return undefined;
  const raw = (metadata as Record<string, unknown>)[DOCUMENT_META_KEY];
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const m = raw as Record<string, unknown>;
  const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  if (
    typeof m.id !== 'string' ||
    typeof m.media_type !== 'string' ||
    !isNum(m.chunk_index) ||
    !isNum(m.chunk_count) ||
    !isNum(m.char_start) ||
    !isNum(m.char_end)
  ) {
    return undefined;
  }
  const meta: DocumentChunkMeta = {
    id: m.id,
    media_type: m.media_type,
    chunk_index: m.chunk_index,
    chunk_count: m.chunk_count,
    heading_path: Array.isArray(m.heading_path)
      ? m.heading_path.filter((h): h is string => typeof h === 'string')
      : [],
    char_start: m.char_start,
    char_end: m.char_end,
    sha256: typeof m.sha256 === 'string' ? m.sha256 : '',
    bytes: isNum(m.bytes) ? m.bytes : 0,
    created_at: isNum(m.created_at) ? m.created_at : 0,
    updated_at: isNum(m.updated_at) ? m.updated_at : 0,
  };
  if (typeof m.title === 'string') meta.title = m.title;
  if (isNum(m.page_start)) meta.page_start = m.page_start;
  if (isNum(m.page_end)) meta.page_end = m.page_end;
  if (isNum(m.pages)) meta.pages = m.pages;
  if (typeof m.decompose === 'boolean') meta.decompose = m.decompose;
  if (typeof m.fingerprint === 'string') meta.fingerprint = m.fingerprint;
  return meta;
}
