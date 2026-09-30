import { getNodeStatus } from './progress.js';

// R10/R11：ProgressNodes 原始行索引是唯一的平台节奏索引。
// 先持久化待上报事件，再调用 SDK；平台接口仅接受 type/index，未提供事件 ID，
// 因此断电恰好发生在 track 成功与回写确认之间时，客户端无法单独保证恰好一次。
// outbox 保留稳定 ID，供平台按期次、实例、type、index 实现去重。
const clone = value => JSON.parse(JSON.stringify(value));
const claimed = status => status?.claimed === true;

export function stageProgressEvents(before, draft, config) {
  draft.progressOutbox ||= [];
  if (!Array.isArray(draft.progressOutbox)) throw new Error('进度上报队列格式无效');
  const prefix = `${draft.periodId}:${draft.testInstanceId}:progress`;
  const add = (type, index, nodeId) => {
    const id = `${prefix}:${type}:${nodeId}`;
    if (!draft.progressOutbox.some(item => item.id === id)) {
      draft.progressOutbox.push({ id, type, index, nodeId, status: 'PENDING' });
    }
  };
  config.nodes.forEach((node, index) => {
    const previous = before && getNodeStatus(before, config, node.nodeId);
    const next = getNodeStatus(draft, config, node.nodeId);
    if (next?.reached && !previous?.reached) add('step_enter', index, node.nodeId);
    if (claimed(next) && !claimed(previous) && next.reached) add('step_complete', index, node.nodeId);
  });
  const all = state => config.nodes.length > 0 && config.nodes.every(node => {
    const status = getNodeStatus(state, config, node.nodeId);
    return status?.reached && claimed(status);
  });
  // R11：节点全部完成或本期结束结算，任一路径均只建立同一个会话完成键。
  // 结算清理节点后 all(draft) 为 false，因此必须另查首次 FINALIZED 迁移。
  const finalized = state => state?.settlement?.status === 'FINALIZED' || state?.settlement?.finalized === true;
  if ((all(draft) && !all(before)) || (finalized(draft) && !finalized(before))) {
    add('session_complete', null, 'ALL');
  }
}

export function flushProgressEvents(sdk, saved, persistence) {
  let state = saved;
  if (typeof sdk?.track !== 'function') return { ok: false, state, storageFailed: false };
  for (const pending of saved.progressOutbox || []) {
    if (pending.status !== 'PENDING') continue;
    try {
      if (pending.type === 'session_complete') sdk.track('session_complete');
      else sdk.track(pending.type, pending.index);
    } catch {
      return { ok: false, state, storageFailed: false };
    }
    const next = clone(state);
    const item = next.progressOutbox.find(entry => entry.id === pending.id);
    if (item) item.status = 'ACKNOWLEDGED';
    if (!persistence.commit(next).ok) return { ok: false, state, storageFailed: true };
    state = next;
  }
  return { ok: true, state, storageFailed: false };
}
