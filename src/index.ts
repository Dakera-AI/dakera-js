/**
 * Dakera TypeScript SDK
 *
 * A high-performance TypeScript/JavaScript client for Dakera AI memory platform.
 *
 * @example
 * ```typescript
 * import { DakeraClient } from 'dakera';
 *
 * const client = new DakeraClient('http://localhost:3000');
 *
 * // Upsert vectors
 * await client.upsert('my-namespace', [
 *   { id: 'vec1', values: [0.1, 0.2, 0.3] },
 * ]);
 *
 * // Query similar vectors
 * const results = await client.query('my-namespace', [0.1, 0.2, 0.3], { topK: 10 });
 * ```
 *
 * @packageDocumentation
 */

// Client
export { DakeraClient } from './client';

// Types
export type {
  // Core types
  Vector,
  VectorInput,
  QueryResult,
  SearchResult,
  NamespaceInfo,
  IndexStats,
  Document,
  DocumentInput,
  FullTextSearchResult,
  HybridSearchResult,
  HealthResponse,
  FilterOperators,
  FilterExpression,
  QueryOptions,
  DeleteOptions,
  UpsertOptions,
  UpsertResponse,
  DeleteResponse,
  BatchQuerySpec,
  ClientOptions,
  // Consistency types
  ReadConsistency,
  DistanceMetric,
  StalenessConfig,
  // Cache warming types
  WarmingPriority,
  WarmingTargetTier,
  AccessPatternHint,
  WarmCacheRequest,
  WarmCacheResponse,
  // Text-based inference types (auto-embedding)
  EmbeddingModel,
  TextDocument,
  TextUpsertOptions,
  TextUpsertResponse,
  TextQueryOptions,
  TextQueryResponse,
  TextSearchResult,
  BatchTextQueryOptions,
  BatchTextQueryResponse,
  // Memory types
  MemoryType,
  StoreMemoryRequest,
  Memory,
  RecalledMemory,
  StoreMemoryResponse,
  UpdateMemoryRequest,
  RecallRequest,
  UpdateImportanceRequest,
  ConsolidateRequest,
  ConsolidateResponse,
  MemoryFeedbackRequest,
  MemoryFeedbackResponse,
  // Session types
  StartSessionRequest,
  Session,
  ListSessionsOptions,
  // Agent types
  AgentSummary,
  AgentStats,
  // Knowledge Graph types
  KnowledgeGraphRequest,
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeGraphResponse,
  FullKnowledgeGraphRequest,
  SummarizeRequest,
  SummarizeResponse,
  DeduplicateRequest,
  DeduplicateResponse,
  // Analytics types
  AnalyticsOverview,
  LatencyAnalytics,
  ThroughputAnalytics,
  StorageAnalytics,
  AnalyticsOptions,
  // Advanced Search types
  MultiVectorSearchRequest,
  MultiVectorSearchResult,
  MultiVectorSearchResponse,
  UnifiedQueryRequest,
  UnifiedSearchResult,
  UnifiedQueryResponse,
  AggregationRequest,
  AggregationGroup,
  AggregationResponse,
  ExportRequest,
  ExportedVector,
  ExportResponse,
  QueryExplainRequest,
  QueryExplainResponse,
  ColumnUpsertRequest,
  // Admin types
  ClusterStatus,
  ClusterNode,
  CacheStats,
  SlowQuery,
  BackupInfo,
  TtlConfig,
  // API Key types
  ApiKey,
  CreateKeyRequest,
  KeyUsage,
} from './types';

// Errors
export {
  DakeraError,
  ConnectionError,
  NotFoundError,
  ValidationError,
  RateLimitError,
  ServerError,
  AuthenticationError,
  TimeoutError,
} from './errors';
