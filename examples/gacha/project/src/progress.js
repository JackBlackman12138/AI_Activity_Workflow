// R04/R06/R07/R10/R11：ProgressNodes 是节奏看板唯一的主进度表。
// 本模块只读取已提交状态；领奖、发奖、事件日志与持久化由事务模块负责。

const rows = config => config?.nodes || config?.tables?.ProgressNodes || [];
const toys = config => config?.toys || config?.tables?.GachaToy || [];

function ownedIds(state) {
  const value = state?.ownedToyIds;
  if (value instanceof Set) return value;
  if (Array.isArray(value)) return new Set(value);
  if (value && typeof value === 'object') {
    return new Set(Object.keys(value).filter(id => Boolean(value[id])));
  }
  return new Set();
}

function isClaimed(state, nodeId) {
  const claims = state?.nodeClaims;
  const entry = Array.isArray(claims) ? claims.includes(nodeId) : claims?.[nodeId];
  if (entry === true || entry === 'CLAIMED') return true;
  if (!entry || typeof entry !== 'object') return false;
  return entry.claimed === true || entry.awarded === true ||
    entry.status === 'CLAIMED' || entry.status === 'AWARDED';
}

function attainedCount(state, config, node) {
  if (node.nodeType === 'POINT') return Number(state?.totalPoints) || 0;
  const owned = ownedIds(state);
  if (node.nodeType === 'COMPLETE') {
    return toys(config).filter(toy => owned.has(toy.toyId)).length;
  }
  return toys(config).filter(toy =>
    toy.collectionId === node.collectionId && owned.has(toy.toyId)
  ).length;
}

/** 节点的实际达成、领取与展示状态彼此独立；兑换不改变累计积分。 */
export function getNodeStatus(state, config, nodeId) {
  const node = rows(config).find(item => item.nodeId === nodeId);
  if (!node) return null;
  const current = attainedCount(state, config, node);
  const target = Number(node.target);
  const reached = Number.isFinite(target) && current >= target;
  const claimed = isClaimed(state, nodeId);
  return {
    nodeId,
    nodeType: node.nodeType,
    label: node.label,
    collectionId: node.collectionId,
    claimMode: node.claimMode,
    current,
    target,
    reached,
    claimed,
    claimable: reached && !claimed && node.claimMode === 'MANUAL',
    // 自动节点的 REACHED 只表示事务中待结算，不允许玩家手动领奖。
    status: claimed ? 'CLAIMED' : reached ?
      (node.claimMode === 'MANUAL' ? 'CLAIMABLE' : 'REACHED') : 'LOCKED'
  };
}

/** 返回已达成但尚未领取的节点 ID；积分按门槛升序，全收藏排在最后。 */
export function resolveReachedNodes(state, config) {
  return [...rows(config)]
    .filter(node => getNodeStatus(state, config, node.nodeId)?.reached &&
      !isClaimed(state, node.nodeId))
    .sort((a, b) => {
      const rank = node => node.nodeType === 'POINT' ? 0 :
        node.nodeType === 'QUALITY' ? 1 : 2;
      return rank(a) - rank(b) ||
        (a.nodeType === 'POINT' ? a.target - b.target : 0) ||
        a.sortOrder - b.sortOrder;
    })
    .map(node => node.nodeId);
}

/**
 * 仅在状态已经成功提交后调用。以配置表原始行序作为零起始索引；
 * 达成发送 step_enter，实际领取发送 step_complete。自动奖励可以在同次
 * 提交中依次产生两个事件。未达成的补发记录不构成进度事件。
 * 初始化、供券、抽取等语义记录由 Store 写入本地 eventLog，不发送给 SDK。
 */
export function emitCommittedProgress(sdk, before, after, config) {
  if (typeof sdk?.track !== 'function' || !after) return;
  if (before?.periodId && after.periodId && before.periodId !== after.periodId) return;

  const nodes = rows(config);
  // R11：主表原始行序就是平台节奏看板的零起始索引。只在提交成功后调用。
  nodes.forEach((node, index) => {
    const prior = before && getNodeStatus(before, config, node.nodeId);
    const next = getNodeStatus(after, config, node.nodeId);
    if (!next) return;
    try {
      if (next.reached && !prior?.reached) sdk.track('step_enter', index);
      if (next.claimed && !prior?.claimed && next.reached) sdk.track('step_complete', index);
    } catch {
      // 遥测失败不撤销持久化事务，也不重做发奖。
    }
  });

  // 全部主节点实际领取才完成会话；结算清理进度不会构成完成。
  const allClaimed = state => nodes.length > 0 && nodes.every(node =>
    getNodeStatus(state, config, node.nodeId)?.reached && isClaimed(state, node.nodeId));
  if (allClaimed(after) && !allClaimed(before)) {
    try { sdk.track('session_complete'); } catch { /* 不重做已确认事务 */ }
  }
}
