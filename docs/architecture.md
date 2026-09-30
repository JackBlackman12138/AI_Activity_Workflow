# AI Activity Studio 第一阶段架构

## 架构决策

第一阶段采用 npm workspaces 管理 TypeScript monorepo。Web MVP 可独立运行；API、worker、shared 与 database 包提供稳定边界，暂不接入真实外部模型或身份系统。

## 运行结构

```text
浏览器
  └─ apps/web（React + Vite）
       ├─ 演示登录与活动管理
       ├─ 模型配置交互
       └─ 当前仅使用内存状态

后续服务边界
  ├─ packages/api：HTTP 路由与领域服务契约
  ├─ packages/worker：异步生成任务、重试、幂等
  ├─ packages/shared：跨包 DTO 与枚举
  └─ packages/database：Prisma schema 与迁移入口
       └─ PostgreSQL 16
```

## 请求与任务流

1. Web 通过 HTTPS 调用 API，不直接访问数据库或模型供应商。
2. API 校验会话、租户权限和输入，把活动写入 PostgreSQL。
3. 需要模型生成时，API 创建 `GenerationJob`，worker 异步消费。
4. worker 从服务端密钥托管层取得模型凭据，提交任务并回写结果。
5. API 返回任务状态；Web 轮询或通过事件通道获得进度。

## 包职责

| 目录 | 当前职责 | 后续扩展 |
|---|---|---|
| `apps/web` | 可运行的产品交互演示 | 对接真实 API、路由、状态缓存 |
| `packages/api` | 仓储接口与路由常量 | HTTP 服务、认证、权限、审计 |
| `packages/worker` | 任务数据结构与处理器接口 | 队列消费、超时、重试、限流 |
| `packages/shared` | 活动与模型配置类型 | 校验 schema、错误码、事件类型 |
| `packages/database` | Prisma 数据模型 | 迁移、种子数据、仓储实现 |

## 安全边界

- 仓库不得存放真实密钥；`.env.example` 只提供占位符。
- 浏览器不得保存供应商密钥，模型调用必须由 API/worker 发起。
- 数据库仅保存加密后的密文和密钥指纹，不保存明文。
- 登录演示不代表生产认证；正式环境需要安全 Cookie、CSRF 防护、登录限流和密码哈希。
- `AuditLog` 记录模型配置、活动和任务的关键变更。

## 部署基线

`docker-compose.yml` 提供 PostgreSQL 与静态 Web 容器。首阶段镜像只发布 Web 构建产物；API 与 worker 容器待运行时实现后加入。生产环境需要替换数据库密码，使用外部 Secret Manager，并在反向代理层启用 TLS 与安全响应头。
