// R02/R03/R04/R06/R07/R09/R10/R12：反馈只读取已提交状态；不派发业务操作、不扣费、不发奖。
// 结果及领奖弹窗由 views/state 管理。本模块提供不拦截点击的机台表现和有序提示。

const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function reducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function transactionId(value) {
  // 抽取弹窗同时保存短批次 ID 与完整事务 ID；账本以完整事务 ID 为键。
  return value?.transactionId ?? value?.batchId ?? value?.settlementId ?? value?.eventId ?? value?.id ?? null;
}

function confirmed(state, id) {
  if (!id) return true;
  const records = state?.confirmedTransactions;
  if (!records) return true; // 兼容无事务记录的纯提示；不据此改变业务状态。
  if (Array.isArray(records)) {
    return records.some(item => item === id || transactionId(item) === id);
  }
  if (typeof records === 'object') {
    return own(records, id) && records[id] !== false;
  }
  return false;
}

function lookup(config, id) {
  const toy = (config?.toys || []).find(item => item.toyId === id);
  if (toy) return { name: toy.name, toy: true };
  const reward = (config?.rewards || []).find(item => item.rewardId === id);
  return reward ? { name: reward.name, quantity: reward.quantity } : null;
}

function resultLabel(result, config) {
  if (typeof result === 'string') return lookup(config, result)?.name || result;
  if (!result || typeof result !== 'object') return '';
  const id = result.toyId ?? result.rewardId ?? result.id;
  const item = lookup(config, id);
  const name = result.name ?? item?.name ?? id ?? '抽取结果';
  const duplicate = result.duplicate === true || result.isDuplicate === true || result.kind === 'DUPLICATE';
  const points = result.pointsGained ?? result.points ?? result.convertPoints;
  if (duplicate) return `${name} · 重复${Number.isFinite(Number(points)) ? ` +${points}积分` : '转化积分'}`;
  if (result.isNew === true || result.newToy === true || result.kind === 'NEW') return `${name} · NEW`;
  const quantity = result.quantity ?? (item?.toy ? null : item?.quantity);
  return `${name}${quantity != null ? ` ×${quantity}` : ''}`;
}

function nodeLabel(value, config) {
  const id = typeof value === 'string' ? value : value?.nodeId ?? value?.id;
  const node = (config?.nodes || []).find(item => item.nodeId === id);
  return node?.label ?? (typeof value === 'object' ? value?.label : null) ?? String(id ?? '阶段奖励');
}

/** R04：仅表现已确认的重复积分。输入层在关闭结果弹窗前取得真实标记位置，
 * 关闭成功后再以重新渲染的进度轨道为终点；动画不调用 Store，也不增加积分。
 * 不在视野中的结果仍计入文字终态，不从屏幕外虚构飞行起点。
 */
export function flyConfirmedDuplicatePoints(root, sources, total, durationMs = 850) {
  if (!root || !Array.isArray(sources) || !Number.isFinite(total) || total <= 0) return;
  const panel = root.querySelector('.progress-panel');
  const rail = root.querySelector('.progress-panel .progress-rail');
  if (!panel || !rail) return;
  const status = document.createElement('span');
  status.className = 'point-flight-status';
  status.setAttribute('role', 'status');
  status.textContent = `重复积分 +${total} 飞向进度条`;
  panel.appendChild(status);
  const rootBox = root.getBoundingClientRect();
  const target = rail.getBoundingClientRect();
  const x = target.left + target.width / 2 - rootBox.left;
  const y = target.top + target.height / 2 - rootBox.top;
  const gentle = reducedMotion();
  const visible = gentle ? [] : sources.filter(source => source.visible &&
    Number.isFinite(source.x) && Number.isFinite(source.y));
  if (!visible.length || typeof Element.prototype.animate !== 'function') {
    status.textContent = `重复积分 +${total} 已汇入进度条`;
    return;
  }
  const layer = document.createElement('div');
  layer.className = 'point-particle-layer';
  layer.setAttribute('aria-hidden', 'true');
  root.appendChild(layer);
  const duration = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 850;
  let remaining = visible.length * 3;
  for (const source of visible) {
    for (let index = 0; index < 3; index++) {
      const dot = document.createElement('i');
      dot.className = 'point-particle';
      dot.style.left = `${source.x - rootBox.left}px`;
      dot.style.top = `${source.y - rootBox.top}px`;
      dot.style.setProperty('--particle-color', source.color || '#f5c96d');
      layer.appendChild(dot);
      const fan = (index - 1) * 9;
      const animation = dot.animate([
        { transform: 'translate(-50%,-50%) scale(.75)', opacity: 1 },
        { transform: `translate(calc(-50% + ${fan}px),calc(-50% - 15px)) scale(1.25)`, opacity: 1, offset: .24 },
        { transform: `translate(calc(-50% + ${x - (source.x - rootBox.left)}px),calc(-50% + ${y - (source.y - rootBox.top)}px)) scale(.3)`, opacity: .2 }
      ], { duration: duration + index * 75, easing: 'ease-in', fill: 'forwards' });
      const finish = () => {
        dot.remove();
        remaining--;
        if (remaining === 0) {
          layer.remove();
          if (status.isConnected) status.textContent = `重复积分 +${total} 已汇入进度条`;
        }
      };
      animation.finished.then(finish, finish);
    }
  }
}

function orderedNodes(outcome, config) {
  const raw = outcome?.automaticRewards ?? outcome?.autoRewards ?? outcome?.awardedNodes ?? outcome?.reachedNodes ?? [];
  if (!Array.isArray(raw)) return [];
  const nodes = config?.nodes || [];
  const unique = new Map();
  for (const entry of raw) {
    const id = typeof entry === 'string' ? entry : entry?.nodeId ?? entry?.id;
    if (id && !unique.has(id) && nodes.some(node => node.nodeId === id)) unique.set(id, entry);
  }
  const ordered = [...unique.values()];
  const rank = entry => {
    const id = typeof entry === 'string' ? entry : entry?.nodeId ?? entry?.id;
    const node = nodes.find(item => item.nodeId === id);
    return node?.nodeType === 'POINT' ? 0 : node?.nodeType === 'COMPLETE' ? 2 : 1;
  };
  return ordered.sort((a, b) => {
    const ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    const find = entry => nodes.find(node => node.nodeId === (typeof entry === 'string' ? entry : entry?.nodeId ?? entry?.id));
    return (find(a)?.target ?? find(a)?.sortOrder ?? 0) - (find(b)?.target ?? find(b)?.sortOrder ?? 0);
  });
}

function isSuccess(outcome) {
  return outcome?.ok === true || outcome?.success === true || outcome?.committed === true;
}

function drawResults(outcome) {
  const value = outcome?.results ?? outcome?.items ?? outcome?.resultItems ?? outcome?.batchResults;
  return Array.isArray(value) ? value : null;
}

/** 已提交结果的表现队列。skip 仅跳过当前表现，不撤销或重做存档事务。 */
export function createFeedback({ store, root, config }) {
  if (!root || typeof root.appendChild !== 'function') {
    throw new TypeError('createFeedback 需要有效的挂载根节点');
  }

  const motion = Number(config?.theme?.motionMs);
  const beat = Number.isFinite(motion) && motion > 0 ? motion : 850;
  const queue = [];
  const seen = new Set();
  let current = null;
  let timer = null;
  let layer = null;
  let text = null;
  let disposed = false;

  const observer = typeof MutationObserver === 'undefined' ? null : new MutationObserver(() => {
    // renderApp 可能整体替换 root 的子节点；仅在已有表现时恢复反馈层。
    if (!disposed && (current || queue.length) && layer && !layer.isConnected) root.appendChild(layer);
  });
  observer?.observe(root, { childList: true });

  function ensureLayer() {
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'activity-feedback';
      layer.setAttribute('aria-live', 'polite');
      layer.setAttribute('aria-atomic', 'true');
      layer.style.cssText = 'position:absolute;left:12px;right:12px;bottom:clamp(104px,17%,164px);z-index:40;pointer-events:none;display:flex;justify-content:center;';
      text = document.createElement('div');
      text.style.cssText = 'max-width:100%;max-height:38vh;overflow:hidden;padding:10px 15px;border:2px solid var(--gold,#F5C96D);border-radius:var(--radius,18px);background:var(--surface,#FFF4DF);color:#352846;box-shadow:0 5px 0 #793744,0 12px 26px rgba(16,12,43,.35);font-size:var(--body-size,15px);font-weight:700;line-height:1.45;text-align:center;white-space:pre-line;';
      layer.appendChild(text);
    }
    if (!layer.isConnected) root.appendChild(layer);
  }

  function clearPhase() {
    delete root.dataset.feedbackPhase;
  }

  function advance() {
    if (disposed) return;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    clearPhase();
    current = queue.shift() || null;
    if (!current) {
      layer?.remove();
      return;
    }
    ensureLayer();
    text.textContent = current.message;
    if (current.kind === 'machine') root.dataset.feedbackPhase = 'machine';
    // 减少动态效果仍完整展示结果和领奖文字，只省略机台摇晃时间。
    const duration = reducedMotion() && current.kind === 'machine' ? 0 : current.duration;
    timer = setTimeout(advance, duration);
  }

  function enqueue(frames) {
    if (disposed || !frames.length) return;
    queue.push(...frames);
    if (!current) advance();
  }

  function present(outcome) {
    if (disposed || !outcome || typeof outcome !== 'object') return;
    const success = isSuccess(outcome);
    if (!success) {
      const reason = outcome.reason ?? outcome.message ?? outcome.error;
      if (reason) enqueue([{ kind: 'notice', message: String(reason), duration: beat * 2 }]);
      return;
    }

    const state = store?.getState?.();
    const id = transactionId(outcome);
    const results = drawResults(outcome);
    const irreversible = Boolean(results || outcome?.exchangeId || outcome?.itemId || outcome?.awardedNodes);
    if (irreversible && !confirmed(state, id)) return;
    if (id && seen.has(id)) return;
    if (id) seen.add(id);

    if (results) {
      const frames = [
        { kind: 'machine', message: '扭蛋机转动中…', duration: beat },
        {
          kind: 'result',
          message: results.length
            ? `本批抽取 · ${results.length}项\n${results.map(item => resultLabel(item, config)).filter(Boolean).join(' · ')}`
            : '抽取结果已确认',
          duration: Math.max(beat * 2, 1400)
        }
      ];
      for (const entry of orderedNodes(outcome, config)) {
        frames.push({ kind: 'award', message: `奖励已确认 · ${nodeLabel(entry, config)}`, duration: beat * 2 });
      }
      enqueue(frames);
      return;
    }

    const message = outcome.message ?? outcome.notice ?? outcome.reason;
    if (message) enqueue([{ kind: 'notice', message: String(message), duration: beat * 2 }]);
  }

  // R10：仅对明确排队、且可在已确认事务中找到的待恢复结果补足表现；
  // 不扫描历史事务重新播放，更不会在恢复时重新结算。
  function recoverPending() {
    const state = store?.getState?.();
    const pending = state?.popupQueue;
    if (!Array.isArray(pending)) return;
    for (const popup of pending) {
      if (!popup || typeof popup !== 'object') continue;
      const type = String(popup.type ?? popup.kind ?? popup.screen ?? '').toLowerCase();
      if (type !== 'drawresult' && type !== 'draw_result') continue;
      const id = transactionId(popup) ?? transactionId(popup.payload);
      if (!id || !confirmed(state, id) || seen.has(id)) continue;
      const record = Array.isArray(state.confirmedTransactions)
        ? state.confirmedTransactions.find(item => transactionId(item) === id)
        : state.confirmedTransactions?.[id];
      // 已确认结果保存在弹窗本身；事务摘要只保存奖励 ID，不能代替结果列表。
      const saved = popup.payload && drawResults(popup.payload) ? popup.payload : popup;
      if (saved && typeof saved === 'object' && drawResults(saved)) {
        present({ ...saved, transactionId: id, ok: true });
      }
    }
  }

  recoverPending();

  return {
    present,
    skip() {
      if (disposed || !current) return;
      advance();
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      if (timer !== null) clearTimeout(timer);
      observer?.disconnect();
      queue.length = 0;
      current = null;
      clearPhase();
      layer?.remove();
    }
  };
}
