# MCP Tools

> 53 MCP tools 概览（src/mcp/tools-registry.ts）

## 分类

### 基础 CRUD (默认 8 工具)

| Tool | 作用 |
|------|------|
| `memory_remember` | 写入单条记忆 |
| `memory_search` | 三路召回搜索 |
| `memory_forget` | 删除记忆（cascade） |
| `memory_observe` | 记录观察（不 dedup） |
| `memory_get` | 按 ID 取记忆 |
| `memory_list` | 列 scope 内记忆 |
| `memory_update` | 更新字段 |
| `memory_count` | 计数 |

### 高级 CRUD

| Tool | 作用 |
|------|------|
| `memory_enrich` | 给记忆加 context |
| `memory_profile` | profile CRUD |
| `memory_actions` | 动作 CRUD |
| `memory_signals` | 信号 |
| `memory_context` | 上下文管理 |
| `memory_working_memory` | working memory |
| `memory_slots` | 槽位 |

### 搜索

| Tool | 作用 |
|------|------|
| `memory_smart_search` | 智能搜索（query expansion） |
| `memory_vision_search` | 视觉搜索 |
| `memory_query_expansion` | 单独 query expansion |
| `memory_sliding_window` | 滑动窗口 |

### Crystallize

| Tool | 作用 |
|------|------|
| `memory_crystallize` | 聚合成 lessons |
| `memory_consolidate` | 跨 lesson 整合 |
| `memory_lessons` | lessons CRUD |
| `memory_patterns` | patterns CRUD |
| `memory_skill_extract` | 提取 skill |
| `memory_summarize` | 摘要 |
| `memory_pipeline` | 跑完整 crystallize pipeline |

### 知识图谱

| Tool | 作用 |
|------|------|
| `memory_graph_add_node` | 加节点 |
| `memory_graph_add_edge` | 加边 |
| `memory_graph_query` | BFS 查询 |
| `memory_graph_search` | 节点搜索 |
| `memory_graph_remove_node` | 删节点 |
| `memory_graph_remove_edge` | 删边 |
| `memory_temporal_graph` | 时序查询 |
| `memory_frontier` | 边界探索 |
| `memory_relations` | 关系管理 |
| `memory_mesh` | 跨代理 mesh |

### 压缩

| Tool | 作用 |
|------|------|
| `memory_compress` | 压缩 |
| `memory_compress_file` | 文件压缩 |
| `memory_flow_compress` | 流式压缩 |
| `memory_compress_synthetic` | 合成压缩 |

### 生命周期

| Tool | 作用 |
|------|------|
| `memory_evict` | 淘汰 |
| `memory_auto_forget` | 自动遗忘 |
| `memory_retention` | 保留策略 |
| `memory_disk_size` | 磁盘配额 |
| `memory_cascade` | 级联 |
| `memory_leases` | 租约 |

### 快照

| Tool | 作用 |
|------|------|
| `memory_snapshot` | 快照 |
| `memory_checkpoints` | checkpoint |
| `memory_timeline` | 时间线 |
| `memory_replay` | 事件回放 |

### 集成

| Tool | 作用 |
|------|------|
| `memory_obsidian_export` | Obsidian 导出 |
| `memory_branch_aware` | git branch 感知 |
| `memory_claude_bridge` | Claude 集成 |
| `memory_team` | 团队协作 |

### 运维

| Tool | 作用 |
|------|------|
| `memory_export` | 导出 |
| `memory_import` | 导入 |
| `memory_diagnostics` | 诊断 |
| `memory_sentinels` | 哨兵 |
| `memory_audit` | 审计 |
| `memory_access_tracker` | 访问追踪 |
| `memory_privacy` | 隐私 |
| `memory_governance` | 治理 |
| `memory_migrate` | 迁移 |
| `memory_verify` | 验证 |
| `memory_reflect` | 反思 |
| `memory_routines` | 例行 |
| `memory_sketches` | 草图 |
| `memory_facets` | facet |
| `memory_file_index` | 文件索引 |
| `memory_image_refs` | 图片引用 |
| `memory_image_quota` | 图片配额 |
| `memory_search_history_sweep` | 搜索历史清理 |

## 显隐控制

`AGENTMEMORY_TOOLS` 环境变量：

- 默认 = 仅 8 个基础工具
- `all` = 全部 53 个

```bash
# 默认（只 8 个）
npx agentmemory mcp

# 全部
AGENTMEMORY_TOOLS=all npx agentmemory mcp

# 选择性
AGENTMEMORY_TOOLS=remember,search,forget npx agentmemory mcp
```

## 注册模式

```typescript
// src/mcp/tools-registry.ts
import { getAllTools } from "./tools-registry";

const ALL_TOOLS = [
  {
    name: "memory_remember",
    description: "Store a memory with deduplication by fingerprint",
    inputSchema: {
      type: "object",
      properties: {
        scope: { type: "string" },
        content: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        metadata: { type: "object" },
      },
      required: ["scope", "content"],
    },
  },
  // ... 52 more
];

export function getAllTools() {
  if (process.env.AGENTMEMORY_TOOLS === "all") return ALL_TOOLS;
  if (process.env.AGENTMEMORY_TOOLS) {
    return ALL_TOOLS.filter(t => 
      process.env.AGENTMEMORY_TOOLS.split(",").includes(t.name)
    );
  }
  return ALL_TOOLS.filter(t => t.visibleByDefault);
}
```

## Handler 模式

```typescript
// src/mcp/server.ts
case "memory_remember": {
  const args = request.params.arguments as Record<string, unknown>;
  // validate
  if (typeof args.content !== "string") {
    return errorResult("content required");
  }
  
  // forward to REST
  const result = await sdk.trigger({
    function_id: "mem::remember",
    payload: {
      scope: args.scope,
      content: args.content,
      tags: args.tags,
    },
  });
  
  return {
    status_code: 200,
    body: {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2),
      }],
    },
  };
}
```

## 资源（6）

agentmemory 暴露 6 个 MCP resources：

| URI | 描述 |
|-----|------|
| `agentmemory://stats` | 实时统计（memory count, scope 分布） |
| `agentmemory://recent` | 最近 remember 的记忆 |
| `agentmemory://graph` | 知识图谱摘要 |
| `agentmemory://lessons` | 最近的 lessons |
| `agentmemory://audit/recent` | 最近审计日志 |
| `agentmemory://config` | 当前配置（脱敏） |

## Prompts（3）

| Name | 描述 |
|------|------|
| `recall` | "Recall memories about X" 模板 |
| `crystallize-now` | "Crystallize recent memories" 模板 |
| `search-help` | "Help me search for X" 模板 |

## Standalone 模式

```bash
# 不依赖 iii-engine 的 MCP server
npx agentmemory mcp --standalone
```

用 `src/mcp/standalone.ts`（27 symbols）— 直接起 MCP server，用 in-memory KV。

适合：
- 快速测试
- CI
- 演示

## REST Proxy

```typescript
// src/mcp/rest-proxy.ts (24 symbols)
// MCP tool → REST endpoint 转发
// 允许: MCP client → agentmemory MCP → REST API → iii-engine
// 替代: MCP client → REST API directly
```

## Transport

- **stdio** (默认) — 嵌入 agent 进程
- **HTTP/SSE** — 远程 daemon

```bash
# stdio (默认)
npx agentmemory mcp

# HTTP daemon
npx agentmemory mcp --transport http --port 49135
```

## 跨平台

MCP 是 Anthropic 标准协议，所以同一份代码支持：
- Claude Code
- Cursor
- Codex
- Gemini CLI
- GitHub Copilot CLI
- Hermes Agent
- OpenClaw
- pi
- OpenCode
- 任何 MCP 客户端
