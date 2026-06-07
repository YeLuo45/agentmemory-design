# Data Models

> agentmemory 核心数据模型（来自 src/types.ts / src/state/schema.ts）

## 顶层

```ts
interface MemoryEntry {
  id: string                  // generateId()
  fingerprint: string         // fingerprintId(content) — dedup
  content: string             // 记忆内容（任意格式）
  summary?: string            // LLM 摘要
  confidence: number          // 0..1
  lifecycle: MemoryLifecycle
  tags: string[]
  scope: string               // 隔离 scope (default / project-A / user-1)
  metadata: Record<string, unknown>
  createdAt: string           // ISO timestamp
  lastAccessedAt: string
  accessCount: number
  expiresAt?: string
  relatedIds: string[]        // 关联记忆
  source?: MemorySource       // 来自哪个 hook / function
}

type MemoryLifecycle =
  | "active"      // 默认
  | "consolidated" // 已被聚合成 lesson
  | "stale"       // 长时间未访问
  | "evicted"     // 已淘汰
  | "archived"    // 归档（不再搜索但保留）
```

## Lesson（crystallize 输出）

```ts
interface Lesson {
  id: string
  type: "lesson" | "skill" | "pattern"
  title: string
  summary: string
  content: string              // 结构化 markdown
  basedOn: string[]            // 源 memory IDs
  confidence: number
  tags: string[]
  examples: Example[]          // from crystallize
  createdAt: string
  version: number              // 每次 consolidate 加 1
}
```

## Knowledge Graph

```ts
interface GraphNode {
  id: string
  type: NodeType                // "entity" | "concept" | "fact" | "rule"
  label: string
  properties: Record<string, unknown>
  embeddingId?: string          // 指向 vector index
  memoryIds: string[]           // 来源记忆
  confidence: number
  createdAt: string
  lastTraversedAt: string
}

interface GraphEdge {
  id: string
  type: EdgeType                // "references" | "causes" | "temporal-after" | ...
  source: string                // node id
  target: string                // node id
  weight: number                // 0..1
  confidence: number
  createdAt: string
}

type NodeType = "entity" | "concept" | "fact" | "rule" | "lesson" | "skill"
type EdgeType = "references" | "causes" | "temporal-after" | "related" |
                "supports" | "contradicts" | "derived-from" | "example-of"
```

## Audit

```ts
interface AuditEntry {
  id: string
  operation: AuditOperation
  actor: string                 // who triggered (agent / function / user)
  target?: string               // memory / lesson / graph id
  payload: Record<string, unknown>  // 脱敏
  result: "success" | "failure"
  error?: string
  timestamp: string
}

type AuditOperation =
  | "remember" | "search" | "forget" | "evict"
  | "crystallize" | "consolidate" | "snapshot"
  | "graph-add" | "graph-remove"
  | "export" | "import" | "merge"
  | "config-change" | "auth"
```

## Slot（working memory）

```ts
interface Slot {
  key: string                   // "user-pref" / "current-task" / ...
  value: unknown
  scope: string
  ttlMs?: number                // 滑动窗口过期
  lastUpdatedAt: string
}
```

## Export/Import 版本

```ts
type ExportDataVersion = "0.9.0" | "0.9.16" | "0.9.28" | ...
// supportedVersions: set of versions the current build can import
```

## KV Schema（src/state/schema.ts）

| Key 前缀 | Value Type | 说明 |
|----------|------------|------|
| `memory:{id}` | MemoryEntry | 主存储 |
| `memory:fingerprint:{fp}` | `{ id: string }` | dedup 索引 |
| `memory:by-scope:{scope}:{id}` | `{ id }` | scope 索引 |
| `memory:by-tag:{tag}:{id}` | `{ id }` | tag 索引 |
| `lesson:{id}` | Lesson | crystallize 输出 |
| `skill:{id}` | Lesson (type=skill) | 提取的 skill |
| `pattern:{id}` | Lesson (type=pattern) | 模式 |
| `graph:node:{id}` | GraphNode | 知识图谱节点 |
| `graph:edge:{id}` | GraphEdge | 知识图谱边 |
| `graph:by-type:{type}:{id}` | `{ id }` | 类型索引 |
| `slot:{scope}:{key}` | Slot | working memory |
| `audit:{ts}:{id}` | AuditEntry | 审计日志（时序） |
| `vector:{id}` | `number[]` | embedding vector |
| `meta:version` | `{ version, buildHash, exportedAt }` | 元数据 |

## Indexes（SQLite）

```sql
CREATE INDEX idx_memory_scope ON memory(scope);
CREATE INDEX idx_memory_lifecycle ON memory(lifecycle);
CREATE INDEX idx_memory_created ON memory(createdAt);
CREATE INDEX idx_audit_timestamp ON audit(timestamp);
CREATE INDEX idx_graph_node_type ON graph_node(type);
```

## Migration

`src/functions/migrate.ts` 13 symbols — schema 演进
`src/functions/migrate-vector-index.ts` 9 symbols — vector index 迁移

每次大版本升级需要跑 migration。

## 关键设计

- **Fingerprint-based dedup** — 同 content 不同 id 会去重到 first occurrence
- **Confidence + Lifecycle** — 双字段避免"幽灵记忆"：confidence 衰减 + lifecycle 状态机
- **Time-stamped audit** — 按 ts 索引，方便 replay
- **Scope 隔离** — `scope` 字段支持多项目/多用户共享同一 agentmemory 实例
- **Vector + Graph + BM25** — 三路并存，搜索时 merge + rerank
