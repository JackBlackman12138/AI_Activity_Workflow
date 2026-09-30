import { getNodeStatus } from './progress.js';
import { stageProgressEvents, flushProgressEvents } from './telemetry.js';
import { claimNode } from './rewards.js';
import { evaluateSupply } from './supply.js';
import { evaluateDraw } from './draw.js';
import { evaluateExchange } from './shop.js';
import { getSessionAvailability, beginSettlement, claimMakeup, finalizeSettlement } from './settlement.js';

// R01–R12：所有业务操作先在独立副本中结算并持久化，再通知视图和反馈。
// 此处的语义事件仅进入本地日志；SDK 节奏事件由 progress.js 统一发送。
const clone = value => JSON.parse(JSON.stringify(value));
const deny = (reason, message) => ({ ok: false, reason, message });
const popupId = popup => typeof popup === 'string' ? popup : popup?.popupId || popup?.id;
const insideScreens = new Set(['machine', 'drawResult', 'collection', 'claim', 'shop', 'exchangeConfirm', 'info', 'rulesGuide', 'debug']);

function actionName(action) {
  return String(action?.type || action?.action || '').replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_').toUpperCase();
}

function event(draft, kind, details = {}) {
  draft.eventLog ||= [];
  draft.eventSerial = (Number(draft.eventSerial) || 0) + 1;
  const entry = {
    eventId: `${draft.periodId}:${draft.testInstanceId}:${draft.eventSerial}`,
    periodId: draft.periodId,
    kind,
    ...details
  };
  draft.eventLog.push(entry);
  return entry;
}

function enqueue(draft, popup) {
  draft.popupQueue ||= [];
  if (!draft.popupQueue.some(item => popupId(item) === popupId(popup))) draft.popupQueue.push(popup);
}

function removePopup(draft, id) {
  const index = draft.popupQueue.findIndex(item => popupId(item) === id);
  if (index < 0) return false;
  draft.popupQueue.splice(index, 1);
  return true;
}

function clock(draft, config, changes = {}) {
  const now = changes.serverTime ?? changes.serverNow ?? changes.now ?? draft.serverTime;
  const trusted = changes.timeTrusted ?? draft.timeTrusted;
  const switchState = changes.switchState ?? draft.switchState;
  draft.serverTime = now;
  draft.serverNow = now;
  draft.simulatedServerTime = now;
  draft.timeTrusted = trusted;
  draft.switchState = switchState;
  draft.simulatedServer = { now, timeTrusted: trusted };
  draft.debug = {
    ...(draft.debug || {}), serverNow: now, serverTime: now,
    timeTrusted: trusted, switchState,
    level: draft.level, completedWave: draft.completedWave,
    qualified: draft.qualified, mutexClear: draft.mutualExclusionClear,
    resourcesReady: draft.resourcesReady
  };
}

function fresh(config, testInstanceId, existingLedger = []) {
  const activity = config.activity;
  const layer = config.playerLayers[0];
  // 演示时钟从配置开放时间开始；不读取设备时间，也不自动产生外部券。
  const save = {
    periodId: activity.periodId,
    testInstanceId,
    initialized: false,
    screen: 'entry', previousScreen: null, activitySession: false,
    coverSeen: false, guideSeen: false, guideIndex: 0,
    shopUnlockSeen: false, selectedTierId: [...config.drawTiers].sort((a, b) => a.sortOrder - b.sortOrder)[0]?.tierId,
    layerId: layer?.layerId, sequenceGroup: layer?.sequenceGroup,
    cursor: { roomId: layer?.initialRoomId, index: layer?.initialIndex },
    tickets: 0, ownedToyIds: [], newToyIds: [], totalPoints: 0,
    availablePoints: 0, nodeClaims: {}, shopCounts: {}, supplyUsage: {},
    processedEventIds: {}, confirmedTransactions: {}, sequenceResults: {},
    rewardLedger: clone(existingLedger), eventLog: [], eventSerial: 0,
    popupQueue: [], settlement: null, sessionCompleteTracked: false,
    confirmationSerial: 0, progressOutbox: [],
    level: activity.minLevel, completedWave: activity.requiredWave,
    qualified: true, mutualExclusionClear: true, resourcesReady: true
  };
  clock(save, config, {
    serverTime: activity.startAt, timeTrusted: activity.timeTrusted,
    switchState: activity.switchState
  });
  return save;
}

function repair(saved, config) {
  // 仅补充旧版缺失的表现字段，不重置已经保存的业务值或已确认事务。
  const value = clone(saved);
  value.popupQueue ??= [];
  value.eventLog ??= [];
  value.eventSerial ??= value.eventLog.length;
  value.rewardLedger ??= [];
  value.processedEventIds ??= {};
  value.confirmedTransactions ??= {};
  value.sequenceResults ??= {};
  value.nodeClaims ??= {};
  value.shopCounts ??= {};
  value.ownedToyIds ??= [];
  value.newToyIds ??= [];
  value.supplyUsage ??= {};
  value.progressOutbox ??= [];
  value.confirmationSerial ??= 0;
  value.testInstanceId ??= 'initial';
  value.screen ??= 'entry';
  value.activitySession ??= insideScreens.has(value.screen);
  value.guideIndex ??= 0;
  value.shopUnlockSeen ??= false;
  value.selectedTierId ??= config.drawTiers[0]?.tierId;
  value.layerId ??= config.playerLayers[0]?.layerId;
  // R09：FINALIZED 的 null 是已清理资产的明确记录，绝不是缺省配置。
  // 修复旧版存档时不得重新生成已结束期次的序列组或游标。
  if (value.settlement?.status !== 'FINALIZED' && value.settlement?.finalized !== true) {
    value.sequenceGroup ??= config.playerLayers.find(row => row.layerId === value.layerId)?.sequenceGroup;
    value.cursor ??= {
      roomId: config.playerLayers.find(row => row.layerId === value.layerId)?.initialRoomId,
      index: config.playerLayers.find(row => row.layerId === value.layerId)?.initialIndex
    };
  }
  value.level ??= config.activity.minLevel;
  value.completedWave ??= config.activity.requiredWave;
  value.qualified ??= true;
  value.mutualExclusionClear ??= true;
  value.resourcesReady ??= true;
  value.serverTime ??= value.debug?.serverTime ?? config.activity.startAt;
  value.timeTrusted ??= value.debug?.timeTrusted ?? config.activity.timeTrusted;
  value.switchState ??= value.debug?.switchState ?? config.activity.switchState;
  clock(value, config);
  return value;
}

function entryReason(state, config) {
  const availability = getSessionAvailability(state, config);
  if (!availability.timeTrusted) return deny('TIME_UNCONFIRMED', config.copyById?.TIME_UNKNOWN || '服务器时间尚未确认');
  if (state.settlement?.status === 'FINALIZED') return deny('ALREADY_SETTLED', '本期活动已经结算');
  if (state.settlement?.status === 'PENDING_MAKEUP') return deny('SETTLING', '请先完成本期结束结算');
  if (state.level < config.activity.minLevel) return deny('LEVEL_REQUIRED', `活动入口当前不可用：需要达到${config.activity.minLevel}级`);
  if (state.completedWave < config.activity.requiredWave) return deny('WAVE_REQUIRED', `活动入口当前不可用：需要完成第${config.activity.requiredWave}波订单`);
  if (!state.qualified) return deny('NOT_QUALIFIED', '活动入口当前不可用：活动资格不满足');
  if (!state.mutualExclusionClear) return deny('ACTIVITY_CONFLICT', '活动入口当前不可用：存在互斥活动');
  if (!state.resourcesReady) return deny('RESOURCE_UNAVAILABLE', '活动入口当前不可用：活动资源尚未就绪');
  if (state.switchState === 'SOFT_OFF' && !state.initialized) return deny('SOFT_OFF', '活动入口当前不可用：软关后不再开启本期活动');
  if (!availability.canEnter) return deny(availability.reason || 'UNAVAILABLE', `活动入口当前不可用：${availability.reason || '开放条件未满足'}`);
  return null;
}

function mutatingAllowed(state, config) {
  if (!state.timeTrusted || !Number.isFinite(Date.parse(state.serverTime))) {
    return deny('TIME_UNCONFIRMED', config.copyById?.TIME_UNKNOWN || '服务器时间尚未确认');
  }
  if (!state.activitySession || state.settlement) return deny('NO_ACTIVE_SESSION', '当前不在可操作的扭蛋活动会话内');
  // R07/R09：开放前不允许手动领奖或兑换；正式截止后已在活动内的
  // 会话仍可操作。与抽取共用同一模拟服务器时间，不读取设备时钟。
  const availability = getSessionAvailability(state, config);
  if (!availability.canOperate) return deny(availability.reason || 'UNAVAILABLE',
    availability.reason === 'NOT_STARTED' ? '活动尚未开始，不可领奖或兑换' : '当前活动会话不可操作');
  return null;
}

function countOwned(state, config) {
  const ids = new Set(Array.isArray(state.ownedToyIds) ? state.ownedToyIds : Object.keys(state.ownedToyIds || {}).filter(id => state.ownedToyIds[id]));
  return config.toys.filter(toy => ids.has(toy.toyId)).length;
}

function queueDraw(draft, result, config) {
  const base = result.transactionId;
  enqueue(draft, {
    id: `${base}:results`, popupId: `${base}:results`, type: 'drawResult',
    batchId: result.batchId, transactionId: base, results: result.results,
    pointsGained: result.pointsGained, cost: result.cost
  });
  for (const reward of result.automaticRewards) enqueue(draft, {
    id: `${base}:node:${reward.nodeId}`, popupId: `${base}:node:${reward.nodeId}`,
    type: 'claim', source: 'AUTO', nodeId: reward.nodeId,
    label: reward.label, ledgerEntries: reward.ledgerEntries
  });
  const complete = config.nodes.find(node => node.nodeType === 'COMPLETE');
  if (complete && result.automaticRewards.some(item => item.nodeId === complete.nodeId)) {
    enqueue(draft, {
      id: `${base}:shop-unlock`, popupId: `${base}:shop-unlock`,
      type: 'shopUnlock', text: config.copyById?.SHOP_UNLOCK || ''
    });
  }
}

function settleIfOutside(draft, config) {
  if (!draft.initialized || draft.activitySession || draft.settlement?.status === 'FINALIZED') return null;
  const availability = getSessionAvailability(draft, config);
  if (!availability.timeTrusted || !availability.expired) return null;
  const outcome = beginSettlement(draft, config);
  if (outcome.ok && !outcome.replay) event(draft, 'settlement_started', {
    settlementId: outcome.settlementId, makeupNodeIds: outcome.makeup.map(item => item.nodeId)
  });
  return outcome;
}

/** 创建订阅式活动状态库。getState 返回副本，禁止视图直接改变已保存状态。 */
export function createStore({ sdk, config, persistence }) {
  if (!config?.activity || !persistence) throw new Error('活动状态初始化缺少配置或存档适配器');
  const listeners = new Set();
  let save = persistence.load();
  let state;
  let readOnly = persistence.status() !== 'READY';
  let readOnlyView = null;
  // R10/R12：只读视图是内存中的浏览位置，不提交存档，也不恢复到期会话的业务操作。
  function makeReadOnlyView(saved) {
    const view = clone(saved);
    view.popupQueue = [];
    if (view.screen !== 'debug') {
      view.screen = view.initialized && !view.settlement ? 'machine' : 'entry';
    }
    return view;
  }
  if (save && save.periodId !== config.activity.periodId) {
    readOnly = true;
    state = repair(save, config);
  } else if (save) {
    state = repair(save, config);
    // R09/R10：刷新本身就是离开到期会话。时间不可信时也先持久化
    // 离开事实，只延后结算；恢复可信时间后不得重新取得停留资格。
    const availability = getSessionAvailability(state, config);
    if (state.activitySession && (availability.expired || !availability.timeTrusted)) {
      const draft = clone(state);
      draft.activitySession = false;
      draft.screen = 'entry';
      if (availability.timeTrusted) settleIfOutside(draft, config);
      if (!readOnly && persistence.commit(draft).ok) state = draft;
      else readOnly = true;
    } else {
      // R09/R10：恢复已开始但尚未完成的结算。队列重建必须先落盘，
      // 刷新本身不重复发奖，也不把到期会话重新设为活动内。
      if (!readOnly && state.settlement?.status === 'PENDING_MAKEUP' && !state.activitySession) {
        settleIfOutside(state, config);
      }
      if (!readOnly && JSON.stringify(state) !== JSON.stringify(save)) {
        if (!persistence.commit(state).ok) readOnly = true;
      }
    }
  } else {
    state = fresh(config, 'initial');
    if (!readOnly && !persistence.commit(state).ok) readOnly = true;
  }

  // R10/R11：恢复时只重试已提交但未确认上报的节奏事件；绝不重算业务奖励。
  if (!readOnly) {
    const flushed = flushProgressEvents(sdk, state, persistence);
    if (flushed.ok) state = flushed.state;
    else if (flushed.storageFailed) readOnly = true;
  }

  if (readOnly) readOnlyView = makeReadOnlyView(state);

  function publicState() {
    const result = clone(readOnlyView || state);
    result.readOnly = readOnly || persistence.status() !== 'READY';
    result.persistenceStatus = result.readOnly ? 'READ_ONLY' : 'READY';
    result.saveStatus = result.persistenceStatus;
    return result;
  }
  function notify() {
    const snapshot = publicState();
    for (const listener of [...listeners]) {
      try { listener(snapshot); } catch { /* 视图异常不撤销已提交事务 */ }
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
      return deny('SAVE_ERROR', config.copyById?.SAVE_ERROR || receipt.error || '活动存档暂不可用');
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
    const action = typeof input === 'string' ? { type: input } : input || {};
    const type = actionName(action);
    if (!type) return deny('INVALID_ACTION', '缺少操作类型');
    if (readOnly || persistence.status() !== 'READY') {
      readOnly = true;
      readOnlyView ||= makeReadOnlyView(state);
      const view = readOnlyView;
      // R12：只允许浏览存档副本；绝不调用 commit、领奖、供券或结算。
      if (['OPEN_SCREEN', 'NAVIGATE', 'SHOW_SCREEN'].includes(type)) {
        const next = action.screen ?? action.target;
        if (!['collection', 'shop', 'info', 'rulesGuide', 'debug', 'machine'].includes(next)) return deny('INVALID_SCREEN', '页面不存在');
        if (next !== 'debug' && !view.initialized) return deny('NO_SAVED_ACTIVITY', '尚无可查看的本期活动存档');
        view.previousScreen = view.screen;
        view.screen = next;
        notify();
        return { ok: true, readOnly: true, screen: next };
      }
      if (['CLOSE_SCREEN', 'BACK'].includes(type)) {
        view.screen = view.screen === 'debug' ? view.previousScreen || (view.initialized ? 'machine' : 'entry') :
          view.screen === 'machine' ? 'entry' : view.initialized ? 'machine' : 'entry';
        notify();
        return { ok: true, readOnly: true, screen: view.screen };
      }
      if (['ENTRY_OPEN', 'OPEN_ENTRY', 'ENTER', 'OPEN_ACTIVITY', 'READONLY_OPEN'].includes(type) &&
          view.initialized && !view.settlement) {
        view.screen = 'machine';
        notify();
        return { ok: true, readOnly: true, screen: view.screen };
      }
      if (['LEAVE_ACTIVITY', 'MACHINE_CLOSE', 'EXIT'].includes(type)) {
        view.screen = 'entry';
        notify();
        return { ok: true, readOnly: true, screen: 'entry' };
      }
      if (type === 'ENDING_SUMMARY_OPEN' && view.settlement?.status === 'FINALIZED' && view.settlement.summary) {
        view.screen = 'endingSummary';
        notify();
        return { ok: true, readOnly: true, screen: view.screen };
      }
      if (type === 'ENDING_SUMMARY_CLOSE' && view.screen === 'endingSummary') {
        view.screen = 'entry';
        notify();
        return { ok: true, readOnly: true, screen: view.screen };
      }
      return deny('SAVE_ERROR', config.copyById?.SAVE_ERROR || '活动存档暂不可用，当前只读');
    }
    if (type === 'DEBUG_READ_ONLY') {
      // Debug 仅模拟持久化故障后的界面，不修改或破坏浏览器存储。
      readOnly = true;
      readOnlyView = makeReadOnlyView(state);
      notify();
      return { ok: true, readOnly: true, screen: readOnlyView.screen };
    }
    const before = state;
    let draft = clone(state);
    let outcome = { ok: true, type };
    let kind = null;
    let detail = {};

    try {
      switch (type) {
        // R01/R08：首次进入初始化与封面显示属于同一个可持久化提交。
        case 'ENTRY_OPEN': case 'OPEN_ENTRY': case 'ENTER': case 'OPEN_ACTIVITY': {
          const blocked = entryReason(draft, config);
          if (blocked) return blocked;
          if (!draft.initialized) {
            const layer = config.playerLayers.find(row => row.layerId === draft.layerId) || config.playerLayers[0];
            draft.layerId = layer.layerId;
            draft.sequenceGroup = layer.sequenceGroup;
            draft.cursor = { roomId: layer.initialRoomId, index: layer.initialIndex };
            // R01/R02：入口前已确认的 Debug 供券保留；首次初始化只追加一次初始券。
            // 供券事件及余额已在同一存档中确认，不能以初始值覆盖它们。
            if (!Number.isSafeInteger(draft.tickets) || draft.tickets < 0 ||
                !Number.isSafeInteger(draft.tickets + config.activity.initialTickets)) {
              return deny('INVALID_BALANCE', '扭蛋券余额无效，未初始化活动');
            }
            draft.tickets += config.activity.initialTickets;
            draft.initialized = true;
            draft.initializedAt = draft.serverTime;
            event(draft, 'period_initialized', { layerId: layer.layerId, sequenceGroup: layer.sequenceGroup });
          }
          draft.activitySession = true;
          draft.screen = draft.coverSeen ? 'machine' : 'cover';
          if (!draft.coverSeen) enqueue(draft, { id: 'opening-cover', popupId: 'opening-cover', type: 'cover' });
          // R08：关闭过封面并非完成引导；下一次真正进入机台时仍展示首次引导。
          else if (!draft.guideSeen) enqueue(draft, {
            id: 'first-guide', popupId: 'first-guide', type: 'guide', index: draft.guideIndex
          });
          outcome = { ok: true, screen: draft.screen };
          kind = 'activity_entered';
          break;
        }
        case 'COVER_START': case 'START': case 'START_ACTIVITY': {
          if (draft.screen !== 'cover') return deny('NO_COVER', '开启封面当前未显示');
          draft.coverSeen = true;
          removePopup(draft, 'opening-cover');
          draft.screen = 'machine';
          if (!draft.guideSeen) enqueue(draft, { id: 'first-guide', popupId: 'first-guide', type: 'guide', index: draft.guideIndex });
          outcome = { ok: true, screen: 'machine' };
          break;
        }
        case 'GUIDE_NEXT': {
          if (!draft.popupQueue.some(item => popupId(item) === 'first-guide')) return deny('NO_GUIDE', '引导未显示');
          const steps = config.copy.filter(row => /^GUIDE_/.test(row.copyId)).length;
          draft.guideIndex = Math.min(draft.guideIndex + 1, steps);
          if (draft.guideIndex >= steps) {
            draft.guideSeen = true;
            removePopup(draft, 'first-guide');
          } else {
            const guide = draft.popupQueue.find(item => popupId(item) === 'first-guide');
            guide.index = draft.guideIndex;
          }
          outcome = { ok: true, guideIndex: draft.guideIndex, complete: draft.guideSeen };
          break;
        }
        case 'GUIDE_CLOSE': case 'SKIP_GUIDE': {
          removePopup(draft, 'first-guide');
          draft.guideSeen = true;
          outcome = { ok: true };
          break;
        }
        case 'SELECT_TIER': case 'SET_TIER': {
          const tierId = action.tierId ?? action.id;
          if (!config.drawTiers.some(row => row.tierId === tierId)) return deny('INVALID_TIER', '倍率不存在');
          draft.selectedTierId = tierId;
          outcome = { ok: true, tierId };
          break;
        }
        case 'DRAW': case 'DRAW_CONFIRM': {
          const blocked = mutatingAllowed(draft, config);
          if (blocked) return blocked;
          if (draft.popupQueue.length) return deny('POPUP_BUSY', '请先关闭当前弹窗');
          const batchId = action.batchId ?? action.transactionId ?? `${draft.periodId}:${draft.testInstanceId}:batch:${(draft.eventSerial || 0) + 1}`;
          outcome = evaluateDraw(draft, action.tierId ?? draft.selectedTierId, batchId, config);
          if (!outcome.ok) return outcome;
          queueDraw(draft, outcome, config);
          kind = 'draw_confirmed';
          detail = { batchId, cost: outcome.cost, reads: outcome.reads, pointsGained: outcome.pointsGained };
          for (const result of outcome.results) if (result.isNew) event(draft, 'toy_collected', { batchId, toyId: result.toyId });
          for (const reward of outcome.automaticRewards) {
            const node = config.nodes.find(row => row.nodeId === reward.nodeId);
            event(draft, node.eventName, { batchId, nodeId: reward.nodeId });
          }
          break;
        }
        case 'SUPPLY': case 'DEBUG_SUPPLY': case 'SUPPLY_EVENT': {
          const request = action.event || action;
          outcome = evaluateSupply(draft, {
            eventId: request.eventId, source: request.source, result: request.result
          }, config);
          if (!outcome.ok) {
            // R02/R11：拒绝与去重也写入本地事件日志；不写供券记录、不改变券余额。
            const rejected = outcome;
            const logged = commit(draft, before, { ok: true }, 'supply_rejected', {
              upstreamEventId: request.eventId, source: request.source,
              result: request.result, reason: rejected.reason,
              code: rejected.code, duplicate: rejected.duplicate === true,
              ticketsGranted: 0
            });
            return logged.ok ? rejected : logged;
          }
          kind = outcome.success ? 'supply_granted' : 'supply_no_reward';
          detail = { source: outcome.source, upstreamEventId: outcome.eventId,
            result: outcome.result, configuredTickets: outcome.configuredTickets,
            ticketsGranted: outcome.ticketsGranted, reason: outcome.reason };
          break;
        }
        case 'CLAIM_NODE': case 'QUALITY_CLAIM': {
          const blocked = mutatingAllowed(draft, config);
          if (blocked) return blocked;
          // R10：状态库自身执行页面与队列约束，不能靠 DOM 遮罩保护领奖顺序。
          if (draft.screen !== 'collection') return deny('COLLECTION_REQUIRED', '请在玩具收藏页领取品质奖励');
          if (draft.popupQueue?.length) return deny('POPUP_BUSY', '请先处理已确认结果及奖励弹窗');
          const nodeId = action.nodeId ?? action.id;
          const node = config.nodes.find(row => row.nodeId === nodeId);
          if (node?.nodeType !== 'QUALITY' || node.claimMode !== 'MANUAL') return deny('NOT_MANUAL', '此节点不支持手动领取');
          outcome = claimNode(draft, nodeId, config);
          if (!outcome.ok) return outcome;
          enqueue(draft, { id: `claim:${nodeId}`, popupId: `claim:${nodeId}`, type: 'claim',
            source: 'MANUAL', sourceId: outcome.sourceId,
            nodeId, label: node.label, ledgerEntries: outcome.ledgerEntries });
          kind = node.eventName; detail = { nodeId };
          break;
        }
        case 'EXCHANGE': case 'EXCHANGE_CONFIRM': {
          const blocked = mutatingAllowed(draft, config);
          if (blocked) return blocked;
          const itemId = action.itemId ?? action.id;
          // R07/R10：确认弹窗及其持久化事务 ID 是兑换的必要前置。
          // 空队列、其他商品、取消后的旧 ID 或伪造的新 ID 均不得调用兑换规则。
          const confirmation = draft.popupQueue?.[0];
          const transactionId = action.transactionId;
          if (!confirmation || confirmation.type !== 'exchangeConfirm' ||
              confirmation.itemId !== itemId ||
              typeof transactionId !== 'string' || !transactionId ||
              confirmation.transactionId !== transactionId) {
            return deny('CONFIRMATION_REQUIRED', '请先打开对应商品的兑换确认弹窗');
          }
          outcome = evaluateExchange(draft, itemId, transactionId, config);
          if (!outcome.ok) return outcome;
          removePopup(draft, `exchange:${itemId}`);
          enqueue(draft, { id: `exchange-result:${transactionId}`, popupId: `exchange-result:${transactionId}`,
            type: 'claim', source: 'EXCHANGE', itemId, transactionId,
            ledgerEntries: outcome.ledgerEntries });
          kind = 'exchange_confirmed'; detail = { itemId, transactionId, pointCost: outcome.pointCost };
          break;
        }
        case 'SHOP_CONFIRM': case 'EXCHANGE_PREVIEW': {
          const blocked = mutatingAllowed(draft, config);
          if (blocked) return blocked;
          if (draft.popupQueue?.length) return deny('POPUP_BUSY', '请先处理当前弹窗');
          const itemId = action.itemId ?? action.id;
          if (!config.shop.some(row => row.id === itemId)) return deny('ITEM_NOT_FOUND', '商品不存在');
          const serial = (Number(draft.confirmationSerial) || 0) + 1;
          draft.confirmationSerial = serial;
          const transactionId = `${draft.periodId}:${draft.testInstanceId}:exchange-confirm:${serial}`;
          enqueue(draft, { id: `exchange:${itemId}`, popupId: `exchange:${itemId}`,
            type: 'exchangeConfirm', itemId, transactionId });
          outcome = { ok: true, itemId, transactionId };
          break;
        }
        case 'ENDING_SUMMARY_OPEN': {
          const end = Date.parse(config.activity.endAt);
          const now = Date.parse(draft.serverTime);
          if (draft.settlement?.status !== 'FINALIZED' || !draft.settlement.summary ||
              draft.timeTrusted !== true || !Number.isFinite(now) ||
              now < end || now >= end + config.activity.settlementDays * 86400000) {
            return deny('SUMMARY_UNAVAILABLE', '当前不在本期结束结果展示期');
          }
          draft.screen = 'endingSummary';
          outcome = { ok: true, screen: 'endingSummary' };
          break;
        }
        case 'ENDING_SUMMARY_CLOSE': {
          if (draft.screen !== 'endingSummary') return deny('SUMMARY_UNAVAILABLE', '结束结果未打开');
          draft.screen = 'entry';
          outcome = { ok: true, screen: 'entry' };
          break;
        }
        case 'OPEN_SCREEN': case 'NAVIGATE': case 'SHOW_SCREEN': {
          const next = action.screen ?? action.target;
          if (!['collection', 'shop', 'info', 'rulesGuide', 'debug', 'machine'].includes(next)) return deny('INVALID_SCREEN', '页面不存在');
          // R02/R10：Debug 可从封面及二级弹层打开，但原弹窗和已确认奖励队列原样保留。
          // 其他导航仍不得越过队列。
          if (draft.popupQueue?.length && next !== 'debug') return deny('POPUP_BUSY', '请先处理已确认结果及奖励弹窗');
          if (next !== 'debug' && !draft.activitySession) return deny('NO_ACTIVE_SESSION', '请先进入活动');
          draft.previousScreen = draft.screen;
          draft.screen = next;
          if (next === 'shop' && getNodeStatus(draft, config,
            config.nodes.find(node => node.nodeType === 'COMPLETE')?.nodeId)?.reached) draft.shopUnlockSeen = true;
          outcome = { ok: true, screen: next };
          break;
        }
        case 'CLOSE_SCREEN': case 'BACK': {
          // R09/R10：玩家在 Debug 内确认截止时间后，结束弹窗会进入队列。
          // 此时允许关闭 Debug，让已排队的结束弹窗显示；其他页面仍不能越过弹窗队列。
          if (draft.popupQueue?.length && draft.screen !== 'debug') return deny('POPUP_BUSY', '请先处理已确认结果及奖励弹窗');
          if (draft.screen === 'collection') draft.newToyIds = [];
          if (draft.screen === 'cover') {
            draft.coverSeen = true;
            removePopup(draft, 'opening-cover');
            draft.activitySession = false;
            draft.screen = 'entry';
            settleIfOutside(draft, config);
          } else if (draft.screen === 'debug') {
            // Debug 中模拟重登可能已经结束会话；此时不能恢复旧收藏／商店页面。
            draft.screen = draft.activitySession ? draft.previousScreen || 'machine' : 'entry';
          } else if (draft.activitySession && draft.screen !== 'machine') {
            draft.screen = 'machine';
          } else {
            draft.activitySession = false;
            draft.screen = 'entry';
            settleIfOutside(draft, config);
          }
          outcome = { ok: true, screen: draft.screen };
          break;
        }
        case 'LEAVE_ACTIVITY': case 'MACHINE_CLOSE': case 'EXIT': {
          // R10：不能通过键盘焦点或集成层派发导航，清除已经确认的结果、
          // 自动阶段奖励和大奖。处理完队列后方可离开并排入结束弹窗。
          if (draft.popupQueue?.length) return deny('POPUP_BUSY', '请先收下已确认结果及奖励，再离开活动');
          draft.activitySession = false;
          draft.screen = 'entry';
          draft.newToyIds = [];
          draft.popupQueue = [];
          const settled = settleIfOutside(draft, config);
          outcome = { ok: true, screen: draft.screen, settlement: settled };
          break;
        }
        case 'POPUP_CLOSE': case 'DISMISS_POPUP': {
          const first = draft.popupQueue[0];
          const id = action.popupId ?? action.id ?? popupId(first);
          if (!first || id !== popupId(first)) return deny('POPUP_ORDER', '请先处理当前弹窗');
          if (first.type === 'makeup' && draft.settlement?.makeup?.some(item => item.status === 'PENDING')) {
            return deny('MAKEUP_PENDING', '请先领取补发奖励');
          }
          removePopup(draft, id);
          if (first.type === 'cover') {
            draft.coverSeen = true;
            draft.activitySession = false;
            draft.screen = 'entry';
            settleIfOutside(draft, config);
          }
          if (first.type === 'guide') draft.guideSeen = true;
          if (first.type === 'ending') draft.settlement.endingAcknowledged = true;
          if (first.type === 'makeup' || first.type === 'ending' && !draft.settlement?.makeup?.length) {
            const final = finalizeSettlement(draft, config);
            if (!final.ok) return final;
            event(draft, 'settlement_finalized', { settlementId: final.settlementId });
          }
          outcome = { ok: true, dismissed: id, nextPopup: draft.popupQueue[0] || null };
          break;
        }
        case 'CLAIM_MAKEUP': case 'MAKEUP_CLAIM': {
          if (draft.popupQueue[0]?.type !== 'makeup') return deny('MAKEUP_UNAVAILABLE', '补发弹窗尚未出现');
          outcome = claimMakeup(draft, action.settlementId ?? draft.settlement?.id, config);
          if (!outcome.ok) return outcome;
          for (const claim of outcome.claims) {
            const node = config.nodes.find(row => row.nodeId === claim.nodeId);
            event(draft, node.eventName, {
              nodeId: claim.nodeId, settlementId: outcome.settlementId, source: 'MAKEUP'
            });
          }
          kind = 'makeup_claimed';
          detail = { settlementId: outcome.settlementId, nodeIds: outcome.claims.map(row => row.nodeId) };
          break;
        }
        case 'DEBUG_SET': case 'SET_DEBUG': case 'DEBUG_UPDATE': {
          const changes = action.changes || action.values || action;
          for (const key of ['level', 'completedWave', 'qualified', 'mutualExclusionClear', 'resourcesReady']) {
            if (Object.prototype.hasOwnProperty.call(changes, key)) draft[key] = changes[key];
          }
          if (changes.layerId != null && changes.layerId !== draft.layerId) {
            if (draft.initialized) return deny('LAYER_LOCKED', '本期分层及序列已锁定；请重新试玩后调整');
            const layer = config.playerLayers.find(row => row.layerId === changes.layerId);
            if (!layer) return deny('INVALID_LAYER', '玩家分层不存在');
            draft.layerId = layer.layerId;
            draft.sequenceGroup = layer.sequenceGroup;
            draft.cursor = { roomId: layer.initialRoomId, index: layer.initialIndex };
          }
          if (changes.switchState != null && !['OPEN', 'SOFT_OFF', 'HARD_OFF'].includes(changes.switchState)) return deny('INVALID_SWITCH', '活动开关无效');
          const nextTime = changes.serverTime ?? changes.serverNow ?? changes.now;
          if (nextTime != null && !Number.isFinite(typeof nextTime === 'number' ? nextTime : Date.parse(nextTime))) {
            return deny('INVALID_TIME', '模拟服务器时间无效');
          }
          clock(draft, config, changes);
          const availability = getSessionAvailability(draft, config);
          if (draft.initialized && !draft.activitySession && availability.expired) settleIfOutside(draft, config);
          kind = 'debug_state_updated';
          detail = { timeTrusted: draft.timeTrusted, serverTime: draft.serverTime, switchState: draft.switchState };
          outcome = { ok: true, availability };
          break;
        }
        case 'SIMULATE_RELOGIN': case 'DEBUG_RELOGIN': {
          draft.activitySession = false;
          draft.screen = 'entry';
          draft.previousScreen = 'entry';
          // R09/R10：重登终止临时引导和确认操作，但保留已确认奖励与
          // 当前结算的结束、补发弹窗；不得使已开始的结算失去完成入口。
          draft.popupQueue = (draft.popupQueue || []).filter(popup => {
            if (popup.type === 'ending' || popup.type === 'makeup') {
              const settlement = draft.settlement;
              return settlement?.status === 'PENDING_MAKEUP' &&
                popup.settlementId === settlement.id &&
                popupId(popup) === (popup.type === 'ending'
                  ? settlement.endingPopupId : settlement.makeupPopupId);
            }
            if (popup.type === 'drawResult') {
              return Boolean(draft.confirmedTransactions?.[popup.transactionId]);
            }
            if (popup.type === 'shopUnlock') {
              const complete = config.nodes.find(node => node.nodeType === 'COMPLETE');
              return Boolean(complete && draft.nodeClaims?.[complete.nodeId]);
            }
            if (popup.type !== 'claim') return false;
            if (popup.source === 'MANUAL') {
              const claim = draft.nodeClaims?.[popup.nodeId];
              return Boolean(claim?.claimed === true && claim.sourceId === popup.sourceId &&
                popup.ledgerEntries?.length && popup.ledgerEntries.every(entry =>
                  entry.sourceId === popup.sourceId &&
                  draft.rewardLedger?.some(saved => saved.ledgerId === entry.ledgerId &&
                    saved.sourceId === popup.sourceId)));
            }
            if (popup.source === 'AUTO') {
              return Boolean(draft.nodeClaims?.[popup.nodeId] &&
                popup.ledgerEntries?.length && popup.ledgerEntries.every(entry =>
                  draft.rewardLedger?.some(saved => saved.ledgerId === entry.ledgerId)));
            }
            if (popup.source === 'EXCHANGE') {
              const transaction = draft.confirmedTransactions?.[popup.transactionId];
              return Boolean(transaction?.type === 'EXCHANGE' &&
                transaction.itemId === popup.itemId &&
                popup.ledgerEntries?.length && popup.ledgerEntries.every(entry =>
                  transaction.ledgerIds?.includes(entry.ledgerId) &&
                  draft.rewardLedger?.some(saved => saved.ledgerId === entry.ledgerId &&
                    saved.sourceId === transaction.sourceId)));
            }
            return false;
          });
          const settled = settleIfOutside(draft, config);
          kind = 'simulated_relogin';
          outcome = { ok: true, settlement: settled };
          break;
        }
        case 'RESET_TEST_INSTANCE': case 'REPLAY': case 'DEBUG_RESET': {
          // R10：显式测试操作；保留外发奖励账本，不借此领取奖励或改写配置。
          const serial = (Number(draft.testInstanceSerial) || 0) + 1;
          const previousLedger = draft.rewardLedger || [];
          draft = fresh(config, `test-${serial}`, previousLedger);
          draft.testInstanceSerial = serial;
          kind = 'test_instance_reset';
          outcome = { ok: true, testInstanceId: draft.testInstanceId };
          break;
        }
        default:
          return deny('UNKNOWN_ACTION', `未知活动操作：${type}`);
      }
      return commit(draft, before, outcome, kind, detail);
    } catch (error) {
      return deny('ACTION_FAILED', error instanceof Error ? error.message : String(error));
    }
  }

  return {
    getState: publicState,
    dispatch,
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('订阅者必须是函数');
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}
