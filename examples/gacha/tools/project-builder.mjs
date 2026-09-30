import { build } from 'esbuild';
import { posix } from 'node:path';
export function projectJson(text) {
    const value = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try {
        return JSON.parse(value);
    }
    catch {
        throw new Error('工程修改未返回有效 JSON，原版本保持不变');
    }
}
export function safePath(path) {
    if (!path || path.startsWith('/') || path.includes('\\') || path.split('/').some(part => !part || part === '.' || part === '..') || /[:\x00-\x1f]/.test(path))
        throw new Error('工程文件路径无效：' + path);
    return path;
}
export function readProject(text) {
    if (/^(?:```html\s*)?(?:<!doctype|<html)/i.test(text.trim()))
        return { files: { 'index.html': text.trim().replace(/^```html\s*/i, '').replace(/\s*```$/, '') }, tests: [] };
    const raw = projectJson(text);
    const files = {};
    for (const [path, content] of Array.isArray(raw.files) ? raw.files.map((f) => [f.path, f.content]) : Object.entries(raw.files ?? {})) {
        if (typeof path !== 'string' || typeof content !== 'string' || Object.hasOwn(files, path))
            throw new Error('工程文件内容或重复路径无效');
        files[safePath(path)] = content;
    }
    if (!files['index.html'])
        throw new Error('工程缺少 index.html 入口');
    if (Object.keys(files).length > 500 || JSON.stringify(files).length > 20_000_000)
        throw new Error('工程超过单次处理大小');
    return { files, tests: readScenarios(raw.tests ?? []) };
}
export function readScenarios(value) {
    if (!Array.isArray(value) || value.length > 100)
        throw new Error('测试场景格式无效');
    const ids = new Set();
    for (const scenario of value) {
        if (!scenario || typeof scenario.id !== 'string' || !scenario.id || ids.has(scenario.id) || typeof scenario.name !== 'string' || !Array.isArray(scenario.requirements) || !scenario.requirements.every((r) => typeof r === 'string') || !Array.isArray(scenario.steps) || !scenario.steps.length || scenario.steps.length > 200)
            throw new Error('测试场景缺少名称、需求或操作步骤');
        ids.add(scenario.id);
        for (const step of scenario.steps)
            if (!step || !['click', 'fill', 'select', 'expectText', 'expectVisible', 'expectCount', 'expectDisabled', 'reload'].includes(step.action) || (step.action !== 'reload' && (typeof step.selector !== 'string' || !step.selector)) || (['fill', 'select', 'expectText'].includes(step.action) && typeof step.value !== 'string') || (step.action === 'expectCount' && (!Number.isInteger(step.count) || step.count < 0)))
                throw new Error('测试步骤格式无效');
        for (const step of scenario.steps)
            if (step.action === 'click' && step.count !== undefined && (!Number.isInteger(step.count) || step.count < 1 || step.count > 200))
                throw new Error('重复点击次数必须为 1–200 的整数');
    }
    return value;
}
export function patchProject(project, text) {
    const raw = projectJson(text), next = structuredClone(project);
    if (!Array.isArray(raw.edits) && !Array.isArray(raw.files) && !Array.isArray(raw.tests) && !Array.isArray(raw.testSetups) && !Array.isArray(raw.testSelectors) && !Array.isArray(raw.testRevisions))
        throw new Error('缺少工程修改内容');
    const grouped = new Map();
    for (const edit of raw.edits ?? []) {
        const path = safePath(edit.path ?? 'index.html'), content = project.files[path];
        if (typeof content !== 'string' || typeof edit.find !== 'string' || !edit.find || typeof edit.replace !== 'string')
            throw new Error('代码修改格式无效，候选版本已保留');
        const start = content.indexOf(edit.find);
        if (start < 0 || content.indexOf(edit.find, start + 1) >= 0)
            throw new Error('代码修改位置缺失或不唯一，候选版本已保留');
        // A chat change is a patch, not a disguised project replacement.
        if (edit.find === content)
            throw new Error('不接受整份文件替换，请按函数或局部区块修改');
        const list = grouped.get(path) ?? [];
        list.push({ start, end: start + edit.find.length, replace: edit.replace });
        grouped.set(path, list);
    }
    for (const [path, edits] of grouped) {
        edits.sort((a, b) => a.start - b.start);
        for (let i = 1; i < edits.length; i++)
            if (edits[i].start < edits[i - 1].end)
                throw new Error('代码修改范围重叠，候选版本已保留');
        for (const edit of edits.reverse())
            next.files[path] = next.files[path].slice(0, edit.start) + edit.replace + next.files[path].slice(edit.end);
    }
    for (const file of raw.files ?? []) {
        const path = safePath(file.path);
        if (Object.hasOwn(next.files, path))
            throw new Error('已有文件必须通过局部修改更新：' + path);
        if (typeof file.content !== 'string')
            throw new Error('新增文件内容无效');
        next.files[path] = file.content;
    }
    // Existing assertions are immutable during automated fixes, preventing a weaker test from hiding regressions.
    for (const test of readScenarios(raw.tests ?? [])) {
        const previous = next.tests.find(item => item.id === test.id);
        if (previous && JSON.stringify(previous) !== JSON.stringify(test))
            throw new Error('不能删除或改弱已有回归测试，请保留并新增场景');
        if (!previous)
            next.tests.push(test);
    }
    // Generated tests can encode the wrong UI behavior. Corrections must retain
    // requirement coverage and assertion count, with before/after evidence for review.
    const revisions = new Set();
    for (const change of raw.testRevisions ?? []) {
        const revised = readScenarios([change.test])[0];
        const index = next.tests.findIndex(test => test.id === revised.id), previous = next.tests[index];
        if (!previous || revisions.has(revised.id) || typeof change.reason !== 'string' || !change.reason.trim())
            throw new Error('测试修订需要已有场景及对应策划规则的具体原因');
        const assertions = (test) => test.steps.filter(step => step.action.startsWith('expect')).length;
        if (JSON.stringify([...previous.requirements].sort()) !== JSON.stringify([...revised.requirements].sort()) || assertions(revised) < assertions(previous) || !revised.steps.some(step => ['click', 'fill', 'select'].includes(step.action)))
            throw new Error('测试修订不能减少需求覆盖、断言数量或删除真实操作');
        revisions.add(revised.id);
        let version = 1, path;
        do {
            path = `docs/test-revision-${version++}.json`;
        } while (Object.hasOwn(next.files, path));
        next.files[path] = JSON.stringify({ reason: change.reason, previous, revised }, null, 2);
        next.tests[index] = revised;
    }
    // Repair ambiguous locators without changing actions, counts or expected values.
    const selectorEdits = new Set();
    for (const edit of raw.testSelectors ?? []) {
        const scenario = next.tests.find(test => test.id === edit.id), step = scenario?.steps[edit.step];
        const key = edit.id + ':' + edit.step;
        if (!Number.isInteger(edit.step) || !step || step.action === 'reload' || typeof edit.selector !== 'string' || !edit.selector.trim() || selectorEdits.has(key))
            throw new Error('测试定位修正必须对应唯一已有步骤');
        selectorEdits.add(key);
        step.selector = edit.selector;
    }
    // A fresh browser cannot inherit another scenario's login/entry/tutorial state.
    // Permit adding setup actions, while keeping every original action and assertion.
    const setupIds = new Set();
    for (const setup of raw.testSetups ?? []) {
        const scenario = next.tests.find(test => test.id === setup.id);
        if (!scenario || setupIds.has(setup.id))
            throw new Error('测试前置步骤必须对应唯一已有场景');
        setupIds.add(setup.id);
        readScenarios([{ ...scenario, steps: setup.steps }]);
        if (!setup.steps.every((step) => ['click', 'fill', 'select'].includes(step.action)))
            throw new Error('测试前置步骤只允许真实操作，不能跳过断言');
        scenario.steps = [...setup.steps, ...scenario.steps];
    }
    return readProject(JSON.stringify(next));
}
// The host runs its own compiler only. Generated package scripts/plugins are never executed.
export async function buildDemoProject(project) {
    const files = readProject(JSON.stringify(project)).files;
    const resolve = (request, importer = 'index.html') => {
        if (!request.startsWith('.') && importer !== 'index.html')
            throw new Error('请使用工程内相对导入：' + request);
        const path = posix.normalize(posix.join(posix.dirname(importer), request));
        safePath(path);
        const found = [path, path + '.ts', path + '.js', path + '/index.ts', path + '/index.js'].find(p => Object.hasOwn(files, p));
        if (!found)
            throw new Error('缺少工程文件：' + path);
        return found;
    };
    const compile = async (path) => {
        const result = await build({ entryPoints: [path], bundle: true, write: false, outdir: 'out', format: 'iife', platform: 'browser', target: 'es2020', charset: 'utf8', minify: false, logLevel: 'silent', plugins: [{ name: 'project-files', setup(api) {
                        api.onResolve({ filter: /.*/ }, args => args.path.startsWith('data:') ? { path: args.path, external: true } : ({ path: args.kind === 'entry-point' ? args.path : resolve(args.path, args.importer), namespace: 'project' }));
                        api.onLoad({ filter: /.*/, namespace: 'project' }, args => { const ext = posix.extname(args.path).slice(1); return { contents: files[args.path], loader: ext === 'svg' ? 'dataurl' : ext === 'json' ? 'json' : ext === 'css' ? 'css' : ext === 'ts' ? 'ts' : ext === 'tsx' ? 'tsx' : ext === 'jsx' ? 'jsx' : 'js' }; });
                    } }] });
        return { js: result.outputFiles.filter(file => file.path.endsWith('.js')).map(file => file.text).join('\n'), css: result.outputFiles.filter(file => file.path.endsWith('.css')).map(file => file.text).join('\n') };
    };
    let html = files['index.html'];
    // Inline module bootstraps are just as valid as <script src="..."> entries.
    // Bundle them before inspecting the final HTML, otherwise imported code is absent.
    let inlineIndex = 0;
    for (const match of [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]) {
        if (/\bsrc\s*=/i.test(match[1]) || !/\btype\s*=\s*["']module["']/i.test(match[1]))
            continue;
        let path;
        do {
            path = `__inline_entry_${++inlineIndex}.js`;
        } while (Object.hasOwn(files, path));
        files[path] = match[2];
        const code = await compile(path);
        html = html.replace(match[0], () => (code.css ? '<style>' + code.css + '</style>' : '') + '<script>' + code.js.replace(/<\/script/gi, '<\\/script') + '</script>');
    }
    for (const match of [...html.matchAll(/<script\b([^>]*?)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>\s*<\/script>/gi)]) {
        const code = await compile(resolve(match[2]));
        html = html.replace(match[0], () => (code.css ? '<style>' + code.css + '</style>' : '') + '<script>' + code.js.replace(/<\/script/gi, '<\\/script') + '</script>');
    }
    for (const match of [...html.matchAll(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/gi)]) {
        if (!/rel=["']stylesheet["']/i.test(match[0]))
            throw new Error('只支持工程内样式链接');
        const css = await compile(resolve(match[1]));
        html = html.replace(match[0], () => '<style>' + css.css + '</style>');
    }
    for (const match of [...html.matchAll(/\bsrc=["']([^"']+)["']/gi)]) {
        if (/^(data:|attachment:)/i.test(match[1]))
            continue;
        const path = resolve(match[1]);
        if (!path.endsWith('.svg'))
            throw new Error('图片请使用 SVG 文件或 data URL');
        html = html.replace(match[0], 'src="data:image/svg+xml;base64,' + Buffer.from(files[path]).toString('base64') + '"');
    }
    return html;
}
