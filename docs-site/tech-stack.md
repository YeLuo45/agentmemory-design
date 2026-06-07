# Tech Stack

> agentmemory 技术栈详解（v0.9.28）

## 核心

| 类别 | 技术 | 版本 |
|------|------|------|
| 语言 | TypeScript | 5.x strict mode |
| 模块系统 | ESM | `"type": "module"` |
| 运行时 | Node.js | >= 22 |
| 构建 | tsdown | (TypeScript → ESM) |
| 测试 | vitest | 950+ tests |
| 包管理 | npm | (含 pnpm fallback) |
| 后端 | iii-engine | WebSocket (port 49134) |
| 数据库 | SQLite | via iii-engine StateModule |

## iii-engine（依赖）

| 组件 | 角色 |
|------|------|
| **Worker** | 后台执行单元 |
| **Function** | 注册式 RPC（agentmemory 注册 50+） |
| **Trigger** | 事件触发器（http / cron / mcp） |
| **StateModule** | KV + SQLite 持久化 |
| **WebSocket** | agentmemory ↔ iii-engine 通信 |

## MCP Layer

| 组件 | 技术 |
|------|------|
| 协议 | Model Context Protocol (Anthropic standard) |
| Transport | stdio (默认) / HTTP (可选) |
| Tools | 53 (8 visible, 45 behind `AGENTMEMORY_TOOLS=all`) |
| Resources | 6 (data refs) |
| Prompts | 3 (template prompt) |
| 运行时模式 | `standalone` (不依赖 iii-engine) / `connected` (连 iii) |

## REST Layer

| 组件 | 技术 |
|------|------|
| Endpoints | 128 |
| Path 前缀 | `/agentmemory/...` |
| Auth | `checkAuth(req, secret)` per endpoint |
| 字段过滤 | whitelist fields, 永不传 raw body to `sdk.trigger()` |
| 状态码 | 标准 HTTP（200/201/400/401/404/500） |

## 存储

| 数据 | 位置 | Schema |
|------|------|--------|
| Memory entries | `data/state_store.db` (SQLite) | `state/schema.ts` 定义 |
| Audit log | `data/audit.db` | `AuditEntry` interface |
| Embeddings | SQLite + vector index | `migrate-vector-index.ts` |
| KV scopes | 多个（mem / graph / lesson / skill） | `state/schema.ts` |

## Hooks (Claude Code)

agentmemory 暴露 14 hook 脚本到 `plugin/scripts/`：

| Hook | 模式 | 用途 |
|------|------|------|
| `pre-tool-use` | context-injecting | 注入相关记忆到 prompt |
| `pre-compact` | context-injecting | compact 之前 recall |
| `session-start` | context-injecting | session 启动时载入上下文 |
| `post-tool-use` | fire-and-forget | 记录 tool 调用 |
| `post-tool-failure` | fire-and-forget | 记录失败 |
| `prompt-submit` | fire-and-forget | 记录 prompt |
| `notification` | fire-and-forget | 通知 |
| `stop` | fire-and-forget (1500ms) | session 停止 |
| `session-end` | fire-and-forget (1500ms) | session 结束 |
| `subagent-start` | fire-and-forget | subagent 启动 |
| `subagent-stop` | fire-and-forget | subagent 停止 |
| `task-completed` | fire-and-forget | task 完成 |
| `post-commit` | fire-and-forget | commit 后记录 |
| `diagnostics` | (utility) | 诊断 |

**两种模式**：
- **Context-injecting** (`pre-*`, `session-start`) — `await fetch(...)` + try/catch；脚本必须等响应
- **Telemetry-only** (其余) — `fetch(...).catch(()=>{})` + `setTimeout(0).unref()` 强制退出

## Skills (Claude Code Plugin)

4 个 skill 暴露到 `plugin/skills/`：
- (实际列表需 explore `plugin/skills/`，AGENTS.md 提到 4 个)

## 第三方 LLM Provider

`src/providers/` 抽象层：
- 任何 LLM 都能插入（generateId / fingerprint / embed / summarize）
- 默认用 iii-engine 自带 provider

## 部署

| 组件 | 技术 |
|------|------|
| Docker | `docker-compose.yml` + `iii-config.docker.yaml` |
| Standalone | `npx agentmemory` (用 `mcp/standalone.ts`) |
| Remote daemon | daemon listens on port + serves MCP/REST |
| Helm / k8s | 暂未提供（contribution 欢迎） |

## MCP 工具分类

| 类别 | 工具数（估） | 例子 |
|------|--------------|------|
| 基础 CRUD | 8 (default visible) | memory_remember / memory_search / memory_forget |
| 高级 | ~20 | memory_crystallize / memory_consolidate / memory_evict |
| Graph | ~10 | memory_graph_query / memory_graph_add_node |
| 搜索 | ~8 | memory_smart_search / memory_vision_search |
| 运维 | ~7 | memory_export / memory_import / memory_diagnostics |
