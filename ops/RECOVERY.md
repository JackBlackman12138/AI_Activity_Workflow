# 构建记录与恢复入口

## 当前实现

- 登录已跳过，所有 API 使用固定本地用户 `local-user / local@activity.studio`。
- API 使用 Node.js 内置 HTTP 服务，默认端口 `3001`；运行数据默认持久化到 `data/runtime.json`。
- 活动类型为 `race / independent-merge / gift-pack / task-chain / n-vs-n`，界面显示为竞速、独立合成线、礼包、任务链、NvsN。
- 读取旧 runtime 时自动映射旧活动类型，并补齐 `artifacts`、任务 `stage` / `auditTrail` 及五阶段默认 Skill。迁移在读取时完成，下次写入原子落盘。
- 活动详情采用 `source → flow → ue → document → demo` 五阶段串行流程。创建活动时，非空原稿同步保存为 source Artifact。
- 后端在单次串行化 `store.update()` 中完成前序产物检查、同阶段幂等检查和任务插入，避免并发请求绕过约束。
- 后续阶段仅当前序所有 Artifact 存在时可创建；source 阶段通过保存/上传产物完成，不能创建生成任务。
- 同活动同阶段存在 `queued`、`running` 或 `completed` Job 时返回 409；最近任务为 `failed` 时允许创建新 Job 重试。
- 工作流圆点按待处理、旋转生成、打钩完成展示；前序未完成、任务生成中或阶段已完成时锁定生成按钮。
- Demo 阶段在居中的 390 × 650 竖屏手机画布中，通过 `sandbox="allow-scripts allow-forms"` iframe 保持脚本和表单交互。
- 高级配置由侧栏进入独立页面，不使用配置弹窗。
- 生成任务保存 `queued / running / paused / completed / failed` 状态、尝试次数、结构化结果和审计事件；不采集或暴露模型私有思维链。
- 排队任务和运行任务都可暂停；运行中暂停通过 `AbortController` 中断模型请求，并在持久化前再次检查任务状态，阻止迟到响应写入。恢复会将任务重新排队并创建新一代 controller，旧调度回调不能覆盖新请求。
- flow 与 ue 正式产物为 SVG/PNG。Demo 生成可视 SVG；SVG、Mermaid 和普通模型文本转换为安全 SVG并保留可编辑源；上传 SVG 同样清洗，PNG 按 Base64 无损存储和下载。
- 活动首页支持创建、编辑和删除；删除使用输入活动名的自定义二次确认，并级联删除任务和内嵌阶段产物，同时中断关联运行请求。
- 模型密钥使用 AES-256-GCM 加密；API 响应不返回明文或密文，只返回配置状态与短指纹。

## Skill 管理与安全边界

- `source / flow / ue / document / demo` 每阶段均自动提供一个可见、可启停的默认 Skill。
- Skill 管理支持按阶段查看、上传、启用/停用、删除和下载；默认 Skill 不可删除且没有上传包可下载。
- 上传仅接受 ZIP，文件名必须以 `.zip` 结尾；服务端校验 ZIP local header、EOCD、central directory 边界、目录数量及文件名长度。
- ZIP 根目录或子目录中必须存在 `SKILL.md`，否则拒绝上传。
- 上传成功后保存阶段、名称、说明、文件名、大小、时间和原始 ZIP；公共响应剔除 `archiveBase64`。
- 上传包仅作为受管文件持久化。执行器不读取、不解压、不导入、不执行，也不把上传 Skill 或其内容注入生成请求。

## 本地恢复与启动

```powershell
Set-Location 'D:\AIActivityStudio'
npm.cmd install
npm.cmd run build
npm.cmd run api
```

另开终端：

```powershell
Set-Location 'D:\AIActivityStudio'
npm.cmd run dev
```

API 默认 `http://localhost:3001`，Web 默认 `http://localhost:5173`。生产使用前必须设置高熵 `ENCRYPTION_SECRET`；可用 `DATA_FILE` 覆盖 JSON 文件路径。

## 验证命令

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

## API 摘要

- `GET|POST /api/activities`，`GET|PATCH|DELETE /api/activities/:id`：活动 CRUD。
- `POST /api/activities/:id/markdown`：兼容旧版 Markdown 上传接口。
- `GET|PUT|POST /api/activities/:id/artifacts/:stage`：读取、JSON 写入或 multipart 上传阶段产物；GET 增加 `?download=1` 下载原始文件。
- `GET /api/activities/:id/generation-jobs`：按活动查询任务状态、结构化输出与审计事件。
- `POST /api/generation-jobs`、`GET /api/generation-jobs/:id`、`POST /api/generation-jobs/:id/transition`：任务创建、查询及受控迁移。
- `POST /api/generation-jobs/:id/pause|resume`：暂停排队/运行任务或恢复暂停任务；运行中暂停会中断当前模型请求。
- `GET|POST /api/model-configs`，`PATCH|DELETE /api/model-configs/:id`，`POST /api/model-configs/:id/test`：模型配置与连通测试。
- `GET|POST /api/skills`：查询 Skill 或上传阶段 ZIP；查询支持 `?stage=`，上传要求 `?stage=`。
- `PATCH|DELETE /api/skills/:id`：启停或删除 Skill。
- `GET /api/skills/:id/download`：下载上传 Skill 的原始 ZIP。

执行器状态迁移允许 `queued → running|failed`、`running → completed|failed`；控制接口额外支持 `queued|running → paused → queued`。失败重试会创建新 Job，不复用终态 Job；暂停恢复复用原 Job 并增加新的执行尝试。

服务重启会丢失内存中的 controller。恢复前应检查 `data/runtime.json`：`paused` 任务保持暂停并等待显式 resume；遗留 `running` 任务不能假定仍在执行，应在备份后改为 `paused` 并补充恢复审计，随后通过 resume 重新排队。不得直接标记 completed，也不得在没有模型响应的情况下补写产物。

## 关键文件

- `packages/shared/src/index.ts`：活动、Artifact、Job、审计和 Skill 共享类型。
- `packages/api/src/store.ts`：JSON 原子持久化、默认 Skill 和旧 runtime 兼容。
- `packages/api/src/server.ts`：阶段约束、幂等任务、Artifact、Skill 和模型接口。
- `packages/api/src/executor.ts`：可中断生成执行、迟到写入屏障、视觉 SVG 转换与上传 Skill 隔离边界。
- `packages/api/src/server.test.ts`：串行、幂等、暂停恢复、迟到写入、视觉产物、活动级联删除、Skill、加密、迁移及模型执行测试。
- `apps/web/src/main.tsx`：串行工作台、手机 Demo、Skill 管理和独立高级配置页。
- `apps/web/src/styles.css`：现代化布局、步骤状态、旋转动画与手机画布。
- `data/tasks.json`：能力完成状态和剩余 backlog。

## 数据恢复注意事项

1. 升级前备份 `data/runtime.json`。
2. 旧文件无需预迁移；启动后首次读取即兼容，首次修改后会以新结构写回。
3. 若需回滚旧版本，应先恢复备份；旧版本不识别新活动类型、阶段产物和 Skill 字段。
4. 阶段文件以内联 UTF-8 或 Base64 保存，单次上传上限 5 MiB；Skill ZIP 以 Base64 保存，请在生产环境评估迁移对象存储。
5. 不要把 `runtime.json`、模型密钥、加密密文或 Skill ZIP Base64 写入日志、测试报告或对外响应。

## 最近验证（2026-09-28）

- `npm.cmd run typecheck`：成功，所有 workspace 无 TypeScript 错误。
- `npm.cmd test`：成功，14/14 测试通过；覆盖 AES-GCM、旧 runtime、Artifact、严格串行、幂等与重试、Skill 生命周期、Demo/OpenAI-compatible 执行、queued/running 暂停恢复、AbortController 中断与迟到写入屏障、flow/ue 安全 SVG/PNG，以及活动编辑、级联删除和运行请求中断。
- `npm.cmd run build`：成功，shared、database、api、worker、web 五个 workspace 全部通过。
- Headless Chrome CRUD 回归：创建、编辑、自定义名称二次确认、错误名称禁用、取消无副作用、正确名称删除均通过，且未触发浏览器原生 confirm。
- Headless Chrome 视觉回归：flow/ue 默认仅展示图像，不展示 Markdown 预览；可编辑源、上传和下载入口均保留。
- Headless Chrome 防回退回归：五阶段均保持 1:1 双栏、编辑器、AI 修改、上传下载和任务轨迹；模型中心字段及密钥隐藏正常；五阶段 Skill 管理入口正常；浏览器控制台无运行时错误。
- 手机 Demo 实测保持竖屏比例并适配视口，iframe 沙箱为 `allow-scripts allow-forms`；点击后状态由 20% 变为 40%，确认内嵌 JavaScript 交互有效。
- PowerShell 可能输出 ExecutionPolicy 的 profile 警告，以命令最终退出码和测试断言为准。
