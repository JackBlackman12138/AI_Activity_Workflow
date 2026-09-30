import { loadConfig, validateConfig } from '../src/config.js';
import { createStore } from '../src/state.js';

// I01/I02 · R09/R10：纯规则回归；平台尚需实际执行及浏览器核对。
export function testSettlementRecovery() {
  const config = loadConfig();
  if (validateConfig(config).length) throw new Error('默认配置无效');
  let saved = null;
  const persistence = {
    load: () => saved && structuredClone(saved),
    commit(value) { saved = structuredClone(value); return { ok: true }; },
    status: () => 'READY'
  };
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  let store = createStore({ config, persistence });
  const act = action => store.dispatch(action);
  assert(act({ type: 'ENTRY_OPEN' }).ok, '应可打开本期活动');
  assert(act({ type: 'COVER_START' }).ok, '应可开始活动');
  assert(act({ type: 'GUIDE_CLOSE' }).ok, '应可关闭引导');
  assert(act({ type: 'DEBUG_SET', changes: { serverTime: config.activity.endAt } }).ok, '应可模拟截止');
  assert(act({ type: 'LEAVE_ACTIVITY' }).ok, '离开到期会话应开始结算');
  const first = store.getState();
  assert(first.popupQueue[0]?.type === 'ending', '结束说明须先入队');
  const id = first.settlement.id;
  assert(act({ type: 'OPEN_SCREEN', screen: 'debug' }).ok, '结束弹窗上方可打开 Debug');
  assert(act({ type: 'SIMULATE_RELOGIN' }).ok, '应可模拟重登');
  assert(store.getState().popupQueue[0]?.type === 'ending' && store.getState().settlement.id === id,
    '重登不得丢失结束说明或重建结算事务');
  assert(act({ type: 'SIMULATE_RELOGIN' }).ok, '再次重登应幂等');
  assert(store.getState().popupQueue.filter(row => row.type === 'ending').length === 1,
    '重复重登不能重复入队');
  store = createStore({ config, persistence });
  assert(store.getState().popupQueue[0]?.type === 'ending', '刷新须保留结束说明');

  // 兼容旧存档：已有结算，但结束弹窗遗失。恢复时只补展示队列。
  saved.popupQueue = [];
  store = createStore({ config, persistence });
  assert(store.getState().popupQueue[0]?.type === 'ending', '缺失的结束弹窗须幂等恢复');
  assert(store.getState().settlement.id === id && store.getState().tickets === first.tickets,
    '恢复弹窗不得重新结算或提前清券');
  assert(store.dispatch({ type: 'POPUP_CLOSE', popupId: store.getState().popupQueue[0].id }).ok,
    '恢复的结束弹窗应可确认');
  const finalized = store.getState();
  assert(finalized.settlement.status === 'FINALIZED' && finalized.cursor === null &&
    finalized.sequenceGroup === null && finalized.tickets === 0,
    '无补发时须完成清理且清空游标');
  store = createStore({ config, persistence });
  assert(store.getState().cursor === null && store.getState().sequenceGroup === null &&
    saved.cursor === null && saved.sequenceGroup === null,
    '刷新不能重新填入已结算期次的游标或序列组');
  assert(store.getState().popupQueue.length === 0,
    '已经结束的弹窗不得在刷新后再次出现');
  return true;
}
