export const CHAIN = Object.freeze(["🌱", "🌿", "🌷", "🌻", "💐", "🏵️", "👑"]);

export const INITIAL_STATE = Object.freeze({
  version: 2,
  energy: 24,
  stars: 0,
  highestTier: 0,
  goalTier: 5,
  selected: null,
  board: Array(36).fill(null),
  infoOpen: false,
  toast: "",
  toastNonce: 0,
  milestoneNonce: 0,
  effect: null,
});

export function createInitialState() {
  return structuredClone(INITIAL_STATE);
}
