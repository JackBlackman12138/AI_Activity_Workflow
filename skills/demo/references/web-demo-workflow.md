# Web Demo 工作流

## 默认工程

优先复制 `assets/web-demo-starter/`，然后把具体活动逻辑写入：

- `src/state.js`：唯一状态源和初始状态。
- `src/game-engine.js`：生成、消耗、概率、合成、升级、结算与边界规则。
- `src/components.js`：可复用 UI 渲染组件。
- `src/main.js`：事件绑定、渲染调度和动效触发。
- `styles.css`：布局、响应式与动效。
- `Demo体验说明.md`：用非专业语言指导体验者完成核心循环。

不要把规则散落在点击回调和 DOM 文案中。用户明确要求单文件时才合并。

上游系统拥有的资源通过显式接口进入 `game-engine`。例如资源来自主玩法订单时，Demo 的 Debug 按钮应模拟“订单完成事件”，而不是进关时直接填入恰好通关的资源。

涉及地图、奖励预览、任务收集或连续表现时，按 [interaction-feedback-contract.md](interaction-feedback-contract.md) 补交互契约与验收；不因此扩展当前活动范围。

## 最小交付标准

- 有完整可玩循环，不只展示静态页面。
- 默认使用单主界面；图鉴和 INFO 使用同屏模态层，其他反馈使用渐进渐出的轻弹板或 Toast。
- 有清晰的初始状态、空状态、资源不足、上限/满盘和活动结束反馈。
- 支持鼠标；移动端目标场景存在时同时支持触摸/指针事件。
- 存在 Merge 盘面时固定行列与格子尺寸；其他机制采用自身的场景坐标与容器约束。拖动、移动或结果出现后不意外跳动。
- 概率逻辑可配置；UI 中避免展示伪精确概率。
- 自动行为可观察，关键升级有短暂反馈但不长期阻断操作。
- 产出具备飞入/落点反馈，合成具备收拢、结果弹跳、光圈或粒子，链路新节点具备滚动与高亮；动效服务于状态变化，不堆砌无意义效果。
- 视觉按当前机制组织背景、操作主体和反馈层；只有存在棋子时才制作棋子层。成品体验避免默认组件拼装感，不为视觉丰富额外增加游戏系统。
- 有 Debug 重置；必要时增加资源、跳进度和生成指定棋子的开发控件。
- 所有资源使用相对路径，不依赖本机绝对路径。
- 总量、可见容量和视觉尺寸分别配置；空间不足时使用后备队列，不因内容数量动态缩小核心操作对象。
- 随机序列与随机产出必须同时提供约束、保底、跨关库存和可复现 Debug；教学固定序列与普通关随机池分开配置。

## GitHub 部署结构

输出工程至少包含：

- `index.html`
- `styles.css`
- `src/*.js`
- `package.json`
- `server.js`
- `.nojekyll`
- `README.md`
- `Demo体验说明.md`

根目录 `index.html` 支持 GitHub Pages。`npm start` 使用零依赖静态服务器，兼容要求入口文件/启动命令的平台。若部署流程或平台规则可能已更新，查阅 GitHub 或平台官方文档。

上传或复制到现有仓库后重新检查目标目录，不以源工作区可运行为证据。`index.html` 引用的每个本地脚本、样式、图片和配置都必须真实存在并被纳入上传/提交；项目站点优先使用相对路径，避免以 `/` 开头的仓库根外引用。

## Deno Deploy 适配

- 先查阅当期 Deno 官方 Deploy 与 Builds 文档，旧版 Deploy Classic 规则不得作为新项目默认依据。
- 零依赖浏览器 Demo 优先使用静态模式，不引入框架安装和构建链。`deno.json` 的 `deploy.runtime.type` 设为 `static`，`cwd` 指向确实包含 `index.html` 的目录；只有路由需要回退时才设置 `spa: true`。
- 未生成 `dist/`、`_site/` 或其他产物目录时，不得在文档或平台配置中填写它。Install Command 与 Build Command 在不需要时留空，避免平台执行不存在的脚本。
- 若需要动态兼容入口，提供独立 `main.ts`：使用 `Deno.serve`，只申请网络与静态文件读取所需权限，正确返回 HTML/CSS/JS/JSON MIME，并拒绝越出项目根目录的路径。
- 浏览器引用继续使用 `./` 相对路径；Deno 配置、Node 本地服务器和浏览器模块三者不得互相引用平台专属实现。
- 交付 `DENO_DEPLOY.md`，同时说明自动读取 `deno.json` 和控制台手工配置两条路径；上传清单必须包含嵌套 `src/`。

### 框架选择与 standalone 验收

先判断 Demo 是否真的需要服务端渲染。纯交互原型默认选择静态模式；不要因为源码使用 React 就自动选择 Next.js 预设。

标准 Next.js 上传 Deno 时必须同时满足：

- `package.json` 显式依赖 `next`，`build` 脚本执行 `next build`，不能指向 `vinext build`、`vite build` 或 Cloudflare/Wrangler 构建。
- `next.config.ts/mjs/js` 设置 `output: 'standalone'`。
- `deno.json` 设置 `deploy.framework: "nextjs"`，安装与构建命令指向实际可运行脚本；兼容配置按当期 Deno 官方说明维护。
- 从干净依赖安装后运行一次生产构建，确认 `.next/standalone/package.json` 和 `.next/standalone/server.js` 均存在，再进行上传。

若 Deno 日志显示“missing a `.next/standalone/package.json` file after build”，先检查框架与构建脚本是否错配。典型错误是 Deno 采用 Next.js 预设，但仓库实际运行 vinext/Cloudflare 构建；此时应转换为标准 Next.js，或改成静态站点/自定义动态入口，而不是反复重试同一构建。

最终验收报告必须列出：检测到的工程类型、Deno 运行模式、安装命令、构建命令、运行入口或静态目录、两项 standalone 文件检查结果。

## 生成装置与飞入动效

- 点击后立即反馈并锁定重复入口；先校验并保存本次消耗和结果，失败时不播放成功产出。
- 已确认结果再播放来源装置响应与内部运动，参考时长按实际节奏调整；接收位置可以是目标格、资源计数或收集入口。倍率表现按已确定结果逐项展开，不在动画回调中再次随机或发奖。
- 重渲染后读取出口与目标格的真实 `getBoundingClientRect()`，在固定全屏 FX 层创建飞行对象。使用短弧线、旋转和缩放表达距离，700～900ms 到达后移除临时对象。
- 目标棋子以落点弹跳、光圈和粒子收尾；合成使用收拢与结果回弹；障碍转换使用独立揭开反馈。动效层 `pointer-events: none`，不得遮挡盘面。
- 连续产出按 70～120ms 错峰；满盘、资源不足或被取消时不播放伪飞入。开启减少动态效果时隐藏长距离临时对象，直接展示可靠终态。

## 验证顺序

1. 运行 `python3 scripts/validate_web_demo.py <project-dir>`。
   - 目标是 Git 仓库时再运行 `python3 scripts/validate_web_demo.py <project-dir> --require-git-tracked`。
2. 对所有 JavaScript 执行语法检查。
3. 启动本地服务器并确认首页返回 200。
4. 分别请求首页、入口 JS 与关键资源，确认 HTTP 200 和正确 MIME。
5. 在浏览器中完成至少一次核心循环、边界状态和 Debug 重置。
6. 随机系统运行数百至 1,000 轮约束测试，报告三连/连续上限、最大偏差、保底和最坏样本。
7. 比较重置后的状态与初始状态深度相等。
8. 检查移动端宽度、键鼠拖动、滚动容器和布局稳定性。
9. 使用 `git status --short` 和 `git ls-files` 确认嵌套目录没有漏传。
10. 按 `Demo体验说明.md` 从零完成一次体验，确认文档和按钮名称一致。

无法运行浏览器时明确说明仅完成静态/HTTP 验证，不把它描述为完整交互验收。
