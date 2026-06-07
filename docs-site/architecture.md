# Architecture

> agentmemory 系统架构（v0.9.28，4122 nodes / 10483 edges indexed）

## 1. 概览

agentmemory 是 **iii-engine 之上的应用层**，把 iii-engine 三原语（Worker/Function/Trigger）组装成"AI 代理持久化记忆系统"。

```
┌────────────────────────────────────────────────────────────────────┐
│                   AI Agent (10+ platforms)                          │
│  Claude Code / Cursor / Codex / Copilot / Gemini / Hermes / ...    │
└─────────────────┬──────────────────────────────────────────────────┘
                  │ MCP / REST
                  ▼
┌────────────────────────────────────────────────────────────────────┐
│              agentmemory  (this repo)                                │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  MCP Layer (53 tools)  ─►  REST Proxy (128 endpoints)       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Function Layer (50+ iii functions)                          │  │
│  │   - remember / search / crystallize                          │  │
│  │   - graph / mesh / temporal-graph                            │  │
│  │   - consolidate / evict / retention                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  State Layer (SQLite via iii-engine StateModule)             │  │
│  │   ./data/state_store.db                                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────┬──────────────────────────────────────────────────┘
                  │ WebSocket (port 49134)
                  ▼
┌────────────────────────────────────────────────────────────────────┐
│              iii-engine  (https://github.com/iii-hq/iii)            │
│  - Worker / Function / Trigger                                       │
│  - WebSocket transport                                               │
│  - StateModule (KV + SQLite)                                         │
└────────────────────────────────────────────────────────────────────┘
```

## 2. 模块结构

```
agentmemory/
├── src/
│   ├── auth.ts                 # 鉴权
│   ├── cli/                    # CLI 入口
│   ├── cli.ts                  # CLI 顶层
│   ├── config.ts               # 配置
│   ├── eval/                   # 评估
│   ├── functions/              # ★ 50+ iii functions（核心）
│   ├── health/                 # 健康检查
│   ├── hooks/                  # Hook 辅助（ts 端）
│   ├── index.ts                # 主入口
│   ├── logger.ts
│   ├── mcp/                    # ★ MCP server
│   │   ├── server.ts           # MCP 协议实现
│   │   ├── transport.ts        # stdio / HTTP
│   │   ├── tools-registry.ts   # 53 工具定义
│   │   ├── rest-proxy.ts       # MCP → REST
│   │   ├── standalone.ts       # 不依赖 iii-engine 的运行模式
│   │   └── in-memory-kv.ts
│   ├── prompts/                # MCP prompts
│   ├── providers/              # 第三方 provider (LLM, embed)
│   ├── replay/                 # 事件回放
│   ├── state/                  # 状态 schema
│   ├── telemetry/
│   ├── triggers/               # REST 触发器
│   ├── types.ts
│   ├── utils/
│   ├── version.ts
│   └── viewer/                 # 调试 viewer
├── plugin/                     # Claude Code plugin manifest
│   ├── plugin.json
│   ├── hooks/                  # 14 hook 脚本
│   ├── opencode/               # opencode 集成
│   ├── scripts/                # (same hooks; legacy location)
│   └── skills/                 # 4 skills
├── benchmark/                  # 性能基准
├── deploy/                     # 部署配置
├── docs/                       # 用户文档
├── examples/                   # 示例项目
├── eval/                       # 评估套件
├── assets/                     # 静态资源
└── docker-compose.yml
```

## 3. 数据流：一次 `remember` 调用

```
1. Agent calls MCP tool "memory_remember" with { scope, content, tags, ... }
2. mcp/server.ts: handle "memory_remember" case
3. mcp/rest-proxy.ts: forward to REST POST /agentmemory/remember
4. triggers/api.ts: register function "api::remember"
5. functions/remember.ts (mem::remember):
   a. validate input
   b. fingerprintId() for dedup
   c. kv.set("memory:{id}", { content, confidence, lifecycle, ... })
   d. recordAudit() for state change tracking
6. return { id, fingerprint, ... } → back to agent
```

## 4. 关键设计原则

| 原则 | 实现 |
|------|------|
| **iii-engine 是唯一入口** | 一切经 `registerFunction` / `registerTrigger` / `sdk.trigger()`；不直连 SQLite |
| **MCP 优先** | 53 工具；10+ 平台零成本接入 |
| **REST 全 SDK** | 128 endpoints；任何 HTTP client 可调 |
| **Crystallize 聚合** | 零散 remember → structured lessons/skills/patterns |
| **Confidence + Lifecycle** | 每条记忆有 confidence + lifecycle 字段，自动 decay |
| **Hybrid Search** | BM25 + vector + graph 三路召回 |
| **Privacy + Retention** | 隐私分类、retention 策略、auto-forget、cascade delete |

## 5. 一致性规则（来自 AGENTS.md）

**加 MCP 工具必更新 8 处**：
1. `src/mcp/tools-registry.ts`
2. `src/mcp/server.ts` (handler switch case)
3. `src/triggers/api.ts`
4. `src/index.ts` (function 注册 + endpoint 数)
5. `test/mcp-standalone.test.ts` (tool count assertion)
6. `README.md` (tool count)
7. `plugin/.claude-plugin/plugin.json` (tool count)
8. `plugin/plugin.json` + `plugin/.mcp.copilot.json` (MCP exposure)

**加 REST endpoint 必更新 3 处**：
1. `src/triggers/api.ts`
2. `src/index.ts` (endpoint count)
3. `README.md` (endpoint count)

**Version 升级必更新 7 处**：
1. `package.json` version
2. `src/version.ts` VERSION + type union
3. `src/types.ts` ExportData version union
4. `src/functions/export-import.ts` supportedVersions
5. `test/export-import.test.ts` version assertion
6. `plugin/.claude-plugin/plugin.json` version
7. `plugin/plugin.json` (when present)

## 6. 关键文件代码量

| 文件 | Symbols | 角色 |
|------|---------|------|
| `src/functions/search.ts` | 33 | 搜索主入口（BM25 + vector + graph） |
| `src/functions/graph.ts` | 30 | 知识图谱构建 |
| `src/functions/replay.ts` | 27 | 事件回放 |
| `src/functions/slots.ts` | 25 | 槽位管理（working memory） |
| `src/functions/obsidian-export.ts` | 24 | Obsidian 集成 |
| `src/functions/summarize.ts` | 23 | 摘要 |
| `src/functions/smart-search.ts` | 21 | 智能搜索（query expansion） |
| `src/functions/graph-retrieval.ts` | 21 | 图检索 |
| `src/functions/mesh.ts` | 20 | 跨代理 mesh |
| `src/functions/compress.ts` | 20 | 压缩 |
| `src/mcp/standalone.ts` | 27 | 不依赖 iii-engine 的 MCP 模式 |
| `src/mcp/rest-proxy.ts` | 24 | MCP → REST 代理 |

## 7. 当前规模（v0.9.28）

- **53 MCP tools** (8 visible by default, `AGENTMEMORY_TOOLS=all` for all)
- **128 REST endpoints**
- **6 MCP resources, 3 MCP prompts**
- **12 hooks, 4 skills**
- **50+ iii functions**
- **950+ tests**
- **4122 nodes, 10483 edges** (codegraph indexed)
