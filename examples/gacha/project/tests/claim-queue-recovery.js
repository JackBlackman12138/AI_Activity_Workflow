import { loadConfig, validateConfig } from '../src/config.js';
import { createStore } from '../src/state.js';

// I03/I04 / R10：状态库直接调用也不能越过弹窗；已确认手动领奖重登后恢复表现。
export function testClaimQueueRecovery() {
  const config = loadConfig();
  if (validateConfig(config).length) throw new Error('演示配置无效');
  let saved = null;
  const persistence = {
    load: () => saved && structuredClone(saved),
    commit(value) { saved = structuredClone(value); return { ok: true }; },
    status: () => 'READY'
  };
  const store = createStore({ config, persistence });
  const act = action => store.dispatch(action);
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  assert(act({ type: 'ENTRY_OPEN' }).ok, '入口应开放');
  assert(act({ type: 'COVER_START' }).ok, '封面应可开始');
  assert(act({ type: 'GUIDE_CLOSE' }).ok, '应可关闭引导');
  for (let i = 0; i < 6; i++) assert(act({ type: 'DEBUG_SUPPLY', event: {
    eventId: `claim-recovery-order-${i}`, source: 'ORDER_SETTLED', result: 'SUCCESS'
  } }).ok, '外部供券应确认');
  for (let i = 0; i < 3; i++) {
    assert(act({ type: 'DRAW', tierId: 'X10', batchId: `claim-recovery-draw-${i}` }).ok, '应按序抽取');
    if (i === 2) {
      const before = store.getState();
      const blocked = act({ type: 'CLAIM_NODE', nodeId: 'COL_GREEN' });
      assert(!blocked.ok && !store.getState().nodeClaims.COL_GREEN,
        '结果尚未收下时不得提前确认品质奖励');
      assert(store.getState().rewardLedger.length === before.rewardLedger.length,
        '拒绝领奖不得新增账本条目');
    }
    while (store.getState().popupQueue.length) {
      const popup = store.getState().popupQueue[0];
      assert(act({ type: 'POPUP_CLOSE', popupId: popup.id }).ok, '已确认反馈应按序关闭');
    }
  }
  assert(store.getState().ownedToyIds.length === 25, '必须由抽取集齐玩具');
  assert(!act({ type: 'CLAIM_NODE', nodeId: 'COL_GREEN' }).ok,
    '机台上直接派发手动领奖仍须拒绝');
  assert(act({ type: 'OPEN_SCREEN', screen: 'collection' }).ok, '应进入收藏页');
  assert(act({ type: 'CLAIM_NODE', nodeId: 'COL_GREEN' }).ok, '收藏页应可领取达成奖励');
  const confirmed = store.getState();
  const popup = confirmed.popupQueue[0];
  assert(popup.source === 'MANUAL' && popup.sourceId === confirmed.nodeClaims.COL_GREEN.sourceId,
    '手动领奖反馈须记录稳定来源');
  assert(act({ type: 'SIMULATE_RELOGIN' }).ok, '应可模拟重登');
  assert(store.getState().popupQueue[0]?.id === popup.id,
    '重登须保留有领奖记录与账本支持的手动反馈');
  const reloaded = createStore({ config, persistence }).getState();
  assert(reloaded.popupQueue[0]?.id === popup.id &&
    reloaded.rewardLedger.length === confirmed.rewardLedger.length,
    '整页恢复不得丢失已确认反馈或再次发奖');
  return true;
}
