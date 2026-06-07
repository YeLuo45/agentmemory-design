# Skills

> 4 个 plugin skills（Claude Code plugin 暴露）

## 列表

| Skill | 触发 | 作用 |
|-------|------|------|
| `/agentmemory-remember` | 显式调用 | remember 当前上下文 |
| `/agentmemory-recall` | 显式调用 | 搜索相关记忆 |
| `/agentmemory-crystallize` | 显式调用 | 触发 crystallize pipeline |
| `/agentmemory-insights` | 显式调用 | 显示统计 + insights |

## SKILL.md 模式

每个 skill 目录有 `SKILL.md`：

```markdown
---
name: agentmemory-recall
description: Search agentmemory for memories related to current context
---

# Recall

You are a recall assistant. When the user asks "what do you remember about X" or
"recall memories related to Y", you should:

1. Call the MCP tool `memory_search` with the query
2. Format the results as a concise list
3. Optionally link to source memory IDs

## Parameters

- `query` (required): natural language query
- `scope` (optional): restrict to scope
- `limit` (default 10): max results

## Response format

```
Found {count} relevant memories:

1. [{id}] {summary}
   Tags: {tags}
   Confidence: {confidence}
   Created: {createdAt}

2. ...
```
```

## 与 MCP 工具的关系

Skills 实际是 **prompt + workflow 包装**，背后调 MCP 工具：

```
/agentmemory-recall
   ↓
Skill prompt (SKILL.md)
   ↓
mcp tool: memory_search
   ↓
REST: POST /agentmemory/search
   ↓
iii function: mem::search
   ↓
Result → Skill formats → user
```

## 安装

```bash
# Claude Code
claude plugins install https://github.com/rohitg00/agentmemory

# 然后在 Claude Code 启用
/plugins enable agentmemory

# 之后 /agentmemory-recall 可用
```

## 自定义 Skill

加新 skill：

```bash
mkdir -p plugin/skills/agentmemory-my-thing
cat > plugin/skills/agentmemory-my-thing/SKILL.md << 'EOF'
---
name: agentmemory-my-thing
description: My custom workflow
---

# My Thing

...
EOF
```

## 跨平台

Skills 是 Claude Code 概念。其他平台：
- **Cursor**: 用 `.mdc` 规则文件
- **Codex**: 不支持
- **OpenCode**: 用 `agentmemory-capture.ts` (plugin/opencode/)

## 版本同步

加 skill 必更新：
- `plugin/.claude-plugin/plugin.json` (skills 数组)
- `plugin/plugin.json` (legacy, if present)
- `src/index.ts` (skills count in log line)
- `README.md` (skills count)
