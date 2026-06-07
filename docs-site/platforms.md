# Platforms

> 10+ AI agent 平台集成

## 平台清单

| 平台 | 集成方式 | 入口文件 |
|------|----------|----------|
| **Claude Code** | MCP + Plugin | `plugin/.claude-plugin/plugin.json` |
| **Cursor** | MCP | `plugin/.cursor-plugin/` (或 cursor settings) |
| **Codex CLI** | MCP | `plugin/.codex-plugin/` |
| **GitHub Copilot CLI** | MCP | `plugin/.mcp.copilot.json` |
| **Gemini CLI** | MCP | `plugin/.gemini-plugin/` |
| **Hermes Agent** | MCP | (用户配置 ~/.hermes/config.yaml) |
| **OpenClaw** | MCP | `plugin/.openclaw-plugin/` |
| **pi** | MCP | `plugin/.pi-plugin/` |
| **OpenCode** | Plugin | `plugin/opencode/agentmemory-capture.ts` (29 symbols) |
| **任何 MCP 客户端** | MCP stdio/HTTP | 直接调 |

## Claude Code

**安装**:
```bash
claude plugins install https://github.com/rohitg00/agentmemory
```

**插件自动提供**:
- 53 MCP tools（按 `AGENTMEMORY_TOOLS` 控制）
- 6 MCP resources
- 3 MCP prompts
- 12 hooks
- 4 skills

**Version 同步**:
```bash
# 改 plugin.json 后 bump version
1. package.json
2. src/version.ts
3. src/types.ts (ExportData version union)
4. src/functions/export-import.ts (supportedVersions)
5. test/export-import.test.ts (version assertion)
6. plugin/.claude-plugin/plugin.json
7. plugin/plugin.json (if present)
```

## Cursor

Cursor 自动发现 MCP servers via:
- `.cursor/mcp.json` (项目级)
- Settings → MCP (用户级)

agentmemory 可作 stdio MCP server：

```json
// .cursor/mcp.json
{
  "mcpServers": {
    "agentmemory": {
      "command": "npx",
      "args": ["agentmemory", "mcp"],
      "env": {
        "AGENTMEMORY_URL": "http://localhost:49135"
      }
    }
  }
}
```

## Codex

类似 Cursor：

```json
// .codex/config.toml
[mcp_servers.agentmemory]
command = "npx"
args = ["agentmemory", "mcp"]
```

## GitHub Copilot CLI

通过 `.mcp.copilot.json`：

```json
{
  "mcpServers": {
    "agentmemory": {
      "type": "stdio",
      "command": "npx",
      "args": ["agentmemory", "mcp"]
    }
  }
}
```

## Gemini CLI

通过 `settings.json` 或 `gemini-extension.json`。

## Hermes Agent

通过 `~/.hermes/config.yaml`：

```yaml
mcp_servers:
  agentmemory:
    command: npx
    args: [agentmemory, mcp, serve, --mcp]
    env:
      AGENTMEMORY_URL: http://localhost:49135
```

## OpenClaw / pi

类似 Claude Code plugin manifest 模式。

## OpenCode (深度集成)

`plugin/opencode/agentmemory-capture.ts` (29 symbols) — OpenCode 专用 capture 逻辑。

```typescript
// plugin/opencode/agentmemory-capture.ts
export async function captureOpenCodeEvent(event: OpenCodeEvent) {
  // OpenCode 特有字段处理
  const memory = {
    content: formatOpenCodeEvent(event),
    scope: `opencode:${event.sessionId}`,
    tags: ["opencode", event.type],
    metadata: {
      opencodeVersion: event.version,
      sessionId: event.sessionId,
    },
  };
  
  // Forward to agentmemory REST
  await fetch(`${process.env.AGENTMEMORY_URL}/agentmemory/remember`, {
    method: "POST",
    body: JSON.stringify(memory),
  });
}
```

## 通用 MCP 客户端

任何支持 MCP stdio 的客户端都能用：

```bash
# 启动 stdio MCP server
AGENTMEMORY_TOOLS=all npx agentmemory mcp

# 客户端配置（以 Claude Desktop 为例）
{
  "mcpServers": {
    "agentmemory": {
      "command": "npx",
      "args": ["agentmemory", "mcp"]
    }
  }
}
```

## 平台差异

| 平台 | Tools 显示 | Hooks | Skills | Resources |
|------|------------|-------|--------|-----------|
| Claude Code | ✓ 全部 | ✓ 全部 | ✓ | ✓ |
| Cursor | ✓ 全部 | ✗ | ✗ | ✓ |
| Codex | ✓ 全部 | ✗ | ✗ | ✓ |
| Copilot | ✓ 全部 | ✗ | ✗ | ✓ |
| Gemini | ✓ 全部 | ✗ | ✗ | ✓ |
| OpenCode | ✓ 全部 | ✗ (有专用 capture) | ✗ | ✓ |
| 其他 | ✓ 全部 | ✗ | ✗ | ✓ |

**MCP tools + resources** 是通用接口；**hooks + skills** 是 Claude Code 专属。

## 选择可见工具

`AGENTMEMORY_TOOLS` 环境变量控制：

```bash
# 默认（8 基础）
npx agentmemory mcp

# 全部
AGENTMEMORY_TOOLS=all npx agentmemory mcp

# 选择
AGENTMEMORY_TOOLS=remember,search,forget,crystallize npx agentmemory mcp
```
