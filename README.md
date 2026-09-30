# AI Activity Workflow

面向游戏活动策划的本地工作台：从原稿与策划文档，生成面向美术和 Unity 程序的 UE（用户体验）交互模型，再导出完整源码和 Markdown 功能文档。

## 主要功能

- 五阶段流程：活动原稿 → 策划文档 → UE 交互模型 → UE 交互验收 → 美术与程序交付。
- Word 图文导入、可选配置表、缺省演示数据和多模型连接与选择。
- 内置工程修改流程：用文字、粘贴截图或上传草图修改场景、控件和交互，保留未要求修改的玩法。
- 分文件生成、局部修改、可见进度与断点恢复；PNG/JPG/WebP 参考图最多 4 张。
- 编译与实际浏览器验证。平台预览和离线环境并行执行完整场景；独立源文件最多三个合并请求。
- 运行检查通过即可保存并确认继续。AI 审查意见仅供参考，不再触发无休止修复或阻塞下一步。
- 导出离线试玩页、全部源代码、功能规格、配置、验证记录及 Unity／美术交接说明。

## 安装与启动

建议使用 Node.js 24 LTS（或 22.12 及以上版本）和 npm 10 及以上版本。Windows 安装 Edge 或 Chrome，用于真实浏览器验证。

```powershell
git clone https://github.com/JackBlackman12138/AI_Activity_Workflow.git
cd AI_Activity_Workflow
npm ci
npm run build
.\启动工作台.cmd
```

打开 http://127.0.0.1:5173/ 。启动脚本会复用已有服务，日志位于 data/logs/。

也可用两个终端分别运行 `npm run api` 和 `npm run dev`。无系统浏览器的环境可执行 `npx playwright install chromium` 安装测试浏览器。Word 的旧 .doc 格式转换依赖 Windows 环境；推荐使用 .docx。

首次启动会建立本地数据，请在模型中心连接自己的模型接口。图文修改需选择支持图片输入的模型。已有账号、密钥和活动历史没有随仓库上传。

## 目录

| 目录 | 内容 |
| --- | --- |
| apps/web | React + Vite 工作台 |
| packages/api | 模型网关、工程生成、图文修改、编译验证、导出与本地持久化 |
| packages/shared | 数据结构、流程规则及试玩运行时 |
| packages/database、packages/worker | 数据库结构与 worker 基础模块 |
| skills | 策划和交互模型指导、模板、参考文档及脚本 |
| docs、ops | 设计说明、功能记录、恢复与启动方法 |
| examples/gacha | 已生成的扭蛋机 UE 交互模型及完整功能文档 |

当前默认采用 JSON 本地持久化，API 内执行生成任务。Docker 与早期架构文档保留了初始方案；它们不是当前完整生产部署方案。最新交互模型流程见 [docs/ue-interaction-model.md](docs/ue-interaction-model.md)。

## 示例交互模型

解压／克隆仓库后直接打开 [examples/gacha/standalone.html](examples/gacha/standalone.html) 可离线试玩。

- [功能规格](examples/gacha/docs/features.md)
- [Unity 与美术交接](examples/gacha/docs/unity-handoff.md)
- [源码和重新构建说明](examples/gacha/README.md)

这是 Unity 实现前的 Web 交互参考，UE 不指 Unreal Engine；模型不直接作为 Unity 工程导入。

## 验证

```text
npm run typecheck
npm test
npm run build
```

2026-09-30 的平台回归共 86 项通过，并完成图文修改接口及浏览器粘贴、上传、预览、移除、失败保留输入的专项验证。示例模型的验证记录随示例工程保存。

## 本地配置与数据

`.env.example` 只提供环境变量占位示例，服务读取进程环境变量。真实密钥不要提交到 Git；模型密钥由 API 加密后写入本地运行数据。部署时设置自己的高熵 `ENCRYPTION_SECRET`，需要更换路径时设置 `DATA_FILE`。

本地活动数据、账号配置、日志、依赖目录、编译缓存和临时备份已加入 .gitignore。当前是本地工作台，尚无生产身份认证，不应直接暴露到公网。
