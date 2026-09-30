// R01–R12：仅在平台对应表缺失、空表或只有字段时启用的完整演示行。
// A01：期次与时间是离线模拟时钟假设；7天、03:00、7级、第6波、2天来自策划。
// A02：初始券3、N=1待正式确认。A03：订单5券、生成器命中率50%及2券均待确认。
// A04：DEFAULT/SEQ_A 固定选组；101、102、103各20项，103循环，均为演示假设。
// A05：名称、ID、图形键为演示占位；五组各5件、重复积分1/2/3/5/10来自策划。
// A06：非玩具数量、阶段门槛及奖励待确认；外发奖励仅记录模拟到账或待领奖。
// A07：商店价格3/10/25与次数-1/3/1待确认。A08：五步引导不赠券。
// A09：Info占比由生效序列计算，不在本文件另存百分比。
// A10：主题颜色、字号及850ms动效为美术占位。此模块不修改平台注入的表。
const periodId = 'DEMO_20260929';
const qualities = [
  ['GREEN', 'COL_GREEN', '绿色', 'G', ['发条青蛙|frog', '叶片小车|leaf_car', '蘑菇陀螺|mushroom_top', '松果机器人|pine_robot', '苔藓小象|moss_elephant']],
  ['BLUE', 'COL_BLUE', '蓝色', 'B', ['潜水小鸭|diver_duck', '海星飞船|star_ship', '泡泡水母|bubble_jelly', '灯塔鲸鱼|lighthouse_whale', '贝壳潜艇|shell_sub']],
  ['PURPLE', 'COL_PURPLE', '紫色', 'P', ['星轨魔猫|astral_cat', '月牙留声机|moon_gramophone', '水晶猫头鹰|crystal_owl', '银河小马|galaxy_pony', '彗星茶壶|comet_teapot']],
  ['RED', 'COL_RED', '红色', 'R', ['火箭小熊|rocket_bear', '齿轮狮子|gear_lion', '灯笼狐狸|lantern_fox', '巡游火车|parade_train', '熔岩独角兽|lava_unicorn']],
  ['GOLD', 'COL_GOLD', '金色', 'Y', ['皇冠龙蛋|crown_egg', '日轮孔雀|sun_peacock', '宝石城堡|gem_castle', '金翼飞马|gold_pegasus', '星冠凤凰|star_phoenix']]
];
const reward = (rewardId, name, rewardType, quantity, delivery, iconKey, note) =>
  ({ rewardId, name, rewardType, quantity, delivery, iconKey, note });
const node = (nodeId, nodeType, label, target, collectionId, rewards, claimMode, sortOrder, eventName) =>
  ({ nodeId, nodeType, label, target, collectionId, rewardIdsJson: JSON.stringify(rewards), claimMode, sortOrder, eventName });
const text = (copyId, screen, value, sortOrder) => ({ copyId, screen, text: value, sortOrder });
const rooms = [
  [101, ['G01','G01','B01','P01','R01','Y01','G02','B02','P02','R02','Y02','G03','B03','P03','R03','Y03','G04','B04','P04','G01'], 'NEXT_ROOM'],
  [102, ['G01','COIN50','R04','Y04','G05','B05','P05','R05','Y05','Y01','Y05','R05','P05','B05','G05','ENERGY10','BOARD1','Y05','R01','COIN50'], 'NEXT_ROOM'],
  [103, ['G01','B01','P01','R01','Y01','COIN50','G05','B05','P05','R05','Y05','ENERGY10','G02','B02','P02','R02','Y02','BOARD1','R05','Y05'], 'LOOP_THIS_ROOM']
];
export const defaultTables = {
  ActivityConfig: [{ periodId, startAt: '2026-09-29T03:00:00+08:00', endAt: '2026-10-06T03:00:00+08:00', dayCutHour: 3, minLevel: 7, requiredWave: 6, initialTickets: 3, settlementDays: 2, switchState: 'OPEN', timeTrusted: true, guideGiftTickets: 0 }],
  SupplyRules: [
    { ruleId: 'ORDER_01', source: 'ORDER_SETTLED', scope: '模拟一次符合条件的订单成功提交及奖励结算', tier: 'DEFAULT', method: 'FIXED', hitRate: 1, ticketsOnHit: 5, dailyCap: -1, periodCap: -1, unit: 'SUCCESS_EVENT' },
    { ruleId: 'GEN_01', source: 'GENERATOR_OUTPUT', scope: '模拟一次符合条件的生成器有效产出', tier: 'DEFAULT', method: 'HIT_PROBABILITY', hitRate: 0.5, ticketsOnHit: 2, dailyCap: -1, periodCap: -1, unit: 'SUCCESSFUL_OUTPUT_EVENT' }
  ],
  PlayerLayers: [{ layerId: 'DEFAULT', sequenceGroup: 'SEQ_A', selection: 'FIXED', initialRoomId: 101, initialIndex: 1 }],
  DrawTiers: [1,3,5,10].map((reads, i) => ({ tierId: `X${reads}`, singleCost: 1, ticketCost: reads, reads, sortOrder: i + 1 })),
  GachaToy: qualities.flatMap(([qualityId, collectionId, , prefix, items]) => items.map((item, i) => {
    const [name, shapeKey] = item.split('|');
    return { toyId: `${prefix}0${i + 1}`, name, qualityId, collectionId, shapeKey, sortOrder: i + 1 };
  })),
  QualityConvert: qualities.map(([qualityId], i) => ({ qualityId, pointResourceId: 'EVENT_POINT', pointsPerDuplicate: [1,2,3,5,10][i] })),
  RewardCatalog: [
    reward('COIN50','金币','COIN',50,'MOCK_CREDIT','coin_stack','扭蛋序列'),
    reward('COIN100','金币','COIN',100,'MOCK_CREDIT','coin_stack','品质及商品'),
    reward('COIN300','金币','COIN',300,'MOCK_CREDIT','coin_chest','全收藏大奖'),
    reward('ENERGY10','主线体力','MAIN_ENERGY',10,'MOCK_CREDIT','energy_bolt','扭蛋序列及阶段'),
    reward('ENERGY20','主线体力','MAIN_ENERGY',20,'MOCK_CREDIT','energy_bolt','品质及商品'),
    reward('ENERGY40','主线体力','MAIN_ENERGY',40,'MOCK_CREDIT','energy_flask','全收藏大奖'),
    reward('BOARD1','星纹道具箱','BOARD_ITEM',1,'MOCK_PENDING','star_crate','仅记录模拟待领奖'),
    reward('BOARD2','星纹道具箱','BOARD_ITEM',2,'MOCK_PENDING','star_crate','仅记录模拟待领奖')
  ],
  GachaSequence: rooms.map(([roomId, ids, endRule]) => ({ periodId, layerId: 'DEFAULT', sequenceGroup: 'SEQ_A', roomId, orderedRewardsJson: JSON.stringify(ids), endRule })),
  ProgressNodes: [
    node('PT01','POINT','累计1分',1,'ALL',['COIN50'],'AUTO',1,'point_stage_awarded'),
    node('PT02','POINT','累计5分',5,'ALL',['ENERGY10'],'AUTO',2,'point_stage_awarded'),
    node('PT03','POINT','累计15分',15,'ALL',['BOARD1'],'AUTO',3,'point_stage_awarded'),
    node('PT04','POINT','累计30分',30,'ALL',['COIN100'],'AUTO',4,'point_stage_awarded'),
    node('PT05','POINT','累计55分',55,'ALL',['ENERGY20','BOARD1'],'AUTO',5,'point_stage_awarded'),
    node('COL_GREEN','QUALITY','绿色玩具5/5',5,'COL_GREEN',['COIN100'],'MANUAL',6,'quality_reward_claimed'),
    node('COL_BLUE','QUALITY','蓝色玩具5/5',5,'COL_BLUE',['ENERGY20'],'MANUAL',7,'quality_reward_claimed'),
    node('COL_PURPLE','QUALITY','紫色玩具5/5',5,'COL_PURPLE',['BOARD1'],'MANUAL',8,'quality_reward_claimed'),
    node('COL_RED','QUALITY','红色玩具5/5',5,'COL_RED',['COIN100','BOARD1'],'MANUAL',9,'quality_reward_claimed'),
    node('COL_GOLD','QUALITY','金色玩具5/5',5,'COL_GOLD',['ENERGY20','BOARD1'],'MANUAL',10,'quality_reward_claimed'),
    node('COL_ALL','COMPLETE','全部玩具25/25',25,'ALL',['COIN300','ENERGY40','BOARD2'],'AUTO',11,'collection_completed')
  ],
  GachaShop: [
    { id: 'SHOP01', rewardId: 'COIN100', pointPrice: 3, exchangeLimit: -1, sortOrder: 1 },
    { id: 'SHOP02', rewardId: 'ENERGY20', pointPrice: 10, exchangeLimit: 3, sortOrder: 2 },
    { id: 'SHOP03', rewardId: 'BOARD2', pointPrice: 25, exchangeLimit: 1, sortOrder: 3 }
  ],
  UiCopy: [
    text('TITLE','machine','七天扭蛋奇遇',1),
    text('COVER','cover','扭动旋钮，收集25件玩具！重复玩具会化作积分，集齐后解锁兑换商店。',1),
    text('TICKET_LOW','machine','扭蛋券不足，请完成订单或使用主线生成器获取',2),
    text('SHOP_LOCK','shop','需要集齐全部收藏解锁兑换商城',1),
    text('POINT_LOW','shop','积分不足，请继续扭蛋获取',2),
    text('INFO_SCOPE','info','以下为当前分层固定序列的投放占比，不是下一抽独立概率；首次玩具点亮收藏，重复玩具按品质转化积分。×3、×5、×10连续读取对应项数。显示百分比可能因四舍五入产生尾差。',1),
    text('RULE_SUPPLY','rulesGuide','符合条件的订单结算或生成器有效产出可获得扭蛋券。本Demo请主动点击Debug模拟供券；正式截止后停止外部供券。',1),
    text('RULE_DRAW','rulesGuide','选择倍率并消耗对应扭蛋券，按房间与序列顺序逐项抽取；批量倍率不放大奖励数量。',2),
    text('RULE_COLLECT','rulesGuide','收集绿、蓝、紫、红、金各5件玩具。各品质集齐后手动领奖；25件全收集后自动领取大奖并解锁商店。',3),
    text('RULE_POINT','rulesGuide','重复玩具分别转化1、2、3、5、10分。累计积分达标自动领奖；兑换仅消耗可用积分，不回退累计进度。',4),
    text('RULE_END','rulesGuide','全收藏后仍可抽取和兑换。到期停止外部供券；离开到期会话并完成补发后，剩余扭蛋券与积分清零，不继承下期。',5),
    text('GUIDE_1','rulesGuide','先看扭蛋券：订单结算和生成器有效产出是券的外部来源，使用Debug可分别模拟成功或失败。',11),
    text('GUIDE_2','rulesGuide','选择×1、×3、×5或×10；每档连续抽取对应数量的序列结果。',12),
    text('GUIDE_3','rulesGuide','新玩具点亮收藏；同一件再出现会转化为积分。',13),
    text('GUIDE_4','rulesGuide','查看五条品质收藏线，满5件后记得手动领取品质奖励。',14),
    text('GUIDE_5','rulesGuide','累计积分会点亮机台上方的阶段奖章；可用积分留待全收藏后兑换。',15),
    text('SHOP_UNLOCK','shop','25件玩具已集齐！积分兑换商店现已开放。',3),
    text('END','ending','本期扭蛋奇遇已结束。已达成而未到账的奖励将在结束说明后补发。',1),
    text('TIME_UNKNOWN','unavailable','服务器时间尚未确认，活动暂为只读；不会清理已有资产。',1),
    text('SAVE_ERROR','unavailable','活动存档暂不可用，抽取和兑换已暂停，避免重复扣费或发奖。',2)
  ],
  VisualTheme: [{ themeId: 'GACHA_NIGHT', background: '#201B45', machine: '#D94F61', glass: '#82D9E9', gold: '#F5C96D', surface: '#FFF4DF', qualityColorsJson: JSON.stringify({ GREEN:'#65C887', BLUE:'#65B8ED', PURPLE:'#A482EB', RED:'#EC7280', GOLD:'#F3C45B' }), fontStack: "system-ui, 'PingFang SC', 'Microsoft YaHei', sans-serif", titlePx: 26, bodyPx: 15, spacingJson: '[8,12,16,24]', radiusPx: 18, outlinePx: 3, shadow: '0 5px 0 #793744, 0 16px 32px rgba(16,12,43,.35)', motionMs: 850, minTouchPx: 44 }]
};
