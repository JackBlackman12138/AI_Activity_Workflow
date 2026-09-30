// R01 / R09 / R10 / R12：仅管理本期活动存档；未确认持久化时进入只读状态。
const PREFIX = 'activity-studio:gacha:v1:';
const FORMAT = 'GACHA_SAVE_V1';

export function createPersistence(periodId) {
  if (typeof periodId !== 'string' || !periodId.trim()) {
    throw new TypeError('活动期次 periodId 必须是非空字符串');
  }

  const key = PREFIX + encodeURIComponent(periodId);
  let mode = 'READY';
  let lastDurableSave = null;
  let error = '';

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function fail(cause) {
    mode = 'READ_ONLY';
    error = cause instanceof Error ? cause.message : String(cause);
  }

  function storage() {
    if (typeof localStorage === 'undefined') {
      throw new Error('localStorage 不可用');
    }
    return localStorage;
  }

  function decode(text) {
    const record = JSON.parse(text);
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw new Error('活动存档格式无效');
    }

    // resetTestInstance 留下无存档标记；下一次初始化仍须经过 commit。
    if (record.format === FORMAT) {
      if (record.periodId !== periodId || !Object.hasOwn(record, 'save')) {
        throw new Error('活动存档期次或结构不匹配');
      }
      if (record.save === null) return null;
      if (!record.save || typeof record.save !== 'object' || Array.isArray(record.save)) {
        throw new Error('活动存档内容无效');
      }
      if (record.save.periodId !== periodId) {
        throw new Error('活动存档期次不匹配');
      }
      return record.save;
    }

    // 兼容同一期早期直接保存的 Save，不修改其内容或业务数值。
    if (record.periodId === periodId) return record;
    throw new Error('活动存档格式或期次不匹配');
  }

  function load() {
    if (mode === 'READ_ONLY') {
      return lastDurableSave === null ? null : clone(lastDurableSave);
    }
    try {
      const raw = storage().getItem(key);
      if (raw === null) {
        lastDurableSave = null;
        return null;
      }
      const save = decode(raw);
      lastDurableSave = save === null ? null : clone(save);
      return save === null ? null : clone(save);
    } catch (cause) {
      fail(cause);
      // 只回退到此前成功从存储读取或写入并回读的版本。
      return lastDurableSave === null ? null : clone(lastDurableSave);
    }
  }

  function commit(save) {
    if (mode === 'READ_ONLY') {
      return { ok: false, error: error || '活动存档只读，未执行提交' };
    }
    try {
      if (!save || typeof save !== 'object' || Array.isArray(save) || save.periodId !== periodId) {
        throw new Error('提交的活动存档期次或结构无效');
      }
      const encoded = JSON.stringify({ format: FORMAT, periodId, save });
      if (typeof encoded !== 'string') throw new Error('活动存档无法序列化');
      const next = decode(encoded);
      const store = storage();
      store.setItem(key, encoded);
      // 读回确认成功后才向状态层报告提交完成；业务反馈与发奖不能先于此步。
      if (store.getItem(key) !== encoded) {
        throw new Error('活动存档写入后校验失败');
      }
      lastDurableSave = clone(next);
      return { ok: true };
    } catch (cause) {
      fail(cause);
      return { ok: false, error };
    }
  }

  function resetTestInstance() {
    if (mode === 'READ_ONLY') return false;
    try {
      // 仅覆盖当前期次的活动存档，不清理平台配置、其他期次或奖励账本以外的键。
      // 无存档标记也需可持久化；失败时绝不报告「重新试玩」成功。
      const marker = JSON.stringify({ format: FORMAT, periodId, save: null });
      const store = storage();
      store.setItem(key, marker);
      if (store.getItem(key) !== marker) {
        throw new Error('重新试玩存档标记校验失败');
      }
      lastDurableSave = null;
      return true;
    } catch (cause) {
      fail(cause);
      return false;
    }
  }

  return {
    load,
    commit,
    resetTestInstance,
    status: () => mode
  };
}
