import { loadConfig, validateConfig } from '../src/config.js';
import { createStore } from '../src/state.js';

// R07/R10：可由平台规则测试入口调用；不依赖浏览器、网络或主线玩法。
export function testExchangeGuards() {
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
  const closeQueue = () => {
    while (store.getState().popupQueue.length) {
      const popup = store.getState().popupQueue[0];
      assert(act({ type: 'POPUP_CLOSE', popupId: popup.id }).ok, '已确认弹窗应可关闭');
    }
  };

  assert(act({ type: 'ENTRY_OPEN' }).ok, '应能进入活动');
  assert(act({ type: 'COVER_START' }).ok, '应能开始活动');
  assert(act({ type: 'GUIDE_CLOSE' }).ok, '应能关闭引导');
  for (let i = 0; i < 9; i++) {
    assert(act({ type: 'DEBUG_SUPPLY', event: {
      eventId: `exchange-guard-order-${i}`, source: 'ORDER_SETTLED', result: 'SUCCESS'
    } }).ok, '主动模拟订单应供券');
  }
  for (let i = 0; i < 4; i++) {
    assert(act({ type: 'DRAW', tierId: 'X10', batchId: `exchange-guard-draw-${i}` }).ok,
      '应按序完成活动抽取');
    closeQueue();
  }
  assert(store.getState().ownedToyIds.length === 25, '须通过抽取集齐25件玩具');
  const before = store.getState();
  assert(!act({ type: 'EXCHANGE_CONFIRM', itemId: 'SHOP01',
    transactionId: 'unpreviewed' }).ok, '未预览不得直接兑换');
  assert(store.getState().availablePoints === before.availablePoints &&
    store.getState().rewardLedger.length === before.rewardLedger.length,
    '未预览不得扣积分或发奖');

  assert(act({ type: 'SHOP_CONFIRM', itemId: 'SHOP01' }).ok, '应打开商品确认');
  const token = store.getState().popupQueue[0].transactionId;
  assert(!act({ type: 'EXCHANGE_CONFIRM', itemId: 'SHOP02', transactionId: token }).ok,
    '其他商品不得复用确认');
  assert(!act({ type: 'EXCHANGE_CONFIRM', itemId: 'SHOP01',
    transactionId: 'wrong-token' }).ok, '事务ID不匹配不得兑换');
  assert(store.getState().availablePoints === before.availablePoints,
    '拒绝请求不得改变可用积分');
  assert(act({ type: 'EXCHANGE_CONFIRM', itemId: 'SHOP01', transactionId: token }).ok,
    '匹配的确认应完成兑换');
  const confirmed = store.getState();
  assert(confirmed.availablePoints === before.availablePoints - 3,
    '兑换只扣配置的可用积分价格');
  assert(confirmed.totalPoints === before.totalPoints, '兑换不得回退累计积分');
  assert(confirmed.popupQueue[0]?.source === 'EXCHANGE', '到账弹窗应排队');
  assert(!act({ type: 'EXCHANGE_CONFIRM', itemId: 'SHOP01', transactionId: token }).ok,
    '重复确认不得再次兑换');

  assert(act({ type: 'SIMULATE_RELOGIN' }).ok, '应能模拟重登');
  const recovered = store.getState();
  assert(recovered.popupQueue[0]?.source === 'EXCHANGE' &&
    recovered.popupQueue[0]?.transactionId === token,
    '重登须保留有事务及账本依据的兑换结果');
  assert(recovered.availablePoints === confirmed.availablePoints &&
    recovered.rewardLedger.length === confirmed.rewardLedger.length,
    '重登不得重扣或重发');
  const reloaded = createStore({ config, persistence });
  assert(reloaded.getState().popupQueue[0]?.source === 'EXCHANGE',
    '整页重建与模拟重登须恢复同一兑换结果');
  return true;
}
