import { loadConfig, validateConfig } from './config.js';
import { createPersistence } from './persistence.js';
import { createStore } from './state.js';
import { renderApp } from './views.js';
import { bindInput } from './input.js';
import { createFeedback } from './feedback.js';

// R01/R08/R10/R11/R12：只使用平台预先注入的 SDK；不定义、覆盖或写入 ActivityStudio。
const escapeText = value => String(value ?? '未知错误');

function showFailure(root, title, details) {
  const panel = document.createElement('section');
  panel.setAttribute('role', 'alert');
  panel.setAttribute('data-screen', 'unavailable');
  panel.style.cssText = 'box-sizing:border-box;min-height:100%;padding:32px 24px;background:#201b45;color:#fff4df;font:15px/1.65 system-ui,"PingFang SC",sans-serif;overflow:auto;';

  const heading = document.createElement('h1');
  heading.textContent = title;
  heading.style.cssText = 'margin:0 0 16px;font-size:26px;';
  panel.appendChild(heading);

  const explanation = document.createElement('p');
  explanation.textContent = '活动尚未初始化；未执行抽取、扣费或奖励发放。请检查以下配置或存档问题。';
  panel.appendChild(explanation);

  const list = document.createElement('ul');
  list.style.cssText = 'margin:16px 0;padding:16px 16px 16px 36px;border:2px solid #f5c96d;border-radius:18px;background:#fff4df;color:#352846;overflow-wrap:anywhere;';
  for (const detail of details) {
    const item = document.createElement('li');
    item.textContent = escapeText(detail);
    list.appendChild(item);
  }
  panel.appendChild(list);
  root.replaceChildren(panel);
}

function showReadOnly(root, config) {
  const existing = root.querySelector('[data-save-warning]');
  if (existing) return;
  const warning = document.createElement('div');
  warning.dataset.saveWarning = '';
  warning.setAttribute('role', 'alert');
  warning.textContent = config.copyById?.SAVE_ERROR || '活动存档暂不可用，当前仅可查看已保存内容。';
  const modalBody = root.querySelector('.overlay .modal-content');
  warning.style.cssText = modalBody
    ? 'padding:8px 12px;border:2px solid var(--gold,#f5c96d);border-radius:12px;background:var(--surface,#fff4df);color:#352846;font-size:13px;line-height:1.4;'
    : 'position:absolute;z-index:65;top:8px;left:12px;right:12px;padding:8px 12px;border:2px solid var(--gold,#f5c96d);border-radius:12px;background:var(--surface,#fff4df);color:#352846;font-size:13px;line-height:1.4;box-shadow:0 5px 16px rgba(16,12,43,.3);pointer-events:none;';
  (modalBody || root).prepend(warning);

  // R10/R12：只禁用写操作；入口、收藏、Info、规则、账本与返回仍可浏览。
  const writes = '[data-action="draw"], [data-action="tier-select"], [data-action="claim-node"], [data-action="claim-confirm"], [data-action="exchange-open"], [data-action="exchange-confirm"], [data-action="debug-apply"], [data-action="debug-expire"], [data-action="debug-relogin"], [data-action="debug-reset"], [data-action="debug-storage-fail"], [data-action="debug-replay"], [data-action^="debug-order-"], [data-action^="debug-generator-"], [data-action="makeup-claim"], [data-action="cover-start"]';
  for (const control of root.querySelectorAll(writes)) {
    control.disabled = true;
    control.setAttribute('aria-disabled', 'true');
  }
}

/**
 * 挂载活动。配置校验失败时明确列出错误；存档失败时保留只读展示。
 * Store 负责先提交事务，再通知订阅者；输入层负责对已确认结果播放反馈。
 * 此处不另行调用 track、发奖或播放反馈，避免一次操作被呈现两次。
 */
export function bootstrap(root, sdk = typeof window === 'undefined' ? undefined : window.ActivityStudio) {
  if (!root || typeof root.replaceChildren !== 'function') {
    throw new TypeError('bootstrap 需要有效的活动挂载节点');
  }

  let config;
  try {
    config = loadConfig(sdk);
    const errors = validateConfig(config);
    if (errors.length) {
      showFailure(root, '活动配置待修正', errors);
      return { store: null, destroy() {} };
    }
  } catch (error) {
    showFailure(root, '活动配置无法读取', [error instanceof Error ? error.message : String(error)]);
    return { store: null, destroy() {} };
  }

  let store;
  let unsubscribe = null;
  let unbind = null;
  let feedback = null;
  let destroyed = false;

  try {
    const persistence = createPersistence(config.activity.periodId);
    store = createStore({ sdk, config, persistence });

    const render = snapshot => {
      if (destroyed) return;
      try {
        renderApp(root, snapshot, config);
        if (snapshot.readOnly || persistence.status() === 'READ_ONLY') {
          showReadOnly(root, config);
        }
      } catch (error) {
        showFailure(root, '活动界面暂不可用', [error instanceof Error ? error.message : String(error)]);
      }
    };

    render(store.getState());
    unsubscribe = store.subscribe(render);
    if (persistence.status() === 'READY') feedback = createFeedback({ store, root, config });
    // R12：存储在挂载时已经失败，仍须绑定只读页面的导航与关闭操作。
    unbind = bindInput(root, store, feedback, config);
  } catch (error) {
    unbind?.();
    feedback?.destroy();
    unsubscribe?.();
    showFailure(root, '活动初始化失败', [error instanceof Error ? error.message : String(error)]);
    return { store: null, destroy() {} };
  }

  return {
    store,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unbind?.();
      unsubscribe?.();
      feedback?.destroy();
    }
  };
}
