import { createInitialState } from "./state.js";

export function createEngine(onChange) {
  let state = createInitialState();
  const emit = () => onChange(structuredClone(state));
  const freeIndices = () => state.board.map((item, index) => item ? null : index).filter(Number.isInteger);
  const message = (text) => { state.toast = text; state.toastNonce += 1; };

  function discover(tier) {
    const previous = state.highestTier;
    state.highestTier = Math.max(state.highestTier, tier);
    if (previous < state.goalTier && state.highestTier >= state.goalTier) {
      state.stars += 1;
      state.milestoneNonce += 1;
      message("目标花束完成，获得星星 ×1");
    }
  }

  function spawn() {
    if (state.energy < 1) { message("体力不足：完成订单可补充体力"); return emit(); }
    const free = freeIndices();
    if (!free.length) { message("棋盘已满：先合成或移动棋子"); return emit(); }
    state.energy -= 1;
    const index = free[Math.floor(Math.random() * free.length)];
    const tier = Math.random() < .18 ? 2 : 1;
    state.board[index] = { tier, id: Date.now() + Math.random() };
    state.selected = null;
    state.effect = { type: "spawn", index, nonce: Date.now() };
    discover(tier);
    message(`消耗体力 ×1，获得 ${tier} 级棋子`);
    emit();
  }

  function act(source, target) {
    if (!Number.isInteger(source) || !Number.isInteger(target) || source === target) return;
    const from = state.board[source];
    const to = state.board[target];
    if (!from) return;
    if (!to) {
      state.board[target] = from;
      state.board[source] = null;
      state.selected = null;
      state.effect = { type: "move", index: target, nonce: Date.now() };
      return emit();
    }
    if (from.tier === to.tier) {
      const tier = Math.min(7, from.tier + 1);
      state.board[source] = null;
      state.board[target] = { tier, id: Date.now() + Math.random() };
      state.selected = null;
      state.effect = { type: "merge", index: target, nonce: Date.now() };
      discover(tier);
      message(tier === 7 ? "已合成最高级皇冠花束！" : `合成成功：获得 ${tier} 级棋子`);
      return emit();
    }
    state.selected = null;
    message("只有相同等级的棋子才能合成");
    emit();
  }

  function select(index) {
    if (state.selected === null) {
      if (!state.board[index]) return;
      state.selected = index;
      return emit();
    }
    if (state.selected === index) { state.selected = null; return emit(); }
    act(state.selected, index);
  }

  return {
    getState: () => structuredClone(state),
    spawn,
    select,
    act,
    addEnergy: () => { state.energy += 5; message("订单完成，体力 +5"); emit(); },
    toggleInfo: () => { state.infoOpen = !state.infoOpen; emit(); },
    closeDemo: () => { message("Demo 中关闭按钮仅作界面展示"); emit(); },
    reset: () => { state = createInitialState(); message("已恢复初始状态"); emit(); },
    clearToast: (nonce) => { if (state.toastNonce === nonce) { state.toast = ""; emit(); } },
  };
}
