# Functions

> 50+ iii Functions 全景

## 核心 CRUD（默认 8 工具背后）

| Function | 角色 | Symbols |
|----------|------|---------|
| `mem::remember` | 写入单条记忆 + dedup | 13 |
| `mem::search` | BM25 + vector + graph 三路搜索 | 33 |
| `mem::forget` | 删除记忆（cascade） | (含 cascade.ts) |
| `mem::observe` | 记录观察（不 dedup） | 15 |
| `mem::enrich` | 给记忆加 context | 9 |
| `mem::profile` | 用户/项目 profile | 9 |
| `mem::actions` | 记录动作 | 9 |
| `mem::signals` | 信号 | 7 |

## 搜索与检索

| Function | 角色 | Symbols |
|----------|------|---------|
| `mem::search` | 主搜索（hybrid） | 33 |
| `mem::smart-search` | 智能搜索（query expansion） | 21 |
| `mem::graph-retrieval` | 图路径检索 | 21 |
| `mem::query-expansion` | 查询扩展 | 8 |
| `mem::vision-search` | 图片/视觉搜索 | 11 |
| `mem::temporal-graph` | 时序图查询 | 11 |
| `mem::frontier` | 图 frontier 探索 | 8 |
| `mem::sliding-window` | 滑动窗口 | 11 |

## 知识组织

| Function | 角色 | Symbols |
|----------|------|---------|
| `mem::crystallize` | 聚合成 lessons | 10 |
| `mem::consolidate` | 整合多条 lesson | 11 |
| `mem::consolidation-pipeline` | 整合 pipeline | 11 |
| `mem::lessons` | lessons CRUD | 8 |
| `mem::patterns` | patterns CRUD | 8 |
| `mem::skill-extract` | 从记忆提取 skill | 11 |
| `mem::summarize` | 摘要 | 23 |
| `mem::mesh` | 跨代理 mesh | 20 |
| `mem::graph` | 知识图谱 | 30 |
| `mem::relations` | 关系管理 | 11 |
| `mem::facets` | 多维度 facet | 6 |
| `mem::sketches` | 草图 | 8 |

## 工作记忆

| Function | 角色 | Symbols |
|----------|------|---------|
| `mem::working-memory` | 工作记忆 | 13 |
| `mem::slots` | 槽位管理 | 25 |
| `mem::context` | 上下文 | 11 |
| `mem::branch-aware` | git branch 感知 | 9 |

## 压缩

| Function | 角色 | Symbols |
|----------|------|---------|
| `mem::compress` | 主压缩 | 20 |
| `mem::compress-file` | 文件压缩 | 17 |
| `mem::compress-synthetic` | 合成压缩 | 7 |
| `mem::flow-compress` | 流式压缩 | 13 |

## 生命周期 / 治理

| Function | 角色 | Symbols |
|----------|------|---------|
| `mem::evict` | 淘汰 | 17 |
| `mem::auto-forget` | 自动遗忘 | 13 |
| `mem::retention` | 保留策略 | 16 |
| `mem::consolidate` | 整合 | 11 |
| `mem::disk-size-manager` | 磁盘配额 | 10 |
| `mem::image-quota-cleanup` | 图片配额清理 | 12 |
| `mem::recent-searches-sweep` | 搜索历史清理 | 9 |
| `mem::privacy` | 隐私分类 | 6 |
| `mem::governance` | 治理 | 10 |
| `mem::cascade` | 级联删除 | 7 |
| `mem::leases` | 租约 | 10 |

## 快照 / 时间

| Function | 角色 | Symbols |
|----------|------|---------|
| `mem::snapshot` | 快照 | 17 |
| `mem::checkpoints` | checkpoint | 8 |
| `mem::timeline` | 时间线 | 9 |
| `mem::replay` | 事件回放 | 27 |

## 文件 / 资产

| Function | 角色 | Symbols |
|----------|------|---------|
| `mem::file-index` | 文件索引 | 10 |
| `mem::image-refs` | 图片引用 | 9 |
| `mem::obsidian-export` | Obsidian 导出 | 24 |
| `mem::migrate` | schema 迁移 | 13 |
| `mem::migrate-vector-index` | vector index 迁移 | 9 |

## 集成 / 诊断

| Function | 角色 | Symbols |
|----------|------|---------|
| `mem::claude-bridge` | Claude 集成桥 | 12 |
| `mem::team` | 团队协作 | 9 |
| `mem::sentinels` | 哨兵监控 | 10 |
| `mem::access-tracker` | 访问追踪 | 13 |
| `mem::audit` | 审计 | 8 |
| `mem::diagnostics` | 诊断 | 11 |
| `mem::export-import` | 导入导出 | 10 |
| `mem::routines` | 日常例行 | 8 |
| `mem::reflect` | 反思 | 12 |
| `mem::verify` | 验证 | 7 |

## 按功能分类

### Crystallize 模式（核心创新）

```
remember (many)
   ↓
[crystallize] → lesson (structured)
   ↓
[consolidate] → pattern (higher-level)
   ↓
[skill-extract] → skill (reusable)
```

### 搜索优先级

```
search (broad) → smart-search (reranked) → graph-retrieval (path-based)
                                  ↓
                            vision-search (image)
```

### 压缩路径

```
compress (full content) → compress-file (file path aware) → compress-synthetic (synthesized)
                                                ↓
                                       flow-compress (streaming)
```

## 注册模式

```typescript
// 1. Register function
sdk.registerFunction("mem::your-name", async (data) => {
  // validate
  // business logic via kv.*
  // record audit
  return result;
});

// 2. Register HTTP trigger (REST API)
sdk.registerFunction("api::your-endpoint", async (req) => {
  const denied = checkAuth(req, secret);
  if (denied) return denied;
  const body = req.body as Record<string, unknown>;
  const result = await sdk.trigger({
    function_id: "mem::your-name",
    payload: { /* whitelist fields */ },
  });
  return { status_code: 200, body: result };
});
sdk.registerTrigger({
  type: "http",
  function_id: "api::your-endpoint",
  config: { api_path: "/agentmemory/your-path", http_method: "POST" },
});
```

## 测试

- 950+ tests
- 全部用 `vi.mock("iii-sdk")` 模式
- `test/crystallize.test.ts` 是 function 测试模板
