# Hooks

> 12+ Claude Code hooks（plugin/scripts/*.mjs）

## 列表

| Hook | 模式 | 用途 | 文件 |
|------|------|------|------|
| `pre-tool-use` | context-injecting | 工具调用前注入相关记忆 | `pre-tool-use.mjs` |
| `pre-compact` | context-injecting | compact 之前 recall | `pre-compact.mjs` |
| `session-start` | context-injecting | session 启动载入上下文 | `session-start.mjs` |
| `post-tool-use` | fire-and-forget | 记录 tool 调用 | `post-tool-use.mjs` |
| `post-tool-failure` | fire-and-forget | 记录失败 | `post-tool-failure.mjs` |
| `prompt-submit` | fire-and-forget | 记录 prompt | `prompt-submit.mjs` |
| `notification` | fire-and-forget | 通知 | `notification.mjs` |
| `stop` | fire-and-forget (1500ms) | session 停止 | `stop.mjs` |
| `session-end` | fire-and-forget (1500ms) | session 结束 | `session-end.mjs` |
| `subagent-start` | fire-and-forget | subagent 启动 | `subagent-start.mjs` |
| `subagent-stop` | fire-and-forget | subagent 停止 | `subagent-stop.mjs` |
| `task-completed` | fire-and-forget | task 完成 | `task-completed.mjs` |
| `post-commit` | fire-and-forget | commit 后记录 | `post-commit.mjs` |
| `diagnostics` | utility | 诊断 | `diagnostics.mjs` |

## 两种模式

### Context-Injecting

读取 stdin (JSON)，调 agentmemory REST API，**写**到 stdout 让 Claude Code 注入。

```javascript
// plugin/scripts/pre-tool-use.mjs
import { readFileSync } from "fs";

const input = JSON.parse(readFileSync(0, "utf-8"));

try {
  // 1. 决定 recall query
  const query = extractQuery(input.tool_input);
  
  // 2. 调 agentmemory
  const resp = await fetch(
    `${process.env.AGENTMEMORY_URL}/agentmemory/search`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit: 5, scope: input.cwd }),
      signal: AbortSignal.timeout(3000),
    }
  );
  
  const data = await resp.json();
  
  // 3. 写 stdout → Claude Code 注入
  console.log(`<memory>\n${formatResults(data.results)}\n</memory>`);
} catch (e) {
  // 静默失败（不要 break agent）
  process.exit(0);
}
```

**为什么必须 await + try/catch**：脚本必须 wait for response 才有内容输出给 Claude Code；timeout 是 hang 时间的唯一边界。

### Telemetry-Only

读 stdin，调 fetch，**不**写 stdout，**不** await。

```javascript
// plugin/scripts/post-tool-use.mjs
const input = JSON.parse(readFileSync(0, "utf-8"));

fetch(`${process.env.AGENTMEMORY_URL}/agentmemory/observe`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    event: "post-tool-use",
    tool: input.tool_name,
    input: input.tool_input,
    output: input.tool_output,
    cwd: input.cwd,
  }),
  signal: AbortSignal.timeout(3000),
}).catch(() => {});  // 不要 await

// 强制退出（unref 让 setTimeout 不阻塞 event loop）
setTimeout(() => process.exit(0), 500).unref();
```

**为什么不 await + 强制退出**：避免 hook 阻塞 Claude Code 的 next-prompt boundary。`setTimeout.unref()` 让 Node 在 fetch flush 到 socket buffer 后立即退出。

**多请求 hook（`stop`, `session-end`）用 1500ms timeout**：

```javascript
// plugin/scripts/stop.mjs
fetch(...).catch(() => {});
fetch(...).catch(() => {});
fetch(...).catch(() => {});
setTimeout(() => process.exit(0), 1500).unref();  // 1500ms 而非 500ms
```

## 配置（plugin/.claude-plugin/plugin.json）

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": ".*",
      "hooks": [{ "type": "command", "command": "node plugin/scripts/pre-tool-use.mjs" }]
    }],
    "PostToolUse": [{
      "matcher": ".*",
      "hooks": [{ "type": "command", "command": "node plugin/scripts/post-tool-use.mjs" }]
    }],
    "SessionStart": [{
      "matcher": ".*",
      "hooks": [{ "type": "command", "command": "node plugin/scripts/session-start.mjs" }]
    }],
    "Stop": [{
      "matcher": ".*",
      "hooks": [{ "type": "command", "command": "node plugin/scripts/stop.mjs" }]
    }],
    "UserPromptSubmit": [{
      "matcher": ".*",
      "hooks": [{ "type": "command", "command": "node plugin/scripts/prompt-submit.mjs" }]
    }],
    "Notification": [{
      "matcher": ".*",
      "hooks": [{ "type": "command", "command": "node plugin/scripts/notification.mjs" }]
    }]
  }
}
```

## 环境变量

| 变量 | 用途 |
|------|------|
| `AGENTMEMORY_URL` | agentmemory daemon URL (default: `http://localhost:49135`) |
| `AGENTMEMORY_SCOPE` | 默认 scope (default: `default`) |
| `AGENTMEMORY_API_KEY` | API key (如果启用 auth) |

## 调试

```bash
# 1. 模拟 hook 调用
echo '{"tool_name":"Read","tool_input":{"path":"/foo"},"cwd":"/proj"}' | \
  node plugin/scripts/post-tool-use.mjs

# 2. 看 stderr
AGENTMEMORY_DEBUG=1 node plugin/scripts/pre-tool-use.mjs < input.json
```

## 性能约束

| Hook | 目标延迟 | 超时 |
|------|----------|------|
| context-injecting | < 500ms | 3000ms |
| telemetry (single) | < 100ms | 500ms force-exit |
| telemetry (multi) | < 500ms | 1500ms force-exit |

超过目标延迟会感知到 agent 速度变慢。
