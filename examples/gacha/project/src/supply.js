// R01、R02、R09–R11：仅处理玩家主动点击 Debug 后提交的外部供券模拟事件。
// 不读取设备当前时间，不执行上游订单或生成器逻辑；持久化和事件日志由 Store 负责。
const hasOwn = (value, key) => value != null && Object.prototype.hasOwnProperty.call(value, key);

function firstDefined(objects, keys) {
  for (const object of objects) {
    if (!object || typeof object !== 'object') continue;
    for (const key of keys) if (hasOwn(object, key) && object[key] !== undefined) return object[key];
  }
  return undefined;
}

function rejection(code, reason, event, extra = {}) {
  return {
    ok: false, accepted: false, success: false, code, reason,
    eventId: event?.eventId, source: event?.source, result: event?.result,
    ticketsGranted: 0, tickets: 0, ...extra
  };
}

function recorded(processed, eventId) {
  if (Array.isArray(processed)) {
    return processed.some(value => value === eventId || value?.eventId === eventId);
  }
  return processed != null && typeof processed === 'object' && hasOwn(processed, eventId);
}

function record(processed, eventId, detail) {
  if (Array.isArray(processed)) processed.push(eventId);
  else processed[eventId] = detail;
}

function decodeResult(source, value) {
  const name = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (source === 'ORDER_SETTLED') {
    if (['SUCCESS', 'SETTLED', 'ORDER_SUCCESS'].includes(name)) return 'SUCCESS';
    if (['FAIL', 'FAILED', 'ORDER_FAILED'].includes(name)) return 'FAILED';
  }
  if (source === 'GENERATOR_OUTPUT') {
    if (['HIT', 'SUCCESS_HIT', 'OUTPUT_HIT'].includes(name)) return 'HIT';
    if (['MISS', 'NO_HIT', 'SUCCESS_MISS', 'OUTPUT_MISS'].includes(name)) return 'MISS';
    if (['FAIL', 'FAILED', 'OUTPUT_FAILED', 'PRODUCTION_FAILED'].includes(name)) return 'OUTPUT_FAILED';
  }
  return null;
}

function simulatedTime(draft) {
  const raw = firstDefined(
    [draft?.debug, draft?.simulation, draft?.sim, draft?.server, draft],
    ['serverNow', 'serverTime', 'simulatedServerTime', 'simulatedNow', 'serverTimeMs', 'now']
  );
  if (raw === undefined || raw === null || raw === '') return NaN;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN;
  return typeof raw === 'string' ? Date.parse(raw) : NaN;
}

// 活动日按配置起始时间的时区与 dayCutHour 划分；日切只影响供券日上限。
function activityDay(timestamp, activity) {
  const match = String(activity.startAt).match(/([+-])(\d{2}):(\d{2})$/);
  const offset = match
    ? (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]))
    : 0;
  return Math.floor((timestamp + offset * 60_000 - activity.dayCutHour * 3_600_000) / 86_400_000);
}

function ruleUsage(draft, ruleId) {
  const entry = draft.supplyUsage?.[ruleId];
  if (!entry) return { period: 0, days: {} };
  return entry;
}

/**
 * event={eventId,source,result}。调用方须在持久化事务的 draft 上调用本函数；
 * 返回 ok=true 仅表示模拟事件已确认，success 表示实际发券。失败、未命中同样
 * 记录事件 ID，防止之后把同一上游事件重放为成功。资格或时间拒绝不占用 ID。
 */
export function evaluateSupply(draft, event, config) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
    return rejection('INVALID_STATE', '活动状态不可用，未发放扭蛋券', event);
  }
  if (!event || typeof event !== 'object' ||
      typeof event.eventId !== 'string' || !event.eventId.trim()) {
    return rejection('INVALID_EVENT_ID', '缺少有效的模拟事件ID，未发放扭蛋券', event);
  }
  const eventId = event.eventId.trim();
  const source = event.source;
  const result = decodeResult(source, event.result);
  if (!result) return rejection('INVALID_RESULT', '模拟来源或操作结果无效，未发放扭蛋券', event);
  if (recorded(draft.processedEventIds, eventId)) {
    const original = Array.isArray(draft.processedEventIds)
      ? draft.processedEventIds.find(value => value?.eventId === eventId)
      : draft.processedEventIds?.[eventId];
    return rejection('DUPLICATE_EVENT', '同一模拟事件ID已结算，不重复发券', event, {
      duplicate: true,
      originalResult: original && typeof original === 'object' ? { ...original } : null
    });
  }

  const activity = config?.activity;
  if (!activity || !Number.isFinite(Date.parse(activity.startAt)) ||
      !Number.isFinite(Date.parse(activity.endAt))) {
    return rejection('INVALID_CONFIG', '活动时间配置无效，未发放扭蛋券', event);
  }
  if (draft.periodId !== activity.periodId || draft.settlement?.finalized || draft.settled) {
    return rejection('INACTIVE_PERIOD', '本期活动未开启或已经结算，未发放扭蛋券', event);
  }
  const contexts = [draft.debug, draft.simulation, draft.sim, draft.server, draft];
  const trusted = firstDefined(contexts, ['timeTrusted', 'serverTimeTrusted']);
  if ((trusted === undefined ? activity.timeTrusted : trusted) !== true) {
    return rejection('TIME_UNTRUSTED', '服务器时间尚未确认，未发放扭蛋券', event);
  }
  const now = simulatedTime(draft);
  if (!Number.isFinite(now)) {
    return rejection('TIME_UNAVAILABLE', '模拟服务器时间不可用，未发放扭蛋券', event);
  }
  if (now < Date.parse(activity.startAt)) {
    return rejection('NOT_STARTED', '活动尚未开始，未发放扭蛋券', event);
  }
  if (now >= Date.parse(activity.endAt)) {
    return rejection('SUPPLY_CLOSED', '活动已正式截止，外部供券已停止', event);
  }

  const switchState = firstDefined(contexts, ['switchState', 'activitySwitch']) ?? activity.switchState;
  const inside = draft.activitySession === true || draft.inActivity === true ||
    draft.sessionActive === true || ['machine', 'collection', 'shop'].includes(draft.screen);
  if (switchState === 'HARD_OFF' && !inside) {
    return rejection('HARD_OFF', '活动已硬关闭，未发放扭蛋券', event);
  }
  if (switchState === 'SOFT_OFF' && draft.initialized !== true && draft.initializedAt == null) {
    return rejection('SOFT_OFF', '活动已软关闭，未开启本期的玩家不能获得扭蛋券', event);
  }
  if (!['OPEN', 'SOFT_OFF', 'HARD_OFF'].includes(switchState)) {
    return rejection('INVALID_SWITCH', '活动开关状态无效，未发放扭蛋券', event);
  }

  const playerContexts = [draft.debug, draft.simulation, draft.sim, draft.eligibility, draft.qualification, draft.player, draft];
  const level = firstDefined(playerContexts, ['level', 'playerLevel']);
  const wave = firstDefined(playerContexts, ['completedWave', 'orderWave', 'wave', 'completedOrderWave']);
  if (!Number.isFinite(Number(level)) || Number(level) < activity.minLevel) {
    return rejection('LEVEL_REQUIRED', `需要达到${activity.minLevel}级，未发放扭蛋券`, event);
  }
  if (!Number.isFinite(Number(wave)) || Number(wave) < activity.requiredWave) {
    return rejection('WAVE_REQUIRED', `需要完成第${activity.requiredWave}波订单，未发放扭蛋券`, event);
  }
  for (const [keys, code, reason] of [
    [['qualified', 'eligible', 'hasQualification'], 'NOT_QUALIFIED', '活动资格不满足，未发放扭蛋券'],
    [['mutexClear', 'mutualExclusionClear', 'noConflict'], 'ACTIVITY_CONFLICT', '存在互斥活动，未发放扭蛋券'],
    [['resourcesReady', 'resourceReady'], 'RESOURCE_UNAVAILABLE', '活动资源尚未就绪，未发放扭蛋券']
  ]) {
    if (firstDefined(playerContexts, keys) === false) return rejection(code, reason, event);
  }

  const layerId = draft.layerId ?? draft.selectedLayerId ?? draft.playerLayerId;
  if (!layerId || !(config.playerLayers || []).some(layer => layer.layerId === layerId)) {
    return rejection('LAYER_UNAVAILABLE', '当前玩家分层尚未确定，未发放扭蛋券', event);
  }
  const matches = (config.supplyRules || []).filter(rule => rule.source === source && rule.tier === layerId);
  if (matches.length !== 1) {
    return rejection('SUPPLY_RULE_UNAVAILABLE', '当前分层的供券规则缺失或不唯一，未发放扭蛋券', event);
  }
  const rule = matches[0];
  const hit = result === 'SUCCESS' || result === 'HIT';
  if ((source === 'ORDER_SETTLED' && rule.method !== 'FIXED') ||
      (source === 'GENERATOR_OUTPUT' && rule.method !== 'HIT_PROBABILITY') ||
      !Number.isInteger(rule.ticketsOnHit) || rule.ticketsOnHit <= 0) {
    return rejection('INVALID_SUPPLY_RULE', '供券规则配置无效，未发放扭蛋券', event);
  }
  if (!Number.isInteger(draft.tickets) || draft.tickets < 0) {
    return rejection('INVALID_BALANCE', '扭蛋券余额状态异常，未发放扭蛋券', event);
  }
  if (draft.processedEventIds != null &&
      !Array.isArray(draft.processedEventIds) &&
      (typeof draft.processedEventIds !== 'object' || draft.processedEventIds === null)) {
    return rejection('INVALID_EVENT_RECORD', '供券去重记录不可用，未发放扭蛋券', event);
  }

  const day = String(activityDay(now, activity));
  const usage = ruleUsage(draft, rule.ruleId);
  const usedToday = usage.days?.[day] ?? 0;
  if (!Number.isSafeInteger(usage.period) || usage.period < 0 ||
      !Number.isSafeInteger(usedToday) || usedToday < 0 ||
      (hit && (!Number.isSafeInteger(draft.tickets + rule.ticketsOnHit) ||
        !Number.isSafeInteger(usage.period + rule.ticketsOnHit) ||
        !Number.isSafeInteger(usedToday + rule.ticketsOnHit)))) {
    return rejection('INVALID_SUPPLY_USAGE', '供券额度记录异常，未发放扭蛋券', event);
  }
  const remainingPeriod = rule.periodCap === -1 ? Infinity : rule.periodCap - usage.period;
  const remainingDay = rule.dailyCap === -1 ? Infinity : rule.dailyCap - usedToday;
  const granted = hit ? Math.max(0, Math.min(rule.ticketsOnHit, remainingPeriod, remainingDay)) : 0;
  if (hit && granted === 0) {
    // R02/R10：有效上游成功事件即使因额度耗尽发券为零，也已经结算。
    // 在同一事务中保存事件 ID；次日重放不能重新取得额度并发券。
    if (!draft.processedEventIds) draft.processedEventIds = {};
    const reason = '当前供券来源已达到配置上限，本事件确认发券0张';
    record(draft.processedEventIds, eventId, {
      source, result, ruleId: rule.ruleId, configuredTickets: rule.ticketsOnHit,
      ticketsGranted: 0, reason, code: 'SUPPLY_CAP_REACHED', periodId: activity.periodId
    });
    return {
      ok: true, accepted: true, success: false, code: 'SUPPLY_CAP_REACHED',
      reason, eventId, source, result, ruleId: rule.ruleId,
      periodId: activity.periodId, layerId,
      configuredTickets: rule.ticketsOnHit, ticketsGranted: 0, tickets: 0,
      balance: draft.tickets, simulatedSource: rule.scope
    };
  }

  // R10：仅在全部校验结束后修改事务副本；Store 负责一次性 commit。
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
    source, result, ruleId: rule.ruleId, ticketsGranted: granted, periodId: activity.periodId
  });
  const reason = !hit
    ? (result === 'MISS' ? '模拟有效产出未命中，本次不发券' : '模拟上游操作失败，本次不发券')
    : granted < rule.ticketsOnHit
      ? `模拟成功；受供券上限限制，实际获得${granted}张扭蛋券`
      : `模拟成功，获得${granted}张扭蛋券`;
  return {
    ok: true, accepted: true, success: granted > 0,
    code: granted ? 'SUPPLY_GRANTED' : result === 'MISS' ? 'SUPPLY_MISSED' : 'UPSTREAM_FAILED',
    reason, eventId, source, result, ruleId: rule.ruleId,
    periodId: activity.periodId, layerId,
    configuredTickets: rule.ticketsOnHit, ticketsGranted: granted, tickets: granted,
    balance: draft.tickets, simulatedSource: rule.scope
  };
}
