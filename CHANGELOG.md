# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.2] - 2026-03-21

### Added
- `CrossAgentNetworkResponse.node_count` field — reflects the `node_count` field added in
  dakera server v0.6.2 (PR #26). Previously the field was silently ignored.
- `DakeraClient.sseUrl(path)` helper — returns a fully-qualified SSE URL with `?api_key=`
  appended. Use this to construct URLs for browser-native `EventSource`, which cannot send
  custom request headers.
- `_streamSse` and `_streamSseMemory` now authenticate via `?api_key=` query parameter
  instead of the `Authorization` header, making internally streamed URLs compatible with
  native `EventSource` clients.

## [0.2.0] - 2026-03-19

### Security
- Bump `flatted` 3.3.3 → 3.4.2 (CVE-2026-32141: DoS via unbounded recursion in parse())
- Add explicit `GITHUB_TOKEN` permissions (`contents: read`) to CI workflow

### Changed
- Drop Node 18 from CI test matrix (EOL 2025-04-30; new deps require Node ≥20)
- Bump `engines.node` from `>=18.0.0` to `>=20.12.0`
- Bump `esbuild` and `vitest` (required Node 20+ for rolldown/styleText)
- Bump `rollup` 4.56.0 → 4.59.0
- Bump `ajv` 6.12.6 → 6.14.0
- Bump `minimatch` 3.1.2 → 3.1.5

## [0.1.0] - 2025-03-15

### Added
- Initial release of Dakera TypeScript SDK
- Full TypeScript type definitions
- Vector operations: upsert, query, fetch, delete
- Namespace management
- Full-text search support
- Agent memory operations
- Session management
- Knowledge graph operations
- Inference (auto-embedding) support
- Error handling with typed exceptions
- Comprehensive test suite
