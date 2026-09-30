import { grantRewards } from './rewards.js';
import { getSessionAvailability } from './settlement.js';

// R07/R09/R10：本模块只计算事务内 draft；持久化、弹窗与反馈由 Store 负责。
const shopRows = config => config?.shop || config?.tables?.GachaShop || [];
const toyRows = config => config?.toys || config?.tables?.GachaToy || [];
const rewardRows = config => config?.rewards || config?.tables?.RewardCatalog || [];
const nodeRows = config => config?.nodes || config?.tables?.ProgressNodes || [];

function owned(state, id) {
  const ids = state?.ownedToyIds;
  if (ids instanceof Set) return ids.has(id);
  if (Array.isArray(ids)) return ids.includes(id);
  return Boolean(ids && typeof ids === 'object' && ids[id]);
}

function collectionComplete(state, config) {
  const toys = toyRows(config);
  const completeNode = nodeRows(config).find(node => node.nodeType === 'COMPLETE');
  if (!toys.length || !completeNode || !Number.isInteger(completeNode.target)) return false;
  return toys.filter(toy => owned(state, toy.toyId)).length >= completeNode.target;
}

function usedCount(state, itemId) {
  const counts = state?.shopCounts;
  if (counts == null) return 0;
  if (!counts || typeof counts !== 'object' || Array.isArray(counts)) return NaN;
  const value = counts[itemId] ?? 0;
  return Number.isInteger(value) && value >= 0 ? value : NaN;
}

function savedTransaction(state, id) {
  const records = state?.confirmedTransactions;
  if (Array.isArray(records)) {
    return records.find(record => record && typeof record === 'object' &&
      (record.transactionId === id || record.id === id));
  }
  return records && typeof records === 'object' ? records[id] : undefined;
}

function sessionReason(state) {
  if (state?.settlement?.finalized || state?.settlement?.started ||
      state?.settlement?.status === 'FINALIZED' || state?.settlement?.status === 'STARTED' ||
      state?.screen === 'ending' || state?.screen === 'makeup') {
    return { reason: 'SETTLED', message: '本期活动正在结算或已结束' };
  }
  if (state?.activitySession === false || state?.sessionActive === false ||
      state?.activitySession?.active === false ||
      state?.activitySession?.status === 'CLOSED' ||
      state?.screen === 'entry' || state?.screen === 'cover') {
    return { reason: 'NO_ACTIVE_SESSION', message: '请先进入本期扭蛋机' };
  }
  // R07/R09：开放前不能兑换；正式截止后已在活动内的会话仍可兑换。
  return null;
}

function unavailable(state, config) {
  if (state?.readOnly === true || state?.persistenceStatus === 'READ_ONLY' ||
      state?.saveStatus === 'READ_ONLY' || state?.saveError) {
    return { reason: 'READ_ONLY', message: config?.copyById?.SAVE_ERROR || '活动存档暂不可用' };
  }
  const clock = state?.simulatedServer || state?.serverClock || state?.clock;
  const trusted = state?.timeTrusted ?? clock?.timeTrusted ?? clock?.trusted ??
    config?.activity?.timeTrusted;
  if (trusted !== true) {
    return { reason: 'TIME_UNKNOWN', message: config?.copyById?.TIME_UNKNOWN || '服务器时间尚未确认' };
  }
  if (state?.periodId && state.periodId !== config?.activity?.periodId) {
    return { reason: 'WRONG_PERIOD', message: '活动期次不匹配' };
  }
  const availability = getSessionAvailability(state, config);
  if (!availability.canOperate) return {
    reason: availability.reason || 'NO_ACTIVE_SESSION',
    message: availability.reason === 'NOT_STARTED' ? '活动尚未开始，不可兑换' : '当前活动会话不可兑换'
  };
  if (state?.processing === true || state?.busy === true ||
      state?.phase === 'DRAWING' || state?.phase === 'EXCHANGING') {
    return { reason: 'BUSY', message: '正在处理上一笔操作，请稍候' };
  }
  return sessionReason(state);
}

/** R07：商店始终允许预览。锁定、售罄和积分不足分别给出原因。 */
export function getShopItemStatus(state, itemId, config) {
  const item = shopRows(config).find(row => row.id === itemId);
  if (!item) {
    return { itemId, status: 'INVALID', canExchange: false, reason: 'ITEM_NOT_FOUND', message: '商品不存在' };
  }
  const reward = rewardRows(config).find(row => row.rewardId === item.rewardId);
  const count = usedCount(state, itemId);
  const balance = state?.availablePoints;
  const limit = item.exchangeLimit;
  const remaining = limit === -1 ? null : Number.isInteger(limit) ? Math.max(0, limit - count) : null;
  const base = {
    itemId, item, reward, price: item.pointPrice, exchangeLimit: limit,
    exchanged: count, remaining, availablePoints: balance,
    unlocked: collectionComplete(state, config), canExchange: false
  };
  const fail = (status, reason, message) => ({ ...base, status, reason, message });
  if (!reward || !Number.isInteger(item.pointPrice) || item.pointPrice <= 0 ||
      !(limit === -1 || Number.isInteger(limit) && limit > 0)) {
    return fail('INVALID', 'INVALID_CONFIG', '商品配置无效');
  }
  if (!Number.isInteger(count) || !Number.isInteger(balance) || balance < 0 ||
      (limit !== -1 && count > limit)) {
    return fail('UNAVAILABLE', 'INVALID_SAVE', '商店存档数据无效');
  }
  const blocked = unavailable(state, config);
  if (blocked) return fail('UNAVAILABLE', blocked.reason, blocked.message);
  if (!base.unlocked) {
    return fail('LOCKED', 'SHOP_LOCKED', config?.copyById?.SHOP_LOCK || '需要集齐全部收藏解锁兑换商城');
  }
  if (limit !== -1 && count >= limit) return fail('SOLD_OUT', 'SOLD_OUT', '已售罄');
  if (balance < item.pointPrice) {
    return fail('INSUFFICIENT_POINTS', 'POINT_LOW', config?.copyById?.POINT_LOW || '积分不足，请继续扭蛋获取');
  }
  return { ...base, status: 'AVAILABLE', reason: null, message: '', canExchange: true };
}

/**
 * R07/R10：兑换确认时重查全部条件。只改事务草稿的可用积分、商品次数、
 * 模拟奖励账本及事务记录；不碰累计积分、收藏或奖励序列。
 * 调用方必须先持久化成功，再显示已兑换和到账反馈。
 */
export function evaluateExchange(draft, itemId, transactionId, config) {
  if (typeof transactionId !== 'string' || !transactionId.trim()) {
    return { ok: false, reason: 'INVALID_TRANSACTION_ID', message: '兑换事务ID不能为空' };
  }
  const previous = savedTransaction(draft, transactionId);
  if (previous) {
    return {
      ok: false, replay: true, reason: 'ALREADY_EXCHANGED',
      message: '该笔兑换已确认，未重复扣分或发奖', transactionId,
      transaction: previous
    };
  }
  const status = getShopItemStatus(draft, itemId, config);
  if (!status.canExchange) {
    return { ok: false, itemId, transactionId, reason: status.reason, message: status.message, status: status.status };
  }
  if (draft.shopCounts != null &&
      (typeof draft.shopCounts !== 'object' || Array.isArray(draft.shopCounts)) ||
      draft.confirmedTransactions != null &&
      (typeof draft.confirmedTransactions !== 'object' || Array.isArray(draft.confirmedTransactions)) ||
      draft.rewardLedger != null && !Array.isArray(draft.rewardLedger)) {
    return { ok: false, reason: 'INVALID_SAVE', message: '兑换存档格式无效', itemId, transactionId };
  }

  const periodId = draft.periodId || config?.activity?.periodId;
  const instance = draft.testInstanceId ?? draft.testInstance;
  const sourceId = `${periodId}${instance == null ? '' : `:${String(instance)}`}:exchange:${transactionId}`;
  const ledgerId = `${sourceId}:0`;
  if (draft.rewardLedger?.some(entry => entry.ledgerId === ledgerId)) {
    return { ok: false, reason: 'INCONSISTENT_SAVE', message: '奖励账本已有此笔兑换，请检查事务记录', itemId, transactionId };
  }

  let ledgerEntries;
  try {
    ledgerEntries = grantRewards(draft, [status.item.rewardId], sourceId, config);
  } catch (error) {
    return { ok: false, reason: 'GRANT_FAILED', message: error.message, itemId, transactionId };
  }
  if (ledgerEntries.length !== 1) {
    return { ok: false, reason: 'INCONSISTENT_SAVE', message: '奖励未能生成唯一到账记录', itemId, transactionId };
  }

  draft.availablePoints -= status.price;
  if (!draft.shopCounts) draft.shopCounts = {};
  draft.shopCounts[itemId] = status.exchanged + 1;
  if (!draft.confirmedTransactions) draft.confirmedTransactions = {};
  const transaction = {
    transactionId, type: 'EXCHANGE', periodId, itemId,
    sourceId, rewardId: status.item.rewardId, pointCost: status.price,
    exchanged: draft.shopCounts[itemId], ledgerIds: ledgerEntries.map(entry => entry.ledgerId)
  };
  draft.confirmedTransactions[transactionId] = transaction;
  return {
    ok: true, itemId, transactionId, transaction, sourceId,
    pointCost: status.price, availablePoints: draft.availablePoints,
    remaining: status.exchangeLimit === -1 ? null : status.exchangeLimit - draft.shopCounts[itemId],
    reward: status.reward, ledgerEntries
  };
}
