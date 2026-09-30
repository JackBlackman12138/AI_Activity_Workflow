import { AppView } from "./components.js";
import { createEngine } from "./game-engine.js";

const root = document.querySelector("#app");
const fxLayer = document.querySelector("#fxLayer");
let toastTimer;
let chainDrag = null;
let lastEffectNonce = null;
let lastMilestoneNonce = 0;
let lastHighestTier = 0;

function sparks(index) {
  const cell = root.querySelector(`[data-cell="${index}"]`);
  if (!cell) return;
  const rect = cell.getBoundingClientRect();
  for (let i = 0; i < 9; i += 1) {
    const dot = document.createElement("i");
    dot.className = "spark";
    dot.style.left = `${rect.left + rect.width / 2}px`;
    dot.style.top = `${rect.top + rect.height / 2}px`;
    dot.style.setProperty("--dx", `${Math.cos(i / 9 * Math.PI * 2) * (34 + Math.random() * 18)}px`);
    dot.style.setProperty("--dy", `${Math.sin(i / 9 * Math.PI * 2) * (34 + Math.random() * 18)}px`);
    fxLayer.appendChild(dot);
    setTimeout(() => dot.remove(), 750);
  }
}

function render(state) {
  const scrollLeft = root.querySelector("#chainScroll")?.scrollLeft || 0;
  const isNewEffect = Boolean(state.effect?.nonce && state.effect.nonce !== lastEffectNonce);
  root.innerHTML = AppView(state);
  if (!isNewEffect) root.querySelectorAll(".piece.spawn,.piece.merge").forEach((node) => node.classList.remove("spawn", "merge"));
  else lastEffectNonce = state.effect.nonce;
  if (state.milestoneNonce === lastMilestoneNonce) root.querySelector(".milestone")?.classList.remove("show");
  else lastMilestoneNonce = state.milestoneNonce;
  if (state.highestTier === lastHighestTier) root.querySelector(".chain-node.current")?.classList.remove("current");
  else lastHighestTier = state.highestTier;
  const scroller = root.querySelector("#chainScroll");
  if (scroller) scroller.scrollLeft = scrollLeft;
  if (state.effect?.type === "merge" && isNewEffect) requestAnimationFrame(() => sparks(state.effect.index));
  if (state.highestTier) root.querySelector(`[data-chain-tier="${state.highestTier}"]`)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  clearTimeout(toastTimer);
  if (state.toast) toastTimer = setTimeout(() => engine.clearToast(state.toastNonce), 1600);
}

const engine = createEngine(render);

root.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "spawn") engine.spawn();
  else if (action === "energy") engine.addEnergy();
  else if (action === "reset") engine.reset();
  else if (action === "info") engine.toggleInfo();
  else if (action === "close") engine.closeDemo();
  else if (event.target.matches("[data-backdrop]")) engine.toggleInfo();
  else {
    const cell = event.target.closest("[data-cell]");
    if (cell) engine.select(Number(cell.dataset.cell));
  }
});

root.addEventListener("dragstart", (event) => {
  const piece = event.target.closest("[data-piece]");
  if (!piece) return;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", piece.dataset.piece);
});
root.addEventListener("dragover", (event) => { if (event.target.closest("[data-cell]")) event.preventDefault(); });
root.addEventListener("drop", (event) => {
  const cell = event.target.closest("[data-cell]");
  if (!cell) return;
  event.preventDefault();
  const source = Number(event.dataTransfer.getData("text/plain"));
  if (Number.isInteger(source)) engine.act(source, Number(cell.dataset.cell));
});

root.addEventListener("pointerdown", (event) => {
  const scroller = event.target.closest("#chainScroll");
  if (!scroller) return;
  chainDrag = { scroller, x: event.clientX, left: scroller.scrollLeft };
  scroller.classList.add("dragging");
  scroller.setPointerCapture(event.pointerId);
});
root.addEventListener("pointermove", (event) => { if (chainDrag) chainDrag.scroller.scrollLeft = chainDrag.left - (event.clientX - chainDrag.x); });
root.addEventListener("pointerup", () => { chainDrag?.scroller.classList.remove("dragging"); chainDrag = null; });

render(engine.getState());
