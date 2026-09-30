# AI Activity Studio 数据模型

## 核心实体

| 实体 | 用途 | 关键关系 |
|---|---|---|
| `User` | 账户与活动归属 | 一名用户拥有多个活动和审计记录 |
| `Activity` | 活动主记录 | 归属用户，包含多个生成任务 |
| `GenerationJob` | 异步模型任务 | 归属活动，保存输入、结果、状态与重试次数 |
| `ModelSetting` | 模型连接配置 | 保存供应商、模型、加密密钥与指纹 |
| `AuditLog` | 安全与操作追踪 | 可关联操作者，记录资源和元数据 |

## 关系图

```text
User 1 ───── * Activity 1 ───── * GenerationJob
  │
  └───────── * AuditLog

ModelSetting（工作区级配置，第二阶段补充 tenantId 与版本关系）
```

## 状态定义

- `ActivityStatus`：`DRAFT`、`GENERATING`、`READY`、`FAILED`。
- `JobState`：`QUEUED`、`RUNNING`、`COMPLETED`、`FAILED`。
- 活动状态表示用户可见的聚合状态；任务状态表示单次异步作业状态，两者不得共用更新逻辑。

## 数据约束

- 用户邮箱唯一。
- 活动按 `ownerId + updatedAt` 建索引，支持个人工作区列表。
- 任务按 `state + createdAt` 建索引，支持 worker 拉取待处理任务。
- 删除活动时级联删除生成任务；审计记录不随业务资源删除。
- `payload` 与 `result` 使用 JSON，进入稳定期后把高频查询字段提升为显式列。

## 密钥字段

`encryptedKey` 仅保存经 KMS 或等价密钥加密后的密文，`keyFingerprint` 用于界面识别和轮换比对。API 响应不得返回 `encryptedKey`，日志不得输出请求中的密钥值。

## 后续迁移

第二阶段增加 `Tenant`、`Membership`、`ActivityVersion`、`Asset` 和任务幂等键；在确认部署数据库后生成首个 Prisma migration，不在第一阶段伪造已执行的迁移历史。
