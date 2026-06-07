# Remember / Search

> agentmemory 核心：remember 入库 + search 检索

## Remember

### MCP 工具

```
memory_remember(scope, content, tags?, confidence?, metadata?, related?)
```

### 内部流程

```typescript
// src/functions/remember.ts
async function remember(input) {
  // 1. Validate
  if (!input.content || !input.scope) throw new Error("required");
  
  // 2. Fingerprint
  const fingerprint = fingerprintId(input.content);
  
  // 3. Dedup check
  const existing = await kv.get(`memory:fingerprint:${fingerprint}`);
  if (existing) {
    // 提升 confidence 而非新增
    await kv.update(`memory:${existing.id}`, m => ({
      ...m,
      confidence: Math.min(1, m.confidence + 0.1),
      accessCount: m.accessCount + 1,
    }));
    return { id: existing.id, deduplicated: true };
  }
  
  // 4. Create new
  const id = generateId();
  const entry = {
    id,
    fingerprint,
    content: input.content,
    confidence: input.confidence ?? 1.0,
    lifecycle: "active",
    tags: input.tags || [],
    scope: input.scope,
    metadata: input.metadata || {},
    createdAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
    accessCount: 0,
    relatedIds: input.related || [],
  };
  
  // 5. Persist (parallel)
  await Promise.all([
    kv.set(`memory:${id}`, entry),
    kv.set(`memory:fingerprint:${fingerprint}`, { id }),
    kv.set(`memory:by-scope:${input.scope}:${id}`, { id }),
    ...input.tags.map(tag => kv.set(`memory:by-tag:${tag}:${id}`, { id })),
  ]);
  
  // 6. Audit
  recordAudit({ operation: "remember", id, fingerprint });
  
  return { id, fingerprint, deduplicated: false };
}
```

### Fingerprint 算法

```typescript
// utils/fingerprint.ts
function fingerprintId(content: string): string {
  // normalize: trim + lowercase + collapse whitespace
  const normalized = content.trim().toLowerCase().replace(/\s+/g, " ");
  // sha256 + base32 (短)
  return sha256(normalized).slice(0, 16);
}
```

## Search

### MCP 工具

```
memory_search(query, scope?, tags?, limit?, mode?)
  mode: "hybrid" | "bm25" | "vector" | "graph"
```

### Hybrid Search 架构

```typescript
// src/functions/search.ts (33 symbols)
async function search(input) {
  const mode = input.mode || "hybrid";
  const limit = input.limit || 10;
  
  if (mode === "hybrid") {
    // Three-way parallel
    const [bm25, vec, graph] = await Promise.all([
      bm25Search(input),
      vectorSearch(input),
      graphRetrieval(input),
    ]);
    
    // Merge with reciprocal rank fusion
    const merged = reciprocalRankFusion([
      bm25.results, vec.results, graph.results
    ]);
    
    return { results: merged.slice(0, limit), mode: "hybrid" };
  }
  
  if (mode === "bm25") return bm25Search(input);
  if (mode === "vector") return vectorSearch(input);
  if (mode === "graph") return graphRetrieval(input);
}
```

### 三路召回详解

#### 1. BM25

```typescript
async function bm25Search(input) {
  // tokenize query
  const terms = tokenize(input.query);
  
  // SQLite FTS5 search
  const results = await sql.all(`
    SELECT memory_id, rank
    FROM memory_fts
    WHERE memory_fts MATCH ?
    ORDER BY rank
    LIMIT 50
  `, terms.join(" "));
  
  // Filter by scope/tags
  return results.filter(r => {
    const entry = kv.get(`memory:${r.memory_id}`);
    return matchScope(entry, input.scope) && matchTags(entry, input.tags);
  });
}
```

#### 2. Vector Search

```typescript
async function vectorSearch(input) {
  // embed query
  const queryVec = await embed(input.query);
  
  // sqlite-vss search
  const results = await sql.all(`
    SELECT memory_id, distance
    FROM memory_vectors
    WHERE vss_search(embedding, ?)
    LIMIT 50
  `, JSON.stringify(queryVec));
  
  return results;
}
```

#### 3. Graph Retrieval

```typescript
async function graphRetrieval(input) {
  // 1. Find seed nodes from query
  const seedNodes = await findNodesByQuery(input.query, 5);
  
  // 2. BFS from seeds
  const visited = new Set();
  const queue = [...seedNodes];
  const results = [];
  
  while (queue.length > 0) {
    const node = queue.shift();
    if (visited.has(node.id)) continue;
    visited.add(node.id);
    
    // Add node's source memories
    results.push(...node.memoryIds.map(id => ({
      memoryId: id,
      viaNode: node.id,
      distance: bfsDist,
    })));
    
    // Expand to neighbors
    const edges = await kv.list({ prefix: `graph:edge:`, filter: e => e.source === node.id || e.target === node.id });
    for (const edge of edges) {
      const next = edge.source === node.id ? edge.target : edge.source;
      queue.push({ id: next });
    }
  }
  
  return results;
}
```

### Reciprocal Rank Fusion (RRF)

```typescript
function reciprocalRankFusion(rankings: SearchResult[][], k = 60): SearchResult[] {
  const scores = new Map<string, number>();
  
  for (const ranking of rankings) {
    ranking.forEach((result, idx) => {
      const id = result.memoryId;
      const rrfScore = 1 / (k + idx + 1);
      scores.set(id, (scores.get(id) || 0) + rrfScore);
    });
  }
  
  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id, score]) => ({ memoryId: id, rrfScore: score }));
}
```

## Smart Search（Query Expansion）

```typescript
// src/functions/smart-search.ts
async function smartSearch(input) {
  // 1. Expand query
  const expanded = await queryExpansion(input.query);
  // expanded: "javascript async" → ["javascript async", "js async", "asynchronous javascript"]
  
  // 2. Search each variant in parallel
  const allResults = await Promise.all(
    expanded.map(q => search({ ...input, query: q }))
  );
  
  // 3. Dedupe + rerank
  const merged = dedupe(allResults.flat());
  const reranked = await rerank(merged, input.query);
  
  return reranked;
}
```

## Temporal Graph

时间维度的图查询（"过去 1 周内"）：

```typescript
async function temporalGraphSearch(input) {
  const { query, timeRange } = input;
  // e.g. timeRange: { start: "...", end: "..." }
  
  // 1. 在时间窗口内 search
  const timeFiltered = await search({
    ...input,
    timeRange,  // 加时间过滤
  });
  
  // 2. 用 search 结果作为 graph seed
  const seedNodes = timeFiltered.map(r => r.memoryId);
  const graph = await graphRetrieval({ ...input, seeds: seedNodes });
  
  return { timeFiltered, graph };
}
```

## Vision Search

```typescript
// src/functions/vision-search.ts
async function visionSearch(input) {
  // 输入: 图片 (base64 or path)
  // 1. CLIP-style embed
  const imgEmbedding = await visionEmbed(input.image);
  
  // 2. 找最近图片 memory
  const similar = await sql.all(`
    SELECT memory_id, distance
    FROM image_vectors
    WHERE vss_search(embedding, ?)
    LIMIT 10
  `, JSON.stringify(imgEmbedding));
  
  // 3. 可选: caption-based search
  const captionMatch = await search({
    query: input.caption || "",
    tags: ["image"],
  });
  
  return { visual: similar, caption: captionMatch };
}
```

## 性能特征

| Mode | 100 memories | 1k memories | 10k memories |
|------|--------------|-------------|--------------|
| BM25 | ~5ms | ~20ms | ~80ms |
| Vector | ~10ms | ~30ms | ~100ms |
| Graph (depth 2) | ~15ms | ~50ms | ~200ms |
| Hybrid (RRF) | ~30ms | ~100ms | ~400ms |

## 已知约束

- BM25 对中文不友好（待 tokenizer 增强）
- Vector search 需要 embed 模型；默认 offline
- Graph retrieval 在大图（>10k 节点）会变慢
- Smart search 的 query expansion 依赖 LLM
