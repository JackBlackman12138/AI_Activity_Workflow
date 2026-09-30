import { renderApp } from './views.js';
import { getShopItemStatus } from './shop.js';
import { flyConfirmedDuplicatePoints } from './feedback.js';

// R01–R12：输入层只向 Store 提交业务操作；所有扣费、发奖和持久化均由 Store 负责。
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const q = (root, selector) => root.querySelector(selector);
const popupId = popup => typeof popup === 'string' ? popup : popup?.popupId || popup?.id;

export function bindInput(root, store, feedback, config) {
  if (!root || !store || typeof store.dispatch !== 'function' || !config) {
    throw new TypeError('bindInput 需要活动根节点、Store 和已校验配置');
  }
  // R12：复用 bootstrap 已校验的配置。平台缺表时仍使用同一套演示默认值；
  // 不重新读取 SDK，也不创建、覆盖或写入 ActivityStudio。
  let disposed = false;
  let locked = false;
  let revealTimer = null;
  let pendingClaim = null;
  let lastSupply = null;
  // R02/R10：事务 ID 必须跨刷新唯一；使用已持久化的事件序号，不使用页面内计数器。
  let infoScope = 'FULL';
  let noticeTimer = null;

  function notice(message) {
    const text = String(message || '操作未完成');
    let target = q(root, '.activity-toast');
    if (!target) {
      target = document.createElement('div');
      target.className = 'activity-toast';
      target.setAttribute('role', 'status');
      target.setAttribute('aria-live', 'polite');
      root.appendChild(target);
    }
    target.textContent = text;
    target.style.display = 'block';
    if (noticeTimer) clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { if (target.isConnected) target.textContent = ''; }, 2800);
  }

  function dispatch(action, { present = false } = {}) {
    const result = store.dispatch(action);
    if (!result?.ok) {
      const message = result?.message || result?.reason || '操作未完成';
      notice(message);
      feedback?.present?.({ ok: false, reason: message });
    } else if (present) {
      feedback?.present?.(result);
    }
    return result;
  }

  function unlockPresentation() {
    if (revealTimer !== null) clearTimeout(revealTimer);
    revealTimer = null;
    locked = false;
    root.querySelectorAll('.machine-art--active').forEach(node => node.classList.remove('machine-art--active'));
    const overlay = q(root, '[data-screen="drawResult"].overlay');
    if (overlay) {
      overlay.style.visibility = '';
      overlay.style.pointerEvents = '';
    }
    q(root, '[data-action="feedback-skip"]')?.remove();
  }

  function showMachinePresentation() {
    locked = true;
    const overlay = q(root, '[data-screen="drawResult"].overlay');
    if (overlay) {
      overlay.style.visibility = 'hidden';
      overlay.style.pointerEvents = 'none';
    }
    q(root, '.machine-art')?.classList.add('machine-art--active');
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.dataset.action = 'feedback-skip';
    skip.textContent = '跳过出蛋表现';
    skip.setAttribute('aria-label', '跳过出蛋表现并查看已确认结果');
    skip.style.cssText = 'position:absolute;z-index:60;left:50%;bottom:22%;transform:translateX(-50%);min-width:44px;min-height:44px;padding:8px 16px;border:2px solid var(--gold);border-radius:20px;background:var(--surface);color:#352846;font-weight:700;';
    root.appendChild(skip);
    const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = Number(config?.theme?.motionMs);
    revealTimer = setTimeout(unlockPresentation, reduced ? 0 : Number.isFinite(duration) && duration > 0 ? duration : 0);
  }

  function activePopup() { return store.getState().popupQueue?.[0]; }
  function closePopup() {
    const popup = activePopup();
    if (!popup) return dispatch({ type: 'CLOSE_SCREEN' });
    return dispatch({ type: 'POPUP_CLOSE', popupId: popupId(popup) });
  }

  function debugField(name) { return q(root, `[data-debug-field="${name}"]`)?.value; }
  function readDebugChanges() {
    const changes = {};
    const level = debugField('level');
    const wave = debugField('wave');
    if (level !== undefined && level !== '') changes.level = Number(level);
    if (wave !== undefined && wave !== '') changes.completedWave = Number(wave);
    for (const name of ['qualified', 'mutualExclusionClear', 'resourcesReady', 'timeTrusted']) {
      const value = debugField(name);
      if (value !== undefined) changes[name] = value === 'true';
    }
    for (const name of ['layerId', 'serverTime', 'switchState']) {
      const value = debugField(name);
      if (value !== undefined && value !== '') changes[name] = value;
    }
    return changes;
  }

  function debugReceipt(result, request) {
    const rule = config?.supplyRules?.find(row => row.source === request.source && row.tier === store.getState().layerId);
    const text = `${request.source === 'ORDER_SETTLED' ? '模拟订单结算' : '模拟生成器产出'} · ID ${request.eventId} · 配置命中发券 ${rule?.ticketsOnHit ?? '—'} 张 · 实际 ${result?.ticketsGranted ?? 0} 张 · ${result?.message || result?.reason || (result?.ok ? '已记录' : '已拒绝')}${result?.duplicate ? ' · 去重' : ''}`;
    notice(text);
    if (store.getState().screen === 'debug') {
      let node = q(root, '[data-debug-receipt]');
      if (!node) {
        node = document.createElement('p');
        node.dataset.debugReceipt = '';
        node.setAttribute('role', 'status');
        node.style.cssText = 'padding:10px;border:2px solid var(--gold);border-radius:12px;line-height:1.5;overflow-wrap:anywhere;';
        q(root, '[data-screen="debug"] .modal-content')?.prepend(node);
      }
      if (node) node.textContent = text;
    }
  }

  function supply(source, resultName, replay = false) {
    const state = store.getState();
    const typed = debugField('eventId')?.trim();
    let request;
    if (replay) {
      if (!lastSupply && !typed) return notice('请先模拟一次供券事件，或输入要重放的事件 ID');
      request = lastSupply ? { ...lastSupply, eventId: typed || lastSupply.eventId } :
        { eventId: typed, source: 'ORDER_SETTLED', result: 'SUCCESS' };
    } else {
      request = {
        eventId: typed || `${state.periodId}:${state.testInstanceId}:debug-supply:${(state.eventSerial || 0) + 1}`,
        source, result: resultName
      };
      lastSupply = { ...request };
    }
    const outcome = dispatch({ type: 'DEBUG_SUPPLY', event: request });
    debugReceipt(outcome, request);
  }

  function showClaimConfirmation(nodeId) {
    const state = store.getState();
    const node = config?.nodes?.find(row => row.nodeId === nodeId && row.nodeType === 'QUALITY');
    if (!node || !state.activitySession) return notice('品质奖励当前不可领取');
    if (state.nodeClaims?.[nodeId]) return notice('奖励已领取');
    const owned = new Set(state.ownedToyIds || []);
    const count = config.toys.filter(toy => toy.collectionId === node.collectionId && owned.has(toy.toyId)).length;
    if (count < node.target) return notice(`还需收集 ${node.target - count} 件该品质玩具`);
    pendingClaim?.remove();
    const layer = document.createElement('div');
    layer.className = 'overlay';
    layer.dataset.localClaim = nodeId;
    layer.style.zIndex = '200';
    layer.innerHTML = `<section class="activity-modal" role="dialog" aria-modal="true" aria-label="确认领取品质奖励"><header class="modal-header"><h2>${esc(node.label)}</h2><button type="button" class="modal-close" data-action="claim-cancel" aria-label="取消领奖">×</button></header><div class="modal-content"><p>已集齐本组 ${esc(node.target)} 件玩具。确认后奖励将记录为模拟到账或待领奖。</p><p>${node.rewardIds.map(id => { const reward = config.rewards.find(row => row.rewardId === id); return reward ? `${esc(reward.name)} ×${esc(reward.quantity)}` : ''; }).join('、')}</p></div><footer class="modal-actions"><button type="button" class="secondary-button" data-action="claim-cancel">取消</button><button type="button" class="primary-button" data-action="claim-confirm" data-node-id="${esc(nodeId)}">确认领取</button></footer></section>`;
    root.appendChild(layer);
    pendingClaim = layer;
  }

  function updateGuide() {
    const popup = activePopup();
    if (popup?.type !== 'guide' || !config) return;
    const lines = [...config.copy].filter(row => /^GUIDE_/.test(row.copyId)).sort((a, b) => a.sortOrder - b.sortOrder);
    const index = Math.min(store.getState().guideIndex || 0, lines.length - 1);
    const dialog = q(root, '[data-screen="guide"]');
    const content = dialog?.querySelector('.modal-content > p');
    const progress = dialog?.querySelector('.guide-progress');
    if (content) content.textContent = lines[index]?.text || '';
    if (progress) progress.textContent = `${index + 1} / ${lines.length}`;
    const next = dialog?.querySelector('[data-action="guide-next"]');
    if (next) next.textContent = index + 1 >= lines.length ? '完成引导' : '下一步';
  }

  function setInfoScope(scope) {
    if (!config || !['FULL', 'LOOP'].includes(scope)) return;
    infoScope = scope;
    // Info 的范围切换是纯展示操作，不推进序列或修改持久化业务状态。
    renderApp(root, { ...store.getState(), infoScope: scope }, config);
  }

  function shopReason(itemId) {
    // R07/R10：入口提示与确认时复验共用商店规则；兼容数组及对象形式的收藏存档。
    const status = getShopItemStatus(store.getState(), itemId, config);
    return status.canExchange ? '' : status.message || '商品暂不可兑换';
  }

  function onClick(event) {
    const target = event.target instanceof Element ? event.target.closest('[data-action]') : null;
    if (!target || !root.contains(target) || target.disabled) return;
    const action = target.dataset.action;
    // R10：即使浏览器尚未将旧焦点移出机台，也不得让模态层外的
    // 返回或其他按钮越过已确认结果队列。
    if (q(root, '.overlay') && action !== 'feedback-skip' &&
        !(action === 'debug-open' && target.hasAttribute('data-overlay-debug')) &&
        !target.closest('.overlay')) return;
    if (locked && action !== 'feedback-skip') return;
    if (pendingClaim && !['claim-confirm', 'claim-cancel'].includes(action)) return;
    const tierId = target.dataset.tierId;
    const itemId = target.dataset.itemId || target.closest('[data-item-id]')?.dataset.itemId;
    const nodeId = target.dataset.nodeId;

    switch (action) {
      case 'feedback-skip': unlockPresentation(); feedback?.skip?.(); break;
      case 'entry-open': dispatch({ type: 'ENTRY_OPEN' }); break;
      case 'readonly-open': dispatch({ type: 'READONLY_OPEN' }); break;
      case 'ending-summary-open': dispatch({ type: 'ENDING_SUMMARY_OPEN' }); break;
      case 'ending-summary-close': dispatch({ type: 'ENDING_SUMMARY_CLOSE' }); break;
      case 'cover-start': dispatch({ type: 'COVER_START' }); break;
      case 'cover-close': closePopup(); break;
      case 'machine-close': dispatch({ type: 'LEAVE_ACTIVITY' }); break;
      case 'tier-select': dispatch({ type: 'SELECT_TIER', tierId }); break;
      case 'draw': {
        const state = store.getState();
        if (state.popupQueue?.length) return notice('请先处理当前弹窗');
        const batchId = `${state.periodId}:${state.testInstanceId}:input-draw:${(state.eventSerial || 0) + 1}`;
        const result = dispatch({ type: 'DRAW', tierId: tierId || state.selectedTierId, batchId });
        if (result?.ok) {
          showMachinePresentation();
          // feedback 的确认键须对应 Store 保存的完整 transactionId。
          feedback?.present?.({ ...result, batchId: result.transactionId });
        }
        break;
      }
      case 'collection-open': dispatch({ type: 'OPEN_SCREEN', screen: 'collection' }); break;
      case 'shop-open': dispatch({ type: 'OPEN_SCREEN', screen: 'shop' }); break;
      case 'info-open': infoScope = 'FULL'; dispatch({ type: 'OPEN_SCREEN', screen: 'info' }); break;
      case 'rules-open': dispatch({ type: 'OPEN_SCREEN', screen: 'rulesGuide' }); break;
      case 'panel-back': dispatch({ type: 'CLOSE_SCREEN' }); break;
      case 'info-scope': setInfoScope(target.dataset.scope); break;
      case 'node-preview': {
        const node = config?.nodes?.find(row => row.nodeId === nodeId);
        if (node) notice(`${node.label}：累计达到 ${node.target} 分后自动发放；${node.rewardIds.map(id => { const r = config.rewards.find(row => row.rewardId === id); return r ? `${r.name} ×${r.quantity}` : id; }).join('、')}`);
        break;
      }
      case 'claim-node': showClaimConfirmation(nodeId); break;
      case 'claim-cancel': pendingClaim?.remove(); pendingClaim = null; break;
      case 'claim-confirm': {
        const result = dispatch({ type: 'CLAIM_NODE', nodeId: nodeId || pendingClaim?.dataset.localClaim });
        if (result?.ok) {
          pendingClaim?.remove(); pendingClaim = null;
          notice('品质奖励已确认，模拟奖励已记录');
        }
        break;
      }
      case 'exchange-open': {
        const reason = shopReason(itemId);
        if (reason) return notice(reason);
        dispatch({ type: 'SHOP_CONFIRM', itemId });
        break;
      }
      case 'exchange-cancel': closePopup(); break;
      case 'exchange-confirm': {
        const confirmation = activePopup();
        const result = dispatch({ type: 'EXCHANGE_CONFIRM', itemId,
          transactionId: confirmation?.transactionId });
        if (result?.ok) notice('兑换已确认；累计积分不变，奖励已记录');
        break;
      }
      case 'result-close': {
        // R04：读取结果弹窗里已确认的逐件积分，不从当前总分倒推，也不再次结算。
        // 坐标在关闭前取自真实玩具标记；成功移除弹窗后才飞向真实进度轨道。
        const popup = activePopup();
        const region = q(root, '[data-screen="drawResult"] .modal-content');
        const viewport = region?.getBoundingClientRect();
        const sources = [...root.querySelectorAll('[data-screen="drawResult"] .result-item.is-duplicate .duplicate-points')].map(node => {
          const rect = node.getBoundingClientRect();
          return {
            x: rect.left + rect.width / 2, y: rect.top + rect.height / 2,
            visible: Boolean(viewport && rect.bottom > viewport.top && rect.top < viewport.bottom &&
              rect.right > viewport.left && rect.left < viewport.right),
            color: getComputedStyle(node.closest('[data-quality]') || node).getPropertyValue('--quality-color').trim()
          };
        });
        const total = popup?.type === 'drawResult' ? Number(popup.pointsGained) : 0;
        const closed = closePopup();
        if (closed?.ok && total > 0) flyConfirmedDuplicatePoints(root, sources, total, config.theme?.motionMs);
        break;
      }
      case 'popup-close': closePopup(); break;
      case 'guide-next': if (dispatch({ type: 'GUIDE_NEXT' })?.ok) updateGuide(); break;
      case 'guide-skip': dispatch({ type: 'GUIDE_CLOSE' }); break;
      case 'ending-close': case 'ending-confirm': closePopup(); break;
      case 'makeup-claim': {
        const state = store.getState();
        if (state.settlement?.makeup?.some(row => row.status === 'PENDING')) {
          const result = dispatch({ type: 'CLAIM_MAKEUP', settlementId: state.settlement.id });
          if (result?.ok) notice('补发奖励已记录，请完成结算');
        } else closePopup();
        break;
      }
      case 'debug-open': dispatch({ type: 'OPEN_SCREEN', screen: 'debug' }); break;
      case 'debug-close': dispatch({ type: 'CLOSE_SCREEN' }); break;
      case 'debug-order-success': supply('ORDER_SETTLED', 'SUCCESS'); break;
      case 'debug-order-fail': supply('ORDER_SETTLED', 'FAILED'); break;
      case 'debug-generator-hit': supply('GENERATOR_OUTPUT', 'HIT'); break;
      case 'debug-generator-miss': supply('GENERATOR_OUTPUT', 'MISS'); break;
      case 'debug-generator-fail': supply('GENERATOR_OUTPUT', 'OUTPUT_FAILED'); break;
      case 'debug-replay': supply(null, null, true); break;
      case 'debug-apply': dispatch({ type: 'DEBUG_SET', changes: readDebugChanges() }); break;
      case 'debug-expire': {
        const changes = readDebugChanges();
        changes.serverTime = config?.activity?.endAt;
        dispatch({ type: 'DEBUG_SET', changes });
        break;
      }
      case 'debug-relogin': dispatch({ type: 'SIMULATE_RELOGIN' }); break;
      case 'debug-storage-fail': dispatch({ type: 'DEBUG_READ_ONLY' }); break;
      case 'debug-reset': {
        const result = dispatch({ type: 'RESET_TEST_INSTANCE' });
        if (result?.ok) { lastSupply = null; notice('已建立新的活动测试实例'); }
        break;
      }
      default: break;
    }
  }

  root.addEventListener('click', onClick);
  return () => {
    disposed = true;
    root.removeEventListener('click', onClick);
    if (noticeTimer) clearTimeout(noticeTimer);
    if (revealTimer !== null) clearTimeout(revealTimer);
    pendingClaim?.remove();
    q(root, '[data-action="feedback-skip"]')?.remove();
  };
}
