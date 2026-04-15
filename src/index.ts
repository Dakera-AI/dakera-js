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

// Branded ID types and factory helpers
export type { VectorId, AgentId, MemoryId, SessionId, Branded } from './types';
export { vectorId, agentId, memoryId, sessionId } from './types';

// Types
export type {
  // Retry & timeout configuration
  RetryConfig,
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
  RecallResponse,
  StoreMemoryResponse,
  UpdateMemoryRequest,
  RecallRequest,
  UpdateImportanceRequest,
  ConsolidateRequest,
  ConsolidateResponse,
  MemoryFeedbackRequest,
  MemoryFeedbackResponse,
  // Batch memory operations (CE-2)
  BatchMemoryFilter,
  BatchRecallRequest,
  BatchRecallResponse,
  BatchForgetRequest,
  BatchForgetResponse,
  // Rate-limit headers (OPS-1)
  RateLimitHeaders,
  // Session types
  StartSessionRequest,
  Session,
  SessionStartResponse,
  SessionEndResponse,
  ListSessionsOptions,
  // Agent types
  AgentSummary,
  AgentStats,
  WakeUpOptions,
  WakeUpResponse,
  // CE-10
  RoutingMode,
  // CE-14
  FusionStrategy,
  // CE-12
  CompressResponse,
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
  OpsStats,
  ClusterStatus,
  ClusterNode,
  CacheStats,
  SlowQuery,
  BackupInfo,
  TtlConfig,
  // AutoPilot types (PILOT-1/2/3)
  AutoPilotConfig,
  DedupResultSnapshot,
  ConsolidationResultSnapshot,
  AutoPilotStatusResponse,
  AutoPilotConfigRequest,
  AutoPilotConfigResponse,
  AutoPilotTriggerAction,
  AutoPilotDedupResult,
  AutoPilotConsolidationResult,
  AutoPilotTriggerResponse,
  // Decay Engine types (DECAY-1 / DECAY-2)
  DecayConfigResponse,
  DecayConfigUpdateRequest,
  DecayConfigUpdateResponse,
  LastDecayCycleStats,
  DecayStatsResponse,
  // Product KPI Snapshot (OBS-2)
  KpiSnapshot,
  // API Key types
  ApiKey,
  CreateKeyRequest,
  KeyUsage,
  // SSE Streaming types
  OpStatus,
  VectorMutationOp,
  DakeraEvent,
  NamespaceCreatedEvent,
  NamespaceDeletedEvent,
  OperationProgressEvent,
  JobProgressEvent,
  VectorsMutatedEvent,
  StreamLaggedEvent,
  // DASH-B: Memory event stream types
  MemoryEvent,
  // DASH-A: Cross-agent network types
  AgentNetworkInfo,
  AgentNetworkNode,
  AgentNetworkEdge,
  AgentNetworkStats,
  CrossAgentNetworkResponse,
  CrossAgentNetworkRequest,
  // Namespace configuration (v0.6.0)
  ConfigureNamespaceRequest,
  ConfigureNamespaceResponse,
  // Memory Knowledge Graph types (CE-5 / SDK-9)
  EdgeType,
  GraphEdge,
  GraphNode,
  MemoryGraph,
  MemoryGraphOptions,
  GraphPath,
  GraphLinkResponse,
  GraphExport,
  // KG-2: Graph Query & Export types
  KgQueryResponse,
  KgPathResponse,
  KgExportResponse,
  // Entity Extraction types (CE-4)
  NamespaceNerConfig,
  ExtractedEntity,
  EntityExtractionResponse,
  MemoryEntitiesResponse,
  // Memory Feedback Loop (INT-1)
  FeedbackSignal,
  FeedbackHistoryEntry,
  MemoryFeedbackBodyRequest,
  MemoryImportancePatchRequest,
  FeedbackResponse,
  FeedbackHistoryResponse,
  AgentFeedbackSummary,
  FeedbackHealthResponse,
  // Namespace API Keys (SEC-1)
  NamespaceKeyInfo,
  CreateNamespaceKeyResponse,
  ListNamespaceKeysResponse,
  NamespaceKeyUsageResponse,
  // DBSCAN Adaptive Consolidation (CE-6)
  ConsolidationConfig,
  ConsolidationLogEntry,
  // Memory Import / Export (DX-1)
  MemoryImportResponse,
  MemoryExportResponse,
  // Business-Event Audit Log (OBS-1)
  AuditEvent,
  AuditListResponse,
  AuditExportResponse,
  // External Extraction Providers (EXT-1)
  ExtractionResult,
  ExtractionProviderInfo,
  // AES-256-GCM Encryption Key Rotation (SEC-3)
  RotateEncryptionKeyRequest,
  RotateEncryptionKeyResponse,
  // GLiNER Entity Extraction via ODE sidecar (ODE-2)
  OdeEntity,
  ExtractEntitiesRequest,
  ExtractEntitiesResponse,
  // COG-1: Cognitive Memory Lifecycle
  DecayStrategyName,
  MemoryPolicy,
} from './types';

// Errors
export {
  ErrorCode,
  DakeraError,
  ConnectionError,
  NotFoundError,
  ValidationError,
  RateLimitError,
  ServerError,
  AuthenticationError,
  AuthorizationError,
  TimeoutError,
} from './errors';
