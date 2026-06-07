# iii-engine

> agentmemory 的运行时底座

## iii-engine 是什么

[iii-hq/iii](https://github.com/iii-hq/iii) 是一个 **event-driven application runtime**，把应用抽象成三个原语：

| 原语 | 角色 |
|------|------|
| **Worker** | 后台执行单元（agentmemory 不直接用，由 iii 自身管理） |
| **Function** | 注册式 RPC，agentmemory 注册 50+ iii functions |
| **Trigger** | 事件触发器（http / cron / mcp） |

## 通信

```
agentmemory  ──── WebSocket (port 49134) ────►  iii-engine
            ◄────  (events, function results) ────
```

## agentmemory 在 iii 上做什么

### 1. Function 注册

```typescript
// src/index.ts 顶层
import { init } from "iii-sdk";

const sdk = await init({ url: "ws://localhost:49134" });

// 注册 50+ functions
sdk.registerFunction("mem::remember", async (data) => { ... });
sdk.registerFunction("mem::search", async (data) => { ... });
sdk.registerFunction("mem::crystallize", async (data) => { ... });
// ... 50+ more
```

### 2. Trigger 注册

```typescript
// src/triggers/api.ts
sdk.registerTrigger({
  type: "http",
  function_id: "api::remember",
  config: { api_path: "/agentmemory/remember", http_method: "POST" },
});
// ... 128 endpoints
```

### 3. 跨 function 调用

```typescript
// 在 function A 中调 function B
const result = await sdk.trigger({
  function_id: "mem::search",
  payload: { query: data.query },
});
```

## StateModule（持久化）

iii-engine 提供 `StateModule` = KV + SQLite 双层。

agentmemory 用的 KV scopes（来自 `src/state/schema.ts`）：

| Scope 前缀 | 用途 |
|-----------|------|
| `memory:{id}` | 单条记忆 |
| `memory:fingerprint:{fp}` | fingerprint → id 索引（dedup） |
| `lesson:{id}` | crystallize 输出的 lessons |
| `skill:{id}` | 从记忆提取的 skill |
| `pattern:{id}` | 模式 |
| `graph:node:{id}` | 知识图谱节点 |
| `graph:edge:{id}` | 知识图谱边 |
| `audit:{id}` | 审计日志 |
| `temporal:{ts}:{id}` | 时序数据 |

## 为什么强制走 iii

来自 AGENTS.md：
> **Everything goes through `registerFunction`/`registerTrigger`/`sdk.trigger()` — never bypass iii-engine with standalone SQLite or in-process alternatives.**

理由：
1. **统一审计** — 所有调用都经 iii-sdk，可追踪
2. **跨 function 能力** — search() 在 function A 中可调 crystallize()
3. **生命周期** — iii-engine 处理 graceful shutdown / restart / hot-reload
4. **可观测性** — iii-engine 自带 telemetry / replay
5. **避免破坏 isolation** — 直接 sqlite 多进程并发容易踩锁

## agentmemory 不用 iii 的两种场景

| 场景 | 替代 |
|------|------|
| **MCP standalone 模式** | `src/mcp/standalone.ts` — 直接起 MCP server，不连 iii |
| **Hook 脚本** | `plugin/scripts/*.mjs` — 通过 REST API 调用（iii 自动处理） |

## iii-engine 启动

```bash
# 开发
iii dev

# Docker
docker-compose up iii

# 配置
iii-config.docker.yaml
```

## agentmemory 启动

```bash
# 1. iii 先起
iii dev &

# 2. agentmemory 启动（连 iii）
npx agentmemory

# 或者 standalone（MCP only）
npx agentmemory mcp --standalone
```

## 调试

- `replay/` — 事件回放（iii-engine 自带）
- `telemetry/` — agentmemory 自带遥测
- `iii-engine` 提供 Web UI 监控 function 调用
- `viewer/` — agentmemory 调试 viewer（代码里有，待确认）
