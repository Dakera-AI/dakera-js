---
name: sdk-release
description: Release the Dakera JavaScript SDK. Use when publishing a new version to npm.
disable-model-invocation: true
allowed-tools: Bash(gh *) Bash(npm *) Bash(npx *)
---

## JavaScript SDK Release

### Pre-release checks
```bash
npm test
npm run lint
npm run build
```

### Version bump
```bash
npm version patch  # or minor/major
```

### Release process
1. Update `CHANGELOG.md`
2. Commit: `git commit -m "chore: bump to vX.Y.Z"`
3. Tag: `git tag vX.Y.Z`
4. Push: `git push origin main --tags`
5. Release workflow auto-publishes to npm

### Batching rules
- All 4 SDKs (py, js, rs, go) sync in a single coordinated batch
- Do NOT release for a single trivial change — batch until 2+ changes or security fix
