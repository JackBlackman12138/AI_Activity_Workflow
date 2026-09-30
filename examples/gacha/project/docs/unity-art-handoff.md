# 七天扭蛋奇遇｜Unity 与正式美术交接

本文件描述 UE 交互依据；Web 源码不能直接导入 Unity。规则迁移至 C# 时保持事务 ID、存档先于表现、奖励账本与去重语义；外部 Debug 事件由正式订单／生成器结算接口替换，不制作主线棋盘。以下尺寸为演示占位，正式美术待确认。

## 层级、进入条件、控件与状态

| 页面／弹层 | 进入条件 | 控件与事件 | 禁用、失败、返回 |
| --- | --- | --- | --- |
| 外部入口 | 等级≥7、订单波次≥6、资格及资源就绪、时间开放、开关允许 | 入口→ENTRY_OPEN；固定 Debug→OPEN_SCREEN(debug) | 不满足时隐藏入口、显示具体原因；截止或硬关后不能新进 |
| 开启封面 | 本期首次 ENTRY_OPEN | 开始→COVER_START；叉号→POPUP_CLOSE | 一期仅一次；返回外部占位，不撤销初始化 |
| 新手引导 | 首次开始后 | 下一步→GUIDE_NEXT；跳过／叉号→GUIDE_CLOSE | 不赠券；中断不回滚活动进度 |
| 扭蛋机 | 有效活动会话 | 四档→SELECT_TIER；旋钮抽取→DRAW；Info、收藏、商店、规则→OPEN_SCREEN；返回→LEAVE_ACTIVITY | 券不足不改倍率或游标；时间不可信及存档只读禁止不可逆操作；到期内停留可继续 |
| 结果／自动奖励队列 | DRAW 已提交 | 收下结果／关闭奖励→POPUP_CLOSE | 顺序为结果、升序积分节点、全收藏大奖、商店解锁提示；关闭表现不撤销奖励 |
| 收藏／品质领奖 | 活动会话 | 组领奖→品质确认→CLAIM_NODE；返回→CLOSE_SCREEN | 5/5 才能手动领取，已领取不可重复发奖；NEW 在离开收藏后清除 |
| 商店／兑换确认 | 活动会话；未全收藏仍可浏览 | 商品→SHOP_CONFIRM；取消→POPUP_CLOSE；确认→EXCHANGE_CONFIRM；返回→CLOSE_SCREEN | 未解锁、积分不足、售罄分别提示；确认时复验，成功只扣可用积分 |
| Info／规则 | 活动会话 | 统计范围切换仅改变展示；关闭→CLOSE_SCREEN | 长列表独立滚动，不读序列、不扣券 |
| Debug | 外部占位及机台固定入口 | 手动供券、资格／时间／开关、事件重放、重登、重新试玩 | 每个外部事件需唯一 ID；失败及过期不发券；不替代活动自身玩法 |
| 结束／补发 | 可信时间到期且已离开活动 | 结束确认→POPUP_CLOSE；补发领取→CLAIM_MAKEUP，再关闭 | 结束先于补发；结算只执行一次；两天内可只读查看结束摘要 |

## 存档与接口

存档键按 periodId 隔离。关键字段：testInstanceId、initialized、coverSeen、guideSeen、layerId、sequenceGroup、cursor.roomId/index、tickets、ownedToyIds、newToyIds、totalPoints、availablePoints、nodeClaims、shopCounts、processedEventIds、confirmedTransactions、sequenceResults、rewardLedger、popupQueue、settlement、progressOutbox、serverTime、timeTrusted、switchState。正式实现应由服务端原子提交抽取／兑换及外发奖励，使用唯一供券事件 ID、批次 ID、兑换事务 ID 和奖励来源 ID 去重。`progressOutbox` 先随业务提交落盘，再上报 ProgressNodes 零起始索引；平台 track 只接收 type/index，若要求跨崩溃严格恰好一次，正式埋点接收方还需支持稳定事件 ID 去重。模拟奖励账本的 MOCK_CREDIT／MOCK_PENDING 分别由正式主游戏账户／待领奖接口替换。

## 美术占位与动效

设计画布 390×844；机台 `art.js:machineArt()` 使用 360×480 SVG 视框，罩体、两层彩蛋、机身、旋钮及出蛋口分别替换。玩具 `toyArt()` 使用 100×100 视框，25 个 shapeKey 对应独立轮廓；奖励 `rewardArt()` 同为 100×100。品质环光从 VisualTheme.qualityColorsJson 读取。弹层使用暖白搪瓷面及固定头尾、滚动正文；按钮最小热区 44×44。抽取事务确认并保存之后，播放一次机身轻晃、仓内滚动、旋钮转动和出蛋口吐蛋，再揭晓整批。重复玩具的物件 SVG 压暗，积分数量以品质色描边徽记直接覆盖该物件；绿／蓝／紫／红／金分别显示 +1／+2／+3／+5／+10（取 QualityConvert 生效值）。玩家点击结果弹层「收下结果」且关闭已确认结果成功后，从当前可见的重复玩具徽记位置向机台上方真实积分轨道飞出品质色粒子；屏外结果计入本批汇总文字，不伪造屏外飞行起点。粒子和进度文字只展示已经存档的批次积分，不在动效结束时再次转化；随后按积分门槛升序展示自动节点，最后展示大奖。减少动态效果时跳过飞行，仍显示「已汇入进度条」的文字终态。正式 Unity 美术需替换积分徽记和粒子贴图；视觉及实机交互仍待运行验证。

## 静态审查与待验证

依据：`state.js` 集中提交，`draw.js`／`shop.js` 计算事务草稿，`rewards.js` 维护奖励来源账本，`views.js` 输出各页面，`art.js` 输出占位 SVG，`styles.css` 管理触控、层级及弹层滚动。建议正式接入前确认服务器时间同步、期次序列末房间循环规则及未定演示数值；对抽取提交后中断、埋点确认前中断和存储故障做独立验证。此处未运行浏览器；视觉及实机交互状态均为「待运行验证」。
