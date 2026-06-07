# Deployment

> 部署 iii-engine + agentmemory

## 模式

| 模式 | 启动 | 适用 |
|------|------|------|
| **MCP stdio** | `npx agentmemory mcp` | 嵌入 agent |
| **MCP standalone** | `npx agentmemory mcp --standalone` | 测试/演示/CI |
| **HTTP daemon** | `npx agentmemory mcp --transport http --port 49135` | 远程/多客户端 |
| **Docker** | `docker-compose up` | 完整 stack |
| **Helm / k8s** | (待贡献) | 生产 |

## Docker (推荐)

```bash
# 1. Clone
git clone https://github.com/rohitg00/agentmemory.git
cd agentmemory

# 2. 启动
docker-compose up -d

# 服务:
# - iii-engine: WebSocket :49134
# - agentmemory: REST :49135
# - agentmemory MCP: stdio (for clients)
```

`docker-compose.yml`：
```yaml
services:
  iii:
    image: ghcr.io/iii-hq/iii:latest
    ports: ["49134:49134"]
    volumes:
      - iii-data:/data
  
  agentmemory:
    build: .
    depends_on: [iii]
    environment:
      III_URL: ws://iii:49134
      AGENTMEMORY_API_KEY: ${AGENTMEMORY_API_KEY}
    ports: ["49135:49135"]
    volumes:
      - ./data:/app/data
```

## 本地开发

```bash
# 1. 启动 iii
iii dev  # listens on 49134

# 2. 启动 agentmemory (MCP stdio)
npx agentmemory mcp

# 或 standalone 模式（不需 iii）
npx agentmemory mcp --standalone
```

## 测试

```bash
npm test  # 950+ tests
```

## 健康检查

```bash
curl http://localhost:49135/agentmemory/health
# {"status": "healthy", "uptime": 1234, "memoryCount": 5678, ...}
```

## 监控

`src/telemetry/` 模块暴露：
- OpenTelemetry metrics
- Prometheus endpoint (可选)
- Audit log 写到 SQLite

## 备份

```bash
# 数据目录
data/state_store.db
data/audit.db
data/vector-index/

# 简单备份
tar -czf backup.tgz data/

# 用 export/import API
curl -X POST http://localhost:49135/agentmemory/export -d @- <<EOF
{
  "format": "json",
  "includeAudit": false
}
EOF
```

## 升级

```bash
git pull
npm install
npm run build
# 跑 migrations
curl -X POST http://localhost:49135/agentmemory/migrate

# 重启
docker-compose restart agentmemory
```

## 性能调优

| 优化 | 适用 |
|------|------|
| 启用 vector index 缓存 | 大数据量 |
| 调 crystallize schedule 频率 | 成本敏感 |
| 限制 MCP tools 可见数 | Token 预算紧 |
| 启用 disk-size-manager | 存储有限 |
| 用 sqlite WAL | 并发高 |

## 故障排查

| 问题 | 解决 |
|------|------|
| MCP 连不上 | 检查 AGENTMEMORY_URL；firewall |
| Search 慢 | 检查 vector index；减少 scope |
| Crystallize 失败 | 检查 LLM provider 配置 |
| Hook 不触发 | 检查 AGENTMEMORY_URL；用 `node script.mjs < test.json` 模拟 |
| 数据丢失 | 用 export 备份 + restore from backup |
