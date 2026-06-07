# Core Layer

> agentmemory 核心实现 — 50+ iii functions / MCP server / REST API

## 模块结构

```
src/
├── functions/                 # 50+ iii functions（核心业务）
│   ├── access-tracker.ts      13 — 访问追踪
│   ├── actions.ts              9 — 动作记录
│   ├── audit.ts                8 — 审计
│   ├── auto-forget.ts          13 — 自动遗忘
│   ├── branch-aware.ts         9 — git branch 感知
│   ├── cascade.ts              7 — 级联删除
│   ├── checkpoints.ts          8 — 快照
│   ├── claude-bridge.ts       12 — Claude 集成桥
│   ├── compress-file.ts       17 — 文件压缩
│   ├── compress-synthetic.ts   7 — 合成压缩
│   ├── compress.ts            20 — 主压缩
│   ├── consolidate.ts         11 — 整合
│   ├── consolidation-pipeline.ts 11 — 整合 pipeline
│   ├── context.ts             11 — 上下文管理
│   ├── crystallize.ts         10 — 聚合成 lessons
│   ├── dedup.ts               15 — 去重
│   ├── diagnostics.ts         11 — 诊断
│   ├── disk-size-manager.ts   10 — 磁盘配额
│   ├── enrich.ts               9 — 富化（添加 context）
│   ├── evict.ts               17 — 淘汰
│   ├── export-import.ts       10 — 导入导出
│   ├── facets.ts               6 — 多维度 facet
│   ├── file-index.ts          10 — 文件索引
│   ├── flow-compress.ts       13 — 流式压缩
│   ├── frontier.ts             8 — frontier (graph)
│   ├── governance.ts          10 — 治理
│   ├── graph-retrieval.ts     21 — 图检索
│   ├── graph.ts               30 — 知识图谱
│   ├── image-quota-cleanup.ts 12 — 图片配额清理
│   ├── image-refs.ts           9 — 图片引用
│   ├── leases.ts              10 — 租约（concurrent access）
│   ├── lessons.ts              8 — lessons (crystallized)
│   ├── mesh.ts                20 — 跨代理 mesh
│   ├── migrate-vector-index.ts  9 — vector index 迁移
│   ├── migrate.ts             13 — schema 迁移
│   ├── observe.ts             15 — 观察（record observations）
│   ├── obsidian-export.ts     24 — Obsidian 导出
│   ├── patterns.ts             8 — patterns (crystallized)
│   ├── privacy.ts              6 — 隐私分类
│   ├── profile.ts              9 — profile
│   ├── query-expansion.ts      8 — 查询扩展
│   ├── recent-searches-sweep.ts 9 — 搜索历史清理
│   ├── reflect.ts             12 — 反思
│   ├── relations.ts           11 — 关系
│   ├── remember.ts            13 — 核心 remember
│   ├── replay.ts              27 — 事件回放
│   ├── retention.ts           16 — 保留策略
│   ├── routines.ts             8 — 日常例行
│   ├── search.ts              33 — 主搜索
│   ├── sentinels.ts           10 — 哨兵（监控）
│   ├── signals.ts              7 — 信号
│   ├── sketches.ts             8 — 草图（draft）
│   ├── skill-extract.ts       11 — 从记忆提取 skill
│   ├── sliding-window.ts      11 — 滑动窗口（working memory）
│   ├── slots.ts               25 — 槽位
│   ├── smart-search.ts        21 — 智能搜索
│   ├── snapshot.ts            17 — 快照
│   ├── summarize.ts           23 — 摘要
│   ├── team.ts                 9 — 团队协作
│   ├── temporal-graph.ts      11 — 时序图
│   ├── timeline.ts             9 — 时间线
│   ├── verify.ts               7 — 验证
│   ├── vision-search.ts       11 — 视觉搜索
│   └── working-memory.ts      13 — 工作记忆
├── mcp/                        # MCP 协议层
│   ├── server.ts              17 — MCP 协议
│   ├── transport.ts           14 — stdio/HTTP transport
│   ├── tools-registry.ts      16 — 53 tools 定义
│   ├── rest-proxy.ts          24 — MCP → REST
│   ├── standalone.ts          27 — 不依赖 iii 模式
│   └── in-memory-kv.ts        11 — 内存 KV (testing)
├── triggers/
│   └── api.ts                 # REST 触发器注册
├── state/
│   └── schema.ts              # SQLite schema
└── auth.ts                    # auth
```

## 关键流程

### `remember` 完整流程

```typescript
// src/functions/remember.ts
sdk.registerFunction("mem::remember", async (data) => {
  // 1. Validate
  if (!data.content) throw new Error("content required");
  
  // 2. Fingerprint for dedup
  const fingerprint = fingerprintId(data.content);
  
  // 3. Check existing
  const existing = await kv.get(`memory:${fingerprint}`);
  if (existing) {
    return { id: existing.id, deduplicated: true };
  }
  
  // 4. Create
  const id = generateId();
  const entry = {
    id,
    fingerprint,
    content: data.content,
    confidence: data.confidence ?? 1.0,
    lifecycle: "active",
    tags: data.tags || [],
    scope: data.scope || "default",
    createdAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
    accessCount: 0,
  };
  
  // 5. Persist
  await Promise.all([
    kv.set(`memory:${id}`, entry),
    kv.set(`memory:fingerprint:${fingerprint}`, { id }),
  ]);
  
  // 6. Audit
  recordAudit({ operation: "remember", id, fingerprint });
  
  return { id, fingerprint, deduplicated: false };
});
```

### `search` 三路召回

```typescript
// src/functions/search.ts (简化)
async function search(query: string, opts: SearchOptions) {
  // 1. Query expansion
  const expanded = await queryExpansion(query);
  
  // 2. Three-way parallel
  const [bm25Results, vectorResults, graphResults] = await Promise.all([
    bm25Search(expanded, opts),
    vectorSearch(expanded, opts),
    graphRetrieval(expanded, opts),
  ]);
  
  // 3. Merge + rerank
  const merged = rerank([...bm25Results, ...vectorResults, ...graphResults], query);
  
  // 4. Track access
  merged.slice(0, 10).forEach(m => accessTracker.record(m.id));
  
  return merged;
}
```

### `crystallize` 把 remember 变成 lessons

```typescript
// src/functions/crystallize.ts
// 输入: 大量零散 remember
// 输出: structured lesson / skill / pattern
sdk.registerFunction("mem::crystallize", async ({ timeWindow }) => {
  // 1. 拉取 timeWindow 内的所有 remember
  const memories = await kv.list({ prefix: "memory:", since: timeWindow });
  
  // 2. Cluster by similarity
  const clusters = cluster(memories, { threshold: 0.8 });
  
  // 3. LLM summarize each cluster
  const lessons = await Promise.all(clusters.map(async c => {
    const summary = await llm.summarize(c.entries, {
      style: "lesson",
      includeExamples: true,
    });
    return {
      type: "lesson",
      id: generateId(),
      summary,
      basedOn: c.entries.map(e => e.id),
      confidence: average(c.entries.map(e => e.confidence)),
    };
  }));
  
  // 4. Persist
  for (const lesson of lessons) {
    await kv.set(`lesson:${lesson.id}`, lesson);
  }
  
  return { count: lessons.length };
});
```

## Plugin Scripts（Hook 实现）

`plugin/scripts/` 14 hook 脚本（Node.js 独立脚本，从 stdin 读 JSON）：

| 模式 | 实现 | 关键点 |
|------|------|--------|
| Context-injecting | `await fetch(..., { signal: AbortSignal.timeout(N) })` + try/catch | 脚本必须等响应 |
| Telemetry-only | `fetch(...).catch(()=>{})` + `setTimeout(()=>process.exit(0), 500).unref()` | fire-and-forget |

```javascript
// plugin/scripts/pre-tool-use.mjs (context-injecting 模式)
import { readFileSync } from "fs";

const input = JSON.parse(readFileSync(0, "utf-8"));
try {
  const resp = await fetch(
    `${process.env.AGENTMEMORY_URL}/agentmemory/search`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: input.tool_input, limit: 5 }),
      signal: AbortSignal.timeout(3000),
    }
  );
  const data = await resp.json();
  // 写入 stdout → Claude Code 注入 prompt
  console.log(`<memory>\n${JSON.stringify(data.results, null, 2)}\n</memory>`);
} catch (e) {
  // 静默失败
}
```

```javascript
// plugin/scripts/post-tool-use.mjs (telemetry 模式)
const input = JSON.parse(readFileSync(0, "utf-8"));
fetch(`${process.env.AGENTMEMORY_URL}/agentmemory/observe`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ event: "post-tool-use", data: input }),
  signal: AbortSignal.timeout(3000),
}).catch(() => {});  // 不 await
setTimeout(() => process.exit(0), 500).unref();  // 强制退出
```

## 测试

- `vitest` 950+ tests
- `vi.mock("iii-sdk")` 模式 — mock `sdk.trigger` / `kv.get/set/list`
- 测试文件在 `test/` 用 `.test.ts` 后缀
- 跟随 `test/crystallize.test.ts` 模式（function 测试）

## 关键约束

- **TypeScript strict mode** — 任何隐式 any 都报
- **ESM only** (`"type": "module"`) — 不支持 CJS
- **iii-engine 强一致** — 永远不直连 SQLite；总是经 `kv.*` / `sdk.trigger()`
- **REST whitelist** — 字段白名单过滤 raw body
- **Timestamp 一次捕获** — `new Date().toISOString()` 一次取，多次用
- **Promise.all 并行** — 独立 kv 读写并行
