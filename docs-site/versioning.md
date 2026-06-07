# Versioning

> 版本管理（v0.9.28 起步，semver）

## 当前版本

`v0.9.28` — 在以下 7 个地方保持同步：

1. **`package.json`** — `version` field
2. **`src/version.ts`** — `VERSION` 常量 + type union
3. **`src/types.ts`** — `ExportData` version union
4. **`src/functions/export-import.ts`** — `supportedVersions` set
5. **`test/export-import.test.ts`** — version assertion
6. **`plugin/.claude-plugin/plugin.json`** — `version` field
7. **`plugin/plugin.json`** — `version` field (when present)

## bump 命令

```bash
# 用 npm version
npm version patch   # 0.9.28 → 0.9.29
npm version minor   # 0.9.28 → 0.10.0
npm version major   # 0.9.28 → 1.0.0

# 然后手动同步其他 6 个文件
NEW=0.9.29

sed -i "s/\"version\": \".*\"/\"version\": \"$NEW\"/" \
  package.json \
  plugin/.claude-plugin/plugin.json \
  plugin/plugin.json

# src/version.ts
echo "export const VERSION = \"$NEW\";" > src/version.ts
echo "export type Version = \"$NEW\" | ..." >> src/version.ts
```

## Version Format

`MAJOR.MINOR.PATCH` (semver)

| Bump | 触发 |
|------|------|
| PATCH | bugfix / 文档 / 单个 tool 加 |
| MINOR | 新 function / 新 MCP tool 组 / 新 platform |
| MAJOR | schema breaking change / API 不兼容 |

## Version Union（src/version.ts）

```typescript
export const VERSION = "0.9.28";
export type Version = "0.9.0" | "0.9.16" | "0.9.28" | ...

// export/import
export const SUPPORTED_VERSIONS: Set<Version> = new Set([
  "0.9.0", "0.9.16", "0.9.28",
]);
```

## Export Compatibility

```typescript
// src/functions/export-import.ts
async function importData(data: ExportData) {
  if (!SUPPORTED_VERSIONS.has(data.version)) {
    throw new Error(`Unsupported version: ${data.version}`);
  }
  
  // 转换 old → new
  if (data.version === "0.9.0") {
    data = migrate_v090_to_v0928(data);
  }
  
  // ... persist
}
```

## Changelog

`CHANGELOG.md` 用 [Keep a Changelog](https://keepachangelog.com/) 格式：

```markdown
## [0.9.28] - 2026-06-XX

### Added
- New memory_image_quota function
- OpenCode plugin support

### Changed
- vector index uses sqlite-vss 0.3

### Fixed
- Dedup race condition in parallel remember

### Removed
- Legacy JSON-only export format
```

## Git Tags

```bash
# 每次 release
git tag -a v0.9.28 -m "Release v0.9.28"
git push origin v0.9.28

# GitHub Actions 自动 build + publish
```

## ROADMAP

`ROADMAP.md` 跟踪未来 6-12 个月：

```markdown
# Roadmap

## v1.0 (next)
- [ ] Full i18n support (zh-CN, ja-JP, etc.)
- [ ] Multi-tenant scoping
- [ ] Helm chart for k8s
- [ ] Web UI for non-CLI users

## v0.10
- [ ] Per-user memory isolation
- [ ] Distributed iii-engine (multi-node)
- [ ] Streaming MCP responses
```

## 兼容性矩阵

| agentmemory | iii-engine | Node.js | TypeScript |
|-------------|------------|---------|------------|
| 0.9.28 | latest | >= 22 | 5.x |
| 0.9.16 | 0.5+ | >= 22 | 5.x |
| 0.9.0 | 0.4+ | >= 20 | 5.x |
| 0.8.x | 0.3+ | >= 20 | 4.x |
