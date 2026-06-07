---
layout: home

hero:
  name: "agentmemory"
  text: "Persistent Memory for AI Coding Agents"
  tagline: "你的编码 agent 记住一切 — 不再需要反复解释。建在 iii-engine 之上，跨 10+ AI agent 平台。"
  actions:
    - theme: brand
      text: Architecture
      link: /architecture
    - theme: alt
      text: GitHub
      link: https://github.com/rohitg00/agentmemory

features:
  - icon: 🧠
    title: 50+ iii Functions
    details: remember / search / crystallize / consolidate / evict / graph / mesh / temporal-graph / vision-search / smart-search
  - icon: 🕸️
    title: Knowledge Graph
    details: 节点 = 记忆/事实/关系；边 = 引用/因果/时间；支持 confidence scoring + lifecycle + hybrid search
  - icon: 🔌
    title: 53 MCP Tools
    details: 默认 8 个可见（AGENTMEMORY_TOOLS=all 启用全部）；6 MCP resources + 3 MCP prompts
  - icon: 🪝
    title: 12 Hooks + 4 Skills
    details: Claude Code 完整生命周期 hook 覆盖：pre-tool-use / post-tool-use / pre-compact / session-start/stop / subagent-start/stop / task-completed 等
  - icon: 🌐
    title: 10+ Platform Integrations
    details: Claude Code / GitHub Copilot CLI / Cursor / Gemini CLI / Codex CLI / Hermes / OpenClaw / pi / OpenCode / 任何 MCP client
  - icon: 🔍
    title: Hybrid Search
    details: BM25 + vector + knowledge-graph 三路召回，confidence scoring + temporal decay
  - icon: 📦
    title: 128 REST Endpoints
    details: 全 SDK 暴露；可被任何 HTTP client 调用；Plugin REST proxy 转发
  - icon: 🛡️
    title: Privacy + Retention
    details: 隐私分类、retention 策略、auto-forget、cascade delete、disk-size-manager、leasing
  - icon: 🧬
    title: Crystallize Pattern
    details: 把零散 remember 调用聚合成 structured lessons / skills / patterns（karpathy LLM Wiki 扩展）
---

## 项目定位

> **"Your coding agent remembers everything. No more re-explaining."**

agentmemory 是 **iii-engine 之上的持久化记忆层**，让任何 AI 编码代理跨 session / 跨项目 / 跨平台保留上下文。

## 核心创新

- **iii-engine 之上** — Worker/Function/Trigger 三原语；一切操作经 `registerFunction` / `registerTrigger` / `sdk.trigger()`，**绝不**绕过 iii-engine 用直连 SQLite
- **Crystallize** — 把零散 remember 调用聚合成 structured knowledge（lessons / skills / patterns），源头是 Karpathy 的 LLM Wiki gist
- **Confidence + Lifecycle** — 每个记忆有 confidence score + lifecycle (active/stale/evicted)，自动 decay + GC
- **Hybrid Search** — BM25 + vector + graph 三路召回，自动 rerank
- **Multi-platform via MCP** — 同一份代码，10+ AI 平台立刻可用

## 与 agentmemory-design 站

本站（agentmemory-design）以**真实代码探索**为依据（codegraph indexed 4122 nodes / 10483 edges in 7.9s），逐文件记录 agentmemory 的架构、数据模型、API、hooks。所有 claim 都能回到 source code 验证。
