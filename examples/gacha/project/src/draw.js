import { applySequenceResult, claimNode } from './rewards.js';
import { resolveReachedNodes } from './progress.js';

// R03/R04/R06/R07/R09/R10：只计算事务内结果。调用方必须先持久化 draft，
// 再展示机器动画、结果和自动领奖；表现回调不得再次调用本函数。
const table = (config, alias, id) => config?.[alias] || config?.tables?.[id] || [];
const has = (value, id) => value instanceof Set ? value.has(id) :
  Array.isArray(value) ? value.includes(id) : Boolean(value && typeof value === 'object' && value[id]);
const failure = (reason, message, batchId) => ({ ok: false, reason, message, batchId });

function savedTransaction(state, batchId, transactionId) {
  const records = state.confirmedTransactions;
  if (has(records, batchId) || has(records, transactionId)) return true;
  if (has(state.processedEventIds, batchId) || has(state.processedEventIds, transactionId)) return true;
  const results = state.sequenceResults;
  return Boolean(results && typeof results === 'object' &&
    Object.keys(results).some(id => id.startsWith(`${transactionId}:result:`)));
}

function sessionError(state, config) {
  if (state.readOnly || state.saveError || state.persistenceStatus === 'READ_ONLY') {
    return ['READ_ONLY', '活动存档暂不可用，抽取已暂停'];
  }
  const trusted = state.simulatedServer?.timeTrusted ?? state.server?.timeTrusted ??
    state.timeTrusted ?? config?.activity?.timeTrusted;
  if (trusted !== true) return ['TIME_UNKNOWN', '服务器时间尚未确认，暂不可抽取'];
  if (state.periodId && state.periodId !== config?.activity?.periodId) {
    return ['PERIOD_MISMATCH', '活动期次不匹配'];
  }
  if (state.settlement || state.settled || state.sessionEnded || state.activitySession === 'ENDED') {
    return ['SESSION_ENDED', '本期活动已结束'];
  }
  if (state.inActivity === false || state.sessionActive === false ||
      state.activitySession === false || state.activitySession === 'INACTIVE') {
    return ['SESSION_INACTIVE', '请先进入扭蛋机'];
  }
  if (state.processing || state.drawPending || state.exchangePending) {
    return ['BUSY', '正在确认上一笔操作'];
  }
  // 截止后已在活动内的会话仍可抽取；绝不使用设备时钟来清理或结束会话。
  const rawTime = state.simulatedServer?.now ?? state.simulatedServerTime ??
    state.serverNow ?? state.serverTime ?? state.now;
  if (rawTime != null) {
    const now = typeof rawTime === 'number' ? rawTime : Date.parse(rawTime);
    const start = Date.parse(config.activity?.startAt);
    if (!Number.isFinite(now)) return ['TIME_UNKNOWN', '模拟服务器时间无效'];
    if (Number.isFinite(start) && now < start) return ['NOT_STARTED', '活动尚未开始'];
  }
  return null;
}

function currentCursor(state, layer) {
  const cursor = state.cursor || state.sequenceCursor || {};
  return {
    roomId: Number(cursor.roomId ?? state.currentRoomId ?? state.roomId ?? layer.initialRoomId),
    index: Number(cursor.index ?? cursor.position ?? state.currentIndex ??
      state.readIndex ?? layer.initialIndex)
  };
}

function writeCursor(state, cursor) {
  state.cursor = { ...cursor };
  if (state.sequenceCursor != null) state.sequenceCursor = { ...cursor };
  if (Object.prototype.hasOwnProperty.call(state, 'currentRoomId')) state.currentRoomId = cursor.roomId;
  if (Object.prototype.hasOwnProperty.call(state, 'roomId')) state.roomId = cursor.roomId;
  if (Object.prototype.hasOwnProperty.call(state, 'currentIndex')) state.currentIndex = cursor.index;
  if (Object.prototype.hasOwnProperty.call(state, 'readIndex')) state.readIndex = cursor.index;
}

function orderedEntries(config, state, reads) {
  const layers = table(config, 'playerLayers', 'PlayerLayers');
  const layerId = state.layerId ?? state.selectedLayerId ?? layers[0]?.layerId;
  const layer = layers.find(row => row.layerId === layerId);
  if (!layer) throw new Error('当前玩家分层不存在');
  const sequenceGroup = state.sequenceGroup ?? state.selectedSequenceGroup ?? layer.sequenceGroup;
  const rooms = table(config, 'sequence', 'GachaSequence')
    .filter(row => row.periodId === config.activity?.periodId &&
      row.layerId === layerId && row.sequenceGroup === sequenceGroup)
    .sort((a, b) => a.roomId - b.roomId);
  if (!rooms.length) throw new Error('当前分层的奖励序列不存在');
  const toys = table(config, 'toys', 'GachaToy');
  const rewards = table(config, 'rewards', 'RewardCatalog');
  const beforeCursor = currentCursor(state, layer);
  let roomOffset = rooms.findIndex(row => row.roomId === beforeCursor.roomId);
  let index = beforeCursor.index;
  if (roomOffset < 0 || !Number.isInteger(index) || index < 1) {
    throw new Error('奖励房间游标无效');
  }
  const entries = [];
  for (let i = 0; i < reads; i++) {
    const room = rooms[roomOffset];
    const list = room.orderedRewards;
    if (!Array.isArray(list) || index > list.length || !list.length) {
      throw new Error(`奖励房间 ${room.roomId} 的读取位置无效`);
    }
    const rewardId = list[index - 1];
    if (!toys.some(toy => toy.toyId === rewardId) &&
        !rewards.some(reward => reward.rewardId === rewardId)) {
      throw new Error(`奖励房间 ${room.roomId} 引用了不存在的奖励 ${String(rewardId)}`);
    }
    entries.push({ rewardId, roomId: room.roomId, index });
    index++;
    if (index > list.length) {
      if (room.endRule === 'LOOP_THIS_ROOM') index = 1;
      else if (room.endRule === 'NEXT_ROOM' && roomOffset + 1 < rooms.length) {
        roomOffset++;
        index = 1;
      } else throw new Error(`奖励房间 ${room.roomId} 缺少有效的后续读取规则`);
    }
  }
  return {
    entries, beforeCursor,
    afterCursor: { roomId: rooms[roomOffset].roomId, index },
    layerId, sequenceGroup
  };
}

function recordTransaction(state, batchId, transactionId, receipt) {
  const existing = state.confirmedTransactions;
  if (existing == null) state.confirmedTransactions = {};
  else if (!existing || typeof existing !== 'object' || existing instanceof Set) {
    throw new Error('已确认事务存档格式无效');
  }
  if (Array.isArray(state.confirmedTransactions)) {
    state.confirmedTransactions.push({ transactionId, batchId, ...receipt });
  } else {
    state.confirmedTransactions[transactionId] = { batchId, ...receipt };
  }
}

/**
 * 一次抽取 = 一次扣券 + reads 次顺序结算 + 已达成自动节点结算。
 * 先在独立 JSON 副本完成所有校验及发奖；任何失败均不改动传入 draft。
 * 自动领奖按积分门槛升序，最后处理全收藏；品质奖励始终留给手动领取。
 */
export function evaluateDraw(draft, tierId, batchId, config) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
    return failure('INVALID_SAVE', '活动存档无效', batchId);
  }
  if (typeof batchId !== 'string' || !batchId.trim()) {
    return failure('INVALID_BATCH_ID', '抽取批次 ID 不能为空', batchId);
  }
  if (!config?.activity?.periodId) return failure('INVALID_CONFIG', '活动期次配置无效', batchId);
  const instance = draft.testInstanceId ?? draft.testInstance;
  const transactionId = `${config.activity.periodId}${instance == null ? '' : `:${String(instance)}`}:draw:${batchId}`;
  if (savedTransaction(draft, batchId, transactionId)) {
    return failure('DUPLICATE_BATCH', '这一批抽取已确认，不会再次扣券或读取序列', batchId);
  }
  const blocked = sessionError(draft, config);
  if (blocked) return failure(blocked[0], blocked[1], batchId);
  const tier = table(config, 'drawTiers', 'DrawTiers').find(row => row.tierId === tierId);
  if (!tier || !Number.isInteger(tier.reads) || tier.reads < 1 ||
      !Number.isInteger(tier.singleCost) || tier.singleCost < 1 ||
      tier.ticketCost !== tier.singleCost * tier.reads) {
    return failure('INVALID_TIER', '倍率或抽取消耗配置无效', batchId);
  }
  if (!Number.isInteger(draft.tickets) || draft.tickets < 0) {
    return failure('INVALID_SAVE', '扭蛋券存档无效', batchId);
  }
  if (draft.tickets < tier.ticketCost) {
    return failure('TICKET_LOW', config.copyById?.TICKET_LOW ||
      '扭蛋券不足，请完成订单或使用主线生成器获取', batchId);
  }

  try {
    // 奖励序列、事务记录及账本均为可持久化数据；不依赖动画的中途状态。
    const working = JSON.parse(JSON.stringify(draft));
    const path = orderedEntries(config, working, tier.reads);
    const oldPoints = Number(working.totalPoints) || 0;
    const oldAvailablePoints = Number(working.availablePoints) || 0;
    working.tickets -= tier.ticketCost;
    const results = path.entries.map((entry, i) => ({
      ...applySequenceResult(working, entry.rewardId,
        `${transactionId}:result:${i + 1}`, config),
      roomId: entry.roomId,
      sequenceIndex: entry.index
    }));
    const pointsGained = (Number(working.totalPoints) || 0) - oldPoints;
    if (pointsGained < 0 || (Number(working.availablePoints) || 0) - oldAvailablePoints !== pointsGained) {
      throw new Error('重复玩具积分结算不一致');
    }
    writeCursor(working, path.afterCursor);

    const nodes = table(config, 'nodes', 'ProgressNodes');
    const automaticRewards = [];
    for (const nodeId of resolveReachedNodes(working, config)) {
      const node = nodes.find(row => row.nodeId === nodeId);
      if (node?.claimMode !== 'AUTO') continue;
      const award = claimNode(working, nodeId, config);
      if (!award.ok) throw new Error(`自动奖励 ${nodeId} 结算失败：${award.message}`);
      automaticRewards.push(award);
    }
    const receipt = {
      tierId, cost: tier.ticketCost, reads: tier.reads,
      beforeCursor: path.beforeCursor, afterCursor: path.afterCursor,
      rewardIds: path.entries.map(entry => entry.rewardId), pointsGained,
      automaticNodeIds: automaticRewards.map(award => award.nodeId)
    };
    recordTransaction(working, batchId, transactionId, receipt);
    // 唯一提交点；Store 还须将修改后的 draft 成功 commit，才可对外宣布成功。
    Object.assign(draft, working);
    return {
      ok: true, batchId, transactionId, tierId,
      layerId: path.layerId, sequenceGroup: path.sequenceGroup,
      cost: tier.ticketCost, ticketCost: tier.ticketCost, reads: tier.reads,
      results, beforeCursor: path.beforeCursor, afterCursor: path.afterCursor,
      pointsGained, pointDelta: pointsGained,
      automaticRewards, autoRewards: automaticRewards,
      ticketsRemaining: draft.tickets,
      totalPoints: draft.totalPoints,
      availablePoints: draft.availablePoints
    };
  } catch (error) {
    return failure('DRAW_FAILED', error instanceof Error ? error.message : String(error), batchId);
  }
}
