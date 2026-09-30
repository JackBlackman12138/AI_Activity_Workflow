import { chromium } from 'playwright';
const attachConfigRuntime=function attachConfigRuntime(html, config, sessionId, offline = false, storage) {
    const payload = JSON.stringify({ config, sessionId, storage }).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    const script = `<script data-activity-studio-runtime>(()=>{const {config,sessionId,storage}=${payload};
if(!${offline}&&storage){
  const make=(kind,seed)=>{
    let values=Object.assign(Object.create(null),seed||{});
    const update=(next)=>{if(JSON.stringify(next).length>1048576)throw new DOMException('预览存档超过1MB','QuotaExceededError');values=next;parent.postMessage({channel:'activity-studio-storage',sessionId,kind,values},'*')};
    return {get length(){return Object.keys(values).length},key(i){return Object.keys(values)[Number(i)]??null},getItem(key){return Object.hasOwn(values,String(key))?values[String(key)]:null},setItem(key,value){update(Object.assign(Object.create(null),values,{[String(key)]:String(value)}))},removeItem(key){const next=Object.assign(Object.create(null),values);delete next[String(key)];update(next)},clear(){update(Object.create(null))}};
  };
  Object.defineProperty(window,'localStorage',{value:make('local',storage.local),configurable:true});
  Object.defineProperty(window,'sessionStorage',{value:make('session',storage.session),configurable:true});
}
const start=performance.now();window.ActivityStudio={config,tables:Object.fromEntries((config.tables||[{id:"main",fields:config.fields,rows:config.rows,pacing:config.pacing}]).map(table=>[table.id,table])),track(type,stepIndex){if(${offline})return;parent.postMessage({channel:'activity-studio',id:crypto.randomUUID(),sessionId,revision:config.revision,type,stepIndex,elapsedMs:Math.round(performance.now()-start)},'*')}};window.ActivityStudio.flushStorage=()=>{if(${offline}||!storage)return Promise.resolve();return new Promise((resolve,reject)=>{const requestId=crypto.randomUUID();const receive=e=>{if(e.source!==parent||e.data?.channel!=='activity-studio-storage-ack'||e.data.sessionId!==sessionId||e.data.requestId!==requestId)return;clearTimeout(timer);removeEventListener('message',receive);e.data.error?reject(new Error(e.data.error)):resolve()};const timer=setTimeout(()=>{removeEventListener('message',receive);reject(new Error('预览存档未收到保存确认'))},3000);addEventListener('message',receive);parent.postMessage({channel:'activity-studio-storage',sessionId,requestId,kind:'flush'},'*')})};window.ActivityStudio.track('session_start')})();</script>`;
    // Inject before application scripts, including scripts in <head>.
    return /<head\b[^>]*>/i.test(html) ? html.replace(/<head\b[^>]*>/i, match => match + script) : script + html;
};const installDemoStorageHost=function installDemoStorageHost(frame, sessionId, key, onError) {
    const valid = (value) => !!value && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every(item => typeof item === 'string') && JSON.stringify(value).length <= 1048576;
    const read = (kind) => { try {
        const parsed = JSON.parse((kind === 'local' ? localStorage : sessionStorage).getItem(key) || '{}');
        return valid(parsed) ? parsed : {};
    }
    catch {
        return {};
    } };
    const snapshot = { local: read('local'), session: read('session') };
    let error = '';
    const receive = (event) => {
        const data = event.data;
        if (event.source !== frame.contentWindow || data?.channel !== 'activity-studio-storage' || data.sessionId !== sessionId)
            return;
        if (data.kind === 'flush') {
            frame.contentWindow?.postMessage({ channel: 'activity-studio-storage-ack', sessionId, requestId: data.requestId, error }, '*');
            return;
        }
        if (!['local', 'session'].includes(data.kind) || !valid(data.values))
            return;
        try {
            (data.kind === 'local' ? localStorage : sessionStorage).setItem(key, JSON.stringify(data.values));
            error = '';
        }
        catch {
            error = '浏览器未能保存预览存档，请检查浏览器存储空间或权限';
            onError?.(error);
        }
    };
    window.addEventListener('message', receive);
    return { snapshot, dispose: () => window.removeEventListener('message', receive), clear: () => { localStorage.removeItem(key); sessionStorage.removeItem(key); } };
};const demoPreviewPage=function demoPreviewPage(html, config, sessionId) {
    const input = JSON.stringify({ html, config, sessionId }).replace(/</g, '\\u003c');
    return `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0"><iframe title="demo" sandbox="allow-scripts allow-forms" style="border:0;width:100vw;height:100vh"></iframe><script>(()=>{const {html,config,sessionId}=${input};const frame=document.querySelector('iframe');const install=${installDemoStorageHost.toString()};const attach=${attachConfigRuntime.toString().replace(/<\/script/gi, '<\\/script')};const host=install(frame,sessionId,'activity-studio-demo-validation');frame.srcdoc=attach(html,config,sessionId,false,host.snapshot);})();</script></body></html>`;
};
async function launch() {
    for (const channel of ['msedge', 'chrome', undefined]) {
        try {
            return await chromium.launch({ channel, headless: true, timeout: 15_000 });
        }
        catch { /* Try an installed browser before the bundled one. */ }
    }
    throw new Error('未找到可用的测试浏览器，请安装 Edge 或 Chrome，或执行 npx playwright install chromium；尚未调用模型');
}
export async function checkDemoBrowser(signal) { signal.throwIfAborted(); const browser = await launch(); await browser.close(); signal.throwIfAborted(); }
export function scenarioIssues(tests, requirements) {
    const substantive = tests.filter(test => test.steps.some(step => ['click', 'fill', 'select'].includes(step.action)) && test.steps.some(step => step.action.startsWith('expect')));
    const covered = new Set(substantive.flatMap(test => test.requirements));
    return requirements.filter(id => !covered.has(id)).map(id => `需求 ${id} 缺少有真实操作和结果断言的浏览器测试`);
}
export async function validateDemoBrowser(html, config, tests, signal, onCheck) {
    signal.throwIfAborted();
    const browser = await launch();
    const result = { passed: false, checkedAt: new Date().toISOString(), tests: [], errors: [], screenshots: [] };
    const abort = () => { void browser.close().catch(() => { }); };
    signal.addEventListener('abort', abort, { once: true });
    const deadline = setTimeout(() => { result.errors.push('浏览器验证超过五分钟，未标记通过'); abort(); }, 300_000);
    let reports = Promise.resolve();
    try {
        const modes = await Promise.allSettled(['platform', 'offline'].map(async (mode) => {
            const scenarios = [{ id: 'layout', name: '页面加载与竖屏适配', requirements: [], steps: [] }, ...tests];
            const pageHtml = mode === 'offline' ? attachConfigRuntime(html, config, 'automated-validation', true) : demoPreviewPage(html, config, 'automated-validation');
            for (const scenario of scenarios) {
                signal.throwIfAborted();
                const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: false });
                // Guard the opaque iframe: Playwright's built-in serviceWorkers:block initializer throws there.
                await context.addInitScript(() => { try {
                    if (navigator.serviceWorker)
                        navigator.serviceWorker.register = async () => { throw new Error('离线 Demo 不允许注册 Service Worker'); };
                }
                catch { /* Opaque preview frames already prohibit service workers. */ } });
                await context.routeWebSocket('**/*', socket => socket.close());
                const errors = [];
                const page = await context.newPage();
                page.setDefaultTimeout(4000);
                const timeout = setTimeout(() => { errors.push('此场景超过一分钟'); void context.close().catch(() => { }); }, 60_000);
                try {
                    await context.route('**/*', route => route.request().isNavigationRequest() && route.request().frame() === page.mainFrame() && route.request().url() === 'https://demo-validation.invalid/' ? route.fulfill({ contentType: 'text/html; charset=utf-8', body: pageHtml }) : (errors.push('存在未打包的网络依赖：' + route.request().url().slice(0, 150)), route.abort()));
                    page.on('pageerror', error => errors.push(error.message));
                    page.on('dialog', dialog => { errors.push('使用了阻塞浏览器的弹窗：' + dialog.type()); void dialog.dismiss(); });
                    await page.goto('https://demo-validation.invalid/', { waitUntil: 'domcontentloaded', timeout: 10_000 });
                    const frame = () => mode === 'offline' ? page.mainFrame() : page.frames().find(f => f.parentFrame() === page.mainFrame());
                    if (!frame())
                        throw new Error('预览未加载');
                    const ready = async () => {
                        if (mode === 'platform')
                            await frame().waitForFunction(() => document.readyState !== 'loading' && Boolean(document.querySelector('script[data-activity-studio-runtime]')), undefined, { timeout: 5000 });
                        await frame().locator('body').waitFor({ state: 'attached', timeout: 5000 });
                    };
                    await ready();
                    const assert = async (check, message) => {
                        const end = Date.now() + 4000;
                        while (!await check()) {
                            signal.throwIfAborted();
                            if (Date.now() > end)
                                throw new Error(message);
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                    };
                    for (const step of scenario.steps) {
                        signal.throwIfAborted();
                        const locator = frame().locator(step.selector ?? 'body');
                        switch (step.action) {
                            case 'click':
                                for (let click = 0; click < (step.count ?? 1); click++) {
                                    signal.throwIfAborted();
                                    await locator.click();
                                }
                                break;
                            case 'fill':
                                await locator.fill(step.value);
                                break;
                            case 'select':
                                await locator.selectOption(step.value);
                                break;
                            case 'reload':
                                if (mode === 'platform')
                                    await frame().evaluate(async () => { await window.ActivityStudio.flushStorage(); });
                                await page.reload({ waitUntil: 'domcontentloaded', timeout: 10_000 });
                                await ready();
                                break;
                            case 'expectVisible':
                                await assert(() => locator.isVisible(), step.selector + ' 未显示');
                                break;
                            case 'expectDisabled':
                                await assert(() => locator.isDisabled(), step.selector + ' 未禁用');
                                break;
                            case 'expectText':
                                await assert(async () => !!(await locator.textContent())?.includes(step.value), step.selector + ' 未出现预期文本 ' + step.value);
                                break;
                            case 'expectCount':
                                await assert(async () => (await locator.count()) === step.count, step.selector + ' 数量不符');
                                break;
                        }
                    }
                    if (scenario.id === 'layout')
                        for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 700 }]) {
                            await page.setViewportSize(viewport);
                            const layout = await frame().evaluate(() => ({ text: document.body.innerText.trim(), overflow: document.documentElement.scrollWidth > innerWidth + 2 }));
                            if (!layout.text)
                                errors.push('页面没有可见内容');
                            if (layout.overflow)
                                errors.push(`${viewport.width} 像素视口发生整页横向溢出`);
                        }
                    if (mode === 'platform' && (scenario.id === 'layout' || result.screenshots.length < 3))
                        result.screenshots.push({ name: scenario.name, base64: (await page.screenshot({ type: 'jpeg', quality: 65, timeout: 5000 })).toString('base64') });
                }
                catch (error) {
                    signal.throwIfAborted();
                    errors.push(error.message.slice(0, 1200));
                    try {
                        const frame = mode === 'offline' ? page.mainFrame() : page.frames().find(f => f.parentFrame() === page.mainFrame());
                        const visible = await frame?.evaluate(() => document.body.innerText.slice(0, 1600));
                        if (visible)
                            errors.push('失败时实际页面：' + visible);
                        if (mode === 'platform' && result.screenshots.length < 3)
                            result.screenshots.push({ name: '失败：' + scenario.name, base64: (await page.screenshot({ type: 'jpeg', quality: 65, timeout: 3000 })).toString('base64') });
                    }
                    catch { /* Keep the original diagnostic when the page is already closed. */ }
                }
                finally {
                    clearTimeout(timeout);
                    await context.close().catch(() => { });
                }
                result.tests.push({ id: mode + ':' + scenario.id, name: `${mode === 'platform' ? '平台预览' : '离线交付'} · ${scenario.name}`, passed: !errors.length, error: errors.length ? [...new Set(errors)].join('；') : undefined });
                const checked = result.tests.at(-1), partial = { ...result, tests: [...result.tests], screenshots: undefined, errors: result.tests.filter(test => !test.passed).map(test => test.name + '：' + test.error) };
                reports = reports.then(() => onCheck?.(checked, partial));
                await reports;
            }
        }));
        for (const mode of modes)
            if (mode.status === 'rejected')
                throw mode.reason;
        const order = ['platform', 'offline'].flatMap(mode => ['layout', ...tests.map(test => test.id)].map(id => mode + ':' + id));
        result.tests.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    }
    finally {
        clearTimeout(deadline);
        signal.removeEventListener('abort', abort);
        await browser.close().catch(() => { });
    }
    signal.throwIfAborted();
    result.errors.push(...result.tests.filter(test => !test.passed).map(test => test.name + '：' + test.error));
    result.passed = !result.errors.length;
    return result;
}
