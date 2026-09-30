(() => {
  // project:src/defaults.js
  var periodId = "DEMO_20260929";
  var qualities = [
    ["GREEN", "COL_GREEN", "绿色", "G", ["发条青蛙|frog", "叶片小车|leaf_car", "蘑菇陀螺|mushroom_top", "松果机器人|pine_robot", "苔藓小象|moss_elephant"]],
    ["BLUE", "COL_BLUE", "蓝色", "B", ["潜水小鸭|diver_duck", "海星飞船|star_ship", "泡泡水母|bubble_jelly", "灯塔鲸鱼|lighthouse_whale", "贝壳潜艇|shell_sub"]],
    ["PURPLE", "COL_PURPLE", "紫色", "P", ["星轨魔猫|astral_cat", "月牙留声机|moon_gramophone", "水晶猫头鹰|crystal_owl", "银河小马|galaxy_pony", "彗星茶壶|comet_teapot"]],
    ["RED", "COL_RED", "红色", "R", ["火箭小熊|rocket_bear", "齿轮狮子|gear_lion", "灯笼狐狸|lantern_fox", "巡游火车|parade_train", "熔岩独角兽|lava_unicorn"]],
    ["GOLD", "COL_GOLD", "金色", "Y", ["皇冠龙蛋|crown_egg", "日轮孔雀|sun_peacock", "宝石城堡|gem_castle", "金翼飞马|gold_pegasus", "星冠凤凰|star_phoenix"]]
  ];
  var reward = (rewardId, name, rewardType, quantity, delivery, iconKey, note) => ({ rewardId, name, rewardType, quantity, delivery, iconKey, note });
  var node = (nodeId, nodeType, label, target, collectionId, rewards, claimMode, sortOrder, eventName) => ({ nodeId, nodeType, label, target, collectionId, rewardIdsJson: JSON.stringify(rewards), claimMode, sortOrder, eventName });
  var text = (copyId, screen, value, sortOrder) => ({ copyId, screen, text: value, sortOrder });
  var rooms = [
    [101, ["G01", "G01", "B01", "P01", "R01", "Y01", "G02", "B02", "P02", "R02", "Y02", "G03", "B03", "P03", "R03", "Y03", "G04", "B04", "P04", "G01"], "NEXT_ROOM"],
    [102, ["G01", "COIN50", "R04", "Y04", "G05", "B05", "P05", "R05", "Y05", "Y01", "Y05", "R05", "P05", "B05", "G05", "ENERGY10", "BOARD1", "Y05", "R01", "COIN50"], "NEXT_ROOM"],
    [103, ["G01", "B01", "P01", "R01", "Y01", "COIN50", "G05", "B05", "P05", "R05", "Y05", "ENERGY10", "G02", "B02", "P02", "R02", "Y02", "BOARD1", "R05", "Y05"], "LOOP_THIS_ROOM"]
  ];
  var defaultTables = {
    ActivityConfig: [{ periodId, startAt: "2026-09-29T03:00:00+08:00", endAt: "2026-10-06T03:00:00+08:00", dayCutHour: 3, minLevel: 7, requiredWave: 6, initialTickets: 3, settlementDays: 2, switchState: "OPEN", timeTrusted: true, guideGiftTickets: 0 }],
    SupplyRules: [
      { ruleId: "ORDER_01", source: "ORDER_SETTLED", scope: "模拟一次符合条件的订单成功提交及奖励结算", tier: "DEFAULT", method: "FIXED", hitRate: 1, ticketsOnHit: 5, dailyCap: -1, periodCap: -1, unit: "SUCCESS_EVENT" },
      { ruleId: "GEN_01", source: "GENERATOR_OUTPUT", scope: "模拟一次符合条件的生成器有效产出", tier: "DEFAULT", method: "HIT_PROBABILITY", hitRate: 0.5, ticketsOnHit: 2, dailyCap: -1, periodCap: -1, unit: "SUCCESSFUL_OUTPUT_EVENT" }
    ],
    PlayerLayers: [{ layerId: "DEFAULT", sequenceGroup: "SEQ_A", selection: "FIXED", initialRoomId: 101, initialIndex: 1 }],
    DrawTiers: [1, 3, 5, 10].map((reads, i) => ({ tierId: `X${reads}`, singleCost: 1, ticketCost: reads, reads, sortOrder: i + 1 })),
    GachaToy: qualities.flatMap(([qualityId, collectionId, , prefix, items]) => items.map((item, i) => {
      const [name, shapeKey] = item.split("|");
      return { toyId: `${prefix}0${i + 1}`, name, qualityId, collectionId, shapeKey, sortOrder: i + 1 };
    })),
    QualityConvert: qualities.map(([qualityId], i) => ({ qualityId, pointResourceId: "EVENT_POINT", pointsPerDuplicate: [1, 2, 3, 5, 10][i] })),
    RewardCatalog: [
      reward("COIN50", "金币", "COIN", 50, "MOCK_CREDIT", "coin_stack", "扭蛋序列"),
      reward("COIN100", "金币", "COIN", 100, "MOCK_CREDIT", "coin_stack", "品质及商品"),
      reward("COIN300", "金币", "COIN", 300, "MOCK_CREDIT", "coin_chest", "全收藏大奖"),
      reward("ENERGY10", "主线体力", "MAIN_ENERGY", 10, "MOCK_CREDIT", "energy_bolt", "扭蛋序列及阶段"),
      reward("ENERGY20", "主线体力", "MAIN_ENERGY", 20, "MOCK_CREDIT", "energy_bolt", "品质及商品"),
      reward("ENERGY40", "主线体力", "MAIN_ENERGY", 40, "MOCK_CREDIT", "energy_flask", "全收藏大奖"),
      reward("BOARD1", "星纹道具箱", "BOARD_ITEM", 1, "MOCK_PENDING", "star_crate", "仅记录模拟待领奖"),
      reward("BOARD2", "星纹道具箱", "BOARD_ITEM", 2, "MOCK_PENDING", "star_crate", "仅记录模拟待领奖")
    ],
    GachaSequence: rooms.map(([roomId, ids, endRule]) => ({ periodId, layerId: "DEFAULT", sequenceGroup: "SEQ_A", roomId, orderedRewardsJson: JSON.stringify(ids), endRule })),
    ProgressNodes: [
      node("PT01", "POINT", "累计1分", 1, "ALL", ["COIN50"], "AUTO", 1, "point_stage_awarded"),
      node("PT02", "POINT", "累计5分", 5, "ALL", ["ENERGY10"], "AUTO", 2, "point_stage_awarded"),
      node("PT03", "POINT", "累计15分", 15, "ALL", ["BOARD1"], "AUTO", 3, "point_stage_awarded"),
      node("PT04", "POINT", "累计30分", 30, "ALL", ["COIN100"], "AUTO", 4, "point_stage_awarded"),
      node("PT05", "POINT", "累计55分", 55, "ALL", ["ENERGY20", "BOARD1"], "AUTO", 5, "point_stage_awarded"),
      node("COL_GREEN", "QUALITY", "绿色玩具5/5", 5, "COL_GREEN", ["COIN100"], "MANUAL", 6, "quality_reward_claimed"),
      node("COL_BLUE", "QUALITY", "蓝色玩具5/5", 5, "COL_BLUE", ["ENERGY20"], "MANUAL", 7, "quality_reward_claimed"),
      node("COL_PURPLE", "QUALITY", "紫色玩具5/5", 5, "COL_PURPLE", ["BOARD1"], "MANUAL", 8, "quality_reward_claimed"),
      node("COL_RED", "QUALITY", "红色玩具5/5", 5, "COL_RED", ["COIN100", "BOARD1"], "MANUAL", 9, "quality_reward_claimed"),
      node("COL_GOLD", "QUALITY", "金色玩具5/5", 5, "COL_GOLD", ["ENERGY20", "BOARD1"], "MANUAL", 10, "quality_reward_claimed"),
      node("COL_ALL", "COMPLETE", "全部玩具25/25", 25, "ALL", ["COIN300", "ENERGY40", "BOARD2"], "AUTO", 11, "collection_completed")
    ],
    GachaShop: [
      { id: "SHOP01", rewardId: "COIN100", pointPrice: 3, exchangeLimit: -1, sortOrder: 1 },
      { id: "SHOP02", rewardId: "ENERGY20", pointPrice: 10, exchangeLimit: 3, sortOrder: 2 },
      { id: "SHOP03", rewardId: "BOARD2", pointPrice: 25, exchangeLimit: 1, sortOrder: 3 }
    ],
    UiCopy: [
      text("TITLE", "machine", "七天扭蛋奇遇", 1),
      text("COVER", "cover", "扭动旋钮，收集25件玩具！重复玩具会化作积分，集齐后解锁兑换商店。", 1),
      text("TICKET_LOW", "machine", "扭蛋券不足，请完成订单或使用主线生成器获取", 2),
      text("SHOP_LOCK", "shop", "需要集齐全部收藏解锁兑换商城", 1),
      text("POINT_LOW", "shop", "积分不足，请继续扭蛋获取", 2),
      text("INFO_SCOPE", "info", "以下为当前分层固定序列的投放占比，不是下一抽独立概率；首次玩具点亮收藏，重复玩具按品质转化积分。×3、×5、×10连续读取对应项数。显示百分比可能因四舍五入产生尾差。", 1),
      text("RULE_SUPPLY", "rulesGuide", "符合条件的订单结算或生成器有效产出可获得扭蛋券。本Demo请主动点击Debug模拟供券；正式截止后停止外部供券。", 1),
      text("RULE_DRAW", "rulesGuide", "选择倍率并消耗对应扭蛋券，按房间与序列顺序逐项抽取；批量倍率不放大奖励数量。", 2),
      text("RULE_COLLECT", "rulesGuide", "收集绿、蓝、紫、红、金各5件玩具。各品质集齐后手动领奖；25件全收集后自动领取大奖并解锁商店。", 3),
      text("RULE_POINT", "rulesGuide", "重复玩具分别转化1、2、3、5、10分。累计积分达标自动领奖；兑换仅消耗可用积分，不回退累计进度。", 4),
      text("RULE_END", "rulesGuide", "全收藏后仍可抽取和兑换。到期停止外部供券；离开到期会话并完成补发后，剩余扭蛋券与积分清零，不继承下期。", 5),
      text("GUIDE_1", "rulesGuide", "先看扭蛋券：订单结算和生成器有效产出是券的外部来源，使用Debug可分别模拟成功或失败。", 11),
      text("GUIDE_2", "rulesGuide", "选择×1、×3、×5或×10；每档连续抽取对应数量的序列结果。", 12),
      text("GUIDE_3", "rulesGuide", "新玩具点亮收藏；同一件再出现会转化为积分。", 13),
      text("GUIDE_4", "rulesGuide", "查看五条品质收藏线，满5件后记得手动领取品质奖励。", 14),
      text("GUIDE_5", "rulesGuide", "累计积分会点亮机台上方的阶段奖章；可用积分留待全收藏后兑换。", 15),
      text("SHOP_UNLOCK", "shop", "25件玩具已集齐！积分兑换商店现已开放。", 3),
      text("END", "ending", "本期扭蛋奇遇已结束。已达成而未到账的奖励将在结束说明后补发。", 1),
      text("TIME_UNKNOWN", "unavailable", "服务器时间尚未确认，活动暂为只读；不会清理已有资产。", 1),
      text("SAVE_ERROR", "unavailable", "活动存档暂不可用，抽取和兑换已暂停，避免重复扣费或发奖。", 2)
    ],
    VisualTheme: [{ themeId: "GACHA_NIGHT", background: "#201B45", machine: "#D94F61", glass: "#82D9E9", gold: "#F5C96D", surface: "#FFF4DF", qualityColorsJson: JSON.stringify({ GREEN: "#65C887", BLUE: "#65B8ED", PURPLE: "#A482EB", RED: "#EC7280", GOLD: "#F3C45B" }), fontStack: "system-ui, 'PingFang SC', 'Microsoft YaHei', sans-serif", titlePx: 26, bodyPx: 15, spacingJson: "[8,12,16,24]", radiusPx: 18, outlinePx: 3, shadow: "0 5px 0 #793744, 0 16px 32px rgba(16,12,43,.35)", motionMs: 850, minTouchPx: 44 }]
  };

  // project:src/config.js
  var TABLE_IDS = [
    "ActivityConfig",
    "SupplyRules",
    "PlayerLayers",
    "DrawTiers",
    "GachaToy",
    "QualityConvert",
    "RewardCatalog",
    "GachaSequence",
    "ProgressNodes",
    "GachaShop",
    "UiCopy",
    "VisualTheme"
  ];
  var JSON_FIELDS = {
    GachaSequence: { orderedRewardsJson: "orderedRewards" },
    ProgressNodes: { rewardIdsJson: "rewardIds" },
    VisualTheme: {
      qualityColorsJson: "qualityColors",
      spacingJson: "spacing"
    }
  };
  var QUALITY_IDS = ["GREEN", "BLUE", "PURPLE", "RED", "GOLD"];
  var own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  var positiveInteger = (value) => Number.isInteger(value) && value > 0;
  function rowsFor(sdk, id, errors) {
    const table2 = sdk?.tables?.[id];
    if (table2 && Object.prototype.hasOwnProperty.call(table2, "rows") && !Array.isArray(table2.rows)) {
      errors.push(`${id}：rows 不是数组`);
      return [];
    }
    const sources = table2?.rows?.length ? table2.rows : defaultTables[id];
    return sources.map((source, index) => {
      if (!source || typeof source !== "object" || Array.isArray(source)) {
        errors.push(`${id}[${index}]：行不是对象`);
        return {};
      }
      const row = { ...source };
      for (const [field, target] of Object.entries(JSON_FIELDS[id] || {})) {
        try {
          if (typeof source[field] !== "string") throw new Error("需要 JSON 字符串");
          row[target] = JSON.parse(source[field]);
        } catch (error) {
          errors.push(`${id}[${index}].${field}：${error.message}`);
          row[target] = null;
        }
      }
      return row;
    });
  }
  function loadConfig(sdk) {
    const errors = [];
    const tables = {};
    const injected = sdk?.tables ? {
      ActivityConfig: sdk.tables["ActivityConfig"],
      SupplyRules: sdk.tables["SupplyRules"],
      PlayerLayers: sdk.tables["PlayerLayers"],
      DrawTiers: sdk.tables["DrawTiers"],
      GachaToy: sdk.tables["GachaToy"],
      QualityConvert: sdk.tables["QualityConvert"],
      RewardCatalog: sdk.tables["RewardCatalog"],
      GachaSequence: sdk.tables["GachaSequence"],
      ProgressNodes: sdk.tables["ProgressNodes"],
      GachaShop: sdk.tables["GachaShop"],
      UiCopy: sdk.tables["UiCopy"],
      VisualTheme: sdk.tables["VisualTheme"]
    } : {};
    for (const id of TABLE_IDS) tables[id] = rowsFor({ tables: injected }, id, errors);
    const activity = tables.ActivityConfig[0] || null;
    if (!injected.GachaSequence?.rows?.length && activity?.periodId) {
      tables.GachaSequence = tables.GachaSequence.map((row) => ({ ...row, periodId: activity.periodId }));
    }
    if (tables.ActivityConfig.length !== 1) {
      errors.push("ActivityConfig：本次活动需要且仅需要一行期次配置");
    }
    if (tables.VisualTheme.length !== 1) {
      errors.push("VisualTheme：本次活动需要且仅需要一行主题配置");
    }
    const config = {
      tables,
      activity,
      supplyRules: tables.SupplyRules,
      playerLayers: tables.PlayerLayers,
      drawTiers: tables.DrawTiers,
      toys: tables.GachaToy,
      qualityConvert: tables.QualityConvert,
      rewards: tables.RewardCatalog,
      sequence: tables.GachaSequence,
      nodes: tables.ProgressNodes,
      shop: tables.GachaShop,
      copy: tables.UiCopy,
      theme: tables.VisualTheme[0] || null,
      errors
    };
    for (const id of TABLE_IDS) config[id] = tables[id];
    config.gachaSequence = config.sequence;
    config.progressNodes = config.nodes;
    config.gachaShop = config.shop;
    config.rewardCatalog = config.rewards;
    config.gachaToy = config.toys;
    config.uiCopy = config.copy;
    config.copyById = Object.fromEntries(config.copy.map((row) => [row.copyId, row.text]));
    return config;
  }
  function validateConfig(config) {
    if (!config || typeof config !== "object") return ["配置未加载"];
    const errors = [...Array.isArray(config.errors) ? config.errors : []];
    const list = (name, alias) => Array.isArray(config[name]) ? config[name] : Array.isArray(config.tables?.[alias]) ? config.tables[alias] : [];
    const activity = config.activity;
    const layers = list("playerLayers", "PlayerLayers");
    const tiers = list("drawTiers", "DrawTiers");
    const toys2 = list("toys", "GachaToy");
    const converts = list("qualityConvert", "QualityConvert");
    const rewards = list("rewards", "RewardCatalog");
    const rooms2 = list("sequence", "GachaSequence");
    const nodes = list("nodes", "ProgressNodes");
    const shop2 = list("shop", "GachaShop");
    const supply = list("supplyRules", "SupplyRules");
    const copies = list("copy", "UiCopy");
    const theme = config.theme;
    const unique = (rows3, field, table2) => {
      const seen = /* @__PURE__ */ new Set();
      for (const [i, row] of rows3.entries()) {
        const value = row[field];
        if (value === void 0 || value === null || value === "") {
          errors.push(`${table2}[${i}]：缺少 ${field}`);
        } else if (seen.has(value)) {
          errors.push(`${table2}：重复 ${field}=${value}`);
        }
        seen.add(value);
      }
    };
    const toyIds = new Set(toys2.map((row) => row.toyId));
    const rewardIds = new Set(rewards.map((row) => row.rewardId));
    const layerIds = new Set(layers.map((row) => row.layerId));
    const nodeIds = new Set(nodes.map((row) => row.nodeId));
    const referenceReward = (id, source) => {
      if (!toyIds.has(id) && !rewardIds.has(id)) errors.push(`${source}：不存在奖励或玩具 ${id}`);
    };
    if (!activity) errors.push("ActivityConfig：缺少活动期次");
    else {
      if (!activity.periodId) errors.push("ActivityConfig：缺少 periodId");
      const start = Date.parse(activity.startAt);
      const end = Date.parse(activity.endAt);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        errors.push("ActivityConfig：开始／截止时间无效或顺序错误");
      } else if (end - start !== 7 * 864e5) {
        errors.push("ActivityConfig.endAt：必须为 startAt 后七天；本期时长是已确认策划规则");
      }
      if (activity.dayCutHour !== 3) errors.push("ActivityConfig.dayCutHour：已确认值为 3");
      if (activity.minLevel !== 7) errors.push("ActivityConfig.minLevel：已确认值为 7");
      if (activity.requiredWave !== 6) errors.push("ActivityConfig.requiredWave：已确认值为 6");
      if (activity.settlementDays !== 2) errors.push("ActivityConfig.settlementDays：已确认值为 2");
      for (const field of ["initialTickets", "guideGiftTickets"]) {
        if (!Number.isInteger(activity[field]) || activity[field] < 0) errors.push(`ActivityConfig：${field} 必须为非负整数`);
      }
      if (!["OPEN", "SOFT_OFF", "HARD_OFF"].includes(activity.switchState)) errors.push("ActivityConfig：switchState 无效");
      if (typeof activity.timeTrusted !== "boolean") errors.push("ActivityConfig：timeTrusted 必须为布尔值");
    }
    unique(layers, "layerId", "PlayerLayers");
    unique(tiers, "tierId", "DrawTiers");
    unique(toys2, "toyId", "GachaToy");
    unique(converts, "qualityId", "QualityConvert");
    unique(rewards, "rewardId", "RewardCatalog");
    unique(nodes, "nodeId", "ProgressNodes");
    unique(shop2, "id", "GachaShop");
    unique(supply, "ruleId", "SupplyRules");
    unique(copies, "copyId", "UiCopy");
    if (layers.length === 0) errors.push("PlayerLayers：至少需要一个适用分层");
    const roomKeys = /* @__PURE__ */ new Set();
    for (const [i, room] of rooms2.entries()) {
      const where = `GachaSequence[${i}]`;
      if (room.periodId !== activity?.periodId) errors.push(`${where}：periodId 未关联当前期次`);
      if (!layerIds.has(room.layerId)) errors.push(`${where}：未找到分层 ${room.layerId}`);
      if (!positiveInteger(room.roomId)) errors.push(`${where}：roomId 必须为正整数`);
      const key = `${room.layerId}/${room.sequenceGroup}/${room.roomId}`;
      if (roomKeys.has(key)) errors.push(`${where}：重复房间 ${key}`);
      roomKeys.add(key);
      if (!["NEXT_ROOM", "LOOP_THIS_ROOM"].includes(room.endRule)) errors.push(`${where}：endRule 无效`);
      if (!Array.isArray(room.orderedRewards) || room.orderedRewards.length < 20) {
        errors.push(`${where}：有序奖励须为至少 20 项的 JSON 数组`);
      } else {
        room.orderedRewards.forEach((id, j) => referenceReward(id, `${where}.orderedRewards[${j}]`));
      }
    }
    for (const layer of layers) {
      for (const source of ["ORDER_SETTLED", "GENERATOR_OUTPUT"]) {
        const matches = supply.filter((rule) => rule.tier === layer.layerId && rule.source === source);
        if (matches.length !== 1) {
          errors.push(`SupplyRules：分层 ${layer.layerId} 的 ${source} 规则需要且仅需要一条，当前 ${matches.length} 条`);
        }
      }
      if (layer.selection !== "FIXED") errors.push(`PlayerLayers ${layer.layerId}：演示仅支持 FIXED；不可将随机选组误写为固定投放占比`);
      if (!positiveInteger(layer.initialIndex)) errors.push(`PlayerLayers ${layer.layerId}：initialIndex 须从 1 开始`);
      const selected = rooms2.filter((room) => room.layerId === layer.layerId && room.sequenceGroup === layer.sequenceGroup).sort((a, b) => a.roomId - b.roomId);
      if (!selected.length) {
        errors.push(`PlayerLayers ${layer.layerId}：找不到序列组 ${layer.sequenceGroup}`);
        continue;
      }
      const first = selected.find((room) => room.roomId === layer.initialRoomId);
      if (!first || layer.initialIndex > (first.orderedRewards?.length || 0)) {
        errors.push(`PlayerLayers ${layer.layerId}：初始房间或读取位置无效`);
      }
      selected.forEach((room, i) => {
        if (i < selected.length - 1 && room.endRule !== "NEXT_ROOM") errors.push(`GachaSequence 房间 ${room.roomId}：后续有房间时应使用 NEXT_ROOM`);
        if (i === selected.length - 1 && room.endRule !== "LOOP_THIS_ROOM") errors.push(`GachaSequence 房间 ${room.roomId}：末房间需配置 LOOP_THIS_ROOM，以保证继续抽取`);
      });
      const initialRoomOffset = selected.findIndex((room) => room.roomId === layer.initialRoomId);
      if (initialRoomOffset >= 0) {
        const reachable = new Set(selected.slice(initialRoomOffset).flatMap((room, offset) => Array.isArray(room.orderedRewards) ? room.orderedRewards.slice(offset === 0 ? layer.initialIndex - 1 : 0) : []));
        const missing = toys2.filter((toy) => !reachable.has(toy.toyId)).map((toy) => toy.toyId);
        if (missing.length) errors.push(`序列 ${layer.sequenceGroup}：从初始游标 ${layer.initialRoomId}/${layer.initialIndex} 无法读取玩具 ${missing.join("、")}，不能完成收藏`);
      }
    }
    if (tiers.length !== 4 || new Set(tiers.map((row) => row.reads)).size !== 4 || ![1, 3, 5, 10].every((n) => tiers.some((row) => row.reads === n))) {
      errors.push("DrawTiers：须提供 ×1、×3、×5、×10 四档");
    }
    const singleCosts = new Set(tiers.map((row) => row.singleCost));
    if (singleCosts.size !== 1 || !positiveInteger(tiers[0]?.singleCost)) errors.push("DrawTiers：四档 singleCost 须为相同正整数");
    for (const tier2 of tiers) {
      if (!positiveInteger(tier2.reads) || tier2.ticketCost !== tier2.singleCost * tier2.reads) errors.push(`DrawTiers ${tier2.tierId}：ticketCost 必须等于 singleCost × reads`);
    }
    if (toys2.length !== 25) errors.push(`GachaToy：须有 25 件不同玩具，当前 ${toys2.length} 件`);
    for (const quality of QUALITY_IDS) {
      const members = toys2.filter((toy) => toy.qualityId === quality);
      if (members.length !== 5) errors.push(`GachaToy：${quality} 须有 5 件玩具`);
      if (!converts.some((row) => row.qualityId === quality)) errors.push(`QualityConvert：缺少 ${quality}`);
      const collections = new Set(members.map((row) => row.collectionId));
      if (collections.size !== 1 || !nodeIds.has(members[0]?.collectionId)) errors.push(`GachaToy：${quality} 的收藏组未关联 ProgressNodes`);
    }
    const confirmedPoints = { GREEN: 1, BLUE: 2, PURPLE: 3, RED: 5, GOLD: 10 };
    for (const row of converts) {
      if (!QUALITY_IDS.includes(row.qualityId) || !row.pointResourceId || !positiveInteger(row.pointsPerDuplicate)) {
        errors.push(`QualityConvert ${row.qualityId}：品质、积分资源或转化数量无效`);
      } else if (row.pointsPerDuplicate !== confirmedPoints[row.qualityId]) {
        errors.push(`QualityConvert ${row.qualityId}.pointsPerDuplicate：已确认值为 ${confirmedPoints[row.qualityId]}`);
      }
    }
    for (const row of rewards) {
      if (!positiveInteger(row.quantity) || !["COIN", "MAIN_ENERGY", "BOARD_ITEM"].includes(row.rewardType) || !["MOCK_CREDIT", "MOCK_PENDING"].includes(row.delivery) || !row.iconKey) {
        errors.push(`RewardCatalog ${row.rewardId}：数量、类型、承接方式或图标无效`);
      }
    }
    const pointNodes2 = nodes.filter((row) => row.nodeType === "POINT").sort((a, b) => a.target - b.target);
    const qualityNodes = nodes.filter((row) => row.nodeType === "QUALITY");
    const completeNodes = nodes.filter((row) => row.nodeType === "COMPLETE");
    if (pointNodes2.length !== 5 || qualityNodes.length !== 5 || completeNodes.length !== 1) errors.push("ProgressNodes：需要五个积分节点、五个品质节点和一个全收藏节点");
    for (const [i, node2] of nodes.entries()) {
      if (!positiveInteger(node2.target) || !positiveInteger(node2.sortOrder)) errors.push(`ProgressNodes[${i}]：target 或 sortOrder 无效`);
      if (!["POINT", "QUALITY", "COMPLETE"].includes(node2.nodeType)) errors.push(`ProgressNodes[${i}]：nodeType 无效`);
      if (node2.claimMode !== (node2.nodeType === "QUALITY" ? "MANUAL" : "AUTO")) errors.push(`ProgressNodes[${i}]：领取方式与节点类型不符`);
      if (typeof node2.eventName !== "string" || !node2.eventName.trim()) errors.push(`ProgressNodes[${i}].eventName：必须填写非空语义事件名`);
      if (node2.nodeType === "QUALITY" && (node2.target !== 5 || !toys2.some((toy) => toy.collectionId === node2.collectionId))) errors.push(`ProgressNodes[${i}]：品质节点应关联五件玩具`);
      if (node2.nodeType === "COMPLETE" && node2.target !== toys2.length) errors.push(`ProgressNodes[${i}]：全收藏目标与玩具数量不符`);
      if (!Array.isArray(node2.rewardIds) || !node2.rewardIds.length) errors.push(`ProgressNodes[${i}]：rewardIdsJson 须为非空数组`);
      else node2.rewardIds.forEach((id) => {
        if (!rewardIds.has(id)) errors.push(`ProgressNodes[${i}]：不存在 RewardCatalog 奖励 ${id}`);
      });
    }
    pointNodes2.forEach((node2, i) => {
      if (i && node2.target <= pointNodes2[i - 1].target) errors.push("ProgressNodes：积分门槛必须严格递增");
    });
    for (const item of shop2) {
      if (!rewardIds.has(item.rewardId) || !positiveInteger(item.pointPrice) || !(item.exchangeLimit === -1 || positiveInteger(item.exchangeLimit))) {
        errors.push(`GachaShop ${item.id}：奖励引用、价格或兑换上限无效`);
      }
    }
    for (const rule of supply) {
      if (!layerIds.has(rule.tier) || !["ORDER_SETTLED", "GENERATOR_OUTPUT"].includes(rule.source) || !["FIXED", "HIT_PROBABILITY"].includes(rule.method) || !Number.isFinite(rule.hitRate) || rule.hitRate < 0 || rule.hitRate > 1 || !positiveInteger(rule.ticketsOnHit) || ![rule.dailyCap, rule.periodCap].every((n) => n === -1 || Number.isInteger(n) && n >= 0)) {
        errors.push(`SupplyRules ${rule.ruleId}：分层、来源、命中率、发券数或上限无效`);
      }
    }
    if (!supply.some((row) => row.source === "ORDER_SETTLED") || !supply.some((row) => row.source === "GENERATOR_OUTPUT")) errors.push("SupplyRules：订单和生成器供券规则均不可缺少");
    if (!theme || !theme.background || !theme.machine || !theme.glass || !theme.surface || !theme.gold || !theme.fontStack || !theme.shadow || !theme.qualityColors || typeof theme.qualityColors !== "object" || !QUALITY_IDS.every((id) => typeof theme.qualityColors[id] === "string") || !Array.isArray(theme.spacing) || !theme.spacing.every(positiveInteger) || !positiveInteger(theme.motionMs) || !positiveInteger(theme.minTouchPx) || theme.minTouchPx < 44) {
      errors.push("VisualTheme：主题字段、品质色、间距、动效或最小触控尺寸无效");
    }
    return [...new Set(errors)];
  }
  function getSequenceShares(config, layerId, scope = "FULL") {
    const layers = config?.playerLayers || config?.tables?.PlayerLayers || [];
    const rooms2 = config?.sequence || config?.tables?.GachaSequence || [];
    const toys2 = config?.toys || config?.tables?.GachaToy || [];
    const rewards = config?.rewards || config?.tables?.RewardCatalog || [];
    const converts = config?.qualityConvert || config?.tables?.QualityConvert || [];
    const layer = layers.find((row) => row.layerId === layerId);
    if (!layer || layer.selection !== "FIXED") return [];
    let selected = rooms2.filter((row) => row.layerId === layerId && row.sequenceGroup === layer.sequenceGroup && row.periodId === config?.activity?.periodId).sort((a, b) => a.roomId - b.roomId);
    const scopeName = typeof scope === "string" ? scope.toUpperCase() : "";
    if (scopeName === "LOOP" || scopeName === "LAST_ROOM") {
      selected = selected.filter((row) => row === selected[selected.length - 1] && row.endRule === "LOOP_THIS_ROOM");
    } else if (scope && typeof scope === "object" && own(scope, "roomId")) {
      selected = selected.filter((row) => row.roomId === scope.roomId);
    } else if (!["FULL", "ALL", "SEQUENCE", ""].includes(scopeName)) {
      return [];
    }
    const entries = selected.flatMap((row) => Array.isArray(row.orderedRewards) ? row.orderedRewards : typeof row.orderedRewardsJson === "string" ? safeArray(row.orderedRewardsJson) : []);
    if (!entries.length) return [];
    const counts = /* @__PURE__ */ new Map();
    for (const id of entries) counts.set(id, (counts.get(id) || 0) + 1);
    const qualityRank = (id) => QUALITY_IDS.indexOf(id);
    const orderedToys = [...toys2].sort((a, b) => qualityRank(a.qualityId) - qualityRank(b.qualityId) || a.sortOrder - b.sortOrder);
    const items = [
      ...orderedToys.map((toy) => ({
        rewardId: toy.toyId,
        toyId: toy.toyId,
        name: toy.name,
        quantity: 1,
        qualityId: toy.qualityId,
        iconKey: toy.shapeKey,
        shapeKey: toy.shapeKey,
        duplicatePoints: converts.find((row) => row.qualityId === toy.qualityId)?.pointsPerDuplicate ?? null,
        rewardType: "TOY",
        type: "TOY"
      })),
      ...rewards.filter((row) => counts.has(row.rewardId)).map((row) => ({
        rewardId: row.rewardId,
        name: row.name,
        quantity: row.quantity,
        qualityId: null,
        iconKey: row.iconKey,
        duplicatePoints: null,
        rewardType: row.rewardType,
        type: row.rewardType
      }))
    ];
    const total = entries.length;
    const populated = items.filter((item) => counts.has(item.rewardId));
    const minimumPercent = Math.min(...populated.map((item) => counts.get(item.rewardId) / total * 100));
    const digits = Math.min(10, Math.max(
      2,
      Math.ceil(Math.log10((populated.length + 1) / minimumPercent))
    ));
    const scale = 10 ** digits;
    const totalUnits = 100 * scale;
    let roundedUnits = 0;
    return items.map((item) => {
      const count = counts.get(item.rewardId) || 0;
      const units = count && item === populated[populated.length - 1] ? totalUnits - roundedUnits : Math.round(count / total * totalUnits);
      if (!(count && item === populated[populated.length - 1])) roundedUnits += units;
      const percent = units / scale;
      return {
        ...item,
        count,
        total,
        percentage: percent,
        percent,
        displayValue: `${percent.toFixed(digits)}%`,
        displayDigits: digits,
        exactShare: count / total,
        displayBasis: "FIXED_SEQUENCE_SHARE",
        layerId,
        sequenceGroup: layer.sequenceGroup,
        scope: scopeName === "LOOP" || scopeName === "LAST_ROOM" ? "LOOP" : scope && typeof scope === "object" ? `ROOM_${scope.roomId}` : "FULL",
        roomIds: selected.map((row) => row.roomId)
      };
    });
  }
  function safeArray(json) {
    try {
      const value = JSON.parse(json);
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  // project:src/persistence.js
  var PREFIX = "activity-studio:gacha:v1:";
  var FORMAT = "GACHA_SAVE_V1";
  function createPersistence(periodId3) {
    if (typeof periodId3 !== "string" || !periodId3.trim()) {
      throw new TypeError("活动期次 periodId 必须是非空字符串");
    }
    const key = PREFIX + encodeURIComponent(periodId3);
    let mode = "READY";
    let lastDurableSave = null;
    let error = "";
    function clone3(value) {
      return JSON.parse(JSON.stringify(value));
    }
    function fail(cause) {
      mode = "READ_ONLY";
      error = cause instanceof Error ? cause.message : String(cause);
    }
    function storage() {
      if (typeof localStorage === "undefined") {
        throw new Error("localStorage 不可用");
      }
      return localStorage;
    }
    function decode(text2) {
      const record2 = JSON.parse(text2);
      if (!record2 || typeof record2 !== "object" || Array.isArray(record2)) {
        throw new Error("活动存档格式无效");
      }
      if (record2.format === FORMAT) {
        if (record2.periodId !== periodId3 || !Object.hasOwn(record2, "save")) {
          throw new Error("活动存档期次或结构不匹配");
        }
        if (record2.save === null) return null;
        if (!record2.save || typeof record2.save !== "object" || Array.isArray(record2.save)) {
          throw new Error("活动存档内容无效");
        }
        if (record2.save.periodId !== periodId3) {
          throw new Error("活动存档期次不匹配");
        }
        return record2.save;
      }
      if (record2.periodId === periodId3) return record2;
      throw new Error("活动存档格式或期次不匹配");
    }
    function load() {
      if (mode === "READ_ONLY") {
        return lastDurableSave === null ? null : clone3(lastDurableSave);
      }
      try {
        const raw = storage().getItem(key);
        if (raw === null) {
          lastDurableSave = null;
          return null;
        }
        const save = decode(raw);
        lastDurableSave = save === null ? null : clone3(save);
        return save === null ? null : clone3(save);
      } catch (cause) {
        fail(cause);
        return lastDurableSave === null ? null : clone3(lastDurableSave);
      }
    }
    function commit(save) {
      if (mode === "READ_ONLY") {
        return { ok: false, error: error || "活动存档只读，未执行提交" };
      }
      try {
        if (!save || typeof save !== "object" || Array.isArray(save) || save.periodId !== periodId3) {
          throw new Error("提交的活动存档期次或结构无效");
        }
        const encoded = JSON.stringify({ format: FORMAT, periodId: periodId3, save });
        if (typeof encoded !== "string") throw new Error("活动存档无法序列化");
        const next = decode(encoded);
        const store = storage();
        store.setItem(key, encoded);
        if (store.getItem(key) !== encoded) {
          throw new Error("活动存档写入后校验失败");
        }
        lastDurableSave = clone3(next);
        return { ok: true };
      } catch (cause) {
        fail(cause);
        return { ok: false, error };
      }
    }
    function resetTestInstance() {
      if (mode === "READ_ONLY") return false;
      try {
        const marker = JSON.stringify({ format: FORMAT, periodId: periodId3, save: null });
        const store = storage();
        store.setItem(key, marker);
        if (store.getItem(key) !== marker) {
          throw new Error("重新试玩存档标记校验失败");
        }
        lastDurableSave = null;
        return true;
      } catch (cause) {
        fail(cause);
        return false;
      }
    }
    return {
      load,
      commit,
      resetTestInstance,
      status: () => mode
    };
  }

  // project:src/progress.js
  var rows = (config) => config?.nodes || config?.tables?.ProgressNodes || [];
  var toys = (config) => config?.toys || config?.tables?.GachaToy || [];
  function ownedIds(state) {
    const value = state?.ownedToyIds;
    if (value instanceof Set) return value;
    if (Array.isArray(value)) return new Set(value);
    if (value && typeof value === "object") {
      return new Set(Object.keys(value).filter((id) => Boolean(value[id])));
    }
    return /* @__PURE__ */ new Set();
  }
  function isClaimed(state, nodeId) {
    const claims = state?.nodeClaims;
    const entry2 = Array.isArray(claims) ? claims.includes(nodeId) : claims?.[nodeId];
    if (entry2 === true || entry2 === "CLAIMED") return true;
    if (!entry2 || typeof entry2 !== "object") return false;
    return entry2.claimed === true || entry2.awarded === true || entry2.status === "CLAIMED" || entry2.status === "AWARDED";
  }
  function attainedCount(state, config, node2) {
    if (node2.nodeType === "POINT") return Number(state?.totalPoints) || 0;
    const owned2 = ownedIds(state);
    if (node2.nodeType === "COMPLETE") {
      return toys(config).filter((toy) => owned2.has(toy.toyId)).length;
    }
    return toys(config).filter(
      (toy) => toy.collectionId === node2.collectionId && owned2.has(toy.toyId)
    ).length;
  }
  function getNodeStatus(state, config, nodeId) {
    const node2 = rows(config).find((item) => item.nodeId === nodeId);
    if (!node2) return null;
    const current = attainedCount(state, config, node2);
    const target = Number(node2.target);
    const reached = Number.isFinite(target) && current >= target;
    const claimed2 = isClaimed(state, nodeId);
    return {
      nodeId,
      nodeType: node2.nodeType,
      label: node2.label,
      collectionId: node2.collectionId,
      claimMode: node2.claimMode,
      current,
      target,
      reached,
      claimed: claimed2,
      claimable: reached && !claimed2 && node2.claimMode === "MANUAL",
      // 自动节点的 REACHED 只表示事务中待结算，不允许玩家手动领奖。
      status: claimed2 ? "CLAIMED" : reached ? node2.claimMode === "MANUAL" ? "CLAIMABLE" : "REACHED" : "LOCKED"
    };
  }
  function resolveReachedNodes(state, config) {
    return [...rows(config)].filter((node2) => getNodeStatus(state, config, node2.nodeId)?.reached && !isClaimed(state, node2.nodeId)).sort((a, b) => {
      const rank = (node2) => node2.nodeType === "POINT" ? 0 : node2.nodeType === "QUALITY" ? 1 : 2;
      return rank(a) - rank(b) || (a.nodeType === "POINT" ? a.target - b.target : 0) || a.sortOrder - b.sortOrder;
    }).map((node2) => node2.nodeId);
  }

  // project:src/telemetry.js
  var clone = (value) => JSON.parse(JSON.stringify(value));
  var claimed = (status) => status?.claimed === true;
  function stageProgressEvents(before, draft, config) {
    draft.progressOutbox || (draft.progressOutbox = []);
    if (!Array.isArray(draft.progressOutbox)) throw new Error("进度上报队列格式无效");
    const prefix = `${draft.periodId}:${draft.testInstanceId}:progress`;
    const add = (type, index, nodeId) => {
      const id = `${prefix}:${type}:${nodeId}`;
      if (!draft.progressOutbox.some((item) => item.id === id)) {
        draft.progressOutbox.push({ id, type, index, nodeId, status: "PENDING" });
      }
    };
    config.nodes.forEach((node2, index) => {
      const previous = before && getNodeStatus(before, config, node2.nodeId);
      const next = getNodeStatus(draft, config, node2.nodeId);
      if (next?.reached && !previous?.reached) add("step_enter", index, node2.nodeId);
      if (claimed(next) && !claimed(previous) && next.reached) add("step_complete", index, node2.nodeId);
    });
    const all = (state) => config.nodes.length > 0 && config.nodes.every((node2) => {
      const status = getNodeStatus(state, config, node2.nodeId);
      return status?.reached && claimed(status);
    });
    const finalized = (state) => state?.settlement?.status === "FINALIZED" || state?.settlement?.finalized === true;
    if (all(draft) && !all(before) || finalized(draft) && !finalized(before)) {
      add("session_complete", null, "ALL");
    }
  }
  function flushProgressEvents(sdk, saved, persistence) {
    let state = saved;
    if (typeof sdk?.track !== "function") return { ok: false, state, storageFailed: false };
    for (const pending of saved.progressOutbox || []) {
      if (pending.status !== "PENDING") continue;
      try {
        if (pending.type === "session_complete") sdk.track("session_complete");
        else sdk.track(pending.type, pending.index);
      } catch {
        return { ok: false, state, storageFailed: false };
      }
      const next = clone(state);
      const item = next.progressOutbox.find((entry2) => entry2.id === pending.id);
      if (item) item.status = "ACKNOWLEDGED";
      if (!persistence.commit(next).ok) return { ok: false, state, storageFailed: true };
      state = next;
    }
    return { ok: true, state, storageFailed: false };
  }

  // project:src/rewards.js
  var toysOf = (config) => config?.toys || config?.tables?.GachaToy || [];
  var rewardsOf = (config) => config?.rewards || config?.tables?.RewardCatalog || [];
  var nodesOf = (config) => config?.nodes || config?.tables?.ProgressNodes || [];
  var convertsOf = (config) => config?.qualityConvert || config?.tables?.QualityConvert || [];
  function requireSource(sourceId) {
    if (typeof sourceId !== "string" || !sourceId.length) {
      throw new Error("奖励来源 ID 不能为空");
    }
  }
  function contains(collection2, id) {
    if (collection2 instanceof Set) return collection2.has(id);
    if (Array.isArray(collection2)) return collection2.includes(id);
    return Boolean(collection2 && typeof collection2 === "object" && collection2[id]);
  }
  function addId(draft, field, id) {
    const current = draft[field];
    if (current instanceof Set) {
      current.add(id);
    } else if (Array.isArray(current)) {
      if (!current.includes(id)) current.push(id);
    } else if (current && typeof current === "object") {
      current[id] = true;
    } else {
      draft[field] = [id];
    }
  }
  function copyResult(result) {
    return {
      ...result,
      ledgerEntries: Array.isArray(result.ledgerEntries) ? result.ledgerEntries.map((entry2) => ({ ...entry2 })) : []
    };
  }
  function claimedNode(claims, nodeId) {
    if (Array.isArray(claims)) return claims.includes(nodeId);
    const entry2 = claims?.[nodeId];
    return entry2 === true || entry2 === "CLAIMED" || Boolean(entry2 && typeof entry2 === "object" && (entry2.claimed === true || entry2.awarded === true || entry2.status === "CLAIMED" || entry2.status === "AWARDED"));
  }
  function nodeSource(draft, nodeId, config) {
    const period = draft.periodId || config?.activity?.periodId;
    const instance = draft.testInstanceId || draft.testInstance;
    return `${period}${instance == null ? "" : `:${String(instance)}`}:node:${nodeId}`;
  }
  function grantRewards(draft, rewardIds, sourceId, config) {
    requireSource(sourceId);
    if (!Array.isArray(rewardIds)) throw new Error("奖励列表必须为数组");
    if (!Array.isArray(draft.rewardLedger)) {
      if (draft.rewardLedger != null) throw new Error("奖励账本格式无效");
      draft.rewardLedger = [];
    }
    if (!rewardIds.length) return [];
    const catalog = rewardsOf(config);
    const planned = rewardIds.map((rewardId, index) => {
      const reward2 = catalog.find((row) => row.rewardId === rewardId);
      if (!reward2 || !Number.isInteger(reward2.quantity) || reward2.quantity <= 0 || !["MOCK_CREDIT", "MOCK_PENDING"].includes(reward2.delivery)) {
        throw new Error(`奖励配置无效：${String(rewardId)}`);
      }
      return {
        ledgerId: `${sourceId}:${index}`,
        sourceId,
        rewardId: reward2.rewardId,
        name: reward2.name,
        rewardType: reward2.rewardType,
        quantity: reward2.quantity,
        delivery: reward2.delivery,
        iconKey: reward2.iconKey
      };
    });
    const existing = planned.map((entry2) => draft.rewardLedger.find((record2) => record2.ledgerId === entry2.ledgerId));
    if (existing.some(Boolean)) {
      if (existing.length !== existing.filter(Boolean).length || existing.some((record2, index) => record2.rewardId !== planned[index].rewardId || record2.quantity !== planned[index].quantity || record2.delivery !== planned[index].delivery)) {
        throw new Error(`奖励来源 ${sourceId} 的账本不完整或与配置不符`);
      }
      return [];
    }
    draft.rewardLedger.push(...planned);
    return planned;
  }
  function applySequenceResult(draft, rewardId, sourceId, config) {
    requireSource(sourceId);
    const previous = draft.sequenceResults?.[sourceId];
    if (previous) {
      if (previous.rewardId !== rewardId) throw new Error(`序列来源 ${sourceId} 对应不同奖励`);
      return { ...copyResult(previous), replay: true };
    }
    if (draft.sequenceResults != null && (typeof draft.sequenceResults !== "object" || Array.isArray(draft.sequenceResults))) {
      throw new Error("序列结果存档格式无效");
    }
    const toy = toysOf(config).find((row) => row.toyId === rewardId);
    let result;
    if (toy) {
      const alreadyOwned = contains(draft.ownedToyIds, toy.toyId);
      const convert = convertsOf(config).find((row) => row.qualityId === toy.qualityId);
      if (alreadyOwned && (!convert || !Number.isInteger(convert.pointsPerDuplicate) || convert.pointsPerDuplicate <= 0)) {
        throw new Error(`玩具 ${toy.toyId} 的重复转化配置无效`);
      }
      const points = alreadyOwned ? convert.pointsPerDuplicate : 0;
      if (alreadyOwned) {
        draft.totalPoints = (Number(draft.totalPoints) || 0) + points;
        draft.availablePoints = (Number(draft.availablePoints) || 0) + points;
      } else {
        addId(draft, "ownedToyIds", toy.toyId);
        addId(draft, "newToyIds", toy.toyId);
      }
      result = {
        sourceId,
        rewardId,
        type: "TOY",
        rewardType: "TOY",
        toyId: toy.toyId,
        name: toy.name,
        qualityId: toy.qualityId,
        shapeKey: toy.shapeKey,
        quantity: 1,
        isNew: !alreadyOwned,
        isDuplicate: alreadyOwned,
        points,
        pointsDelta: points,
        ledgerEntries: []
      };
    } else {
      const reward2 = rewardsOf(config).find((row) => row.rewardId === rewardId);
      if (!reward2) throw new Error(`序列引用了不存在的奖励：${String(rewardId)}`);
      const ledgerEntries = grantRewards(draft, [rewardId], sourceId, config);
      result = {
        sourceId,
        rewardId,
        type: reward2.rewardType,
        rewardType: reward2.rewardType,
        name: reward2.name,
        quantity: reward2.quantity,
        iconKey: reward2.iconKey,
        delivery: reward2.delivery,
        isNew: false,
        isDuplicate: false,
        points: 0,
        pointsDelta: 0,
        ledgerEntries
      };
    }
    if (!draft.sequenceResults) draft.sequenceResults = {};
    draft.sequenceResults[sourceId] = copyResult(result);
    return result;
  }
  function claimNode(draft, nodeId, config) {
    const node2 = nodesOf(config).find((row) => row.nodeId === nodeId);
    if (!node2) return { ok: false, reason: "NODE_NOT_FOUND", message: "奖励节点不存在" };
    if (claimedNode(draft.nodeClaims, nodeId)) {
      return { ok: false, reason: "ALREADY_CLAIMED", message: "奖励已领取", nodeId };
    }
    const status = getNodeStatus(draft, config, nodeId);
    if (!status?.reached) {
      return { ok: false, reason: "NOT_REACHED", message: "尚未达到领取条件", nodeId };
    }
    if (!Array.isArray(node2.rewardIds) || !node2.rewardIds.length) {
      return { ok: false, reason: "INVALID_REWARD", message: "节点奖励配置无效", nodeId };
    }
    if (draft.nodeClaims != null && (typeof draft.nodeClaims !== "object" || !Array.isArray(draft.nodeClaims) && draft.nodeClaims instanceof Set)) {
      return { ok: false, reason: "INVALID_SAVE", message: "领奖存档格式无效", nodeId };
    }
    const sourceId = nodeSource(draft, nodeId, config);
    let ledgerEntries;
    try {
      ledgerEntries = grantRewards(draft, node2.rewardIds, sourceId, config);
    } catch (error) {
      return { ok: false, reason: "GRANT_FAILED", message: error.message, nodeId };
    }
    if (!ledgerEntries.length) {
      return { ok: false, reason: "INCONSISTENT_SAVE", message: "奖励账本已存在，请检查领取记录", nodeId };
    }
    if (Array.isArray(draft.nodeClaims)) {
      draft.nodeClaims = Object.fromEntries(draft.nodeClaims.map((id) => [id, { claimed: true, status: "CLAIMED" }]));
    } else if (!draft.nodeClaims) {
      draft.nodeClaims = {};
    }
    draft.nodeClaims[nodeId] = { claimed: true, status: "CLAIMED", sourceId };
    return {
      ok: true,
      nodeId,
      nodeType: node2.nodeType,
      label: node2.label,
      claimMode: node2.claimMode,
      sourceId,
      rewardIds: [...node2.rewardIds],
      ledgerEntries
    };
  }

  // project:src/supply.js
  var hasOwn = (value, key) => value != null && Object.prototype.hasOwnProperty.call(value, key);
  function firstDefined(objects, keys) {
    for (const object of objects) {
      if (!object || typeof object !== "object") continue;
      for (const key of keys) if (hasOwn(object, key) && object[key] !== void 0) return object[key];
    }
    return void 0;
  }
  function rejection(code, reason, event2, extra = {}) {
    return {
      ok: false,
      accepted: false,
      success: false,
      code,
      reason,
      eventId: event2?.eventId,
      source: event2?.source,
      result: event2?.result,
      ticketsGranted: 0,
      tickets: 0,
      ...extra
    };
  }
  function recorded(processed, eventId) {
    if (Array.isArray(processed)) {
      return processed.some((value) => value === eventId || value?.eventId === eventId);
    }
    return processed != null && typeof processed === "object" && hasOwn(processed, eventId);
  }
  function record(processed, eventId, detail) {
    if (Array.isArray(processed)) processed.push(eventId);
    else processed[eventId] = detail;
  }
  function decodeResult(source, value) {
    const name = typeof value === "string" ? value.trim().toUpperCase() : "";
    if (source === "ORDER_SETTLED") {
      if (["SUCCESS", "SETTLED", "ORDER_SUCCESS"].includes(name)) return "SUCCESS";
      if (["FAIL", "FAILED", "ORDER_FAILED"].includes(name)) return "FAILED";
    }
    if (source === "GENERATOR_OUTPUT") {
      if (["HIT", "SUCCESS_HIT", "OUTPUT_HIT"].includes(name)) return "HIT";
      if (["MISS", "NO_HIT", "SUCCESS_MISS", "OUTPUT_MISS"].includes(name)) return "MISS";
      if (["FAIL", "FAILED", "OUTPUT_FAILED", "PRODUCTION_FAILED"].includes(name)) return "OUTPUT_FAILED";
    }
    return null;
  }
  function simulatedTime(draft) {
    const raw = firstDefined(
      [draft?.debug, draft?.simulation, draft?.sim, draft?.server, draft],
      ["serverNow", "serverTime", "simulatedServerTime", "simulatedNow", "serverTimeMs", "now"]
    );
    if (raw === void 0 || raw === null || raw === "") return NaN;
    if (typeof raw === "number") return Number.isFinite(raw) ? raw : NaN;
    return typeof raw === "string" ? Date.parse(raw) : NaN;
  }
  function activityDay(timestamp, activity) {
    const match = String(activity.startAt).match(/([+-])(\d{2}):(\d{2})$/);
    const offset = match ? (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) : 0;
    return Math.floor((timestamp + offset * 6e4 - activity.dayCutHour * 36e5) / 864e5);
  }
  function ruleUsage(draft, ruleId) {
    const entry2 = draft.supplyUsage?.[ruleId];
    if (!entry2) return { period: 0, days: {} };
    return entry2;
  }
  function evaluateSupply(draft, event2, config) {
    if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
      return rejection("INVALID_STATE", "活动状态不可用，未发放扭蛋券", event2);
    }
    if (!event2 || typeof event2 !== "object" || typeof event2.eventId !== "string" || !event2.eventId.trim()) {
      return rejection("INVALID_EVENT_ID", "缺少有效的模拟事件ID，未发放扭蛋券", event2);
    }
    const eventId = event2.eventId.trim();
    const source = event2.source;
    const result = decodeResult(source, event2.result);
    if (!result) return rejection("INVALID_RESULT", "模拟来源或操作结果无效，未发放扭蛋券", event2);
    if (recorded(draft.processedEventIds, eventId)) {
      const original = Array.isArray(draft.processedEventIds) ? draft.processedEventIds.find((value) => value?.eventId === eventId) : draft.processedEventIds?.[eventId];
      return rejection("DUPLICATE_EVENT", "同一模拟事件ID已结算，不重复发券", event2, {
        duplicate: true,
        originalResult: original && typeof original === "object" ? { ...original } : null
      });
    }
    const activity = config?.activity;
    if (!activity || !Number.isFinite(Date.parse(activity.startAt)) || !Number.isFinite(Date.parse(activity.endAt))) {
      return rejection("INVALID_CONFIG", "活动时间配置无效，未发放扭蛋券", event2);
    }
    if (draft.periodId !== activity.periodId || draft.settlement?.finalized || draft.settled) {
      return rejection("INACTIVE_PERIOD", "本期活动未开启或已经结算，未发放扭蛋券", event2);
    }
    const contexts = [draft.debug, draft.simulation, draft.sim, draft.server, draft];
    const trusted = firstDefined(contexts, ["timeTrusted", "serverTimeTrusted"]);
    if ((trusted === void 0 ? activity.timeTrusted : trusted) !== true) {
      return rejection("TIME_UNTRUSTED", "服务器时间尚未确认，未发放扭蛋券", event2);
    }
    const now = simulatedTime(draft);
    if (!Number.isFinite(now)) {
      return rejection("TIME_UNAVAILABLE", "模拟服务器时间不可用，未发放扭蛋券", event2);
    }
    if (now < Date.parse(activity.startAt)) {
      return rejection("NOT_STARTED", "活动尚未开始，未发放扭蛋券", event2);
    }
    if (now >= Date.parse(activity.endAt)) {
      return rejection("SUPPLY_CLOSED", "活动已正式截止，外部供券已停止", event2);
    }
    const switchState2 = firstDefined(contexts, ["switchState", "activitySwitch"]) ?? activity.switchState;
    const inside = draft.activitySession === true || draft.inActivity === true || draft.sessionActive === true || ["machine", "collection", "shop"].includes(draft.screen);
    if (switchState2 === "HARD_OFF" && !inside) {
      return rejection("HARD_OFF", "活动已硬关闭，未发放扭蛋券", event2);
    }
    if (switchState2 === "SOFT_OFF" && draft.initialized !== true && draft.initializedAt == null) {
      return rejection("SOFT_OFF", "活动已软关闭，未开启本期的玩家不能获得扭蛋券", event2);
    }
    if (!["OPEN", "SOFT_OFF", "HARD_OFF"].includes(switchState2)) {
      return rejection("INVALID_SWITCH", "活动开关状态无效，未发放扭蛋券", event2);
    }
    const playerContexts = [draft.debug, draft.simulation, draft.sim, draft.eligibility, draft.qualification, draft.player, draft];
    const level = firstDefined(playerContexts, ["level", "playerLevel"]);
    const wave = firstDefined(playerContexts, ["completedWave", "orderWave", "wave", "completedOrderWave"]);
    if (!Number.isFinite(Number(level)) || Number(level) < activity.minLevel) {
      return rejection("LEVEL_REQUIRED", `需要达到${activity.minLevel}级，未发放扭蛋券`, event2);
    }
    if (!Number.isFinite(Number(wave)) || Number(wave) < activity.requiredWave) {
      return rejection("WAVE_REQUIRED", `需要完成第${activity.requiredWave}波订单，未发放扭蛋券`, event2);
    }
    for (const [keys, code, reason2] of [
      [["qualified", "eligible", "hasQualification"], "NOT_QUALIFIED", "活动资格不满足，未发放扭蛋券"],
      [["mutexClear", "mutualExclusionClear", "noConflict"], "ACTIVITY_CONFLICT", "存在互斥活动，未发放扭蛋券"],
      [["resourcesReady", "resourceReady"], "RESOURCE_UNAVAILABLE", "活动资源尚未就绪，未发放扭蛋券"]
    ]) {
      if (firstDefined(playerContexts, keys) === false) return rejection(code, reason2, event2);
    }
    const layerId = draft.layerId ?? draft.selectedLayerId ?? draft.playerLayerId;
    if (!layerId || !(config.playerLayers || []).some((layer) => layer.layerId === layerId)) {
      return rejection("LAYER_UNAVAILABLE", "当前玩家分层尚未确定，未发放扭蛋券", event2);
    }
    const matches = (config.supplyRules || []).filter((rule2) => rule2.source === source && rule2.tier === layerId);
    if (matches.length !== 1) {
      return rejection("SUPPLY_RULE_UNAVAILABLE", "当前分层的供券规则缺失或不唯一，未发放扭蛋券", event2);
    }
    const rule = matches[0];
    const hit = result === "SUCCESS" || result === "HIT";
    if (source === "ORDER_SETTLED" && rule.method !== "FIXED" || source === "GENERATOR_OUTPUT" && rule.method !== "HIT_PROBABILITY" || !Number.isInteger(rule.ticketsOnHit) || rule.ticketsOnHit <= 0) {
      return rejection("INVALID_SUPPLY_RULE", "供券规则配置无效，未发放扭蛋券", event2);
    }
    if (!Number.isInteger(draft.tickets) || draft.tickets < 0) {
      return rejection("INVALID_BALANCE", "扭蛋券余额状态异常，未发放扭蛋券", event2);
    }
    if (draft.processedEventIds != null && !Array.isArray(draft.processedEventIds) && (typeof draft.processedEventIds !== "object" || draft.processedEventIds === null)) {
      return rejection("INVALID_EVENT_RECORD", "供券去重记录不可用，未发放扭蛋券", event2);
    }
    const day = String(activityDay(now, activity));
    const usage = ruleUsage(draft, rule.ruleId);
    const usedToday = usage.days?.[day] ?? 0;
    if (!Number.isSafeInteger(usage.period) || usage.period < 0 || !Number.isSafeInteger(usedToday) || usedToday < 0 || hit && (!Number.isSafeInteger(draft.tickets + rule.ticketsOnHit) || !Number.isSafeInteger(usage.period + rule.ticketsOnHit) || !Number.isSafeInteger(usedToday + rule.ticketsOnHit))) {
      return rejection("INVALID_SUPPLY_USAGE", "供券额度记录异常，未发放扭蛋券", event2);
    }
    const remainingPeriod = rule.periodCap === -1 ? Infinity : rule.periodCap - usage.period;
    const remainingDay = rule.dailyCap === -1 ? Infinity : rule.dailyCap - usedToday;
    const granted = hit ? Math.max(0, Math.min(rule.ticketsOnHit, remainingPeriod, remainingDay)) : 0;
    if (hit && granted === 0) {
      if (!draft.processedEventIds) draft.processedEventIds = {};
      const reason2 = "当前供券来源已达到配置上限，本事件确认发券0张";
      record(draft.processedEventIds, eventId, {
        source,
        result,
        ruleId: rule.ruleId,
        configuredTickets: rule.ticketsOnHit,
        ticketsGranted: 0,
        reason: reason2,
        code: "SUPPLY_CAP_REACHED",
        periodId: activity.periodId
      });
      return {
        ok: true,
        accepted: true,
        success: false,
        code: "SUPPLY_CAP_REACHED",
        reason: reason2,
        eventId,
        source,
        result,
        ruleId: rule.ruleId,
        periodId: activity.periodId,
        layerId,
        configuredTickets: rule.ticketsOnHit,
        ticketsGranted: 0,
        tickets: 0,
        balance: draft.tickets,
        simulatedSource: rule.scope
      };
    }
    if (!draft.processedEventIds) draft.processedEventIds = {};
    if (granted) {
      if (!draft.supplyUsage) draft.supplyUsage = {};
      draft.supplyUsage[rule.ruleId] = {
        period: usage.period + granted,
        days: { ...usage.days, [day]: usedToday + granted }
      };
      draft.tickets += granted;
    }
    record(draft.processedEventIds, eventId, {
      source,
      result,
      ruleId: rule.ruleId,
      ticketsGranted: granted,
      periodId: activity.periodId
    });
    const reason = !hit ? result === "MISS" ? "模拟有效产出未命中，本次不发券" : "模拟上游操作失败，本次不发券" : granted < rule.ticketsOnHit ? `模拟成功；受供券上限限制，实际获得${granted}张扭蛋券` : `模拟成功，获得${granted}张扭蛋券`;
    return {
      ok: true,
      accepted: true,
      success: granted > 0,
      code: granted ? "SUPPLY_GRANTED" : result === "MISS" ? "SUPPLY_MISSED" : "UPSTREAM_FAILED",
      reason,
      eventId,
      source,
      result,
      ruleId: rule.ruleId,
      periodId: activity.periodId,
      layerId,
      configuredTickets: rule.ticketsOnHit,
      ticketsGranted: granted,
      tickets: granted,
      balance: draft.tickets,
      simulatedSource: rule.scope
    };
  }

  // project:src/draw.js
  var table = (config, alias, id) => config?.[alias] || config?.tables?.[id] || [];
  var has = (value, id) => value instanceof Set ? value.has(id) : Array.isArray(value) ? value.includes(id) : Boolean(value && typeof value === "object" && value[id]);
  var failure = (reason, message, batchId) => ({ ok: false, reason, message, batchId });
  function savedTransaction(state, batchId, transactionId2) {
    const records = state.confirmedTransactions;
    if (has(records, batchId) || has(records, transactionId2)) return true;
    if (has(state.processedEventIds, batchId) || has(state.processedEventIds, transactionId2)) return true;
    const results = state.sequenceResults;
    return Boolean(results && typeof results === "object" && Object.keys(results).some((id) => id.startsWith(`${transactionId2}:result:`)));
  }
  function sessionError(state, config) {
    if (state.readOnly || state.saveError || state.persistenceStatus === "READ_ONLY") {
      return ["READ_ONLY", "活动存档暂不可用，抽取已暂停"];
    }
    const trusted = state.simulatedServer?.timeTrusted ?? state.server?.timeTrusted ?? state.timeTrusted ?? config?.activity?.timeTrusted;
    if (trusted !== true) return ["TIME_UNKNOWN", "服务器时间尚未确认，暂不可抽取"];
    if (state.periodId && state.periodId !== config?.activity?.periodId) {
      return ["PERIOD_MISMATCH", "活动期次不匹配"];
    }
    if (state.settlement || state.settled || state.sessionEnded || state.activitySession === "ENDED") {
      return ["SESSION_ENDED", "本期活动已结束"];
    }
    if (state.inActivity === false || state.sessionActive === false || state.activitySession === false || state.activitySession === "INACTIVE") {
      return ["SESSION_INACTIVE", "请先进入扭蛋机"];
    }
    if (state.processing || state.drawPending || state.exchangePending) {
      return ["BUSY", "正在确认上一笔操作"];
    }
    const rawTime = state.simulatedServer?.now ?? state.simulatedServerTime ?? state.serverNow ?? state.serverTime ?? state.now;
    if (rawTime != null) {
      const now = typeof rawTime === "number" ? rawTime : Date.parse(rawTime);
      const start = Date.parse(config.activity?.startAt);
      if (!Number.isFinite(now)) return ["TIME_UNKNOWN", "模拟服务器时间无效"];
      if (Number.isFinite(start) && now < start) return ["NOT_STARTED", "活动尚未开始"];
    }
    return null;
  }
  function currentCursor(state, layer) {
    const cursor = state.cursor || state.sequenceCursor || {};
    return {
      roomId: Number(cursor.roomId ?? state.currentRoomId ?? state.roomId ?? layer.initialRoomId),
      index: Number(cursor.index ?? cursor.position ?? state.currentIndex ?? state.readIndex ?? layer.initialIndex)
    };
  }
  function writeCursor(state, cursor) {
    state.cursor = { ...cursor };
    if (state.sequenceCursor != null) state.sequenceCursor = { ...cursor };
    if (Object.prototype.hasOwnProperty.call(state, "currentRoomId")) state.currentRoomId = cursor.roomId;
    if (Object.prototype.hasOwnProperty.call(state, "roomId")) state.roomId = cursor.roomId;
    if (Object.prototype.hasOwnProperty.call(state, "currentIndex")) state.currentIndex = cursor.index;
    if (Object.prototype.hasOwnProperty.call(state, "readIndex")) state.readIndex = cursor.index;
  }
  function orderedEntries(config, state, reads) {
    const layers = table(config, "playerLayers", "PlayerLayers");
    const layerId = state.layerId ?? state.selectedLayerId ?? layers[0]?.layerId;
    const layer = layers.find((row) => row.layerId === layerId);
    if (!layer) throw new Error("当前玩家分层不存在");
    const sequenceGroup = state.sequenceGroup ?? state.selectedSequenceGroup ?? layer.sequenceGroup;
    const rooms2 = table(config, "sequence", "GachaSequence").filter((row) => row.periodId === config.activity?.periodId && row.layerId === layerId && row.sequenceGroup === sequenceGroup).sort((a, b) => a.roomId - b.roomId);
    if (!rooms2.length) throw new Error("当前分层的奖励序列不存在");
    const toys2 = table(config, "toys", "GachaToy");
    const rewards = table(config, "rewards", "RewardCatalog");
    const beforeCursor = currentCursor(state, layer);
    let roomOffset = rooms2.findIndex((row) => row.roomId === beforeCursor.roomId);
    let index = beforeCursor.index;
    if (roomOffset < 0 || !Number.isInteger(index) || index < 1) {
      throw new Error("奖励房间游标无效");
    }
    const entries = [];
    for (let i = 0; i < reads; i++) {
      const room = rooms2[roomOffset];
      const list = room.orderedRewards;
      if (!Array.isArray(list) || index > list.length || !list.length) {
        throw new Error(`奖励房间 ${room.roomId} 的读取位置无效`);
      }
      const rewardId = list[index - 1];
      if (!toys2.some((toy) => toy.toyId === rewardId) && !rewards.some((reward2) => reward2.rewardId === rewardId)) {
        throw new Error(`奖励房间 ${room.roomId} 引用了不存在的奖励 ${String(rewardId)}`);
      }
      entries.push({ rewardId, roomId: room.roomId, index });
      index++;
      if (index > list.length) {
        if (room.endRule === "LOOP_THIS_ROOM") index = 1;
        else if (room.endRule === "NEXT_ROOM" && roomOffset + 1 < rooms2.length) {
          roomOffset++;
          index = 1;
        } else throw new Error(`奖励房间 ${room.roomId} 缺少有效的后续读取规则`);
      }
    }
    return {
      entries,
      beforeCursor,
      afterCursor: { roomId: rooms2[roomOffset].roomId, index },
      layerId,
      sequenceGroup
    };
  }
  function recordTransaction(state, batchId, transactionId2, receipt) {
    const existing = state.confirmedTransactions;
    if (existing == null) state.confirmedTransactions = {};
    else if (!existing || typeof existing !== "object" || existing instanceof Set) {
      throw new Error("已确认事务存档格式无效");
    }
    if (Array.isArray(state.confirmedTransactions)) {
      state.confirmedTransactions.push({ transactionId: transactionId2, batchId, ...receipt });
    } else {
      state.confirmedTransactions[transactionId2] = { batchId, ...receipt };
    }
  }
  function evaluateDraw(draft, tierId, batchId, config) {
    if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
      return failure("INVALID_SAVE", "活动存档无效", batchId);
    }
    if (typeof batchId !== "string" || !batchId.trim()) {
      return failure("INVALID_BATCH_ID", "抽取批次 ID 不能为空", batchId);
    }
    if (!config?.activity?.periodId) return failure("INVALID_CONFIG", "活动期次配置无效", batchId);
    const instance = draft.testInstanceId ?? draft.testInstance;
    const transactionId2 = `${config.activity.periodId}${instance == null ? "" : `:${String(instance)}`}:draw:${batchId}`;
    if (savedTransaction(draft, batchId, transactionId2)) {
      return failure("DUPLICATE_BATCH", "这一批抽取已确认，不会再次扣券或读取序列", batchId);
    }
    const blocked = sessionError(draft, config);
    if (blocked) return failure(blocked[0], blocked[1], batchId);
    const tier2 = table(config, "drawTiers", "DrawTiers").find((row) => row.tierId === tierId);
    if (!tier2 || !Number.isInteger(tier2.reads) || tier2.reads < 1 || !Number.isInteger(tier2.singleCost) || tier2.singleCost < 1 || tier2.ticketCost !== tier2.singleCost * tier2.reads) {
      return failure("INVALID_TIER", "倍率或抽取消耗配置无效", batchId);
    }
    if (!Number.isInteger(draft.tickets) || draft.tickets < 0) {
      return failure("INVALID_SAVE", "扭蛋券存档无效", batchId);
    }
    if (draft.tickets < tier2.ticketCost) {
      return failure("TICKET_LOW", config.copyById?.TICKET_LOW || "扭蛋券不足，请完成订单或使用主线生成器获取", batchId);
    }
    try {
      const working = JSON.parse(JSON.stringify(draft));
      const path = orderedEntries(config, working, tier2.reads);
      const oldPoints = Number(working.totalPoints) || 0;
      const oldAvailablePoints = Number(working.availablePoints) || 0;
      working.tickets -= tier2.ticketCost;
      const results = path.entries.map((entry2, i) => ({
        ...applySequenceResult(
          working,
          entry2.rewardId,
          `${transactionId2}:result:${i + 1}`,
          config
        ),
        roomId: entry2.roomId,
        sequenceIndex: entry2.index
      }));
      const pointsGained = (Number(working.totalPoints) || 0) - oldPoints;
      if (pointsGained < 0 || (Number(working.availablePoints) || 0) - oldAvailablePoints !== pointsGained) {
        throw new Error("重复玩具积分结算不一致");
      }
      writeCursor(working, path.afterCursor);
      const nodes = table(config, "nodes", "ProgressNodes");
      const automaticRewards = [];
      for (const nodeId of resolveReachedNodes(working, config)) {
        const node2 = nodes.find((row) => row.nodeId === nodeId);
        if (node2?.claimMode !== "AUTO") continue;
        const award = claimNode(working, nodeId, config);
        if (!award.ok) throw new Error(`自动奖励 ${nodeId} 结算失败：${award.message}`);
        automaticRewards.push(award);
      }
      const receipt = {
        tierId,
        cost: tier2.ticketCost,
        reads: tier2.reads,
        beforeCursor: path.beforeCursor,
        afterCursor: path.afterCursor,
        rewardIds: path.entries.map((entry2) => entry2.rewardId),
        pointsGained,
        automaticNodeIds: automaticRewards.map((award) => award.nodeId)
      };
      recordTransaction(working, batchId, transactionId2, receipt);
      Object.assign(draft, working);
      return {
        ok: true,
        batchId,
        transactionId: transactionId2,
        tierId,
        layerId: path.layerId,
        sequenceGroup: path.sequenceGroup,
        cost: tier2.ticketCost,
        ticketCost: tier2.ticketCost,
        reads: tier2.reads,
        results,
        beforeCursor: path.beforeCursor,
        afterCursor: path.afterCursor,
        pointsGained,
        pointDelta: pointsGained,
        automaticRewards,
        autoRewards: automaticRewards,
        ticketsRemaining: draft.tickets,
        totalPoints: draft.totalPoints,
        availablePoints: draft.availablePoints
      };
    } catch (error) {
      return failure("DRAW_FAILED", error instanceof Error ? error.message : String(error), batchId);
    }
  }

  // project:src/settlement.js
  var nodesOf2 = (config) => config?.nodes || config?.tables?.ProgressNodes || [];
  var toysOf2 = (config) => config?.toys || config?.tables?.GachaToy || [];
  function firstDefined2(...values) {
    return values.find((value) => value !== void 0 && value !== null);
  }
  function serverTimestamp(state) {
    const value = firstDefined2(
      state?.serverTime,
      state?.simulatedServerTime,
      state?.serverNow,
      state?.debug?.serverTime,
      state?.debug?.simulatedServerTime
    );
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
    return typeof value === "string" && value.trim() ? Date.parse(value) : NaN;
  }
  function insideSession(state) {
    const flag = firstDefined2(
      state?.sessionActive,
      state?.activitySessionActive,
      typeof state?.activitySession === "object" ? state.activitySession.active : state?.activitySession,
      state?.inActivity
    );
    if (flag !== void 0) return flag === true || flag === "ACTIVE";
    return [
      "cover",
      "machine",
      "drawResult",
      "collection",
      "claim",
      "shop",
      "exchangeConfirm",
      "info",
      "rulesGuide"
    ].includes(state?.screen);
  }
  function switchState(state, config) {
    return firstDefined2(
      state?.switchState,
      state?.debug?.switchState,
      config?.activity?.switchState
    );
  }
  function periodId2(state, config) {
    return state?.periodId || config?.activity?.periodId;
  }
  function settlementKey(state, config) {
    const instance = firstDefined2(state?.testInstanceId, state?.testInstance);
    return `${periodId2(state, config)}${instance == null ? "" : `:${String(instance)}`}:settlement`;
  }
  function popupId(popup) {
    return typeof popup === "string" ? popup : popup?.popupId || popup?.id || null;
  }
  function queued(queue, id) {
    return Array.isArray(queue) && queue.some((popup) => popupId(popup) === id);
  }
  function ownedCount(state, config) {
    const owned2 = state?.ownedToyIds;
    const has3 = (id) => owned2 instanceof Set ? owned2.has(id) : Array.isArray(owned2) ? owned2.includes(id) : Boolean(owned2?.[id]);
    return toysOf2(config).filter((toy) => has3(toy.toyId)).length;
  }
  function snapshotRewardIds(node2) {
    if (Array.isArray(node2.rewardIds)) return [...node2.rewardIds];
    try {
      const ids = JSON.parse(node2.rewardIdsJson);
      return Array.isArray(ids) ? ids : null;
    } catch {
      return null;
    }
  }
  function getSessionAvailability(state, config) {
    const activity = config?.activity;
    const inside = insideSession(state);
    const trusted = firstDefined2(
      state?.timeTrusted,
      state?.debug?.timeTrusted,
      activity?.timeTrusted
    ) === true;
    const now = serverTimestamp(state);
    const start = Date.parse(activity?.startAt);
    const end = Date.parse(activity?.endAt);
    const validTime = trusted && Number.isFinite(now) && Number.isFinite(start) && Number.isFinite(end) && end > start;
    const expired = validTime && now >= end;
    const started = validTime && now >= start;
    const closed = state?.settlement?.status === "FINALIZED" || state?.settlement?.finalized === true;
    const hardOff = switchState(state, config) === "HARD_OFF";
    const readOnly = state?.readOnly === true || state?.storageStatus === "READ_ONLY" || state?.saveStatus === "READ_ONLY";
    const level = firstDefined2(
      state?.level,
      state?.playerLevel,
      state?.debug?.level,
      state?.debug?.playerLevel
    );
    const wave = firstDefined2(
      state?.orderWave,
      state?.completedWave,
      state?.debug?.orderWave,
      state?.debug?.completedWave
    );
    const eligible = (level === void 0 || Number(level) >= activity?.minLevel) && (wave === void 0 || Number(wave) >= activity?.requiredWave) && firstDefined2(state?.qualified, state?.eligible, state?.debug?.qualified, true) !== false && firstDefined2(state?.mutualExclusionClear, state?.debug?.mutualExclusionClear, true) !== false && firstDefined2(state?.resourcesReady, state?.debug?.resourcesReady, true) !== false;
    let reason = null;
    if (!validTime) reason = "TIME_UNCONFIRMED";
    else if (readOnly) reason = "READ_ONLY";
    else if (closed) reason = "ALREADY_SETTLED";
    else if (!started) reason = "NOT_STARTED";
    else if (state?.settlement?.status === "PENDING_MAKEUP") reason = "SETTLING";
    else if (hardOff && !inside) reason = "HARD_OFF";
    else if (expired && !inside) reason = "EXPIRED";
    else if (!eligible && !inside) reason = "NOT_ELIGIBLE";
    const canOperate = reason === null && inside;
    const canEnter = reason === null && !expired && !hardOff && eligible;
    return {
      phase: !validTime ? "UNCONFIRMED" : closed ? "SETTLED" : expired ? inside ? "EXPIRED_IN_SESSION" : "EXPIRED_OUTSIDE" : started ? "OPEN" : "NOT_STARTED",
      reason,
      timeTrusted: validTime,
      now: validTime ? now : null,
      startAt: Number.isFinite(start) ? start : null,
      endAt: Number.isFinite(end) ? end : null,
      expired,
      insideSession: inside,
      canEnter,
      canOperate,
      canSupply: reason === null && !expired && eligible && !hardOff
    };
  }
  function beginSettlement(draft, config) {
    const availability = getSessionAvailability(draft, config);
    if (!availability.timeTrusted) return {
      ok: false,
      reason: "TIME_UNCONFIRMED",
      message: "服务器时间尚未确认，不进行结算"
    };
    if (draft?.settlement?.status === "FINALIZED") return {
      ok: false,
      reason: "ALREADY_SETTLED",
      message: "本期已经结算",
      settlementId: draft.settlement.id
    };
    if (draft?.settlement?.status === "PENDING_MAKEUP") {
      const settlement = draft.settlement;
      if (!Array.isArray(draft.popupQueue) || !Array.isArray(settlement.makeup)) return {
        ok: false,
        reason: "INVALID_SAVE",
        message: "结束弹窗或补发清单存档格式无效"
      };
      if (!settlement.endingAcknowledged && !queued(draft.popupQueue, settlement.endingPopupId)) {
        const ending2 = {
          id: settlement.endingPopupId,
          popupId: settlement.endingPopupId,
          type: "ending",
          settlementId: settlement.id
        };
        const makeupIndex = draft.popupQueue.findIndex((popup) => popupId(popup) === settlement.makeupPopupId);
        if (makeupIndex < 0) draft.popupQueue.push(ending2);
        else draft.popupQueue.splice(makeupIndex, 0, ending2);
      }
      if (settlement.makeup.length && !queued(draft.popupQueue, settlement.makeupPopupId)) {
        draft.popupQueue.push({
          id: settlement.makeupPopupId,
          popupId: settlement.makeupPopupId,
          type: "makeup",
          settlementId: settlement.id
        });
      }
      if (settlement.endingAcknowledged && !settlement.makeup.length && !queued(draft.popupQueue, settlement.endingPopupId)) {
        settlement.endingAcknowledged = false;
        draft.popupQueue.push({
          id: settlement.endingPopupId,
          popupId: settlement.endingPopupId,
          type: "ending",
          settlementId: settlement.id
        });
      }
      return { ok: true, replay: true, settlementId: settlement.id, makeup: settlement.makeup };
    }
    if (!availability.expired) return {
      ok: false,
      reason: "NOT_EXPIRED",
      message: "活动尚未正式截止"
    };
    if (availability.insideSession) return {
      ok: false,
      reason: "SESSION_ACTIVE",
      message: "到期会话仍可继续；离开扭蛋机后结算"
    };
    if (draft?.periodId && draft.periodId !== config?.activity?.periodId) return {
      ok: false,
      reason: "PERIOD_MISMATCH",
      message: "活动期次与存档不一致"
    };
    if (draft?.popupQueue != null && !Array.isArray(draft.popupQueue)) return {
      ok: false,
      reason: "INVALID_SAVE",
      message: "弹窗队列存档格式无效"
    };
    const outstanding = [];
    for (const node2 of nodesOf2(config)) {
      const status = getNodeStatus(draft, config, node2.nodeId);
      if (!status?.reached || status.claimed) continue;
      const rewardIds = snapshotRewardIds(node2);
      if (!rewardIds?.length) return {
        ok: false,
        reason: "INVALID_CONFIG",
        message: `节点 ${node2.nodeId} 的奖励配置无效`
      };
      outstanding.push({
        nodeId: node2.nodeId,
        nodeType: node2.nodeType,
        label: node2.label,
        rewardIds,
        sortOrder: node2.sortOrder,
        target: node2.target,
        status: "PENDING"
      });
    }
    outstanding.sort((a, b) => (a.nodeType === "POINT" ? 0 : a.nodeType === "QUALITY" ? 1 : 2) - (b.nodeType === "POINT" ? 0 : b.nodeType === "QUALITY" ? 1 : 2) || (a.nodeType === "POINT" ? a.target - b.target : 0) || a.sortOrder - b.sortOrder);
    const id = settlementKey(draft, config);
    const endPopupId = `${id}:ending`;
    const makeupPopupId = `${id}:makeup`;
    const queue = Array.isArray(draft.popupQueue) ? draft.popupQueue : [];
    draft.settlement = {
      id,
      periodId: periodId2(draft, config),
      status: "PENDING_MAKEUP",
      startedAt: availability.now,
      endingPopupId: endPopupId,
      makeupPopupId,
      endingAcknowledged: false,
      collectedCount: ownedCount(draft, config),
      totalToyCount: toysOf2(config).length,
      makeup: outstanding,
      // 冻结结算前数字；资产在确认有效补发后才清理。
      closingTickets: Number(draft.tickets) || 0,
      closingTotalPoints: Number(draft.totalPoints) || 0,
      closingAvailablePoints: Number(draft.availablePoints) || 0
    };
    draft.popupQueue = [...queue];
    if (!queued(draft.popupQueue, endPopupId)) draft.popupQueue.push({
      id: endPopupId,
      popupId: endPopupId,
      type: "ending",
      settlementId: id
    });
    if (outstanding.length && !queued(draft.popupQueue, makeupPopupId)) {
      draft.popupQueue.push({
        id: makeupPopupId,
        popupId: makeupPopupId,
        type: "makeup",
        settlementId: id
      });
    }
    return {
      ok: true,
      settlementId: id,
      collectedCount: draft.settlement.collectedCount,
      totalToyCount: draft.settlement.totalToyCount,
      makeup: outstanding.map((item) => ({ ...item, rewardIds: [...item.rewardIds] })),
      popupIds: outstanding.length ? [endPopupId, makeupPopupId] : [endPopupId]
    };
  }
  function claimMakeup(draft, settlementId, config) {
    const settlement = draft?.settlement;
    if (!settlement || settlement.id !== settlementId || settlement.status !== "PENDING_MAKEUP") return {
      ok: false,
      reason: "INVALID_SETTLEMENT",
      message: "没有可领取的本期补发"
    };
    if (!getSessionAvailability(draft, config).timeTrusted) return {
      ok: false,
      reason: "TIME_UNCONFIRMED",
      message: "服务器时间尚未确认"
    };
    if (Array.isArray(draft.popupQueue) && queued(draft.popupQueue, settlement.endingPopupId) && settlement.endingAcknowledged !== true) return {
      ok: false,
      reason: "ENDING_FIRST",
      message: "请先关闭活动结束说明"
    };
    if (!Array.isArray(settlement.makeup)) return {
      ok: false,
      reason: "INVALID_SAVE",
      message: "补发清单存档格式无效"
    };
    const pending = settlement.makeup.filter((item) => item.status === "PENDING");
    if (!pending.length) return {
      ok: false,
      reason: "ALREADY_CLAIMED",
      message: "补发奖励已经领取"
    };
    const staged = {
      ...draft,
      nodeClaims: Array.isArray(draft.nodeClaims) ? [...draft.nodeClaims] : draft.nodeClaims && typeof draft.nodeClaims === "object" ? { ...draft.nodeClaims } : draft.nodeClaims,
      rewardLedger: Array.isArray(draft.rewardLedger) ? [...draft.rewardLedger] : draft.rewardLedger
    };
    const results = [];
    for (const item of pending) {
      const node2 = nodesOf2(config).find((row) => row.nodeId === item.nodeId);
      if (!node2 || !getNodeStatus(staged, config, item.nodeId)?.reached || JSON.stringify(snapshotRewardIds(node2)) !== JSON.stringify(item.rewardIds)) {
        return {
          ok: false,
          reason: "INCONSISTENT_SAVE",
          message: `补发节点 ${item.nodeId} 与已确认结算清单不符`
        };
      }
      const result = claimNode(staged, item.nodeId, config);
      if (!result.ok) return {
        ok: false,
        reason: result.reason,
        message: result.message,
        nodeId: item.nodeId
      };
      results.push(result);
    }
    draft.nodeClaims = staged.nodeClaims;
    draft.rewardLedger = staged.rewardLedger;
    settlement.makeup = settlement.makeup.map((item) => item.status === "PENDING" ? { ...item, status: "CLAIMED" } : item);
    return {
      ok: true,
      settlementId,
      claims: results,
      ledgerEntries: results.flatMap((result) => result.ledgerEntries)
    };
  }
  function finalizeSettlement(draft, config) {
    const settlement = draft?.settlement;
    if (!settlement) return {
      ok: false,
      reason: "NOT_STARTED",
      message: "尚未开始结束结算"
    };
    if (settlement.status === "FINALIZED") return {
      ok: false,
      reason: "ALREADY_SETTLED",
      message: "本期已经结算",
      settlementId: settlement.id
    };
    if (settlement.status !== "PENDING_MAKEUP") return {
      ok: false,
      reason: "INVALID_SETTLEMENT",
      message: "结算状态无效"
    };
    const availability = getSessionAvailability(draft, config);
    if (!availability.timeTrusted) return {
      ok: false,
      reason: "TIME_UNCONFIRMED",
      message: "服务器时间尚未确认，不清理资产"
    };
    if (!availability.expired || availability.insideSession) return {
      ok: false,
      reason: "SESSION_ACTIVE",
      message: "活动会话尚未结束"
    };
    if (!Array.isArray(draft.popupQueue) || queued(draft.popupQueue, settlement.endingPopupId) || settlement.endingAcknowledged !== true) return {
      ok: false,
      reason: "ENDING_FIRST",
      message: "请先关闭活动结束说明"
    };
    if (!Array.isArray(settlement.makeup) || settlement.makeup.some((item) => item.status !== "CLAIMED")) return {
      ok: false,
      reason: "MAKEUP_PENDING",
      message: "请先领取已达成奖励的补发"
    };
    if (queued(draft.popupQueue, settlement.makeupPopupId)) return {
      ok: false,
      reason: "MAKEUP_POPUP_OPEN",
      message: "请先关闭补发弹窗"
    };
    const summary = {
      periodId: settlement.periodId,
      collectedCount: settlement.collectedCount,
      totalToyCount: settlement.totalToyCount,
      closingTickets: settlement.closingTickets,
      closingTotalPoints: settlement.closingTotalPoints,
      closingAvailablePoints: settlement.closingAvailablePoints,
      makeupNodeIds: settlement.makeup.map((item) => item.nodeId),
      makeupRewardIds: settlement.makeup.flatMap((item) => item.rewardIds)
    };
    draft.tickets = 0;
    draft.totalPoints = 0;
    draft.availablePoints = 0;
    draft.ownedToyIds = [];
    draft.newToyIds = [];
    draft.nodeClaims = {};
    draft.shopCounts = {};
    draft.sequenceResults = {};
    draft.cursor = null;
    draft.sequenceCursor = null;
    draft.sequenceGroup = null;
    draft.selectedSequenceGroup = null;
    draft.roomId = null;
    draft.readIndex = null;
    draft.currentRoomId = null;
    draft.currentIndex = null;
    draft.settlement = {
      ...settlement,
      status: "FINALIZED",
      finalized: true,
      finalizedAt: availability.now,
      summary
    };
    return { ok: true, settlementId: settlement.id, summary };
  }

  // project:src/shop.js
  var shopRows = (config) => config?.shop || config?.tables?.GachaShop || [];
  var toyRows = (config) => config?.toys || config?.tables?.GachaToy || [];
  var rewardRows = (config) => config?.rewards || config?.tables?.RewardCatalog || [];
  var nodeRows = (config) => config?.nodes || config?.tables?.ProgressNodes || [];
  function owned(state, id) {
    const ids = state?.ownedToyIds;
    if (ids instanceof Set) return ids.has(id);
    if (Array.isArray(ids)) return ids.includes(id);
    return Boolean(ids && typeof ids === "object" && ids[id]);
  }
  function collectionComplete(state, config) {
    const toys2 = toyRows(config);
    const completeNode = nodeRows(config).find((node2) => node2.nodeType === "COMPLETE");
    if (!toys2.length || !completeNode || !Number.isInteger(completeNode.target)) return false;
    return toys2.filter((toy) => owned(state, toy.toyId)).length >= completeNode.target;
  }
  function usedCount(state, itemId) {
    const counts = state?.shopCounts;
    if (counts == null) return 0;
    if (!counts || typeof counts !== "object" || Array.isArray(counts)) return NaN;
    const value = counts[itemId] ?? 0;
    return Number.isInteger(value) && value >= 0 ? value : NaN;
  }
  function savedTransaction2(state, id) {
    const records = state?.confirmedTransactions;
    if (Array.isArray(records)) {
      return records.find((record2) => record2 && typeof record2 === "object" && (record2.transactionId === id || record2.id === id));
    }
    return records && typeof records === "object" ? records[id] : void 0;
  }
  function sessionReason(state) {
    if (state?.settlement?.finalized || state?.settlement?.started || state?.settlement?.status === "FINALIZED" || state?.settlement?.status === "STARTED" || state?.screen === "ending" || state?.screen === "makeup") {
      return { reason: "SETTLED", message: "本期活动正在结算或已结束" };
    }
    if (state?.activitySession === false || state?.sessionActive === false || state?.activitySession?.active === false || state?.activitySession?.status === "CLOSED" || state?.screen === "entry" || state?.screen === "cover") {
      return { reason: "NO_ACTIVE_SESSION", message: "请先进入本期扭蛋机" };
    }
    return null;
  }
  function unavailable(state, config) {
    if (state?.readOnly === true || state?.persistenceStatus === "READ_ONLY" || state?.saveStatus === "READ_ONLY" || state?.saveError) {
      return { reason: "READ_ONLY", message: config?.copyById?.SAVE_ERROR || "活动存档暂不可用" };
    }
    const clock3 = state?.simulatedServer || state?.serverClock || state?.clock;
    const trusted = state?.timeTrusted ?? clock3?.timeTrusted ?? clock3?.trusted ?? config?.activity?.timeTrusted;
    if (trusted !== true) {
      return { reason: "TIME_UNKNOWN", message: config?.copyById?.TIME_UNKNOWN || "服务器时间尚未确认" };
    }
    if (state?.periodId && state.periodId !== config?.activity?.periodId) {
      return { reason: "WRONG_PERIOD", message: "活动期次不匹配" };
    }
    const availability = getSessionAvailability(state, config);
    if (!availability.canOperate) return {
      reason: availability.reason || "NO_ACTIVE_SESSION",
      message: availability.reason === "NOT_STARTED" ? "活动尚未开始，不可兑换" : "当前活动会话不可兑换"
    };
    if (state?.processing === true || state?.busy === true || state?.phase === "DRAWING" || state?.phase === "EXCHANGING") {
      return { reason: "BUSY", message: "正在处理上一笔操作，请稍候" };
    }
    return sessionReason(state);
  }
  function getShopItemStatus(state, itemId, config) {
    const item = shopRows(config).find((row) => row.id === itemId);
    if (!item) {
      return { itemId, status: "INVALID", canExchange: false, reason: "ITEM_NOT_FOUND", message: "商品不存在" };
    }
    const reward2 = rewardRows(config).find((row) => row.rewardId === item.rewardId);
    const count = usedCount(state, itemId);
    const balance = state?.availablePoints;
    const limit = item.exchangeLimit;
    const remaining = limit === -1 ? null : Number.isInteger(limit) ? Math.max(0, limit - count) : null;
    const base = {
      itemId,
      item,
      reward: reward2,
      price: item.pointPrice,
      exchangeLimit: limit,
      exchanged: count,
      remaining,
      availablePoints: balance,
      unlocked: collectionComplete(state, config),
      canExchange: false
    };
    const fail = (status, reason, message) => ({ ...base, status, reason, message });
    if (!reward2 || !Number.isInteger(item.pointPrice) || item.pointPrice <= 0 || !(limit === -1 || Number.isInteger(limit) && limit > 0)) {
      return fail("INVALID", "INVALID_CONFIG", "商品配置无效");
    }
    if (!Number.isInteger(count) || !Number.isInteger(balance) || balance < 0 || limit !== -1 && count > limit) {
      return fail("UNAVAILABLE", "INVALID_SAVE", "商店存档数据无效");
    }
    const blocked = unavailable(state, config);
    if (blocked) return fail("UNAVAILABLE", blocked.reason, blocked.message);
    if (!base.unlocked) {
      return fail("LOCKED", "SHOP_LOCKED", config?.copyById?.SHOP_LOCK || "需要集齐全部收藏解锁兑换商城");
    }
    if (limit !== -1 && count >= limit) return fail("SOLD_OUT", "SOLD_OUT", "已售罄");
    if (balance < item.pointPrice) {
      return fail("INSUFFICIENT_POINTS", "POINT_LOW", config?.copyById?.POINT_LOW || "积分不足，请继续扭蛋获取");
    }
    return { ...base, status: "AVAILABLE", reason: null, message: "", canExchange: true };
  }
  function evaluateExchange(draft, itemId, transactionId2, config) {
    if (typeof transactionId2 !== "string" || !transactionId2.trim()) {
      return { ok: false, reason: "INVALID_TRANSACTION_ID", message: "兑换事务ID不能为空" };
    }
    const previous = savedTransaction2(draft, transactionId2);
    if (previous) {
      return {
        ok: false,
        replay: true,
        reason: "ALREADY_EXCHANGED",
        message: "该笔兑换已确认，未重复扣分或发奖",
        transactionId: transactionId2,
        transaction: previous
      };
    }
    const status = getShopItemStatus(draft, itemId, config);
    if (!status.canExchange) {
      return { ok: false, itemId, transactionId: transactionId2, reason: status.reason, message: status.message, status: status.status };
    }
    if (draft.shopCounts != null && (typeof draft.shopCounts !== "object" || Array.isArray(draft.shopCounts)) || draft.confirmedTransactions != null && (typeof draft.confirmedTransactions !== "object" || Array.isArray(draft.confirmedTransactions)) || draft.rewardLedger != null && !Array.isArray(draft.rewardLedger)) {
      return { ok: false, reason: "INVALID_SAVE", message: "兑换存档格式无效", itemId, transactionId: transactionId2 };
    }
    const periodId3 = draft.periodId || config?.activity?.periodId;
    const instance = draft.testInstanceId ?? draft.testInstance;
    const sourceId = `${periodId3}${instance == null ? "" : `:${String(instance)}`}:exchange:${transactionId2}`;
    const ledgerId = `${sourceId}:0`;
    if (draft.rewardLedger?.some((entry2) => entry2.ledgerId === ledgerId)) {
      return { ok: false, reason: "INCONSISTENT_SAVE", message: "奖励账本已有此笔兑换，请检查事务记录", itemId, transactionId: transactionId2 };
    }
    let ledgerEntries;
    try {
      ledgerEntries = grantRewards(draft, [status.item.rewardId], sourceId, config);
    } catch (error) {
      return { ok: false, reason: "GRANT_FAILED", message: error.message, itemId, transactionId: transactionId2 };
    }
    if (ledgerEntries.length !== 1) {
      return { ok: false, reason: "INCONSISTENT_SAVE", message: "奖励未能生成唯一到账记录", itemId, transactionId: transactionId2 };
    }
    draft.availablePoints -= status.price;
    if (!draft.shopCounts) draft.shopCounts = {};
    draft.shopCounts[itemId] = status.exchanged + 1;
    if (!draft.confirmedTransactions) draft.confirmedTransactions = {};
    const transaction = {
      transactionId: transactionId2,
      type: "EXCHANGE",
      periodId: periodId3,
      itemId,
      sourceId,
      rewardId: status.item.rewardId,
      pointCost: status.price,
      exchanged: draft.shopCounts[itemId],
      ledgerIds: ledgerEntries.map((entry2) => entry2.ledgerId)
    };
    draft.confirmedTransactions[transactionId2] = transaction;
    return {
      ok: true,
      itemId,
      transactionId: transactionId2,
      transaction,
      sourceId,
      pointCost: status.price,
      availablePoints: draft.availablePoints,
      remaining: status.exchangeLimit === -1 ? null : status.exchangeLimit - draft.shopCounts[itemId],
      reward: status.reward,
      ledgerEntries
    };
  }

  // project:src/state.js
  var clone2 = (value) => JSON.parse(JSON.stringify(value));
  var deny = (reason, message) => ({ ok: false, reason, message });
  var popupId2 = (popup) => typeof popup === "string" ? popup : popup?.popupId || popup?.id;
  var insideScreens = /* @__PURE__ */ new Set(["machine", "drawResult", "collection", "claim", "shop", "exchangeConfirm", "info", "rulesGuide", "debug"]);
  function actionName(action) {
    return String(action?.type || action?.action || "").replace(/([a-z])([A-Z])/g, "$1_$2").replace(/[\s-]+/g, "_").toUpperCase();
  }
  function event(draft, kind, details = {}) {
    draft.eventLog || (draft.eventLog = []);
    draft.eventSerial = (Number(draft.eventSerial) || 0) + 1;
    const entry2 = {
      eventId: `${draft.periodId}:${draft.testInstanceId}:${draft.eventSerial}`,
      periodId: draft.periodId,
      kind,
      ...details
    };
    draft.eventLog.push(entry2);
    return entry2;
  }
  function enqueue(draft, popup) {
    draft.popupQueue || (draft.popupQueue = []);
    if (!draft.popupQueue.some((item) => popupId2(item) === popupId2(popup))) draft.popupQueue.push(popup);
  }
  function removePopup(draft, id) {
    const index = draft.popupQueue.findIndex((item) => popupId2(item) === id);
    if (index < 0) return false;
    draft.popupQueue.splice(index, 1);
    return true;
  }
  function clock(draft, config, changes = {}) {
    const now = changes.serverTime ?? changes.serverNow ?? changes.now ?? draft.serverTime;
    const trusted = changes.timeTrusted ?? draft.timeTrusted;
    const switchState2 = changes.switchState ?? draft.switchState;
    draft.serverTime = now;
    draft.serverNow = now;
    draft.simulatedServerTime = now;
    draft.timeTrusted = trusted;
    draft.switchState = switchState2;
    draft.simulatedServer = { now, timeTrusted: trusted };
    draft.debug = {
      ...draft.debug || {},
      serverNow: now,
      serverTime: now,
      timeTrusted: trusted,
      switchState: switchState2,
      level: draft.level,
      completedWave: draft.completedWave,
      qualified: draft.qualified,
      mutexClear: draft.mutualExclusionClear,
      resourcesReady: draft.resourcesReady
    };
  }
  function fresh(config, testInstanceId, existingLedger = []) {
    const activity = config.activity;
    const layer = config.playerLayers[0];
    const save = {
      periodId: activity.periodId,
      testInstanceId,
      initialized: false,
      screen: "entry",
      previousScreen: null,
      activitySession: false,
      coverSeen: false,
      guideSeen: false,
      guideIndex: 0,
      shopUnlockSeen: false,
      selectedTierId: [...config.drawTiers].sort((a, b) => a.sortOrder - b.sortOrder)[0]?.tierId,
      layerId: layer?.layerId,
      sequenceGroup: layer?.sequenceGroup,
      cursor: { roomId: layer?.initialRoomId, index: layer?.initialIndex },
      tickets: 0,
      ownedToyIds: [],
      newToyIds: [],
      totalPoints: 0,
      availablePoints: 0,
      nodeClaims: {},
      shopCounts: {},
      supplyUsage: {},
      processedEventIds: {},
      confirmedTransactions: {},
      sequenceResults: {},
      rewardLedger: clone2(existingLedger),
      eventLog: [],
      eventSerial: 0,
      popupQueue: [],
      settlement: null,
      sessionCompleteTracked: false,
      confirmationSerial: 0,
      progressOutbox: [],
      level: activity.minLevel,
      completedWave: activity.requiredWave,
      qualified: true,
      mutualExclusionClear: true,
      resourcesReady: true
    };
    clock(save, config, {
      serverTime: activity.startAt,
      timeTrusted: activity.timeTrusted,
      switchState: activity.switchState
    });
    return save;
  }
  function repair(saved, config) {
    const value = clone2(saved);
    value.popupQueue ?? (value.popupQueue = []);
    value.eventLog ?? (value.eventLog = []);
    value.eventSerial ?? (value.eventSerial = value.eventLog.length);
    value.rewardLedger ?? (value.rewardLedger = []);
    value.processedEventIds ?? (value.processedEventIds = {});
    value.confirmedTransactions ?? (value.confirmedTransactions = {});
    value.sequenceResults ?? (value.sequenceResults = {});
    value.nodeClaims ?? (value.nodeClaims = {});
    value.shopCounts ?? (value.shopCounts = {});
    value.ownedToyIds ?? (value.ownedToyIds = []);
    value.newToyIds ?? (value.newToyIds = []);
    value.supplyUsage ?? (value.supplyUsage = {});
    value.progressOutbox ?? (value.progressOutbox = []);
    value.confirmationSerial ?? (value.confirmationSerial = 0);
    value.testInstanceId ?? (value.testInstanceId = "initial");
    value.screen ?? (value.screen = "entry");
    value.activitySession ?? (value.activitySession = insideScreens.has(value.screen));
    value.guideIndex ?? (value.guideIndex = 0);
    value.shopUnlockSeen ?? (value.shopUnlockSeen = false);
    value.selectedTierId ?? (value.selectedTierId = config.drawTiers[0]?.tierId);
    value.layerId ?? (value.layerId = config.playerLayers[0]?.layerId);
    if (value.settlement?.status !== "FINALIZED" && value.settlement?.finalized !== true) {
      value.sequenceGroup ?? (value.sequenceGroup = config.playerLayers.find((row) => row.layerId === value.layerId)?.sequenceGroup);
      value.cursor ?? (value.cursor = {
        roomId: config.playerLayers.find((row) => row.layerId === value.layerId)?.initialRoomId,
        index: config.playerLayers.find((row) => row.layerId === value.layerId)?.initialIndex
      });
    }
    value.level ?? (value.level = config.activity.minLevel);
    value.completedWave ?? (value.completedWave = config.activity.requiredWave);
    value.qualified ?? (value.qualified = true);
    value.mutualExclusionClear ?? (value.mutualExclusionClear = true);
    value.resourcesReady ?? (value.resourcesReady = true);
    value.serverTime ?? (value.serverTime = value.debug?.serverTime ?? config.activity.startAt);
    value.timeTrusted ?? (value.timeTrusted = value.debug?.timeTrusted ?? config.activity.timeTrusted);
    value.switchState ?? (value.switchState = value.debug?.switchState ?? config.activity.switchState);
    clock(value, config);
    return value;
  }
  function entryReason(state, config) {
    const availability = getSessionAvailability(state, config);
    if (!availability.timeTrusted) return deny("TIME_UNCONFIRMED", config.copyById?.TIME_UNKNOWN || "服务器时间尚未确认");
    if (state.settlement?.status === "FINALIZED") return deny("ALREADY_SETTLED", "本期活动已经结算");
    if (state.settlement?.status === "PENDING_MAKEUP") return deny("SETTLING", "请先完成本期结束结算");
    if (state.level < config.activity.minLevel) return deny("LEVEL_REQUIRED", `活动入口当前不可用：需要达到${config.activity.minLevel}级`);
    if (state.completedWave < config.activity.requiredWave) return deny("WAVE_REQUIRED", `活动入口当前不可用：需要完成第${config.activity.requiredWave}波订单`);
    if (!state.qualified) return deny("NOT_QUALIFIED", "活动入口当前不可用：活动资格不满足");
    if (!state.mutualExclusionClear) return deny("ACTIVITY_CONFLICT", "活动入口当前不可用：存在互斥活动");
    if (!state.resourcesReady) return deny("RESOURCE_UNAVAILABLE", "活动入口当前不可用：活动资源尚未就绪");
    if (state.switchState === "SOFT_OFF" && !state.initialized) return deny("SOFT_OFF", "活动入口当前不可用：软关后不再开启本期活动");
    if (!availability.canEnter) return deny(availability.reason || "UNAVAILABLE", `活动入口当前不可用：${availability.reason || "开放条件未满足"}`);
    return null;
  }
  function mutatingAllowed(state, config) {
    if (!state.timeTrusted || !Number.isFinite(Date.parse(state.serverTime))) {
      return deny("TIME_UNCONFIRMED", config.copyById?.TIME_UNKNOWN || "服务器时间尚未确认");
    }
    if (!state.activitySession || state.settlement) return deny("NO_ACTIVE_SESSION", "当前不在可操作的扭蛋活动会话内");
    const availability = getSessionAvailability(state, config);
    if (!availability.canOperate) return deny(
      availability.reason || "UNAVAILABLE",
      availability.reason === "NOT_STARTED" ? "活动尚未开始，不可领奖或兑换" : "当前活动会话不可操作"
    );
    return null;
  }
  function queueDraw(draft, result, config) {
    const base = result.transactionId;
    enqueue(draft, {
      id: `${base}:results`,
      popupId: `${base}:results`,
      type: "drawResult",
      batchId: result.batchId,
      transactionId: base,
      results: result.results,
      pointsGained: result.pointsGained,
      cost: result.cost
    });
    for (const reward2 of result.automaticRewards) enqueue(draft, {
      id: `${base}:node:${reward2.nodeId}`,
      popupId: `${base}:node:${reward2.nodeId}`,
      type: "claim",
      source: "AUTO",
      nodeId: reward2.nodeId,
      label: reward2.label,
      ledgerEntries: reward2.ledgerEntries
    });
    const complete = config.nodes.find((node2) => node2.nodeType === "COMPLETE");
    if (complete && result.automaticRewards.some((item) => item.nodeId === complete.nodeId)) {
      enqueue(draft, {
        id: `${base}:shop-unlock`,
        popupId: `${base}:shop-unlock`,
        type: "shopUnlock",
        text: config.copyById?.SHOP_UNLOCK || ""
      });
    }
  }
  function settleIfOutside(draft, config) {
    if (!draft.initialized || draft.activitySession || draft.settlement?.status === "FINALIZED") return null;
    const availability = getSessionAvailability(draft, config);
    if (!availability.timeTrusted || !availability.expired) return null;
    const outcome = beginSettlement(draft, config);
    if (outcome.ok && !outcome.replay) event(draft, "settlement_started", {
      settlementId: outcome.settlementId,
      makeupNodeIds: outcome.makeup.map((item) => item.nodeId)
    });
    return outcome;
  }
  function createStore({ sdk, config, persistence }) {
    if (!config?.activity || !persistence) throw new Error("活动状态初始化缺少配置或存档适配器");
    const listeners = /* @__PURE__ */ new Set();
    let save = persistence.load();
    let state;
    let readOnly = persistence.status() !== "READY";
    let readOnlyView = null;
    function makeReadOnlyView(saved) {
      const view = clone2(saved);
      view.popupQueue = [];
      if (view.screen !== "debug") {
        view.screen = view.initialized && !view.settlement ? "machine" : "entry";
      }
      return view;
    }
    if (save && save.periodId !== config.activity.periodId) {
      readOnly = true;
      state = repair(save, config);
    } else if (save) {
      state = repair(save, config);
      const availability = getSessionAvailability(state, config);
      if (state.activitySession && (availability.expired || !availability.timeTrusted)) {
        const draft = clone2(state);
        draft.activitySession = false;
        draft.screen = "entry";
        if (availability.timeTrusted) settleIfOutside(draft, config);
        if (!readOnly && persistence.commit(draft).ok) state = draft;
        else readOnly = true;
      } else {
        if (!readOnly && state.settlement?.status === "PENDING_MAKEUP" && !state.activitySession) {
          settleIfOutside(state, config);
        }
        if (!readOnly && JSON.stringify(state) !== JSON.stringify(save)) {
          if (!persistence.commit(state).ok) readOnly = true;
        }
      }
    } else {
      state = fresh(config, "initial");
      if (!readOnly && !persistence.commit(state).ok) readOnly = true;
    }
    if (!readOnly) {
      const flushed = flushProgressEvents(sdk, state, persistence);
      if (flushed.ok) state = flushed.state;
      else if (flushed.storageFailed) readOnly = true;
    }
    if (readOnly) readOnlyView = makeReadOnlyView(state);
    function publicState() {
      const result = clone2(readOnlyView || state);
      result.readOnly = readOnly || persistence.status() !== "READY";
      result.persistenceStatus = result.readOnly ? "READ_ONLY" : "READY";
      result.saveStatus = result.persistenceStatus;
      return result;
    }
    function notify() {
      const snapshot = publicState();
      for (const listener of [...listeners]) {
        try {
          listener(snapshot);
        } catch {
        }
      }
    }
    function commit(draft, before, outcome, kind, detail = {}) {
      if (kind) event(draft, kind, detail);
      stageProgressEvents(before, draft, config);
      const receipt = persistence.commit(draft);
      if (!receipt.ok) {
        readOnly = true;
        readOnlyView = makeReadOnlyView(state);
        notify();
        return deny("SAVE_ERROR", config.copyById?.SAVE_ERROR || receipt.error || "活动存档暂不可用");
      }
      state = draft;
      notify();
      const flushed = flushProgressEvents(sdk, state, persistence);
      if (flushed.ok) state = flushed.state;
      else if (flushed.storageFailed) {
        readOnly = true;
        readOnlyView = makeReadOnlyView(state);
        notify();
      }
      return { ...outcome, ok: true };
    }
    function dispatch(input) {
      const action = typeof input === "string" ? { type: input } : input || {};
      const type = actionName(action);
      if (!type) return deny("INVALID_ACTION", "缺少操作类型");
      if (readOnly || persistence.status() !== "READY") {
        readOnly = true;
        readOnlyView || (readOnlyView = makeReadOnlyView(state));
        const view = readOnlyView;
        if (["OPEN_SCREEN", "NAVIGATE", "SHOW_SCREEN"].includes(type)) {
          const next = action.screen ?? action.target;
          if (!["collection", "shop", "info", "rulesGuide", "debug", "machine"].includes(next)) return deny("INVALID_SCREEN", "页面不存在");
          if (next !== "debug" && !view.initialized) return deny("NO_SAVED_ACTIVITY", "尚无可查看的本期活动存档");
          view.previousScreen = view.screen;
          view.screen = next;
          notify();
          return { ok: true, readOnly: true, screen: next };
        }
        if (["CLOSE_SCREEN", "BACK"].includes(type)) {
          view.screen = view.screen === "debug" ? view.previousScreen || (view.initialized ? "machine" : "entry") : view.screen === "machine" ? "entry" : view.initialized ? "machine" : "entry";
          notify();
          return { ok: true, readOnly: true, screen: view.screen };
        }
        if (["ENTRY_OPEN", "OPEN_ENTRY", "ENTER", "OPEN_ACTIVITY", "READONLY_OPEN"].includes(type) && view.initialized && !view.settlement) {
          view.screen = "machine";
          notify();
          return { ok: true, readOnly: true, screen: view.screen };
        }
        if (["LEAVE_ACTIVITY", "MACHINE_CLOSE", "EXIT"].includes(type)) {
          view.screen = "entry";
          notify();
          return { ok: true, readOnly: true, screen: "entry" };
        }
        if (type === "ENDING_SUMMARY_OPEN" && view.settlement?.status === "FINALIZED" && view.settlement.summary) {
          view.screen = "endingSummary";
          notify();
          return { ok: true, readOnly: true, screen: view.screen };
        }
        if (type === "ENDING_SUMMARY_CLOSE" && view.screen === "endingSummary") {
          view.screen = "entry";
          notify();
          return { ok: true, readOnly: true, screen: view.screen };
        }
        return deny("SAVE_ERROR", config.copyById?.SAVE_ERROR || "活动存档暂不可用，当前只读");
      }
      if (type === "DEBUG_READ_ONLY") {
        readOnly = true;
        readOnlyView = makeReadOnlyView(state);
        notify();
        return { ok: true, readOnly: true, screen: readOnlyView.screen };
      }
      const before = state;
      let draft = clone2(state);
      let outcome = { ok: true, type };
      let kind = null;
      let detail = {};
      try {
        switch (type) {
          // R01/R08：首次进入初始化与封面显示属于同一个可持久化提交。
          case "ENTRY_OPEN":
          case "OPEN_ENTRY":
          case "ENTER":
          case "OPEN_ACTIVITY": {
            const blocked = entryReason(draft, config);
            if (blocked) return blocked;
            if (!draft.initialized) {
              const layer = config.playerLayers.find((row) => row.layerId === draft.layerId) || config.playerLayers[0];
              draft.layerId = layer.layerId;
              draft.sequenceGroup = layer.sequenceGroup;
              draft.cursor = { roomId: layer.initialRoomId, index: layer.initialIndex };
              if (!Number.isSafeInteger(draft.tickets) || draft.tickets < 0 || !Number.isSafeInteger(draft.tickets + config.activity.initialTickets)) {
                return deny("INVALID_BALANCE", "扭蛋券余额无效，未初始化活动");
              }
              draft.tickets += config.activity.initialTickets;
              draft.initialized = true;
              draft.initializedAt = draft.serverTime;
              event(draft, "period_initialized", { layerId: layer.layerId, sequenceGroup: layer.sequenceGroup });
            }
            draft.activitySession = true;
            draft.screen = draft.coverSeen ? "machine" : "cover";
            if (!draft.coverSeen) enqueue(draft, { id: "opening-cover", popupId: "opening-cover", type: "cover" });
            else if (!draft.guideSeen) enqueue(draft, {
              id: "first-guide",
              popupId: "first-guide",
              type: "guide",
              index: draft.guideIndex
            });
            outcome = { ok: true, screen: draft.screen };
            kind = "activity_entered";
            break;
          }
          case "COVER_START":
          case "START":
          case "START_ACTIVITY": {
            if (draft.screen !== "cover") return deny("NO_COVER", "开启封面当前未显示");
            draft.coverSeen = true;
            removePopup(draft, "opening-cover");
            draft.screen = "machine";
            if (!draft.guideSeen) enqueue(draft, { id: "first-guide", popupId: "first-guide", type: "guide", index: draft.guideIndex });
            outcome = { ok: true, screen: "machine" };
            break;
          }
          case "GUIDE_NEXT": {
            if (!draft.popupQueue.some((item) => popupId2(item) === "first-guide")) return deny("NO_GUIDE", "引导未显示");
            const steps = config.copy.filter((row) => /^GUIDE_/.test(row.copyId)).length;
            draft.guideIndex = Math.min(draft.guideIndex + 1, steps);
            if (draft.guideIndex >= steps) {
              draft.guideSeen = true;
              removePopup(draft, "first-guide");
            } else {
              const guide = draft.popupQueue.find((item) => popupId2(item) === "first-guide");
              guide.index = draft.guideIndex;
            }
            outcome = { ok: true, guideIndex: draft.guideIndex, complete: draft.guideSeen };
            break;
          }
          case "GUIDE_CLOSE":
          case "SKIP_GUIDE": {
            removePopup(draft, "first-guide");
            draft.guideSeen = true;
            outcome = { ok: true };
            break;
          }
          case "SELECT_TIER":
          case "SET_TIER": {
            const tierId = action.tierId ?? action.id;
            if (!config.drawTiers.some((row) => row.tierId === tierId)) return deny("INVALID_TIER", "倍率不存在");
            draft.selectedTierId = tierId;
            outcome = { ok: true, tierId };
            break;
          }
          case "DRAW":
          case "DRAW_CONFIRM": {
            const blocked = mutatingAllowed(draft, config);
            if (blocked) return blocked;
            if (draft.popupQueue.length) return deny("POPUP_BUSY", "请先关闭当前弹窗");
            const batchId = action.batchId ?? action.transactionId ?? `${draft.periodId}:${draft.testInstanceId}:batch:${(draft.eventSerial || 0) + 1}`;
            outcome = evaluateDraw(draft, action.tierId ?? draft.selectedTierId, batchId, config);
            if (!outcome.ok) return outcome;
            queueDraw(draft, outcome, config);
            kind = "draw_confirmed";
            detail = { batchId, cost: outcome.cost, reads: outcome.reads, pointsGained: outcome.pointsGained };
            for (const result of outcome.results) if (result.isNew) event(draft, "toy_collected", { batchId, toyId: result.toyId });
            for (const reward2 of outcome.automaticRewards) {
              const node2 = config.nodes.find((row) => row.nodeId === reward2.nodeId);
              event(draft, node2.eventName, { batchId, nodeId: reward2.nodeId });
            }
            break;
          }
          case "SUPPLY":
          case "DEBUG_SUPPLY":
          case "SUPPLY_EVENT": {
            const request = action.event || action;
            outcome = evaluateSupply(draft, {
              eventId: request.eventId,
              source: request.source,
              result: request.result
            }, config);
            if (!outcome.ok) {
              const rejected = outcome;
              const logged = commit(draft, before, { ok: true }, "supply_rejected", {
                upstreamEventId: request.eventId,
                source: request.source,
                result: request.result,
                reason: rejected.reason,
                code: rejected.code,
                duplicate: rejected.duplicate === true,
                ticketsGranted: 0
              });
              return logged.ok ? rejected : logged;
            }
            kind = outcome.success ? "supply_granted" : "supply_no_reward";
            detail = {
              source: outcome.source,
              upstreamEventId: outcome.eventId,
              result: outcome.result,
              configuredTickets: outcome.configuredTickets,
              ticketsGranted: outcome.ticketsGranted,
              reason: outcome.reason
            };
            break;
          }
          case "CLAIM_NODE":
          case "QUALITY_CLAIM": {
            const blocked = mutatingAllowed(draft, config);
            if (blocked) return blocked;
            if (draft.screen !== "collection") return deny("COLLECTION_REQUIRED", "请在玩具收藏页领取品质奖励");
            if (draft.popupQueue?.length) return deny("POPUP_BUSY", "请先处理已确认结果及奖励弹窗");
            const nodeId = action.nodeId ?? action.id;
            const node2 = config.nodes.find((row) => row.nodeId === nodeId);
            if (node2?.nodeType !== "QUALITY" || node2.claimMode !== "MANUAL") return deny("NOT_MANUAL", "此节点不支持手动领取");
            outcome = claimNode(draft, nodeId, config);
            if (!outcome.ok) return outcome;
            enqueue(draft, {
              id: `claim:${nodeId}`,
              popupId: `claim:${nodeId}`,
              type: "claim",
              source: "MANUAL",
              sourceId: outcome.sourceId,
              nodeId,
              label: node2.label,
              ledgerEntries: outcome.ledgerEntries
            });
            kind = node2.eventName;
            detail = { nodeId };
            break;
          }
          case "EXCHANGE":
          case "EXCHANGE_CONFIRM": {
            const blocked = mutatingAllowed(draft, config);
            if (blocked) return blocked;
            const itemId = action.itemId ?? action.id;
            const confirmation = draft.popupQueue?.[0];
            const transactionId2 = action.transactionId;
            if (!confirmation || confirmation.type !== "exchangeConfirm" || confirmation.itemId !== itemId || typeof transactionId2 !== "string" || !transactionId2 || confirmation.transactionId !== transactionId2) {
              return deny("CONFIRMATION_REQUIRED", "请先打开对应商品的兑换确认弹窗");
            }
            outcome = evaluateExchange(draft, itemId, transactionId2, config);
            if (!outcome.ok) return outcome;
            removePopup(draft, `exchange:${itemId}`);
            enqueue(draft, {
              id: `exchange-result:${transactionId2}`,
              popupId: `exchange-result:${transactionId2}`,
              type: "claim",
              source: "EXCHANGE",
              itemId,
              transactionId: transactionId2,
              ledgerEntries: outcome.ledgerEntries
            });
            kind = "exchange_confirmed";
            detail = { itemId, transactionId: transactionId2, pointCost: outcome.pointCost };
            break;
          }
          case "SHOP_CONFIRM":
          case "EXCHANGE_PREVIEW": {
            const blocked = mutatingAllowed(draft, config);
            if (blocked) return blocked;
            if (draft.popupQueue?.length) return deny("POPUP_BUSY", "请先处理当前弹窗");
            const itemId = action.itemId ?? action.id;
            if (!config.shop.some((row) => row.id === itemId)) return deny("ITEM_NOT_FOUND", "商品不存在");
            const serial = (Number(draft.confirmationSerial) || 0) + 1;
            draft.confirmationSerial = serial;
            const transactionId2 = `${draft.periodId}:${draft.testInstanceId}:exchange-confirm:${serial}`;
            enqueue(draft, {
              id: `exchange:${itemId}`,
              popupId: `exchange:${itemId}`,
              type: "exchangeConfirm",
              itemId,
              transactionId: transactionId2
            });
            outcome = { ok: true, itemId, transactionId: transactionId2 };
            break;
          }
          case "ENDING_SUMMARY_OPEN": {
            const end = Date.parse(config.activity.endAt);
            const now = Date.parse(draft.serverTime);
            if (draft.settlement?.status !== "FINALIZED" || !draft.settlement.summary || draft.timeTrusted !== true || !Number.isFinite(now) || now < end || now >= end + config.activity.settlementDays * 864e5) {
              return deny("SUMMARY_UNAVAILABLE", "当前不在本期结束结果展示期");
            }
            draft.screen = "endingSummary";
            outcome = { ok: true, screen: "endingSummary" };
            break;
          }
          case "ENDING_SUMMARY_CLOSE": {
            if (draft.screen !== "endingSummary") return deny("SUMMARY_UNAVAILABLE", "结束结果未打开");
            draft.screen = "entry";
            outcome = { ok: true, screen: "entry" };
            break;
          }
          case "OPEN_SCREEN":
          case "NAVIGATE":
          case "SHOW_SCREEN": {
            const next = action.screen ?? action.target;
            if (!["collection", "shop", "info", "rulesGuide", "debug", "machine"].includes(next)) return deny("INVALID_SCREEN", "页面不存在");
            if (draft.popupQueue?.length && next !== "debug") return deny("POPUP_BUSY", "请先处理已确认结果及奖励弹窗");
            if (next !== "debug" && !draft.activitySession) return deny("NO_ACTIVE_SESSION", "请先进入活动");
            draft.previousScreen = draft.screen;
            draft.screen = next;
            if (next === "shop" && getNodeStatus(
              draft,
              config,
              config.nodes.find((node2) => node2.nodeType === "COMPLETE")?.nodeId
            )?.reached) draft.shopUnlockSeen = true;
            outcome = { ok: true, screen: next };
            break;
          }
          case "CLOSE_SCREEN":
          case "BACK": {
            if (draft.popupQueue?.length && draft.screen !== "debug") return deny("POPUP_BUSY", "请先处理已确认结果及奖励弹窗");
            if (draft.screen === "collection") draft.newToyIds = [];
            if (draft.screen === "cover") {
              draft.coverSeen = true;
              removePopup(draft, "opening-cover");
              draft.activitySession = false;
              draft.screen = "entry";
              settleIfOutside(draft, config);
            } else if (draft.screen === "debug") {
              draft.screen = draft.activitySession ? draft.previousScreen || "machine" : "entry";
            } else if (draft.activitySession && draft.screen !== "machine") {
              draft.screen = "machine";
            } else {
              draft.activitySession = false;
              draft.screen = "entry";
              settleIfOutside(draft, config);
            }
            outcome = { ok: true, screen: draft.screen };
            break;
          }
          case "LEAVE_ACTIVITY":
          case "MACHINE_CLOSE":
          case "EXIT": {
            if (draft.popupQueue?.length) return deny("POPUP_BUSY", "请先收下已确认结果及奖励，再离开活动");
            draft.activitySession = false;
            draft.screen = "entry";
            draft.newToyIds = [];
            draft.popupQueue = [];
            const settled = settleIfOutside(draft, config);
            outcome = { ok: true, screen: draft.screen, settlement: settled };
            break;
          }
          case "POPUP_CLOSE":
          case "DISMISS_POPUP": {
            const first = draft.popupQueue[0];
            const id = action.popupId ?? action.id ?? popupId2(first);
            if (!first || id !== popupId2(first)) return deny("POPUP_ORDER", "请先处理当前弹窗");
            if (first.type === "makeup" && draft.settlement?.makeup?.some((item) => item.status === "PENDING")) {
              return deny("MAKEUP_PENDING", "请先领取补发奖励");
            }
            removePopup(draft, id);
            if (first.type === "cover") {
              draft.coverSeen = true;
              draft.activitySession = false;
              draft.screen = "entry";
              settleIfOutside(draft, config);
            }
            if (first.type === "guide") draft.guideSeen = true;
            if (first.type === "ending") draft.settlement.endingAcknowledged = true;
            if (first.type === "makeup" || first.type === "ending" && !draft.settlement?.makeup?.length) {
              const final = finalizeSettlement(draft, config);
              if (!final.ok) return final;
              event(draft, "settlement_finalized", { settlementId: final.settlementId });
            }
            outcome = { ok: true, dismissed: id, nextPopup: draft.popupQueue[0] || null };
            break;
          }
          case "CLAIM_MAKEUP":
          case "MAKEUP_CLAIM": {
            if (draft.popupQueue[0]?.type !== "makeup") return deny("MAKEUP_UNAVAILABLE", "补发弹窗尚未出现");
            outcome = claimMakeup(draft, action.settlementId ?? draft.settlement?.id, config);
            if (!outcome.ok) return outcome;
            for (const claim2 of outcome.claims) {
              const node2 = config.nodes.find((row) => row.nodeId === claim2.nodeId);
              event(draft, node2.eventName, {
                nodeId: claim2.nodeId,
                settlementId: outcome.settlementId,
                source: "MAKEUP"
              });
            }
            kind = "makeup_claimed";
            detail = { settlementId: outcome.settlementId, nodeIds: outcome.claims.map((row) => row.nodeId) };
            break;
          }
          case "DEBUG_SET":
          case "SET_DEBUG":
          case "DEBUG_UPDATE": {
            const changes = action.changes || action.values || action;
            for (const key of ["level", "completedWave", "qualified", "mutualExclusionClear", "resourcesReady"]) {
              if (Object.prototype.hasOwnProperty.call(changes, key)) draft[key] = changes[key];
            }
            if (changes.layerId != null && changes.layerId !== draft.layerId) {
              if (draft.initialized) return deny("LAYER_LOCKED", "本期分层及序列已锁定；请重新试玩后调整");
              const layer = config.playerLayers.find((row) => row.layerId === changes.layerId);
              if (!layer) return deny("INVALID_LAYER", "玩家分层不存在");
              draft.layerId = layer.layerId;
              draft.sequenceGroup = layer.sequenceGroup;
              draft.cursor = { roomId: layer.initialRoomId, index: layer.initialIndex };
            }
            if (changes.switchState != null && !["OPEN", "SOFT_OFF", "HARD_OFF"].includes(changes.switchState)) return deny("INVALID_SWITCH", "活动开关无效");
            const nextTime = changes.serverTime ?? changes.serverNow ?? changes.now;
            if (nextTime != null && !Number.isFinite(typeof nextTime === "number" ? nextTime : Date.parse(nextTime))) {
              return deny("INVALID_TIME", "模拟服务器时间无效");
            }
            clock(draft, config, changes);
            const availability = getSessionAvailability(draft, config);
            if (draft.initialized && !draft.activitySession && availability.expired) settleIfOutside(draft, config);
            kind = "debug_state_updated";
            detail = { timeTrusted: draft.timeTrusted, serverTime: draft.serverTime, switchState: draft.switchState };
            outcome = { ok: true, availability };
            break;
          }
          case "SIMULATE_RELOGIN":
          case "DEBUG_RELOGIN": {
            draft.activitySession = false;
            draft.screen = "entry";
            draft.previousScreen = "entry";
            draft.popupQueue = (draft.popupQueue || []).filter((popup) => {
              if (popup.type === "ending" || popup.type === "makeup") {
                const settlement = draft.settlement;
                return settlement?.status === "PENDING_MAKEUP" && popup.settlementId === settlement.id && popupId2(popup) === (popup.type === "ending" ? settlement.endingPopupId : settlement.makeupPopupId);
              }
              if (popup.type === "drawResult") {
                return Boolean(draft.confirmedTransactions?.[popup.transactionId]);
              }
              if (popup.type === "shopUnlock") {
                const complete = config.nodes.find((node2) => node2.nodeType === "COMPLETE");
                return Boolean(complete && draft.nodeClaims?.[complete.nodeId]);
              }
              if (popup.type !== "claim") return false;
              if (popup.source === "MANUAL") {
                const claim2 = draft.nodeClaims?.[popup.nodeId];
                return Boolean(claim2?.claimed === true && claim2.sourceId === popup.sourceId && popup.ledgerEntries?.length && popup.ledgerEntries.every((entry2) => entry2.sourceId === popup.sourceId && draft.rewardLedger?.some((saved) => saved.ledgerId === entry2.ledgerId && saved.sourceId === popup.sourceId)));
              }
              if (popup.source === "AUTO") {
                return Boolean(draft.nodeClaims?.[popup.nodeId] && popup.ledgerEntries?.length && popup.ledgerEntries.every((entry2) => draft.rewardLedger?.some((saved) => saved.ledgerId === entry2.ledgerId)));
              }
              if (popup.source === "EXCHANGE") {
                const transaction = draft.confirmedTransactions?.[popup.transactionId];
                return Boolean(transaction?.type === "EXCHANGE" && transaction.itemId === popup.itemId && popup.ledgerEntries?.length && popup.ledgerEntries.every((entry2) => transaction.ledgerIds?.includes(entry2.ledgerId) && draft.rewardLedger?.some((saved) => saved.ledgerId === entry2.ledgerId && saved.sourceId === transaction.sourceId)));
              }
              return false;
            });
            const settled = settleIfOutside(draft, config);
            kind = "simulated_relogin";
            outcome = { ok: true, settlement: settled };
            break;
          }
          case "RESET_TEST_INSTANCE":
          case "REPLAY":
          case "DEBUG_RESET": {
            const serial = (Number(draft.testInstanceSerial) || 0) + 1;
            const previousLedger = draft.rewardLedger || [];
            draft = fresh(config, `test-${serial}`, previousLedger);
            draft.testInstanceSerial = serial;
            kind = "test_instance_reset";
            outcome = { ok: true, testInstanceId: draft.testInstanceId };
            break;
          }
          default:
            return deny("UNKNOWN_ACTION", `未知活动操作：${type}`);
        }
        return commit(draft, before, outcome, kind, detail);
      } catch (error) {
        return deny("ACTION_FAILED", error instanceof Error ? error.message : String(error));
      }
    }
    return {
      getState: publicState,
      dispatch,
      subscribe(listener) {
        if (typeof listener !== "function") throw new TypeError("订阅者必须是函数");
        listeners.add(listener);
        return () => listeners.delete(listener);
      }
    };
  }

  // project:src/art.js
  var SHAPES = {
    frog: `<circle cx='34' cy='31' r='10'/><circle cx='66' cy='31' r='10'/><ellipse cx='50' cy='57' rx='29' ry='23'/><circle class='light' cx='34' cy='31' r='3'/><circle class='light' cx='66' cy='31' r='3'/><path class='line' d='M41 64q9 8 18 0M24 77l-9 8m61-8 9 8'/><circle class='metal' cx='50' cy='89' r='5'/>`,
    leaf_car: `<path d='M17 60q20-38 59-20l9 23-12 12H25Z'/><path class='light' d='M27 58q15-21 38-17-8 16-38 17Z'/><path class='line' d='M23 62h59M48 54l15-10'/><circle class='metal' cx='32' cy='76' r='9'/><circle class='metal' cx='70' cy='76' r='9'/>`,
    mushroom_top: `<path d='M16 48q6-39 35-39t34 39Z'/><path class='light' d='M32 30l6-5m20-8 5 7m6 15 7-2'/><path d='M42 48h17l-4 25H46Z'/><path class='metal' d='M28 78q22-11 45 0L51 91Z'/><path class='line' d='M50 78v9'/>`,
    pine_robot: `<path d='M50 10 71 35 62 38 77 59 64 62 70 80H30l6-18-13-3 15-21-9-3Z'/><rect class='metal' x='37' y='49' width='26' height='18' rx='5'/><path class='line' d='M50 10v-7M30 82l-5 6m45-6 5 6'/><circle class='light' cx='44' cy='56' r='2'/><circle class='light' cx='56' cy='56' r='2'/>`,
    moss_elephant: `<ellipse cx='48' cy='59' rx='30' ry='24'/><circle cx='69' cy='47' r='18'/><ellipse class='light' cx='62' cy='50' rx='12' ry='16'/><path d='M80 50q13 0 7 23-3 11-13 6'/><path class='line' d='M29 76v12m23-11v11m-26-37-9-8'/><circle class='dark' cx='75' cy='41' r='2'/>`,
    diver_duck: `<ellipse cx='46' cy='66' rx='30' ry='20'/><circle cx='67' cy='43' r='17'/><path class='metal' d='M79 47 94 53 78 59Z'/><path class='light' d='M30 53q4-13 20-18l16 2'/><rect class='metal' x='57' y='34' width='19' height='12' rx='5'/><path class='line' d='M25 78 15 85m37-4 8 7M26 61q14-2 19 10'/><circle class='dark' cx='72' cy='39' r='2'/>`,
    star_ship: `<path d='M50 8 61 32 88 34 68 54 74 80 50 67 26 80 32 54 12 34 39 32Z'/><ellipse class='metal' cx='50' cy='56' rx='29' ry='12'/><path class='light' d='M40 35q10-15 20 0l7 15H33Z'/><circle class='dark' cx='50' cy='47' r='5'/>`,
    bubble_jelly: `<path d='M17 56q0-37 33-42 33 5 33 42Z'/><path class='light' d='M26 49q4-22 22-26'/><path class='line' d='M29 57q-10 18 0 28m14-28q-5 16 1 32m13-32q7 16 0 32m14-32q10 19 0 28'/><circle class='metal' cx='41' cy='48' r='3'/><circle class='metal' cx='60' cy='48' r='3'/><circle class='light' cx='82' cy='20' r='6'/>`,
    lighthouse_whale: `<path d='M12 60q16-27 52-21 19 2 23 21-7 25-34 25-34 0-41-25Z'/><path d='M75 48q10-4 16-18v25l-9 6'/><path class='metal' d='M36 39 41 15h17l5 25Z'/><path class='light' d='M39 25h22'/><path class='line' d='M29 68q8 7 17 0m2-54V8'/><circle class='dark' cx='68' cy='58' r='3'/>`,
    shell_sub: `<path d='M15 58q7-31 35-35 30 3 36 35-7 25-36 28-28-3-35-28Z'/><path class='light' d='M31 32q3 24 19 37 16-13 19-37M50 27v42'/><circle class='metal' cx='50' cy='60' r='12'/><circle class='dark' cx='50' cy='60' r='6'/><path class='line' d='M20 73 9 80m71-7 11 7'/>`,
    astral_cat: `<path d='M21 29 28 9 42 22q8-3 16 0L72 9l7 20v35Q78 87 50 87T21 64Z'/><path class='light' d='m30 27-3-10 12 11m31-1 3-10-12 11'/><path class='line' d='M34 52h9m14 0h9M50 60v7m-5 2q5 5 10 0M24 64 10 59m66 5 14-5'/><circle class='metal' cx='50' cy='10' r='4'/>`,
    moon_gramophone: `<path class='metal' d='M18 22q30 7 49-15-1 27-27 34l12 18-8 9-19-22Z'/><path d='M37 59h41v25H24V71Z'/><circle class='light' cx='55' cy='70' r='10'/><circle class='dark' cx='55' cy='70' r='4'/><path class='line' d='M78 72h8v-8'/>`,
    crystal_owl: `<path d='m21 27 16-15 13 12 13-12 16 15v37Q75 85 50 88 25 85 21 64Z'/><path class='light' d='m50 27-9 18 9 15 9-15Z'/><circle class='metal' cx='36' cy='46' r='10'/><circle class='metal' cx='64' cy='46' r='10'/><circle class='dark' cx='37' cy='47' r='3'/><circle class='dark' cx='63' cy='47' r='3'/><path class='line' d='M39 85v6m22-6v6'/>`,
    galaxy_pony: `<path d='M25 83V51l14-19 18-3 15 16-5 16-13 2-4 20Z'/><path class='light' d='M34 43q-15-22 3-34l14 18m10 4q-4-22 11-22l-7 27'/><path class='line' d='M30 75 14 86m47-25 13 24M28 52q-11-8-14 8'/><circle class='metal' cx='59' cy='46' r='3'/>`,
    comet_teapot: `<ellipse cx='49' cy='62' rx='27' ry='24'/><path d='M27 55 11 45l8-11 13 12m41 7q19-17 19 7-3 15-19 14'/><path class='metal' d='M28 40q22-12 43 0l-5 9H33Z'/><circle class='light' cx='49' cy='30' r='6'/><path class='line' d='M28 83h45m-28-22 8-9'/>`,
    rocket_bear: `<path d='M50 9q23 16 22 49L50 77 28 58Q27 25 50 9Z'/><circle class='metal' cx='50' cy='43' r='12'/><path class='light' d='M40 33q10-8 20 0'/><path d='m29 55-15 11 14 3m43-14 15 11-14 3'/><path class='metal' d='M43 75 50 93 57 75Z'/><circle class='dark' cx='45' cy='43' r='2'/><circle class='dark' cx='55' cy='43' r='2'/>`,
    gear_lion: `<path class='metal' d='m50 7 9 9 13-2 4 13 12 7-5 13 5 13-12 7-4 13-13-2-9 9-9-9-13 2-4-13-12-7 5-13-5-13 12-7 4-13 13 2Z'/><circle cx='50' cy='48' r='24'/><path class='light' d='M37 54q13 17 26 0'/><circle class='dark' cx='43' cy='44' r='3'/><circle class='dark' cx='57' cy='44' r='3'/><path class='line' d='M49 52v6'/>`,
    lantern_fox: `<path d='m20 34 15-24 15 14 15-14 15 24-9 31-21 18-21-18Z'/><path class='light' d='M31 53q11 14 19 7 8 7 19-7L50 75Z'/><path class='metal' d='M40 11h20l-3-7H43Z'/><path class='line' d='M42 48h5m6 0h5m-8 12v8M28 70 17 85m55-15 11 15'/>`,
    parade_train: `<rect x='25' y='30' width='56' height='43' rx='8'/><path class='metal' d='M12 51h17v20H12Zm30-36h22v17H42Z'/><path class='light' d='M53 31v25m-17-17h38'/><circle class='dark' cx='38' cy='78' r='9'/><circle class='dark' cx='70' cy='78' r='9'/><path class='line' d='M21 51V39m25-24V7m14 8V7'/>`,
    lava_unicorn: `<path d='M24 79V43l13-16 22-2 20 21-9 15-15 1-5 17Z'/><path class='metal' d='M48 27 55 5l8 22Z'/><path class='light' d='M37 37q-15-24-20-8l10 22m31-23q12-21 21-11l-5 26'/><path class='line' d='M28 73 17 86m43-25 13 24'/><circle class='dark' cx='62' cy='46' r='3'/>`,
    crown_egg: `<ellipse cx='50' cy='58' rx='29' ry='33'/><path class='metal' d='M24 30 18 10l17 8 15-13 15 13 17-8-6 20Z'/><path class='light' d='M34 51q6-16 16-19m0 19 9 10-9 11-9-11Z'/><circle class='dark' cx='50' cy='20' r='4'/><path class='line' d='M30 77q20 12 40 0'/>`,
    sun_peacock: `<path class='metal' d='M50 13 33 5l1 23-19-8 7 25-16 5 22 14 8 17h28l8-17 22-14-16-5 7-25-19 8 1-23Z'/><path d='M37 76q-3-35 13-45 16 10 13 45Z'/><circle class='light' cx='50' cy='39' r='7'/><path class='line' d='M44 79v11m12-11v11M32 39l8 8m28-8-8 8'/>`,
    gem_castle: `<path d='M17 40h16V20h15v20h4V20h15v20h16v43H17Z'/><path class='metal' d='M15 19h21v12H15Zm34 0h21v12H49Zm14 0h21v12H63Z'/><path class='light' d='m50 43 11 12-11 13-11-13Z'/><path class='dark' d='M45 83V69q5-9 10 0v14Z'/><path class='line' d='M22 46h10m36 0h10'/>`,
    gold_pegasus: `<path d='M23 80V48l16-17 19-5 19 18-8 17-15 1-5 18Z'/><path class='metal' d='M38 40Q8 21 17 10q30 1 40 27m-15-1Q7 37 10 52l32-5'/><path class='light' d='M61 27q1-18 14-18l-6 26'/><path class='line' d='M29 74 17 86m40-24 15 24'/><circle class='dark' cx='62' cy='44' r='3'/>`,
    star_phoenix: `<path d='M50 19q-8-17-22-12l8 21Q13 13 10 31l24 22-17 2 16 12-9 19 26-13 26 13-9-19 16-12-17-2 24-22Q87 13 64 28l8-21Q58 2 50 19Z'/><path class='metal' d='m50 7 5 8 9 1-7 7 2 9-9-4-9 4 2-9-7-7 9-1Z'/><path class='light' d='M38 50q12 13 24 0L50 73Z'/><circle class='dark' cx='44' cy='41' r='2'/><circle class='dark' cx='56' cy='41' r='2'/>`
  };
  function color(value, fallback) {
    return typeof value === "string" && /^#[0-9a-f]{3,8}$/i.test(value) ? value : fallback;
  }
  function palette(theme) {
    const quality = theme?.qualityColors || {};
    return {
      background: color(theme?.background, "#201B45"),
      machine: color(theme?.machine, "#D94F61"),
      glass: color(theme?.glass, "#82D9E9"),
      gold: color(theme?.gold, "#F5C96D"),
      surface: color(theme?.surface, "#FFF4DF"),
      quality: Object.fromEntries(["GREEN", "BLUE", "PURPLE", "RED", "GOLD"].map((id) => [id, color(quality[id], color(theme?.gold, "#F5C96D"))]))
    };
  }
  function toyArt(shapeKey, qualityId, state, theme) {
    const key = Object.prototype.hasOwnProperty.call(SHAPES, shapeKey) ? shapeKey : "frog";
    const p = palette(theme);
    const locked = /^(locked|unowned|unknown)$/i.test(String(state ?? ""));
    const ink = locked ? "#8B899F" : p.quality[qualityId] || p.gold;
    return `<svg class='toy-art${locked ? " toy-art--locked" : ""}' data-shape='${key}' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg' aria-hidden='true' focusable='false' style='--toy:${ink}'>
    <ellipse cx='50' cy='91' rx='32' ry='5' fill='#252047' opacity='.18'/>
    <g fill='var(--toy)' stroke='#373252' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'>
      ${SHAPES[key]}
    </g>
    <link rel="stylesheet" href="./src/styles-2.css">
  </svg>`;
  }
  function rewardArt(iconKey, theme) {
    const p = palette(theme);
    const shapes = {
      coin_stack: `<ellipse cx='49' cy='72' rx='30' ry='12'/><path d='M19 57v15q0 13 30 13t30-13V57'/><ellipse cx='49' cy='57' rx='30' ry='12'/><path class='light' d='M25 65v9m7-6v9m34-9v9'/><path class='line' d='M42 48h14m-7-6v17'/>`,
      coin_chest: `<path d='M15 47q0-24 35-27 35 3 35 27v37H15Z'/><path class='light' d='M20 48q25 13 60 0v11Q50 72 20 59Z'/><rect class='dark' x='43' y='52' width='14' height='18' rx='3'/><path class='line' d='M28 33q21-9 44 0'/>`,
      energy_bolt: `<path d='M55 8 23 53h22l-5 39 37-52H54Z'/><path class='light' d='m55 20-18 29h17l-5 28 19-31H50Z'/>`,
      energy_flask: `<path d='M40 9h20M44 10v28L23 76q-3 12 12 13h30q15-1 12-13L56 38V10'/><path class='light' d='M31 67q21 8 38 0l8 15H23Z'/><path class='line' d='M34 76h11m10-27h7'/>`,
      star_crate: `<path d='m17 34 33-16 33 16v47L50 95 17 81Z'/><path class='light' d='m17 34 33 14 33-14M50 48v47'/><path class='dark' d='m50 52 4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1Z'/>`
    };
    const key = Object.prototype.hasOwnProperty.call(shapes, iconKey) ? iconKey : "star_crate";
    const fill = key.startsWith("energy") ? p.glass : p.gold;
    return `<svg class='reward-art' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg' aria-hidden='true' focusable='false' style='--reward:${fill}'>
    <ellipse cx='50' cy='94' rx='32' ry='4' fill='#252047' opacity='.2'/>
    <g fill='var(--reward)' stroke='#554061' stroke-width='3' stroke-linejoin='round' stroke-linecap='round'>${shapes[key]}</g>
    <link rel="stylesheet" href="./src/styles-3.css">
  </svg>`;
  }
  var machineSerial = 0;
  function machineArt(theme, phase) {
    const p = palette(theme);
    const id = `gacha-machine-${++machineSerial}`;
    const moving = /^(rolling|spinning|drawing|dispensing|dispense)$/i.test(String(phase ?? ""));
    const capsules = [
      [101, 227, "GREEN", -22],
      [144, 234, "BLUE", 19],
      [189, 225, "PURPLE", -16],
      [237, 232, "RED", 22],
      [272, 213, "GOLD", -13],
      [81, 197, "GOLD", 12],
      [123, 194, "RED", -21],
      [169, 191, "GREEN", 14],
      [215, 192, "BLUE", -17],
      [257, 176, "PURPLE", 22],
      [105, 161, "BLUE", -9],
      [151, 158, "GOLD", 17],
      [198, 157, "RED", -20],
      [238, 145, "GREEN", 11]
    ].map(([x, y, q2, turn], i) => `<g class='gm-capsule gm-capsule-${i % 3}' transform='translate(${x} ${y}) rotate(${turn})'>
    <circle r='20' fill='${p.quality[q2]}' stroke='#49355d' stroke-width='3'/>
    <path d='M-19 2Q0 10 19 2V8Q0 27-19 8Z' fill='${p.surface}' opacity='.91'/>
    <path d='M-14-7Q-9-16 1-16' fill='none' stroke='#fff' stroke-width='4' stroke-linecap='round' opacity='.78'/>
    <circle r='3' cy='3' fill='${p.gold}'/>
  </g>`).join("");
    return `<svg class='machine-art${moving ? " machine-art--active" : ""}' viewBox='0 0 360 480' xmlns='http://www.w3.org/2000/svg' aria-hidden='true' focusable='false' style='--gm-body:${p.machine};--gm-glass:${p.glass};--gm-gold:${p.gold};--gm-cream:${p.surface};--gm-night:${p.background}'>
    <defs>
      <linearGradient id='${id}-glass' x1='0' x2='1' y1='0' y2='1'><stop stop-color='#e4ffff' stop-opacity='.63'/><stop offset='.35' stop-color='${p.glass}' stop-opacity='.15'/><stop offset='1' stop-color='#2b678d' stop-opacity='.38'/></linearGradient>
      <linearGradient id='${id}-body' x1='0' x2='1'><stop stop-color='#943c61'/><stop offset='.22' stop-color='${p.machine}'/><stop offset='.75' stop-color='${p.machine}'/><stop offset='1' stop-color='#842e50'/></linearGradient>
    </defs>
    <ellipse cx='180' cy='464' rx='150' ry='13' fill='#0b0e33' opacity='.48'/>
    <path d='M36 267 47 440Q49 457 68 457H292q19 0 21-17l11-173Z' fill='#60335e' stroke='${p.gold}' stroke-width='5'/>
    <path d='M43 273h274l-12 167q-1 10-14 10H69q-13 0-14-10Z' fill='url(#${id}-body)' stroke='#63324d' stroke-width='5'/>
    <path d='M57 269Q48 40 180 27q132 13 123 242Z' fill='#295d79' stroke='${p.gold}' stroke-width='8'/>
    <path d='M69 269Q61 55 180 41q119 14 111 228Z' fill='#183d63'/>
    <g class='gm-capsules'>${capsules}</g>
    <path d='M69 269Q61 55 180 41q119 14 111 228Z' fill='url(#${id}-glass)' stroke='#d2f7f1' stroke-width='3'/>
    <path d='M89 155Q103 66 171 55' fill='none' stroke='#fff' stroke-width='12' stroke-linecap='round' opacity='.34'/>
    <path d='M260 77q25 32 28 69' fill='none' stroke='#fff' stroke-width='5' stroke-linecap='round' opacity='.25'/>
    <path d='M61 263h238l13 22H48Z' fill='${p.gold}' stroke='#714365' stroke-width='5'/>
    <path d='M67 287h226l-10 14H77Z' fill='${p.surface}' opacity='.55'/>
    <circle cx='69' cy='312' r='5' fill='${p.gold}' stroke='#7a3d53' stroke-width='2'/>
    <circle cx='291' cy='312' r='5' fill='${p.gold}' stroke='#7a3d53' stroke-width='2'/>
    <g class='gm-wheel'>
      <circle cx='113' cy='361' r='40' fill='#65385d' stroke='${p.gold}' stroke-width='6'/>
      <circle cx='113' cy='361' r='29' fill='${p.gold}' stroke='#fff2bc' stroke-width='3'/>
      <path d='M113 335v52m-26-26h52' stroke='#825467' stroke-width='9' stroke-linecap='round'/>
      <circle cx='113' cy='361' r='10' fill='${p.surface}' stroke='#825467' stroke-width='3'/>
    </g>
    <path d='M200 333q0-12 13-12h64q13 0 13 12v64q0 13-13 13h-64q-13 0-13-13Z' fill='#6b3958' stroke='${p.gold}' stroke-width='5'/>
    <path d='M209 344h72v38q-36 16-72 0Z' fill='#292643' stroke='#e9aa75' stroke-width='3'/>
    <path d='M216 400h58' stroke='#ffe8b2' stroke-width='5' stroke-linecap='round'/>
    <g class='gm-dispensed' opacity='0'><circle cx='245' cy='369' r='18' fill='${p.quality.GOLD}' stroke='#49355d' stroke-width='3'/><path d='M227 370q18 9 36 0v7q-18 18-36 0Z' fill='${p.surface}'/><path d='M234 359q5-8 13-8' fill='none' stroke='#fff' stroke-width='3' stroke-linecap='round'/></g>
    <path d='M67 440h226' stroke='#ffe7aa' stroke-width='5' stroke-linecap='round' opacity='.7'/>
    <link rel="stylesheet" href="./src/styles-4.css">
  </svg>`;
  }

  // project:src/views.js
  var esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  var rows2 = (config, key, table2) => config?.[key] || config?.tables?.[table2] || [];
  var copy = (config, id, fallback = "") => config?.copyById?.[id] ?? fallback;
  var has2 = (value, id) => value instanceof Set ? value.has(id) : Array.isArray(value) ? value.includes(id) : Boolean(value?.[id]);
  var num = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  var sorted = (items, field = "sortOrder") => [...items].sort((a, b) => num(a[field]) - num(b[field]));
  var attr = (value) => esc(value);
  var button = (action, label, extra = "", classes = "", disabled = false) => `<button type="button" class="${classes}" data-action="${attr(action)}" ${extra} ${disabled ? "disabled" : ""}>${label}</button>`;
  var qualityName = { GREEN: "绿色", BLUE: "蓝色", PURPLE: "紫色", RED: "红色", GOLD: "金色" };
  function themeVars(root, theme) {
    if (!theme) return;
    const vars = {
      "--night": theme.background,
      "--background": theme.background,
      "--machine": theme.machine,
      "--glass": theme.glass,
      "--gold": theme.gold,
      "--surface": theme.surface,
      "--font-stack": theme.fontStack,
      "--title-size": `${theme.titlePx}px`,
      "--body-size": `${theme.bodyPx}px`,
      "--radius": `${theme.radiusPx}px`,
      "--outline": `${theme.outlinePx}px`,
      "--shadow": theme.shadow,
      "--motion-ms": `${theme.motionMs}ms`,
      "--min-touch": `${theme.minTouchPx}px`,
      "--coral": theme.machine,
      "--aqua": theme.glass,
      "--brass": theme.gold,
      "--cream": theme.surface,
      "--font": theme.fontStack,
      "--panel-radius": `${theme.radiusPx}px`,
      "--stroke": `${theme.outlinePx}px`,
      "--panel-shadow": theme.shadow,
      "--motion-duration": `${theme.motionMs}ms`
    };
    for (const [key, value] of Object.entries(vars)) if (value != null) root.style.setProperty(key, value);
    for (const [key, value] of Object.entries(theme.qualityColors || {})) {
      root.style.setProperty(`--quality-${key.toLowerCase()}`, value);
    }
    (theme.spacing || []).forEach((value, index) => root.style.setProperty(`--space-${index + 1}`, `${value}px`));
  }
  function clock2(state, config) {
    const source = state?.simulatedServer || state?.serverClock || state?.clock || {};
    const trusted = state?.timeTrusted ?? source.timeTrusted ?? source.trusted ?? config?.activity?.timeTrusted;
    const value = source.now ?? source.nowAt ?? source.serverNow ?? source.time ?? state?.serverTime;
    const now = typeof value === "number" ? value : Date.parse(value);
    const end = Date.parse(config?.activity?.endAt);
    if (trusted !== true || !Number.isFinite(now) || !Number.isFinite(end)) return { trusted: false, expired: false, label: "时间待确认" };
    const remaining = Math.max(0, end - now);
    if (!remaining) return { trusted: true, expired: true, label: "正式截止" };
    const days = Math.floor(remaining / 864e5);
    const hours = Math.floor(remaining % 864e5 / 36e5);
    const minutes = Math.floor(remaining % 36e5 / 6e4);
    return { trusted: true, expired: false, label: days ? `剩余 ${days}天 ${hours}小时` : `剩余 ${hours}小时 ${minutes}分` };
  }
  function session(state) {
    const value = state?.activitySession ?? state?.sessionActive;
    return value === true || value?.active === true || value?.status === "ACTIVE" || value == null && !["entry", "cover", "ending", "makeup"].includes(state?.screen);
  }
  function unavailable2(state, config) {
    if (state?.readOnly || state?.persistenceStatus === "READ_ONLY" || state?.saveStatus === "READ_ONLY" || state?.saveError) {
      return copy(config, "SAVE_ERROR", "活动存档暂不可用，操作已暂停。");
    }
    if (!clock2(state, config).trusted) return copy(config, "TIME_UNKNOWN", "服务器时间尚未确认，活动暂为只读。");
    return state?.unavailableReason || state?.entryReason || state?.eligibilityReason || "";
  }
  function rewardLine(id, config) {
    const reward2 = rows2(config, "rewards", "RewardCatalog").find((row) => row.rewardId === id);
    if (!reward2) return `<span>${esc(id)}</span>`;
    return `<span class="reward-inline">${rewardArt(reward2.iconKey, config.theme)}<span>${esc(reward2.name)} ×${esc(reward2.quantity)}<small>${reward2.delivery === "MOCK_PENDING" ? "模拟待领奖" : "模拟到账"}</small></span></span>`;
  }
  function rewardList(ids, config) {
    return (ids || []).map((id) => rewardLine(id, config)).join("") || "<span>暂无奖励</span>";
  }
  function collectionCount(state, config) {
    return rows2(config, "toys", "GachaToy").filter((toy) => has2(state?.ownedToyIds, toy.toyId)).length;
  }
  function totalToys(config) {
    return rows2(config, "toys", "GachaToy").length;
  }
  function pointNodes(config) {
    return sorted(rows2(config, "nodes", "ProgressNodes").filter((n) => n.nodeType === "POINT"), "target");
  }
  function tier(state, config) {
    const tiers = sorted(rows2(config, "drawTiers", "DrawTiers"));
    return tiers.find((t) => t.tierId === (state?.selectedTierId ?? state?.tierId ?? state?.selectedTier)) || tiers[0];
  }
  function qualityColorAttr(id) {
    return `data-quality="${attr(id)}"`;
  }
  function frame(content, screen, config) {
    return `<div class="activity-frame" data-screen="${attr(screen)}" aria-label="${esc(copy(config, "TITLE", "扭蛋机活动"))}">${content}</div>`;
  }
  function debugLauncher() {
    return button("debug-open", "调试 / 外部供给", "", "debug-launcher");
  }
  function entry(state, config) {
    const status = clock2(state, config);
    const ended = state?.settlement?.status === "FINALIZED";
    const settling = state?.settlement?.status === "PENDING_MAKEUP";
    const started = status.trusted && Date.parse(state?.serverTime) >= Date.parse(config.activity.startAt);
    const reason = !status.trusted ? copy(config, "TIME_UNKNOWN") : !started ? "活动尚未开始" : state?.level < config.activity.minLevel ? `需要达到${config.activity.minLevel}级` : state?.completedWave < config.activity.requiredWave ? `需要完成第${config.activity.requiredWave}波订单` : state?.qualified === false ? "活动资格不满足" : state?.mutualExclusionClear === false ? "存在互斥活动" : state?.resourcesReady === false ? "活动资源尚未就绪" : state?.switchState === "HARD_OFF" ? "活动已硬关闭" : state?.switchState === "SOFT_OFF" && !state?.initialized ? "软关后不再开启本期活动" : status.expired ? "活动已正式截止" : "";
    const show = !state?.readOnly && !ended && !settling && !reason;
    const endAt = Date.parse(config.activity.endAt);
    const now = Date.parse(state?.serverTime);
    const summaryAvailable = ended && status.trusted && Number.isFinite(now) && now >= endAt && now < endAt + config.activity.settlementDays * 864e5 && Boolean(state?.settlement?.summary);
    const single = sorted(rows2(config, "drawTiers", "DrawTiers")).find((t) => t.reads === 1);
    const attempts = single?.ticketCost ? Math.floor(num(state?.tickets) / single.ticketCost) : 0;
    const pending = rows2(config, "nodes", "ProgressNodes").filter((n) => n.nodeType === "QUALITY" && getNodeStatus(state, config, n.nodeId)?.claimable).length;
    const badge = attempts || pending;
    return frame(`<div class="entry-scene"><div class="entry-sky" aria-hidden="true"></div>
    <div class="entry-heading"><small>独立限时活动</small><h1>${esc(copy(config, "TITLE", "七天扭蛋奇遇"))}</h1><p>${esc(clock2(state, config).label)}</p></div>
    <div class="entry-machine" aria-hidden="true">${machineArt(config.theme, "idle")}</div>
    ${show ? button("entry-open", `<span>进入扭蛋机</span>${badge ? `<b class="entry-badge">${esc(badge)}</b>` : ""}`, "", "entry-button") : `<div class="entry-unavailable">${esc(ended ? "本期活动已结束" : settling ? "正在进行结束结算" : unavailable2(state, config) || reason || "活动暂不可进入")}</div>`}
    ${state?.readOnly && state?.initialized && !state?.settlement ? button("readonly-open", "查看已保存活动 · 只读", "", "secondary-button ending-summary-entry") : ""}
    ${summaryAvailable ? button("ending-summary-open", "查看本期结束结果", "", "secondary-button ending-summary-entry") : ""}
    <p class="entry-caption">${esc(state?.level < config.activity.minLevel ? `需要达到${config.activity.minLevel}级` : state?.completedWave < config.activity.requiredWave ? `需要完成第${config.activity.requiredWave}波订单` : state?.qualified === false ? "活动资格不满足" : state?.mutualExclusionClear === false ? "存在互斥活动" : state?.resourcesReady === false ? "活动资源尚未就绪" : state?.switchState === "SOFT_OFF" && !state?.initialized ? "软关后不再开启本期活动" : "主线供券在调试入口以事件模拟。")}</p></div>${debugLauncher()}`, "entry", config);
  }
  function hud(state, config) {
    return `<header class="machine-hud">
    ${button("machine-close", '<span aria-hidden="true">‹</span><span class="sr-only">离开活动</span>', 'aria-label="离开活动"', "hud-back")}
    <div class="hud-title"><strong>${esc(copy(config, "TITLE", "七天扭蛋奇遇"))}</strong><small>${esc(clock2(state, config).label)}</small></div>
    <div class="ticket-pill" aria-label="扭蛋券余额">${rewardArt("star_crate", config.theme)}<span>扭蛋券 <b>${esc(num(state?.tickets))}</b></span></div>
    ${button("debug-open", "调试", 'aria-label="调试 / 外部供给"', "debug-launcher")}</header>`;
  }
  function progressRail(state, config) {
    const nodes = pointNodes(config);
    const last = nodes.at(-1)?.target || 1;
    const points = num(state?.totalPoints);
    return `<section class="progress-panel" aria-label="累计积分阶段奖励"><div class="progress-heading"><span>累计积分 <b>${esc(points)}</b></span><span class="available-points">可用积分 <b>${esc(num(state?.availablePoints))}</b></span></div>
    <div class="progress-rail">
    <div class="progress-fill" aria-hidden="true" style="width:${Math.min(84, Math.max(0, points / last * 84))}%"></div>${nodes.map((node2) => {
      const status = getNodeStatus(state, config, node2.nodeId);
      return button(
        "node-preview",
        `<span class="medal">${rewardArt(rows2(config, "rewards", "RewardCatalog").find((r) => r.rewardId === node2.rewardIds?.[0])?.iconKey, config.theme)}</span><small>${esc(node2.target)}</small><span class="sr-only">${esc(node2.label)}，${status?.claimed ? "已领取" : status?.reached ? "已达成" : "未达成"}</span>`,
        `data-node-id="${attr(node2.nodeId)}" aria-label="${attr(node2.label)}；${status?.claimed ? "已领取" : "查看奖励"}"`,
        `progress-node ${status?.claimed ? "is-claimed" : status?.reached ? "is-reached" : ""}`
      );
    }).join("")}</div></section>`;
  }
  function machine(state, config) {
    const chosen = tier(state, config);
    const busy = state?.processing === true || state?.busy === true || ["DRAWING", "EXCHANGING"].includes(state?.phase);
    const blocked = Boolean(state?.readOnly || state?.persistenceStatus === "READ_ONLY" || state?.saveError || !clock2(state, config).trusted || !session(state));
    const pending = rows2(config, "nodes", "ProgressNodes").some((n) => n.nodeType === "QUALITY" && getNodeStatus(state, config, n.nodeId)?.claimable);
    const unlocked = collectionCount(state, config) >= (rows2(config, "nodes", "ProgressNodes").find((n) => n.nodeType === "COMPLETE")?.target ?? Infinity);
    return frame(`${hud(state, config)}${progressRail(state, config)}
    <main class="machine-main"><div class="machine-side left-side">${button("info-open", "INFO", "", "side-control")}${button("rules-open", "规则", "", "side-control")}</div>
    <div class="machine-illustration" data-phase="${attr(state?.phase || "idle")}">${machineArt(config.theme, state?.phase || "idle")}</div>
    <div class="machine-side right-side">${button("collection-open", `收藏${pending ? '<i class="red-dot" aria-label="有可领取奖励"></i>' : ""}`, "", "side-control")}
    ${button("shop-open", `兑换${unlocked && !state?.shopUnlockSeen ? '<i class="red-dot" aria-label="新功能"></i>' : ""}`, "", "side-control")}</div></main>
    <footer class="draw-controls"><div class="tier-picker" role="group" aria-label="抽取倍率">${sorted(rows2(config, "drawTiers", "DrawTiers")).map((item) => button("tier-select", `×${esc(item.reads)}`, `data-tier-id="${attr(item.tierId)}" aria-pressed="${item.tierId === chosen?.tierId}"`, `tier-chip ${item.tierId === chosen?.tierId ? "is-selected" : ""}`, busy)).join("")}</div>
    ${button("draw", `<span>扭动旋钮 · 抽取 ${chosen ? `×${esc(chosen.reads)}` : ""}</span><small>消耗 ${esc(chosen?.ticketCost ?? "—")} 张扭蛋券</small>`, `data-tier-id="${attr(chosen?.tierId ?? "")}"`, "draw-button", busy || blocked)}
    ${blocked ? `<p class="inline-warning">${esc(unavailable2(state, config) || "当前会话不可操作")}</p>` : ""}</footer>`, "machine", config);
  }
  function modal(id, title, body, actions = "", options = {}) {
    const close = options.close !== false;
    return `<div class="overlay" data-screen="${attr(id)}" data-popup-id="${attr(options.popupId ?? id)}" role="presentation">
    <section class="activity-modal ${options.className || ""}" role="dialog" aria-modal="true" aria-label="${attr(title)}">
      <header class="modal-header"><span class="modal-ornament" aria-hidden="true">✦</span><h2>${esc(title)}</h2>${close ? button(options.closeAction || "popup-close", "×", `aria-label="关闭${attr(title)}"`, "modal-close") : ""}</header>
      <div class="modal-content" data-scroll-region="${attr(id)}">${body}</div>
      ${actions ? `<footer class="modal-actions">${actions}</footer>` : ""}</section></div>`;
  }
  function cover(state, config) {
    return modal(
      "cover",
      copy(config, "TITLE", "七天扭蛋奇遇"),
      `<div class="cover-illustration">${machineArt(config.theme, "idle")}</div><p>${esc(copy(config, "COVER"))}</p><p class="time-label">${esc(clock2(state, config).label)}</p>`,
      button("cover-start", "开启扭蛋奇遇", "", "primary-button"),
      { closeAction: "cover-close" }
    );
  }
  function toyTile(toy, state, config) {
    const owned2 = has2(state?.ownedToyIds, toy.toyId);
    const isNew = owned2 && has2(state?.newToyIds, toy.toyId);
    return `<div class="toy-tile ${owned2 ? "is-owned" : "is-locked"}" ${qualityColorAttr(toy.qualityId)} data-toy-id="${attr(toy.toyId)}">
    <div class="toy-figure">${toyArt(toy.shapeKey, toy.qualityId, owned2 ? "owned" : "locked", config.theme)}</div>
    ${isNew ? '<span class="new-mark">NEW</span>' : ""}<span class="toy-name">${owned2 ? esc(toy.name) : "未获得"}</span></div>`;
  }
  function collection(state, config) {
    const toys2 = rows2(config, "toys", "GachaToy");
    const groups = sorted(rows2(config, "nodes", "ProgressNodes").filter((n) => n.nodeType === "QUALITY"));
    const complete = rows2(config, "nodes", "ProgressNodes").find((n) => n.nodeType === "COMPLETE");
    const body = `<div class="collection-total">玩具图鉴 <strong>${collectionCount(state, config)}/${totalToys(config)}</strong></div>
    ${groups.map((group) => {
      const status = getNodeStatus(state, config, group.nodeId);
      const members = sorted(toys2.filter((toy) => toy.collectionId === group.collectionId));
      return `<section class="collection-group" ${qualityColorAttr(members[0]?.qualityId)}><div class="group-header"><h3>${esc(qualityName[members[0]?.qualityId] || group.label)}</h3><span>${esc(status?.current ?? 0)}/${esc(group.target)}</span></div>
        <div class="toy-grid">${members.map((toy) => toyTile(toy, state, config)).join("")}</div>
        <div class="group-reward"><div class="reward-preview">${rewardList(group.rewardIds, config)}</div>
          ${button("claim-node", status?.claimed ? "已领取 ✓" : status?.claimable ? "领取品质奖励" : "尚未集齐", `data-node-id="${attr(group.nodeId)}"`, `claim-button ${status?.claimable ? "can-claim" : ""}`, !status?.claimable)}</div></section>`;
    }).join("")}
    ${complete ? `<section class="complete-reward"><h3>全收藏大奖 · ${esc(collectionCount(state, config))}/${esc(complete.target)}</h3><div>${rewardList(complete.rewardIds, config)}</div><p>${getNodeStatus(state, config, complete.nodeId)?.claimed ? "已自动发放 · 兑换商店已开放" : "集齐后自动发放，无需先领取品质奖励"}</p></section>` : ""}`;
    return modal("collection", "玩具收藏", body, button("panel-back", "返回扭蛋机", "", "secondary-button"), { closeAction: "panel-back" });
  }
  function shop(state, config) {
    const body = `<div class="shop-balance">可用积分 <b>${esc(num(state?.availablePoints))}</b></div>
    <p class="shop-note">${esc(collectionCount(state, config) >= totalToys(config) ? copy(config, "SHOP_UNLOCK") : copy(config, "SHOP_LOCK"))}</p>
    <div class="shop-items">${sorted(rows2(config, "shop", "GachaShop")).map((item) => {
      const status = getShopItemStatus(state, item.id, config);
      const reward2 = rows2(config, "rewards", "RewardCatalog").find((row) => row.rewardId === item.rewardId);
      const label = status.status === "SOLD_OUT" ? "已售罄" : status.status === "LOCKED" ? "尚未解锁" : status.status === "INSUFFICIENT_POINTS" ? "积分不足" : status.status === "AVAILABLE" ? "兑换" : "暂不可兑";
      return `<article class="shop-item" data-item-id="${attr(item.id)}"><div class="shop-item-art">${rewardArt(reward2?.iconKey, config.theme)}</div><div class="shop-item-detail"><h3>${esc(reward2?.name || item.rewardId)} ×${esc(reward2?.quantity ?? "—")}</h3><p>单次 ${esc(item.pointPrice)} 积分 · ${item.exchangeLimit === -1 ? "不限次数" : `剩余 ${esc(status.remaining ?? 0)} 次`}</p></div>
        ${button("exchange-open", label, `data-item-id="${attr(item.id)}"`, `shop-exchange ${status.canExchange ? "is-ready" : ""}`)}
        ${!status.canExchange && status.message ? `<small class="shop-reason">${esc(status.message)}</small>` : ""}</article>`;
    }).join("")}</div>`;
    return modal("shop", "积分兑换商店", body, button("panel-back", "返回扭蛋机", "", "secondary-button"), { closeAction: "panel-back" });
  }
  function info(state, config) {
    const layerId = state?.layerId || state?.selectedLayerId || config?.playerLayers?.[0]?.layerId;
    const layer = rows2(config, "playerLayers", "PlayerLayers").find((row) => row.layerId === layerId);
    const full = getSequenceShares(config, layerId, "FULL");
    const loop = getSequenceShares(config, layerId, "LOOP");
    const activeScope = state?.infoScope === "LOOP" ? "LOOP" : "FULL";
    const shares = activeScope === "LOOP" ? loop : full;
    const count = shares[0]?.total ?? 0;
    const body = `<div class="info-intro"><p>${esc(copy(config, "INFO_SCOPE"))}</p>
    <p>适用分层：${esc(layerId || "—")} · 序列组：${esc(layer?.sequenceGroup || "—")} · ${activeScope === "LOOP" ? "末房间循环范围" : "完整固定序列"}：${esc(count)} 项</p>
    <p>统计房间：${esc(shares[0]?.roomIds?.join("、") || "—")}。占比是固定序列投放频次，不预测下一抽；未投放项明确显示 0%。</p></div>
    <div class="info-scopes" role="group" aria-label="投放统计范围">${button("info-scope", "完整序列", 'data-scope="FULL"', activeScope === "FULL" ? "is-selected" : "")}${button("info-scope", "末房间循环", 'data-scope="LOOP"', activeScope === "LOOP" ? "is-selected" : "")}</div>
    <div class="shares-heading"><span>单项奖励 / 数量</span><span>次数 · 投放占比</span></div>
    <div class="share-list">${shares.map((item) => `<div class="share-row" ${item.qualityId ? qualityColorAttr(item.qualityId) : ""}>
      <div class="share-icon">${item.toyId ? toyArt(item.shapeKey, item.qualityId, "owned", config.theme) : rewardArt(item.iconKey, config.theme)}</div>
      <div class="share-name"><strong>${esc(item.name)} ×${esc(item.quantity)}</strong><small>${item.toyId ? `${esc(qualityName[item.qualityId])} · 首次点亮 / 重复 +${esc(item.duplicatePoints)} 分` : "主游戏奖励 · 模拟承接"}</small></div>
      <div class="share-percent"><strong>${esc(item.displayValue)}</strong><small>${esc(item.count)}/${esc(item.total)}</small></div></div>`).join("")}
      ${!shares.length ? "<p>当前范围没有可统计的序列配置。</p>" : ""}</div>
    <p class="info-footnote">仅实际投放项的显示百分比合计 100%；极小的非零占比统一提高显示精度，尾项吸收展示尾差。条件达成奖励不计入投放占比。</p>`;
    return modal("info", "奖励投放占比 INFO", body, button("panel-back", "返回扭蛋机", "", "secondary-button"), { closeAction: "panel-back" });
  }
  function rulesGuide(state, config, guide = false) {
    const lines = sorted(rows2(config, "copy", "UiCopy").filter((row) => row.screen === "rulesGuide" && row.copyId.startsWith(guide ? "GUIDE_" : "RULE_")));
    const index = Math.max(0, Math.min(lines.length - 1, num(state?.guideIndex)));
    return modal(
      guide ? "guide" : "rulesGuide",
      guide ? "新手引导" : "活动说明",
      guide ? `<div class="guide-progress">${esc(index + 1)} / ${esc(lines.length)}</div><div class="guide-art">${machineArt(config.theme, "idle")}</div><p>${esc(lines[index]?.text || "")}</p>` : `<ol class="rules-list">${lines.map((row) => `<li>${esc(row.text)}</li>`).join("")}<li>${esc(copy(config, "COVER"))}</li></ol>`,
      guide ? `${button("guide-skip", "跳过引导", "", "secondary-button")}${button("guide-next", index + 1 >= lines.length ? "完成引导" : "下一步", "", "primary-button")}` : button("panel-back", "明白了", "", "primary-button"),
      { closeAction: guide ? "guide-skip" : "panel-back" }
    );
  }
  function resultsFrom(state, data) {
    if (Array.isArray(data?.results)) return data.results;
    if (Array.isArray(data?.items)) return data.items;
    const transaction = data?.transaction || state?.lastDraw || state?.lastDrawResult;
    return transaction?.results || transaction?.items || [];
  }
  function drawResult(state, config, data = {}) {
    const results = resultsFrom(state, data);
    const points = data?.pointsDelta ?? data?.pointDelta ?? data?.transaction?.pointsDelta ?? results.reduce((sum, r) => sum + num(r.pointsDelta ?? r.points), 0);
    const body = `<p class="result-summary">按序揭晓 ${esc(results.length)} 项结果${points ? ` · 重复玩具合计 +${esc(points)} 积分` : ""}</p>
    <div class="result-grid">${results.map((result, index) => {
      const toy = rows2(config, "toys", "GachaToy").find((row) => row.toyId === (result.toyId || result.rewardId));
      const reward2 = rows2(config, "rewards", "RewardCatalog").find((row) => row.rewardId === result.rewardId);
      const duplicate = result.isDuplicate === true || result.duplicate === true;
      return `<div class="result-item ${duplicate ? "is-duplicate" : ""}" ${toy ? qualityColorAttr(toy.qualityId) : ""}><span class="result-index">${esc(index + 1)}</span>
        <div class="result-art">${toy ? toyArt(toy.shapeKey, toy.qualityId, "owned", config.theme) : rewardArt(reward2?.iconKey || result.iconKey, config.theme)}${duplicate && toy ? `<b class="duplicate-points" data-duplicate-points="${esc(result.pointsDelta ?? result.points ?? 0)}">重复 +${esc(result.pointsDelta ?? result.points ?? 0)} 积分</b>` : ""}</div>
        <strong>${esc(toy?.name || reward2?.name || result.name || result.rewardId)}</strong><small>${toy ? esc(qualityName[toy.qualityId]) : `×${esc(result.quantity ?? reward2?.quantity ?? "—")}`}</small>
        ${duplicate ? '<small class="duplicate-label">重复藏品 · 点击收下后积分飞入进度条</small>' : toy ? '<b class="new-mark">NEW · 首次收藏</b>' : `<small>${reward2?.delivery === "MOCK_PENDING" ? "模拟待领奖" : "模拟到账"}</small>`}</div>`;
    }).join("")}</div>`;
    return modal("drawResult", "扭蛋揭晓", body, button("result-close", "收下结果", "", "primary-button"));
  }
  function claim(state, config, data = {}) {
    const id = data.nodeId || state?.selectedNodeId || state?.claimNodeId;
    const node2 = rows2(config, "nodes", "ProgressNodes").find((row) => row.nodeId === id);
    const status = id ? getNodeStatus(state, config, id) : null;
    const exchangeRewards = !node2 && Array.isArray(data.ledgerEntries) ? data.ledgerEntries.map((entry2) => rewardLine(entry2.rewardId, config)).join("") : "";
    return modal(
      "claim",
      node2?.label || (data.source === "EXCHANGE" ? "兑换奖励" : "奖励展示"),
      `<div class="claim-art">${node2 ? rewardList(node2.rewardIds, config) : exchangeRewards}</div><p>${data.source === "EXCHANGE" ? "兑换已确认，奖励已记录为模拟到账或模拟待领奖。" : status?.claimed ? "奖励已记录到账，不会重复发放。" : status?.claimable ? "已集齐本组玩具，请确认领取品质奖励。" : status?.reached ? "已达成，奖励自动结算。" : "尚未达到领取条件。"}</p>`,
      status?.claimable ? button("claim-confirm", "确认领取", `data-node-id="${attr(id)}"`, "primary-button") : button("popup-close", "知道了", "", "primary-button")
    );
  }
  function exchangeConfirm(state, config, data = {}) {
    const id = data.itemId || state?.selectedItemId || state?.exchangeItemId;
    const item = rows2(config, "shop", "GachaShop").find((row) => row.id === id);
    const reward2 = rows2(config, "rewards", "RewardCatalog").find((row) => row.rewardId === item?.rewardId);
    const status = id ? getShopItemStatus(state, id, config) : null;
    return modal(
      "exchangeConfirm",
      "确认兑换",
      `<div class="exchange-preview">${reward2 ? rewardArt(reward2.iconKey, config.theme) : ""}<strong>${esc(reward2?.name || "未知商品")} ×${esc(reward2?.quantity ?? "—")}</strong></div>
    <p>消耗可用积分 ${esc(item?.pointPrice ?? "—")} · ${item?.exchangeLimit === -1 ? "不限次" : `本期剩余 ${esc(status?.remaining ?? 0)} 次`}</p><p>累计积分进度不会回退。${!status?.canExchange ? esc(status?.message || "") : ""}</p>`,
      `${button("exchange-cancel", "取消", "", "secondary-button")}${button("exchange-confirm", "确认兑换", `data-item-id="${attr(id || "")}"`, "primary-button", !status?.canExchange)}`,
      { closeAction: "exchange-cancel" }
    );
  }
  function ending(state, config) {
    const summary = state?.settlement?.summary || state?.settlement || {};
    const collected = summary.collectedCount ?? summary.ownedCount ?? collectionCount(state, config);
    return modal(
      "ending",
      "本期活动结束",
      `<div class="ending-emblem">${rewardArt("star_crate", config.theme)}</div><p>收藏完成 <strong>${esc(collected)}/${esc(totalToys(config))}</strong></p><p>${esc(copy(config, "END"))}</p>`,
      button("ending-confirm", "好的", "", "primary-button"),
      { closeAction: "ending-close" }
    );
  }
  function endingSummary(state, config) {
    const summary = state?.settlement?.summary;
    return modal("endingSummary", "本期结束结果", `<div class="ending-emblem">${rewardArt("star_crate", config.theme)}</div><p>收藏完成 <strong>${esc(summary?.collectedCount ?? 0)}/${esc(summary?.totalToyCount ?? totalToys(config))}</strong></p><p>结束时剩余扭蛋券 ${esc(summary?.closingTickets ?? 0)} 张 · 累计积分 ${esc(summary?.closingTotalPoints ?? 0)} · 可用积分 ${esc(summary?.closingAvailablePoints ?? 0)}</p><p>已补发节点：${esc(summary?.makeupNodeIds?.join("、") || "无")}。本期活动资产已结算；主游戏模拟奖励账本保留。</p>`, button("ending-summary-close", "返回", "", "primary-button"), { closeAction: "ending-summary-close" });
  }
  function makeup(state, config) {
    const list = state?.settlement?.makeup || state?.settlement?.pendingRewards || state?.settlement?.makeupItems || [];
    const items = (Array.isArray(list) ? list : Object.values(list)).filter((entry2) => !entry2.status || entry2.status === "PENDING");
    return modal("makeup", "活动奖励补发", `<p>仅展示已达成且尚未到账的奖励；已经到账的奖励不会重复发放。</p><div class="makeup-list">${items.map((entry2) => {
      const node2 = rows2(config, "nodes", "ProgressNodes").find((row) => row.nodeId === (entry2.nodeId || entry2));
      return `<div class="makeup-item"><strong>${esc(node2?.label || entry2.label || entry2.sourceId || "待补发奖励")}</strong><div>${rewardList(entry2.rewardIds || node2?.rewardIds || [], config)}</div></div>`;
    }).join("") || "<p>没有待补发奖励。</p>"}</div>`, button("makeup-claim", items.length ? "领取补发奖励" : "完成结算", "", "primary-button"), { close: false });
  }
  function unavailableModal(state, config) {
    return modal("unavailable", "活动暂不可用", `<p>${esc(unavailable2(state, config) || "当前操作暂不可进行，请稍后再试。")}</p>`, button("popup-close", "知道了", "", "primary-button"));
  }
  function debug(state, config) {
    const rules = rows2(config, "supplyRules", "SupplyRules");
    const order = rules.find((rule) => rule.source === "ORDER_SETTLED");
    const generator = rules.find((rule) => rule.source === "GENERATOR_OUTPUT");
    const activity = config.activity || {};
    const sim = state?.simulatedServer || state?.serverClock || state?.clock || {};
    const current = sim.now ?? sim.nowAt ?? sim.serverNow ?? sim.time ?? state?.serverTime ?? "";
    const events = Array.isArray(state?.eventLog) ? state.eventLog : [];
    const ledger = Array.isArray(state?.rewardLedger) ? state.rewardLedger : [];
    const lines = ledger.map((row) => `<li><b>${esc(row.name || row.rewardId)} ×${esc(row.quantity)}</b><small>${esc(row.delivery === "MOCK_PENDING" ? "模拟待领奖" : "模拟到账")} · 来源 ${esc(row.sourceId || "")}</small></li>`).join("");
    const body = `<p class="debug-warning">仅模拟外部事件与服务器状态；订单、主棋盘和生成器不是本活动的可玩页面。</p>
    <section class="debug-section"><h3>订单结算 · ${esc(order?.scope || "")}</h3><p>成功发券 ${esc(order?.ticketsOnHit ?? "—")} 张 / 唯一事件</p>
      ${button("debug-order-success", "模拟结算成功", "", "debug-button")}${button("debug-order-fail", "模拟结算失败", "", "debug-button")}
    </section><section class="debug-section"><h3>生成器有效产出 · ${esc(generator?.scope || "")}</h3><p>配置命中率 ${esc(generator?.hitRate == null ? "—" : `${Math.round(generator.hitRate * 100)}%`)}；命中发券 ${esc(generator?.ticketsOnHit ?? "—")} 张</p>
      ${button("debug-generator-hit", "模拟有效产出 · 命中", "", "debug-button")}${button("debug-generator-miss", "模拟有效产出 · 未命中", "", "debug-button")}${button("debug-generator-fail", "模拟产出失败", "", "debug-button")}
    </section><section class="debug-section"><h3>事件去重</h3><label>模拟事件 ID <input data-debug-field="eventId" aria-label="模拟事件ID" value="${attr(state?.debugEventId || "")}" placeholder="留空由输入层生成" /></label>${button("debug-replay", "重放同一事件 ID", "", "debug-button")}<p>同一事件 ID 成功结算后再次发送，不得再次发券。</p></section>
    <section class="debug-section"><h3>模拟服务器与资格</h3><p>配置期次 ${esc(activity.periodId)} · 最低 ${esc(activity.minLevel)} 级 · 订单第 ${esc(activity.requiredWave)} 波</p>
      <label>等级 <input data-debug-field="level" type="number" inputmode="numeric" value="${attr(state?.level ?? state?.playerLevel ?? "")}" /></label>
      <label>订单波次 <input data-debug-field="wave" type="number" inputmode="numeric" value="${attr(state?.wave ?? state?.completedWave ?? "")}" /></label>
      <label>玩家分层 <select data-debug-field="layerId">${rows2(config, "playerLayers", "PlayerLayers").map((layer) => `<option value="${attr(layer.layerId)}" ${layer.layerId === (state?.layerId || state?.selectedLayerId) ? "selected" : ""}>${esc(layer.layerId)}</option>`).join("")}</select></label>
      <label>服务器时间 <input data-debug-field="serverTime" type="text" value="${attr(current)}" placeholder="ISO 时间" /></label>
      <label>活动资格 <select data-debug-field="qualified"><option value="true" ${state?.qualified !== false ? "selected" : ""}>符合</option><option value="false" ${state?.qualified === false ? "selected" : ""}>不符合</option></select></label>
      <label>互斥关系 <select data-debug-field="mutualExclusionClear"><option value="true" ${state?.mutualExclusionClear !== false ? "selected" : ""}>无冲突</option><option value="false" ${state?.mutualExclusionClear === false ? "selected" : ""}>存在冲突</option></select></label>
      <label>活动资源状态 <select data-debug-field="resourcesReady"><option value="true" ${state?.resourcesReady !== false ? "selected" : ""}>已就绪</option><option value="false" ${state?.resourcesReady === false ? "selected" : ""}>未就绪</option></select></label>
      <label>时间可信 <select data-debug-field="timeTrusted"><option value="true" ${clock2(state, config).trusted ? "selected" : ""}>已确认</option><option value="false" ${!clock2(state, config).trusted ? "selected" : ""}>待确认</option></select></label>
      <label>开关 <select data-debug-field="switchState">${["OPEN", "SOFT_OFF", "HARD_OFF"].map((value) => `<option value="${value}" ${value === (state?.switchState || activity.switchState) ? "selected" : ""}>${value}</option>`).join("")}</select></label>
      ${button("debug-apply", "应用模拟状态", "", "debug-button")}${button("debug-expire", "时间设为正式截止", "", "debug-button")}${button("debug-relogin", "模拟重登 / 离开到期会话", "", "debug-button")}
    </section><section class="debug-section"><h3>本地事件日志</h3><ol class="debug-log">${events.slice().reverse().map((event2) => `<li><b>${esc(event2.kind || event2.type || event2.eventName || event2.action || "事件")}</b><small>ID ${esc(event2.eventId || event2.id || "—")} · 期次 ${esc(event2.periodId || state?.periodId || activity.periodId)} · 节点 ${esc(event2.nodeId || "—")} · ${esc(event2.reason || event2.result || event2.message || (event2.ok === false ? "拒绝" : "已记录"))}</small></li>`).join("") || "<li>暂无事件</li>"}</ol></section>
    <section class="debug-section"><h3>奖励账本 · ${esc(ledger.length)} 条</h3><ol class="debug-log">${lines || "<li>暂无到账或待领奖记录</li>"}</ol></section>
    <section class="debug-section"><h3>测试实例与只读恢复</h3><p>重新试玩仅重置当前测试实例；不模拟领奖，不覆盖平台配置。存档故障演示只切换只读界面，不损坏本地存储。</p>${button("debug-reset", "重新试玩当前测试实例", "", "debug-button danger-button")}${button("debug-storage-fail", "模拟存档不可用 · 只读浏览", "", "debug-button")}</section>`;
    return modal("debug", "活动 Debug", body, button("debug-close", "返回活动", "", "secondary-button"), { closeAction: "debug-close", className: "debug-modal" });
  }
  function activePopup(state) {
    const queue = state?.popupQueue;
    const entry2 = Array.isArray(queue) ? queue[0] : null;
    return entry2 || state?.activePopup || state?.popup || null;
  }
  function popupKind(popup) {
    if (typeof popup === "string") return popup;
    return popup?.screen || popup?.type || popup?.kind || popup?.popupType || popup?.id || "";
  }
  function overlay(state, config) {
    const popup = activePopup(state);
    const kind = popupKind(popup);
    const data = typeof popup === "object" && popup ? popup : {};
    if (kind) {
      const normalized = String(kind).toLowerCase().replace(/[_\s-]/g, "");
      if (normalized.includes("cover")) return cover(state, config);
      if (normalized.includes("guide")) return rulesGuide(state, config, true);
      if (normalized.includes("draw") || normalized.includes("result")) return drawResult(state, config, data);
      if (normalized.includes("exchange") && normalized.includes("confirm")) return exchangeConfirm(state, config, data);
      if (normalized.includes("claim") || normalized.includes("stage") || normalized.includes("reward")) return claim(state, config, data);
      if (normalized.includes("ending") || normalized === "end") return ending(state, config);
      if (normalized.includes("makeup")) return makeup(state, config);
      if (normalized.includes("unlock")) return modal("shopUnlock", "兑换商店已开放", `<p>${esc(copy(config, "SHOP_UNLOCK"))}</p>`, button("popup-close", "去看看", "", "primary-button"));
      if (normalized.includes("unavailable") || normalized.includes("error")) return unavailableModal(state, config);
    }
    const screen = state?.screen;
    switch (screen) {
      case "cover":
        return cover(state, config);
      case "collection":
        return collection(state, config);
      case "shop":
        return shop(state, config);
      case "info":
        return info(state, config);
      case "rulesGuide":
      case "rules":
        return rulesGuide(state, config);
      case "guide":
        return rulesGuide(state, config, true);
      case "drawResult":
        return drawResult(state, config);
      case "claim":
        return claim(state, config);
      case "exchangeConfirm":
        return exchangeConfirm(state, config);
      case "ending":
        return ending(state, config);
      case "endingSummary":
        return endingSummary(state, config);
      case "makeup":
        return makeup(state, config);
      case "unavailable":
        return unavailableModal(state, config);
      default:
        return "";
    }
  }
  function renderApp(root, state, config) {
    if (!root) return;
    const previous = new Map([...root.querySelectorAll("[data-scroll-region]")].map((node2) => [node2.dataset.scrollRegion, node2.scrollTop]));
    themeVars(root, config?.theme);
    const screen = state?.screen || "entry";
    const inside = session(state) && !["entry", "ending", "makeup"].includes(screen);
    const base = inside ? machine(state, config) : entry(state, config);
    const layer = screen === "debug" ? debug(state, config) : overlay(state, config);
    const overlayDebug = layer && screen !== "debug" ? button("debug-open", "调试", 'data-overlay-debug="" aria-label="调试 / 外部供给"', "overlay-debug-launcher") : "";
    root.innerHTML = `${base}${layer}${overlayDebug}<div class="activity-toast" role="status" aria-live="polite">${esc(state?.toast?.message || state?.toast || "")}</div>`;
    const baseFrame = root.querySelector(".activity-frame");
    if (baseFrame && layer) {
      baseFrame.inert = true;
      baseFrame.setAttribute("aria-hidden", "true");
    }
    for (const node2 of root.querySelectorAll("[data-scroll-region]")) {
      if (previous.has(node2.dataset.scrollRegion)) node2.scrollTop = previous.get(node2.dataset.scrollRegion);
    }
  }

  // project:src/feedback.js
  var own2 = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  function reducedMotion() {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  }
  function transactionId(value) {
    return value?.transactionId ?? value?.batchId ?? value?.settlementId ?? value?.eventId ?? value?.id ?? null;
  }
  function confirmed(state, id) {
    if (!id) return true;
    const records = state?.confirmedTransactions;
    if (!records) return true;
    if (Array.isArray(records)) {
      return records.some((item) => item === id || transactionId(item) === id);
    }
    if (typeof records === "object") {
      return own2(records, id) && records[id] !== false;
    }
    return false;
  }
  function lookup(config, id) {
    const toy = (config?.toys || []).find((item) => item.toyId === id);
    if (toy) return { name: toy.name, toy: true };
    const reward2 = (config?.rewards || []).find((item) => item.rewardId === id);
    return reward2 ? { name: reward2.name, quantity: reward2.quantity } : null;
  }
  function resultLabel(result, config) {
    if (typeof result === "string") return lookup(config, result)?.name || result;
    if (!result || typeof result !== "object") return "";
    const id = result.toyId ?? result.rewardId ?? result.id;
    const item = lookup(config, id);
    const name = result.name ?? item?.name ?? id ?? "抽取结果";
    const duplicate = result.duplicate === true || result.isDuplicate === true || result.kind === "DUPLICATE";
    const points = result.pointsGained ?? result.points ?? result.convertPoints;
    if (duplicate) return `${name} · 重复${Number.isFinite(Number(points)) ? ` +${points}积分` : "转化积分"}`;
    if (result.isNew === true || result.newToy === true || result.kind === "NEW") return `${name} · NEW`;
    const quantity = result.quantity ?? (item?.toy ? null : item?.quantity);
    return `${name}${quantity != null ? ` ×${quantity}` : ""}`;
  }
  function nodeLabel(value, config) {
    const id = typeof value === "string" ? value : value?.nodeId ?? value?.id;
    const node2 = (config?.nodes || []).find((item) => item.nodeId === id);
    return node2?.label ?? (typeof value === "object" ? value?.label : null) ?? String(id ?? "阶段奖励");
  }
  function flyConfirmedDuplicatePoints(root, sources, total, durationMs = 850) {
    if (!root || !Array.isArray(sources) || !Number.isFinite(total) || total <= 0) return;
    const panel = root.querySelector(".progress-panel");
    const rail = root.querySelector(".progress-panel .progress-rail");
    if (!panel || !rail) return;
    const status = document.createElement("span");
    status.className = "point-flight-status";
    status.setAttribute("role", "status");
    status.textContent = `重复积分 +${total} 飞向进度条`;
    panel.appendChild(status);
    const rootBox = root.getBoundingClientRect();
    const target = rail.getBoundingClientRect();
    const x = target.left + target.width / 2 - rootBox.left;
    const y = target.top + target.height / 2 - rootBox.top;
    const gentle = reducedMotion();
    const visible = gentle ? [] : sources.filter((source) => source.visible && Number.isFinite(source.x) && Number.isFinite(source.y));
    if (!visible.length || typeof Element.prototype.animate !== "function") {
      status.textContent = `重复积分 +${total} 已汇入进度条`;
      return;
    }
    const layer = document.createElement("div");
    layer.className = "point-particle-layer";
    layer.setAttribute("aria-hidden", "true");
    root.appendChild(layer);
    const duration = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 850;
    let remaining = visible.length * 3;
    for (const source of visible) {
      for (let index = 0; index < 3; index++) {
        const dot = document.createElement("i");
        dot.className = "point-particle";
        dot.style.left = `${source.x - rootBox.left}px`;
        dot.style.top = `${source.y - rootBox.top}px`;
        dot.style.setProperty("--particle-color", source.color || "#f5c96d");
        layer.appendChild(dot);
        const fan = (index - 1) * 9;
        const animation = dot.animate([
          { transform: "translate(-50%,-50%) scale(.75)", opacity: 1 },
          { transform: `translate(calc(-50% + ${fan}px),calc(-50% - 15px)) scale(1.25)`, opacity: 1, offset: 0.24 },
          { transform: `translate(calc(-50% + ${x - (source.x - rootBox.left)}px),calc(-50% + ${y - (source.y - rootBox.top)}px)) scale(.3)`, opacity: 0.2 }
        ], { duration: duration + index * 75, easing: "ease-in", fill: "forwards" });
        const finish = () => {
          dot.remove();
          remaining--;
          if (remaining === 0) {
            layer.remove();
            if (status.isConnected) status.textContent = `重复积分 +${total} 已汇入进度条`;
          }
        };
        animation.finished.then(finish, finish);
      }
    }
  }
  function orderedNodes(outcome, config) {
    const raw = outcome?.automaticRewards ?? outcome?.autoRewards ?? outcome?.awardedNodes ?? outcome?.reachedNodes ?? [];
    if (!Array.isArray(raw)) return [];
    const nodes = config?.nodes || [];
    const unique = /* @__PURE__ */ new Map();
    for (const entry2 of raw) {
      const id = typeof entry2 === "string" ? entry2 : entry2?.nodeId ?? entry2?.id;
      if (id && !unique.has(id) && nodes.some((node2) => node2.nodeId === id)) unique.set(id, entry2);
    }
    const ordered = [...unique.values()];
    const rank = (entry2) => {
      const id = typeof entry2 === "string" ? entry2 : entry2?.nodeId ?? entry2?.id;
      const node2 = nodes.find((item) => item.nodeId === id);
      return node2?.nodeType === "POINT" ? 0 : node2?.nodeType === "COMPLETE" ? 2 : 1;
    };
    return ordered.sort((a, b) => {
      const ra = rank(a), rb = rank(b);
      if (ra !== rb) return ra - rb;
      const find = (entry2) => nodes.find((node2) => node2.nodeId === (typeof entry2 === "string" ? entry2 : entry2?.nodeId ?? entry2?.id));
      return (find(a)?.target ?? find(a)?.sortOrder ?? 0) - (find(b)?.target ?? find(b)?.sortOrder ?? 0);
    });
  }
  function isSuccess(outcome) {
    return outcome?.ok === true || outcome?.success === true || outcome?.committed === true;
  }
  function drawResults(outcome) {
    const value = outcome?.results ?? outcome?.items ?? outcome?.resultItems ?? outcome?.batchResults;
    return Array.isArray(value) ? value : null;
  }
  function createFeedback({ store, root, config }) {
    if (!root || typeof root.appendChild !== "function") {
      throw new TypeError("createFeedback 需要有效的挂载根节点");
    }
    const motion = Number(config?.theme?.motionMs);
    const beat = Number.isFinite(motion) && motion > 0 ? motion : 850;
    const queue = [];
    const seen = /* @__PURE__ */ new Set();
    let current = null;
    let timer = null;
    let layer = null;
    let text2 = null;
    let disposed = false;
    const observer = typeof MutationObserver === "undefined" ? null : new MutationObserver(() => {
      if (!disposed && (current || queue.length) && layer && !layer.isConnected) root.appendChild(layer);
    });
    observer?.observe(root, { childList: true });
    function ensureLayer() {
      if (!layer) {
        layer = document.createElement("div");
        layer.className = "activity-feedback";
        layer.setAttribute("aria-live", "polite");
        layer.setAttribute("aria-atomic", "true");
        layer.style.cssText = "position:absolute;left:12px;right:12px;bottom:clamp(104px,17%,164px);z-index:40;pointer-events:none;display:flex;justify-content:center;";
        text2 = document.createElement("div");
        text2.style.cssText = "max-width:100%;max-height:38vh;overflow:hidden;padding:10px 15px;border:2px solid var(--gold,#F5C96D);border-radius:var(--radius,18px);background:var(--surface,#FFF4DF);color:#352846;box-shadow:0 5px 0 #793744,0 12px 26px rgba(16,12,43,.35);font-size:var(--body-size,15px);font-weight:700;line-height:1.45;text-align:center;white-space:pre-line;";
        layer.appendChild(text2);
      }
      if (!layer.isConnected) root.appendChild(layer);
    }
    function clearPhase() {
      delete root.dataset.feedbackPhase;
    }
    function advance() {
      if (disposed) return;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      clearPhase();
      current = queue.shift() || null;
      if (!current) {
        layer?.remove();
        return;
      }
      ensureLayer();
      text2.textContent = current.message;
      if (current.kind === "machine") root.dataset.feedbackPhase = "machine";
      const duration = reducedMotion() && current.kind === "machine" ? 0 : current.duration;
      timer = setTimeout(advance, duration);
    }
    function enqueue2(frames) {
      if (disposed || !frames.length) return;
      queue.push(...frames);
      if (!current) advance();
    }
    function present(outcome) {
      if (disposed || !outcome || typeof outcome !== "object") return;
      const success = isSuccess(outcome);
      if (!success) {
        const reason = outcome.reason ?? outcome.message ?? outcome.error;
        if (reason) enqueue2([{ kind: "notice", message: String(reason), duration: beat * 2 }]);
        return;
      }
      const state = store?.getState?.();
      const id = transactionId(outcome);
      const results = drawResults(outcome);
      const irreversible = Boolean(results || outcome?.exchangeId || outcome?.itemId || outcome?.awardedNodes);
      if (irreversible && !confirmed(state, id)) return;
      if (id && seen.has(id)) return;
      if (id) seen.add(id);
      if (results) {
        const frames = [
          { kind: "machine", message: "扭蛋机转动中…", duration: beat },
          {
            kind: "result",
            message: results.length ? `本批抽取 · ${results.length}项
${results.map((item) => resultLabel(item, config)).filter(Boolean).join(" · ")}` : "抽取结果已确认",
            duration: Math.max(beat * 2, 1400)
          }
        ];
        for (const entry2 of orderedNodes(outcome, config)) {
          frames.push({ kind: "award", message: `奖励已确认 · ${nodeLabel(entry2, config)}`, duration: beat * 2 });
        }
        enqueue2(frames);
        return;
      }
      const message = outcome.message ?? outcome.notice ?? outcome.reason;
      if (message) enqueue2([{ kind: "notice", message: String(message), duration: beat * 2 }]);
    }
    function recoverPending() {
      const state = store?.getState?.();
      const pending = state?.popupQueue;
      if (!Array.isArray(pending)) return;
      for (const popup of pending) {
        if (!popup || typeof popup !== "object") continue;
        const type = String(popup.type ?? popup.kind ?? popup.screen ?? "").toLowerCase();
        if (type !== "drawresult" && type !== "draw_result") continue;
        const id = transactionId(popup) ?? transactionId(popup.payload);
        if (!id || !confirmed(state, id) || seen.has(id)) continue;
        const record2 = Array.isArray(state.confirmedTransactions) ? state.confirmedTransactions.find((item) => transactionId(item) === id) : state.confirmedTransactions?.[id];
        const saved = popup.payload && drawResults(popup.payload) ? popup.payload : popup;
        if (saved && typeof saved === "object" && drawResults(saved)) {
          present({ ...saved, transactionId: id, ok: true });
        }
      }
    }
    recoverPending();
    return {
      present,
      skip() {
        if (disposed || !current) return;
        advance();
      },
      destroy() {
        if (disposed) return;
        disposed = true;
        if (timer !== null) clearTimeout(timer);
        observer?.disconnect();
        queue.length = 0;
        current = null;
        clearPhase();
        layer?.remove();
      }
    };
  }

  // project:src/input.js
  var esc2 = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  var q = (root, selector) => root.querySelector(selector);
  var popupId3 = (popup) => typeof popup === "string" ? popup : popup?.popupId || popup?.id;
  function bindInput(root, store, feedback, config) {
    if (!root || !store || typeof store.dispatch !== "function" || !config) {
      throw new TypeError("bindInput 需要活动根节点、Store 和已校验配置");
    }
    let disposed = false;
    let locked = false;
    let revealTimer = null;
    let pendingClaim = null;
    let lastSupply = null;
    let infoScope = "FULL";
    let noticeTimer = null;
    function notice(message) {
      const text2 = String(message || "操作未完成");
      let target = q(root, ".activity-toast");
      if (!target) {
        target = document.createElement("div");
        target.className = "activity-toast";
        target.setAttribute("role", "status");
        target.setAttribute("aria-live", "polite");
        root.appendChild(target);
      }
      target.textContent = text2;
      target.style.display = "block";
      if (noticeTimer) clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => {
        if (target.isConnected) target.textContent = "";
      }, 2800);
    }
    function dispatch(action, { present = false } = {}) {
      const result = store.dispatch(action);
      if (!result?.ok) {
        const message = result?.message || result?.reason || "操作未完成";
        notice(message);
        feedback?.present?.({ ok: false, reason: message });
      } else if (present) {
        feedback?.present?.(result);
      }
      return result;
    }
    function unlockPresentation() {
      if (revealTimer !== null) clearTimeout(revealTimer);
      revealTimer = null;
      locked = false;
      root.querySelectorAll(".machine-art--active").forEach((node2) => node2.classList.remove("machine-art--active"));
      const overlay2 = q(root, '[data-screen="drawResult"].overlay');
      if (overlay2) {
        overlay2.style.visibility = "";
        overlay2.style.pointerEvents = "";
      }
      q(root, '[data-action="feedback-skip"]')?.remove();
    }
    function showMachinePresentation() {
      locked = true;
      const overlay2 = q(root, '[data-screen="drawResult"].overlay');
      if (overlay2) {
        overlay2.style.visibility = "hidden";
        overlay2.style.pointerEvents = "none";
      }
      q(root, ".machine-art")?.classList.add("machine-art--active");
      const skip = document.createElement("button");
      skip.type = "button";
      skip.dataset.action = "feedback-skip";
      skip.textContent = "跳过出蛋表现";
      skip.setAttribute("aria-label", "跳过出蛋表现并查看已确认结果");
      skip.style.cssText = "position:absolute;z-index:60;left:50%;bottom:22%;transform:translateX(-50%);min-width:44px;min-height:44px;padding:8px 16px;border:2px solid var(--gold);border-radius:20px;background:var(--surface);color:#352846;font-weight:700;";
      root.appendChild(skip);
      const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const duration = Number(config?.theme?.motionMs);
      revealTimer = setTimeout(unlockPresentation, reduced ? 0 : Number.isFinite(duration) && duration > 0 ? duration : 0);
    }
    function activePopup2() {
      return store.getState().popupQueue?.[0];
    }
    function closePopup() {
      const popup = activePopup2();
      if (!popup) return dispatch({ type: "CLOSE_SCREEN" });
      return dispatch({ type: "POPUP_CLOSE", popupId: popupId3(popup) });
    }
    function debugField(name) {
      return q(root, `[data-debug-field="${name}"]`)?.value;
    }
    function readDebugChanges() {
      const changes = {};
      const level = debugField("level");
      const wave = debugField("wave");
      if (level !== void 0 && level !== "") changes.level = Number(level);
      if (wave !== void 0 && wave !== "") changes.completedWave = Number(wave);
      for (const name of ["qualified", "mutualExclusionClear", "resourcesReady", "timeTrusted"]) {
        const value = debugField(name);
        if (value !== void 0) changes[name] = value === "true";
      }
      for (const name of ["layerId", "serverTime", "switchState"]) {
        const value = debugField(name);
        if (value !== void 0 && value !== "") changes[name] = value;
      }
      return changes;
    }
    function debugReceipt(result, request) {
      const rule = config?.supplyRules?.find((row) => row.source === request.source && row.tier === store.getState().layerId);
      const text2 = `${request.source === "ORDER_SETTLED" ? "模拟订单结算" : "模拟生成器产出"} · ID ${request.eventId} · 配置命中发券 ${rule?.ticketsOnHit ?? "—"} 张 · 实际 ${result?.ticketsGranted ?? 0} 张 · ${result?.message || result?.reason || (result?.ok ? "已记录" : "已拒绝")}${result?.duplicate ? " · 去重" : ""}`;
      notice(text2);
      if (store.getState().screen === "debug") {
        let node2 = q(root, "[data-debug-receipt]");
        if (!node2) {
          node2 = document.createElement("p");
          node2.dataset.debugReceipt = "";
          node2.setAttribute("role", "status");
          node2.style.cssText = "padding:10px;border:2px solid var(--gold);border-radius:12px;line-height:1.5;overflow-wrap:anywhere;";
          q(root, '[data-screen="debug"] .modal-content')?.prepend(node2);
        }
        if (node2) node2.textContent = text2;
      }
    }
    function supply(source, resultName, replay = false) {
      const state = store.getState();
      const typed = debugField("eventId")?.trim();
      let request;
      if (replay) {
        if (!lastSupply && !typed) return notice("请先模拟一次供券事件，或输入要重放的事件 ID");
        request = lastSupply ? { ...lastSupply, eventId: typed || lastSupply.eventId } : { eventId: typed, source: "ORDER_SETTLED", result: "SUCCESS" };
      } else {
        request = {
          eventId: typed || `${state.periodId}:${state.testInstanceId}:debug-supply:${(state.eventSerial || 0) + 1}`,
          source,
          result: resultName
        };
        lastSupply = { ...request };
      }
      const outcome = dispatch({ type: "DEBUG_SUPPLY", event: request });
      debugReceipt(outcome, request);
    }
    function showClaimConfirmation(nodeId) {
      const state = store.getState();
      const node2 = config?.nodes?.find((row) => row.nodeId === nodeId && row.nodeType === "QUALITY");
      if (!node2 || !state.activitySession) return notice("品质奖励当前不可领取");
      if (state.nodeClaims?.[nodeId]) return notice("奖励已领取");
      const owned2 = new Set(state.ownedToyIds || []);
      const count = config.toys.filter((toy) => toy.collectionId === node2.collectionId && owned2.has(toy.toyId)).length;
      if (count < node2.target) return notice(`还需收集 ${node2.target - count} 件该品质玩具`);
      pendingClaim?.remove();
      const layer = document.createElement("div");
      layer.className = "overlay";
      layer.dataset.localClaim = nodeId;
      layer.style.zIndex = "200";
      layer.innerHTML = `<section class="activity-modal" role="dialog" aria-modal="true" aria-label="确认领取品质奖励"><header class="modal-header"><h2>${esc2(node2.label)}</h2><button type="button" class="modal-close" data-action="claim-cancel" aria-label="取消领奖">×</button></header><div class="modal-content"><p>已集齐本组 ${esc2(node2.target)} 件玩具。确认后奖励将记录为模拟到账或待领奖。</p><p>${node2.rewardIds.map((id) => {
        const reward2 = config.rewards.find((row) => row.rewardId === id);
        return reward2 ? `${esc2(reward2.name)} ×${esc2(reward2.quantity)}` : "";
      }).join("、")}</p></div><footer class="modal-actions"><button type="button" class="secondary-button" data-action="claim-cancel">取消</button><button type="button" class="primary-button" data-action="claim-confirm" data-node-id="${esc2(nodeId)}">确认领取</button></footer></section>`;
      root.appendChild(layer);
      pendingClaim = layer;
    }
    function updateGuide() {
      const popup = activePopup2();
      if (popup?.type !== "guide" || !config) return;
      const lines = [...config.copy].filter((row) => /^GUIDE_/.test(row.copyId)).sort((a, b) => a.sortOrder - b.sortOrder);
      const index = Math.min(store.getState().guideIndex || 0, lines.length - 1);
      const dialog = q(root, '[data-screen="guide"]');
      const content = dialog?.querySelector(".modal-content > p");
      const progress = dialog?.querySelector(".guide-progress");
      if (content) content.textContent = lines[index]?.text || "";
      if (progress) progress.textContent = `${index + 1} / ${lines.length}`;
      const next = dialog?.querySelector('[data-action="guide-next"]');
      if (next) next.textContent = index + 1 >= lines.length ? "完成引导" : "下一步";
    }
    function setInfoScope(scope) {
      if (!config || !["FULL", "LOOP"].includes(scope)) return;
      infoScope = scope;
      renderApp(root, { ...store.getState(), infoScope: scope }, config);
    }
    function shopReason(itemId) {
      const status = getShopItemStatus(store.getState(), itemId, config);
      return status.canExchange ? "" : status.message || "商品暂不可兑换";
    }
    function onClick(event2) {
      const target = event2.target instanceof Element ? event2.target.closest("[data-action]") : null;
      if (!target || !root.contains(target) || target.disabled) return;
      const action = target.dataset.action;
      if (q(root, ".overlay") && action !== "feedback-skip" && !(action === "debug-open" && target.hasAttribute("data-overlay-debug")) && !target.closest(".overlay")) return;
      if (locked && action !== "feedback-skip") return;
      if (pendingClaim && !["claim-confirm", "claim-cancel"].includes(action)) return;
      const tierId = target.dataset.tierId;
      const itemId = target.dataset.itemId || target.closest("[data-item-id]")?.dataset.itemId;
      const nodeId = target.dataset.nodeId;
      switch (action) {
        case "feedback-skip":
          unlockPresentation();
          feedback?.skip?.();
          break;
        case "entry-open":
          dispatch({ type: "ENTRY_OPEN" });
          break;
        case "readonly-open":
          dispatch({ type: "READONLY_OPEN" });
          break;
        case "ending-summary-open":
          dispatch({ type: "ENDING_SUMMARY_OPEN" });
          break;
        case "ending-summary-close":
          dispatch({ type: "ENDING_SUMMARY_CLOSE" });
          break;
        case "cover-start":
          dispatch({ type: "COVER_START" });
          break;
        case "cover-close":
          closePopup();
          break;
        case "machine-close":
          dispatch({ type: "LEAVE_ACTIVITY" });
          break;
        case "tier-select":
          dispatch({ type: "SELECT_TIER", tierId });
          break;
        case "draw": {
          const state = store.getState();
          if (state.popupQueue?.length) return notice("请先处理当前弹窗");
          const batchId = `${state.periodId}:${state.testInstanceId}:input-draw:${(state.eventSerial || 0) + 1}`;
          const result = dispatch({ type: "DRAW", tierId: tierId || state.selectedTierId, batchId });
          if (result?.ok) {
            showMachinePresentation();
            feedback?.present?.({ ...result, batchId: result.transactionId });
          }
          break;
        }
        case "collection-open":
          dispatch({ type: "OPEN_SCREEN", screen: "collection" });
          break;
        case "shop-open":
          dispatch({ type: "OPEN_SCREEN", screen: "shop" });
          break;
        case "info-open":
          infoScope = "FULL";
          dispatch({ type: "OPEN_SCREEN", screen: "info" });
          break;
        case "rules-open":
          dispatch({ type: "OPEN_SCREEN", screen: "rulesGuide" });
          break;
        case "panel-back":
          dispatch({ type: "CLOSE_SCREEN" });
          break;
        case "info-scope":
          setInfoScope(target.dataset.scope);
          break;
        case "node-preview": {
          const node2 = config?.nodes?.find((row) => row.nodeId === nodeId);
          if (node2) notice(`${node2.label}：累计达到 ${node2.target} 分后自动发放；${node2.rewardIds.map((id) => {
            const r = config.rewards.find((row) => row.rewardId === id);
            return r ? `${r.name} ×${r.quantity}` : id;
          }).join("、")}`);
          break;
        }
        case "claim-node":
          showClaimConfirmation(nodeId);
          break;
        case "claim-cancel":
          pendingClaim?.remove();
          pendingClaim = null;
          break;
        case "claim-confirm": {
          const result = dispatch({ type: "CLAIM_NODE", nodeId: nodeId || pendingClaim?.dataset.localClaim });
          if (result?.ok) {
            pendingClaim?.remove();
            pendingClaim = null;
            notice("品质奖励已确认，模拟奖励已记录");
          }
          break;
        }
        case "exchange-open": {
          const reason = shopReason(itemId);
          if (reason) return notice(reason);
          dispatch({ type: "SHOP_CONFIRM", itemId });
          break;
        }
        case "exchange-cancel":
          closePopup();
          break;
        case "exchange-confirm": {
          const confirmation = activePopup2();
          const result = dispatch({
            type: "EXCHANGE_CONFIRM",
            itemId,
            transactionId: confirmation?.transactionId
          });
          if (result?.ok) notice("兑换已确认；累计积分不变，奖励已记录");
          break;
        }
        case "result-close": {
          const popup = activePopup2();
          const region = q(root, '[data-screen="drawResult"] .modal-content');
          const viewport = region?.getBoundingClientRect();
          const sources = [...root.querySelectorAll('[data-screen="drawResult"] .result-item.is-duplicate .duplicate-points')].map((node2) => {
            const rect = node2.getBoundingClientRect();
            return {
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2,
              visible: Boolean(viewport && rect.bottom > viewport.top && rect.top < viewport.bottom && rect.right > viewport.left && rect.left < viewport.right),
              color: getComputedStyle(node2.closest("[data-quality]") || node2).getPropertyValue("--quality-color").trim()
            };
          });
          const total = popup?.type === "drawResult" ? Number(popup.pointsGained) : 0;
          const closed = closePopup();
          if (closed?.ok && total > 0) flyConfirmedDuplicatePoints(root, sources, total, config.theme?.motionMs);
          break;
        }
        case "popup-close":
          closePopup();
          break;
        case "guide-next":
          if (dispatch({ type: "GUIDE_NEXT" })?.ok) updateGuide();
          break;
        case "guide-skip":
          dispatch({ type: "GUIDE_CLOSE" });
          break;
        case "ending-close":
        case "ending-confirm":
          closePopup();
          break;
        case "makeup-claim": {
          const state = store.getState();
          if (state.settlement?.makeup?.some((row) => row.status === "PENDING")) {
            const result = dispatch({ type: "CLAIM_MAKEUP", settlementId: state.settlement.id });
            if (result?.ok) notice("补发奖励已记录，请完成结算");
          } else closePopup();
          break;
        }
        case "debug-open":
          dispatch({ type: "OPEN_SCREEN", screen: "debug" });
          break;
        case "debug-close":
          dispatch({ type: "CLOSE_SCREEN" });
          break;
        case "debug-order-success":
          supply("ORDER_SETTLED", "SUCCESS");
          break;
        case "debug-order-fail":
          supply("ORDER_SETTLED", "FAILED");
          break;
        case "debug-generator-hit":
          supply("GENERATOR_OUTPUT", "HIT");
          break;
        case "debug-generator-miss":
          supply("GENERATOR_OUTPUT", "MISS");
          break;
        case "debug-generator-fail":
          supply("GENERATOR_OUTPUT", "OUTPUT_FAILED");
          break;
        case "debug-replay":
          supply(null, null, true);
          break;
        case "debug-apply":
          dispatch({ type: "DEBUG_SET", changes: readDebugChanges() });
          break;
        case "debug-expire": {
          const changes = readDebugChanges();
          changes.serverTime = config?.activity?.endAt;
          dispatch({ type: "DEBUG_SET", changes });
          break;
        }
        case "debug-relogin":
          dispatch({ type: "SIMULATE_RELOGIN" });
          break;
        case "debug-storage-fail":
          dispatch({ type: "DEBUG_READ_ONLY" });
          break;
        case "debug-reset": {
          const result = dispatch({ type: "RESET_TEST_INSTANCE" });
          if (result?.ok) {
            lastSupply = null;
            notice("已建立新的活动测试实例");
          }
          break;
        }
        default:
          break;
      }
    }
    root.addEventListener("click", onClick);
    return () => {
      disposed = true;
      root.removeEventListener("click", onClick);
      if (noticeTimer) clearTimeout(noticeTimer);
      if (revealTimer !== null) clearTimeout(revealTimer);
      pendingClaim?.remove();
      q(root, '[data-action="feedback-skip"]')?.remove();
    };
  }

  // project:src/main.js
  var escapeText = (value) => String(value ?? "未知错误");
  function showFailure(root, title, details) {
    const panel = document.createElement("section");
    panel.setAttribute("role", "alert");
    panel.setAttribute("data-screen", "unavailable");
    panel.style.cssText = 'box-sizing:border-box;min-height:100%;padding:32px 24px;background:#201b45;color:#fff4df;font:15px/1.65 system-ui,"PingFang SC",sans-serif;overflow:auto;';
    const heading = document.createElement("h1");
    heading.textContent = title;
    heading.style.cssText = "margin:0 0 16px;font-size:26px;";
    panel.appendChild(heading);
    const explanation = document.createElement("p");
    explanation.textContent = "活动尚未初始化；未执行抽取、扣费或奖励发放。请检查以下配置或存档问题。";
    panel.appendChild(explanation);
    const list = document.createElement("ul");
    list.style.cssText = "margin:16px 0;padding:16px 16px 16px 36px;border:2px solid #f5c96d;border-radius:18px;background:#fff4df;color:#352846;overflow-wrap:anywhere;";
    for (const detail of details) {
      const item = document.createElement("li");
      item.textContent = escapeText(detail);
      list.appendChild(item);
    }
    panel.appendChild(list);
    root.replaceChildren(panel);
  }
  function showReadOnly(root, config) {
    const existing = root.querySelector("[data-save-warning]");
    if (existing) return;
    const warning = document.createElement("div");
    warning.dataset.saveWarning = "";
    warning.setAttribute("role", "alert");
    warning.textContent = config.copyById?.SAVE_ERROR || "活动存档暂不可用，当前仅可查看已保存内容。";
    const modalBody = root.querySelector(".overlay .modal-content");
    warning.style.cssText = modalBody ? "padding:8px 12px;border:2px solid var(--gold,#f5c96d);border-radius:12px;background:var(--surface,#fff4df);color:#352846;font-size:13px;line-height:1.4;" : "position:absolute;z-index:65;top:8px;left:12px;right:12px;padding:8px 12px;border:2px solid var(--gold,#f5c96d);border-radius:12px;background:var(--surface,#fff4df);color:#352846;font-size:13px;line-height:1.4;box-shadow:0 5px 16px rgba(16,12,43,.3);pointer-events:none;";
    (modalBody || root).prepend(warning);
    const writes = '[data-action="draw"], [data-action="tier-select"], [data-action="claim-node"], [data-action="claim-confirm"], [data-action="exchange-open"], [data-action="exchange-confirm"], [data-action="debug-apply"], [data-action="debug-expire"], [data-action="debug-relogin"], [data-action="debug-reset"], [data-action="debug-storage-fail"], [data-action="debug-replay"], [data-action^="debug-order-"], [data-action^="debug-generator-"], [data-action="makeup-claim"], [data-action="cover-start"]';
    for (const control of root.querySelectorAll(writes)) {
      control.disabled = true;
      control.setAttribute("aria-disabled", "true");
    }
  }
  function bootstrap(root, sdk = typeof window === "undefined" ? void 0 : window.ActivityStudio) {
    if (!root || typeof root.replaceChildren !== "function") {
      throw new TypeError("bootstrap 需要有效的活动挂载节点");
    }
    let config;
    try {
      config = loadConfig(sdk);
      const errors = validateConfig(config);
      if (errors.length) {
        showFailure(root, "活动配置待修正", errors);
        return { store: null, destroy() {
        } };
      }
    } catch (error) {
      showFailure(root, "活动配置无法读取", [error instanceof Error ? error.message : String(error)]);
      return { store: null, destroy() {
      } };
    }
    let store;
    let unsubscribe = null;
    let unbind = null;
    let feedback = null;
    let destroyed = false;
    try {
      const persistence = createPersistence(config.activity.periodId);
      store = createStore({ sdk, config, persistence });
      const render = (snapshot) => {
        if (destroyed) return;
        try {
          renderApp(root, snapshot, config);
          if (snapshot.readOnly || persistence.status() === "READ_ONLY") {
            showReadOnly(root, config);
          }
        } catch (error) {
          showFailure(root, "活动界面暂不可用", [error instanceof Error ? error.message : String(error)]);
        }
      };
      render(store.getState());
      unsubscribe = store.subscribe(render);
      if (persistence.status() === "READY") feedback = createFeedback({ store, root, config });
      unbind = bindInput(root, store, feedback, config);
    } catch (error) {
      unbind?.();
      feedback?.destroy();
      unsubscribe?.();
      showFailure(root, "活动初始化失败", [error instanceof Error ? error.message : String(error)]);
      return { store: null, destroy() {
      } };
    }
    return {
      store,
      destroy() {
        if (destroyed) return;
        destroyed = true;
        unbind?.();
        unsubscribe?.();
        feedback?.destroy();
      }
    };
  }

  // project:__inline_entry_1.js
  bootstrap(document.getElementById("app"), window.ActivityStudio);
})();
