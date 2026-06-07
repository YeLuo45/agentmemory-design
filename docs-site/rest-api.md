# REST API

> 128 REST endpoints (src/triggers/api.ts)

## 路径前缀

所有 endpoint 都在 `/agentmemory/...` 下。

## 鉴权

```typescript
// 每个 endpoint 用 checkAuth
function checkAuth(req: ApiRequest, secret: string): Response | null {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return { status_code: 401, body: { error: "missing bearer" } };
  }
  const token = authHeader.slice(7);
  if (token !== secret) {
    return { status_code: 401, body: { error: "invalid token" } };
  }
  return null;  // 鉴权通过
}
```

环境变量 `AGENTMEMORY_API_KEY` 设 secret。

## Endpoint 分类

### Memory (20+)

```
POST   /agentmemory/remember            # mem::remember
POST   /agentmemory/search              # mem::search
POST   /agentmemory/forget               # mem::forget
GET    /agentmemory/get/:id              # mem::get
GET    /agentmemory/list                 # mem::list
PUT    /agentmemory/update/:id           # mem::update
GET    /agentmemory/count                # mem::count
POST   /agentmemory/observe              # mem::observe
POST   /agentmemory/enrich               # mem::enrich
POST   /agentmemory/profile/get          # mem::profile
POST   /agentmemory/profile/set          # mem::profile
POST   /agentmemory/actions              # mem::actions
POST   /agentmemory/signals              # mem::signals
POST   /agentmemory/context              # mem::context
POST   /agentmemory/working-memory       # mem::working-memory
POST   /agentmemory/slots                # mem::slots
POST   /agentmemory/branch-aware         # mem::branch-aware
```

### Search (10+)

```
POST   /agentmemory/smart-search         # mem::smart-search
POST   /agentmemory/vision-search        # mem::vision-search
POST   /agentmemory/query-expansion      # mem::query-expansion
POST   /agentmemory/sliding-window       # mem::sliding-window
POST   /agentmemory/temporal-graph       # mem::temporal-graph
POST   /agentmemory/frontier             # mem::frontier
```

### Crystallize (10+)

```
POST   /agentmemory/crystallize          # mem::crystallize
POST   /agentmemory/consolidate          # mem::consolidate
POST   /agentmemory/lessons              # mem::lessons
POST   /agentmemory/patterns             # mem::patterns
POST   /agentmemory/skill-extract        # mem::skill-extract
POST   /agentmemory/summarize            # mem::summarize
POST   /agentmemory/pipeline             # mem::consolidation-pipeline
POST   /agentmemory/mesh                 # mem::mesh
POST   /agentmemory/sketches             # mem::sketches
```

### Graph (15+)

```
POST   /agentmemory/graph/node           # mem::graph
POST   /agentmemory/graph/edge           # mem::graph
GET    /agentmemory/graph/node/:id       # mem::graph
DELETE /agentmemory/graph/node/:id       # mem::graph
GET    /agentmemory/graph/edge/:id       # mem::graph
DELETE /agentmemory/graph/edge/:id       # mem::graph
POST   /agentmemory/graph/query         # mem::graph-retrieval
POST   /agentmemory/graph/search        # mem::graph
GET    /agentmemory/graph/subgraph/:id   # mem::graph-retrieval
POST   /agentmemory/relations           # mem::relations
POST   /agentmemory/facets               # mem::facets
```

### Compress (8+)

```
POST   /agentmemory/compress             # mem::compress
POST   /agentmemory/compress/file        # mem::compress-file
POST   /agentmemory/compress/synthetic   # mem::compress-synthetic
POST   /agentmemory/flow-compress        # mem::flow-compress
```

### Lifecycle (15+)

```
POST   /agentmemory/evict                # mem::evict
POST   /agentmemory/auto-forget          # mem::auto-forget
POST   /agentmemory/retention            # mem::retention
POST   /agentmemory/disk-size            # mem::disk-size-manager
POST   /agentmemory/cascade              # mem::cascade
POST   /agentmemory/leases               # mem::leases
POST   /agentmemory/image-quota          # mem::image-quota-cleanup
POST   /agentmemory/search-history-sweep # mem::recent-searches-sweep
```

### Snapshot (10+)

```
POST   /agentmemory/snapshot             # mem::snapshot
GET    /agentmemory/snapshot/:id
POST   /agentmemory/checkpoints          # mem::checkpoints
GET    /agentmemory/timeline             # mem::timeline
POST   /agentmemory/replay               # mem::replay
```

### Integration (10+)

```
POST   /agentmemory/obsidian/export      # mem::obsidian-export
POST   /agentmemory/claude-bridge        # mem::claude-bridge
POST   /agentmemory/team                 # mem::team
POST   /agentmemory/file-index           # mem::file-index
POST   /agentmemory/image-refs           # mem::image-refs
```

### Ops (20+)

```
POST   /agentmemory/export               # mem::export-import
POST   /agentmemory/import
POST   /agentmemory/migrate              # mem::migrate
POST   /agentmemory/migrate/vector       # mem::migrate-vector-index
POST   /agentmemory/diagnostics          # mem::diagnostics
POST   /agentmemory/sentinels            # mem::sentinels
POST   /agentmemory/audit                # mem::audit
GET    /agentmemory/audit/recent
POST   /agentmemory/access-tracker       # mem::access-tracker
POST   /agentmemory/privacy              # mem::privacy
POST   /agentmemory/governance           # mem::governance
POST   /agentmemory/verify               # mem::verify
POST   /agentmemory/reflect              # mem::reflect
POST   /agentmemory/routines             # mem::routines
```

### System (5+)

```
GET    /agentmemory/health               # health check
GET    /agentmemory/stats                # stats
GET    /agentmemory/version
GET    /agentmemory/audit
```

## 字段白名单

```typescript
// 永不传 raw body 给 sdk.trigger
sdk.registerFunction("api::remember", async (req) => {
  const body = req.body as Record<string, unknown>;
  
  // 白名单
  const payload = {
    scope: typeof body.scope === "string" ? body.scope : "default",
    content: typeof body.content === "string" ? body.content : "",
    tags: Array.isArray(body.tags) ? body.tags.filter(t => typeof t === "string") : [],
    confidence: typeof body.confidence === "number" ? body.confidence : 1.0,
    metadata: typeof body.metadata === "object" ? body.metadata : {},
  };
  
  const result = await sdk.trigger({
    function_id: "mem::remember",
    payload,
  });
  
  return { status_code: 200, body: result };
});
```

## 错误响应

```json
{
  "status_code": 400,
  "body": {
    "error": "validation_error",
    "details": {
      "field": "content",
      "message": "required"
    }
  }
}
```

| Code | 含义 |
|------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | validation error |
| 401 | 鉴权失败 |
| 404 | 资源不存在 |
| 500 | 内部错误 |
| 503 | iii-engine 不可用 |

## Curl 示例

```bash
# Remember
curl -X POST http://localhost:49135/agentmemory/remember \
  -H "Authorization: Bearer $AGENTMEMORY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "scope": "default",
    "content": "Async functions should always handle errors with try/catch",
    "tags": ["javascript", "async", "best-practice"],
    "confidence": 0.9
  }'

# Search
curl -X POST http://localhost:49135/agentmemory/search \
  -H "Authorization: Bearer $AGENTMEMORY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "async error handling",
    "scope": "default",
    "limit": 5,
    "mode": "hybrid"
  }'

# Crystallize
curl -X POST http://localhost:49135/agentmemory/crystallize \
  -H "Authorization: Bearer $AGENTMEMORY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "timeWindow": "7d", "minClusterSize": 3 }'
```

## 性能

| Endpoint | 典型延迟 |
|----------|----------|
| `/remember` | ~10ms |
| `/search` (hybrid) | ~30-100ms |
| `/crystallize` | ~5-30s (LLM bound) |
| `/graph/query` | ~50-200ms |
| `/health` | <1ms |
