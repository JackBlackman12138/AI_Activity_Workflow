# 扭蛋机活动 · UE 交互模型功能规格（Unity 实现依据）

## 使用方式

本文件供策划、开发和 AI 阅读，由当前保存的需求、源码与实际验证记录生成。业务原文见 [planning.md](planning.md)，字段和类型见 [configuration.md](configuration.md)，验证边界见 [quality.md](quality.md)。本模型用于美术与 Unity 程序正式制作前的交互验收；UE 指用户体验，不是 Unreal Engine。Unity 迁移与美术清单见 [unity-handoff.md](unity-handoff.md)。不要把默认假设当作正式业务规则。

## 版本与运行入口

- 交互模型版本：2026-09-30T03:56:31.204Z
- 策划版本：2026-09-29T08:07:13.145Z
- 配置版本：1
- 源码校验：e7c479dbc217bab90c4df69c359ff8a16112c5810564e9f45595c81f4ef251d3
- 入口：project/index.html；独立试玩：standalone.html
- 修改源码后：npm install → npm run build → npm test → npm start
- 本原型没有真实服务器、支付或主游戏系统；外部供给通过 Debug 主动模拟，活动内部规则仍需真实执行。

## 源码索引

- [src/config.js](../project/src/config.js)（398 行）
- [src/persistence.js](../project/src/persistence.js)（128 行）
- [src/progress.js](../project/src/progress.js)（108 行）
- [src/rewards.js](../project/src/rewards.js)（207 行）
- [src/supply.js](../project/src/supply.js)（235 行）
- [src/draw.js](../project/src/draw.js)（217 行）
- [src/shop.js](../project/src/shop.js)（184 行）
- [src/settlement.js](../project/src/settlement.js)（369 行）
- [src/state.js](../project/src/state.js)（729 行）
- [src/art.js](../project/src/art.js)（143 行）
- [src/views.js](../project/src/views.js)（407 行）
- [src/feedback.js](../project/src/feedback.js)（295 行）
- [src/input.js](../project/src/input.js)（332 行）
- [src/styles.css](../project/src/styles.css)（342 行）
- [src/main.js](../project/src/main.js)（127 行）
- [index.html](../project/index.html)（20 行）
- [src/telemetry.js](../project/src/telemetry.js)（57 行）
- [docs/unity-art-handoff.md](../project/docs/unity-art-handoff.md)（31 行）
- [docs/test-revision-1.json](../project/docs/test-revision-1.json)（124 行）
- [docs/test-revision-2.json](../project/docs/test-revision-2.json)（195 行）
- [src/defaults.js](../project/src/defaults.js)（94 行）
- [tests/exchange-guards.js](../project/tests/exchange-guards.js)（76 行）
- [tests/field-only-config.js](../project/tests/field-only-config.js)（16 行）
- [tests/claim-queue-recovery.js](../project/tests/claim-queue-recovery.js)（56 行）
- [tests/config-edge-cases.js](../project/tests/config-edge-cases.js)（61 行）
- [tests/settlement-recovery.js](../project/tests/settlement-recovery.js)（55 行）

## 页面与状态

- entry · 活动入口与外部场景占位：资格不足及具体原因、开放且显示倒计时、优先显示可单抽次数、不能单抽时显示待领品质奖励数、均为0时不显示数字、到期或关闭后入口移除、始终可达的Debug入口；不呈现主线玩法
- cover · 一次性开启封面：本期首次排队展示、开始进入扭蛋机、重进不重复、可关闭并返回外部场景占位
- machine · 扭蛋机主界面：初始余额和五节点进度、×1／×3／×5／×10选中、券不足仍保留倍率、抽取确认中禁重复操作、抽取后更新收藏与积分、全收藏解锁商店、到期但仍处于本次活动会话、时间未确认只读、关闭并返回
- drawResult · 单抽与批量结果弹层：一次机器出蛋反馈、单抽1项、批量完整结果列表、首次玩具NEW、重复玩具压暗并标积分、主游戏奖励模拟到账／待领奖记录、中断后恢复已确认结果
- collection · 玩具收藏：五组各5个锁定玩具及总计0/25、点亮与NEW、单组5/5待领奖红点、各品质独立已领取、25/25全收藏大奖已自动发放、返回扭蛋机
- claim · 通用领奖弹板与自动奖励队列：品质奖励待手动确认、品质奖励已领取、多积分节点依门槛展示、全收藏大奖在节点之后展示、重复请求不再次发奖
- shop · 积分兑换商店：未解锁可浏览并展示锁定原因、解锁首次进入清除新功能红点、可兑换、积分不足、有限次商品售罄、不限次商品、返回扭蛋机
- exchangeConfirm · 兑换确认弹窗：展示奖励、价格及剩余次数、取消无变化、确认处理中禁重复点击、确认成功及模拟到账、复验失败不扣分
- info · 奖励投放占比Info：抽取前可打开、当前分层与固定序列统计口径、25件玩具逐项列表、其他奖励按数量组合列出、内部滚动与固定关闭按钮、关闭返回原倍率状态
- rulesGuide · 活动规则与新手引导：首次引导、引导中断后重进、完整规则滚动阅读、全收藏商店解锁提示
- debug · 活动Debug抽屉：固定入口可达、订单成功／失败模拟、生成器命中／未命中／产出失败模拟、供给数量及拒绝原因、调整资格、分层、时间、时间可信度和软硬开关、重复事件ID测试、事件日志、奖励账本、存档不可用及重新试玩
- ending · 活动结束弹窗：展示收藏完成数和结束说明、关闭或好的均结束本次会话、结算期内再次登录仅展示已记录结果、结算期外不再出现
- makeup · 结束补发弹窗：结束弹窗之后展示、列出已达成未到账奖励、手动领取合并补发、无待补发时跳过、重复进入不重复到账
- unavailable · 不可用与恢复状态：资格不满足、时间或服务器状态未确认、存档不可用只读、活动已结束、硬关后活动外不可进入

## 数据与接入契约

- window.ActivityStudio.tables[表ID] 提供 fields 与 rows；config 指向主进度表。配置是可选补充；运行数据见 configuration.json，源码默认值及依据见默认值模块与假设清单。
- track("step_enter", index)、track("step_complete", index) 的 index 为主表零起始行号；全部完成调用 track("session_complete")。
- localStorage/sessionStorage 保存试玩状态；平台沙箱使用存档桥，独立运行使用浏览器存储。
- 对接真实系统时替换 Debug 外部供给接口，保留活动内部消耗、领取和重复操作保护。
- 测试场景与需求通过 requirements 中的稳定 ID 关联，完整定义见 project-tests.json；每个场景独立启动。

## R01 · 活动仅覆盖本期七天。达到7级、完成第6波订单且时间、资格、互斥关系、资源状态和开关允许时显示活动入口。首次进入展示一次开启封面；同一期仅初始化一次，保存分层、序列和读取位置。软关不影响已开启的本期；硬关时，活动内玩家可停留至主动离开。

- 策划依据：8.1、10.1、14
- 可观察验收：用固定可达的Debug入口分别调整等级、订单波次、资格、时间和开关，观察入口出现或消失及不可用原因；进入、关闭、重进后，封面不重复且进度不重置。
- 配置表：`ActivityConfig`、`PlayerLayers`、`UiCopy`
- 实现位置：没有匹配的源码证据，须人工定位
- 审查状态：pass

实现证据（当前源码原文）：

```text
state.js: `if (!draft.initialized) { ... draft.initialized = true; }`；入口按资格、时间和开关判定。
```

### 场景 GACHA_01：资格不足隐藏入口并说明原因，恢复资格后展示首次封面

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen=\"entry\"] [data-action=\"debug-open\"]"
2. `fill` 定位 "[data-screen=\"debug\"] [data-debug-field=\"level\"]"；值 "6"
3. `click` 定位 "[data-screen=\"debug\"] [data-action=\"debug-apply\"]"
4. `click` 定位 "[data-screen=\"debug\"] [data-action=\"debug-close\"]:not(.modal-close)"
5. `expectCount` 定位 "[data-screen=\"entry\"] [data-action=\"entry-open\"]"；数量 0
6. `expectText` 定位 "[data-screen=\"entry\"] .entry-unavailable"；值 "需要达到7级"
7. `click` 定位 "[data-screen=\"entry\"] [data-action=\"debug-open\"]"
8. `fill` 定位 "[data-screen=\"debug\"] [data-debug-field=\"level\"]"；值 "7"
9. `click` 定位 "[data-screen=\"debug\"] [data-action=\"debug-apply\"]"
10. `click` 定位 "[data-screen=\"debug\"] [data-action=\"debug-close\"]:not(.modal-close)"
11. `click` 定位 "[data-screen=\"entry\"] [data-action=\"entry-open\"]"
12. `expectVisible` 定位 "[data-screen=\"cover\"] [data-action=\"cover-start\"]"

执行记录：平台预览 · 资格不足隐藏入口并说明原因，恢复资格后展示首次封面 通过；离线交付 · 资格不足隐藏入口并说明原因，恢复资格后展示首次封面 通过

### 场景 GACHA_02：封面和引导不重复展示，关闭、重进及刷新保留初始券

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen=\"entry\"] [data-action=\"entry-open\"]"
2. `expectVisible` 定位 "[data-screen=\"cover\"] [data-action=\"cover-start\"]"
3. `click` 定位 "[data-screen=\"cover\"] [data-action=\"cover-start\"]"
4. `expectVisible` 定位 "[data-screen=\"guide\"] [data-action=\"guide-next\"]"
5. `click` 定位 "[data-screen=\"guide\"] .modal-header [data-action=\"guide-skip\"]"
6. `expectText` 定位 ".ticket-pill"；值 "扭蛋券 3"
7. `click` 定位 "[data-screen=\"machine\"] [data-action=\"machine-close\"]"
8. `click` 定位 "[data-screen=\"entry\"] [data-action=\"entry-open\"]"
9. `expectVisible` 定位 "[data-screen=\"machine\"] [data-action=\"draw\"]"
10. `expectCount` 定位 "[data-screen=\"cover\"]"；数量 0
11. `expectCount` 定位 "[data-screen=\"guide\"]"；数量 0
12. `reload` 定位 "body"
13. `expectText` 定位 ".ticket-pill"；值 "扭蛋券 3"

执行记录：平台预览 · 封面和引导不重复展示，关闭、重进及刷新保留初始券 通过；离线交付 · 封面和引导不重复展示，关闭、重进及刷新保留初始券 通过

### 场景 GACHA_15：互斥关系和资源状态分别说明入口不可用原因

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='debug-open']"
2. `select` 定位 "[data-screen='debug'] [data-debug-field='mutualExclusionClear']"；值 "false"
3. `click` 定位 "[data-screen='debug'] [data-action='debug-apply']"
4. `click` 定位 "[data-screen='debug'] [data-action='debug-close']:not(.modal-close)"
5. `expectText` 定位 "[data-screen='entry'] .entry-caption"；值 "存在互斥活动"
6. `expectCount` 定位 "[data-screen='entry'] [data-action='entry-open']"；数量 0
7. `expectText` 定位 "[data-screen='entry'] .entry-unavailable"；值 "存在互斥活动"
8. `click` 定位 "[data-screen='entry'] [data-action='debug-open']"
9. `select` 定位 "[data-screen='debug'] [data-debug-field='mutualExclusionClear']"；值 "true"
10. `select` 定位 "[data-screen='debug'] [data-debug-field='resourcesReady']"；值 "false"
11. `click` 定位 "[data-screen='debug'] [data-action='debug-apply']"
12. `click` 定位 "[data-screen='debug'] [data-action='debug-close']:not(.modal-close)"
13. `expectText` 定位 "[data-screen='entry'] .entry-caption"；值 "活动资源尚未就绪"
14. `expectCount` 定位 "[data-screen='entry'] [data-action='entry-open']"；数量 0
15. `click` 定位 "[data-screen='entry'] [data-action='debug-open']"
16. `select` 定位 "[data-screen='debug'] [data-debug-field='resourcesReady']"；值 "true"
17. `click` 定位 "[data-screen='debug'] [data-action='debug-apply']"
18. `click` 定位 "[data-screen='debug'] [data-action='debug-close']:not(.modal-close)"
19. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
20. `expectVisible` 定位 "[data-screen='cover'] [data-action='cover-start']"

执行记录：平台预览 · 互斥关系和资源状态分别说明入口不可用原因 通过；离线交付 · 互斥关系和资源状态分别说明入口不可用原因 通过

### 场景 GACHA_17：资格不足时隐藏活动入口并保留固定 Debug

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='debug-open']"
2. `fill` 定位 "[data-screen='debug'] [data-debug-field='level']"；值 "6"
3. `click` 定位 "[data-screen='debug'] [data-action='debug-apply']"
4. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
5. `expectCount` 定位 "[data-screen='entry'] [data-action='entry-open']"；数量 0
6. `expectText` 定位 "[data-screen='entry'] .entry-unavailable"；值 "需要达到7级"
7. `expectVisible` 定位 "[data-screen='entry'] [data-action='debug-open']"
8. `click` 定位 "[data-screen='entry'] [data-action='debug-open']"
9. `fill` 定位 "[data-screen='debug'] [data-debug-field='level']"；值 "7"
10. `click` 定位 "[data-screen='debug'] [data-action='debug-apply']"
11. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
12. `expectVisible` 定位 "[data-screen='entry'] [data-action='entry-open']"

执行记录：平台预览 · 资格不足时隐藏活动入口并保留固定 Debug 通过；离线交付 · 资格不足时隐藏活动入口并保留固定 Debug 通过

### 场景 GACHA_19：首次进入前供券与初始券累加，刷新及重放均不丢券

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='debug-open']"
2. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"
3. `expectText` 定位 "[data-screen='debug'] [data-debug-receipt]"；值 "实际 5 张"
4. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
5. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
6. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
7. `click` 定位 "[data-screen='guide'] .modal-header [data-action='guide-skip']"
8. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 8"
9. `reload` 定位 "body"
10. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 8"
11. `click` 定位 "[data-screen='machine'] [data-action='debug-open']"
12. `expectText` 定位 "[data-screen='debug'] .debug-section:has(h3:has-text('本地事件日志')) .debug-log"；值 "supply_granted"
13. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
14. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 8"

执行记录：平台预览 · 首次进入前供券与初始券累加，刷新及重放均不丢券 通过；离线交付 · 首次进入前供券与初始券累加，刷新及重放均不丢券 通过

### 场景 GACHA_20：关闭首次封面后重进仍触发首次引导且保留初始券

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
2. `expectVisible` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='cover'] .modal-header [data-action='cover-close']"
4. `expectVisible` 定位 "[data-screen='entry'] [data-action='entry-open']"
5. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
6. `expectCount` 定位 "[data-screen='cover']"；数量 0
7. `expectVisible` 定位 "[data-screen='guide'] [data-action='guide-next']"
8. `expectText` 定位 "[data-screen='guide'] .guide-progress"；值 "1 / 5"
9. `click` 定位 "[data-screen='guide'] .modal-header [data-action='guide-skip']"
10. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 3"
11. `click` 定位 "[data-screen='machine'] [data-action='machine-close']"
12. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
13. `expectCount` 定位 "[data-screen='guide']"；数量 0
14. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 3"

执行记录：平台预览 · 关闭首次封面后重进仍触发首次引导且保留初始券 通过；离线交付 · 关闭首次封面后重进仍触发首次引导且保留初始券 通过

### 场景 GACHA_31：矮屏入口保留可见机台、活动入口及顶部 Debug 热区

从全新页面开始，按以下顺序执行：

1. `expectVisible` 定位 "[data-screen='entry'] .entry-machine .machine-art"
2. `expectVisible` 定位 "[data-screen='entry'] [data-action='entry-open']"
3. `expectVisible` 定位 "[data-screen='entry'] > [data-action='debug-open']"
4. `click` 定位 "[data-screen='entry'] > [data-action='debug-open']"
5. `expectVisible` 定位 "[data-screen='debug'] [data-action='debug-order-success']"
6. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
7. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
8. `expectVisible` 定位 "[data-screen='cover'] [data-action='cover-start']"

执行记录：平台预览 · 矮屏入口保留可见机台、活动入口及顶部 Debug 热区 通过；离线交付 · 矮屏入口保留可见机台、活动入口及顶部 Debug 热区 通过

## R02 · 外部供券只通过玩家主动点击Debug操作模拟。分别提供「模拟订单结算成功／失败」和「模拟生成器有效产出命中／未命中／产出失败」；显示模拟来源、配置数量和操作结果。成功事件按配置发券并以事件ID去重；失败、未命中、过期或不合资格不发券。不制作订单、棋盘、生成器或其产出循环。

- 策划依据：8.2、10.1、12、13.2—13.3
- 可观察验收：点击各Debug操作，核对券余额与事件记录；以同一事件ID重放成功事件不重复发券；正式截止后点击成功模拟也不发券，并明确显示拒绝原因。
- 配置表：`ActivityConfig`、`SupplyRules`、`UiCopy`
- 实现位置：[src/supply.js](../project/src/supply.js) 第 89 行
- 审查状态：pass

实现证据（当前源码原文）：

```text
if (recorded(draft.processedEventIds, eventId))
```

### 场景 GACHA_03：Debug 供券成功、失败、未命中、事件去重及截止拒绝

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen=\"entry\"] [data-action=\"entry-open\"]"
2. `click` 定位 "[data-screen=\"cover\"] [data-action=\"cover-start\"]"
3. `click` 定位 "[data-screen=\"guide\"] .modal-header [data-action=\"guide-skip\"]"
4. `click` 定位 "[data-screen=\"machine\"] [data-action=\"debug-open\"]"
5. `click` 定位 "[data-screen=\"debug\"] [data-action=\"debug-order-success\"]"
6. `expectText` 定位 "[data-debug-receipt]"；值 "实际 5 张"
7. `click` 定位 "[data-screen=\"debug\"] [data-action=\"debug-replay\"]"
8. `expectText` 定位 "[data-debug-receipt]"；值 "去重"
9. `click` 定位 "[data-screen=\"debug\"] [data-action=\"debug-order-fail\"]"
10. `expectText` 定位 "[data-debug-receipt]"；值 "实际 0 张"
11. `click` 定位 "[data-screen=\"debug\"] [data-action=\"debug-generator-miss\"]"
12. `expectText` 定位 "[data-debug-receipt]"；值 "未命中"
13. `click` 定位 "[data-screen=\"debug\"] [data-action=\"debug-generator-fail\"]"
14. `expectText` 定位 "[data-debug-receipt]"；值 "实际 0 张"
15. `click` 定位 "[data-screen=\"debug\"] [data-action=\"debug-generator-hit\"]"
16. `expectText` 定位 "[data-debug-receipt]"；值 "实际 2 张"
17. `click` 定位 "[data-screen=\"debug\"] [data-action=\"debug-close\"]:not(.modal-close)"
18. `expectText` 定位 ".ticket-pill"；值 "扭蛋券 10"
19. `click` 定位 "[data-screen=\"machine\"] [data-action=\"debug-open\"]"
20. `click` 定位 "[data-screen=\"debug\"] [data-action=\"debug-expire\"]"
21. `click` 定位 "[data-screen=\"debug\"] [data-action=\"debug-order-success\"]"
22. `expectText` 定位 "[data-debug-receipt]"；值 "外部供券已停止"
23. `click` 定位 "[data-screen=\"debug\"] [data-action=\"debug-close\"]:not(.modal-close)"
24. `expectText` 定位 ".ticket-pill"；值 "扭蛋券 10"

执行记录：平台预览 · Debug 供券成功、失败、未命中、事件去重及截止拒绝 通过；离线交付 · Debug 供券成功、失败、未命中、事件去重及截止拒绝 通过

### 场景 GACHA_13：供券拒绝写入本地日志且不改变券余额，重复玩具达成首个阶段节点

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] [data-action='guide-skip']:not(.modal-close)"
4. `click` 定位 "[data-screen='machine'] [data-action='debug-open']"
5. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"
6. `click` 定位 "[data-screen='debug'] [data-action='debug-replay']"
7. `expectText` 定位 "[data-screen='debug'] [data-debug-receipt]"；值 "去重"
8. `expectText` 定位 "[data-screen='debug'] .debug-section:nth-of-type(5) .debug-log"；值 "supply_rejected"
9. `click` 定位 "[data-screen='debug'] [data-action='debug-close']:not(.modal-close)"
10. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 8"
11. `click` 定位 "[data-screen='machine'] [data-action='draw']"
12. `click` 定位 "[data-action='feedback-skip']"
13. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
14. `click` 定位 "[data-screen='machine'] [data-action='draw']"
15. `click` 定位 "[data-action='feedback-skip']"
16. `expectText` 定位 "[data-screen='drawResult'] .duplicate-points"；值 "重复 +1 积分"
17. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
18. `expectText` 定位 "[data-screen='claim'] .modal-header"；值 "累计1分"
19. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
20. `expectText` 定位 "[data-screen='machine'] .progress-heading"；值 "累计积分 1"
21. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 6"

执行记录：平台预览 · 供券拒绝写入本地日志且不改变券余额，重复玩具达成首个阶段节点 通过；离线交付 · 供券拒绝写入本地日志且不改变券余额，重复玩具达成首个阶段节点 通过

### 场景 GACHA_14：刷新后再次供券和抽取仍使用新的事务ID

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] [data-action='guide-skip']:not(.modal-close)"
4. `click` 定位 "[data-action='debug-open']"
5. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"
6. `click` 定位 "[data-screen='debug'] [data-action='debug-close']:not(.modal-close)"
7. `expectText` 定位 ".ticket-pill"；值 "扭蛋券 8"
8. `reload` 定位 "body"
9. `click` 定位 "[data-action='debug-open']"
10. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"
11. `click` 定位 "[data-screen='debug'] [data-action='debug-close']:not(.modal-close)"
12. `expectText` 定位 ".ticket-pill"；值 "扭蛋券 13"
13. `click` 定位 "[data-action='draw']"
14. `click` 定位 "[data-action='feedback-skip']"
15. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
16. `expectText` 定位 ".ticket-pill"；值 "扭蛋券 12"
17. `reload` 定位 "body"
18. `click` 定位 "[data-action='draw']"
19. `click` 定位 "[data-action='feedback-skip']"
20. `expectText` 定位 "[data-screen='drawResult'] .duplicate-points"；值 "重复 +1 积分"
21. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
22. `expectVisible` 定位 "[data-screen='claim']"
23. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
24. `expectText` 定位 ".ticket-pill"；值 "扭蛋券 11"
25. `expectText` 定位 ".progress-heading"；值 "累计积分 1"

执行记录：平台预览 · 刷新后再次供券和抽取仍使用新的事务ID 通过；离线交付 · 刷新后再次供券和抽取仍使用新的事务ID 通过

### 场景 GACHA_19：首次进入前供券与初始券累加，刷新及重放均不丢券

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='debug-open']"
2. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"
3. `expectText` 定位 "[data-screen='debug'] [data-debug-receipt]"；值 "实际 5 张"
4. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
5. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
6. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
7. `click` 定位 "[data-screen='guide'] .modal-header [data-action='guide-skip']"
8. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 8"
9. `reload` 定位 "body"
10. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 8"
11. `click` 定位 "[data-screen='machine'] [data-action='debug-open']"
12. `expectText` 定位 "[data-screen='debug'] .debug-section:has(h3:has-text('本地事件日志')) .debug-log"；值 "supply_granted"
13. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
14. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 8"

执行记录：平台预览 · 首次进入前供券与初始券累加，刷新及重放均不丢券 通过；离线交付 · 首次进入前供券与初始券累加，刷新及重放均不丢券 通过

### 场景 GACHA_21：零发券的已结算生成器事件跨活动日重放仍去重

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] .modal-header [data-action='guide-skip']"
4. `click` 定位 "[data-screen='machine'] [data-action='debug-open']"
5. `click` 定位 "[data-screen='debug'] [data-action='debug-generator-miss']"
6. `expectText` 定位 "[data-screen='debug'] [data-debug-receipt]"；值 "实际 0 张"
7. `fill` 定位 "[data-screen='debug'] [data-debug-field='serverTime']"；值 "2026-09-30T04:00:00+08:00"
8. `click` 定位 "[data-screen='debug'] [data-action='debug-apply']"
9. `click` 定位 "[data-screen='debug'] [data-action='debug-replay']"
10. `expectText` 定位 "[data-screen='debug'] [data-debug-receipt]"；值 "不重复发券"
11. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
12. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 3"

执行记录：平台预览 · 零发券的已结算生成器事件跨活动日重放仍去重 通过；离线交付 · 零发券的已结算生成器事件跨活动日重放仍去重 通过

### 场景 GACHA_27：封面、收藏和商店弹层上方可操作 Debug，返回后原页面与队列保留

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
2. `expectVisible` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-overlay-debug][data-action='debug-open']"
4. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"
5. `expectText` 定位 "[data-screen='debug'] [data-debug-receipt]"；值 "实际 5 张"
6. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
7. `expectVisible` 定位 "[data-screen='cover'] [data-action='cover-start']"
8. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
9. `click` 定位 "[data-screen='guide'] .modal-header [data-action='guide-skip']"
10. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 8"
11. `click` 定位 "[data-screen='machine'] [data-action='collection-open']"
12. `click` 定位 "[data-overlay-debug][data-action='debug-open']"
13. `click` 定位 "[data-screen='debug'] [data-action='debug-generator-hit']"
14. `expectText` 定位 "[data-screen='debug'] [data-debug-receipt]"；值 "实际 2 张"
15. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
16. `expectText` 定位 "[data-screen='collection'] .collection-total"；值 "0/25"
17. `click` 定位 "[data-screen='collection'] .modal-header [data-action='panel-back']"
18. `click` 定位 "[data-screen='machine'] [data-action='shop-open']"
19. `click` 定位 "[data-overlay-debug][data-action='debug-open']"
20. `expectVisible` 定位 "[data-screen='debug'] [data-action='debug-order-success']"
21. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
22. `expectText` 定位 "[data-screen='shop'] .shop-note"；值 "需要集齐全部收藏解锁兑换商城"
23. `click` 定位 "[data-screen='shop'] .modal-header [data-action='panel-back']"
24. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 10"

执行记录：平台预览 · 封面、收藏和商店弹层上方可操作 Debug，返回后原页面与队列保留 通过；离线交付 · 封面、收藏和商店弹层上方可操作 Debug，返回后原页面与队列保留 通过

### 场景 GACHA_28：抽取结果弹层上方的 Debug 不跳过已确认结果

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] .modal-header [data-action='guide-skip']"
4. `click` 定位 "[data-screen='machine'] [data-action='draw']"
5. `click` 定位 "[data-action='feedback-skip']"
6. `expectCount` 定位 "[data-screen='drawResult'] .result-item"；数量 1
7. `click` 定位 "[data-overlay-debug][data-action='debug-open']"
8. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"
9. `expectText` 定位 "[data-screen='debug'] [data-debug-receipt]"；值 "实际 5 张"
10. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
11. `expectCount` 定位 "[data-screen='drawResult'] .result-item"；数量 1
12. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 7"
13. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
14. `expectVisible` 定位 "[data-screen='machine'] [data-action='draw']"

执行记录：平台预览 · 抽取结果弹层上方的 Debug 不跳过已确认结果 通过；离线交付 · 抽取结果弹层上方的 Debug 不跳过已确认结果 通过

### 场景 GACHA_29：修复回归：外部供券后仍可在Info查看完整固定序列投放口径

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] .modal-header [data-action='guide-skip']"
4. `click` 定位 "[data-screen='machine'] [data-action='debug-open']"
5. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"
6. `expectText` 定位 "[data-screen='debug'] [data-debug-receipt]"；值 "实际 5 张"
7. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
8. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 8"
9. `click` 定位 "[data-screen='machine'] [data-action='info-open']"
10. `expectVisible` 定位 "[data-screen='info'] [data-scroll-region='info']"
11. `expectCount` 定位 "[data-screen='info'] .share-row .toy-art"；数量 25
12. `expectText` 定位 "[data-screen='info'] .info-intro"；值 "不是下一抽独立概率"
13. `expectText` 定位 "[data-screen='info'] .share-row:first-child .share-percent"；值 "8.33%"
14. `click` 定位 "[data-screen='info'] .modal-header [data-action='panel-back']"
15. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 8"

执行记录：平台预览 · 修复回归：外部供券后仍可在Info查看完整固定序列投放口径 通过；离线交付 · 修复回归：外部供券后仍可在Info查看完整固定序列投放口径 通过

## R03 · 主界面提供倒计时、券余额、累计与可用积分、五个阶段节点、扭蛋机、常驻Info、四档倍率、抽取、收藏、商店、说明及关闭入口。一次抽取扣除N×倍率张券，依次读取相同数量的序列项；跨房间继续读取，末房间按配置循环。余额不足保留倍率，失败不扣券、不推进序列。

- 策划依据：8.3—8.4、13.4—13.5
- 可观察验收：分别选择×1、×3、×5、×10抽取，核对消耗、结果数和房间游标；在券不足时点击，看到策划指定提示且游标不变；连续点击仅产生一个已确认批次。
- 配置表：`ActivityConfig`、`DrawTiers`、`GachaSequence`、`PlayerLayers`、`UiCopy`
- 实现位置：[src/draw.js](../project/src/draw.js) 第 171 行
- 审查状态：pass

实现证据（当前源码原文）：

```text
working.tickets -= tier.ticketCost
```

### 场景 GACHA_04：四档倍率逐项抽取、同批重复转积分、跨房间及券不足不降档

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen=\"entry\"] [data-action=\"entry-open\"]"
2. `click` 定位 "[data-screen=\"cover\"] [data-action=\"cover-start\"]"
3. `click` 定位 "[data-screen=\"guide\"] .modal-header [data-action=\"guide-skip\"]"
4. `click` 定位 "[data-screen=\"machine\"] [data-action=\"debug-open\"]"
5. `click` 定位 "[data-screen=\"debug\"] [data-action=\"debug-order-success\"]"；数量 4
6. `click` 定位 "[data-screen=\"debug\"] [data-action=\"debug-close\"]:not(.modal-close)"
7. `expectText` 定位 ".ticket-pill"；值 "扭蛋券 23"
8. `click` 定位 "[data-screen=\"machine\"] [data-action=\"draw\"]"
9. `expectCount` 定位 "[data-screen=\"drawResult\"] .result-item"；数量 1
10. `click` 定位 "[data-screen=\"drawResult\"] [data-action=\"result-close\"]"
11. `click` 定位 "[data-action=\"tier-select\"][data-tier-id=\"X3\"]"
12. `click` 定位 "[data-screen=\"machine\"] [data-action=\"draw\"]"
13. `expectCount` 定位 "[data-screen=\"drawResult\"] .result-item"；数量 3
14. `expectText` 定位 "[data-screen=\"drawResult\"] .duplicate-points"；值 "重复 +1 积分"
15. `click` 定位 "[data-screen=\"drawResult\"] [data-action=\"result-close\"]"
16. `expectVisible` 定位 "[data-screen=\"claim\"]"
17. `click` 定位 "[data-screen=\"claim\"] .modal-header [data-action=\"popup-close\"]"
18. `click` 定位 "[data-action=\"tier-select\"][data-tier-id=\"X5\"]"
19. `click` 定位 "[data-screen=\"machine\"] [data-action=\"draw\"]"
20. `expectCount` 定位 "[data-screen=\"drawResult\"] .result-item"；数量 5
21. `click` 定位 "[data-screen=\"drawResult\"] [data-action=\"result-close\"]"
22. `click` 定位 "[data-action=\"tier-select\"][data-tier-id=\"X10\"]"
23. `click` 定位 "[data-screen=\"machine\"] [data-action=\"draw\"]"
24. `expectCount` 定位 "[data-screen=\"drawResult\"] .result-item"；数量 10
25. `click` 定位 "[data-screen=\"drawResult\"] [data-action=\"result-close\"]"
26. `expectText` 定位 ".ticket-pill"；值 "扭蛋券 4"
27. `click` 定位 "[data-action=\"tier-select\"][data-tier-id=\"X3\"]"
28. `click` 定位 "[data-screen=\"machine\"] [data-action=\"draw\"]"
29. `expectCount` 定位 "[data-screen=\"drawResult\"] .result-item"；数量 3
30. `expectText` 定位 "[data-screen=\"drawResult\"] .result-summary"；值 "重复玩具合计 +2 积分"
31. `expectText` 定位 "[data-screen=\"drawResult\"] .result-grid"；值 "金币"
32. `click` 定位 "[data-screen=\"drawResult\"] [data-action=\"result-close\"]"
33. `expectText` 定位 ".ticket-pill"；值 "扭蛋券 1"
34. `click` 定位 "[data-action=\"tier-select\"][data-tier-id=\"X10\"]"
35. `click` 定位 "[data-screen=\"machine\"] [data-action=\"draw\"]"
36. `expectText` 定位 ".activity-toast"；值 "扭蛋券不足，请完成订单或使用主线生成器获取"
37. `expectText` 定位 "[data-action=\"tier-select\"][data-tier-id=\"X10\"]"；值 "×10"
38. `expectText` 定位 ".ticket-pill"；值 "扭蛋券 1"
39. `click` 定位 "[data-screen=\"machine\"] [data-action=\"debug-open\"]"
40. `expectText` 定位 "[data-screen=\"debug\"] .debug-section:has(h3:has-text('奖励账本'))"；值 "模拟到账"
41. `click` 定位 "[data-screen=\"debug\"] [data-action=\"debug-close\"]:not(.modal-close)"
42. `reload` 定位 "body"
43. `expectText` 定位 ".ticket-pill"；值 "扭蛋券 1"

执行记录：平台预览 · 四档倍率逐项抽取、同批重复转积分、跨房间及券不足不降档 通过；离线交付 · 四档倍率逐项抽取、同批重复转积分、跨房间及券不足不降档 通过

### 场景 GACHA_14：刷新后再次供券和抽取仍使用新的事务ID

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] [data-action='guide-skip']:not(.modal-close)"
4. `click` 定位 "[data-action='debug-open']"
5. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"
6. `click` 定位 "[data-screen='debug'] [data-action='debug-close']:not(.modal-close)"
7. `expectText` 定位 ".ticket-pill"；值 "扭蛋券 8"
8. `reload` 定位 "body"
9. `click` 定位 "[data-action='debug-open']"
10. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"
11. `click` 定位 "[data-screen='debug'] [data-action='debug-close']:not(.modal-close)"
12. `expectText` 定位 ".ticket-pill"；值 "扭蛋券 13"
13. `click` 定位 "[data-action='draw']"
14. `click` 定位 "[data-action='feedback-skip']"
15. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
16. `expectText` 定位 ".ticket-pill"；值 "扭蛋券 12"
17. `reload` 定位 "body"
18. `click` 定位 "[data-action='draw']"
19. `click` 定位 "[data-action='feedback-skip']"
20. `expectText` 定位 "[data-screen='drawResult'] .duplicate-points"；值 "重复 +1 积分"
21. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
22. `expectVisible` 定位 "[data-screen='claim']"
23. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
24. `expectText` 定位 ".ticket-pill"；值 "扭蛋券 11"
25. `expectText` 定位 ".progress-heading"；值 "累计积分 1"

执行记录：平台预览 · 刷新后再次供券和抽取仍使用新的事务ID 通过；离线交付 · 刷新后再次供券和抽取仍使用新的事务ID 通过

### 场景 GACHA_16：兑换确认弹窗不可越过未处理的抽取结果

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] [data-action='guide-skip']:not(.modal-close)"
4. `click` 定位 "[data-action='draw']"
5. `click` 定位 "[data-action='feedback-skip']"
6. `expectCount` 定位 "[data-screen='drawResult'] .result-item"；数量 1
7. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 2"
8. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
9. `click` 定位 "[data-action='shop-open']"
10. `click` 定位 "[data-screen='shop'] [data-item-id='SHOP01'] [data-action='exchange-open']"
11. `expectText` 定位 ".activity-toast"；值 "需要集齐全部收藏解锁兑换商城"
12. `expectText` 定位 "[data-screen='shop'] .shop-balance"；值 "0"

执行记录：平台预览 · 兑换确认弹窗不可越过未处理的抽取结果 通过；离线交付 · 兑换确认弹窗不可越过未处理的抽取结果 通过

### 场景 GACHA_24：抽取结果未收下时不丢失队列，关闭后恢复机台

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] .modal-header [data-action='guide-skip']"
4. `click` 定位 "[data-screen='machine'] [data-action='draw']"
5. `click` 定位 "[data-action='feedback-skip']"
6. `expectCount` 定位 "[data-screen='drawResult'] .result-item"；数量 1
7. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 2"
8. `reload` 定位 "body"
9. `expectCount` 定位 "[data-screen='drawResult'] .result-item"；数量 1
10. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 2"
11. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
12. `expectVisible` 定位 "[data-screen='machine'] [data-action='draw']"

执行记录：平台预览 · 抽取结果未收下时不丢失队列，关闭后恢复机台 通过；离线交付 · 抽取结果未收下时不丢失队列，关闭后恢复机台 通过

### 场景 GACHA_28：抽取结果弹层上方的 Debug 不跳过已确认结果

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] .modal-header [data-action='guide-skip']"
4. `click` 定位 "[data-screen='machine'] [data-action='draw']"
5. `click` 定位 "[data-action='feedback-skip']"
6. `expectCount` 定位 "[data-screen='drawResult'] .result-item"；数量 1
7. `click` 定位 "[data-overlay-debug][data-action='debug-open']"
8. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"
9. `expectText` 定位 "[data-screen='debug'] [data-debug-receipt]"；值 "实际 5 张"
10. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
11. `expectCount` 定位 "[data-screen='drawResult'] .result-item"；数量 1
12. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 7"
13. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
14. `expectVisible` 定位 "[data-screen='machine'] [data-action='draw']"

执行记录：平台预览 · 抽取结果弹层上方的 Debug 不跳过已确认结果 通过；离线交付 · 抽取结果弹层上方的 Debug 不跳过已确认结果 通过

### 场景 GACHA_32：重复玩具积分叠在压暗藏品上，收下后汇入机台上方进度条

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] .modal-header [data-action='guide-skip']"
4. `click` 定位 "[data-screen='machine'] [data-action='tier-select'][data-tier-id='X3']"
5. `click` 定位 "[data-screen='machine'] [data-action='draw']"
6. `click` 定位 "[data-action='feedback-skip']"
7. `expectCount` 定位 "[data-screen='drawResult'] .result-item"；数量 3
8. `expectCount` 定位 "[data-screen='drawResult'] .result-item.is-duplicate"；数量 1
9. `expectText` 定位 "[data-screen='drawResult'] .result-item.is-duplicate .result-art .duplicate-points"；值 "+1 积分"
10. `expectText` 定位 "[data-screen='machine'] .progress-heading"；值 "累计积分 1"
11. `click` 定位 "[data-screen='drawResult'] .modal-actions [data-action='result-close']"
12. `expectText` 定位 "[data-screen='machine'] .point-flight-status"；值 "重复积分 +1 已汇入进度条"
13. `expectText` 定位 "[data-screen='machine'] .available-points"；值 "可用积分 1"
14. `expectText` 定位 "[data-screen='claim'] .modal-header"；值 "累计1分"

执行记录：平台预览 · 重复玩具积分叠在压暗藏品上，收下后汇入机台上方进度条 通过；离线交付 · 重复玩具积分叠在压暗藏品上，收下后汇入机台上方进度条 通过

## R04 · 按结果顺序处理25件玩具：首次点亮收藏，同批后续相同ToyId按重复处理；五种品质重复分别增加1、2、3、5、10点，同时增加累计及可用积分。直接主游戏奖励记录模拟到账；棋盘承接类奖励仅记录模拟待领奖清单，不创建主棋盘。抽取结果之后依门槛处理自动阶段奖励，最后处理自动全收藏大奖。

- 策划依据：8.4、8.6—8.8
- 可观察验收：抽到同批重复玩具时核对首次／重复状态及积分；跨越多个阶段节点时按升序出现领奖反馈；查看奖励账本，确认外发奖励有来源、数量和承接方式，重进不重复到账。
- 配置表：`GachaToy`、`QualityConvert`、`RewardCatalog`、`ProgressNodes`、`GachaSequence`
- 实现位置：[src/rewards.js](../project/src/rewards.js) 第 129 行
- 审查状态：pass

实现证据（当前源码原文）：

```text
alreadyOwned ? convert.pointsPerDuplicate : 0
```

### 场景 GACHA_04：四档倍率逐项抽取、同批重复转积分、跨房间及券不足不降档

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen=\"entry\"] [data-action=\"entry-open\"]"
2. `click` 定位 "[data-screen=\"cover\"] [data-action=\"cover-start\"]"
3. `click` 定位 "[data-screen=\"guide\"] .modal-header [data-action=\"guide-skip\"]"
4. `click` 定位 "[data-screen=\"machine\"] [data-action=\"debug-open\"]"
5. `click` 定位 "[data-screen=\"debug\"] [data-action=\"debug-order-success\"]"；数量 4
6. `click` 定位 "[data-screen=\"debug\"] [data-action=\"debug-close\"]:not(.modal-close)"
7. `expectText` 定位 ".ticket-pill"；值 "扭蛋券 23"
8. `click` 定位 "[data-screen=\"machine\"] [data-action=\"draw\"]"
9. `expectCount` 定位 "[data-screen=\"drawResult\"] .result-item"；数量 1
10. `click` 定位 "[data-screen=\"drawResult\"] [data-action=\"result-close\"]"
11. `click` 定位 "[data-action=\"tier-select\"][data-tier-id=\"X3\"]"
12. `click` 定位 "[data-screen=\"machine\"] [data-action=\"draw\"]"
13. `expectCount` 定位 "[data-screen=\"drawResult\"] .result-item"；数量 3
14. `expectText` 定位 "[data-screen=\"drawResult\"] .duplicate-points"；值 "重复 +1 积分"
15. `click` 定位 "[data-screen=\"drawResult\"] [data-action=\"result-close\"]"
16. `expectVisible` 定位 "[data-screen=\"claim\"]"
17. `click` 定位 "[data-screen=\"claim\"] .modal-header [data-action=\"popup-close\"]"
18. `click` 定位 "[data-action=\"tier-select\"][data-tier-id=\"X5\"]"
19. `click` 定位 "[data-screen=\"machine\"] [data-action=\"draw\"]"
20. `expectCount` 定位 "[data-screen=\"drawResult\"] .result-item"；数量 5
21. `click` 定位 "[data-screen=\"drawResult\"] [data-action=\"result-close\"]"
22. `click` 定位 "[data-action=\"tier-select\"][data-tier-id=\"X10\"]"
23. `click` 定位 "[data-screen=\"machine\"] [data-action=\"draw\"]"
24. `expectCount` 定位 "[data-screen=\"drawResult\"] .result-item"；数量 10
25. `click` 定位 "[data-screen=\"drawResult\"] [data-action=\"result-close\"]"
26. `expectText` 定位 ".ticket-pill"；值 "扭蛋券 4"
27. `click` 定位 "[data-action=\"tier-select\"][data-tier-id=\"X3\"]"
28. `click` 定位 "[data-screen=\"machine\"] [data-action=\"draw\"]"
29. `expectCount` 定位 "[data-screen=\"drawResult\"] .result-item"；数量 3
30. `expectText` 定位 "[data-screen=\"drawResult\"] .result-summary"；值 "重复玩具合计 +2 积分"
31. `expectText` 定位 "[data-screen=\"drawResult\"] .result-grid"；值 "金币"
32. `click` 定位 "[data-screen=\"drawResult\"] [data-action=\"result-close\"]"
33. `expectText` 定位 ".ticket-pill"；值 "扭蛋券 1"
34. `click` 定位 "[data-action=\"tier-select\"][data-tier-id=\"X10\"]"
35. `click` 定位 "[data-screen=\"machine\"] [data-action=\"draw\"]"
36. `expectText` 定位 ".activity-toast"；值 "扭蛋券不足，请完成订单或使用主线生成器获取"
37. `expectText` 定位 "[data-action=\"tier-select\"][data-tier-id=\"X10\"]"；值 "×10"
38. `expectText` 定位 ".ticket-pill"；值 "扭蛋券 1"
39. `click` 定位 "[data-screen=\"machine\"] [data-action=\"debug-open\"]"
40. `expectText` 定位 "[data-screen=\"debug\"] .debug-section:has(h3:has-text('奖励账本'))"；值 "模拟到账"
41. `click` 定位 "[data-screen=\"debug\"] [data-action=\"debug-close\"]:not(.modal-close)"
42. `reload` 定位 "body"
43. `expectText` 定位 ".ticket-pill"；值 "扭蛋券 1"

执行记录：平台预览 · 四档倍率逐项抽取、同批重复转积分、跨房间及券不足不降档 通过；离线交付 · 四档倍率逐项抽取、同批重复转积分、跨房间及券不足不降档 通过

### 场景 GACHA_06：集齐25件后自动发放大奖，品质奖励仍须分别手动领取

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen=\"entry\"] [data-action=\"entry-open\"]"
2. `click` 定位 "[data-screen=\"cover\"] [data-action=\"cover-start\"]"
3. `click` 定位 "[data-screen=\"guide\"] .modal-header [data-action=\"guide-skip\"]"
4. `click` 定位 "[data-screen=\"machine\"] [data-action=\"collection-open\"]"
5. `expectText` 定位 "[data-screen=\"collection\"] .collection-total"；值 "0/25"
6. `expectCount` 定位 "[data-screen=\"collection\"] .toy-tile.is-locked"；数量 25
7. `click` 定位 "[data-screen=\"collection\"] .modal-header [data-action=\"panel-back\"]"
8. `click` 定位 "[data-screen=\"machine\"] [data-action=\"debug-open\"]"
9. `click` 定位 "[data-screen=\"debug\"] [data-action=\"debug-order-success\"]"；数量 6
10. `click` 定位 "[data-screen=\"debug\"] [data-action=\"debug-close\"]:not(.modal-close)"
11. `click` 定位 "[data-action=\"tier-select\"][data-tier-id=\"X10\"]"
12. `click` 定位 "[data-screen=\"machine\"] [data-action=\"draw\"]"
13. `expectCount` 定位 "[data-screen=\"drawResult\"] .result-item"；数量 10
14. `expectText` 定位 "[data-screen=\"drawResult\"] .result-summary"；值 "重复玩具合计 +1 积分"
15. `click` 定位 "[data-screen=\"drawResult\"] [data-action=\"result-close\"]"
16. `expectText` 定位 "[data-screen=\"claim\"] .modal-header"；值 "累计1分"
17. `click` 定位 "[data-screen=\"claim\"] .modal-header [data-action=\"popup-close\"]"
18. `click` 定位 "[data-screen=\"machine\"] [data-action=\"draw\"]"
19. `expectCount` 定位 "[data-screen=\"drawResult\"] .result-item"；数量 10
20. `click` 定位 "[data-screen=\"drawResult\"] [data-action=\"result-close\"]"
21. `click` 定位 "[data-screen=\"machine\"] [data-action=\"draw\"]"
22. `expectCount` 定位 "[data-screen=\"drawResult\"] .result-item"；数量 10
23. `click` 定位 "[data-screen=\"drawResult\"] [data-action=\"result-close\"]"
24. `expectText` 定位 "[data-screen=\"claim\"] .modal-header"；值 "累计5分"
25. `click` 定位 "[data-screen=\"claim\"] .modal-header [data-action=\"popup-close\"]"
26. `expectText` 定位 "[data-screen=\"claim\"] .modal-header"；值 "全部玩具25/25"
27. `click` 定位 "[data-screen=\"claim\"] .modal-header [data-action=\"popup-close\"]"
28. `expectVisible` 定位 "[data-screen=\"shopUnlock\"]"
29. `click` 定位 "[data-screen=\"shopUnlock\"] .modal-header [data-action=\"popup-close\"]"
30. `click` 定位 "[data-screen=\"machine\"] [data-action=\"collection-open\"]"
31. `expectText` 定位 "[data-screen=\"collection\"] .collection-total"；值 "25/25"
32. `expectCount` 定位 "[data-screen=\"collection\"] .toy-tile.is-owned"；数量 25
33. `expectText` 定位 "[data-screen=\"collection\"] .complete-reward"；值 "已自动发放"
34. `expectCount` 定位 "[data-screen=\"collection\"] [data-action=\"claim-node\"]:not(:disabled)"；数量 5
35. `click` 定位 "[data-screen=\"collection\"] [data-action=\"claim-node\"][data-node-id=\"COL_GREEN\"]"
36. `expectVisible` 定位 "[data-local-claim=\"COL_GREEN\"] [data-action=\"claim-confirm\"]"
37. `click` 定位 "[data-local-claim=\"COL_GREEN\"] [data-action=\"claim-confirm\"]"
38. `expectText` 定位 "[data-screen=\"claim\"] .modal-content"；值 "不会重复发放"
39. `click` 定位 "[data-screen=\"claim\"] .modal-header [data-action=\"popup-close\"]"
40. `expectDisabled` 定位 "[data-screen=\"collection\"] [data-action=\"claim-node\"][data-node-id=\"COL_GREEN\"]"
41. `click` 定位 "[data-screen=\"collection\"] .modal-header [data-action=\"panel-back\"]"
42. `click` 定位 "[data-screen=\"machine\"] [data-action=\"shop-open\"]"
43. `expectText` 定位 "[data-screen=\"shop\"] .shop-note"；值 "积分兑换商店现已开放"

执行记录：平台预览 · 集齐25件后自动发放大奖，品质奖励仍须分别手动领取 通过；离线交付 · 集齐25件后自动发放大奖，品质奖励仍须分别手动领取 通过

### 场景 GACHA_13：供券拒绝写入本地日志且不改变券余额，重复玩具达成首个阶段节点

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] [data-action='guide-skip']:not(.modal-close)"
4. `click` 定位 "[data-screen='machine'] [data-action='debug-open']"
5. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"
6. `click` 定位 "[data-screen='debug'] [data-action='debug-replay']"
7. `expectText` 定位 "[data-screen='debug'] [data-debug-receipt]"；值 "去重"
8. `expectText` 定位 "[data-screen='debug'] .debug-section:nth-of-type(5) .debug-log"；值 "supply_rejected"
9. `click` 定位 "[data-screen='debug'] [data-action='debug-close']:not(.modal-close)"
10. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 8"
11. `click` 定位 "[data-screen='machine'] [data-action='draw']"
12. `click` 定位 "[data-action='feedback-skip']"
13. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
14. `click` 定位 "[data-screen='machine'] [data-action='draw']"
15. `click` 定位 "[data-action='feedback-skip']"
16. `expectText` 定位 "[data-screen='drawResult'] .duplicate-points"；值 "重复 +1 积分"
17. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
18. `expectText` 定位 "[data-screen='claim'] .modal-header"；值 "累计1分"
19. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
20. `expectText` 定位 "[data-screen='machine'] .progress-heading"；值 "累计积分 1"
21. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 6"

执行记录：平台预览 · 供券拒绝写入本地日志且不改变券余额，重复玩具达成首个阶段节点 通过；离线交付 · 供券拒绝写入本地日志且不改变券余额，重复玩具达成首个阶段节点 通过

### 场景 GACHA_14：刷新后再次供券和抽取仍使用新的事务ID

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] [data-action='guide-skip']:not(.modal-close)"
4. `click` 定位 "[data-action='debug-open']"
5. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"
6. `click` 定位 "[data-screen='debug'] [data-action='debug-close']:not(.modal-close)"
7. `expectText` 定位 ".ticket-pill"；值 "扭蛋券 8"
8. `reload` 定位 "body"
9. `click` 定位 "[data-action='debug-open']"
10. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"
11. `click` 定位 "[data-screen='debug'] [data-action='debug-close']:not(.modal-close)"
12. `expectText` 定位 ".ticket-pill"；值 "扭蛋券 13"
13. `click` 定位 "[data-action='draw']"
14. `click` 定位 "[data-action='feedback-skip']"
15. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
16. `expectText` 定位 ".ticket-pill"；值 "扭蛋券 12"
17. `reload` 定位 "body"
18. `click` 定位 "[data-action='draw']"
19. `click` 定位 "[data-action='feedback-skip']"
20. `expectText` 定位 "[data-screen='drawResult'] .duplicate-points"；值 "重复 +1 积分"
21. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
22. `expectVisible` 定位 "[data-screen='claim']"
23. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
24. `expectText` 定位 ".ticket-pill"；值 "扭蛋券 11"
25. `expectText` 定位 ".progress-heading"；值 "累计积分 1"

执行记录：平台预览 · 刷新后再次供券和抽取仍使用新的事务ID 通过；离线交付 · 刷新后再次供券和抽取仍使用新的事务ID 通过

### 场景 GACHA_32：重复玩具积分叠在压暗藏品上，收下后汇入机台上方进度条

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] .modal-header [data-action='guide-skip']"
4. `click` 定位 "[data-screen='machine'] [data-action='tier-select'][data-tier-id='X3']"
5. `click` 定位 "[data-screen='machine'] [data-action='draw']"
6. `click` 定位 "[data-action='feedback-skip']"
7. `expectCount` 定位 "[data-screen='drawResult'] .result-item"；数量 3
8. `expectCount` 定位 "[data-screen='drawResult'] .result-item.is-duplicate"；数量 1
9. `expectText` 定位 "[data-screen='drawResult'] .result-item.is-duplicate .result-art .duplicate-points"；值 "+1 积分"
10. `expectText` 定位 "[data-screen='machine'] .progress-heading"；值 "累计积分 1"
11. `click` 定位 "[data-screen='drawResult'] .modal-actions [data-action='result-close']"
12. `expectText` 定位 "[data-screen='machine'] .point-flight-status"；值 "重复积分 +1 已汇入进度条"
13. `expectText` 定位 "[data-screen='machine'] .available-points"；值 "可用积分 1"
14. `expectText` 定位 "[data-screen='claim'] .modal-header"；值 "累计1分"

执行记录：平台预览 · 重复玩具积分叠在压暗藏品上，收下后汇入机台上方进度条 通过；离线交付 · 重复玩具积分叠在压暗藏品上，收下后汇入机台上方进度条 通过

## R05 · Info展示当前分层及序列统计范围的固定序列「投放占比」，不称为下一抽独立概率。逐件列出25件玩具，并按奖励及数量组合列出其他结果；显示品质重复积分、倍率含义和统计口径。展示值从实际生效序列计算，不维护可能失配的第二套数值。

- 策划依据：8.5、13.11
- 可观察验收：首次抽取前打开Info，能滚动查看25件玩具和全部非玩具组合；逐项计数与当前序列配置一致、占比合计100%；切换Debug分层后重新进入，看到对应口径。
- 配置表：`GachaSequence`、`GachaToy`、`QualityConvert`、`RewardCatalog`、`PlayerLayers`、`UiCopy`
- 实现位置：没有匹配的源码证据，须人工定位
- 审查状态：fail

实现证据（当前源码原文）：

```text
views.js 的 Info 仅提供 `FULL` 和 `LOOP` 范围；当前处于中间奖励房间时没有该房间的投放占比入口。
```

### 场景 GACHA_05：抽取前查看固定序列逐项投放占比及末房间循环范围

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen=\"entry\"] [data-action=\"entry-open\"]"
2. `click` 定位 "[data-screen=\"cover\"] [data-action=\"cover-start\"]"
3. `click` 定位 "[data-screen=\"guide\"] .modal-header [data-action=\"guide-skip\"]"
4. `click` 定位 "[data-screen=\"machine\"] [data-action=\"info-open\"]"
5. `expectText` 定位 "[data-screen=\"info\"] .info-intro"；值 "不是下一抽独立概率"
6. `expectText` 定位 "[data-screen=\"info\"] .info-intro"；值 "60 项"
7. `expectCount` 定位 "[data-screen=\"info\"] .share-row .toy-art"；数量 25
8. `expectCount` 定位 "[data-screen=\"info\"] .share-row"；数量 28
9. `expectText` 定位 "[data-screen=\"info\"] .share-row:first-child .share-percent"；值 "8.33%"
10. `expectText` 定位 "[data-screen=\"info\"] .share-list"；值 "星纹道具箱"
11. `click` 定位 "[data-screen=\"info\"] [data-action=\"info-scope\"][data-scope=\"LOOP\"]"
12. `expectText` 定位 "[data-screen=\"info\"] .info-intro"；值 "20 项"
13. `expectText` 定位 "[data-screen=\"info\"] .share-row:first-child .share-percent"；值 "5.00%"
14. `click` 定位 "[data-screen=\"info\"] .modal-header [data-action=\"panel-back\"]"
15. `expectVisible` 定位 "[data-screen=\"machine\"] [data-action=\"draw\"]"

执行记录：平台预览 · 抽取前查看固定序列逐项投放占比及末房间循环范围 通过；离线交付 · 抽取前查看固定序列逐项投放占比及末房间循环范围 通过

### 场景 GACHA_22：模拟存档故障后仍能浏览收藏、Info 与事件账本，抽取保持禁用

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] .modal-header [data-action='guide-skip']"
4. `click` 定位 "[data-screen='machine'] [data-action='debug-open']"
5. `click` 定位 "[data-screen='debug'] [data-action='debug-storage-fail']"
6. `expectText` 定位 "[data-screen='debug'] [data-save-warning]"；值 "活动存档暂不可用"
7. `expectVisible` 定位 "[data-screen='debug'] .debug-section:has(h3:has-text('奖励账本'))"
8. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
9. `expectDisabled` 定位 "[data-screen='machine'] [data-action='draw']"
10. `click` 定位 "[data-screen='machine'] [data-action='collection-open']"
11. `expectCount` 定位 "[data-screen='collection'] .toy-tile.is-locked"；数量 25
12. `click` 定位 "[data-screen='collection'] .modal-header [data-action='panel-back']"
13. `click` 定位 "[data-screen='machine'] [data-action='info-open']"
14. `expectCount` 定位 "[data-screen='info'] .share-row .toy-art"；数量 25
15. `click` 定位 "[data-screen='info'] .modal-header [data-action='panel-back']"
16. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 3"

执行记录：平台预览 · 模拟存档故障后仍能浏览收藏、Info 与事件账本，抽取保持禁用 通过；离线交付 · 模拟存档故障后仍能浏览收藏、Info 与事件账本，抽取保持禁用 通过

### 场景 GACHA_29：修复回归：外部供券后仍可在Info查看完整固定序列投放口径

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] .modal-header [data-action='guide-skip']"
4. `click` 定位 "[data-screen='machine'] [data-action='debug-open']"
5. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"
6. `expectText` 定位 "[data-screen='debug'] [data-debug-receipt]"；值 "实际 5 张"
7. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
8. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 8"
9. `click` 定位 "[data-screen='machine'] [data-action='info-open']"
10. `expectVisible` 定位 "[data-screen='info'] [data-scroll-region='info']"
11. `expectCount` 定位 "[data-screen='info'] .share-row .toy-art"；数量 25
12. `expectText` 定位 "[data-screen='info'] .info-intro"；值 "不是下一抽独立概率"
13. `expectText` 定位 "[data-screen='info'] .share-row:first-child .share-percent"；值 "8.33%"
14. `click` 定位 "[data-screen='info'] .modal-header [data-action='panel-back']"
15. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 8"

执行记录：平台预览 · 修复回归：外部供券后仍可在Info查看完整固定序列投放口径 通过；离线交付 · 修复回归：外部供券后仍可在Info查看完整固定序列投放口径 通过

## R06 · 收藏页显示五条各含5件玩具的品质收藏线及25件总进度；未获得为锁定轮廓，新获得显示NEW。各品质满5件后分别手动点击奖励并经领奖弹板确认；全收藏大奖自动发放，不依赖品质奖励领取状态。

- 策划依据：8.6、8.10
- 可观察验收：逐步点亮玩具，确认组进度及NEW状态；在5/5时进入收藏页手动领取，重复点击不重复到账；达到25/25后查看自动大奖及商店解锁。
- 配置表：`GachaToy`、`ProgressNodes`、`RewardCatalog`、`UiCopy`
- 实现位置：[src/config.js](../project/src/config.js) 第 276 行；[src/progress.js](../project/src/progress.js) 第 55 行；[src/state.js](../project/src/state.js) 第 471 行；[src/defaults.js](../project/src/defaults.js) 第 58 行；[tests/claim-queue-recovery.js](../project/tests/claim-queue-recovery.js) 第 45 行
- 审查状态：pass

实现证据（当前源码原文）：

```text
MANUAL
```

### 场景 GACHA_02：封面和引导不重复展示，关闭、重进及刷新保留初始券

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen=\"entry\"] [data-action=\"entry-open\"]"
2. `expectVisible` 定位 "[data-screen=\"cover\"] [data-action=\"cover-start\"]"
3. `click` 定位 "[data-screen=\"cover\"] [data-action=\"cover-start\"]"
4. `expectVisible` 定位 "[data-screen=\"guide\"] [data-action=\"guide-next\"]"
5. `click` 定位 "[data-screen=\"guide\"] .modal-header [data-action=\"guide-skip\"]"
6. `expectText` 定位 ".ticket-pill"；值 "扭蛋券 3"
7. `click` 定位 "[data-screen=\"machine\"] [data-action=\"machine-close\"]"
8. `click` 定位 "[data-screen=\"entry\"] [data-action=\"entry-open\"]"
9. `expectVisible` 定位 "[data-screen=\"machine\"] [data-action=\"draw\"]"
10. `expectCount` 定位 "[data-screen=\"cover\"]"；数量 0
11. `expectCount` 定位 "[data-screen=\"guide\"]"；数量 0
12. `reload` 定位 "body"
13. `expectText` 定位 ".ticket-pill"；值 "扭蛋券 3"

执行记录：平台预览 · 封面和引导不重复展示，关闭、重进及刷新保留初始券 通过；离线交付 · 封面和引导不重复展示，关闭、重进及刷新保留初始券 通过

### 场景 GACHA_06：集齐25件后自动发放大奖，品质奖励仍须分别手动领取

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen=\"entry\"] [data-action=\"entry-open\"]"
2. `click` 定位 "[data-screen=\"cover\"] [data-action=\"cover-start\"]"
3. `click` 定位 "[data-screen=\"guide\"] .modal-header [data-action=\"guide-skip\"]"
4. `click` 定位 "[data-screen=\"machine\"] [data-action=\"collection-open\"]"
5. `expectText` 定位 "[data-screen=\"collection\"] .collection-total"；值 "0/25"
6. `expectCount` 定位 "[data-screen=\"collection\"] .toy-tile.is-locked"；数量 25
7. `click` 定位 "[data-screen=\"collection\"] .modal-header [data-action=\"panel-back\"]"
8. `click` 定位 "[data-screen=\"machine\"] [data-action=\"debug-open\"]"
9. `click` 定位 "[data-screen=\"debug\"] [data-action=\"debug-order-success\"]"；数量 6
10. `click` 定位 "[data-screen=\"debug\"] [data-action=\"debug-close\"]:not(.modal-close)"
11. `click` 定位 "[data-action=\"tier-select\"][data-tier-id=\"X10\"]"
12. `click` 定位 "[data-screen=\"machine\"] [data-action=\"draw\"]"
13. `expectCount` 定位 "[data-screen=\"drawResult\"] .result-item"；数量 10
14. `expectText` 定位 "[data-screen=\"drawResult\"] .result-summary"；值 "重复玩具合计 +1 积分"
15. `click` 定位 "[data-screen=\"drawResult\"] [data-action=\"result-close\"]"
16. `expectText` 定位 "[data-screen=\"claim\"] .modal-header"；值 "累计1分"
17. `click` 定位 "[data-screen=\"claim\"] .modal-header [data-action=\"popup-close\"]"
18. `click` 定位 "[data-screen=\"machine\"] [data-action=\"draw\"]"
19. `expectCount` 定位 "[data-screen=\"drawResult\"] .result-item"；数量 10
20. `click` 定位 "[data-screen=\"drawResult\"] [data-action=\"result-close\"]"
21. `click` 定位 "[data-screen=\"machine\"] [data-action=\"draw\"]"
22. `expectCount` 定位 "[data-screen=\"drawResult\"] .result-item"；数量 10
23. `click` 定位 "[data-screen=\"drawResult\"] [data-action=\"result-close\"]"
24. `expectText` 定位 "[data-screen=\"claim\"] .modal-header"；值 "累计5分"
25. `click` 定位 "[data-screen=\"claim\"] .modal-header [data-action=\"popup-close\"]"
26. `expectText` 定位 "[data-screen=\"claim\"] .modal-header"；值 "全部玩具25/25"
27. `click` 定位 "[data-screen=\"claim\"] .modal-header [data-action=\"popup-close\"]"
28. `expectVisible` 定位 "[data-screen=\"shopUnlock\"]"
29. `click` 定位 "[data-screen=\"shopUnlock\"] .modal-header [data-action=\"popup-close\"]"
30. `click` 定位 "[data-screen=\"machine\"] [data-action=\"collection-open\"]"
31. `expectText` 定位 "[data-screen=\"collection\"] .collection-total"；值 "25/25"
32. `expectCount` 定位 "[data-screen=\"collection\"] .toy-tile.is-owned"；数量 25
33. `expectText` 定位 "[data-screen=\"collection\"] .complete-reward"；值 "已自动发放"
34. `expectCount` 定位 "[data-screen=\"collection\"] [data-action=\"claim-node\"]:not(:disabled)"；数量 5
35. `click` 定位 "[data-screen=\"collection\"] [data-action=\"claim-node\"][data-node-id=\"COL_GREEN\"]"
36. `expectVisible` 定位 "[data-local-claim=\"COL_GREEN\"] [data-action=\"claim-confirm\"]"
37. `click` 定位 "[data-local-claim=\"COL_GREEN\"] [data-action=\"claim-confirm\"]"
38. `expectText` 定位 "[data-screen=\"claim\"] .modal-content"；值 "不会重复发放"
39. `click` 定位 "[data-screen=\"claim\"] .modal-header [data-action=\"popup-close\"]"
40. `expectDisabled` 定位 "[data-screen=\"collection\"] [data-action=\"claim-node\"][data-node-id=\"COL_GREEN\"]"
41. `click` 定位 "[data-screen=\"collection\"] .modal-header [data-action=\"panel-back\"]"
42. `click` 定位 "[data-screen=\"machine\"] [data-action=\"shop-open\"]"
43. `expectText` 定位 "[data-screen=\"shop\"] .shop-note"；值 "积分兑换商店现已开放"

执行记录：平台预览 · 集齐25件后自动发放大奖，品质奖励仍须分别手动领取 通过；离线交付 · 集齐25件后自动发放大奖，品质奖励仍须分别手动领取 通过

### 场景 GACHA_22：模拟存档故障后仍能浏览收藏、Info 与事件账本，抽取保持禁用

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] .modal-header [data-action='guide-skip']"
4. `click` 定位 "[data-screen='machine'] [data-action='debug-open']"
5. `click` 定位 "[data-screen='debug'] [data-action='debug-storage-fail']"
6. `expectText` 定位 "[data-screen='debug'] [data-save-warning]"；值 "活动存档暂不可用"
7. `expectVisible` 定位 "[data-screen='debug'] .debug-section:has(h3:has-text('奖励账本'))"
8. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
9. `expectDisabled` 定位 "[data-screen='machine'] [data-action='draw']"
10. `click` 定位 "[data-screen='machine'] [data-action='collection-open']"
11. `expectCount` 定位 "[data-screen='collection'] .toy-tile.is-locked"；数量 25
12. `click` 定位 "[data-screen='collection'] .modal-header [data-action='panel-back']"
13. `click` 定位 "[data-screen='machine'] [data-action='info-open']"
14. `expectCount` 定位 "[data-screen='info'] .share-row .toy-art"；数量 25
15. `click` 定位 "[data-screen='info'] .modal-header [data-action='panel-back']"
16. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 3"

执行记录：平台预览 · 模拟存档故障后仍能浏览收藏、Info 与事件账本，抽取保持禁用 通过；离线交付 · 模拟存档故障后仍能浏览收藏、Info 与事件账本，抽取保持禁用 通过

## R07 · 五个累计积分阶段节点达标自动领奖；兑换只扣可用积分，不降低累计积分。商店与收藏入口并列，未全收藏可查看但不能兑换；解锁后按商品价格、次数和确认弹窗兑换，全收藏后仍能继续抽取。

- 策划依据：8.7—8.9
- 可观察验收：全收藏前尝试兑换看到锁定原因；解锁后取消确认不扣分，确认后仅可用积分下降、次数增加且奖励到账；积分不足和售罄分别显示正确状态。
- 配置表：`ProgressNodes`、`GachaShop`、`RewardCatalog`、`UiCopy`
- 实现位置：[src/shop.js](../project/src/shop.js) 第 167 行
- 审查状态：pass

实现证据（当前源码原文）：

```text
draft.availablePoints -= status.price
```

### 场景 GACHA_09：全收藏后兑换：锁定、取消、扣分、积分不足与售罄

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] [data-action='guide-skip']:not(.modal-close)"
4. `click` 定位 "[data-action='shop-open']"
5. `click` 定位 "[data-screen='shop'] [data-item-id='SHOP01'] [data-action='exchange-open']"
6. `expectText` 定位 ".activity-toast"；值 "需要集齐全部收藏解锁兑换商城"
7. `click` 定位 "[data-screen='shop'] [data-action='panel-back']:not(.modal-close)"
8. `click` 定位 "[data-action='debug-open']"
9. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"；数量 9
10. `expectText` 定位 "[data-screen='debug'] [data-debug-receipt]"；值 "实际 5 张"
11. `click` 定位 "[data-screen='debug'] [data-action='debug-close']:not(.modal-close)"
12. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "48"
13. `click` 定位 "[data-action='tier-select'][data-tier-id='X10']"
14. `click` 定位 "[data-action='draw']"
15. `click` 定位 "[data-action='feedback-skip']"
16. `expectCount` 定位 "[data-screen='drawResult'] .result-item"；数量 10
17. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
18. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
19. `click` 定位 "[data-action='draw']"
20. `click` 定位 "[data-action='feedback-skip']"
21. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
22. `click` 定位 "[data-action='draw']"
23. `click` 定位 "[data-action='feedback-skip']"
24. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
25. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
26. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
27. `expectVisible` 定位 "[data-screen='shopUnlock'] [data-action='popup-close']:not(.modal-close)"
28. `click` 定位 "[data-screen='shopUnlock'] [data-action='popup-close']:not(.modal-close)"
29. `click` 定位 "[data-action='draw']"
30. `click` 定位 "[data-action='feedback-skip']"
31. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
32. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"；数量 2
33. `expectText` 定位 "[data-screen='machine'] .progress-heading"；值 "49"
34. `click` 定位 "[data-action='shop-open']"
35. `expectText` 定位 "[data-screen='shop'] .shop-balance"；值 "49"
36. `click` 定位 "[data-screen='shop'] [data-item-id='SHOP03'] [data-action='exchange-open']"
37. `expectVisible` 定位 "[data-screen='exchangeConfirm'] [data-action='exchange-confirm']"
38. `click` 定位 "[data-screen='exchangeConfirm'] [data-action='exchange-cancel']:not(.modal-close)"
39. `expectText` 定位 "[data-screen='shop'] .shop-balance"；值 "49"
40. `click` 定位 "[data-screen='shop'] [data-item-id='SHOP03'] [data-action='exchange-open']"
41. `click` 定位 "[data-screen='exchangeConfirm'] [data-action='exchange-confirm']"
42. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
43. `expectText` 定位 "[data-screen='shop'] .shop-balance"；值 "24"
44. `expectText` 定位 "[data-screen='shop'] article[data-item-id='SHOP03']"；值 "已售罄"
45. `click` 定位 "[data-screen='shop'] [data-item-id='SHOP03'] [data-action='exchange-open']"
46. `expectText` 定位 ".activity-toast"；值 "已售罄"
47. `click` 定位 "[data-screen='shop'] [data-item-id='SHOP02'] [data-action='exchange-open']"
48. `click` 定位 "[data-screen='exchangeConfirm'] [data-action='exchange-confirm']"
49. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
50. `click` 定位 "[data-screen='shop'] [data-item-id='SHOP02'] [data-action='exchange-open']"
51. `click` 定位 "[data-screen='exchangeConfirm'] [data-action='exchange-confirm']"
52. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
53. `expectText` 定位 "[data-screen='shop'] .shop-balance"；值 "4"
54. `click` 定位 "[data-screen='shop'] [data-item-id='SHOP02'] [data-action='exchange-open']"
55. `expectText` 定位 ".activity-toast"；值 "积分不足，请继续扭蛋获取"
56. `click` 定位 "[data-screen='shop'] [data-action='panel-back']:not(.modal-close)"
57. `expectText` 定位 "[data-screen='machine'] .progress-heading"；值 "累计积分 49"
58. `click` 定位 "[data-action='debug-open']"
59. `expectText` 定位 "[data-screen='debug'] .debug-section:nth-of-type(5) .debug-log"；值 "节点 PT01"
60. `expectText` 定位 "[data-screen='debug'] .debug-section:nth-of-type(6) .debug-log"；值 "模拟待领奖"

执行记录：平台预览 · 全收藏后兑换：锁定、取消、扣分、积分不足与售罄 通过；离线交付 · 全收藏后兑换：锁定、取消、扣分、积分不足与售罄 通过

### 场景 GACHA_12：到期会话保留商店操作，离开后按序展示结束与品质补发

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] [data-action='guide-skip']:not(.modal-close)"
4. `click` 定位 "[data-action='debug-open']"
5. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"；数量 8
6. `click` 定位 "[data-screen='debug'] [data-action='debug-close']:not(.modal-close)"
7. `click` 定位 "[data-action='tier-select'][data-tier-id='X10']"
8. `click` 定位 "[data-action='draw']"
9. `click` 定位 "[data-action='feedback-skip']"
10. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
11. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
12. `click` 定位 "[data-action='draw']"
13. `click` 定位 "[data-action='feedback-skip']"
14. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
15. `click` 定位 "[data-action='draw']"
16. `click` 定位 "[data-action='feedback-skip']"
17. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
18. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
19. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
20. `click` 定位 "[data-screen='shopUnlock'] [data-action='popup-close']:not(.modal-close)"
21. `click` 定位 "[data-action='draw']"
22. `click` 定位 "[data-action='feedback-skip']"
23. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
24. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"；数量 2
25. `click` 定位 "[data-action='collection-open']"
26. `expectText` 定位 "[data-screen='collection'] .collection-total"；值 "25/25"
27. `expectCount` 定位 "[data-screen='collection'] [data-action='claim-node'].can-claim"；数量 5
28. `click` 定位 "[data-screen='collection'] [data-action='panel-back']:not(.modal-close)"
29. `click` 定位 "[data-action='debug-open']"
30. `click` 定位 "[data-screen='debug'] [data-action='debug-expire']"
31. `click` 定位 "[data-screen='debug'] [data-action='debug-close']:not(.modal-close)"
32. `click` 定位 "[data-action='shop-open']"
33. `expectText` 定位 "[data-screen='shop'] .shop-balance"；值 "49"
34. `click` 定位 "[data-screen='shop'] [data-action='panel-back']:not(.modal-close)"
35. `click` 定位 "[data-action='machine-close']"
36. `expectText` 定位 "[data-screen='ending']"；值 "25/25"
37. `click` 定位 "[data-screen='ending'] [data-action='ending-confirm']:not(.modal-close)"
38. `expectVisible` 定位 "[data-screen='makeup'] [data-action='makeup-claim']"
39. `expectCount` 定位 "[data-screen='makeup'] .makeup-item"；数量 5
40. `click` 定位 "[data-screen='makeup'] [data-action='makeup-claim']"
41. `expectText` 定位 "[data-screen='makeup'] [data-action='makeup-claim']"；值 "完成结算"
42. `click` 定位 "[data-screen='makeup'] [data-action='makeup-claim']"
43. `expectText` 定位 "[data-screen='entry'] .entry-unavailable"；值 "本期活动已结束"
44. `reload` 定位 "body"
45. `expectCount` 定位 "[data-screen='makeup']"；数量 0
46. `expectText` 定位 "[data-screen='entry'] .entry-unavailable"；值 "本期活动已结束"

执行记录：平台预览 · 到期会话保留商店操作，离开后按序展示结束与品质补发 通过；离线交付 · 到期会话保留商店操作，离开后按序展示结束与品质补发 通过

### 场景 GACHA_16：兑换确认弹窗不可越过未处理的抽取结果

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] [data-action='guide-skip']:not(.modal-close)"
4. `click` 定位 "[data-action='draw']"
5. `click` 定位 "[data-action='feedback-skip']"
6. `expectCount` 定位 "[data-screen='drawResult'] .result-item"；数量 1
7. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 2"
8. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
9. `click` 定位 "[data-action='shop-open']"
10. `click` 定位 "[data-screen='shop'] [data-item-id='SHOP01'] [data-action='exchange-open']"
11. `expectText` 定位 ".activity-toast"；值 "需要集齐全部收藏解锁兑换商城"
12. `expectText` 定位 "[data-screen='shop'] .shop-balance"；值 "0"

执行记录：平台预览 · 兑换确认弹窗不可越过未处理的抽取结果 通过；离线交付 · 兑换确认弹窗不可越过未处理的抽取结果 通过

### 场景 GACHA_26：已确认兑换结果刷新后仍可收下，且不会重复扣分到账

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] .modal-header [data-action='guide-skip']"
4. `click` 定位 "[data-screen='machine'] [data-action='debug-open']"
5. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"；数量 9
6. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
7. `click` 定位 "[data-action='tier-select'][data-tier-id='X10']"
8. `click` 定位 "[data-action='draw']"
9. `click` 定位 "[data-action='feedback-skip']"
10. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
11. `click` 定位 "[data-screen='claim'] .modal-actions [data-action='popup-close']"
12. `click` 定位 "[data-action='draw']"
13. `click` 定位 "[data-action='feedback-skip']"
14. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
15. `click` 定位 "[data-action='draw']"
16. `click` 定位 "[data-action='feedback-skip']"
17. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
18. `click` 定位 "[data-screen='claim'] .modal-actions [data-action='popup-close']"；数量 2
19. `click` 定位 "[data-screen='shopUnlock'] .modal-actions [data-action='popup-close']"
20. `click` 定位 "[data-action='draw']"
21. `click` 定位 "[data-action='feedback-skip']"
22. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
23. `click` 定位 "[data-screen='claim'] .modal-actions [data-action='popup-close']"；数量 2
24. `expectText` 定位 "[data-screen='machine'] .progress-heading"；值 "累计积分 49"
25. `click` 定位 "[data-action='shop-open']"
26. `click` 定位 "[data-screen='shop'] [data-item-id='SHOP01'] [data-action='exchange-open']"
27. `expectVisible` 定位 "[data-screen='exchangeConfirm'] [data-action='exchange-confirm']"
28. `click` 定位 "[data-screen='exchangeConfirm'] [data-action='exchange-confirm']"
29. `expectVisible` 定位 "[data-screen='claim'] .modal-content"
30. `reload` 定位 "body"
31. `expectText` 定位 "[data-screen='claim'] .modal-content"；值 "兑换已确认"
32. `click` 定位 "[data-screen='claim'] .modal-actions [data-action='popup-close']"
33. `expectText` 定位 "[data-screen='shop'] .shop-balance"；值 "46"
34. `expectText` 定位 "[data-screen='machine'] .progress-heading"；值 "累计积分 49"
35. `expectText` 定位 "[data-screen='shop'] article[data-item-id='SHOP01']"；值 "不限次数"

执行记录：平台预览 · 已确认兑换结果刷新后仍可收下，且不会重复扣分到账 通过；离线交付 · 已确认兑换结果刷新后仍可收下，且不会重复扣分到账 通过

## R08 · 提供一次性开启封面、可关闭的新手引导、规则说明和商店解锁提示。引导解释Debug模拟的订单／生成器供券来源，但不要求游玩主线；引导中断不回滚已完成操作。

- 策划依据：8.1、8.3、9.1、11
- 可观察验收：首次进入按顺序查看封面及引导；中途关闭并重进，活动进度保留；说明页能找到供券、倍率、收藏、积分、商店及截止规则。
- 配置表：`ActivityConfig`、`UiCopy`
- 实现位置：[src/state.js](../project/src/state.js) 第 74 行；[docs/unity-art-handoff.md](../project/docs/unity-art-handoff.md) 第 22 行
- 审查状态：pass

实现证据（当前源码原文）：

```text
coverSeen
```

### 场景 GACHA_07：首次封面、引导中断、规则说明与重进

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-action='entry-open']"
2. `expectVisible` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
4. `expectVisible` 定位 "[data-screen='guide'] [data-action='guide-next']"
5. `click` 定位 "[data-screen='guide'] [data-action='guide-next']"
6. `expectText` 定位 "[data-screen='guide'] .guide-progress"；值 "2 / 5"
7. `click` 定位 "[data-screen='guide'] [data-action='guide-skip']:not(.modal-close)"
8. `click` 定位 "[data-action='rules-open']"
9. `expectText` 定位 "[data-screen='rulesGuide'] .rules-list"；值 "Debug模拟供券"
10. `expectText` 定位 "[data-screen='rulesGuide'] .rules-list"；值 "累计积分"
11. `expectText` 定位 "[data-screen='rulesGuide'] .rules-list"；值 "兑换商店"
12. `click` 定位 "[data-screen='rulesGuide'] [data-action='panel-back']:not(.modal-close)"
13. `click` 定位 "[data-action='machine-close']"
14. `click` 定位 "[data-action='entry-open']"
15. `expectCount` 定位 "[data-screen='cover']"；数量 0
16. `expectVisible` 定位 "[data-screen='machine'] [data-action='draw']"
17. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "3"

执行记录：平台预览 · 首次封面、引导中断、规则说明与重进 通过；离线交付 · 首次封面、引导中断、规则说明与重进 通过

### 场景 GACHA_08：Info 完整列表、统计范围与倍率保留

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] [data-action='guide-skip']:not(.modal-close)"
4. `click` 定位 "[data-action='tier-select'][data-tier-id='X5']"
5. `click` 定位 "[data-action='info-open']"
6. `expectVisible` 定位 "[data-screen='info'] [data-scroll-region='info']"
7. `expectCount` 定位 "[data-screen='info'] .share-row[data-quality]"；数量 25
8. `expectText` 定位 "[data-screen='info'] .info-intro"；值 "60 项"
9. `expectText` 定位 "[data-screen='info'] .share-list .share-row:nth-child(25)"；值 "星冠凤凰"
10. `click` 定位 "[data-screen='info'] [data-action='info-scope'][data-scope='LOOP']"
11. `expectText` 定位 "[data-screen='info'] .info-intro"；值 "20 项"
12. `click` 定位 "[data-screen='info'] [data-action='panel-back']:not(.modal-close)"
13. `expectVisible` 定位 "[data-action='tier-select'][data-tier-id='X5'][aria-pressed='true']"
14. `expectText` 定位 "[data-action='draw']"；值 "消耗 5 张扭蛋券"

执行记录：平台预览 · Info 完整列表、统计范围与倍率保留 通过；离线交付 · Info 完整列表、统计范围与倍率保留 通过

### 场景 GACHA_15：互斥关系和资源状态分别说明入口不可用原因

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='debug-open']"
2. `select` 定位 "[data-screen='debug'] [data-debug-field='mutualExclusionClear']"；值 "false"
3. `click` 定位 "[data-screen='debug'] [data-action='debug-apply']"
4. `click` 定位 "[data-screen='debug'] [data-action='debug-close']:not(.modal-close)"
5. `expectText` 定位 "[data-screen='entry'] .entry-caption"；值 "存在互斥活动"
6. `expectCount` 定位 "[data-screen='entry'] [data-action='entry-open']"；数量 0
7. `expectText` 定位 "[data-screen='entry'] .entry-unavailable"；值 "存在互斥活动"
8. `click` 定位 "[data-screen='entry'] [data-action='debug-open']"
9. `select` 定位 "[data-screen='debug'] [data-debug-field='mutualExclusionClear']"；值 "true"
10. `select` 定位 "[data-screen='debug'] [data-debug-field='resourcesReady']"；值 "false"
11. `click` 定位 "[data-screen='debug'] [data-action='debug-apply']"
12. `click` 定位 "[data-screen='debug'] [data-action='debug-close']:not(.modal-close)"
13. `expectText` 定位 "[data-screen='entry'] .entry-caption"；值 "活动资源尚未就绪"
14. `expectCount` 定位 "[data-screen='entry'] [data-action='entry-open']"；数量 0
15. `click` 定位 "[data-screen='entry'] [data-action='debug-open']"
16. `select` 定位 "[data-screen='debug'] [data-debug-field='resourcesReady']"；值 "true"
17. `click` 定位 "[data-screen='debug'] [data-action='debug-apply']"
18. `click` 定位 "[data-screen='debug'] [data-action='debug-close']:not(.modal-close)"
19. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
20. `expectVisible` 定位 "[data-screen='cover'] [data-action='cover-start']"

执行记录：平台预览 · 互斥关系和资源状态分别说明入口不可用原因 通过；离线交付 · 互斥关系和资源状态分别说明入口不可用原因 通过

### 场景 GACHA_20：关闭首次封面后重进仍触发首次引导且保留初始券

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
2. `expectVisible` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='cover'] .modal-header [data-action='cover-close']"
4. `expectVisible` 定位 "[data-screen='entry'] [data-action='entry-open']"
5. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
6. `expectCount` 定位 "[data-screen='cover']"；数量 0
7. `expectVisible` 定位 "[data-screen='guide'] [data-action='guide-next']"
8. `expectText` 定位 "[data-screen='guide'] .guide-progress"；值 "1 / 5"
9. `click` 定位 "[data-screen='guide'] .modal-header [data-action='guide-skip']"
10. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 3"
11. `click` 定位 "[data-screen='machine'] [data-action='machine-close']"
12. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
13. `expectCount` 定位 "[data-screen='guide']"；数量 0
14. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 3"

执行记录：平台预览 · 关闭首次封面后重进仍触发首次引导且保留初始券 通过；离线交付 · 关闭首次封面后重进仍触发首次引导且保留初始券 通过

## R09 · 正式截止立即停止Debug外部供券。到期时仍在活动内可继续消耗已有券和积分，二级页返回不算离开；主动离开或模拟重登后进入一次性结束结算。已达成未到账奖励补发，未领取的已达成品质奖励进入补发列表；结束弹窗先于补发弹窗。本期剩余券及积分清零，外发奖励账本保留。时间未确认时不执行不可逆操作或清理。

- 策划依据：9.2、10、12、14
- 可观察验收：在活动内将Debug时间调至截止后，验证抽取、领奖、兑换可继续而供券停止；关闭扭蛋机后看到结束及补发，重进不可继续；模拟时间不可确认时不能抽取、兑换或结算。
- 配置表：`ActivityConfig`、`ProgressNodes`、`UiCopy`
- 实现位置：没有匹配的源码证据，须人工定位
- 审查状态：pass

实现证据（当前源码原文）：

```text
settlement.js: `expired && inside` 允许继续会话；`beginSettlement` 先排结束弹窗，`finalizeSettlement` 清理本期资产。
```

### 场景 GACHA_11：时间未确认只读、到期停供与离开后一次性结算

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] [data-action='guide-skip']:not(.modal-close)"
4. `click` 定位 "[data-action='debug-open']"
5. `select` 定位 "[data-screen='debug'] [data-debug-field='timeTrusted']"；值 "false"
6. `click` 定位 "[data-screen='debug'] [data-action='debug-expire']"
7. `click` 定位 "[data-screen='debug'] [data-action='debug-close']:not(.modal-close)"
8. `expectDisabled` 定位 "[data-screen='machine'] [data-action='draw']"
9. `click` 定位 "[data-action='debug-open']"
10. `select` 定位 "[data-screen='debug'] [data-debug-field='timeTrusted']"；值 "true"
11. `click` 定位 "[data-screen='debug'] [data-action='debug-apply']"
12. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"
13. `expectText` 定位 "[data-screen='debug'] [data-debug-receipt]"；值 "外部供券已停止"
14. `click` 定位 "[data-screen='debug'] [data-action='debug-close']:not(.modal-close)"
15. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "3"
16. `click` 定位 "[data-action='draw']"
17. `click` 定位 "[data-action='feedback-skip']"
18. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
19. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "2"
20. `click` 定位 "[data-action='machine-close']"
21. `expectVisible` 定位 "[data-screen='ending'] [data-action='ending-confirm']:not(.modal-close)"
22. `click` 定位 "[data-screen='ending'] [data-action='ending-confirm']:not(.modal-close)"
23. `expectText` 定位 "[data-screen='entry'] .entry-unavailable"；值 "本期活动已结束"
24. `reload` 定位 "body"
25. `expectText` 定位 "[data-screen='entry'] .entry-unavailable"；值 "本期活动已结束"
26. `expectCount` 定位 "[data-screen='ending']"；数量 0

执行记录：平台预览 · 时间未确认只读、到期停供与离开后一次性结算 通过；离线交付 · 时间未确认只读、到期停供与离开后一次性结算 通过

### 场景 GACHA_12：到期会话保留商店操作，离开后按序展示结束与品质补发

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] [data-action='guide-skip']:not(.modal-close)"
4. `click` 定位 "[data-action='debug-open']"
5. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"；数量 8
6. `click` 定位 "[data-screen='debug'] [data-action='debug-close']:not(.modal-close)"
7. `click` 定位 "[data-action='tier-select'][data-tier-id='X10']"
8. `click` 定位 "[data-action='draw']"
9. `click` 定位 "[data-action='feedback-skip']"
10. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
11. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
12. `click` 定位 "[data-action='draw']"
13. `click` 定位 "[data-action='feedback-skip']"
14. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
15. `click` 定位 "[data-action='draw']"
16. `click` 定位 "[data-action='feedback-skip']"
17. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
18. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
19. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
20. `click` 定位 "[data-screen='shopUnlock'] [data-action='popup-close']:not(.modal-close)"
21. `click` 定位 "[data-action='draw']"
22. `click` 定位 "[data-action='feedback-skip']"
23. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
24. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"；数量 2
25. `click` 定位 "[data-action='collection-open']"
26. `expectText` 定位 "[data-screen='collection'] .collection-total"；值 "25/25"
27. `expectCount` 定位 "[data-screen='collection'] [data-action='claim-node'].can-claim"；数量 5
28. `click` 定位 "[data-screen='collection'] [data-action='panel-back']:not(.modal-close)"
29. `click` 定位 "[data-action='debug-open']"
30. `click` 定位 "[data-screen='debug'] [data-action='debug-expire']"
31. `click` 定位 "[data-screen='debug'] [data-action='debug-close']:not(.modal-close)"
32. `click` 定位 "[data-action='shop-open']"
33. `expectText` 定位 "[data-screen='shop'] .shop-balance"；值 "49"
34. `click` 定位 "[data-screen='shop'] [data-action='panel-back']:not(.modal-close)"
35. `click` 定位 "[data-action='machine-close']"
36. `expectText` 定位 "[data-screen='ending']"；值 "25/25"
37. `click` 定位 "[data-screen='ending'] [data-action='ending-confirm']:not(.modal-close)"
38. `expectVisible` 定位 "[data-screen='makeup'] [data-action='makeup-claim']"
39. `expectCount` 定位 "[data-screen='makeup'] .makeup-item"；数量 5
40. `click` 定位 "[data-screen='makeup'] [data-action='makeup-claim']"
41. `expectText` 定位 "[data-screen='makeup'] [data-action='makeup-claim']"；值 "完成结算"
42. `click` 定位 "[data-screen='makeup'] [data-action='makeup-claim']"
43. `expectText` 定位 "[data-screen='entry'] .entry-unavailable"；值 "本期活动已结束"
44. `reload` 定位 "body"
45. `expectCount` 定位 "[data-screen='makeup']"；数量 0
46. `expectText` 定位 "[data-screen='entry'] .entry-unavailable"；值 "本期活动已结束"

执行记录：平台预览 · 到期会话保留商店操作，离开后按序展示结束与品质补发 通过；离线交付 · 到期会话保留商店操作，离开后按序展示结束与品质补发 通过

### 场景 GACHA_18：结束后结算展示期内只读查看摘要

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] .modal-header [data-action='guide-skip']"
4. `click` 定位 "[data-screen='machine'] [data-action='debug-open']"
5. `click` 定位 "[data-screen='debug'] [data-action='debug-expire']"
6. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
7. `click` 定位 "[data-screen='machine'] [data-action='machine-close']"
8. `click` 定位 "[data-screen='ending'] .modal-actions [data-action='ending-confirm']"
9. `expectVisible` 定位 "[data-screen='entry'] [data-action='ending-summary-open']"
10. `click` 定位 "[data-screen='entry'] [data-action='ending-summary-open']"
11. `expectText` 定位 "[data-screen='endingSummary'] .modal-content"；值 "收藏完成"
12. `click` 定位 "[data-screen='endingSummary'] .modal-actions [data-action='ending-summary-close']"
13. `expectCount` 定位 "[data-screen='entry'] [data-action='entry-open']"；数量 0
14. `reload` 定位 "body"
15. `expectVisible` 定位 "[data-screen='entry'] [data-action='ending-summary-open']"

执行记录：平台预览 · 结束后结算展示期内只读查看摘要 通过；离线交付 · 结束后结算展示期内只读查看摘要 通过

### 场景 GACHA_23：时间待确认时刷新终止到期会话，确认后先显示结束弹窗

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] .modal-header [data-action='guide-skip']"
4. `click` 定位 "[data-screen='machine'] [data-action='debug-open']"
5. `select` 定位 "[data-screen='debug'] [data-debug-field='timeTrusted']"；值 "false"
6. `click` 定位 "[data-screen='debug'] [data-action='debug-expire']"
7. `reload` 定位 "body"
8. `expectCount` 定位 "[data-screen='machine'] [data-action='draw']"；数量 0
9. `click` 定位 "[data-screen='entry'] [data-action='debug-open']"
10. `select` 定位 "[data-screen='debug'] [data-debug-field='timeTrusted']"；值 "true"
11. `click` 定位 "[data-screen='debug'] [data-action='debug-apply']"
12. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
13. `expectVisible` 定位 "[data-screen='ending'] [data-action='ending-confirm']:not(.modal-close)"
14. `expectCount` 定位 "[data-screen='entry'] [data-action='entry-open']"；数量 0

执行记录：平台预览 · 时间待确认时刷新终止到期会话，确认后先显示结束弹窗 通过；离线交付 · 时间待确认时刷新终止到期会话，确认后先显示结束弹窗 通过

### 场景 GACHA_25：未集齐全部玩具仍可完成一次性结束结算并保留摘要

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] .modal-header [data-action='guide-skip']"
4. `click` 定位 "[data-screen='machine'] [data-action='draw']"
5. `click` 定位 "[data-action='feedback-skip']"
6. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
7. `click` 定位 "[data-screen='machine'] [data-action='debug-open']"
8. `click` 定位 "[data-screen='debug'] [data-action='debug-expire']"
9. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
10. `click` 定位 "[data-screen='machine'] [data-action='machine-close']"
11. `expectText` 定位 "[data-screen='ending'] .modal-content"；值 "1/25"
12. `click` 定位 "[data-screen='ending'] .modal-actions [data-action='ending-confirm']"
13. `click` 定位 "[data-screen='entry'] [data-action='ending-summary-open']"
14. `expectText` 定位 "[data-screen='endingSummary'] .modal-content"；值 "收藏完成 1/25"
15. `click` 定位 "[data-screen='endingSummary'] .modal-actions [data-action='ending-summary-close']"
16. `reload` 定位 "body"
17. `expectCount` 定位 "[data-screen='ending']"；数量 0

执行记录：平台预览 · 未集齐全部玩具仍可完成一次性结束结算并保留摘要 通过；离线交付 · 未集齐全部玩具仍可完成一次性结束结算并保留摘要 通过

### 场景 GACHA_30：结束弹窗期间重登及刷新仍能完成唯一一次结算

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] .modal-header [data-action='guide-skip']"
4. `click` 定位 "[data-screen='machine'] [data-action='debug-open']"
5. `click` 定位 "[data-screen='debug'] [data-action='debug-expire']"
6. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
7. `click` 定位 "[data-screen='machine'] [data-action='machine-close']"
8. `expectVisible` 定位 "[data-screen='ending'] .modal-actions [data-action='ending-confirm']"
9. `click` 定位 "[data-overlay-debug][data-action='debug-open']"
10. `click` 定位 "[data-screen='debug'] [data-action='debug-relogin']"
11. `expectVisible` 定位 "[data-screen='ending'] .modal-actions [data-action='ending-confirm']"
12. `reload` 定位 "body"
13. `expectVisible` 定位 "[data-screen='ending'] .modal-actions [data-action='ending-confirm']"
14. `click` 定位 "[data-screen='ending'] .modal-actions [data-action='ending-confirm']"
15. `expectText` 定位 "[data-screen='entry'] .entry-unavailable"；值 "本期活动已结束"
16. `reload` 定位 "body"
17. `expectCount` 定位 "[data-screen='ending']"；数量 0
18. `expectCount` 定位 "[data-screen='entry'] [data-action='entry-open']"；数量 0

执行记录：平台预览 · 结束弹窗期间重登及刷新仍能完成唯一一次结算 通过；离线交付 · 结束弹窗期间重登及刷新仍能完成唯一一次结算 通过

## R10 · 状态、规则、输入、渲染和反馈分区。为供券事件、抽取批次、阶段／收藏奖励及兑换事务保存唯一ID和已确认结果；先原子确认业务变化，再播放表现。弹窗队列同一时刻只展示一个；切页、中断、重复点击和恢复不得二次扣费、读序列或发奖。

- 策划依据：4、8.4、8.9—8.10、12
- 可观察验收：在抽取及兑换反馈期间重复点击、关闭弹层并模拟重进；核对每笔事务的消耗、序列位置、积分、领取状态与奖励账本仅变化一次；存档不可用时进入只读错误状态。
- 配置表：`ActivityConfig`、`GachaSequence`、`ProgressNodes`、`GachaShop`
- 实现位置：[src/state.js](../project/src/state.js) 第 234 行
- 审查状态：pass

实现证据（当前源码原文）：

```text
persistence.commit(draft)
```

### 场景 GACHA_09：全收藏后兑换：锁定、取消、扣分、积分不足与售罄

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] [data-action='guide-skip']:not(.modal-close)"
4. `click` 定位 "[data-action='shop-open']"
5. `click` 定位 "[data-screen='shop'] [data-item-id='SHOP01'] [data-action='exchange-open']"
6. `expectText` 定位 ".activity-toast"；值 "需要集齐全部收藏解锁兑换商城"
7. `click` 定位 "[data-screen='shop'] [data-action='panel-back']:not(.modal-close)"
8. `click` 定位 "[data-action='debug-open']"
9. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"；数量 9
10. `expectText` 定位 "[data-screen='debug'] [data-debug-receipt]"；值 "实际 5 张"
11. `click` 定位 "[data-screen='debug'] [data-action='debug-close']:not(.modal-close)"
12. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "48"
13. `click` 定位 "[data-action='tier-select'][data-tier-id='X10']"
14. `click` 定位 "[data-action='draw']"
15. `click` 定位 "[data-action='feedback-skip']"
16. `expectCount` 定位 "[data-screen='drawResult'] .result-item"；数量 10
17. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
18. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
19. `click` 定位 "[data-action='draw']"
20. `click` 定位 "[data-action='feedback-skip']"
21. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
22. `click` 定位 "[data-action='draw']"
23. `click` 定位 "[data-action='feedback-skip']"
24. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
25. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
26. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
27. `expectVisible` 定位 "[data-screen='shopUnlock'] [data-action='popup-close']:not(.modal-close)"
28. `click` 定位 "[data-screen='shopUnlock'] [data-action='popup-close']:not(.modal-close)"
29. `click` 定位 "[data-action='draw']"
30. `click` 定位 "[data-action='feedback-skip']"
31. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
32. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"；数量 2
33. `expectText` 定位 "[data-screen='machine'] .progress-heading"；值 "49"
34. `click` 定位 "[data-action='shop-open']"
35. `expectText` 定位 "[data-screen='shop'] .shop-balance"；值 "49"
36. `click` 定位 "[data-screen='shop'] [data-item-id='SHOP03'] [data-action='exchange-open']"
37. `expectVisible` 定位 "[data-screen='exchangeConfirm'] [data-action='exchange-confirm']"
38. `click` 定位 "[data-screen='exchangeConfirm'] [data-action='exchange-cancel']:not(.modal-close)"
39. `expectText` 定位 "[data-screen='shop'] .shop-balance"；值 "49"
40. `click` 定位 "[data-screen='shop'] [data-item-id='SHOP03'] [data-action='exchange-open']"
41. `click` 定位 "[data-screen='exchangeConfirm'] [data-action='exchange-confirm']"
42. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
43. `expectText` 定位 "[data-screen='shop'] .shop-balance"；值 "24"
44. `expectText` 定位 "[data-screen='shop'] article[data-item-id='SHOP03']"；值 "已售罄"
45. `click` 定位 "[data-screen='shop'] [data-item-id='SHOP03'] [data-action='exchange-open']"
46. `expectText` 定位 ".activity-toast"；值 "已售罄"
47. `click` 定位 "[data-screen='shop'] [data-item-id='SHOP02'] [data-action='exchange-open']"
48. `click` 定位 "[data-screen='exchangeConfirm'] [data-action='exchange-confirm']"
49. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
50. `click` 定位 "[data-screen='shop'] [data-item-id='SHOP02'] [data-action='exchange-open']"
51. `click` 定位 "[data-screen='exchangeConfirm'] [data-action='exchange-confirm']"
52. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
53. `expectText` 定位 "[data-screen='shop'] .shop-balance"；值 "4"
54. `click` 定位 "[data-screen='shop'] [data-item-id='SHOP02'] [data-action='exchange-open']"
55. `expectText` 定位 ".activity-toast"；值 "积分不足，请继续扭蛋获取"
56. `click` 定位 "[data-screen='shop'] [data-action='panel-back']:not(.modal-close)"
57. `expectText` 定位 "[data-screen='machine'] .progress-heading"；值 "累计积分 49"
58. `click` 定位 "[data-action='debug-open']"
59. `expectText` 定位 "[data-screen='debug'] .debug-section:nth-of-type(5) .debug-log"；值 "节点 PT01"
60. `expectText` 定位 "[data-screen='debug'] .debug-section:nth-of-type(6) .debug-log"；值 "模拟待领奖"

执行记录：平台预览 · 全收藏后兑换：锁定、取消、扣分、积分不足与售罄 通过；离线交付 · 全收藏后兑换：锁定、取消、扣分、积分不足与售罄 通过

### 场景 GACHA_10：供券事件去重与已确认抽取刷新恢复

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] [data-action='guide-skip']:not(.modal-close)"
4. `click` 定位 "[data-action='debug-open']"
5. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"
6. `click` 定位 "[data-screen='debug'] [data-action='debug-replay']"
7. `expectText` 定位 "[data-screen='debug'] [data-debug-receipt]"；值 "不重复发券"
8. `click` 定位 "[data-screen='debug'] [data-action='debug-close']:not(.modal-close)"
9. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "8"
10. `click` 定位 "[data-action='draw']"
11. `click` 定位 "[data-action='feedback-skip']"
12. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "7"
13. `reload` 定位 "body"
14. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "7"
15. `expectCount` 定位 "[data-screen='drawResult'] .result-item"；数量 1
16. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
17. `click` 定位 "[data-action='draw']"
18. `click` 定位 "[data-action='feedback-skip']"
19. `expectText` 定位 "[data-screen='drawResult'] .duplicate-points"；值 "重复 +1 积分"
20. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
21. `expectVisible` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
22. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
23. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "6"
24. `expectText` 定位 "[data-screen='machine'] .progress-heading"；值 "累计积分 1"

执行记录：平台预览 · 供券事件去重与已确认抽取刷新恢复 通过；离线交付 · 供券事件去重与已确认抽取刷新恢复 通过

### 场景 GACHA_11：时间未确认只读、到期停供与离开后一次性结算

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] [data-action='guide-skip']:not(.modal-close)"
4. `click` 定位 "[data-action='debug-open']"
5. `select` 定位 "[data-screen='debug'] [data-debug-field='timeTrusted']"；值 "false"
6. `click` 定位 "[data-screen='debug'] [data-action='debug-expire']"
7. `click` 定位 "[data-screen='debug'] [data-action='debug-close']:not(.modal-close)"
8. `expectDisabled` 定位 "[data-screen='machine'] [data-action='draw']"
9. `click` 定位 "[data-action='debug-open']"
10. `select` 定位 "[data-screen='debug'] [data-debug-field='timeTrusted']"；值 "true"
11. `click` 定位 "[data-screen='debug'] [data-action='debug-apply']"
12. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"
13. `expectText` 定位 "[data-screen='debug'] [data-debug-receipt]"；值 "外部供券已停止"
14. `click` 定位 "[data-screen='debug'] [data-action='debug-close']:not(.modal-close)"
15. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "3"
16. `click` 定位 "[data-action='draw']"
17. `click` 定位 "[data-action='feedback-skip']"
18. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
19. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "2"
20. `click` 定位 "[data-action='machine-close']"
21. `expectVisible` 定位 "[data-screen='ending'] [data-action='ending-confirm']:not(.modal-close)"
22. `click` 定位 "[data-screen='ending'] [data-action='ending-confirm']:not(.modal-close)"
23. `expectText` 定位 "[data-screen='entry'] .entry-unavailable"；值 "本期活动已结束"
24. `reload` 定位 "body"
25. `expectText` 定位 "[data-screen='entry'] .entry-unavailable"；值 "本期活动已结束"
26. `expectCount` 定位 "[data-screen='ending']"；数量 0

执行记录：平台预览 · 时间未确认只读、到期停供与离开后一次性结算 通过；离线交付 · 时间未确认只读、到期停供与离开后一次性结算 通过

### 场景 GACHA_12：到期会话保留商店操作，离开后按序展示结束与品质补发

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] [data-action='guide-skip']:not(.modal-close)"
4. `click` 定位 "[data-action='debug-open']"
5. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"；数量 8
6. `click` 定位 "[data-screen='debug'] [data-action='debug-close']:not(.modal-close)"
7. `click` 定位 "[data-action='tier-select'][data-tier-id='X10']"
8. `click` 定位 "[data-action='draw']"
9. `click` 定位 "[data-action='feedback-skip']"
10. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
11. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
12. `click` 定位 "[data-action='draw']"
13. `click` 定位 "[data-action='feedback-skip']"
14. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
15. `click` 定位 "[data-action='draw']"
16. `click` 定位 "[data-action='feedback-skip']"
17. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
18. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
19. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
20. `click` 定位 "[data-screen='shopUnlock'] [data-action='popup-close']:not(.modal-close)"
21. `click` 定位 "[data-action='draw']"
22. `click` 定位 "[data-action='feedback-skip']"
23. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
24. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"；数量 2
25. `click` 定位 "[data-action='collection-open']"
26. `expectText` 定位 "[data-screen='collection'] .collection-total"；值 "25/25"
27. `expectCount` 定位 "[data-screen='collection'] [data-action='claim-node'].can-claim"；数量 5
28. `click` 定位 "[data-screen='collection'] [data-action='panel-back']:not(.modal-close)"
29. `click` 定位 "[data-action='debug-open']"
30. `click` 定位 "[data-screen='debug'] [data-action='debug-expire']"
31. `click` 定位 "[data-screen='debug'] [data-action='debug-close']:not(.modal-close)"
32. `click` 定位 "[data-action='shop-open']"
33. `expectText` 定位 "[data-screen='shop'] .shop-balance"；值 "49"
34. `click` 定位 "[data-screen='shop'] [data-action='panel-back']:not(.modal-close)"
35. `click` 定位 "[data-action='machine-close']"
36. `expectText` 定位 "[data-screen='ending']"；值 "25/25"
37. `click` 定位 "[data-screen='ending'] [data-action='ending-confirm']:not(.modal-close)"
38. `expectVisible` 定位 "[data-screen='makeup'] [data-action='makeup-claim']"
39. `expectCount` 定位 "[data-screen='makeup'] .makeup-item"；数量 5
40. `click` 定位 "[data-screen='makeup'] [data-action='makeup-claim']"
41. `expectText` 定位 "[data-screen='makeup'] [data-action='makeup-claim']"；值 "完成结算"
42. `click` 定位 "[data-screen='makeup'] [data-action='makeup-claim']"
43. `expectText` 定位 "[data-screen='entry'] .entry-unavailable"；值 "本期活动已结束"
44. `reload` 定位 "body"
45. `expectCount` 定位 "[data-screen='makeup']"；数量 0
46. `expectText` 定位 "[data-screen='entry'] .entry-unavailable"；值 "本期活动已结束"

执行记录：平台预览 · 到期会话保留商店操作，离开后按序展示结束与品质补发 通过；离线交付 · 到期会话保留商店操作，离开后按序展示结束与品质补发 通过

### 场景 GACHA_14：刷新后再次供券和抽取仍使用新的事务ID

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] [data-action='guide-skip']:not(.modal-close)"
4. `click` 定位 "[data-action='debug-open']"
5. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"
6. `click` 定位 "[data-screen='debug'] [data-action='debug-close']:not(.modal-close)"
7. `expectText` 定位 ".ticket-pill"；值 "扭蛋券 8"
8. `reload` 定位 "body"
9. `click` 定位 "[data-action='debug-open']"
10. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"
11. `click` 定位 "[data-screen='debug'] [data-action='debug-close']:not(.modal-close)"
12. `expectText` 定位 ".ticket-pill"；值 "扭蛋券 13"
13. `click` 定位 "[data-action='draw']"
14. `click` 定位 "[data-action='feedback-skip']"
15. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
16. `expectText` 定位 ".ticket-pill"；值 "扭蛋券 12"
17. `reload` 定位 "body"
18. `click` 定位 "[data-action='draw']"
19. `click` 定位 "[data-action='feedback-skip']"
20. `expectText` 定位 "[data-screen='drawResult'] .duplicate-points"；值 "重复 +1 积分"
21. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
22. `expectVisible` 定位 "[data-screen='claim']"
23. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
24. `expectText` 定位 ".ticket-pill"；值 "扭蛋券 11"
25. `expectText` 定位 ".progress-heading"；值 "累计积分 1"

执行记录：平台预览 · 刷新后再次供券和抽取仍使用新的事务ID 通过；离线交付 · 刷新后再次供券和抽取仍使用新的事务ID 通过

### 场景 GACHA_16：兑换确认弹窗不可越过未处理的抽取结果

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] [data-action='guide-skip']:not(.modal-close)"
4. `click` 定位 "[data-action='draw']"
5. `click` 定位 "[data-action='feedback-skip']"
6. `expectCount` 定位 "[data-screen='drawResult'] .result-item"；数量 1
7. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 2"
8. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
9. `click` 定位 "[data-action='shop-open']"
10. `click` 定位 "[data-screen='shop'] [data-item-id='SHOP01'] [data-action='exchange-open']"
11. `expectText` 定位 ".activity-toast"；值 "需要集齐全部收藏解锁兑换商城"
12. `expectText` 定位 "[data-screen='shop'] .shop-balance"；值 "0"

执行记录：平台预览 · 兑换确认弹窗不可越过未处理的抽取结果 通过；离线交付 · 兑换确认弹窗不可越过未处理的抽取结果 通过

### 场景 GACHA_19：首次进入前供券与初始券累加，刷新及重放均不丢券

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='debug-open']"
2. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"
3. `expectText` 定位 "[data-screen='debug'] [data-debug-receipt]"；值 "实际 5 张"
4. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
5. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
6. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
7. `click` 定位 "[data-screen='guide'] .modal-header [data-action='guide-skip']"
8. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 8"
9. `reload` 定位 "body"
10. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 8"
11. `click` 定位 "[data-screen='machine'] [data-action='debug-open']"
12. `expectText` 定位 "[data-screen='debug'] .debug-section:has(h3:has-text('本地事件日志')) .debug-log"；值 "supply_granted"
13. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
14. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 8"

执行记录：平台预览 · 首次进入前供券与初始券累加，刷新及重放均不丢券 通过；离线交付 · 首次进入前供券与初始券累加，刷新及重放均不丢券 通过

### 场景 GACHA_21：零发券的已结算生成器事件跨活动日重放仍去重

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] .modal-header [data-action='guide-skip']"
4. `click` 定位 "[data-screen='machine'] [data-action='debug-open']"
5. `click` 定位 "[data-screen='debug'] [data-action='debug-generator-miss']"
6. `expectText` 定位 "[data-screen='debug'] [data-debug-receipt]"；值 "实际 0 张"
7. `fill` 定位 "[data-screen='debug'] [data-debug-field='serverTime']"；值 "2026-09-30T04:00:00+08:00"
8. `click` 定位 "[data-screen='debug'] [data-action='debug-apply']"
9. `click` 定位 "[data-screen='debug'] [data-action='debug-replay']"
10. `expectText` 定位 "[data-screen='debug'] [data-debug-receipt]"；值 "不重复发券"
11. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
12. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 3"

执行记录：平台预览 · 零发券的已结算生成器事件跨活动日重放仍去重 通过；离线交付 · 零发券的已结算生成器事件跨活动日重放仍去重 通过

### 场景 GACHA_22：模拟存档故障后仍能浏览收藏、Info 与事件账本，抽取保持禁用

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] .modal-header [data-action='guide-skip']"
4. `click` 定位 "[data-screen='machine'] [data-action='debug-open']"
5. `click` 定位 "[data-screen='debug'] [data-action='debug-storage-fail']"
6. `expectText` 定位 "[data-screen='debug'] [data-save-warning]"；值 "活动存档暂不可用"
7. `expectVisible` 定位 "[data-screen='debug'] .debug-section:has(h3:has-text('奖励账本'))"
8. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
9. `expectDisabled` 定位 "[data-screen='machine'] [data-action='draw']"
10. `click` 定位 "[data-screen='machine'] [data-action='collection-open']"
11. `expectCount` 定位 "[data-screen='collection'] .toy-tile.is-locked"；数量 25
12. `click` 定位 "[data-screen='collection'] .modal-header [data-action='panel-back']"
13. `click` 定位 "[data-screen='machine'] [data-action='info-open']"
14. `expectCount` 定位 "[data-screen='info'] .share-row .toy-art"；数量 25
15. `click` 定位 "[data-screen='info'] .modal-header [data-action='panel-back']"
16. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 3"

执行记录：平台预览 · 模拟存档故障后仍能浏览收藏、Info 与事件账本，抽取保持禁用 通过；离线交付 · 模拟存档故障后仍能浏览收藏、Info 与事件账本，抽取保持禁用 通过

### 场景 GACHA_23：时间待确认时刷新终止到期会话，确认后先显示结束弹窗

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] .modal-header [data-action='guide-skip']"
4. `click` 定位 "[data-screen='machine'] [data-action='debug-open']"
5. `select` 定位 "[data-screen='debug'] [data-debug-field='timeTrusted']"；值 "false"
6. `click` 定位 "[data-screen='debug'] [data-action='debug-expire']"
7. `reload` 定位 "body"
8. `expectCount` 定位 "[data-screen='machine'] [data-action='draw']"；数量 0
9. `click` 定位 "[data-screen='entry'] [data-action='debug-open']"
10. `select` 定位 "[data-screen='debug'] [data-debug-field='timeTrusted']"；值 "true"
11. `click` 定位 "[data-screen='debug'] [data-action='debug-apply']"
12. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
13. `expectVisible` 定位 "[data-screen='ending'] [data-action='ending-confirm']:not(.modal-close)"
14. `expectCount` 定位 "[data-screen='entry'] [data-action='entry-open']"；数量 0

执行记录：平台预览 · 时间待确认时刷新终止到期会话，确认后先显示结束弹窗 通过；离线交付 · 时间待确认时刷新终止到期会话，确认后先显示结束弹窗 通过

### 场景 GACHA_24：抽取结果未收下时不丢失队列，关闭后恢复机台

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] .modal-header [data-action='guide-skip']"
4. `click` 定位 "[data-screen='machine'] [data-action='draw']"
5. `click` 定位 "[data-action='feedback-skip']"
6. `expectCount` 定位 "[data-screen='drawResult'] .result-item"；数量 1
7. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 2"
8. `reload` 定位 "body"
9. `expectCount` 定位 "[data-screen='drawResult'] .result-item"；数量 1
10. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 2"
11. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
12. `expectVisible` 定位 "[data-screen='machine'] [data-action='draw']"

执行记录：平台预览 · 抽取结果未收下时不丢失队列，关闭后恢复机台 通过；离线交付 · 抽取结果未收下时不丢失队列，关闭后恢复机台 通过

### 场景 GACHA_26：已确认兑换结果刷新后仍可收下，且不会重复扣分到账

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] .modal-header [data-action='guide-skip']"
4. `click` 定位 "[data-screen='machine'] [data-action='debug-open']"
5. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"；数量 9
6. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
7. `click` 定位 "[data-action='tier-select'][data-tier-id='X10']"
8. `click` 定位 "[data-action='draw']"
9. `click` 定位 "[data-action='feedback-skip']"
10. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
11. `click` 定位 "[data-screen='claim'] .modal-actions [data-action='popup-close']"
12. `click` 定位 "[data-action='draw']"
13. `click` 定位 "[data-action='feedback-skip']"
14. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
15. `click` 定位 "[data-action='draw']"
16. `click` 定位 "[data-action='feedback-skip']"
17. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
18. `click` 定位 "[data-screen='claim'] .modal-actions [data-action='popup-close']"；数量 2
19. `click` 定位 "[data-screen='shopUnlock'] .modal-actions [data-action='popup-close']"
20. `click` 定位 "[data-action='draw']"
21. `click` 定位 "[data-action='feedback-skip']"
22. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
23. `click` 定位 "[data-screen='claim'] .modal-actions [data-action='popup-close']"；数量 2
24. `expectText` 定位 "[data-screen='machine'] .progress-heading"；值 "累计积分 49"
25. `click` 定位 "[data-action='shop-open']"
26. `click` 定位 "[data-screen='shop'] [data-item-id='SHOP01'] [data-action='exchange-open']"
27. `expectVisible` 定位 "[data-screen='exchangeConfirm'] [data-action='exchange-confirm']"
28. `click` 定位 "[data-screen='exchangeConfirm'] [data-action='exchange-confirm']"
29. `expectVisible` 定位 "[data-screen='claim'] .modal-content"
30. `reload` 定位 "body"
31. `expectText` 定位 "[data-screen='claim'] .modal-content"；值 "兑换已确认"
32. `click` 定位 "[data-screen='claim'] .modal-actions [data-action='popup-close']"
33. `expectText` 定位 "[data-screen='shop'] .shop-balance"；值 "46"
34. `expectText` 定位 "[data-screen='machine'] .progress-heading"；值 "累计积分 49"
35. `expectText` 定位 "[data-screen='shop'] article[data-item-id='SHOP01']"；值 "不限次数"

执行记录：平台预览 · 已确认兑换结果刷新后仍可收下，且不会重复扣分到账 通过；离线交付 · 已确认兑换结果刷新后仍可收下，且不会重复扣分到账 通过

### 场景 GACHA_27：封面、收藏和商店弹层上方可操作 Debug，返回后原页面与队列保留

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
2. `expectVisible` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-overlay-debug][data-action='debug-open']"
4. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"
5. `expectText` 定位 "[data-screen='debug'] [data-debug-receipt]"；值 "实际 5 张"
6. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
7. `expectVisible` 定位 "[data-screen='cover'] [data-action='cover-start']"
8. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
9. `click` 定位 "[data-screen='guide'] .modal-header [data-action='guide-skip']"
10. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 8"
11. `click` 定位 "[data-screen='machine'] [data-action='collection-open']"
12. `click` 定位 "[data-overlay-debug][data-action='debug-open']"
13. `click` 定位 "[data-screen='debug'] [data-action='debug-generator-hit']"
14. `expectText` 定位 "[data-screen='debug'] [data-debug-receipt]"；值 "实际 2 张"
15. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
16. `expectText` 定位 "[data-screen='collection'] .collection-total"；值 "0/25"
17. `click` 定位 "[data-screen='collection'] .modal-header [data-action='panel-back']"
18. `click` 定位 "[data-screen='machine'] [data-action='shop-open']"
19. `click` 定位 "[data-overlay-debug][data-action='debug-open']"
20. `expectVisible` 定位 "[data-screen='debug'] [data-action='debug-order-success']"
21. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
22. `expectText` 定位 "[data-screen='shop'] .shop-note"；值 "需要集齐全部收藏解锁兑换商城"
23. `click` 定位 "[data-screen='shop'] .modal-header [data-action='panel-back']"
24. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 10"

执行记录：平台预览 · 封面、收藏和商店弹层上方可操作 Debug，返回后原页面与队列保留 通过；离线交付 · 封面、收藏和商店弹层上方可操作 Debug，返回后原页面与队列保留 通过

### 场景 GACHA_28：抽取结果弹层上方的 Debug 不跳过已确认结果

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] .modal-header [data-action='guide-skip']"
4. `click` 定位 "[data-screen='machine'] [data-action='draw']"
5. `click` 定位 "[data-action='feedback-skip']"
6. `expectCount` 定位 "[data-screen='drawResult'] .result-item"；数量 1
7. `click` 定位 "[data-overlay-debug][data-action='debug-open']"
8. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"
9. `expectText` 定位 "[data-screen='debug'] [data-debug-receipt]"；值 "实际 5 张"
10. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
11. `expectCount` 定位 "[data-screen='drawResult'] .result-item"；数量 1
12. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 7"
13. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
14. `expectVisible` 定位 "[data-screen='machine'] [data-action='draw']"

执行记录：平台预览 · 抽取结果弹层上方的 Debug 不跳过已确认结果 通过；离线交付 · 抽取结果弹层上方的 Debug 不跳过已确认结果 通过

### 场景 GACHA_30：结束弹窗期间重登及刷新仍能完成唯一一次结算

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] .modal-header [data-action='guide-skip']"
4. `click` 定位 "[data-screen='machine'] [data-action='debug-open']"
5. `click` 定位 "[data-screen='debug'] [data-action='debug-expire']"
6. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
7. `click` 定位 "[data-screen='machine'] [data-action='machine-close']"
8. `expectVisible` 定位 "[data-screen='ending'] .modal-actions [data-action='ending-confirm']"
9. `click` 定位 "[data-overlay-debug][data-action='debug-open']"
10. `click` 定位 "[data-screen='debug'] [data-action='debug-relogin']"
11. `expectVisible` 定位 "[data-screen='ending'] .modal-actions [data-action='ending-confirm']"
12. `reload` 定位 "body"
13. `expectVisible` 定位 "[data-screen='ending'] .modal-actions [data-action='ending-confirm']"
14. `click` 定位 "[data-screen='ending'] .modal-actions [data-action='ending-confirm']"
15. `expectText` 定位 "[data-screen='entry'] .entry-unavailable"；值 "本期活动已结束"
16. `reload` 定位 "body"
17. `expectCount` 定位 "[data-screen='ending']"；数量 0
18. `expectCount` 定位 "[data-screen='entry'] [data-action='entry-open']"；数量 0

执行记录：平台预览 · 结束弹窗期间重登及刷新仍能完成唯一一次结算 通过；离线交付 · 结束弹窗期间重登及刷新仍能完成唯一一次结算 通过

### 场景 GACHA_32：重复玩具积分叠在压暗藏品上，收下后汇入机台上方进度条

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] .modal-header [data-action='guide-skip']"
4. `click` 定位 "[data-screen='machine'] [data-action='tier-select'][data-tier-id='X3']"
5. `click` 定位 "[data-screen='machine'] [data-action='draw']"
6. `click` 定位 "[data-action='feedback-skip']"
7. `expectCount` 定位 "[data-screen='drawResult'] .result-item"；数量 3
8. `expectCount` 定位 "[data-screen='drawResult'] .result-item.is-duplicate"；数量 1
9. `expectText` 定位 "[data-screen='drawResult'] .result-item.is-duplicate .result-art .duplicate-points"；值 "+1 积分"
10. `expectText` 定位 "[data-screen='machine'] .progress-heading"；值 "累计积分 1"
11. `click` 定位 "[data-screen='drawResult'] .modal-actions [data-action='result-close']"
12. `expectText` 定位 "[data-screen='machine'] .point-flight-status"；值 "重复积分 +1 已汇入进度条"
13. `expectText` 定位 "[data-screen='machine'] .available-points"；值 "可用积分 1"
14. `expectText` 定位 "[data-screen='claim'] .modal-header"；值 "累计1分"

执行记录：平台预览 · 重复玩具积分叠在压暗藏品上，收下后汇入机台上方进度条 通过；离线交付 · 重复玩具积分叠在压暗藏品上，收下后汇入机台上方进度条 通过

## R11 · 按平台契约上报本期初始化、Debug供券成功／拒绝、抽取确认、首次收藏、阶段达成、品质领奖、全收藏、兑换确认、正式截止和结束结算等主进度事件。离线预览记录本地事件日志，不依赖网络。

- 策划依据：6—10、13
- 可观察验收：完成一轮抽取、收藏、领奖、兑换和结算后，在Debug事件日志查看事件ID、期次、进度节点、结果和去重状态；不得出现任何主线玩法页面。
- 配置表：`ActivityConfig`、`ProgressNodes`、`UiCopy`
- 实现位置：没有匹配的源码证据，须人工定位
- 审查状态：fail

实现证据（当前源码原文）：

```text
state.js 的 `DEBUG_SET` 仅记录 `debug_state_updated`；从开放跨入正式截止时没有独立、一次性的截止事件。
```

### 场景 GACHA_09：全收藏后兑换：锁定、取消、扣分、积分不足与售罄

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] [data-action='guide-skip']:not(.modal-close)"
4. `click` 定位 "[data-action='shop-open']"
5. `click` 定位 "[data-screen='shop'] [data-item-id='SHOP01'] [data-action='exchange-open']"
6. `expectText` 定位 ".activity-toast"；值 "需要集齐全部收藏解锁兑换商城"
7. `click` 定位 "[data-screen='shop'] [data-action='panel-back']:not(.modal-close)"
8. `click` 定位 "[data-action='debug-open']"
9. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"；数量 9
10. `expectText` 定位 "[data-screen='debug'] [data-debug-receipt]"；值 "实际 5 张"
11. `click` 定位 "[data-screen='debug'] [data-action='debug-close']:not(.modal-close)"
12. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "48"
13. `click` 定位 "[data-action='tier-select'][data-tier-id='X10']"
14. `click` 定位 "[data-action='draw']"
15. `click` 定位 "[data-action='feedback-skip']"
16. `expectCount` 定位 "[data-screen='drawResult'] .result-item"；数量 10
17. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
18. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
19. `click` 定位 "[data-action='draw']"
20. `click` 定位 "[data-action='feedback-skip']"
21. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
22. `click` 定位 "[data-action='draw']"
23. `click` 定位 "[data-action='feedback-skip']"
24. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
25. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
26. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
27. `expectVisible` 定位 "[data-screen='shopUnlock'] [data-action='popup-close']:not(.modal-close)"
28. `click` 定位 "[data-screen='shopUnlock'] [data-action='popup-close']:not(.modal-close)"
29. `click` 定位 "[data-action='draw']"
30. `click` 定位 "[data-action='feedback-skip']"
31. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
32. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"；数量 2
33. `expectText` 定位 "[data-screen='machine'] .progress-heading"；值 "49"
34. `click` 定位 "[data-action='shop-open']"
35. `expectText` 定位 "[data-screen='shop'] .shop-balance"；值 "49"
36. `click` 定位 "[data-screen='shop'] [data-item-id='SHOP03'] [data-action='exchange-open']"
37. `expectVisible` 定位 "[data-screen='exchangeConfirm'] [data-action='exchange-confirm']"
38. `click` 定位 "[data-screen='exchangeConfirm'] [data-action='exchange-cancel']:not(.modal-close)"
39. `expectText` 定位 "[data-screen='shop'] .shop-balance"；值 "49"
40. `click` 定位 "[data-screen='shop'] [data-item-id='SHOP03'] [data-action='exchange-open']"
41. `click` 定位 "[data-screen='exchangeConfirm'] [data-action='exchange-confirm']"
42. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
43. `expectText` 定位 "[data-screen='shop'] .shop-balance"；值 "24"
44. `expectText` 定位 "[data-screen='shop'] article[data-item-id='SHOP03']"；值 "已售罄"
45. `click` 定位 "[data-screen='shop'] [data-item-id='SHOP03'] [data-action='exchange-open']"
46. `expectText` 定位 ".activity-toast"；值 "已售罄"
47. `click` 定位 "[data-screen='shop'] [data-item-id='SHOP02'] [data-action='exchange-open']"
48. `click` 定位 "[data-screen='exchangeConfirm'] [data-action='exchange-confirm']"
49. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
50. `click` 定位 "[data-screen='shop'] [data-item-id='SHOP02'] [data-action='exchange-open']"
51. `click` 定位 "[data-screen='exchangeConfirm'] [data-action='exchange-confirm']"
52. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
53. `expectText` 定位 "[data-screen='shop'] .shop-balance"；值 "4"
54. `click` 定位 "[data-screen='shop'] [data-item-id='SHOP02'] [data-action='exchange-open']"
55. `expectText` 定位 ".activity-toast"；值 "积分不足，请继续扭蛋获取"
56. `click` 定位 "[data-screen='shop'] [data-action='panel-back']:not(.modal-close)"
57. `expectText` 定位 "[data-screen='machine'] .progress-heading"；值 "累计积分 49"
58. `click` 定位 "[data-action='debug-open']"
59. `expectText` 定位 "[data-screen='debug'] .debug-section:nth-of-type(5) .debug-log"；值 "节点 PT01"
60. `expectText` 定位 "[data-screen='debug'] .debug-section:nth-of-type(6) .debug-log"；值 "模拟待领奖"

执行记录：平台预览 · 全收藏后兑换：锁定、取消、扣分、积分不足与售罄 通过；离线交付 · 全收藏后兑换：锁定、取消、扣分、积分不足与售罄 通过

### 场景 GACHA_10：供券事件去重与已确认抽取刷新恢复

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] [data-action='guide-skip']:not(.modal-close)"
4. `click` 定位 "[data-action='debug-open']"
5. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"
6. `click` 定位 "[data-screen='debug'] [data-action='debug-replay']"
7. `expectText` 定位 "[data-screen='debug'] [data-debug-receipt]"；值 "不重复发券"
8. `click` 定位 "[data-screen='debug'] [data-action='debug-close']:not(.modal-close)"
9. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "8"
10. `click` 定位 "[data-action='draw']"
11. `click` 定位 "[data-action='feedback-skip']"
12. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "7"
13. `reload` 定位 "body"
14. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "7"
15. `expectCount` 定位 "[data-screen='drawResult'] .result-item"；数量 1
16. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
17. `click` 定位 "[data-action='draw']"
18. `click` 定位 "[data-action='feedback-skip']"
19. `expectText` 定位 "[data-screen='drawResult'] .duplicate-points"；值 "重复 +1 积分"
20. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
21. `expectVisible` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
22. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
23. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "6"
24. `expectText` 定位 "[data-screen='machine'] .progress-heading"；值 "累计积分 1"

执行记录：平台预览 · 供券事件去重与已确认抽取刷新恢复 通过；离线交付 · 供券事件去重与已确认抽取刷新恢复 通过

### 场景 GACHA_12：到期会话保留商店操作，离开后按序展示结束与品质补发

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] [data-action='guide-skip']:not(.modal-close)"
4. `click` 定位 "[data-action='debug-open']"
5. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"；数量 8
6. `click` 定位 "[data-screen='debug'] [data-action='debug-close']:not(.modal-close)"
7. `click` 定位 "[data-action='tier-select'][data-tier-id='X10']"
8. `click` 定位 "[data-action='draw']"
9. `click` 定位 "[data-action='feedback-skip']"
10. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
11. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
12. `click` 定位 "[data-action='draw']"
13. `click` 定位 "[data-action='feedback-skip']"
14. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
15. `click` 定位 "[data-action='draw']"
16. `click` 定位 "[data-action='feedback-skip']"
17. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
18. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
19. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
20. `click` 定位 "[data-screen='shopUnlock'] [data-action='popup-close']:not(.modal-close)"
21. `click` 定位 "[data-action='draw']"
22. `click` 定位 "[data-action='feedback-skip']"
23. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
24. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"；数量 2
25. `click` 定位 "[data-action='collection-open']"
26. `expectText` 定位 "[data-screen='collection'] .collection-total"；值 "25/25"
27. `expectCount` 定位 "[data-screen='collection'] [data-action='claim-node'].can-claim"；数量 5
28. `click` 定位 "[data-screen='collection'] [data-action='panel-back']:not(.modal-close)"
29. `click` 定位 "[data-action='debug-open']"
30. `click` 定位 "[data-screen='debug'] [data-action='debug-expire']"
31. `click` 定位 "[data-screen='debug'] [data-action='debug-close']:not(.modal-close)"
32. `click` 定位 "[data-action='shop-open']"
33. `expectText` 定位 "[data-screen='shop'] .shop-balance"；值 "49"
34. `click` 定位 "[data-screen='shop'] [data-action='panel-back']:not(.modal-close)"
35. `click` 定位 "[data-action='machine-close']"
36. `expectText` 定位 "[data-screen='ending']"；值 "25/25"
37. `click` 定位 "[data-screen='ending'] [data-action='ending-confirm']:not(.modal-close)"
38. `expectVisible` 定位 "[data-screen='makeup'] [data-action='makeup-claim']"
39. `expectCount` 定位 "[data-screen='makeup'] .makeup-item"；数量 5
40. `click` 定位 "[data-screen='makeup'] [data-action='makeup-claim']"
41. `expectText` 定位 "[data-screen='makeup'] [data-action='makeup-claim']"；值 "完成结算"
42. `click` 定位 "[data-screen='makeup'] [data-action='makeup-claim']"
43. `expectText` 定位 "[data-screen='entry'] .entry-unavailable"；值 "本期活动已结束"
44. `reload` 定位 "body"
45. `expectCount` 定位 "[data-screen='makeup']"；数量 0
46. `expectText` 定位 "[data-screen='entry'] .entry-unavailable"；值 "本期活动已结束"

执行记录：平台预览 · 到期会话保留商店操作，离开后按序展示结束与品质补发 通过；离线交付 · 到期会话保留商店操作，离开后按序展示结束与品质补发 通过

### 场景 GACHA_13：供券拒绝写入本地日志且不改变券余额，重复玩具达成首个阶段节点

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] [data-action='guide-skip']:not(.modal-close)"
4. `click` 定位 "[data-screen='machine'] [data-action='debug-open']"
5. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"
6. `click` 定位 "[data-screen='debug'] [data-action='debug-replay']"
7. `expectText` 定位 "[data-screen='debug'] [data-debug-receipt]"；值 "去重"
8. `expectText` 定位 "[data-screen='debug'] .debug-section:nth-of-type(5) .debug-log"；值 "supply_rejected"
9. `click` 定位 "[data-screen='debug'] [data-action='debug-close']:not(.modal-close)"
10. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 8"
11. `click` 定位 "[data-screen='machine'] [data-action='draw']"
12. `click` 定位 "[data-action='feedback-skip']"
13. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
14. `click` 定位 "[data-screen='machine'] [data-action='draw']"
15. `click` 定位 "[data-action='feedback-skip']"
16. `expectText` 定位 "[data-screen='drawResult'] .duplicate-points"；值 "重复 +1 积分"
17. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
18. `expectText` 定位 "[data-screen='claim'] .modal-header"；值 "累计1分"
19. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
20. `expectText` 定位 "[data-screen='machine'] .progress-heading"；值 "累计积分 1"
21. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 6"

执行记录：平台预览 · 供券拒绝写入本地日志且不改变券余额，重复玩具达成首个阶段节点 通过；离线交付 · 供券拒绝写入本地日志且不改变券余额，重复玩具达成首个阶段节点 通过

### 场景 GACHA_14：刷新后再次供券和抽取仍使用新的事务ID

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] [data-action='guide-skip']:not(.modal-close)"
4. `click` 定位 "[data-action='debug-open']"
5. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"
6. `click` 定位 "[data-screen='debug'] [data-action='debug-close']:not(.modal-close)"
7. `expectText` 定位 ".ticket-pill"；值 "扭蛋券 8"
8. `reload` 定位 "body"
9. `click` 定位 "[data-action='debug-open']"
10. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"
11. `click` 定位 "[data-screen='debug'] [data-action='debug-close']:not(.modal-close)"
12. `expectText` 定位 ".ticket-pill"；值 "扭蛋券 13"
13. `click` 定位 "[data-action='draw']"
14. `click` 定位 "[data-action='feedback-skip']"
15. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
16. `expectText` 定位 ".ticket-pill"；值 "扭蛋券 12"
17. `reload` 定位 "body"
18. `click` 定位 "[data-action='draw']"
19. `click` 定位 "[data-action='feedback-skip']"
20. `expectText` 定位 "[data-screen='drawResult'] .duplicate-points"；值 "重复 +1 积分"
21. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
22. `expectVisible` 定位 "[data-screen='claim']"
23. `click` 定位 "[data-screen='claim'] [data-action='popup-close']:not(.modal-close)"
24. `expectText` 定位 ".ticket-pill"；值 "扭蛋券 11"
25. `expectText` 定位 ".progress-heading"；值 "累计积分 1"

执行记录：平台预览 · 刷新后再次供券和抽取仍使用新的事务ID 通过；离线交付 · 刷新后再次供券和抽取仍使用新的事务ID 通过

### 场景 GACHA_21：零发券的已结算生成器事件跨活动日重放仍去重

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] .modal-header [data-action='guide-skip']"
4. `click` 定位 "[data-screen='machine'] [data-action='debug-open']"
5. `click` 定位 "[data-screen='debug'] [data-action='debug-generator-miss']"
6. `expectText` 定位 "[data-screen='debug'] [data-debug-receipt]"；值 "实际 0 张"
7. `fill` 定位 "[data-screen='debug'] [data-debug-field='serverTime']"；值 "2026-09-30T04:00:00+08:00"
8. `click` 定位 "[data-screen='debug'] [data-action='debug-apply']"
9. `click` 定位 "[data-screen='debug'] [data-action='debug-replay']"
10. `expectText` 定位 "[data-screen='debug'] [data-debug-receipt]"；值 "不重复发券"
11. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
12. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 3"

执行记录：平台预览 · 零发券的已结算生成器事件跨活动日重放仍去重 通过；离线交付 · 零发券的已结算生成器事件跨活动日重放仍去重 通过

### 场景 GACHA_25：未集齐全部玩具仍可完成一次性结束结算并保留摘要

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] .modal-header [data-action='guide-skip']"
4. `click` 定位 "[data-screen='machine'] [data-action='draw']"
5. `click` 定位 "[data-action='feedback-skip']"
6. `click` 定位 "[data-screen='drawResult'] [data-action='result-close']"
7. `click` 定位 "[data-screen='machine'] [data-action='debug-open']"
8. `click` 定位 "[data-screen='debug'] [data-action='debug-expire']"
9. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
10. `click` 定位 "[data-screen='machine'] [data-action='machine-close']"
11. `expectText` 定位 "[data-screen='ending'] .modal-content"；值 "1/25"
12. `click` 定位 "[data-screen='ending'] .modal-actions [data-action='ending-confirm']"
13. `click` 定位 "[data-screen='entry'] [data-action='ending-summary-open']"
14. `expectText` 定位 "[data-screen='endingSummary'] .modal-content"；值 "收藏完成 1/25"
15. `click` 定位 "[data-screen='endingSummary'] .modal-actions [data-action='ending-summary-close']"
16. `reload` 定位 "body"
17. `expectCount` 定位 "[data-screen='ending']"；数量 0

执行记录：平台预览 · 未集齐全部玩具仍可完成一次性结束结算并保留摘要 通过；离线交付 · 未集齐全部玩具仍可完成一次性结束结算并保留摘要 通过

## R12 · 交付模块化离线源工程及平台配置接口适配。以390×844竖屏为基准适配窄矮窗口、触控目标至少44px、弹层内容内部滚动；支持减少动态效果。审查需列出具体代码／样式依据、发现的问题和修正建议；未实际运行浏览器不得宣称视觉或交互已验收。

- 策划依据：交付与质量约束、8.3—8.10
- 可观察验收：静态审查模块边界、配置读取和幂等路径；检查每个入口与结束路径的测试记录。浏览器尚未运行时将视觉和实机交互状态标为「待运行验证」，不以缺少主线棋盘判失败。
- 配置表：`VisualTheme`、`UiCopy`
- 实现位置：没有匹配的源码证据，须人工定位
- 审查状态：fail

实现证据（当前源码原文）：

```text
styles.css: 窄屏规则 `.progress-rail .progress-node { min-width: 40px; }`，低于配置要求的 44px 触控宽度。
```

### 场景 GACHA_07：首次封面、引导中断、规则说明与重进

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-action='entry-open']"
2. `expectVisible` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
4. `expectVisible` 定位 "[data-screen='guide'] [data-action='guide-next']"
5. `click` 定位 "[data-screen='guide'] [data-action='guide-next']"
6. `expectText` 定位 "[data-screen='guide'] .guide-progress"；值 "2 / 5"
7. `click` 定位 "[data-screen='guide'] [data-action='guide-skip']:not(.modal-close)"
8. `click` 定位 "[data-action='rules-open']"
9. `expectText` 定位 "[data-screen='rulesGuide'] .rules-list"；值 "Debug模拟供券"
10. `expectText` 定位 "[data-screen='rulesGuide'] .rules-list"；值 "累计积分"
11. `expectText` 定位 "[data-screen='rulesGuide'] .rules-list"；值 "兑换商店"
12. `click` 定位 "[data-screen='rulesGuide'] [data-action='panel-back']:not(.modal-close)"
13. `click` 定位 "[data-action='machine-close']"
14. `click` 定位 "[data-action='entry-open']"
15. `expectCount` 定位 "[data-screen='cover']"；数量 0
16. `expectVisible` 定位 "[data-screen='machine'] [data-action='draw']"
17. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "3"

执行记录：平台预览 · 首次封面、引导中断、规则说明与重进 通过；离线交付 · 首次封面、引导中断、规则说明与重进 通过

### 场景 GACHA_08：Info 完整列表、统计范围与倍率保留

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] [data-action='guide-skip']:not(.modal-close)"
4. `click` 定位 "[data-action='tier-select'][data-tier-id='X5']"
5. `click` 定位 "[data-action='info-open']"
6. `expectVisible` 定位 "[data-screen='info'] [data-scroll-region='info']"
7. `expectCount` 定位 "[data-screen='info'] .share-row[data-quality]"；数量 25
8. `expectText` 定位 "[data-screen='info'] .info-intro"；值 "60 项"
9. `expectText` 定位 "[data-screen='info'] .share-list .share-row:nth-child(25)"；值 "星冠凤凰"
10. `click` 定位 "[data-screen='info'] [data-action='info-scope'][data-scope='LOOP']"
11. `expectText` 定位 "[data-screen='info'] .info-intro"；值 "20 项"
12. `click` 定位 "[data-screen='info'] [data-action='panel-back']:not(.modal-close)"
13. `expectVisible` 定位 "[data-action='tier-select'][data-tier-id='X5'][aria-pressed='true']"
14. `expectText` 定位 "[data-action='draw']"；值 "消耗 5 张扭蛋券"

执行记录：平台预览 · Info 完整列表、统计范围与倍率保留 通过；离线交付 · Info 完整列表、统计范围与倍率保留 通过

### 场景 GACHA_17：资格不足时隐藏活动入口并保留固定 Debug

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='debug-open']"
2. `fill` 定位 "[data-screen='debug'] [data-debug-field='level']"；值 "6"
3. `click` 定位 "[data-screen='debug'] [data-action='debug-apply']"
4. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
5. `expectCount` 定位 "[data-screen='entry'] [data-action='entry-open']"；数量 0
6. `expectText` 定位 "[data-screen='entry'] .entry-unavailable"；值 "需要达到7级"
7. `expectVisible` 定位 "[data-screen='entry'] [data-action='debug-open']"
8. `click` 定位 "[data-screen='entry'] [data-action='debug-open']"
9. `fill` 定位 "[data-screen='debug'] [data-debug-field='level']"；值 "7"
10. `click` 定位 "[data-screen='debug'] [data-action='debug-apply']"
11. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
12. `expectVisible` 定位 "[data-screen='entry'] [data-action='entry-open']"

执行记录：平台预览 · 资格不足时隐藏活动入口并保留固定 Debug 通过；离线交付 · 资格不足时隐藏活动入口并保留固定 Debug 通过

### 场景 GACHA_18：结束后结算展示期内只读查看摘要

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] .modal-header [data-action='guide-skip']"
4. `click` 定位 "[data-screen='machine'] [data-action='debug-open']"
5. `click` 定位 "[data-screen='debug'] [data-action='debug-expire']"
6. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
7. `click` 定位 "[data-screen='machine'] [data-action='machine-close']"
8. `click` 定位 "[data-screen='ending'] .modal-actions [data-action='ending-confirm']"
9. `expectVisible` 定位 "[data-screen='entry'] [data-action='ending-summary-open']"
10. `click` 定位 "[data-screen='entry'] [data-action='ending-summary-open']"
11. `expectText` 定位 "[data-screen='endingSummary'] .modal-content"；值 "收藏完成"
12. `click` 定位 "[data-screen='endingSummary'] .modal-actions [data-action='ending-summary-close']"
13. `expectCount` 定位 "[data-screen='entry'] [data-action='entry-open']"；数量 0
14. `reload` 定位 "body"
15. `expectVisible` 定位 "[data-screen='entry'] [data-action='ending-summary-open']"

执行记录：平台预览 · 结束后结算展示期内只读查看摘要 通过；离线交付 · 结束后结算展示期内只读查看摘要 通过

### 场景 GACHA_22：模拟存档故障后仍能浏览收藏、Info 与事件账本，抽取保持禁用

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] .modal-header [data-action='guide-skip']"
4. `click` 定位 "[data-screen='machine'] [data-action='debug-open']"
5. `click` 定位 "[data-screen='debug'] [data-action='debug-storage-fail']"
6. `expectText` 定位 "[data-screen='debug'] [data-save-warning]"；值 "活动存档暂不可用"
7. `expectVisible` 定位 "[data-screen='debug'] .debug-section:has(h3:has-text('奖励账本'))"
8. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
9. `expectDisabled` 定位 "[data-screen='machine'] [data-action='draw']"
10. `click` 定位 "[data-screen='machine'] [data-action='collection-open']"
11. `expectCount` 定位 "[data-screen='collection'] .toy-tile.is-locked"；数量 25
12. `click` 定位 "[data-screen='collection'] .modal-header [data-action='panel-back']"
13. `click` 定位 "[data-screen='machine'] [data-action='info-open']"
14. `expectCount` 定位 "[data-screen='info'] .share-row .toy-art"；数量 25
15. `click` 定位 "[data-screen='info'] .modal-header [data-action='panel-back']"
16. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 3"

执行记录：平台预览 · 模拟存档故障后仍能浏览收藏、Info 与事件账本，抽取保持禁用 通过；离线交付 · 模拟存档故障后仍能浏览收藏、Info 与事件账本，抽取保持禁用 通过

### 场景 GACHA_27：封面、收藏和商店弹层上方可操作 Debug，返回后原页面与队列保留

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
2. `expectVisible` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-overlay-debug][data-action='debug-open']"
4. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"
5. `expectText` 定位 "[data-screen='debug'] [data-debug-receipt]"；值 "实际 5 张"
6. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
7. `expectVisible` 定位 "[data-screen='cover'] [data-action='cover-start']"
8. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
9. `click` 定位 "[data-screen='guide'] .modal-header [data-action='guide-skip']"
10. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 8"
11. `click` 定位 "[data-screen='machine'] [data-action='collection-open']"
12. `click` 定位 "[data-overlay-debug][data-action='debug-open']"
13. `click` 定位 "[data-screen='debug'] [data-action='debug-generator-hit']"
14. `expectText` 定位 "[data-screen='debug'] [data-debug-receipt]"；值 "实际 2 张"
15. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
16. `expectText` 定位 "[data-screen='collection'] .collection-total"；值 "0/25"
17. `click` 定位 "[data-screen='collection'] .modal-header [data-action='panel-back']"
18. `click` 定位 "[data-screen='machine'] [data-action='shop-open']"
19. `click` 定位 "[data-overlay-debug][data-action='debug-open']"
20. `expectVisible` 定位 "[data-screen='debug'] [data-action='debug-order-success']"
21. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
22. `expectText` 定位 "[data-screen='shop'] .shop-note"；值 "需要集齐全部收藏解锁兑换商城"
23. `click` 定位 "[data-screen='shop'] .modal-header [data-action='panel-back']"
24. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 10"

执行记录：平台预览 · 封面、收藏和商店弹层上方可操作 Debug，返回后原页面与队列保留 通过；离线交付 · 封面、收藏和商店弹层上方可操作 Debug，返回后原页面与队列保留 通过

### 场景 GACHA_29：修复回归：外部供券后仍可在Info查看完整固定序列投放口径

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] .modal-header [data-action='guide-skip']"
4. `click` 定位 "[data-screen='machine'] [data-action='debug-open']"
5. `click` 定位 "[data-screen='debug'] [data-action='debug-order-success']"
6. `expectText` 定位 "[data-screen='debug'] [data-debug-receipt]"；值 "实际 5 张"
7. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
8. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 8"
9. `click` 定位 "[data-screen='machine'] [data-action='info-open']"
10. `expectVisible` 定位 "[data-screen='info'] [data-scroll-region='info']"
11. `expectCount` 定位 "[data-screen='info'] .share-row .toy-art"；数量 25
12. `expectText` 定位 "[data-screen='info'] .info-intro"；值 "不是下一抽独立概率"
13. `expectText` 定位 "[data-screen='info'] .share-row:first-child .share-percent"；值 "8.33%"
14. `click` 定位 "[data-screen='info'] .modal-header [data-action='panel-back']"
15. `expectText` 定位 "[data-screen='machine'] .ticket-pill"；值 "扭蛋券 8"

执行记录：平台预览 · 修复回归：外部供券后仍可在Info查看完整固定序列投放口径 通过；离线交付 · 修复回归：外部供券后仍可在Info查看完整固定序列投放口径 通过

### 场景 GACHA_31：矮屏入口保留可见机台、活动入口及顶部 Debug 热区

从全新页面开始，按以下顺序执行：

1. `expectVisible` 定位 "[data-screen='entry'] .entry-machine .machine-art"
2. `expectVisible` 定位 "[data-screen='entry'] [data-action='entry-open']"
3. `expectVisible` 定位 "[data-screen='entry'] > [data-action='debug-open']"
4. `click` 定位 "[data-screen='entry'] > [data-action='debug-open']"
5. `expectVisible` 定位 "[data-screen='debug'] [data-action='debug-order-success']"
6. `click` 定位 "[data-screen='debug'] .modal-actions [data-action='debug-close']"
7. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
8. `expectVisible` 定位 "[data-screen='cover'] [data-action='cover-start']"

执行记录：平台预览 · 矮屏入口保留可见机台、活动入口及顶部 Debug 热区 通过；离线交付 · 矮屏入口保留可见机台、活动入口及顶部 Debug 热区 通过

### 场景 GACHA_32：重复玩具积分叠在压暗藏品上，收下后汇入机台上方进度条

从全新页面开始，按以下顺序执行：

1. `click` 定位 "[data-screen='entry'] [data-action='entry-open']"
2. `click` 定位 "[data-screen='cover'] [data-action='cover-start']"
3. `click` 定位 "[data-screen='guide'] .modal-header [data-action='guide-skip']"
4. `click` 定位 "[data-screen='machine'] [data-action='tier-select'][data-tier-id='X3']"
5. `click` 定位 "[data-screen='machine'] [data-action='draw']"
6. `click` 定位 "[data-action='feedback-skip']"
7. `expectCount` 定位 "[data-screen='drawResult'] .result-item"；数量 3
8. `expectCount` 定位 "[data-screen='drawResult'] .result-item.is-duplicate"；数量 1
9. `expectText` 定位 "[data-screen='drawResult'] .result-item.is-duplicate .result-art .duplicate-points"；值 "+1 积分"
10. `expectText` 定位 "[data-screen='machine'] .progress-heading"；值 "累计积分 1"
11. `click` 定位 "[data-screen='drawResult'] .modal-actions [data-action='result-close']"
12. `expectText` 定位 "[data-screen='machine'] .point-flight-status"；值 "重复积分 +1 已汇入进度条"
13. `expectText` 定位 "[data-screen='machine'] .available-points"；值 "可用积分 1"
14. `expectText` 定位 "[data-screen='claim'] .modal-header"；值 "累计1分"

执行记录：平台预览 · 重复玩具积分叠在压暗藏品上，收下后汇入机台上方进度条 通过；离线交付 · 重复玩具积分叠在压暗藏品上，收下后汇入机台上方进度条 通过

## 演示假设与待确认项

- A01｜ActivityConfig：演示期次DEMO_20260929，开始时间为2026-09-29T03:00:00+08:00，截止为七天后的2026-10-06T03:00:00+08:00；用于离线可调的模拟服务器时间，不以设备时间直接结算。结算展示期2天、03:00日切、7级和第6波采用策划已知值。
- A02｜ActivityConfig、DrawTiers：初始券3张、单抽N=1张为未定数值的演示假设。初始券确保不依赖外部玩法即可体验首抽；后续券仍须主动点击Debug供给，不能自动产生。
- A03｜SupplyRules：演示订单成功每次发5张；生成器有效产出的配置命中率50%、命中发2张，Debug提供显式命中／未命中成功事件以稳定覆盖两种契约；失败为0张。不限日／期上限，两来源不共用上限。没有自动挂机掉落。
- A04｜PlayerLayers、GachaSequence：演示只有DEFAULT一个适用分层与SEQ_A一组固定序列，不引入随机选组。房间101、102各20项，房间103有20项且到末尾只循环房间103；前两房间包含全部25件玩具，早期第2项即重复。此循环是策划未定的演示后续读取规则。
- A05｜GachaToy：25个ToyId、中文玩具名称及SVG形状键为演示命名；五品质各5件、重复积分1／2／3／5／10是策划已知值。玩具奖励单次数量均为1。
- A06｜RewardCatalog、ProgressNodes：金币、主线体力和待领奖道具的演示数量，以及五组品质奖励、大奖和阶段门槛／奖励均为演示假设；阶段门槛依次1、5、15、30、55，以保证全收藏前就能取得早期阶段奖励。外发奖励只记录模拟到账或模拟待领奖，不提供主线资源消费页。
- A07｜GachaShop：三件演示商品价格3／10／25点，兑换限制分别为不限次／3次／1次；单次奖励数量取RewardCatalog配置。正价格、-1表示不限次及0不用于配置遵循策划。
- A08｜UiCopy：首次引导采用五步说明，不赠送引导券；所有提示文案、步骤和解锁说明可配置。关闭引导不会代替真实抽取。
- A09｜Info：百分比按当前分层SEQ_A的全部60个配置项逐项组合计数并保留两位小数，尾项吸收纯展示用舍入误差；这是固定序列的全范围投放占比，不预测下一抽。房间103循环后的长期占比另以房间103的20项统计并明确标识。
- A10｜VisualTheme：主题色、尺寸和动效时长为缺少正式美术参数时的演示假设；参考图仅约束横向积分轨道的构图，不采纳其中门槛。已有用户数据优先，默认演示数据仅在不存在对应配置或存档时补齐，不覆盖已有行。
- A11｜实现与测试：离线模拟服务器状态由Debug手动调整；演示重新试玩会建立新的本地测试期次实例并清除该实例的活动存档，不改写平台已有用户数据。不能把Debug「重新试玩」用作领奖或完成活动的替代操作。

- [ ] 正式确认初始券、单抽券数、两类供券数量与上限、奖励序列末房间循环规则，以及阶段奖励和商品价格；目前对应值均明确标为演示假设。
- [ ] 由美术与体验负责人确认现有夜场扭蛋柜截图中的材质、玩具轮廓和重复积分飞行节奏是否符合正式表现目标；提供的截图与浏览器通过记录不等于正式美术定稿。

## 交付边界

自动测试覆盖上列场景，不能代替正式环境接入与全部状态验收。策划规则与源码有冲突时，先对照来源章节确认，再同时更新源码、测试与此文档。
