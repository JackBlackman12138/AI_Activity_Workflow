import { getNodeStatus } from './progress.js';
import { claimNode } from './rewards.js';

// R01/R06/R09/R10/R11：本模块只修改事务副本；Store 必须先持久化成功，
// 再展示弹窗、发布事件或播放反馈。这里不读取设备时钟，也不调用 SDK。
const nodesOf = config => config?.nodes || config?.tables?.ProgressNodes || [];
const toysOf = config => config?.toys || config?.tables?.GachaToy || [];
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function firstDefined(...values) {
  return values.find(value => value !== undefined && value !== null);
}

function serverTimestamp(state) {
  const value = firstDefined(
    state?.serverTime, state?.simulatedServerTime, state?.serverNow,
    state?.debug?.serverTime, state?.debug?.simulatedServerTime
  );
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  return typeof value === 'string' && value.trim() ? Date.parse(value) : NaN;
}

function insideSession(state) {
  // 显式会话标志优先：关闭机台时 Store 可先置 false，再调用 beginSettlement。
  const flag = firstDefined(
    state?.sessionActive, state?.activitySessionActive,
    typeof state?.activitySession === 'object' ? state.activitySession.active : state?.activitySession,
    state?.inActivity
  );
  if (flag !== undefined) return flag === true || flag === 'ACTIVE';
  return ['cover', 'machine', 'drawResult', 'collection', 'claim', 'shop',
    'exchangeConfirm', 'info', 'rulesGuide'].includes(state?.screen);
}

function switchState(state, config) {
  return firstDefined(state?.switchState, state?.debug?.switchState,
    config?.activity?.switchState);
}

function periodId(state, config) {
  return state?.periodId || config?.activity?.periodId;
}

function settlementKey(state, config) {
  const instance = firstDefined(state?.testInstanceId, state?.testInstance);
  return `${periodId(state, config)}${instance == null ? '' : `:${String(instance)}`}:settlement`;
}

function popupId(popup) {
  return typeof popup === 'string' ? popup :
    popup?.popupId || popup?.id || null;
}

function queued(queue, id) {
  return Array.isArray(queue) && queue.some(popup => popupId(popup) === id);
}

function ownedCount(state, config) {
  const owned = state?.ownedToyIds;
  const has = id => owned instanceof Set ? owned.has(id) :
    Array.isArray(owned) ? owned.includes(id) : Boolean(owned?.[id]);
  return toysOf(config).filter(toy => has(toy.toyId)).length;
}

function snapshotRewardIds(node) {
  if (Array.isArray(node.rewardIds)) return [...node.rewardIds];
  try {
    const ids = JSON.parse(node.rewardIdsJson);
    return Array.isArray(ids) ? ids : null;
  } catch {
    return null;
  }
}

/** R01/R09：截止仅停止外部供券；到期时已在机台及二级页的会话仍可操作。 */
export function getSessionAvailability(state, config) {
  const activity = config?.activity;
  const inside = insideSession(state);
  const trusted = firstDefined(state?.timeTrusted, state?.debug?.timeTrusted,
    activity?.timeTrusted) === true;
  const now = serverTimestamp(state);
  const start = Date.parse(activity?.startAt);
  const end = Date.parse(activity?.endAt);
  const validTime = trusted && Number.isFinite(now) &&
    Number.isFinite(start) && Number.isFinite(end) && end > start;
  const expired = validTime && now >= end;
  const started = validTime && now >= start;
  const closed = state?.settlement?.status === 'FINALIZED' ||
    state?.settlement?.finalized === true;
  const hardOff = switchState(state, config) === 'HARD_OFF';
  const readOnly = state?.readOnly === true || state?.storageStatus === 'READ_ONLY' ||
    state?.saveStatus === 'READ_ONLY';
  const level = firstDefined(state?.level, state?.playerLevel,
    state?.debug?.level, state?.debug?.playerLevel);
  const wave = firstDefined(state?.orderWave, state?.completedWave,
    state?.debug?.orderWave, state?.debug?.completedWave);
  const eligible = (level === undefined || Number(level) >= activity?.minLevel) &&
    (wave === undefined || Number(wave) >= activity?.requiredWave) &&
    firstDefined(state?.qualified, state?.eligible, state?.debug?.qualified, true) !== false &&
    firstDefined(state?.mutualExclusionClear, state?.debug?.mutualExclusionClear, true) !== false &&
    firstDefined(state?.resourcesReady, state?.debug?.resourcesReady, true) !== false;

  let reason = null;
  if (!validTime) reason = 'TIME_UNCONFIRMED';
  else if (readOnly) reason = 'READ_ONLY';
  else if (closed) reason = 'ALREADY_SETTLED';
  else if (!started) reason = 'NOT_STARTED';
  else if (state?.settlement?.status === 'PENDING_MAKEUP') reason = 'SETTLING';
  else if (hardOff && !inside) reason = 'HARD_OFF';
  else if (expired && !inside) reason = 'EXPIRED';
  else if (!eligible && !inside) reason = 'NOT_ELIGIBLE';

  const canOperate = reason === null && inside;
  const canEnter = reason === null && !expired && !hardOff && eligible;
  return {
    phase: !validTime ? 'UNCONFIRMED' : closed ? 'SETTLED' :
      expired ? inside ? 'EXPIRED_IN_SESSION' : 'EXPIRED_OUTSIDE' :
      started ? 'OPEN' : 'NOT_STARTED',
    reason, timeTrusted: validTime, now: validTime ? now : null,
    startAt: Number.isFinite(start) ? start : null,
    endAt: Number.isFinite(end) ? end : null,
    expired, insideSession: inside, canEnter, canOperate,
    canSupply: reason === null && !expired && eligible && !hardOff
  };
}

/**
 * R09/R10：仅在到期且已离开机台时冻结补发范围。二级页返回仍属活动内，
 * 不得以到期本身触发清理。结束弹窗先入队，补发弹窗随后入队。
 */
export function beginSettlement(draft, config) {
  const availability = getSessionAvailability(draft, config);
  if (!availability.timeTrusted) return {
    ok: false, reason: 'TIME_UNCONFIRMED', message: '服务器时间尚未确认，不进行结算'
  };
  if (draft?.settlement?.status === 'FINALIZED') return {
    ok: false, reason: 'ALREADY_SETTLED', message: '本期已经结算',
    settlementId: draft.settlement.id
  };
  if (draft?.settlement?.status === 'PENDING_MAKEUP') {
    // R09/R10：旧存档或中断恢复可能缺少结束弹窗。只重建展示队列，
    // 不重新冻结补发范围、不发奖，也不再次清理资产。
    const settlement = draft.settlement;
    if (!Array.isArray(draft.popupQueue) || !Array.isArray(settlement.makeup)) return {
      ok: false, reason: 'INVALID_SAVE', message: '结束弹窗或补发清单存档格式无效'
    };
    if (!settlement.endingAcknowledged && !queued(draft.popupQueue, settlement.endingPopupId)) {
      const ending = {
        id: settlement.endingPopupId, popupId: settlement.endingPopupId,
        type: 'ending', settlementId: settlement.id
      };
      const makeupIndex = draft.popupQueue.findIndex(popup => popupId(popup) === settlement.makeupPopupId);
      if (makeupIndex < 0) draft.popupQueue.push(ending);
      else draft.popupQueue.splice(makeupIndex, 0, ending);
    }
    if (settlement.makeup.length && !queued(draft.popupQueue, settlement.makeupPopupId)) {
      draft.popupQueue.push({
        id: settlement.makeupPopupId, popupId: settlement.makeupPopupId,
        type: 'makeup', settlementId: settlement.id
      });
    }
    // 极早期存档可能已确认结束说明、没有补发，却丢失最后一次关闭提交。
    // 恢复结束说明供玩家完成结算，而不是在页面加载时静默清理资产。
    if (settlement.endingAcknowledged && !settlement.makeup.length &&
        !queued(draft.popupQueue, settlement.endingPopupId)) {
      settlement.endingAcknowledged = false;
      draft.popupQueue.push({
        id: settlement.endingPopupId, popupId: settlement.endingPopupId,
        type: 'ending', settlementId: settlement.id
      });
    }
    return { ok: true, replay: true, settlementId: settlement.id, makeup: settlement.makeup };
  }
  if (!availability.expired) return {
    ok: false, reason: 'NOT_EXPIRED', message: '活动尚未正式截止'
  };
  if (availability.insideSession) return {
    ok: false, reason: 'SESSION_ACTIVE', message: '到期会话仍可继续；离开扭蛋机后结算'
  };
  if (draft?.periodId && draft.periodId !== config?.activity?.periodId) return {
    ok: false, reason: 'PERIOD_MISMATCH', message: '活动期次与存档不一致'
  };
  if (draft?.popupQueue != null && !Array.isArray(draft.popupQueue)) return {
    ok: false, reason: 'INVALID_SAVE', message: '弹窗队列存档格式无效'
  };

  const outstanding = [];
  for (const node of nodesOf(config)) {
    const status = getNodeStatus(draft, config, node.nodeId);
    if (!status?.reached || status.claimed) continue;
    const rewardIds = snapshotRewardIds(node);
    if (!rewardIds?.length) return {
      ok: false, reason: 'INVALID_CONFIG', message: `节点 ${node.nodeId} 的奖励配置无效`
    };
    outstanding.push({
      nodeId: node.nodeId, nodeType: node.nodeType, label: node.label,
      rewardIds, sortOrder: node.sortOrder, target: node.target,
      status: 'PENDING'
    });
  }
  outstanding.sort((a, b) =>
    (a.nodeType === 'POINT' ? 0 : a.nodeType === 'QUALITY' ? 1 : 2) -
    (b.nodeType === 'POINT' ? 0 : b.nodeType === 'QUALITY' ? 1 : 2) ||
    (a.nodeType === 'POINT' ? a.target - b.target : 0) ||
    a.sortOrder - b.sortOrder);

  const id = settlementKey(draft, config);
  const endPopupId = `${id}:ending`;
  const makeupPopupId = `${id}:makeup`;
  const queue = Array.isArray(draft.popupQueue) ? draft.popupQueue : [];
  draft.settlement = {
    id, periodId: periodId(draft, config), status: 'PENDING_MAKEUP',
    startedAt: availability.now, endingPopupId: endPopupId,
    makeupPopupId, endingAcknowledged: false,
    collectedCount: ownedCount(draft, config),
    totalToyCount: toysOf(config).length,
    makeup: outstanding,
    // 冻结结算前数字；资产在确认有效补发后才清理。
    closingTickets: Number(draft.tickets) || 0,
    closingTotalPoints: Number(draft.totalPoints) || 0,
    closingAvailablePoints: Number(draft.availablePoints) || 0
  };
  draft.popupQueue = [...queue];
  if (!queued(draft.popupQueue, endPopupId)) draft.popupQueue.push({
    id: endPopupId, popupId: endPopupId, type: 'ending', settlementId: id
  });
  if (outstanding.length && !queued(draft.popupQueue, makeupPopupId)) {
    draft.popupQueue.push({
      id: makeupPopupId, popupId: makeupPopupId, type: 'makeup', settlementId: id
    });
  }
  return {
    ok: true, settlementId: id, collectedCount: draft.settlement.collectedCount,
    totalToyCount: draft.settlement.totalToyCount,
    makeup: outstanding.map(item => ({ ...item, rewardIds: [...item.rewardIds] })),
    popupIds: outstanding.length ? [endPopupId, makeupPopupId] : [endPopupId]
  };
}

/** R06/R09：结束弹窗关闭后，合并补发已达成而未到账的节点。 */
export function claimMakeup(draft, settlementId, config) {
  const settlement = draft?.settlement;
  if (!settlement || settlement.id !== settlementId ||
      settlement.status !== 'PENDING_MAKEUP') return {
    ok: false, reason: 'INVALID_SETTLEMENT', message: '没有可领取的本期补发'
  };
  if (!getSessionAvailability(draft, config).timeTrusted) return {
    ok: false, reason: 'TIME_UNCONFIRMED', message: '服务器时间尚未确认'
  };
  if (Array.isArray(draft.popupQueue) &&
      queued(draft.popupQueue, settlement.endingPopupId) &&
      settlement.endingAcknowledged !== true) return {
    ok: false, reason: 'ENDING_FIRST', message: '请先关闭活动结束说明'
  };
  if (!Array.isArray(settlement.makeup)) return {
    ok: false, reason: 'INVALID_SAVE', message: '补发清单存档格式无效'
  };
  const pending = settlement.makeup.filter(item => item.status === 'PENDING');
  if (!pending.length) return {
    ok: false, reason: 'ALREADY_CLAIMED', message: '补发奖励已经领取'
  };

  // 在局部副本中完成整组发奖；任一项失败都不污染调用方事务副本。
  const staged = {
    ...draft,
    nodeClaims: Array.isArray(draft.nodeClaims) ? [...draft.nodeClaims] :
      draft.nodeClaims && typeof draft.nodeClaims === 'object' ?
        { ...draft.nodeClaims } : draft.nodeClaims,
    rewardLedger: Array.isArray(draft.rewardLedger) ? [...draft.rewardLedger] :
      draft.rewardLedger
  };
  const results = [];
  for (const item of pending) {
    const node = nodesOf(config).find(row => row.nodeId === item.nodeId);
    if (!node || !getNodeStatus(staged, config, item.nodeId)?.reached ||
        JSON.stringify(snapshotRewardIds(node)) !== JSON.stringify(item.rewardIds)) {
      return { ok: false, reason: 'INCONSISTENT_SAVE',
        message: `补发节点 ${item.nodeId} 与已确认结算清单不符` };
    }
    const result = claimNode(staged, item.nodeId, config);
    if (!result.ok) return { ok: false, reason: result.reason,
      message: result.message, nodeId: item.nodeId };
    results.push(result);
  }
  draft.nodeClaims = staged.nodeClaims;
  draft.rewardLedger = staged.rewardLedger;
  settlement.makeup = settlement.makeup.map(item => item.status === 'PENDING' ?
    { ...item, status: 'CLAIMED' } : item);
  return {
    ok: true, settlementId, claims: results,
    ledgerEntries: results.flatMap(result => result.ledgerEntries)
  };
}

/**
 * R09/R10：弹窗队列的关闭由 Store/Input 处理。本函数要求结束说明已关闭、
 * 有补发时补发已领取且弹窗已关闭，然后一次性清理活动资产。保留账本、
 * 本期结算摘要和事务去重记录；再次调用不得二次补发或清理。
 */
export function finalizeSettlement(draft, config) {
  const settlement = draft?.settlement;
  if (!settlement) return {
    ok: false, reason: 'NOT_STARTED', message: '尚未开始结束结算'
  };
  if (settlement.status === 'FINALIZED') return {
    ok: false, reason: 'ALREADY_SETTLED', message: '本期已经结算',
    settlementId: settlement.id
  };
  if (settlement.status !== 'PENDING_MAKEUP') return {
    ok: false, reason: 'INVALID_SETTLEMENT', message: '结算状态无效'
  };
  const availability = getSessionAvailability(draft, config);
  if (!availability.timeTrusted) return {
    ok: false, reason: 'TIME_UNCONFIRMED', message: '服务器时间尚未确认，不清理资产'
  };
  if (!availability.expired || availability.insideSession) return {
    ok: false, reason: 'SESSION_ACTIVE', message: '活动会话尚未结束'
  };
  if (!Array.isArray(draft.popupQueue) ||
      queued(draft.popupQueue, settlement.endingPopupId) ||
      settlement.endingAcknowledged !== true) return {
    ok: false, reason: 'ENDING_FIRST', message: '请先关闭活动结束说明'
  };
  if (!Array.isArray(settlement.makeup) ||
      settlement.makeup.some(item => item.status !== 'CLAIMED')) return {
    ok: false, reason: 'MAKEUP_PENDING', message: '请先领取已达成奖励的补发'
  };
  if (queued(draft.popupQueue, settlement.makeupPopupId)) return {
    ok: false, reason: 'MAKEUP_POPUP_OPEN', message: '请先关闭补发弹窗'
  };

  const summary = {
    periodId: settlement.periodId,
    collectedCount: settlement.collectedCount,
    totalToyCount: settlement.totalToyCount,
    closingTickets: settlement.closingTickets,
    closingTotalPoints: settlement.closingTotalPoints,
    closingAvailablePoints: settlement.closingAvailablePoints,
    makeupNodeIds: settlement.makeup.map(item => item.nodeId),
    makeupRewardIds: settlement.makeup.flatMap(item => item.rewardIds)
  };
  draft.tickets = 0;
  draft.totalPoints = 0;
  draft.availablePoints = 0;
  draft.ownedToyIds = [];
  draft.newToyIds = [];
  draft.nodeClaims = {};
  draft.shopCounts = {};
  draft.sequenceResults = {};
  // R09：实际抽取使用 cursor 与 sequenceGroup；结束时清理真实读取位置，
  // 而非仅清理旧字段。结算摘要、外发账本和事务去重记录仍保留。
  draft.cursor = null;
  draft.sequenceCursor = null;
  draft.sequenceGroup = null;
  draft.selectedSequenceGroup = null;
  draft.roomId = null;
  draft.readIndex = null;
  draft.currentRoomId = null;
  draft.currentIndex = null;
  draft.settlement = {
    ...settlement, status: 'FINALIZED', finalized: true,
    finalizedAt: availability.now, summary
  };
  // confirmedTransactions、processedEventIds 和 rewardLedger 保留为去重凭据及
  // 模拟主游戏到账／待领奖记录；不能因为清理活动进度而再次发放旧交易。
  return { ok: true, settlementId: settlement.id, summary };
}
