# 可移植运行时与工具适配

## 目的

让同一套 Merge 活动流程可以被 ChatGPT/Codex、Trae、Claude Code、Gemini CLI、Cursor、Windsurf、GitHub Copilot 或其他能读取本地 Markdown 的 AI 编码代理使用。核心规则保持不变，平台入口只做加载和工具映射。

## 1. 启动探测

开始任务前确认：

1. 是否能读取、写入和打包本地文件。
2. 是否能执行 Python、Node.js 和本地 HTTP 服务。
3. 是否能使用浏览器做交互验收。
4. 是否已连接可读写 Figma 文件的 MCP 工具。
5. 是否能访问用户提供的现有文件、Figma 节点和项目目录。
6. 是否允许联网核实数字、竞品结论和部署规则。
7. 目标目录是否是 Git 仓库、是否存在未提交改动、当前工具能否检查引用文件和 Git 跟踪状态。

只使用已确认存在的能力。能力缺失时报告具体影响和降级交付，不伪造工具调用或验收结果。

## 2. 通用操作映射

| 目标操作 | 所需能力 | 无能力时的降级 |
| --- | --- | --- |
| 批判性审查 | 读取 Markdown、推理 | 无需降级 |
| 生成脑图 | 写入 UTF-8 Markdown | 在对话中输出完整 Markdown |
| 修改现有 Figma | Figma MCP 读写节点 | 输出 UX 变更规格和节点映射，标记未写入 |
| 新建 Figma UX | Figma MCP 创建/写入 | 输出页面地图、组件表、状态表和线框规格 |
| 构建 Web Demo | 写文件 | 输出完整文件内容，提示用户落盘 |
| 自动验证 Demo | Python/Node/浏览器 | 逐项标记未执行，只做可完成的静态检查 |
| 发布 GitHub Pages | Git/GitHub 权限或用户手动操作 | 生成可部署工程和发布步骤，不声称已发布 |
| 修改用户指定仓库 | 读取 Git 状态、写入目标目录、运行验证 | 在可写工作区制作补丁并明确同步范围，不覆盖用户未提交改动 |

## 3. Figma MCP 适配

不同代理可能暴露不同名称的 Figma 工具。按能力而不是名称匹配：

- `create file`：新建 Figma Design 文件。
- `inspect/read design`：读取最新页面、节点、变量和组件。
- `execute/write in file`：创建或修改节点、变量、组件和布局。
- `render/screenshot`：渲染页面或节点进行视觉验收。

若当前平台提供专门的 Figma 使用说明、技能或安全前置，先完整读取。修改现有文件前必须读取最新节点；任何写入后必须截图或结构审计。只读连接不等于可写连接。

## 4. 平台入口约定

开源仓库可提供薄入口：

- `AGENTS.md`：通用编码代理或 Codex。
- `CLAUDE.md`：Claude Code。
- `GEMINI.md`：Gemini CLI。
- `.cursor/rules/*.mdc`：Cursor。
- `.windsurfrules`：Windsurf。
- `.github/copilot-instructions.md`：GitHub Copilot。
- `.agents/skills/build-merge-event-prototypes/`：Trae 项目级 Skill；根目录 `AGENTS.md` 负责指向它。

入口文件只要求代理完整读取 `skill/SKILL.md` 和任务需要的 references，不复制核心内容。这样更新规则时不会出现多份漂移。

## 5. 可复现性记录

最终交付记录以下信息：

- 使用的模型/代理与日期。
- 实际可用的工具能力。
- 已执行的验证和未执行的验证。
- Figma 文件/节点是否真实写入。
- Web Demo 是否完成静态、HTTP 和浏览器验收。
- 所有仍依赖假设的数字、概率与结论。
