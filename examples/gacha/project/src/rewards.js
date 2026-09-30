import { getNodeStatus } from './progress.js';

// R04/R06/R07/R09/R10：本模块仅修改事务内 draft；调用方负责原子持久化，
// 持久化成功后才可以展示结果。外发奖励只记模拟到账／待领奖账本。
const toysOf = config => config?.toys || config?.tables?.GachaToy || [];
const rewardsOf = config => config?.rewards || config?.tables?.RewardCatalog || [];
const nodesOf = config => config?.nodes || config?.tables?.ProgressNodes || [];
const convertsOf = config => config?.qualityConvert || config?.tables?.QualityConvert || [];

function requireSource(sourceId) {
  if (typeof sourceId !== 'string' || !sourceId.length) {
    throw new Error('奖励来源 ID 不能为空');
  }
}

function contains(collection, id) {
  if (collection instanceof Set) return collection.has(id);
  if (Array.isArray(collection)) return collection.includes(id);
  return Boolean(collection && typeof collection === 'object' && collection[id]);
}

function addId(draft, field, id) {
  const current = draft[field];
  if (current instanceof Set) {
    current.add(id);
  } else if (Array.isArray(current)) {
    if (!current.includes(id)) current.push(id);
  } else if (current && typeof current === 'object') {
    current[id] = true;
  } else {
    draft[field] = [id];
  }
}

function copyResult(result) {
  return {
    ...result,
    ledgerEntries: Array.isArray(result.ledgerEntries)
      ? result.ledgerEntries.map(entry => ({ ...entry })) : []
  };
}

function claimedNode(claims, nodeId) {
  if (Array.isArray(claims)) return claims.includes(nodeId);
  const entry = claims?.[nodeId];
  return entry === true || entry === 'CLAIMED' ||
    Boolean(entry && typeof entry === 'object' &&
      (entry.claimed === true || entry.awarded === true ||
       entry.status === 'CLAIMED' || entry.status === 'AWARDED'));
}

function nodeSource(draft, nodeId, config) {
  const period = draft.periodId || config?.activity?.periodId;
  const instance = draft.testInstanceId || draft.testInstance;
  return `${period}${instance == null ? '' : `:${String(instance)}`}:node:${nodeId}`;
}

/**
 * R04/R10：对同一来源的每个奖励位置生成稳定账本 ID。先校验全部引用，
 * 再检查是否已有完整记录；部分记录属于异常存档，绝不补写而冒险重复发放。
 * 同一批中的不同抽取位置必须由调用方传入不同的 sourceId。
 */
export function grantRewards(draft, rewardIds, sourceId, config) {
  requireSource(sourceId);
  if (!Array.isArray(rewardIds)) throw new Error('奖励列表必须为数组');
  if (!Array.isArray(draft.rewardLedger)) {
    if (draft.rewardLedger != null) throw new Error('奖励账本格式无效');
    draft.rewardLedger = [];
  }
  if (!rewardIds.length) return [];

  const catalog = rewardsOf(config);
  const planned = rewardIds.map((rewardId, index) => {
    const reward = catalog.find(row => row.rewardId === rewardId);
    if (!reward || !Number.isInteger(reward.quantity) || reward.quantity <= 0 ||
        !['MOCK_CREDIT', 'MOCK_PENDING'].includes(reward.delivery)) {
      throw new Error(`奖励配置无效：${String(rewardId)}`);
    }
    return {
      ledgerId: `${sourceId}:${index}`,
      sourceId,
      rewardId: reward.rewardId,
      name: reward.name,
      rewardType: reward.rewardType,
      quantity: reward.quantity,
      delivery: reward.delivery,
      iconKey: reward.iconKey
    };
  });

  const existing = planned.map(entry =>
    draft.rewardLedger.find(record => record.ledgerId === entry.ledgerId));
  if (existing.some(Boolean)) {
    if (existing.length !== existing.filter(Boolean).length ||
        existing.some((record, index) => record.rewardId !== planned[index].rewardId ||
          record.quantity !== planned[index].quantity ||
          record.delivery !== planned[index].delivery)) {
      throw new Error(`奖励来源 ${sourceId} 的账本不完整或与配置不符`);
    }
    return [];
  }
  // 不创建主游戏余额或棋盘；MOCK_PENDING 仅表示主棋盘待领奖清单。
  draft.rewardLedger.push(...planned);
  return planned;
}

/** 按序列中的一个位置处理一次结果；同批第二次遇到同一 ToyId 即转化积分。 */
export function applySequenceResult(draft, rewardId, sourceId, config) {
  requireSource(sourceId);
  const previous = draft.sequenceResults?.[sourceId];
  if (previous) {
    if (previous.rewardId !== rewardId) throw new Error(`序列来源 ${sourceId} 对应不同奖励`);
    return { ...copyResult(previous), replay: true };
  }
  if (draft.sequenceResults != null &&
      (typeof draft.sequenceResults !== 'object' || Array.isArray(draft.sequenceResults))) {
    throw new Error('序列结果存档格式无效');
  }

  const toy = toysOf(config).find(row => row.toyId === rewardId);
  let result;
  if (toy) {
    const alreadyOwned = contains(draft.ownedToyIds, toy.toyId);
    const convert = convertsOf(config).find(row => row.qualityId === toy.qualityId);
    if (alreadyOwned && (!convert || !Number.isInteger(convert.pointsPerDuplicate) ||
        convert.pointsPerDuplicate <= 0)) {
      throw new Error(`玩具 ${toy.toyId} 的重复转化配置无效`);
    }
    const points = alreadyOwned ? convert.pointsPerDuplicate : 0;
    if (alreadyOwned) {
      draft.totalPoints = (Number(draft.totalPoints) || 0) + points;
      draft.availablePoints = (Number(draft.availablePoints) || 0) + points;
    } else {
      addId(draft, 'ownedToyIds', toy.toyId);
      addId(draft, 'newToyIds', toy.toyId);
    }
    result = {
      sourceId, rewardId, type: 'TOY', rewardType: 'TOY',
      toyId: toy.toyId, name: toy.name, qualityId: toy.qualityId,
      shapeKey: toy.shapeKey, quantity: 1,
      isNew: !alreadyOwned, isDuplicate: alreadyOwned,
      points, pointsDelta: points, ledgerEntries: []
    };
  } else {
    const reward = rewardsOf(config).find(row => row.rewardId === rewardId);
    if (!reward) throw new Error(`序列引用了不存在的奖励：${String(rewardId)}`);
    // 账本即使存在，也不能把一次重放误认为新的直接奖励。
    const ledgerEntries = grantRewards(draft, [rewardId], sourceId, config);
    result = {
      sourceId, rewardId, type: reward.rewardType, rewardType: reward.rewardType,
      name: reward.name, quantity: reward.quantity, iconKey: reward.iconKey,
      delivery: reward.delivery, isNew: false, isDuplicate: false,
      points: 0, pointsDelta: 0, ledgerEntries
    };
  }
  if (!draft.sequenceResults) draft.sequenceResults = {};
  draft.sequenceResults[sourceId] = copyResult(result);
  return result;
}

/**
 * R06/R07：品质节点只在达到目标后手动领取；积分与全收藏节点只供
 * 抽取事务自动结算。领取记录和账本在同一 draft 内写入，重试不会再发奖。
 */
export function claimNode(draft, nodeId, config) {
  const node = nodesOf(config).find(row => row.nodeId === nodeId);
  if (!node) return { ok: false, reason: 'NODE_NOT_FOUND', message: '奖励节点不存在' };
  if (claimedNode(draft.nodeClaims, nodeId)) {
    return { ok: false, reason: 'ALREADY_CLAIMED', message: '奖励已领取', nodeId };
  }
  const status = getNodeStatus(draft, config, nodeId);
  if (!status?.reached) {
    return { ok: false, reason: 'NOT_REACHED', message: '尚未达到领取条件', nodeId };
  }
  if (!Array.isArray(node.rewardIds) || !node.rewardIds.length) {
    return { ok: false, reason: 'INVALID_REWARD', message: '节点奖励配置无效', nodeId };
  }
  if (draft.nodeClaims != null &&
      (typeof draft.nodeClaims !== 'object' ||
       (!Array.isArray(draft.nodeClaims) && draft.nodeClaims instanceof Set))) {
    return { ok: false, reason: 'INVALID_SAVE', message: '领奖存档格式无效', nodeId };
  }

  const sourceId = nodeSource(draft, nodeId, config);
  let ledgerEntries;
  try {
    ledgerEntries = grantRewards(draft, node.rewardIds, sourceId, config);
  } catch (error) {
    return { ok: false, reason: 'GRANT_FAILED', message: error.message, nodeId };
  }
  if (!ledgerEntries.length) {
    // 已有账本却没有领取标记：不可再次领取，也不推断补发成功。
    return { ok: false, reason: 'INCONSISTENT_SAVE', message: '奖励账本已存在，请检查领取记录', nodeId };
  }
  if (Array.isArray(draft.nodeClaims)) {
    draft.nodeClaims = Object.fromEntries(draft.nodeClaims.map(id => [id, { claimed: true, status: 'CLAIMED' }]));
  } else if (!draft.nodeClaims) {
    draft.nodeClaims = {};
  }
  draft.nodeClaims[nodeId] = { claimed: true, status: 'CLAIMED', sourceId };
  return {
    ok: true, nodeId, nodeType: node.nodeType, label: node.label,
    claimMode: node.claimMode, sourceId, rewardIds: [...node.rewardIds],
    ledgerEntries
  };
}
