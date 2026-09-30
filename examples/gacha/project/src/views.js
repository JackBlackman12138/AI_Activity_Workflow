import { getSequenceShares } from './config.js';
import { getNodeStatus } from './progress.js';
import { getShopItemStatus } from './shop.js';
import { machineArt, toyArt, rewardArt } from './art.js';

// R01–R12：仅渲染已提交状态。所有可操作元素交由 input.js 事件委托；
// 此文件不修改存档、奖励、SDK 或活动配置。
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const rows = (config, key, table) => config?.[key] || config?.tables?.[table] || [];
const copy = (config, id, fallback = '') => config?.copyById?.[id] ?? fallback;
const has = (value, id) => value instanceof Set ? value.has(id) : Array.isArray(value) ? value.includes(id) : Boolean(value?.[id]);
const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const sorted = (items, field = 'sortOrder') => [...items].sort((a, b) => num(a[field]) - num(b[field]));
const attr = value => esc(value);
const button = (action, label, extra = '', classes = '', disabled = false) => `<button type="button" class="${classes}" data-action="${attr(action)}" ${extra} ${disabled ? 'disabled' : ''}>${label}</button>`;
const qualityName = { GREEN: '绿色', BLUE: '蓝色', PURPLE: '紫色', RED: '红色', GOLD: '金色' };

function themeVars(root, theme) {
  if (!theme) return;
  const vars = {
    '--night': theme.background, '--background': theme.background,
    '--machine': theme.machine, '--glass': theme.glass, '--gold': theme.gold,
    '--surface': theme.surface, '--font-stack': theme.fontStack,
    '--title-size': `${theme.titlePx}px`, '--body-size': `${theme.bodyPx}px`,
    '--radius': `${theme.radiusPx}px`, '--outline': `${theme.outlinePx}px`,
    '--shadow': theme.shadow, '--motion-ms': `${theme.motionMs}ms`,
    '--min-touch': `${theme.minTouchPx}px`,
    '--coral': theme.machine, '--aqua': theme.glass,
    '--brass': theme.gold, '--cream': theme.surface,
    '--font': theme.fontStack, '--panel-radius': `${theme.radiusPx}px`,
    '--stroke': `${theme.outlinePx}px`, '--panel-shadow': theme.shadow,
    '--motion-duration': `${theme.motionMs}ms`
  };
  for (const [key, value] of Object.entries(vars)) if (value != null) root.style.setProperty(key, value);
  for (const [key, value] of Object.entries(theme.qualityColors || {})) {
    root.style.setProperty(`--quality-${key.toLowerCase()}`, value);
  }
  (theme.spacing || []).forEach((value, index) => root.style.setProperty(`--space-${index + 1}`, `${value}px`));
}

function clock(state, config) {
  const source = state?.simulatedServer || state?.serverClock || state?.clock || {};
  const trusted = state?.timeTrusted ?? source.timeTrusted ?? source.trusted ?? config?.activity?.timeTrusted;
  const value = source.now ?? source.nowAt ?? source.serverNow ?? source.time ?? state?.serverTime;
  const now = typeof value === 'number' ? value : Date.parse(value);
  const end = Date.parse(config?.activity?.endAt);
  if (trusted !== true || !Number.isFinite(now) || !Number.isFinite(end)) return { trusted: false, expired: false, label: '时间待确认' };
  const remaining = Math.max(0, end - now);
  if (!remaining) return { trusted: true, expired: true, label: '正式截止' };
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor(remaining % 86400000 / 3600000);
  const minutes = Math.floor(remaining % 3600000 / 60000);
  return { trusted: true, expired: false, label: days ? `剩余 ${days}天 ${hours}小时` : `剩余 ${hours}小时 ${minutes}分` };
}

function session(state) {
  const value = state?.activitySession ?? state?.sessionActive;
  return value === true || value?.active === true || value?.status === 'ACTIVE' ||
    (value == null && !['entry', 'cover', 'ending', 'makeup'].includes(state?.screen));
}

function unavailable(state, config) {
  if (state?.readOnly || state?.persistenceStatus === 'READ_ONLY' || state?.saveStatus === 'READ_ONLY' || state?.saveError) {
    return copy(config, 'SAVE_ERROR', '活动存档暂不可用，操作已暂停。');
  }
  if (!clock(state, config).trusted) return copy(config, 'TIME_UNKNOWN', '服务器时间尚未确认，活动暂为只读。');
  return state?.unavailableReason || state?.entryReason || state?.eligibilityReason || '';
}

function rewardLine(id, config) {
  const reward = rows(config, 'rewards', 'RewardCatalog').find(row => row.rewardId === id);
  if (!reward) return `<span>${esc(id)}</span>`;
  return `<span class="reward-inline">${rewardArt(reward.iconKey, config.theme)}<span>${esc(reward.name)} ×${esc(reward.quantity)}<small>${reward.delivery === 'MOCK_PENDING' ? '模拟待领奖' : '模拟到账'}</small></span></span>`;
}
function rewardList(ids, config) { return (ids || []).map(id => rewardLine(id, config)).join('') || '<span>暂无奖励</span>'; }
function collectionCount(state, config) { return rows(config, 'toys', 'GachaToy').filter(toy => has(state?.ownedToyIds, toy.toyId)).length; }
function totalToys(config) { return rows(config, 'toys', 'GachaToy').length; }
function pointNodes(config) { return sorted(rows(config, 'nodes', 'ProgressNodes').filter(n => n.nodeType === 'POINT'), 'target'); }
function tier(state, config) {
  const tiers = sorted(rows(config, 'drawTiers', 'DrawTiers'));
  return tiers.find(t => t.tierId === (state?.selectedTierId ?? state?.tierId ?? state?.selectedTier)) || tiers[0];
}
function qualityColorAttr(id) { return `data-quality="${attr(id)}"`; }

function frame(content, screen, config) {
  return `<div class="activity-frame" data-screen="${attr(screen)}" aria-label="${esc(copy(config, 'TITLE', '扭蛋机活动'))}">${content}</div>`;
}
function debugLauncher() { return button('debug-open', '调试 / 外部供给', '', 'debug-launcher'); }

// R01/R02：外部场景只承接入口，绝不渲染主线棋盘或生成器。
function entry(state, config) {
  // R01：入口可见性直接依据已保存的资格、开关和可信时间计算，不依赖未写入的 UI 标志。
  const status = clock(state, config);
  const ended = state?.settlement?.status === 'FINALIZED';
  const settling = state?.settlement?.status === 'PENDING_MAKEUP';
  const started = status.trusted && Date.parse(state?.serverTime) >= Date.parse(config.activity.startAt);
  const reason = !status.trusted ? copy(config, 'TIME_UNKNOWN') :
    !started ? '活动尚未开始' :
    state?.level < config.activity.minLevel ? `需要达到${config.activity.minLevel}级` :
    state?.completedWave < config.activity.requiredWave ? `需要完成第${config.activity.requiredWave}波订单` :
    state?.qualified === false ? '活动资格不满足' :
    state?.mutualExclusionClear === false ? '存在互斥活动' :
    state?.resourcesReady === false ? '活动资源尚未就绪' :
    state?.switchState === 'HARD_OFF' ? '活动已硬关闭' :
    state?.switchState === 'SOFT_OFF' && !state?.initialized ? '软关后不再开启本期活动' :
    status.expired ? '活动已正式截止' : '';
  const show = !state?.readOnly && !ended && !settling && !reason;
  const endAt = Date.parse(config.activity.endAt);
  const now = Date.parse(state?.serverTime);
  const summaryAvailable = ended && status.trusted && Number.isFinite(now) &&
    now >= endAt && now < endAt + config.activity.settlementDays * 86400000 &&
    Boolean(state?.settlement?.summary);
  const single = sorted(rows(config, 'drawTiers', 'DrawTiers')).find(t => t.reads === 1);
  const attempts = single?.ticketCost ? Math.floor(num(state?.tickets) / single.ticketCost) : 0;
  const pending = rows(config, 'nodes', 'ProgressNodes').filter(n => n.nodeType === 'QUALITY' && getNodeStatus(state, config, n.nodeId)?.claimable).length;
  const badge = attempts || pending;
  return frame(`<div class="entry-scene"><div class="entry-sky" aria-hidden="true"></div>
    <div class="entry-heading"><small>独立限时活动</small><h1>${esc(copy(config, 'TITLE', '七天扭蛋奇遇'))}</h1><p>${esc(clock(state, config).label)}</p></div>
    <div class="entry-machine" aria-hidden="true">${machineArt(config.theme, 'idle')}</div>
    ${show ? button('entry-open', `<span>进入扭蛋机</span>${badge ? `<b class="entry-badge">${esc(badge)}</b>` : ''}`, '', 'entry-button') :
      `<div class="entry-unavailable">${esc(ended ? '本期活动已结束' : settling ? '正在进行结束结算' : unavailable(state, config) || reason || '活动暂不可进入')}</div>`}
    ${state?.readOnly && state?.initialized && !state?.settlement ? button('readonly-open', '查看已保存活动 · 只读', '', 'secondary-button ending-summary-entry') : ''}
    ${summaryAvailable ? button('ending-summary-open', '查看本期结束结果', '', 'secondary-button ending-summary-entry') : ''}
    <p class="entry-caption">${esc(state?.level < config.activity.minLevel ? `需要达到${config.activity.minLevel}级` : state?.completedWave < config.activity.requiredWave ? `需要完成第${config.activity.requiredWave}波订单` : state?.qualified === false ? '活动资格不满足' : state?.mutualExclusionClear === false ? '存在互斥活动' : state?.resourcesReady === false ? '活动资源尚未就绪' : state?.switchState === 'SOFT_OFF' && !state?.initialized ? '软关后不再开启本期活动' : '主线供券在调试入口以事件模拟。')}</p></div>${debugLauncher()}`, 'entry', config);
}

function hud(state, config) {
  return `<header class="machine-hud">
    ${button('machine-close', '<span aria-hidden="true">‹</span><span class="sr-only">离开活动</span>', 'aria-label="离开活动"', 'hud-back')}
    <div class="hud-title"><strong>${esc(copy(config, 'TITLE', '七天扭蛋奇遇'))}</strong><small>${esc(clock(state, config).label)}</small></div>
    <div class="ticket-pill" aria-label="扭蛋券余额">${rewardArt('star_crate', config.theme)}<span>扭蛋券 <b>${esc(num(state?.tickets))}</b></span></div>
    ${button('debug-open', '调试', 'aria-label="调试 / 外部供给"', 'debug-launcher')}</header>`;
}
function progressRail(state, config) {
  const nodes = pointNodes(config);
  const last = nodes.at(-1)?.target || 1;
  const points = num(state?.totalPoints);
  return `<section class="progress-panel" aria-label="累计积分阶段奖励"><div class="progress-heading"><span>累计积分 <b>${esc(points)}</b></span><span class="available-points">可用积分 <b>${esc(num(state?.availablePoints))}</b></span></div>
    <div class="progress-rail">
    <div class="progress-fill" aria-hidden="true" style="width:${Math.min(84, Math.max(0, points / last * 84))}%"></div>${nodes.map(node => {
      const status = getNodeStatus(state, config, node.nodeId);
      return button('node-preview', `<span class="medal">${rewardArt(rows(config, 'rewards', 'RewardCatalog').find(r => r.rewardId === node.rewardIds?.[0])?.iconKey, config.theme)}</span><small>${esc(node.target)}</small><span class="sr-only">${esc(node.label)}，${status?.claimed ? '已领取' : status?.reached ? '已达成' : '未达成'}</span>`,
        `data-node-id="${attr(node.nodeId)}" aria-label="${attr(node.label)}；${status?.claimed ? '已领取' : '查看奖励'}"`, `progress-node ${status?.claimed ? 'is-claimed' : status?.reached ? 'is-reached' : ''}`);
    }).join('')}</div></section>`;
}
function machine(state, config) {
  const chosen = tier(state, config);
  const busy = state?.processing === true || state?.busy === true || ['DRAWING', 'EXCHANGING'].includes(state?.phase);
  const blocked = Boolean(state?.readOnly || state?.persistenceStatus === 'READ_ONLY' || state?.saveError || !clock(state, config).trusted || !session(state));
  const pending = rows(config, 'nodes', 'ProgressNodes').some(n => n.nodeType === 'QUALITY' && getNodeStatus(state, config, n.nodeId)?.claimable);
  const unlocked = collectionCount(state, config) >= (rows(config, 'nodes', 'ProgressNodes').find(n => n.nodeType === 'COMPLETE')?.target ?? Infinity);
  return frame(`${hud(state, config)}${progressRail(state, config)}
    <main class="machine-main"><div class="machine-side left-side">${button('info-open', 'INFO', '', 'side-control')}${button('rules-open', '规则', '', 'side-control')}</div>
    <div class="machine-illustration" data-phase="${attr(state?.phase || 'idle')}">${machineArt(config.theme, state?.phase || 'idle')}</div>
    <div class="machine-side right-side">${button('collection-open', `收藏${pending ? '<i class="red-dot" aria-label="有可领取奖励"></i>' : ''}`, '', 'side-control')}
    ${button('shop-open', `兑换${unlocked && !state?.shopUnlockSeen ? '<i class="red-dot" aria-label="新功能"></i>' : ''}`, '', 'side-control')}</div></main>
    <footer class="draw-controls"><div class="tier-picker" role="group" aria-label="抽取倍率">${sorted(rows(config, 'drawTiers', 'DrawTiers')).map(item =>
      button('tier-select', `×${esc(item.reads)}`, `data-tier-id="${attr(item.tierId)}" aria-pressed="${item.tierId === chosen?.tierId}"`, `tier-chip ${item.tierId === chosen?.tierId ? 'is-selected' : ''}`, busy)).join('')}</div>
    ${button('draw', `<span>扭动旋钮 · 抽取 ${chosen ? `×${esc(chosen.reads)}` : ''}</span><small>消耗 ${esc(chosen?.ticketCost ?? '—')} 张扭蛋券</small>`, `data-tier-id="${attr(chosen?.tierId ?? '')}"`, 'draw-button', busy || blocked)}
    ${blocked ? `<p class="inline-warning">${esc(unavailable(state, config) || '当前会话不可操作')}</p>` : ''}</footer>`, 'machine', config);
}

function modal(id, title, body, actions = '', options = {}) {
  const close = options.close !== false;
  return `<div class="overlay" data-screen="${attr(id)}" data-popup-id="${attr(options.popupId ?? id)}" role="presentation">
    <section class="activity-modal ${options.className || ''}" role="dialog" aria-modal="true" aria-label="${attr(title)}">
      <header class="modal-header"><span class="modal-ornament" aria-hidden="true">✦</span><h2>${esc(title)}</h2>${close ? button(options.closeAction || 'popup-close', '×', `aria-label="关闭${attr(title)}"`, 'modal-close') : ''}</header>
      <div class="modal-content" data-scroll-region="${attr(id)}">${body}</div>
      ${actions ? `<footer class="modal-actions">${actions}</footer>` : ''}</section></div>`;
}
function cover(state, config) {
  return modal('cover', copy(config, 'TITLE', '七天扭蛋奇遇'), `<div class="cover-illustration">${machineArt(config.theme, 'idle')}</div><p>${esc(copy(config, 'COVER'))}</p><p class="time-label">${esc(clock(state, config).label)}</p>`,
    button('cover-start', '开启扭蛋奇遇', '', 'primary-button'), { closeAction: 'cover-close' });
}
function toyTile(toy, state, config) {
  const owned = has(state?.ownedToyIds, toy.toyId);
  const isNew = owned && has(state?.newToyIds, toy.toyId);
  return `<div class="toy-tile ${owned ? 'is-owned' : 'is-locked'}" ${qualityColorAttr(toy.qualityId)} data-toy-id="${attr(toy.toyId)}">
    <div class="toy-figure">${toyArt(toy.shapeKey, toy.qualityId, owned ? 'owned' : 'locked', config.theme)}</div>
    ${isNew ? '<span class="new-mark">NEW</span>' : ''}<span class="toy-name">${owned ? esc(toy.name) : '未获得'}</span></div>`;
}
function collection(state, config) {
  const toys = rows(config, 'toys', 'GachaToy');
  const groups = sorted(rows(config, 'nodes', 'ProgressNodes').filter(n => n.nodeType === 'QUALITY'));
  const complete = rows(config, 'nodes', 'ProgressNodes').find(n => n.nodeType === 'COMPLETE');
  const body = `<div class="collection-total">玩具图鉴 <strong>${collectionCount(state, config)}/${totalToys(config)}</strong></div>
    ${groups.map(group => {
      const status = getNodeStatus(state, config, group.nodeId);
      const members = sorted(toys.filter(toy => toy.collectionId === group.collectionId));
      return `<section class="collection-group" ${qualityColorAttr(members[0]?.qualityId)}><div class="group-header"><h3>${esc(qualityName[members[0]?.qualityId] || group.label)}</h3><span>${esc(status?.current ?? 0)}/${esc(group.target)}</span></div>
        <div class="toy-grid">${members.map(toy => toyTile(toy, state, config)).join('')}</div>
        <div class="group-reward"><div class="reward-preview">${rewardList(group.rewardIds, config)}</div>
          ${button('claim-node', status?.claimed ? '已领取 ✓' : status?.claimable ? '领取品质奖励' : '尚未集齐', `data-node-id="${attr(group.nodeId)}"`, `claim-button ${status?.claimable ? 'can-claim' : ''}`, !status?.claimable)}</div></section>`;
    }).join('')}
    ${complete ? `<section class="complete-reward"><h3>全收藏大奖 · ${esc(collectionCount(state, config))}/${esc(complete.target)}</h3><div>${rewardList(complete.rewardIds, config)}</div><p>${getNodeStatus(state, config, complete.nodeId)?.claimed ? '已自动发放 · 兑换商店已开放' : '集齐后自动发放，无需先领取品质奖励'}</p></section>` : ''}`;
  return modal('collection', '玩具收藏', body, button('panel-back', '返回扭蛋机', '', 'secondary-button'), { closeAction: 'panel-back' });
}
function shop(state, config) {
  const body = `<div class="shop-balance">可用积分 <b>${esc(num(state?.availablePoints))}</b></div>
    <p class="shop-note">${esc(collectionCount(state, config) >= totalToys(config) ? copy(config, 'SHOP_UNLOCK') : copy(config, 'SHOP_LOCK'))}</p>
    <div class="shop-items">${sorted(rows(config, 'shop', 'GachaShop')).map(item => {
      const status = getShopItemStatus(state, item.id, config);
      const reward = rows(config, 'rewards', 'RewardCatalog').find(row => row.rewardId === item.rewardId);
      const label = status.status === 'SOLD_OUT' ? '已售罄' : status.status === 'LOCKED' ? '尚未解锁' : status.status === 'INSUFFICIENT_POINTS' ? '积分不足' : status.status === 'AVAILABLE' ? '兑换' : '暂不可兑';
      return `<article class="shop-item" data-item-id="${attr(item.id)}"><div class="shop-item-art">${rewardArt(reward?.iconKey, config.theme)}</div><div class="shop-item-detail"><h3>${esc(reward?.name || item.rewardId)} ×${esc(reward?.quantity ?? '—')}</h3><p>单次 ${esc(item.pointPrice)} 积分 · ${item.exchangeLimit === -1 ? '不限次数' : `剩余 ${esc(status.remaining ?? 0)} 次`}</p></div>
        ${button('exchange-open', label, `data-item-id="${attr(item.id)}"`, `shop-exchange ${status.canExchange ? 'is-ready' : ''}`)}
        ${!status.canExchange && status.message ? `<small class="shop-reason">${esc(status.message)}</small>` : ''}</article>`;
    }).join('')}</div>`;
  return modal('shop', '积分兑换商店', body, button('panel-back', '返回扭蛋机', '', 'secondary-button'), { closeAction: 'panel-back' });
}
function info(state, config) {
  const layerId = state?.layerId || state?.selectedLayerId || config?.playerLayers?.[0]?.layerId;
  const layer = rows(config, 'playerLayers', 'PlayerLayers').find(row => row.layerId === layerId);
  const full = getSequenceShares(config, layerId, 'FULL');
  const loop = getSequenceShares(config, layerId, 'LOOP');
  const activeScope = state?.infoScope === 'LOOP' ? 'LOOP' : 'FULL';
  const shares = activeScope === 'LOOP' ? loop : full;
  const count = shares[0]?.total ?? 0;
  const body = `<div class="info-intro"><p>${esc(copy(config, 'INFO_SCOPE'))}</p>
    <p>适用分层：${esc(layerId || '—')} · 序列组：${esc(layer?.sequenceGroup || '—')} · ${activeScope === 'LOOP' ? '末房间循环范围' : '完整固定序列'}：${esc(count)} 项</p>
    <p>统计房间：${esc(shares[0]?.roomIds?.join('、') || '—')}。占比是固定序列投放频次，不预测下一抽；未投放项明确显示 0%。</p></div>
    <div class="info-scopes" role="group" aria-label="投放统计范围">${button('info-scope', '完整序列', 'data-scope="FULL"', activeScope === 'FULL' ? 'is-selected' : '')}${button('info-scope', '末房间循环', 'data-scope="LOOP"', activeScope === 'LOOP' ? 'is-selected' : '')}</div>
    <div class="shares-heading"><span>单项奖励 / 数量</span><span>次数 · 投放占比</span></div>
    <div class="share-list">${shares.map(item => `<div class="share-row" ${item.qualityId ? qualityColorAttr(item.qualityId) : ''}>
      <div class="share-icon">${item.toyId ? toyArt(item.shapeKey, item.qualityId, 'owned', config.theme) : rewardArt(item.iconKey, config.theme)}</div>
      <div class="share-name"><strong>${esc(item.name)} ×${esc(item.quantity)}</strong><small>${item.toyId ? `${esc(qualityName[item.qualityId])} · 首次点亮 / 重复 +${esc(item.duplicatePoints)} 分` : '主游戏奖励 · 模拟承接'}</small></div>
      <div class="share-percent"><strong>${esc(item.displayValue)}</strong><small>${esc(item.count)}/${esc(item.total)}</small></div></div>`).join('')}
      ${!shares.length ? '<p>当前范围没有可统计的序列配置。</p>' : ''}</div>
    <p class="info-footnote">仅实际投放项的显示百分比合计 100%；极小的非零占比统一提高显示精度，尾项吸收展示尾差。条件达成奖励不计入投放占比。</p>`;
  return modal('info', '奖励投放占比 INFO', body, button('panel-back', '返回扭蛋机', '', 'secondary-button'), { closeAction: 'panel-back' });
}
function rulesGuide(state, config, guide = false) {
  const lines = sorted(rows(config, 'copy', 'UiCopy').filter(row => row.screen === 'rulesGuide' && row.copyId.startsWith(guide ? 'GUIDE_' : 'RULE_')));
  const index = Math.max(0, Math.min(lines.length - 1, num(state?.guideIndex)));
  return modal(guide ? 'guide' : 'rulesGuide', guide ? '新手引导' : '活动说明', guide ?
    `<div class="guide-progress">${esc(index + 1)} / ${esc(lines.length)}</div><div class="guide-art">${machineArt(config.theme, 'idle')}</div><p>${esc(lines[index]?.text || '')}</p>` :
    `<ol class="rules-list">${lines.map(row => `<li>${esc(row.text)}</li>`).join('')}<li>${esc(copy(config, 'COVER'))}</li></ol>`,
    guide ? `${button('guide-skip', '跳过引导', '', 'secondary-button')}${button('guide-next', index + 1 >= lines.length ? '完成引导' : '下一步', '', 'primary-button')}` : button('panel-back', '明白了', '', 'primary-button'),
    { closeAction: guide ? 'guide-skip' : 'panel-back' });
}

function resultsFrom(state, data) {
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.items)) return data.items;
  const transaction = data?.transaction || state?.lastDraw || state?.lastDrawResult;
  return transaction?.results || transaction?.items || [];
}
function drawResult(state, config, data = {}) {
  const results = resultsFrom(state, data);
  const points = data?.pointsDelta ?? data?.pointDelta ?? data?.transaction?.pointsDelta ?? results.reduce((sum, r) => sum + num(r.pointsDelta ?? r.points), 0);
  const body = `<p class="result-summary">按序揭晓 ${esc(results.length)} 项结果${points ? ` · 重复玩具合计 +${esc(points)} 积分` : ''}</p>
    <div class="result-grid">${results.map((result, index) => {
      const toy = rows(config, 'toys', 'GachaToy').find(row => row.toyId === (result.toyId || result.rewardId));
      const reward = rows(config, 'rewards', 'RewardCatalog').find(row => row.rewardId === result.rewardId);
      const duplicate = result.isDuplicate === true || result.duplicate === true;
      return `<div class="result-item ${duplicate ? 'is-duplicate' : ''}" ${toy ? qualityColorAttr(toy.qualityId) : ''}><span class="result-index">${esc(index + 1)}</span>
        <div class="result-art">${toy ? toyArt(toy.shapeKey, toy.qualityId, 'owned', config.theme) : rewardArt(reward?.iconKey || result.iconKey, config.theme)}${duplicate && toy ? `<b class="duplicate-points" data-duplicate-points="${esc(result.pointsDelta ?? result.points ?? 0)}">重复 +${esc(result.pointsDelta ?? result.points ?? 0)} 积分</b>` : ''}</div>
        <strong>${esc(toy?.name || reward?.name || result.name || result.rewardId)}</strong><small>${toy ? esc(qualityName[toy.qualityId]) : `×${esc(result.quantity ?? reward?.quantity ?? '—')}`}</small>
        ${duplicate ? '<small class="duplicate-label">重复藏品 · 点击收下后积分飞入进度条</small>' : toy ? '<b class="new-mark">NEW · 首次收藏</b>' : `<small>${reward?.delivery === 'MOCK_PENDING' ? '模拟待领奖' : '模拟到账'}</small>`}</div>`;
    }).join('')}</div>`;
  return modal('drawResult', '扭蛋揭晓', body, button('result-close', '收下结果', '', 'primary-button'));
}
function claim(state, config, data = {}) {
  const id = data.nodeId || state?.selectedNodeId || state?.claimNodeId;
  const node = rows(config, 'nodes', 'ProgressNodes').find(row => row.nodeId === id);
  const status = id ? getNodeStatus(state, config, id) : null;
  const exchangeRewards = !node && Array.isArray(data.ledgerEntries)
    ? data.ledgerEntries.map(entry => rewardLine(entry.rewardId, config)).join('') : '';
  return modal('claim', node?.label || (data.source === 'EXCHANGE' ? '兑换奖励' : '奖励展示'), `<div class="claim-art">${node ? rewardList(node.rewardIds, config) : exchangeRewards}</div><p>${data.source === 'EXCHANGE' ? '兑换已确认，奖励已记录为模拟到账或模拟待领奖。' : status?.claimed ? '奖励已记录到账，不会重复发放。' : status?.claimable ? '已集齐本组玩具，请确认领取品质奖励。' : status?.reached ? '已达成，奖励自动结算。' : '尚未达到领取条件。'}</p>`,
    status?.claimable ? button('claim-confirm', '确认领取', `data-node-id="${attr(id)}"`, 'primary-button') : button('popup-close', '知道了', '', 'primary-button'));
}
function exchangeConfirm(state, config, data = {}) {
  const id = data.itemId || state?.selectedItemId || state?.exchangeItemId;
  const item = rows(config, 'shop', 'GachaShop').find(row => row.id === id);
  const reward = rows(config, 'rewards', 'RewardCatalog').find(row => row.rewardId === item?.rewardId);
  const status = id ? getShopItemStatus(state, id, config) : null;
  return modal('exchangeConfirm', '确认兑换', `<div class="exchange-preview">${reward ? rewardArt(reward.iconKey, config.theme) : ''}<strong>${esc(reward?.name || '未知商品')} ×${esc(reward?.quantity ?? '—')}</strong></div>
    <p>消耗可用积分 ${esc(item?.pointPrice ?? '—')} · ${item?.exchangeLimit === -1 ? '不限次' : `本期剩余 ${esc(status?.remaining ?? 0)} 次`}</p><p>累计积分进度不会回退。${!status?.canExchange ? esc(status?.message || '') : ''}</p>`,
    `${button('exchange-cancel', '取消', '', 'secondary-button')}${button('exchange-confirm', '确认兑换', `data-item-id="${attr(id || '')}"`, 'primary-button', !status?.canExchange)}`,
    { closeAction: 'exchange-cancel' });
}
function ending(state, config) {
  const summary = state?.settlement?.summary || state?.settlement || {};
  const collected = summary.collectedCount ?? summary.ownedCount ?? collectionCount(state, config);
  return modal('ending', '本期活动结束', `<div class="ending-emblem">${rewardArt('star_crate', config.theme)}</div><p>收藏完成 <strong>${esc(collected)}/${esc(totalToys(config))}</strong></p><p>${esc(copy(config, 'END'))}</p>`,
    button('ending-confirm', '好的', '', 'primary-button'), { closeAction: 'ending-close' });
}
function endingSummary(state, config) {
  const summary = state?.settlement?.summary;
  return modal('endingSummary', '本期结束结果', `<div class="ending-emblem">${rewardArt('star_crate', config.theme)}</div><p>收藏完成 <strong>${esc(summary?.collectedCount ?? 0)}/${esc(summary?.totalToyCount ?? totalToys(config))}</strong></p><p>结束时剩余扭蛋券 ${esc(summary?.closingTickets ?? 0)} 张 · 累计积分 ${esc(summary?.closingTotalPoints ?? 0)} · 可用积分 ${esc(summary?.closingAvailablePoints ?? 0)}</p><p>已补发节点：${esc(summary?.makeupNodeIds?.join('、') || '无')}。本期活动资产已结算；主游戏模拟奖励账本保留。</p>`, button('ending-summary-close', '返回', '', 'primary-button'), { closeAction: 'ending-summary-close' });
}
function makeup(state, config) {
  const list = state?.settlement?.makeup || state?.settlement?.pendingRewards || state?.settlement?.makeupItems || [];
  const items = (Array.isArray(list) ? list : Object.values(list)).filter(entry => !entry.status || entry.status === 'PENDING');
  return modal('makeup', '活动奖励补发', `<p>仅展示已达成且尚未到账的奖励；已经到账的奖励不会重复发放。</p><div class="makeup-list">${items.map(entry => {
    const node = rows(config, 'nodes', 'ProgressNodes').find(row => row.nodeId === (entry.nodeId || entry));
    return `<div class="makeup-item"><strong>${esc(node?.label || entry.label || entry.sourceId || '待补发奖励')}</strong><div>${rewardList(entry.rewardIds || node?.rewardIds || [], config)}</div></div>`;
  }).join('') || '<p>没有待补发奖励。</p>'}</div>`, button('makeup-claim', items.length ? '领取补发奖励' : '完成结算', '', 'primary-button'), { close: false });
}
function unavailableModal(state, config) {
  return modal('unavailable', '活动暂不可用', `<p>${esc(unavailable(state, config) || '当前操作暂不可进行，请稍后再试。')}</p>`, button('popup-close', '知道了', '', 'primary-button'));
}

function debug(state, config) {
  const rules = rows(config, 'supplyRules', 'SupplyRules');
  const order = rules.find(rule => rule.source === 'ORDER_SETTLED');
  const generator = rules.find(rule => rule.source === 'GENERATOR_OUTPUT');
  const activity = config.activity || {};
  const sim = state?.simulatedServer || state?.serverClock || state?.clock || {};
  const current = sim.now ?? sim.nowAt ?? sim.serverNow ?? sim.time ?? state?.serverTime ?? '';
  const events = Array.isArray(state?.eventLog) ? state.eventLog : [];
  const ledger = Array.isArray(state?.rewardLedger) ? state.rewardLedger : [];
  const lines = ledger.map(row => `<li><b>${esc(row.name || row.rewardId)} ×${esc(row.quantity)}</b><small>${esc(row.delivery === 'MOCK_PENDING' ? '模拟待领奖' : '模拟到账')} · 来源 ${esc(row.sourceId || '')}</small></li>`).join('');
  const body = `<p class="debug-warning">仅模拟外部事件与服务器状态；订单、主棋盘和生成器不是本活动的可玩页面。</p>
    <section class="debug-section"><h3>订单结算 · ${esc(order?.scope || '')}</h3><p>成功发券 ${esc(order?.ticketsOnHit ?? '—')} 张 / 唯一事件</p>
      ${button('debug-order-success', '模拟结算成功', '', 'debug-button')}${button('debug-order-fail', '模拟结算失败', '', 'debug-button')}
    </section><section class="debug-section"><h3>生成器有效产出 · ${esc(generator?.scope || '')}</h3><p>配置命中率 ${esc(generator?.hitRate == null ? '—' : `${Math.round(generator.hitRate * 100)}%`)}；命中发券 ${esc(generator?.ticketsOnHit ?? '—')} 张</p>
      ${button('debug-generator-hit', '模拟有效产出 · 命中', '', 'debug-button')}${button('debug-generator-miss', '模拟有效产出 · 未命中', '', 'debug-button')}${button('debug-generator-fail', '模拟产出失败', '', 'debug-button')}
    </section><section class="debug-section"><h3>事件去重</h3><label>模拟事件 ID <input data-debug-field="eventId" aria-label="模拟事件ID" value="${attr(state?.debugEventId || '')}" placeholder="留空由输入层生成" /></label>${button('debug-replay', '重放同一事件 ID', '', 'debug-button')}<p>同一事件 ID 成功结算后再次发送，不得再次发券。</p></section>
    <section class="debug-section"><h3>模拟服务器与资格</h3><p>配置期次 ${esc(activity.periodId)} · 最低 ${esc(activity.minLevel)} 级 · 订单第 ${esc(activity.requiredWave)} 波</p>
      <label>等级 <input data-debug-field="level" type="number" inputmode="numeric" value="${attr(state?.level ?? state?.playerLevel ?? '')}" /></label>
      <label>订单波次 <input data-debug-field="wave" type="number" inputmode="numeric" value="${attr(state?.wave ?? state?.completedWave ?? '')}" /></label>
      <label>玩家分层 <select data-debug-field="layerId">${rows(config, 'playerLayers', 'PlayerLayers').map(layer => `<option value="${attr(layer.layerId)}" ${layer.layerId === (state?.layerId || state?.selectedLayerId) ? 'selected' : ''}>${esc(layer.layerId)}</option>`).join('')}</select></label>
      <label>服务器时间 <input data-debug-field="serverTime" type="text" value="${attr(current)}" placeholder="ISO 时间" /></label>
      <label>活动资格 <select data-debug-field="qualified"><option value="true" ${state?.qualified !== false ? 'selected' : ''}>符合</option><option value="false" ${state?.qualified === false ? 'selected' : ''}>不符合</option></select></label>
      <label>互斥关系 <select data-debug-field="mutualExclusionClear"><option value="true" ${state?.mutualExclusionClear !== false ? 'selected' : ''}>无冲突</option><option value="false" ${state?.mutualExclusionClear === false ? 'selected' : ''}>存在冲突</option></select></label>
      <label>活动资源状态 <select data-debug-field="resourcesReady"><option value="true" ${state?.resourcesReady !== false ? 'selected' : ''}>已就绪</option><option value="false" ${state?.resourcesReady === false ? 'selected' : ''}>未就绪</option></select></label>
      <label>时间可信 <select data-debug-field="timeTrusted"><option value="true" ${clock(state, config).trusted ? 'selected' : ''}>已确认</option><option value="false" ${!clock(state, config).trusted ? 'selected' : ''}>待确认</option></select></label>
      <label>开关 <select data-debug-field="switchState">${['OPEN', 'SOFT_OFF', 'HARD_OFF'].map(value => `<option value="${value}" ${value === (state?.switchState || activity.switchState) ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
      ${button('debug-apply', '应用模拟状态', '', 'debug-button')}${button('debug-expire', '时间设为正式截止', '', 'debug-button')}${button('debug-relogin', '模拟重登 / 离开到期会话', '', 'debug-button')}
    </section><section class="debug-section"><h3>本地事件日志</h3><ol class="debug-log">${events.slice().reverse().map(event => `<li><b>${esc(event.kind || event.type || event.eventName || event.action || '事件')}</b><small>ID ${esc(event.eventId || event.id || '—')} · 期次 ${esc(event.periodId || state?.periodId || activity.periodId)} · 节点 ${esc(event.nodeId || '—')} · ${esc(event.reason || event.result || event.message || (event.ok === false ? '拒绝' : '已记录'))}</small></li>`).join('') || '<li>暂无事件</li>'}</ol></section>
    <section class="debug-section"><h3>奖励账本 · ${esc(ledger.length)} 条</h3><ol class="debug-log">${lines || '<li>暂无到账或待领奖记录</li>'}</ol></section>
    <section class="debug-section"><h3>测试实例与只读恢复</h3><p>重新试玩仅重置当前测试实例；不模拟领奖，不覆盖平台配置。存档故障演示只切换只读界面，不损坏本地存储。</p>${button('debug-reset', '重新试玩当前测试实例', '', 'debug-button danger-button')}${button('debug-storage-fail', '模拟存档不可用 · 只读浏览', '', 'debug-button')}</section>`;
  return modal('debug', '活动 Debug', body, button('debug-close', '返回活动', '', 'secondary-button'), { closeAction: 'debug-close', className: 'debug-modal' });
}

function activePopup(state) {
  const queue = state?.popupQueue;
  const entry = Array.isArray(queue) ? queue[0] : null;
  return entry || state?.activePopup || state?.popup || null;
}
function popupKind(popup) {
  if (typeof popup === 'string') return popup;
  return popup?.screen || popup?.type || popup?.kind || popup?.popupType || popup?.id || '';
}
function overlay(state, config) {
  const popup = activePopup(state);
  const kind = popupKind(popup);
  const data = typeof popup === 'object' && popup ? popup : {};
  if (kind) {
    const normalized = String(kind).toLowerCase().replace(/[_\s-]/g, '');
    if (normalized.includes('cover')) return cover(state, config);
    if (normalized.includes('guide')) return rulesGuide(state, config, true);
    if (normalized.includes('draw') || normalized.includes('result')) return drawResult(state, config, data);
    if (normalized.includes('exchange') && normalized.includes('confirm')) return exchangeConfirm(state, config, data);
    if (normalized.includes('claim') || normalized.includes('stage') || normalized.includes('reward')) return claim(state, config, data);
    if (normalized.includes('ending') || normalized === 'end') return ending(state, config);
    if (normalized.includes('makeup')) return makeup(state, config);
    if (normalized.includes('unlock')) return modal('shopUnlock', '兑换商店已开放', `<p>${esc(copy(config, 'SHOP_UNLOCK'))}</p>`, button('popup-close', '去看看', '', 'primary-button'));
    if (normalized.includes('unavailable') || normalized.includes('error')) return unavailableModal(state, config);
  }
  const screen = state?.screen;
  switch (screen) {
    case 'cover': return cover(state, config);
    case 'collection': return collection(state, config);
    case 'shop': return shop(state, config);
    case 'info': return info(state, config);
    case 'rulesGuide': case 'rules': return rulesGuide(state, config);
    case 'guide': return rulesGuide(state, config, true);
    case 'drawResult': return drawResult(state, config);
    case 'claim': return claim(state, config);
    case 'exchangeConfirm': return exchangeConfirm(state, config);
    case 'ending': return ending(state, config);
    case 'endingSummary': return endingSummary(state, config);
    case 'makeup': return makeup(state, config);
    case 'unavailable': return unavailableModal(state, config);
    default: return '';
  }
}

/** R12：保留长弹层滚动位置，避免状态刷新后跳回列表顶部。 */
export function renderApp(root, state, config) {
  if (!root) return;
  const previous = new Map([...root.querySelectorAll('[data-scroll-region]')].map(node => [node.dataset.scrollRegion, node.scrollTop]));
  themeVars(root, config?.theme);
  const screen = state?.screen || 'entry';
  const inside = session(state) && !['entry', 'ending', 'makeup'].includes(screen);
  const base = inside ? machine(state, config) : entry(state, config);
  const layer = screen === 'debug' ? debug(state, config) : overlay(state, config);
  // Debug 保持独立固定入口；活动内二级界面返回不会关闭本次会话。
  // R02：独立于 inert 主界面的安全区入口，可在封面、二级页和已确认结果弹层上方打开 Debug。
  // Debug 本身显示时不叠放第二个入口；原业务弹窗队列不因此关闭。
  const overlayDebug = layer && screen !== 'debug'
    ? button('debug-open', '调试', 'data-overlay-debug="" aria-label="调试 / 外部供给"', 'overlay-debug-launcher') : '';
  root.innerHTML = `${base}${layer}${overlayDebug}<div class="activity-toast" role="status" aria-live="polite">${esc(state?.toast?.message || state?.toast || '')}</div>`;
  // R10：模态弹层出现时底层机台不可聚焦或接收点击；跳过出蛋表现
  // 是输入层随后单独添加的控件，不属于被隔离的底层主界面。
  const baseFrame = root.querySelector('.activity-frame');
  if (baseFrame && layer) {
    baseFrame.inert = true;
    baseFrame.setAttribute('aria-hidden', 'true');
  }
  for (const node of root.querySelectorAll('[data-scroll-region]')) {
    if (previous.has(node.dataset.scrollRegion)) node.scrollTop = previous.get(node.dataset.scrollRegion);
  }
}
