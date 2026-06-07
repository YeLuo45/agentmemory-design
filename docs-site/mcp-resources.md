# MCP Resources

> 6 个 MCP resources（src/mcp/tools-registry.ts 注册）

## 列表

| URI | MIME | 描述 |
|-----|------|------|
| `agentmemory://stats` | `application/json` | 实时统计 |
| `agentmemory://recent` | `application/json` | 最近 remember |
| `agentmemory://graph` | `application/json` | 知识图谱摘要 |
| `agentmemory://lessons` | `application/json` | 最近 lessons |
| `agentmemory://audit/recent` | `application/json` | 最近审计 |
| `agentmemory://config` | `application/json` | 配置（脱敏） |

## `agentmemory://stats`

```json
{
  "totalMemories": 1234,
  "activeMemories": 1100,
  "consolidatedMemories": 100,
  "evictedMemories": 34,
  "byScope": {
    "default": 800,
    "project-A": 300,
    "user-1": 134
  },
  "byLifecycle": {
    "active": 1100,
    "consolidated": 100,
    "stale": 0,
    "evicted": 34,
    "archived": 0
  },
  "lessons": 45,
  "patterns": 12,
  "skills": 8,
  "graphNodes": 567,
  "graphEdges": 1234,
  "diskUsage": {
    "totalBytes": 52428800,
    "dbBytes": 48234496,
    "vectorIndexBytes": 4194304
  }
}
```

## `agentmemory://recent`

```json
{
  "memories": [
    {
      "id": "mem-abc123",
      "fingerprint": "fp-xyz789",
      "content": "...",
      "summary": "...",
      "confidence": 0.9,
      "tags": ["typescript", "async"],
      "scope": "default",
      "createdAt": "2026-06-07T..."
    }
  ],
  "limit": 20
}
```

## `agentmemory://graph`

```json
{
  "nodeCount": 567,
  "edgeCount": 1234,
  "topNodes": [
    { "id": "...", "label": "...", "type": "concept", "degree": 42 }
  ],
  "topEdges": [
    { "type": "references", "count": 345 }
  ],
  "components": 3
}
```

## `agentmemory://lessons`

```json
{
  "lessons": [
    {
      "id": "lesson-abc",
      "type": "lesson",
      "title": "Async/Await error handling pattern",
      "summary": "Always wrap await in try/catch with specific error types",
      "version": 1,
      "basedOn": ["mem-1", "mem-2", "mem-3"],
      "createdAt": "2026-06-01T..."
    }
  ]
}
```

## `agentmemory://audit/recent`

```json
{
  "entries": [
    {
      "id": "audit-1",
      "operation": "remember",
      "actor": "mcp:claude-code",
      "target": "mem-abc",
      "result": "success",
      "timestamp": "2026-06-07T..."
    }
  ],
  "limit": 50
}
```

## `agentmemory://config`

```json
{
  "version": "0.9.28",
  "mcp": {
    "defaultVisibleTools": 8,
    "allTools": 53,
    "transport": "stdio"
  },
  "rest": {
    "endpoints": 128,
    "authEnabled": true
  },
  "storage": {
    "engine": "iii-engine StateModule",
    "dbPath": "./data/state_store.db"
  },
  "search": {
    "modes": ["hybrid", "bm25", "vector", "graph"],
    "defaultMode": "hybrid"
  },
  "crystallize": {
    "schedule": "0 2 * * *",
    "minClusterSize": 3,
    "similarityThreshold": 0.8
  }
  // secrets REDACTED
}
```

## 客户端使用

```typescript
// MCP 客户端读取
const stats = await client.readResource({ uri: "agentmemory://stats" });
console.log(stats.contents[0].text);  // JSON string

// Claude Code / Cursor:
// 1. /resources → 列出所有 resource
// 2. 点 `agentmemory://stats` → 查看实时统计
// 3. 决定下一步操作
```

## 自定义 Resource

agentmemory 允许通过 `registerResource` 扩展：

```typescript
// 在 src/index.ts
sdk.registerResource({
  uri: "agentmemory://custom",
  name: "Custom View",
  description: "My custom view",
  mimeType: "application/json",
  handler: async () => {
    return { contents: [{ uri: "agentmemory://custom", text: "..." }] };
  },
});
```

## 缓存策略

| Resource | Cache TTL | 更新触发 |
|----------|-----------|----------|
| `stats` | 5s | 任何 write |
| `recent` | 1s | 任何 remember |
| `graph` | 30s | graph mutation |
| `lessons` | 60s | crystallize |
| `audit/recent` | 1s | audit append |
| `config` | ∞ | config change |
