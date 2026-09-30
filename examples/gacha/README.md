# 扭蛋机活动 · UE 交互模型完整工程

直接打开 standalone.html 试玩。源码以 project/ 为准，src/ 是导出快照。

## 功能与程序接入

- docs/features.md：需求、源码位置、配置表、测试步骤与实际结果。
- docs/unity-handoff.md：Unity 迁移契约、美术页面状态清单与待确认项。
- docs/planning.md：业务策划原文。
- docs/configuration.md：字段说明；configuration.json：可选覆盖配置，未填写的业务参数采用源码中标明的默认值。
- docs/quality.md：验证记录与演示假设。
- docs/requirements.json：结构化需求；project-tests.json：可执行回归场景。
- docs/implementation.md：本阶段交接说明。


## 完整原始工程
project/ 保留全部源文件，project-tests.json 保留自动化回归场景。开发时修改 project/ 下的原始文件，新增文件需加入 project-files.json。安装 Node.js 后先 npm install，然后 npm run build 重新构建，npm test 运行浏览器检查（需要 Edge、Chrome 或 npx playwright install chromium）。npm start 提供本地预览。构建会更新 index.html 和 standalone.html；src/script-*.js 是导出快照，不再作为工程修改入口。
