import JSZip from 'jszip';
import { demoFunctionalDocument, unityHandoffDocument } from './demo-documentation.js';
import { DEMO_SCOPE_VERSION } from './demo-quality-policy.js';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { attachConfigRuntime, installDemoStorageHost, demoPreviewPage, activityImages, type Activity } from '@ai-activity-studio/shared';
import { exportCsv } from './configuration.js';
import { assertStage, assertDemoDelivery } from './workflow.js';
import { exportXlsx } from './xlsx.js';
import { configDigest, digest } from './demo-pipeline.js';
import type { ActivityConfiguration, StageArtifact } from '@ai-activity-studio/shared';

export function deliveryNotes(artifact: StageArtifact, config?: ActivityConfiguration, documentVersion?: string): string {
  const info = artifact.demoDelivery;
  if (!info || info.contentHash !== digest(artifact.content) || !config || info.configHash !== configDigest(config) || documentVersion !== undefined && info.plan.configuration.sourceDocumentUpdatedAt !== documentVersion) return '# 验收记录\n\n当前策划、源码或配置没有匹配的最新自动审查记录（手工编辑、旧版本或配置变更后需重新核对）。不得将历史结果视为本版本已通过。请逐项试玩后确认。\n';
  const plan = info.plan;
  return `# Demo 需求与验收记录\n\n${info.scopeVersion === DEMO_SCOPE_VERSION ? '范围：仅实现活动功能。主线订单、棋盘、合成、生成器等外部供给通过用户点击 Debug 模拟；主游戏奖励以模拟到账记录承接。程序接入时替换外部供给入口，保留活动自身规则。\n\n' : ''}检查时间：${info.checkedAt}；自动修正 ${info.repairs} 轮。基础语法与配置检查完成；${info.review.status === 'unavailable' ? 'AI 审查未完成' : 'AI 审查已返回'}，${info.validation?.passed ? `已实际通过 ${info.validation.tests.length} 项浏览器检查` : "尚无通过的浏览器验证"}。检查仅覆盖记录场景，不代表线上所有分支均已验收。\n\n## AI 参考意见（不阻塞确认）\n意见不等同于已复现的问题，不自动修改源码；由使用者决定是否通过对话提出调整。\n${info.review.issues.map(value=>'- '+value).join('\n') || '未记录 AI 参考意见。运行检查结论见上文。'}\n\n## 功能与验收\n${plan.requirements.map(rule => `### ${rule.id} ${rule.description}\n- 来源：${rule.source}\n- 验收：${rule.acceptance}\n- 配置：${rule.tableIds.join('、') || '无'}\n- 静态依据：${info.review.coverage.find(item=>item.id===rule.id)?.evidence ?? '未记录'}\n`).join('\n')}\n## 界面与状态\n${plan.screens.map(screen=>`- ${screen.name}：${screen.states.join('、')}`).join('\n')}\n\n## 视觉依据\n${plan.visualDirection}\n\n## 未确认的演示假设\n${plan.assumptions.map(value=>'- '+value).join('\n') || '无记录；仍以策划确认结果为准。'}\n\n## 产品体验评审参考\n${info.review.manualChecks.map(value=>'- [ ] '+value).join('\n')}\n`;
}

export function handoffOutline(activity: Activity): string {
  return `# ${activity.name} · 程序交付说明\n\n## 版本依据\n- UE 联调 Demo：${activity.artifacts?.['ue-demo']?.updatedAt}\n- 策划文档：${activity.artifacts?.document?.updatedAt}\n- 配置版本：${activity.configuration?.revision ?? '无配置'}\n\n## 整体逻辑与规则\n${activity.artifacts?.document?.content ?? ''}\n\n## 交互实现\n完整事件处理、页面状态与反馈以 src/demo.html 为准。此说明由本地演示模式整理，未对所有界面与分支作自动审查，交付前请人工核对。\n\n## 数值与配置\n${(activity.configuration?.tables ?? []).map(table => '- ' + table.id + '：' + table.name + '，' + table.rows.length + ' 行').join('\n') || '参见 configuration.json（如有）。'}\n\n### 当前配置数据（交付数值依据）\n策划中的示例值可能早于配置调整，交付以此处保存的配置版本为准；程序与策划需核对差异。\n\n\`\`\`json\n${JSON.stringify(activity.demoConfiguration ?? activity.configuration ?? {},null,2)}\n\`\`\`\n\n## 程序接入\n通过 window.ActivityStudio.tables[表ID] 读取多表，config 为主流程表兼容入口。保留节点事件；下载版离线运行，不依赖平台埋点服务。\n\n## 验收与未决项\n核对每个入口、操作条件、状态切换、奖励时机及无效操作反馈。未在资料中确认的数值和逻辑保持未决，不作为上线规则。\n`;
}

export async function handoffZip(activity: Activity, stage:'handoff'|'demo'|'ue-demo'='handoff', candidate=false): Promise<Buffer> {
  if(candidate&&stage==='handoff')throw new Error('候选工程不能作为正式交付包');
  assertStage(activity, stage);
  const demoStage=stage==='handoff'?'ue-demo':stage;
  const demo = activity.artifacts?.[demoStage];
  const document = activity.artifacts?.handoff;
  if (!demo || stage==='handoff'&&!document) throw new Error('请先生成并保存对应 Demo 和程序交付说明');
  if(stage!=='handoff'&&!demo.demoProject)throw new Error('此版本缺少原始工程，请先完善并验证 Demo');
  if (activity.configuration && activity.demoConfigRevision !== activity.configuration.revision) throw new Error('配置尚未同步');
  if(!candidate)assertDemoDelivery(activity, demoStage);
  const zip = new JSZip();
  const config = activity.demoConfiguration;
  if (!config) throw new Error('交付缺少配套配置，请先使用完整 Demo 生成流程并核对配置');
  let html = demo.content;
  for (const image of activityImages(activity)) html = html.replaceAll('attachment:' + image.id, `data:${image.mimeType};base64,${image.base64}`);
  zip.file('src/demo.html', html);
  let scriptIndex = 0, styleIndex = 0;
  // Preserve the original single file and provide an editable split-source entry.
  let entry = html.replace(/<style\b([^>]*)>([\s\S]*?)<\/style\s*>/gi, (_all, attrs: string, source: string) => {
    if (attrs.trim()) return _all;
    const file = `src/styles-${++styleIndex}.css`; zip.file(file, source); return `<link rel="stylesheet" href="./${file}">`;
  }).replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi, (_all, attrs: string, source: string) => {
    if (/\bsrc\s*=|\btype\s*=\s*["'](?:application\/json|application\/ld\+json)/i.test(attrs)) return _all;
    const file = `src/script-${++scriptIndex}.js`; zip.file(file, source); return `<script${attrs} src="./${file}"></script>`;
  });
  const bootstrap = '<script data-activity-studio-runtime src="./config/runtime.js"></script>';
  entry = /<head\b[^>]*>/i.test(entry) ? entry.replace(/<head\b[^>]*>/i, match=>match+bootstrap) : bootstrap+entry;
  zip.file('index.html', entry);
  zip.file('config/runtime.js', attachConfigRuntime('', config, 'offline', true).replace(/^<script[^>]*>/, '').replace(/<\/script>$/, ''));
  zip.file('standalone.html', attachConfigRuntime(html, config, randomUUID(), true));
  const markdownImages = (text: string) => {
    for (const image of activityImages(activity)) {
      const extension = image.mimeType.split('/')[1] === 'jpeg' ? 'jpg' : image.mimeType.split('/')[1];
      const path = `assets/${image.id}.${extension}`;
      zip.file(path, Buffer.from(image.base64, 'base64'));
      text = text.replaceAll('attachment:' + image.id, '../' + path);
    }
    return text;
  };
  const functionalDocument=demoFunctionalDocument(activity,demo);
  zip.file('docs/features.md',markdownImages(functionalDocument));
  zip.file('docs/unity-handoff.md',markdownImages(unityHandoffDocument(activity,demo)));
  if(demo.demoDelivery)zip.file('docs/requirements.json',JSON.stringify(demo.demoDelivery.plan,null,2));
  zip.file('docs/implementation.md', markdownImages(stage==='handoff'?document!.content:functionalDocument));
  zip.file('docs/planning.md', markdownImages(activity.artifacts?.document?.content ?? ''));
  zip.file('README.md', `# ${activity.name}\n\n## 运行\n直接打开 index.html（拆分源码）或 standalone.html（单文件快照）试玩。两者均注入相同配置；离线不回传平台数据。也可安装 Node.js 后在此目录运行 npm start，通过本地地址试玩，不需 npm install。\n\n## 修改\n修改 src/script-*.js 与 src/styles-*.css 后刷新 index.html。src/demo.html 为确认时的原始完整源码快照，standalone.html 为当时独立运行快照，不随拆分源码编辑更新。\n\n配置统一编辑 configuration.json；运行 npm run build:config 或 npm start 会更新 config/runtime.js 及每张表的 JSON。CSV 与 XLSX 是导出快照，外部编辑后需上传平台同步并重新导出，不能只改快照就认为运行配置已更新。\n\n## 交接\ndocs/implementation.md 为逻辑与数值说明；docs/configuration.md 为字段字典；docs/quality.md 为需求、审查和待人工试玩项。此包是可执行原型及交接材料，不等同于游戏客户端上线代码。未知数值见演示假设，不能直接作为线上平衡值。\n`);
  zip.file('docs/quality.md', deliveryNotes(demo, config, activity.artifacts?.document?.updatedAt));
  zip.file('docs/configuration.md', '# 配置字段与关联说明\n\n运行时读取 configuration.json 生成的 config/runtime.js；所有表通过 window.ActivityStudio.tables[表ID] 访问。\n\n' + (config.tables ?? [{ id:'main', name:'主流程', ...config }]).map(table=>`## ${table.id} · ${table.name}\n\n${table.fields.map(field=>`- ${field.key}（${field.label}）：${field.type}${field.required?'，必填':''}。${field.description??''}`).join('\n')}\n`).join('\n'));
  if (activity.demoConfiguration) {
    zip.file('configuration.json', JSON.stringify(activity.demoConfiguration, null, 2));
    zip.file('config/all-tables.xlsx', await exportXlsx(config));
    for (const table of config.tables ?? [{ id: 'main', name: '主流程', ...config }]) {
      zip.file(`config/${table.id}.csv`, exportCsv({ ...table, revision: config.revision, updatedAt: config.updatedAt }));
      zip.file(`config/${table.id}.json`, JSON.stringify(table, null, 2));
    }
  }
  zip.file('package.json', JSON.stringify({ name:'activity-demo-delivery', private:true, type:'module', scripts:{ 'build:config':'node tools/build-config.mjs', start:'node tools/build-config.mjs && node tools/serve.mjs' } },null,2));
  zip.file('tools/build-config.mjs', `import {readFile,writeFile} from 'node:fs/promises';\nconst root=new URL('../',import.meta.url);\nconst config=JSON.parse(await readFile(new URL('configuration.json',root),'utf8'));\nif(config.tables){const primary=config.tables.find(t=>t.id===config.primaryTableId);if(!primary)throw new Error('Missing primary table');config.fields=primary.fields;config.rows=primary.rows;config.pacing=primary.pacing;}\nconst attachConfigRuntime=${attachConfigRuntime.toString()};\nawait writeFile(new URL('config/runtime.js',root),attachConfigRuntime('',config,'offline',true).replace(/^<script[^>]*>/,'').replace(/<\\/script>$/,''));\nfor(const table of config.tables??[{id:'main',...config}]){if(!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(table.id))throw new Error('Invalid table ID');await writeFile(new URL('config/'+table.id+'.json',root),JSON.stringify(table,null,2));}\nconsole.log('运行配置已更新；CSV/XLSX 和 standalone.html 是原导出快照。');\n`);
  zip.file('tools/serve.mjs', `import{createServer}from'node:http';import{readFile}from'node:fs/promises';import{resolve,sep,extname}from'node:path';import{fileURLToPath}from'node:url';\nconst root=fileURLToPath(new URL('../',import.meta.url));const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};\ncreateServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=resolve(root,'.'+(path==='/'?'/index.html':path));if(!file.startsWith(resolve(root)+sep)){res.writeHead(403);return res.end();}const data=await readFile(file);res.writeHead(200,{'content-type':mime[extname(file)]??'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}}).listen(4174,'127.0.0.1',()=>console.log('Demo: http://127.0.0.1:4174'));\n`);
  if (demo.demoProject) {
    const project=demo.demoProject;
    // Original paths and content survive the round trip; no lossy HTML splitting.
    for(const [path,content] of Object.entries(project.files)) zip.file('project/'+path,content);
    zip.file('project-tests.json',JSON.stringify(project.tests,null,2));
    zip.file('project-files.json',JSON.stringify(Object.keys(project.files),null,2));
    zip.file('tools/project-builder.mjs',await readFile(new URL('./demo-project.js',import.meta.url),'utf8'));
    const browserTool=(await readFile(new URL('./demo-browser.js',import.meta.url),'utf8')).replace(/import \{ attachConfigRuntime, demoPreviewPage \} from '@ai-activity-studio\/shared';/, 'const attachConfigRuntime='+attachConfigRuntime.toString()+';const installDemoStorageHost='+installDemoStorageHost.toString()+';const demoPreviewPage='+demoPreviewPage.toString()+';');
    zip.file('tools/project-browser.mjs',browserTool);
    zip.file('tools/build-project.mjs', `import {readFile,writeFile} from 'node:fs/promises';
import {buildDemoProject} from './project-builder.mjs';
const root=new URL('../',import.meta.url);
const paths=JSON.parse(await readFile(new URL('project-files.json',root),'utf8'));
const files=Object.fromEntries(await Promise.all(paths.map(async path=>[path,await readFile(new URL('project/'+path,root),'utf8')])));
const html=await buildDemoProject({files,tests:[]});
await writeFile(new URL('src/demo.html',root),html);
await writeFile(new URL('index.html',root),html.replace(/<head\\b[^>]*>/i,head=>head+'<script src="./config/runtime.js"></script>'));
const config=JSON.parse(await readFile(new URL('configuration.json',root),'utf8'));
const attachConfigRuntime=${attachConfigRuntime.toString()};
await writeFile(new URL('standalone.html',root),attachConfigRuntime(html,config,'offline',true));
console.log('原始工程已重新构建，index.html 与 standalone.html 已更新');
`);
    zip.file('tools/test-project.mjs', `import {readFile} from 'node:fs/promises';
import {validateDemoBrowser} from './project-browser.mjs';
const root=new URL('../',import.meta.url);
const html=await readFile(new URL('src/demo.html',root),'utf8');
const config=JSON.parse(await readFile(new URL('configuration.json',root),'utf8'));
const tests=JSON.parse(await readFile(new URL('project-tests.json',root),'utf8'));
const result=await validateDemoBrowser(html,config,tests,new AbortController().signal);
console.log(JSON.stringify({...result,screenshots:undefined},null,2));
if(!result.passed)process.exitCode=1;
`);
    zip.file('package.json',JSON.stringify({name:'activity-demo-delivery',private:true,type:'module',scripts:{'build:config':'node tools/build-config.mjs',build:'node tools/build-config.mjs && node tools/build-project.mjs',test:'npm run build && node tools/test-project.mjs',start:'node tools/build-config.mjs && node tools/serve.mjs'},dependencies:{esbuild:'0.28.2',playwright:'1.63.0'}},null,2));
    zip.file('README.md',`# ${activity.name} · UE 交互模型完整工程\n\n直接打开 standalone.html 试玩。源码以 project/ 为准，src/ 是导出快照。\n\n## 功能与程序接入\n\n- docs/features.md：需求、源码位置、配置表、测试步骤与实际结果。\n- docs/unity-handoff.md：Unity 迁移契约、美术页面状态清单与待确认项。\n- docs/planning.md：业务策划原文。\n- docs/configuration.md：字段说明；configuration.json：可选覆盖配置，未填写的业务参数采用源码中标明的默认值。\n- docs/quality.md：验证记录与演示假设。\n- docs/requirements.json：结构化需求；project-tests.json：可执行回归场景。\n- docs/implementation.md：本阶段交接说明。\n\n`+'\n## 完整原始工程\nproject/ 保留全部源文件，project-tests.json 保留自动化回归场景。开发时修改 project/ 下的原始文件，新增文件需加入 project-files.json。安装 Node.js 后先 npm install，然后 npm run build 重新构建，npm test 运行浏览器检查（需要 Edge、Chrome 或 npx playwright install chromium）。npm start 提供本地预览。构建会更新 index.html 和 standalone.html；src/script-*.js 是导出快照，不再作为工程修改入口。\n');
  }
  if(candidate){
    const warning='> 候选工程：尚未完成验收。可用于试玩、修改和问题核对，不能视为正式交付通过。具体问题见 docs/quality.md。\n\n';
    for(const name of ['README.md','docs/features.md','docs/unity-handoff.md'])zip.file(name,warning+await zip.file(name)!.async('string'));
  }
  const files = Object.fromEntries(await Promise.all(Object.values(zip.files).filter(file=>!file.dir).map(async file=>[file.name,{sha256:createHash('sha256').update(await file.async('nodebuffer')).digest('hex')}] )));
  zip.file('manifest.json', JSON.stringify({ candidate, activityId: activity.id, productId: activity.productId, name: activity.name, createdAt: new Date().toISOString(), configRevision: activity.demoConfigRevision, files, artifacts: Object.fromEntries(Object.entries(activity.artifacts ?? {}).map(([stage, artifact]) => [stage, { updatedAt: artifact.updatedAt, sha256: createHash('sha256').update(artifact.content).digest('hex') }])) }, null, 2));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
