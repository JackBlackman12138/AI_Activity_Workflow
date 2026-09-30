import { CHAIN } from "./state.js";

function ChainView(state) {
  return CHAIN.map((icon, index) => {
    const tier = index + 1;
    const classes = ["chain-node", tier <= state.highestTier ? "reached" : "", tier === state.highestTier ? "current" : ""].filter(Boolean).join(" ");
    return `<div class="${classes}" data-chain-tier="${tier}">${icon}<b>Lv.${tier}</b></div>`;
  }).join("");
}

function BoardView(state) {
  return state.board.map((item, index) => {
    const valid = state.selected !== null && item && state.board[state.selected]?.tier === item.tier && state.selected !== index;
    const cellClass = ["cell", item ? "filled" : "", state.selected === index ? "selected" : "", valid ? "valid" : ""].filter(Boolean).join(" ");
    const effect = state.effect?.index === index ? state.effect.type : "";
    const piece = item ? `<span class="piece ${effect}" draggable="true" data-piece="${index}">${CHAIN[item.tier - 1]}<b>${item.tier}</b></span>` : "";
    return `<button class="${cellClass}" type="button" data-cell="${index}" aria-label="${item ? `${item.tier}级棋子` : "空格"}">${piece}</button>`;
  }).join("");
}

export function AppView(state) {
  const progress = Math.min(100, state.highestTier / state.goalTier * 100);
  return `<section class="page"><article class="app-shell">
    <header class="topbar">
      <button class="round-btn" data-action="info" aria-label="玩法说明">?</button>
      <div class="title-pill">海风花园<small>🌤️ 5天11时</small></div>
      <button class="round-btn" data-action="close" aria-label="关闭">×</button>
    </header>
    <section class="scene" aria-label="主题场景">
      <div class="sun"></div><div class="cloud"></div><div class="island"></div><div class="water"></div>
      <div class="scene-copy">本轮目标 · 合成 5 级花束</div><div class="boat">🛶</div>
      <div class="resource">⚡ <span>${state.energy}</span></div>
      <button class="primary" data-action="spawn" ${state.energy < 1 ? "disabled" : ""}>培育棋子 · ⚡1</button>
    </section>
    <section class="growth">
      <button class="mini-card guide-button" data-action="info"><span>📖</span>INFO</button>
      <div class="mini-card chain-card"><div class="chain-title"><span>花朵合成链</span><span>左右拖动 ↔</span></div><div class="chain-scroll" id="chainScroll"><div class="chain">${ChainView(state)}</div></div></div>
    </section>
    <div class="goal-strip"><span>⭐ ${state.stars}</span><div class="bar"><span style="width:${progress}%"></span></div><span>Lv.${state.highestTier || 0}/${state.goalTier}</span></div>
    <section class="board-panel">
      <div class="board" id="board">${BoardView(state)}</div>
      <p class="board-hint">拖动同级棋子合成 · 拖到空格移动 · 也支持点击操作</p>
      <div class="utilities"><button class="utility" data-action="energy">完成订单 · ⚡+5</button><button class="utility alt" data-action="reset">DEBUG · 一键重置</button></div>
    </section>
    <div class="toast ${state.toast ? "show" : ""}" role="status">${state.toast}</div>
    <aside class="milestone ${state.milestoneNonce ? "show" : ""}" data-milestone="${state.milestoneNonce}"><strong>目标完成！ ✨</strong><span>获得星星 ×1 · 可以继续合成更高等级</span></aside>
    <div class="backdrop ${state.infoOpen ? "open" : ""}" data-backdrop>
      <section class="modal" role="dialog" aria-modal="true"><div class="modal-head"><h2>怎么玩？</h2><button class="close" data-action="info">×</button></div>
      <ol><li>点击【培育棋子】消耗 1 点体力。</li><li>把两个同等级棋子拖到一起，合成高一级棋子。</li><li>合出 5 级花束即可获得一颗星星。</li></ol><p>棋盘满或体力不足时会出现短提示；DEBUG 可以恢复初始状态。</p></section>
    </div>
  </article></section>`;
}
