---
description: TypeScript SDK conventions for dakera-js
globs: "*.ts"
---

# TypeScript SDK Conventions

- Match server API 1:1 — every public endpoint needs a client method
- Use fetch API (no axios) — works in Node.js and browsers
- Export all types from index.ts
- Version in package.json must match latest server version
- All new methods need unit tests with mock responses
- Use strict TypeScript — no `any` types in public API
- RetryConfig and RateLimitHeaders must be typed
