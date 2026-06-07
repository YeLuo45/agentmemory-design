# Crystallize

> agentmemory 核心创新 — 把零散 remember 聚合成 structured knowledge

## 什么是 Crystallize

源自 Karpathy 的 LLM Wiki gist（1.3k stars），agentmemory 的 crystallize 把它从"单次操作"扩展成"持续模式"：

```
remember() × N (零散、不结构化)
   ↓
[crystallize] (按 timeWindow + similarity 聚类)
   ↓
lesson (结构化、可复用)
   ↓
[consolidate] (跨 lesson 找模式)
   ↓
pattern (更高层抽象)
   ↓
[skill-extract] (从 pattern 提取可执行 skill)
   ↓
skill (agent 可直接调用)
```

## Crystallize Function

```typescript
// src/functions/crystallize.ts (10 symbols)
sdk.registerFunction("mem::crystallize", async ({ timeWindow, minClusterSize = 3, similarityThreshold = 0.8 }) => {
  // 1. 拉取 timeWindow 内的所有 remember
  const memories = await kv.list({
    prefix: "memory:",
    filter: m => isWithinTimeWindow(m, timeWindow) && m.lifecycle === "active",
  });
  
  // 2. Cluster by embedding similarity
  const clusters = clusterBySimilarity(memories, {
    threshold: similarityThreshold,
    minSize: minClusterSize,
  });
  
  // 3. LLM synthesize each cluster
  const lessons: Lesson[] = await Promise.all(clusters.map(async (cluster) => {
    const synthesis = await llm.synthesize({
      entries: cluster.entries,
      prompt: `Given ${cluster.entries.length} related memories, extract a reusable lesson.
Format: title + summary + 1-3 examples + tags.`,
      style: "lesson",
    });
    
    return {
      id: generateId(),
      type: "lesson",
      title: synthesis.title,
      summary: synthesis.summary,
      content: synthesis.content,
      basedOn: cluster.entries.map(e => e.id),
      confidence: average(cluster.entries.map(e => e.confidence)),
      tags: synthesis.tags,
      examples: synthesis.examples,
      createdAt: new Date().toISOString(),
      version: 1,
    };
  }));
  
  // 4. Persist
  for (const lesson of lessons) {
    await kv.set(`lesson:${lesson.id}`, lesson);
  }
  
  // 5. Mark source memories as "consolidated"
  for (const mem of memories) {
    await kv.update(`memory:${mem.id}`, m => ({ ...m, lifecycle: "consolidated" }));
  }
  
  return { lessonCount: lessons.length, sourceCount: memories.length };
});
```

## 触发策略

```typescript
// 自动触发 (后台 cron)
sdk.registerTrigger({
  type: "cron",
  function_id: "mem::crystallize",
  config: { schedule: "0 2 * * *" },  // 每天凌晨 2 点
});

// 手动触发 (MCP tool)
sdk.registerFunction("api::crystallize", async (req) => {
  return await sdk.trigger({
    function_id: "mem::crystallize",
    payload: { timeWindow: "7d" },
  });
});
```

## Consolidate

```typescript
// src/functions/consolidate.ts (11 symbols)
// 把多个 lesson 整合为更高层 pattern
async function consolidate(input: { lessonIds?: string[]; threshold?: number }) {
  // 1. 拉取 lessons
  const lessons = input.lessonIds
    ? input.lessonIds.map(id => kv.get(`lesson:${id}`))
    : await kv.list({ prefix: "lesson:" });
  
  // 2. Cluster lessons by similarity
  const clusters = clusterBySimilarity(lessons, { threshold: input.threshold ?? 0.7 });
  
  // 3. LLM synthesize each cluster → pattern
  const patterns = await Promise.all(clusters.map(async (cluster) => {
    const synth = await llm.synthesize({
      entries: cluster.entries,
      prompt: `Given ${cluster.entries.length} related lessons, find a higher-level pattern.
A pattern is more general than a single lesson.`,
      style: "pattern",
    });
    return {
      id: generateId(),
      type: "pattern",
      title: synth.title,
      summary: synth.summary,
      content: synth.content,
      basedOn: cluster.entries.map(e => e.id),
      version: 1,
    };
  }));
  
  // 4. Persist + update lessons (lifecycle → consolidated)
  for (const p of patterns) {
    await kv.set(`pattern:${p.id}`, p);
  }
  
  return { patternCount: patterns.length };
}
```

## Skill Extract

```typescript
// src/functions/skill-extract.ts (11 symbols)
// 从 pattern 提取可被 agent 调用的 skill
async function skillExtract(input: { patternIds?: string[] }) {
  const patterns = input.patternIds
    ? input.patternIds.map(id => kv.get(`pattern:${id}`))
    : await kv.list({ prefix: "pattern:" });
  
  const skills: Lesson[] = await Promise.all(patterns.map(async (p) => {
    const skill = await llm.synthesize({
      entries: [p],
      prompt: `Given this pattern, generate a reusable skill with:
- trigger conditions (when to use)
- preconditions
- steps (numbered)
- expected output
- example invocation`,
      style: "skill",
    });
    
    return {
      id: generateId(),
      type: "skill",
      title: skill.title,
      content: skill.content,
      basedOn: [p.id],
      confidence: p.confidence,
      version: 1,
      triggerConditions: skill.triggers,
      steps: skill.steps,
    };
  }));
  
  for (const s of skills) {
    await kv.set(`skill:${s.id}`, s);
  }
  
  return { skillCount: skills.length };
}
```

## Crystallization Pipeline

```typescript
// src/functions/consolidation-pipeline.ts (11 symbols)
// 一次性跑完 remember → lesson → pattern → skill
async function pipeline(input: { timeWindow?: string }) {
  const window = input.timeWindow || "7d";
  
  // Stage 1: crystallize
  const stage1 = await sdk.trigger({
    function_id: "mem::crystallize",
    payload: { timeWindow: window },
  });
  
  // Stage 2: consolidate
  const stage2 = await sdk.trigger({
    function_id: "mem::consolidate",
    payload: {},
  });
  
  // Stage 3: skill-extract
  const stage3 = await sdk.trigger({
    function_id: "mem::skill-extract",
    payload: {},
  });
  
  return {
    lessons: stage1.lessonCount,
    patterns: stage2.patternCount,
    skills: stage3.skillCount,
  };
}
```

## 版本与更新

每次 consolidate 一个 pattern → 新 version，旧的 pattern 标记 `superseded`，关联 lesson 不变。

```typescript
interface Lesson {
  // ...
  version: number;        // 每次更新 +1
  previousVersionId?: string;
  supersededById?: string;
}
```

## LLM 依赖

`src/providers/` 抽象层支持任何 LLM：

```typescript
// 简单模式 (默认 offline)
const lesson = await llm.synthesize({ ... });

// 用云端 LLM (可选)
const lesson = await llm.synthesize({
  ...,
  provider: "openai",
  model: "gpt-4o-mini",
});
```

## 性能

| 阶段 | 100 memories | 1k memories | 10k memories |
|------|--------------|-------------|--------------|
| Cluster | ~50ms | ~500ms | ~5s |
| LLM synthesize | ~2s/cluster (network bound) | same | same |
| Persist | ~10ms total | ~100ms | ~1s |
| **Total (5 clusters)** | **~10s** | **~12s** | **~15s** |

LLM 是主要瓶颈。优化：
- 批量 synthesize 多个 cluster（用 prompt batching）
- 用 cheaper model（gpt-4o-mini 而非 gpt-4o）
- 缓存 cluster 的 embedding 避免重算

## 失败处理

- LLM 失败 → lesson 标记 `pending-llm`，下次再试
- Cluster 太小（< minClusterSize）→ 跳过
- Embedding 失败 → 整个 crystallize 失败回滚（不更新 lifecycle）
