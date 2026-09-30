# 配置字段与关联说明

运行时读取 configuration.json 生成的 config/runtime.js；所有表通过 window.ActivityStudio.tables[表ID] 访问。

## ActivityConfig · 活动期次与全局规则

- periodId（期次）：string，必填。全部配置与事件的关联键
- startAt（开始时间）：string，必填。ISO时间，由模拟服务器时钟解释
- endAt（正式截止）：string，必填。停止外部供券的ISO时间
- dayCutHour（活动日切小时）：number，必填。已知值3；不重置资产
- minLevel（最低等级）：number，必填。已知值7
- requiredWave（前置订单波次）：number，必填。已知值6；仅Debug模拟资格
- initialTickets（初始券）：number，必填。首次初始化一次
- settlementDays（结算展示天数）：number，必填。已知值2
- switchState（开关）：string，必填。OPEN／SOFT_OFF／HARD_OFF；Debug可调整
- timeTrusted（时间可信）：boolean，必填。否时只读、不结算
- guideGiftTickets（引导赠券）：number，必填。演示设0

## SupplyRules · 外部供券模拟契约

- ruleId（规则ID）：string，必填。供券事件关联键
- source（模拟来源）：string，必填。ORDER_SETTLED／GENERATOR_OUTPUT
- scope（适用范围）：string，必填。显示用模拟来源，不创建上游页面
- tier（适用分层）：string，必填。对应PlayerLayers
- method（发券方式）：string，必填。FIXED／HIT_PROBABILITY
- hitRate（配置命中率）：number，必填。0—1；Debug显式模拟命中结果
- ticketsOnHit（命中券数）：number，必填。成功且命中后发券
- dailyCap（日上限）：number，必填。-1为不限
- periodCap（期上限）：number，必填。-1为不限
- unit（判定单位）：string，必填。每个唯一成功事件一次

## PlayerLayers · 演示玩家分层与序列选择

- layerId（分层ID）：string，必填。本期首次初始化后持续保存
- sequenceGroup（选中序列组）：string，必填。指向GachaSequence
- selection（选取方式）：string，必填。FIXED表示无随机选组
- initialRoomId（初始房间）：number，必填。首次初始化游标
- initialIndex（初始位置）：number，必填。从1开始的序列位置

## DrawTiers · 倍率与实际消耗

- tierId（倍率ID）：string，必填。显示倍率
- singleCost（单抽券数N）：number，必填。四行必须同值
- ticketCost（本档券消耗）：number，必填。singleCost×reads
- reads（序列读取数）：number，必填。每项独立结算
- sortOrder（显示顺序）：number，必填。从左到右

## GachaToy · 25件玩具

- toyId（ToyId）：string，必填。首次与重复的唯一判定键
- name（名称）：string，必填。收藏、结果及Info共用
- qualityId（品质）：string，必填。GREEN／BLUE／PURPLE／RED／GOLD
- collectionId（收藏组）：string，必填。关联ProgressNodes的品质节点
- shapeKey（SVG形状键）：string，必填。复用绘制系统中的不同物件轮廓
- sortOrder（组内顺序）：number，必填。1—5

## QualityConvert · 重复品质转化

- qualityId（品质ID）：string，必填。关联GachaToy
- pointResourceId（积分资源ID）：string，必填。本期累计与可用积分的同一来源
- pointsPerDuplicate（每件重复积分）：number，必填。策划已知值

## RewardCatalog · 非玩具奖励及发放承接

- rewardId（奖励ID）：string，必填。序列、进度及商品引用
- name（显示名称）：string，必填。结果、Info及领奖共用
- rewardType（奖励类型）：string，必填。COIN／MAIN_ENERGY／BOARD_ITEM
- quantity（单次数量）：number，必填。每次引用该奖励的实际数量
- delivery（承接方式）：string，必填。MOCK_CREDIT／MOCK_PENDING；仅记账
- iconKey（SVG图标键）：string，必填。共用绘制系统
- note（用途）：string，必填。便于核对奖励来源

## GachaSequence · 完整有序奖励房间

- periodId（活动期次）：string，必填。关联ActivityConfig
- layerId（适用分层）：string，必填。关联PlayerLayers
- sequenceGroup（序列组）：string，必填。本期持续保存
- roomId（RoomId）：number，必填。按升序读取
- orderedRewardsJson（有序奖励JSON）：string，必填。JSON字符串：20个奖励ID组成的数组；G/B/P/R/Y前缀为ToyId，其余关联RewardCatalog；每项单次数量由对应表读取
- endRule（读完本房间）：string，必填。NEXT_ROOM或LOOP_THIS_ROOM

## ProgressNodes · 可追踪主进度节点

- nodeId（节点ID）：string，必填。主进度事件及领奖去重键
- nodeType（节点类型）：string，必填。POINT／QUALITY／COMPLETE
- label（节点文案）：string，必填。界面及事件日志共用
- target（达成数值）：number，必填。累计积分或不同ToyId数
- collectionId（收藏组ID）：string，必填。积分节点填ALL；品质节点与GachaToy关联
- rewardIdsJson（奖励列表JSON）：string，必填。JSON字符串：RewardCatalog奖励ID数组；同一节点可含多项奖励
- claimMode（领取方式）：string，必填。AUTO／MANUAL
- sortOrder（展示及结算顺序）：number，必填。积分节点按门槛升序
- eventName（进度事件）：string，必填。按平台契约上报的语义事件名

## GachaShop · 全收藏积分商品

- id（商品ID）：string，必填。兑换次数及事务去重关联
- rewardId（奖励ID）：string，必填。指向RewardCatalog
- pointPrice（单次积分价格）：number，必填。必须大于0
- exchangeLimit（本期兑换上限）：number，必填。-1不限次；不使用0
- sortOrder（显示顺序）：number，必填。升序

## UiCopy · 可配置规则文案、提示及引导

- copyId（文案ID）：string，必填。界面引用键
- screen（所属界面）：string，必填。screen ID或COMMON
- text（显示文本）：string，必填。演示默认文案
- sortOrder（阅读顺序）：number，必填。同界面从小到大

## VisualTheme · 统一主题及动效参数

- themeId（主题ID）：string，必填。全部页面及弹层共用
- background（夜场背景）：string，必填。CSS颜色
- machine（机身主色）：string，必填。CSS颜色
- glass（玻璃辅色）：string，必填。CSS颜色
- gold（金属描边）：string，必填。CSS颜色
- surface（弹层表面）：string，必填。CSS颜色
- qualityColorsJson（品质色JSON）：string，必填。JSON字符串：GREEN／BLUE／PURPLE／RED／GOLD映射CSS颜色
- fontStack（字体栈）：string，必填。本地系统字体，不请求网络
- titlePx（标题字号）：number，必填。像素
- bodyPx（正文字号）：number，必填。像素
- spacingJson（间距JSON）：string，必填。JSON字符串：单位px的间距数组
- radiusPx（弹层圆角）：number，必填。像素
- outlinePx（主体描边）：number，必填。像素
- shadow（阴影）：string，必填。CSS双层阴影
- motionMs（抽取反馈时长）：number，必填。仅表现，不决定结算时点
- minTouchPx（最小触控尺寸）：number，必填。至少44像素
