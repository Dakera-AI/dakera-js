/**
 * `GET /v1/capabilities` — what the connected server can do (server v0.12+).
 *
 * R9 / DAK-10004. Contract (server `routes/capabilities.rs`): every field is
 * additive; unknown fields and unknown strings inside lists MUST be ignored;
 * `capabilities_version` bumps only on a breaking reshape of the document.
 * {@link parseCapabilities} is the runtime guard that enforces that contract on
 * the client side: it never throws on a document a newer server sends, and it
 * keeps the verbatim document in `raw`.
 */

import { UnsupportedCapabilityError } from './errors';
import type {
  BlockDType,
  DistanceMetric,
  EmbeddingModel,
  IndexKind,
  RepresentationKind,
  SearchMode,
} from './types';

/** One embedding model the server can load (`capabilities.models[]`). */
export interface ModelCapability {
  /** Wire name — the string accepted/returned in every `model` field. */
  name: EmbeddingModel;
  /** Other spellings accepted on input. */
  aliases: string[];
  dimension: number;
  /** The model's own context window (tokens). */
  max_seq_length: number;
  /** What THIS server embeds before truncating. */
  effective_max_seq_length: number;
  /** Whether this is the model the server embeds with (one per store). */
  active: boolean;
  /** Matryoshka truncation dimensions, when supported. */
  mrl_dimensions?: number[];
  modality: string;
  /** The verbatim server row — carries fields this SDK does not model yet. */
  raw: Record<string, unknown>;
}

/** The R2 record / representation surface (`capabilities.records`). */
export interface RecordCapabilities {
  /** Whether `/v1/namespaces/{ns}/records` answers (else 501 FEATURE_DISABLED). */
  enabled: boolean;
  representation_kinds: RepresentationKind[];
  dtypes: BlockDType[];
  max_representations: number;
  max_vectors: number;
  max_bytes: number;
  raw: Record<string, unknown>;
}

/** The scoring axis and late-interaction lane (`capabilities.scoring`). */
export interface ScoringCapabilities {
  /** `DAKERA_SCORING_STRATEGY` as configured (`single-vector` unless set). */
  strategy: string;
  /** Prose list of accepted strategies, as the server sends it. */
  strategies_accepted: string;
  /** Whether the late-interaction (MaxSim) lane is on. */
  late_interaction_enabled: boolean;
  /** Whether the active model has a late-interaction recipe (e.g. `colbert-small`). */
  late_interaction_model_supported: boolean;
  /** `text` or `visual`. */
  late_interaction_lane: string;
  raw: Record<string, unknown>;
}

/** The speech-to-text surface (`capabilities.attachments.transcription`). */
export interface TranscriptionCapabilities {
  model: string;
  models: string[];
  media_types: string[];
  languages: string[];
  sample_rate_hz: number;
}

/** The attachment lane (`capabilities.attachments`). */
export interface AttachmentCapabilities {
  /** Whether the attachment routes answer (else 501 FEATURE_DISABLED). */
  enabled: boolean;
  /** Largest upload in bytes (`DAKERA_ATTACHMENT_MAX_BYTES`); over it: 413. */
  max_bytes: number;
  transcription: TranscriptionCapabilities;
  raw: Record<string, unknown>;
}

/** The visual lane (`capabilities.vision`). */
export interface VisionCapabilities {
  /** Whether `.../attachments/{ref}/index` answers (`DAKERA_VISION`). */
  enabled: boolean;
  model: string;
  models: string[];
  media_types: string[];
  dimension: number;
  raw: Record<string, unknown>;
}

/** Key and grant surface (`capabilities.auth`, server v0.12.2+). */
export interface AuthCapabilities {
  /** Key grants accept prefix patterns `p*`. */
  prefix_patterns: boolean;
  /** Sessions are authorized by their agent's namespace alone. */
  sessions_by_agent: boolean;
  /** `PATCH /admin/keys/{id}` and `PATCH /v1/namespaces/{ns}/keys/{id}` exist. */
  key_update: boolean;
  /** Largest `grace_secs` a rotation accepts. */
  rotation_grace_max_secs: number;
  /** Most entries in a key's `namespaces`. */
  max_grants: number;
  /** Longest grant entry in bytes. */
  max_grant_len: number;
  raw: Record<string, unknown>;
}

/** Naming rules (`capabilities.naming`, server v0.12.2+). */
export interface NamingCapabilities {
  agent_id_pattern: string;
  agent_id_max_bytes: number;
  agent_namespace_prefix: string;
  agent_namespace_max_bytes: number;
  namespace_pattern: string;
  namespace_max_bytes: number;
  reserved_prefixes: string[];
  internal_namespaces: string[];
  internal_prefixes: string[];
  raw: Record<string, unknown>;
}

/** Session lifecycle (`capabilities.sessions`, server v0.12.2+). */
export interface SessionCapabilities {
  /** The live server-wide idle timeout in seconds (`0` = sessions without their own are never ended). */
  idle_timeout_secs: number;
  /** Largest `idle_timeout_secs` a session may set. */
  max_idle_timeout_secs: number;
  /** `POST /v1/sessions/{id}/touch` exists. */
  touch: boolean;
  /** Sessions carry `ended_reason`. */
  ended_reason: boolean;
  raw: Record<string, unknown>;
}

/** The capabilities document. */
export interface ServerCapabilities {
  capabilities_version: number;
  server_version: string;
  api_versions: string[];
  default_model: EmbeddingModel;
  models: ModelCapability[];
  index_kinds: IndexKind[];
  vector_index_kinds: IndexKind[];
  live_vector_index_kinds: IndexKind[];
  distance_metrics: DistanceMetric[];
  /** The mode this server process runs (`DAKERA_SEARCH_MODE`). */
  search_mode: SearchMode;
  /** Every value the server accepts for `DAKERA_SEARCH_MODE` (aliases expanded). */
  search_modes_accepted: SearchMode[];
  fulltext_language: string;
  on_disk_format_version: number;
  records: RecordCapabilities;
  /** v0.12: scoring strategy and late-interaction lane (empty defaults on older servers). */
  scoring: ScoringCapabilities;
  /** v0.12: attachment / transcription lane. */
  attachments: AttachmentCapabilities;
  /** v0.12: visual (image indexing) lane. */
  vision: VisionCapabilities;
  /** Records this node skipped because a newer Dakera wrote them. */
  unreadable_records: number;
  query_languages: string[];
  /** A model change was acknowledged but the store is not fully re-embedded yet. */
  reembed_pending: boolean;
  /** v0.12.2 (`capabilities_version` 2): key grants and rotation. Undefined on older servers. */
  auth?: AuthCapabilities;
  /** v0.12.2 (`capabilities_version` 2): naming rules. Undefined on older servers. */
  naming?: NamingCapabilities;
  /** v0.12.2 (`capabilities_version` 2): session idle timeout and touch. Undefined on older servers. */
  sessions?: SessionCapabilities;
  /** The verbatim document. */
  raw: Record<string, unknown>;
}

/** Registries a pre-flight check can validate against. */
export type CapabilityKind =
  | 'model'
  | 'index_kind'
  | 'distance_metric'
  | 'search_mode'
  | 'query_language';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function integer(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

/** `{ [key]: value }` when `value` is defined, `{}` otherwise (no `key: undefined`). */
function optional<K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}

/**
 * Parse the server's `search_modes_accepted` field.
 *
 * The server emits it as prose — `"hybrid, binary, float, scalar (alias sq),
 * rabitq"` — so `x (alias y)` yields both `x` and `y`. A JSON list is accepted
 * as well in case the field is ever reshaped into one.
 */
export function parseAcceptedValues(value: unknown): string[] {
  if (Array.isArray(value)) return stringList(value);
  if (typeof value !== 'string') return [];
  const out: string[] = [];
  // One token per match: the value, then an optional "(...)" annotation.
  const re = /([^,()]+)(?:\(([^)]*)\))?/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(value)) !== null) {
    const head = match[1].trim();
    if (head) out.push(head);
    const note = (match[2] ?? '').trim();
    if (/^alias/i.test(note)) {
      let rest = note.slice('alias'.length);
      if (rest.startsWith('es')) rest = rest.slice(2);
      for (const alias of rest.split(/[\s,/]+/)) {
        if (alias) out.push(alias);
      }
    }
  }
  return out;
}

function parseModel(raw: Record<string, unknown>): ModelCapability {
  const mrl = raw.mrl_dimensions;
  return {
    name: text(raw.name),
    aliases: stringList(raw.aliases),
    dimension: integer(raw.dimension),
    max_seq_length: integer(raw.max_seq_length),
    effective_max_seq_length: integer(raw.effective_max_seq_length),
    active: raw.active === true,
    mrl_dimensions: Array.isArray(mrl)
      ? mrl.filter((d): d is number => typeof d === 'number')
      : undefined,
    modality: text(raw.modality, 'text'),
    raw,
  };
}

function parseRecords(raw: unknown): RecordCapabilities {
  const r = isRecord(raw) ? raw : {};
  return {
    enabled: r.enabled === true,
    representation_kinds: stringList(r.representation_kinds),
    dtypes: stringList(r.dtypes),
    max_representations: integer(r.max_representations),
    max_vectors: integer(r.max_vectors),
    max_bytes: integer(r.max_bytes),
    raw: r,
  };
}

function parseScoring(raw: unknown): ScoringCapabilities {
  const r = isRecord(raw) ? raw : {};
  const li = isRecord(r.late_interaction) ? r.late_interaction : {};
  return {
    strategy: text(r.strategy, 'single-vector'),
    strategies_accepted: text(r.strategies_accepted),
    late_interaction_enabled: li.enabled === true,
    late_interaction_model_supported: li.model_supported === true,
    late_interaction_lane: text(li.lane, 'text'),
    raw: r,
  };
}

function parseAttachments(raw: unknown): AttachmentCapabilities {
  const r = isRecord(raw) ? raw : {};
  const t = isRecord(r.transcription) ? r.transcription : {};
  return {
    enabled: r.enabled === true,
    max_bytes: integer(r.max_bytes),
    transcription: {
      model: text(t.model),
      models: stringList(t.models),
      media_types: stringList(t.media_types),
      languages: stringList(t.languages),
      sample_rate_hz: integer(t.sample_rate_hz),
    },
    raw: r,
  };
}

function parseVision(raw: unknown): VisionCapabilities {
  const r = isRecord(raw) ? raw : {};
  return {
    enabled: r.enabled === true,
    model: text(r.model),
    models: stringList(r.models),
    media_types: stringList(r.media_types),
    dimension: integer(r.dimension),
    raw: r,
  };
}

function parseAuth(raw: unknown): AuthCapabilities | undefined {
  if (!isRecord(raw)) return undefined;
  return {
    prefix_patterns: raw.prefix_patterns === true,
    sessions_by_agent: raw.sessions_by_agent === true,
    key_update: raw.key_update === true,
    rotation_grace_max_secs: integer(raw.rotation_grace_max_secs),
    max_grants: integer(raw.max_grants),
    max_grant_len: integer(raw.max_grant_len),
    raw,
  };
}

function parseNaming(raw: unknown): NamingCapabilities | undefined {
  if (!isRecord(raw)) return undefined;
  return {
    agent_id_pattern: text(raw.agent_id_pattern),
    agent_id_max_bytes: integer(raw.agent_id_max_bytes),
    agent_namespace_prefix: text(raw.agent_namespace_prefix, '_dakera_agent_'),
    agent_namespace_max_bytes: integer(raw.agent_namespace_max_bytes),
    namespace_pattern: text(raw.namespace_pattern),
    namespace_max_bytes: integer(raw.namespace_max_bytes),
    reserved_prefixes: stringList(raw.reserved_prefixes),
    internal_namespaces: stringList(raw.internal_namespaces),
    internal_prefixes: stringList(raw.internal_prefixes),
    raw,
  };
}

function parseSessions(raw: unknown): SessionCapabilities | undefined {
  if (!isRecord(raw)) return undefined;
  return {
    idle_timeout_secs: integer(raw.idle_timeout_secs),
    max_idle_timeout_secs: integer(raw.max_idle_timeout_secs),
    touch: raw.touch === true,
    ended_reason: raw.ended_reason === true,
    raw,
  };
}

/**
 * Runtime guard for a capabilities document: tolerates unknown fields, unknown
 * strings inside lists, missing fields and non-object input (→ empty document).
 */
export function parseCapabilities(raw: unknown): ServerCapabilities {
  const doc = isRecord(raw) ? raw : {};
  return {
    capabilities_version: integer(doc.capabilities_version),
    server_version: text(doc.server_version),
    api_versions: stringList(doc.api_versions),
    default_model: text(doc.default_model, 'bge-large'),
    models: Array.isArray(doc.models) ? doc.models.filter(isRecord).map(parseModel) : [],
    index_kinds: stringList(doc.index_kinds),
    vector_index_kinds: stringList(doc.vector_index_kinds),
    live_vector_index_kinds: stringList(doc.live_vector_index_kinds),
    distance_metrics: stringList(doc.distance_metrics),
    search_mode: text(doc.search_mode, 'hybrid'),
    search_modes_accepted: parseAcceptedValues(doc.search_modes_accepted),
    fulltext_language: text(doc.fulltext_language, 'en'),
    on_disk_format_version: integer(doc.on_disk_format_version),
    records: parseRecords(doc.records),
    scoring: parseScoring(doc.scoring),
    attachments: parseAttachments(doc.attachments),
    vision: parseVision(doc.vision),
    unreadable_records: integer(doc.unreadable_records),
    query_languages: stringList(doc.query_languages),
    reembed_pending: doc.reembed_pending === true,
    ...optional('auth', parseAuth(doc.auth)),
    ...optional('naming', parseNaming(doc.naming)),
    ...optional('sessions', parseSessions(doc.sessions)),
    raw: doc,
  };
}

/** Look a model up by wire name or alias. */
export function findModel(
  caps: ServerCapabilities,
  nameOrAlias: string
): ModelCapability | undefined {
  return caps.models.find((m) => m.name === nameOrAlias || m.aliases.includes(nameOrAlias));
}

/** The model the server embeds with (a request naming another is rejected). */
export function activeModel(caps: ServerCapabilities): ModelCapability | undefined {
  return caps.models.find((m) => m.active);
}

/** Wire strings the server advertises for `kind`. */
export function supportedValues(caps: ServerCapabilities, kind: CapabilityKind): string[] {
  switch (kind) {
    case 'model':
      return caps.models.map((m) => m.name);
    case 'index_kind':
      return [...caps.index_kinds];
    case 'distance_metric':
      return [...caps.distance_metrics];
    case 'search_mode':
      return [...caps.search_modes_accepted];
    case 'query_language':
      return [...caps.query_languages];
  }
}

/** Whether the server advertises `value` for `kind` (model aliases count). */
export function supportsCapability(
  caps: ServerCapabilities,
  kind: CapabilityKind,
  value: string
): boolean {
  if (kind === 'model') return findModel(caps, value) !== undefined;
  return supportedValues(caps, kind).includes(value);
}

/**
 * Throw {@link UnsupportedCapabilityError} unless the server advertises
 * `value` for `kind`.
 */
export function requireCapability(
  caps: ServerCapabilities,
  kind: CapabilityKind,
  value: string
): void {
  if (!supportsCapability(caps, kind, value)) {
    throw new UnsupportedCapabilityError(
      kind,
      value,
      supportedValues(caps, kind),
      caps.server_version || undefined
    );
  }
}
