# Knowledge Graph

> agentmemory 内部知识图谱（src/functions/graph.ts 30 symbols）

## 节点 / 边

```ts
type NodeType = "entity" | "concept" | "fact" | "rule" | "lesson" | "skill"
type EdgeType = "references" | "causes" | "temporal-after" | "related" |
                "supports" | "contradicts" | "derived-from" | "example-of"
```

## 何时建图

从 `remember` 自动抽取 entity + relation：

```typescript
// 在 mem::remember 中
async function remember(input) {
  const entry = await persistMemory(input);
  
  // 自动建图 (并行, 不阻塞)
  Promise.all([
    extractEntities(entry).then(entities => 
      entities.forEach(e => addGraphNode(e))
    ),
    extractRelations(entry).then(rels => 
      rels.forEach(r => addGraphEdge(r))
    ),
  ]).catch(() => {});  // 静默失败
  
  return { id: entry.id };
}
```

## MCP 工具

```
memory_graph_add_node(type, label, properties?, memoryIds?)
memory_graph_add_edge(source, target, type, weight?, confidence?)
memory_graph_query(nodeId, depth?, direction?)
memory_graph_search(query, type?, limit?)
memory_graph_remove_node(nodeId)
memory_graph_remove_edge(edgeId)
```

## 查询模式

### 1. Forward BFS

```typescript
// src/functions/graph-retrieval.ts
async function forwardBFS(startId: string, maxDepth = 3) {
  const visited = new Set<string>();
  const queue: { id: string; depth: number; path: string[] }[] = [
    { id: startId, depth: 0, path: [startId] }
  ];
  const results: { node: GraphNode; path: string[]; depth: number }[] = [];
  
  while (queue.length > 0) {
    const { id, depth, path } = queue.shift()!;
    if (visited.has(id) || depth > maxDepth) continue;
    visited.add(id);
    
    const node = await kv.get(`graph:node:${id}`);
    if (!node) continue;
    
    results.push({ node, path, depth });
    
    // Outgoing edges
    const outEdges = await kv.list({
      prefix: `graph:edge:`,
      filter: e => e.source === id,
    });
    
    for (const edge of outEdges) {
      if (!visited.has(edge.target)) {
        queue.push({ id: edge.target, depth: depth + 1, path: [...path, edge.target] });
      }
    }
  }
  
  return results;
}
```

### 2. Bidirectional

```typescript
async function bidirectional(startId: string, endId: string, maxDepth = 4) {
  // BFS from both ends
  const forward = await bfs(startId, maxDepth);
  const backward = await bfs(endId, maxDepth);
  
  // Find intersection
  const intersect = forward.filter(n => 
    backward.some(m => m.node.id === n.node.id)
  );
  
  return intersect;
}
```

### 3. Subgraph Extraction

```typescript
async function extractSubgraph(seedIds: string[], hops: number = 2) {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();
  
  // BFS expansion
  const queue = [...seedIds];
  let depth = 0;
  
  while (queue.length > 0 && depth <= hops) {
    const next: string[] = [];
    for (const id of queue) {
      if (nodes.has(id)) continue;
      const node = await kv.get(`graph:node:${id}`);
      if (!node) continue;
      nodes.set(id, node);
      
      const nodeEdges = await kv.list({
        prefix: `graph:edge:`,
        filter: e => e.source === id || e.target === id,
      });
      for (const edge of nodeEdges) {
        edges.set(edge.id, edge);
        next.push(edge.source === id ? edge.target : edge.source);
      }
    }
    queue.length = 0;
    queue.push(...next);
    depth++;
  }
  
  return {
    nodes: Array.from(nodes.values()),
    edges: Array.from(edges.values()),
  };
}
```

## Temporal Graph

时间维度上的图（"X 之后发生了什么"）：

```typescript
// src/functions/temporal-graph.ts
async function temporalQuery(input: {
  startTime: string;
  endTime: string;
  nodeTypes?: NodeType[];
}) {
  // 1. 在时间窗口内 search memories
  const memories = await search({
    timeRange: { start: input.startTime, end: input.endTime },
  });
  
  // 2. 用 memories 作为 graph seeds
  const seedIds = memories.flatMap(m => m.nodeIds);
  
  // 3. 提取 subgraph
  const subgraph = await extractSubgraph(seedIds, 2);
  
  // 4. 标记 temporal edges
  const temporalEdges = subgraph.edges.filter(e => 
    e.type === "temporal-after"
  );
  
  return {
    nodes: subgraph.nodes,
    edges: subgraph.edges,
    temporalEdges,
    timeRange: { start: input.startTime, end: input.endTime },
  };
}
```

## Frontier 探索

"图边界" — 已知节点 + 1 跳未探索的节点：

```typescript
// src/functions/frontier.ts
async function frontier(input: { scope: string; maxDepth?: number }) {
  const visited = await kv.list({ prefix: "graph:by-scope:" });
  const allEdges = await kv.list({ prefix: "graph:edge:" });
  
  const frontier = new Map<string, { node: GraphNode; reason: string }>();
  
  for (const edge of allEdges) {
    if (visited.has(edge.source) && !visited.has(edge.target)) {
      frontier.set(edge.target, {
        node: await kv.get(`graph:node:${edge.target}`),
        reason: `connected from ${edge.source}`,
      });
    }
  }
  
  return Array.from(frontier.values());
}
```

## Graph + Memory 双向链接

```typescript
interface GraphNode {
  // ...
  memoryIds: string[];  // 来源记忆
}

// 在 search 结果中加图上下文
async function enrichWithGraph(results: MemoryEntry[]) {
  return Promise.all(results.map(async (memory) => {
    // 找包含此 memory 的 graph nodes
    const nodes = await kv.list({
      prefix: "graph:node:",
      filter: n => n.memoryIds.includes(memory.id),
    });
    return { ...memory, graphNodes: nodes };
  }));
}
```

## 性能

| 操作 | 100 节点 | 1k 节点 | 10k 节点 |
|------|----------|---------|----------|
| Add node | ~5ms | ~5ms | ~5ms |
| Add edge | ~5ms | ~5ms | ~5ms |
| BFS depth 2 | ~30ms | ~200ms | ~2s |
| BFS depth 3 | ~80ms | ~600ms | ~6s |
| Subgraph 2-hop | ~50ms | ~300ms | ~3s |

## 已知限制

- LLM extract entity/relation 质量决定图质量
- 大图（>10k 节点）查询慢，需考虑 materialize
- 时序图查询要全扫 memory_fts，目前没特别优化
