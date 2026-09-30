import { defaultTables } from './defaults.js';

// R01–R12：只读适配平台表。有效注入行优先；缺失或空表使用有标注依据的演示默认行。绝不写入 SDK。
const TABLE_IDS = [
  'ActivityConfig', 'SupplyRules', 'PlayerLayers', 'DrawTiers',
  'GachaToy', 'QualityConvert', 'RewardCatalog', 'GachaSequence',
  'ProgressNodes', 'GachaShop', 'UiCopy', 'VisualTheme'
];

const JSON_FIELDS = {
  GachaSequence: { orderedRewardsJson: 'orderedRewards' },
  ProgressNodes: { rewardIdsJson: 'rewardIds' },
  VisualTheme: {
    qualityColorsJson: 'qualityColors',
    spacingJson: 'spacing'
  }
};

const QUALITY_IDS = ['GREEN', 'BLUE', 'PURPLE', 'RED', 'GOLD'];
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const positiveInteger = value => Number.isInteger(value) && value > 0;

function rowsFor(sdk, id, errors) {
  const table = sdk?.tables?.[id];
  // 缺表、仅有字段或空 rows 均使用默认演示配置；已填写的行不逐字段拼接，
  // 避免把错误的用户数值静默改成默认值。非数组 rows 属于已填写的错误配置。
  if (table && Object.prototype.hasOwnProperty.call(table, 'rows') && !Array.isArray(table.rows)) {
    errors.push(`${id}：rows 不是数组`);
    return [];
  }
  const sources = table?.rows?.length ? table.rows : defaultTables[id];
  return sources.map((source, index) => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      errors.push(`${id}[${index}]：行不是对象`);
      return {};
    }
    // 仅复制行；JSON 字段在副本上解析，绝不修改平台注入的原始数据。
    const row = { ...source };
    for (const [field, target] of Object.entries(JSON_FIELDS[id] || {})) {
      try {
        if (typeof source[field] !== 'string') throw new Error('需要 JSON 字符串');
        row[target] = JSON.parse(source[field]);
      } catch (error) {
        errors.push(`${id}[${index}].${field}：${error.message}`);
        row[target] = null;
      }
    }
    return row;
  });
}

/** 读取完整平台配置。缺表和无效 JSON 留给 validateConfig 报告，不偷偷补第二套数值。 */
export function loadConfig(sdk) {
  const errors = [];
  const tables = {};
  // 显式列出平台注入表的读取位置，便于静态审查；不复制业务数值，也不写入 SDK。
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
  // Only generated fallback rows follow the supplied period; never rewrite a user row.
  if (!injected.GachaSequence?.rows?.length && activity?.periodId) {
    tables.GachaSequence = tables.GachaSequence.map(row => ({ ...row, periodId: activity.periodId }));
  }
  if (tables.ActivityConfig.length !== 1) {
    errors.push('ActivityConfig：本次活动需要且仅需要一行期次配置');
  }
  if (tables.VisualTheme.length !== 1) {
    errors.push('VisualTheme：本次活动需要且仅需要一行主题配置');
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
  // 同名表别名便于其他模块按表 ID 读取；ProgressNodes 保留原始行序用于 track 的零起始索引。
  for (const id of TABLE_IDS) config[id] = tables[id];
  config.gachaSequence = config.sequence;
  config.progressNodes = config.nodes;
  config.gachaShop = config.shop;
  config.rewardCatalog = config.rewards;
  config.gachaToy = config.toys;
  config.uiCopy = config.copy;
  config.copyById = Object.fromEntries(config.copy.map(row => [row.copyId, row.text]));
  return config;
}

/** 返回面向配置作者的具体错误；不修改配置，也不把演示假设替换为脚本常量。 */
export function validateConfig(config) {
  if (!config || typeof config !== 'object') return ['配置未加载'];
  const errors = [...(Array.isArray(config.errors) ? config.errors : [])];
  const list = (name, alias) => Array.isArray(config[name])
    ? config[name]
    : Array.isArray(config.tables?.[alias]) ? config.tables[alias] : [];
  const activity = config.activity;
  const layers = list('playerLayers', 'PlayerLayers');
  const tiers = list('drawTiers', 'DrawTiers');
  const toys = list('toys', 'GachaToy');
  const converts = list('qualityConvert', 'QualityConvert');
  const rewards = list('rewards', 'RewardCatalog');
  const rooms = list('sequence', 'GachaSequence');
  const nodes = list('nodes', 'ProgressNodes');
  const shop = list('shop', 'GachaShop');
  const supply = list('supplyRules', 'SupplyRules');
  const copies = list('copy', 'UiCopy');
  const theme = config.theme;
  const unique = (rows, field, table) => {
    const seen = new Set();
    for (const [i, row] of rows.entries()) {
      const value = row[field];
      if (value === undefined || value === null || value === '') {
        errors.push(`${table}[${i}]：缺少 ${field}`);
      } else if (seen.has(value)) {
        errors.push(`${table}：重复 ${field}=${value}`);
      }
      seen.add(value);
    }
  };
  const toyIds = new Set(toys.map(row => row.toyId));
  const rewardIds = new Set(rewards.map(row => row.rewardId));
  const layerIds = new Set(layers.map(row => row.layerId));
  const nodeIds = new Set(nodes.map(row => row.nodeId));
  const referenceReward = (id, source) => {
    if (!toyIds.has(id) && !rewardIds.has(id)) errors.push(`${source}：不存在奖励或玩具 ${id}`);
  };

  if (!activity) errors.push('ActivityConfig：缺少活动期次');
  else {
    if (!activity.periodId) errors.push('ActivityConfig：缺少 periodId');
    const start = Date.parse(activity.startAt);
    const end = Date.parse(activity.endAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      errors.push('ActivityConfig：开始／截止时间无效或顺序错误');
    } else if (end - start !== 7 * 86400000) {
      errors.push('ActivityConfig.endAt：必须为 startAt 后七天；本期时长是已确认策划规则');
    }
    if (activity.dayCutHour !== 3) errors.push('ActivityConfig.dayCutHour：已确认值为 3');
    if (activity.minLevel !== 7) errors.push('ActivityConfig.minLevel：已确认值为 7');
    if (activity.requiredWave !== 6) errors.push('ActivityConfig.requiredWave：已确认值为 6');
    if (activity.settlementDays !== 2) errors.push('ActivityConfig.settlementDays：已确认值为 2');
    for (const field of ['initialTickets', 'guideGiftTickets']) {
      if (!Number.isInteger(activity[field]) || activity[field] < 0) errors.push(`ActivityConfig：${field} 必须为非负整数`);
    }
    if (!['OPEN', 'SOFT_OFF', 'HARD_OFF'].includes(activity.switchState)) errors.push('ActivityConfig：switchState 无效');
    if (typeof activity.timeTrusted !== 'boolean') errors.push('ActivityConfig：timeTrusted 必须为布尔值');
  }

  unique(layers, 'layerId', 'PlayerLayers');
  unique(tiers, 'tierId', 'DrawTiers');
  unique(toys, 'toyId', 'GachaToy');
  unique(converts, 'qualityId', 'QualityConvert');
  unique(rewards, 'rewardId', 'RewardCatalog');
  unique(nodes, 'nodeId', 'ProgressNodes');
  unique(shop, 'id', 'GachaShop');
  unique(supply, 'ruleId', 'SupplyRules');
  unique(copies, 'copyId', 'UiCopy');

  if (layers.length === 0) errors.push('PlayerLayers：至少需要一个适用分层');
  const roomKeys = new Set();
  for (const [i, room] of rooms.entries()) {
    const where = `GachaSequence[${i}]`;
    if (room.periodId !== activity?.periodId) errors.push(`${where}：periodId 未关联当前期次`);
    if (!layerIds.has(room.layerId)) errors.push(`${where}：未找到分层 ${room.layerId}`);
    if (!positiveInteger(room.roomId)) errors.push(`${where}：roomId 必须为正整数`);
    const key = `${room.layerId}/${room.sequenceGroup}/${room.roomId}`;
    if (roomKeys.has(key)) errors.push(`${where}：重复房间 ${key}`);
    roomKeys.add(key);
    if (!['NEXT_ROOM', 'LOOP_THIS_ROOM'].includes(room.endRule)) errors.push(`${where}：endRule 无效`);
    if (!Array.isArray(room.orderedRewards) || room.orderedRewards.length < 20) {
      errors.push(`${where}：有序奖励须为至少 20 项的 JSON 数组`);
    } else {
      room.orderedRewards.forEach((id, j) => referenceReward(id, `${where}.orderedRewards[${j}]`));
    }
  }
  for (const layer of layers) {
    // R02/R04：每个可选分层都必须能通过两种 Debug 外部事件持续补券。
    // 供券规则要求唯一；仅检查全表存在某种来源会放过无法补给的分层。
    for (const source of ['ORDER_SETTLED', 'GENERATOR_OUTPUT']) {
      const matches = supply.filter(rule => rule.tier === layer.layerId && rule.source === source);
      if (matches.length !== 1) {
        errors.push(`SupplyRules：分层 ${layer.layerId} 的 ${source} 规则需要且仅需要一条，当前 ${matches.length} 条`);
      }
    }
    if (layer.selection !== 'FIXED') errors.push(`PlayerLayers ${layer.layerId}：演示仅支持 FIXED；不可将随机选组误写为固定投放占比`);
    if (!positiveInteger(layer.initialIndex)) errors.push(`PlayerLayers ${layer.layerId}：initialIndex 须从 1 开始`);
    const selected = rooms.filter(room => room.layerId === layer.layerId && room.sequenceGroup === layer.sequenceGroup)
      .sort((a, b) => a.roomId - b.roomId);
    if (!selected.length) {
      errors.push(`PlayerLayers ${layer.layerId}：找不到序列组 ${layer.sequenceGroup}`);
      continue;
    }
    const first = selected.find(room => room.roomId === layer.initialRoomId);
    if (!first || layer.initialIndex > (first.orderedRewards?.length || 0)) {
      errors.push(`PlayerLayers ${layer.layerId}：初始房间或读取位置无效`);
    }
    selected.forEach((room, i) => {
      if (i < selected.length - 1 && room.endRule !== 'NEXT_ROOM') errors.push(`GachaSequence 房间 ${room.roomId}：后续有房间时应使用 NEXT_ROOM`);
      if (i === selected.length - 1 && room.endRule !== 'LOOP_THIS_ROOM') errors.push(`GachaSequence 房间 ${room.roomId}：末房间需配置 LOOP_THIS_ROOM，以保证继续抽取`);
    });
    // R06：只能统计从初始游标实际可读取的项。初始房间之前的内容，以及
    // 初始房间中位于 initialIndex 之前的内容，都不能用于证明收藏可完成。
    const initialRoomOffset = selected.findIndex(room => room.roomId === layer.initialRoomId);
    if (initialRoomOffset >= 0) {
      const reachable = new Set(selected.slice(initialRoomOffset).flatMap((room, offset) =>
        Array.isArray(room.orderedRewards)
          ? room.orderedRewards.slice(offset === 0 ? layer.initialIndex - 1 : 0)
          : []));
      const missing = toys.filter(toy => !reachable.has(toy.toyId)).map(toy => toy.toyId);
      if (missing.length) errors.push(`序列 ${layer.sequenceGroup}：从初始游标 ${layer.initialRoomId}/${layer.initialIndex} 无法读取玩具 ${missing.join('、')}，不能完成收藏`);
    }
  }

  if (tiers.length !== 4 || new Set(tiers.map(row => row.reads)).size !== 4 ||
      ![1, 3, 5, 10].every(n => tiers.some(row => row.reads === n))) {
    errors.push('DrawTiers：须提供 ×1、×3、×5、×10 四档');
  }
  const singleCosts = new Set(tiers.map(row => row.singleCost));
  if (singleCosts.size !== 1 || !positiveInteger(tiers[0]?.singleCost)) errors.push('DrawTiers：四档 singleCost 须为相同正整数');
  for (const tier of tiers) {
    if (!positiveInteger(tier.reads) || tier.ticketCost !== tier.singleCost * tier.reads) errors.push(`DrawTiers ${tier.tierId}：ticketCost 必须等于 singleCost × reads`);
  }
  if (toys.length !== 25) errors.push(`GachaToy：须有 25 件不同玩具，当前 ${toys.length} 件`);
  for (const quality of QUALITY_IDS) {
    const members = toys.filter(toy => toy.qualityId === quality);
    if (members.length !== 5) errors.push(`GachaToy：${quality} 须有 5 件玩具`);
    if (!converts.some(row => row.qualityId === quality)) errors.push(`QualityConvert：缺少 ${quality}`);
    const collections = new Set(members.map(row => row.collectionId));
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
    if (!positiveInteger(row.quantity) || !['COIN', 'MAIN_ENERGY', 'BOARD_ITEM'].includes(row.rewardType) ||
        !['MOCK_CREDIT', 'MOCK_PENDING'].includes(row.delivery) || !row.iconKey) {
      errors.push(`RewardCatalog ${row.rewardId}：数量、类型、承接方式或图标无效`);
    }
  }
  const pointNodes = nodes.filter(row => row.nodeType === 'POINT').sort((a, b) => a.target - b.target);
  const qualityNodes = nodes.filter(row => row.nodeType === 'QUALITY');
  const completeNodes = nodes.filter(row => row.nodeType === 'COMPLETE');
  if (pointNodes.length !== 5 || qualityNodes.length !== 5 || completeNodes.length !== 1) errors.push('ProgressNodes：需要五个积分节点、五个品质节点和一个全收藏节点');
  for (const [i, node] of nodes.entries()) {
    if (!positiveInteger(node.target) || !positiveInteger(node.sortOrder)) errors.push(`ProgressNodes[${i}]：target 或 sortOrder 无效`);
    if (!['POINT', 'QUALITY', 'COMPLETE'].includes(node.nodeType)) errors.push(`ProgressNodes[${i}]：nodeType 无效`);
    if (node.claimMode !== (node.nodeType === 'QUALITY' ? 'MANUAL' : 'AUTO')) errors.push(`ProgressNodes[${i}]：领取方式与节点类型不符`);
    if (typeof node.eventName !== 'string' || !node.eventName.trim()) errors.push(`ProgressNodes[${i}].eventName：必须填写非空语义事件名`);
    if (node.nodeType === 'QUALITY' && (node.target !== 5 || !toys.some(toy => toy.collectionId === node.collectionId))) errors.push(`ProgressNodes[${i}]：品质节点应关联五件玩具`);
    if (node.nodeType === 'COMPLETE' && node.target !== toys.length) errors.push(`ProgressNodes[${i}]：全收藏目标与玩具数量不符`);
    if (!Array.isArray(node.rewardIds) || !node.rewardIds.length) errors.push(`ProgressNodes[${i}]：rewardIdsJson 须为非空数组`);
    else node.rewardIds.forEach(id => { if (!rewardIds.has(id)) errors.push(`ProgressNodes[${i}]：不存在 RewardCatalog 奖励 ${id}`); });
  }
  pointNodes.forEach((node, i) => {
    if (i && node.target <= pointNodes[i - 1].target) errors.push('ProgressNodes：积分门槛必须严格递增');
  });
  for (const item of shop) {
    if (!rewardIds.has(item.rewardId) || !positiveInteger(item.pointPrice) ||
        !(item.exchangeLimit === -1 || positiveInteger(item.exchangeLimit))) {
      errors.push(`GachaShop ${item.id}：奖励引用、价格或兑换上限无效`);
    }
  }
  for (const rule of supply) {
    if (!layerIds.has(rule.tier) || !['ORDER_SETTLED', 'GENERATOR_OUTPUT'].includes(rule.source) ||
        !['FIXED', 'HIT_PROBABILITY'].includes(rule.method) ||
        !Number.isFinite(rule.hitRate) || rule.hitRate < 0 || rule.hitRate > 1 ||
        !positiveInteger(rule.ticketsOnHit) ||
        ![rule.dailyCap, rule.periodCap].every(n => n === -1 || Number.isInteger(n) && n >= 0)) {
      errors.push(`SupplyRules ${rule.ruleId}：分层、来源、命中率、发券数或上限无效`);
    }
  }
  if (!supply.some(row => row.source === 'ORDER_SETTLED') || !supply.some(row => row.source === 'GENERATOR_OUTPUT')) errors.push('SupplyRules：订单和生成器供券规则均不可缺少');
  if (!theme || !theme.background || !theme.machine || !theme.glass || !theme.surface ||
      !theme.gold || !theme.fontStack || !theme.shadow ||
      !theme.qualityColors || typeof theme.qualityColors !== 'object' ||
      !QUALITY_IDS.every(id => typeof theme.qualityColors[id] === 'string') ||
      !Array.isArray(theme.spacing) || !theme.spacing.every(positiveInteger) ||
      !positiveInteger(theme.motionMs) || !positiveInteger(theme.minTouchPx) || theme.minTouchPx < 44) {
    errors.push('VisualTheme：主题字段、品质色、间距、动效或最小触控尺寸无效');
  }
  return [...new Set(errors)];
}

/**
 * R05：从正在生效的固定序列统计投放占比；绝非下一抽独立概率。
 * scope='FULL'/'ALL' 统计全部房间；'LOOP' 仅统计末尾循环房间。
 * 也支持 scope={roomId:number} 查看一个房间。百分比仅供展示，不参与抽奖。
 */
export function getSequenceShares(config, layerId, scope = 'FULL') {
  const layers = config?.playerLayers || config?.tables?.PlayerLayers || [];
  const rooms = config?.sequence || config?.tables?.GachaSequence || [];
  const toys = config?.toys || config?.tables?.GachaToy || [];
  const rewards = config?.rewards || config?.tables?.RewardCatalog || [];
  const converts = config?.qualityConvert || config?.tables?.QualityConvert || [];
  const layer = layers.find(row => row.layerId === layerId);
  if (!layer || layer.selection !== 'FIXED') return [];
  let selected = rooms.filter(row => row.layerId === layerId && row.sequenceGroup === layer.sequenceGroup &&
    row.periodId === config?.activity?.periodId).sort((a, b) => a.roomId - b.roomId);
  const scopeName = typeof scope === 'string' ? scope.toUpperCase() : '';
  if (scopeName === 'LOOP' || scopeName === 'LAST_ROOM') {
    selected = selected.filter(row => row === selected[selected.length - 1] && row.endRule === 'LOOP_THIS_ROOM');
  } else if (scope && typeof scope === 'object' && own(scope, 'roomId')) {
    selected = selected.filter(row => row.roomId === scope.roomId);
  } else if (!['FULL', 'ALL', 'SEQUENCE', ''].includes(scopeName)) {
    return [];
  }
  const entries = selected.flatMap(row => Array.isArray(row.orderedRewards)
    ? row.orderedRewards
    : typeof row.orderedRewardsJson === 'string' ? safeArray(row.orderedRewardsJson) : []);
  if (!entries.length) return [];
  const counts = new Map();
  for (const id of entries) counts.set(id, (counts.get(id) || 0) + 1);
  // 按玩具收藏顺序展示全部 25 件，包括本范围内投放次数为零的玩具。
  const qualityRank = id => QUALITY_IDS.indexOf(id);
  const orderedToys = [...toys].sort((a, b) => qualityRank(a.qualityId) - qualityRank(b.qualityId) || a.sortOrder - b.sortOrder);
  const items = [
    ...orderedToys.map(toy => ({
      rewardId: toy.toyId, toyId: toy.toyId, name: toy.name,
      quantity: 1, qualityId: toy.qualityId, iconKey: toy.shapeKey,
      shapeKey: toy.shapeKey,
      duplicatePoints: converts.find(row => row.qualityId === toy.qualityId)?.pointsPerDuplicate ?? null,
      rewardType: 'TOY', type: 'TOY'
    })),
    ...rewards.filter(row => counts.has(row.rewardId)).map(row => ({
      rewardId: row.rewardId, name: row.name, quantity: row.quantity,
      qualityId: null, iconKey: row.iconKey, duplicatePoints: null,
      rewardType: row.rewardType, type: row.rewardType
    }))
  ];
  const total = entries.length;
  const populated = items.filter(item => counts.has(item.rewardId));
  const minimumPercent = Math.min(...populated.map(item => counts.get(item.rewardId) / total * 100));
  // R05：默认保留两位；序列很长时提高整个统计范围的统一精度。
  // 预留足够的最小非零单位，避免尾项吸收舍入差后变成 0% 或负数。
  const digits = Math.min(10, Math.max(2,
    Math.ceil(Math.log10((populated.length + 1) / minimumPercent))));
  const scale = 10 ** digits;
  const totalUnits = 100 * scale;
  let roundedUnits = 0;
  return items.map(item => {
    const count = counts.get(item.rewardId) || 0;
    const units = count && item === populated[populated.length - 1]
      ? totalUnits - roundedUnits
      : Math.round(count / total * totalUnits);
    if (!(count && item === populated[populated.length - 1])) roundedUnits += units;
    const percent = units / scale;
    return {
      ...item, count, total, percentage: percent, percent,
      displayValue: `${percent.toFixed(digits)}%`,
      displayDigits: digits,
      exactShare: count / total,
      displayBasis: 'FIXED_SEQUENCE_SHARE',
      layerId, sequenceGroup: layer.sequenceGroup,
      scope: scopeName === 'LOOP' || scopeName === 'LAST_ROOM' ? 'LOOP' :
        scope && typeof scope === 'object' ? `ROOM_${scope.roomId}` : 'FULL',
      roomIds: selected.map(row => row.roomId)
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
