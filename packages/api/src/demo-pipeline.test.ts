import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, mkdir, symlink } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { Script } from 'node:vm';
import JSZip from 'jszip';
import type { Activity, DemoPlan } from '@ai-activity-studio/shared';
import { configDigest, digest, generateDemo, inspectDemo, parseDemoPlan, parseDemoReview, normalizeDemoHtml, applyDemoEdits } from './demo-pipeline.js';
import { withSourceImages } from './gateway.js';
import { fixturePng } from './docx-fixture.js';
import { encryptSecret } from './crypto.js';
import { handoffZip, deliveryNotes } from './handoff.js';
import { executeGenerationJob, artifactFor } from './executor.js';
import { JsonPersistenceStore } from './store.js';
import { createApiServer } from './server.js';
import { DEMO_SCOPE_VERSION } from './demo-quality-policy.js';
import { assertDemoDelivery } from './workflow.js';

const config = {tables:[{id:'nodes',name:'剧情节点',fields:[{key:'id',label:'ID',type:'number',required:true},{key:'cost',label:'消耗',type:'number',required:true}],rows:[{id:1,cost:10},{id:2,cost:20}],pacing:{}}],primaryTableId:'nodes'};
const rawPlan = {requirements:[{id:'R1',source:'章节1',description:'走完两个节点',acceptance:'两次操作完成，不重复领取',tableIds:['nodes']}],screens:[{id:'map',name:'地图',states:['进行中','完成']}],visualDirection:'SVG 场景与固定 HUD',assumptions:['缺省演示初始体力为100'],configuration:config};
const html = '<!doctype html><html><head><style>body{color:green}</style></head><body><button id="go">清障</button><script>const sdk=window.ActivityStudio;const nodes=sdk.tables["nodes"].rows;let index=0;function advance(){if(index<nodes.length){sdk.track("step_enter",index);sdk.track("step_complete",index++);if(index===nodes.length){sdk.track("session_complete");document.querySelector("#go").disabled=true;}}}document.querySelector("#go").onclick=advance;</script></body></html>';
const tests = [{id:'full-flow',name:'完成全部节点',requirements:['R1'],steps:[{action:'click',selector:'#go'},{action:'click',selector:'#go'},{action:'expectDisabled',selector:'#go'}]}];
const project = (content=html)=>({files:{'index.html':content},tests});
const goodReview = {coverage:[{id:'R1',status:'pass',evidence:'function advance()'}],issues:[],manualChecks:['点击两次核对反馈']};
const repair = {edits:[{find:'清障',replace:'清障完成'}]};
const model = {id:'model',provider:'openai-compatible',model:'mock',enabled:true,baseUrl:'https://example.test/v1',encryptedApiKey:encryptSecret('test','test'),updatedAt:''};
function activity(): Activity {
  const a:Activity={id:'demo-test',name:'测试',description:'',type:'other',status:'draft',owner:'test',createdAt:'2026-01-01',updatedAt:'2026-01-01',approvals:{},artifacts:{}};
  for (const stage of ['source','document'] as const) { const artifact=artifactFor(stage,'# 章节1\n两个节点，均需操作。',a);a.artifacts![stage]=artifact;a.approvals![stage]=artifact.updatedAt; }
  return a;
}
function responses(values: unknown[], onCall?: (index:number, body:any)=>void): typeof fetch {
  let index=0;
  return async (_url,init)=> { onCall?.(index,JSON.parse(String(init?.body))); const value=values[index++];assert.notEqual(value,undefined,'unexpected model call');return Response.json({choices:[{message:{content:typeof value==='string' && value.startsWith('<!doctype') ? JSON.stringify(project(value)) : typeof value==='string'?value:JSON.stringify(value)},finish_reason:'stop'}]}); };
}
test('需求计划保留用户已有数值，补齐新表，审查不能只报告部分需求',()=>{
  const a=activity();const plan=parseDemoPlan(JSON.stringify(rawPlan),a);a.configuration=plan.configuration;a.configuration.tables![0]!.rows[0]!.cost=99;
  const next=parseDemoPlan(JSON.stringify(rawPlan),a);assert.equal(next.configuration.tables![0]!.rows[0]!.cost,99);
  assert.equal(next.configuration.revision,a.configuration.revision);
  const invalidPacing=structuredClone(rawPlan);invalidPacing.configuration.tables[0]!.pacing={duration:'missing'};
  const normalized=parseDemoPlan(JSON.stringify(invalidPacing),activity());assert.deepEqual(normalized.configuration.tables![0]!.pacing,{});assert.ok(normalized.assumptions.some(value=>value.includes('节奏映射')));assert.equal(normalized.configuration.tables![0]!.rows[0]!.cost,10);
  assert.match(parseDemoPlan(JSON.stringify({...rawPlan,visualDirection:{theme:'绘本地图',layout:'固定HUD'}}),activity()).visualDirection,/绘本地图/);
  const optional=structuredClone(rawPlan) as any;optional.configuration.tables[0].fields.push({key:'parent',label:'前置',type:'string',required:true});optional.configuration.tables[0].rows.forEach((row:any)=>row.parent='');
  const optionalPlan=parseDemoPlan(JSON.stringify(optional),activity());assert.equal(optionalPlan.configuration.tables![0]!.fields.at(-1)!.required,false);assert.ok(optionalPlan.assumptions.some(text=>text.includes('空字符串')));
  const unmatched=parseDemoPlan(JSON.stringify({...rawPlan,requirements:[{...rawPlan.requirements[0],tableIds:['missing']}]}),a);assert.deepEqual(unmatched.requirements[0]!.tableIds,[]);assert.ok(unmatched.assumptions.some(text=>text.includes('missing')));
  assert.ok(parseDemoReview(JSON.stringify({...goodReview,coverage:[]}),plan,html).issues.some(s=>s.includes('未审查')));
  assert.ok(parseDemoReview(JSON.stringify({...goodReview,coverage:[{id:'R1',status:'pass',evidence:'fakeFunction'}]}),plan,html).issues.some(s=>s.includes('不存在')));
  const wrapped=parseDemoReview(JSON.stringify({...goodReview,coverage:[{id:'R1',status:'pass',evidence:'src/main.js：`function advance()`，用于推进节点。'}]}),plan,html);
  assert.deepEqual(wrapped.issues,[]);assert.equal(wrapped.coverage[0]!.evidence,'function advance()');
  const multiple=parseDemoReview(JSON.stringify({...goodReview,coverage:[{id:'R1',status:'pass',evidence:'入口：`function advance()`；结束事件：`session_complete`。'}]}),plan,html);
  assert.deepEqual(multiple.issues,[]);assert.equal(multiple.coverage[0]!.evidence,'function advance()');
  assert.ok(parseDemoReview(JSON.stringify({...goodReview,coverage:[{id:'R1',status:'pass',evidence:'`function advance()` 与 `fakeFunction()`'}]}),plan,html).issues.some(s=>s.includes('不存在')));
  assert.ok(parseDemoReview(JSON.stringify({...goodReview,coverage:[{id:'R1',status:'pass',evidence:'src/main.js：`fakeFunction()`，已实现。'}]}),plan,html).issues.some(s=>s.includes('不存在')));
  assert.match(parseDemoReview(JSON.stringify({...goodReview,issues:[{description:'地图不可达'}],manualChecks:[{action:'点击进入'}]}),plan,html).issues[0]!,/地图不可达/);
  assert.throws(()=>parseDemoReview(JSON.stringify({...goodReview,issues:[false]}),plan,html),/格式无效/);
});
test('静态检查阻止语法错误、配置覆盖、外部脚本与范围缩水',()=>{
  const plan=parseDemoPlan(JSON.stringify(rawPlan),activity());assert.deepEqual(inspectDemo(html,plan.configuration),[]);
  for(const bad of [html.replace('let index=0','let = ;'),html.replace('const sdk=', 'window.ActivityStudio.config={};const sdk='),html.replace('</head>','<script src="https://bad.test/a.js"></script></head>'),html.replace('清障','完整流程不在本段实现')]) assert.ok(inspectDemo(bad,plan.configuration).length>0);
  const fixed=normalizeDemoHtml(html.replace('</body>','<div class="loading" hidden>加载中</div></body>'));assert.match(fixed,/\[hidden\]\{display:none!important\}/);assert.equal(normalizeDemoHtml(fixed),fixed);
});
test('只自动修复运行错误，AI 意见不会继续修改源码',async()=>{
  const calls:string[]=[];const report:string[]=[];
  const result=await generateDemo({activity:activity(),stage:'demo',model,secret:'test',signal:new AbortController().signal,guidance:'严格实现',report:async(_p,title)=>{if(title)report.push(title);},fetchImpl:responses([rawPlan,html.replace('let index=0','let = ;'),{edits:[{find:'let = ;',replace:'let index=0'}]},{...goodReview,issues:['反馈动效需完善']},repair,goodReview],(i,body)=>{calls.push(body.messages[0].content);assert.equal(body.stream,true);})});
  assert.equal(calls.length,4);assert.equal(result.delivery.repairs,1);assert.ok(report.some(s=>s.includes('修复')));assert.equal(result.delivery.configHash,configDigest(result.delivery.plan.configuration));assert.deepEqual(result.delivery.review.issues,['反馈动效需完善']);assert.equal(result.project.files['index.html'],html);
  let resumedCalls=0;
  await generateDemo({activity:activity(),stage:'demo',model,secret:'test',signal:new AbortController().signal,guidance:'',report:async()=>{},draft:{signature:'test',planText:JSON.stringify(rawPlan),project:project() as any,content:html},fetchImpl:responses([goodReview],()=>resumedCalls++)});
  assert.equal(resumedCalls,1,'复用草稿时仍须审查，不重复请求计划和实现');
});
test('基础错误修正仍不通过时保留原配置；暂停不会继续下一请求',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'demo-quality-'));t.after(()=>rm(dir,{recursive:true,force:true}));const store=new JsonPersistenceStore(join(dir,'data.json'));
  const a=activity();a.artifacts!.demo=artifactFor('demo','<html>old</html>',a);a.configuration=parseDemoPlan(JSON.stringify(rawPlan),a).configuration;const original=structuredClone(a);
  await store.update(d=>{d.activities=[a];d.modelConfigs=[model];d.skills=[];d.jobs=[{id:'job',activityId:a.id,stage:'demo',kind:'outline',state:'queued',attempts:0,createdAt:'',updatedAt:'',auditTrail:[]}];});
  await executeGenerationJob('job',store,'test',responses([rawPlan,html.replace('let index=0','let = ;'),...Array.from({length:4},()=>({edits:[]}))]));
  const after=await store.read();assert.equal(after.jobs[0]!.state,'failed');assert.match(after.jobs[0]!.error!,/自动修复尚未全部通过/);assert.deepEqual(after.activities[0]!.configuration,original.configuration);assert.deepEqual(after.activities[0]!.artifacts,original.artifacts);
  const controller=new AbortController();let count=0;
  await assert.rejects(generateDemo({activity:a,stage:'demo',model,secret:'test',signal:controller.signal,guidance:'',report:async()=>{},fetchImpl:responses([rawPlan],()=>{count++;controller.abort();})}),{name:'AbortError'});assert.equal(count,1);
});
test('AI 审查格式错误不阻塞已通过实际运行检查的成果',async()=>{
  let calls=0;
  const result=await generateDemo({activity:activity(),stage:'demo',model,secret:'test',signal:new AbortController().signal,guidance:'',report:async()=>{},fetchImpl:responses([rawPlan,html,'invalid review'],()=>calls++)});
  assert.equal(calls,3);assert.equal(result.delivery.validation?.passed,true);assert.equal(result.delivery.review.status,'unavailable');assert.match(result.delivery.review.issues[0]!,/参考意见未完成/);assert.equal(result.project.files['index.html'],html);
});
test('精确修复保留其他代码，拒绝缺失、重复和重叠的修改位置',()=>{
  assert.equal(applyDemoEdits(html,JSON.stringify(repair)),html.replace('清障','清障完成'));
  for(const edits of [[{find:'不存在',replace:'x'}],[{find:'>',replace:'x'}],[{find:'清障',replace:'x'},{find:'>清障<',replace:'x'}]]) assert.throws(()=>applyDemoEdits(html,JSON.stringify({edits})),/候选版本已保留/);
  assert.equal(applyDemoEdits('AAA BBB',JSON.stringify({edits:[{find:'AAA',replace:'BBB'},{find:'BBB',replace:'CCC'}]})),'BBB CCC');
});
test('修复通过后原子保存工程与配置；交付包包含拆分源码与全表 XLSX',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'demo-delivery-'));t.after(()=>rm(dir,{recursive:true,force:true}));const store=new JsonPersistenceStore(join(dir,'data.json'));const a=activity();
  await store.update(d=>{d.activities=[a];d.modelConfigs=[model];d.skills=[];d.jobs=[{id:'job',activityId:a.id,stage:'demo',kind:'outline',state:'queued',attempts:0,createdAt:'',updatedAt:'',auditTrail:[]}];});
  await executeGenerationJob('job',store,'test',responses([rawPlan,html,{...goodReview,issues:['地图视觉需进一步核对']},repair,goodReview ]));
  const after=await store.read();assert.equal(after.jobs[0]!.state,'completed');const saved=after.activities[0]!;assert.equal(saved.demoConfigRevision,1);assert.equal(saved.configuration!.tables!.length,1);assert.ok(saved.artifacts!.demo!.demoDelivery);
  const demoZip=await JSZip.loadAsync(await handoffZip(saved,'demo'));
  const features=await demoZip.file('docs/features.md')!.async('string');
  assert.match(features,/R1/);assert.match(features,/full-flow/);assert.match(features,/index.html/);assert.match(features,/expectDisabled/);assert.ok(demoZip.file('docs/requirements.json'));
  saved.approvals!.demo=saved.artifacts!.demo!.updatedAt;saved.artifacts!['ue-demo']={...saved.artifacts!.demo!,stage:'ue-demo'};saved.approvals!['ue-demo']=saved.artifacts!['ue-demo']!.updatedAt;saved.artifacts!.handoff=artifactFor('handoff','# 说明',saved);
  const zip=await JSZip.loadAsync(await handoffZip(saved));
  for(const name of ['index.html','standalone.html','src/demo.html','src/script-1.js','src/styles-1.css','configuration.json','config/nodes.csv','config/nodes.json','config/all-tables.xlsx','config/runtime.js','docs/configuration.md','docs/quality.md','package.json','tools/build-config.mjs','tools/serve.mjs'])assert.ok(zip.file(name),name);
  assert.match(await zip.file('docs/quality.md')!.async('string'),/R1/);
  assert.match(await zip.file('docs/quality.md')!.async('string'),/已实际通过/);
  assert.match(await zip.file('docs/unity-handoff.md')!.async('string'),/Unity/);assert.match(await zip.file('docs/features.md')!.async('string'),/UE 交互模型/);
  assert.ok(zip.file('project/index.html'));assert.ok(zip.file('project-tests.json'));assert.ok(zip.file('tools/build-project.mjs'));
  assert.equal(await zip.file('project/index.html')!.async('string'),saved.artifacts!.demo!.demoProject!.files['index.html']);
  const entry=await zip.file('index.html')!.async('string');assert.ok(entry.indexOf('./config/runtime.js')<entry.indexOf('./src/script-1.js'));new Script(await zip.file('config/runtime.js')!.async('string'));
  const folder=join(dir,'export');for(const file of Object.values(zip.files)){if(file.dir)continue;const target=join(folder,file.name);await mkdir(dirname(target),{recursive:true});await writeFile(target,await file.async('nodebuffer'));}
  const edited=JSON.parse(await readFile(join(folder,'configuration.json'),'utf8'));edited.tables[0].rows[0].cost=77;await writeFile(join(folder,'configuration.json'),JSON.stringify(edited));
  await promisify(execFile)(process.execPath,['tools/build-config.mjs'],{cwd:folder,windowsHide:true});assert.match(await readFile(join(folder,'config/runtime.js'),'utf8'),/"cost":77/);
  await symlink(resolve(import.meta.dirname,'../../../node_modules'),join(folder,'node_modules'),'junction');
  await promisify(execFile)(process.execPath,['tools/build-project.mjs'],{cwd:folder,windowsHide:true});
  const rebuilt=await readFile(join(folder,'index.html'),'utf8');assert.ok(rebuilt.indexOf('./config/runtime.js')<rebuilt.indexOf('function advance'));
  await promisify(execFile)(process.execPath,['tools/test-project.mjs'],{cwd:folder,windowsHide:true,timeout:60_000});
  assert.match(deliveryNotes({...saved.artifacts!.demo!,content:html+'changed'},saved.demoConfiguration),/没有匹配/);
  assert.match(deliveryNotes(saved.artifacts!.demo!,saved.demoConfiguration,'new-document-version'),/没有匹配/);
});
test('已完成的 Demo 重新生成不会复用旧候选代码',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'demo-regenerate-'));const store=new JsonPersistenceStore(join(dir,'data.json'));const a=activity();let calls=0;
  await store.update(d=>{d.activities=[a];d.modelConfigs=[model];d.skills=[];d.jobs=[];});
  const server=createApiServer({store,encryptionSecret:'test',fetchImpl:responses([rawPlan,html,goodReview,rawPlan,html.replace('清障','新版清障'),goodReview],()=>calls++)});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('listen failed');const base=`http://127.0.0.1:${address.port}`;
  t.after(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(dir,{recursive:true,force:true});});
  for(let run=0;run<2;run++){
    const response=await fetch(base+'/api/generation-jobs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({activityId:a.id,stage:'demo',regenerate:true})});assert.equal(response.status,201);const job=await response.json() as {id:string};
    for(let i=0;i<1000;i++){const current=(await store.read()).jobs.find(j=>j.id===job.id)!;if(current.state==='completed'||current.state==='failed')break;await new Promise(resolve=>setTimeout(resolve,20));}
    assert.equal((await store.read()).jobs.find(j=>j.id===job.id)!.state,'completed');
  }
  assert.equal(calls,6);assert.match((await store.read()).activities[0]!.artifacts!.demo!.content,/新版清障/);
});
test('同一图片只发送一次，同时保留两个原文引用',()=>{
  const a=activity();a.sourceDocument={fileName:'a.docx',size:1,images:[{id:'one',name:'a',mimeType:'image/png',base64:'abc'}],warnings:[],importedAt:''};a.planningDocument={...a.sourceDocument,images:[{...a.sourceDocument.images[0]!,id:'two'}]};
  const message=withSourceImages(a,'attachment:one attachment:two');assert.ok(Array.isArray(message.content));assert.equal(message.content.filter(p=>p.type==='image_url').length,1);assert.match(JSON.stringify(message),/attachment:one.*attachment:two/);
});

test('补丁位置失败时下一次修复保留原始问题，不只修复补丁格式',async()=>{
  const broken=html.replace('let index=0','let = ;');let inspected=false;
  const result=await generateDemo({activity:activity(),stage:'demo',model,secret:'test',signal:new AbortController().signal,guidance:'',report:async()=>{},fetchImpl:responses([rawPlan,broken,{edits:[{find:'missing-location',replace:'x'}]},{edits:[{find:'let = ;',replace:'let index=0'}]},goodReview],(index,body)=>{if(index===3){const prompt=JSON.stringify(body.messages);assert.match(prompt,/JavaScript 语法错误/);assert.match(prompt,/修改位置缺失或不唯一/);inspected=true;}})});
  assert.equal(inspected,true);assert.equal(result.delivery.validation?.passed,true);
});

test('配置可省略，空的补充表不阻塞默认值流程，动态读表不会被静态误判',async()=>{
  const optional=activity();
  optional.configuration=parseDemoPlan(JSON.stringify(rawPlan),activity()).configuration;
  optional.configuration.tables![0]!.rows=[];optional.configuration.rows=[];
  const defaultsHtml=html.replace('sdk.tables["nodes"].rows','(sdk.tables["nodes"]?.rows.length?sdk.tables["nodes"].rows:[{id:1,cost:10},{id:2,cost:20}])');
  const omitted={...rawPlan,configuration:undefined};
  const result=await generateDemo({activity:optional,stage:'demo',model,secret:'test',signal:new AbortController().signal,guidance:'',report:async()=>{},fetchImpl:responses([omitted,defaultsHtml,goodReview])});
  assert.equal(result.delivery.validation?.passed,true);
  assert.equal(result.delivery.plan.configuration.tables!.find(table=>table.id==='nodes')!.rows.length,0);
  assert.equal(result.delivery.plan.configuration.primaryTableId,'interaction_flow');
  assert.ok(result.delivery.plan.assumptions.some(text=>text.includes('未填写')));
  const noConfig=parseDemoPlan(JSON.stringify(omitted),activity());
  assert.equal(noConfig.configuration.rows.length,1);
  assert.deepEqual(inspectDemo(html.replace('sdk.tables["nodes"]','sdk.tables[["nodes"].join("")]'),result.delivery.plan.configuration),[]);
});

test('候选工程可导出源码和待验收文档，导出不写产物或越过确认门槛',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'candidate-export-'));const store=new JsonPersistenceStore(join(dir,'data.json')),a=activity();
  const plan=parseDemoPlan(JSON.stringify(rawPlan),a);
  await store.update(data=>{data.activities=[a];data.jobs=[{id:'candidate',activityId:a.id,stage:'demo',kind:'outline',state:'failed',attempts:1,createdAt:'',updatedAt:'',auditTrail:[],error:'仍需核对结算',demoDraft:{signature:'test',planText:JSON.stringify(plan),project:project() as any,content:normalizeDemoHtml(html)}}];});
  const before=await store.read(),server=createApiServer({store,encryptionSecret:'test'});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address() as {port:number};
  t.after(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(dir,{recursive:true,force:true});});
  const response=await fetch(`http://127.0.0.1:${address.port}/api/generation-jobs/candidate/candidate.zip`);
  assert.equal(response.status,200);const zip=await JSZip.loadAsync(await response.arrayBuffer());
  assert.equal(JSON.parse(await zip.file('manifest.json')!.async('string')).candidate,true);
  assert.match(await zip.file('README.md')!.async('string'),/尚未完成验收/);
  assert.ok(zip.file('docs/features.md'));assert.ok(zip.file('docs/unity-handoff.md'));assert.ok(zip.file('project/index.html'));
  assert.match(await zip.file('docs/quality.md')!.async('string'),/仍需核对结算/);
  assert.deepEqual(await store.read(),before);
  assert.equal((await fetch(`http://127.0.0.1:${address.port}/api/activities/${a.id}/confirm/demo`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({expectedUpdatedAt:''})})).status,400);
});

test('分文件生成经过真实编译与浏览器验证，进度含文件、场景和修复结果',async()=>{
  const script=html.match(/<script>([\s\S]*?)<\/script>/)![1]!;
  const entry=html.replace(/<script>[\s\S]*?<\/script>/,'<script src="./src/main.js"></script>');
  const manifest=[{path:'src/main.js',purpose:'节点规则',requirements:['R1'],dependsOn:[],contract:'绑定 go 按钮；advance 推进两节点'}, {path:'index.html',purpose:'页面入口',requirements:['R1'],dependsOn:['src/main.js'],contract:'包含 go 按钮及反馈区域'}];
  const titles:string[]=[];
  const result=await generateDemo({activity:activity(),stage:'demo',model,secret:'test',signal:new AbortController().signal,guidance:'',report:async(_patch,title)=>{if(title)titles.push(title);},fetchImpl:responses([rawPlan,{manifest},{path:'src/main.js',content:script},{path:'index.html',content:entry},{tests},goodReview])});
  assert.equal(result.delivery.validation?.passed,true);assert.equal(Object.keys(result.project.files).length,2);
  assert.ok(titles.some(title=>title.includes('已保存 src/main.js')));assert.ok(titles.some(title=>title.includes('通过：平台预览')));
});


test('无用户配置时自动生成默认数据，错误类型会补齐重试，配置可保存并交付',async()=>{
  const empty=structuredClone(rawPlan);empty.configuration.tables[0]!.rows=[{id:1,cost:"wrong" as any}];
  const reports:string[]=[];
  const result=await generateDemo({activity:activity(),stage:'demo',model,secret:'test',signal:new AbortController().signal,guidance:'',report:async(_p,title)=>{if(title)reports.push(title);},fetchImpl:responses([empty,rawPlan,html,goodReview])});
  assert.equal(result.delivery.plan.configuration.tables![0]!.rows.length,2);
  assert.equal(result.delivery.plan.configuration.tables![0]!.rows[0]!.cost,10);
  assert.ok(result.delivery.plan.assumptions.length>0);
  assert.ok(reports.some(text=>text.includes('默认演示配置')));
});

test('AI 意见随成果保存，确认和导出不以意见清零为门槛',async()=>{
  const review={...goodReview,issues:['结算时重复发奖']};
  const a=activity();let calls=0;
  const result=await generateDemo({activity:a,stage:'demo',model,secret:'test',signal:new AbortController().signal,guidance:'',report:async()=>{},fetchImpl:responses([rawPlan,html,review],()=>calls++)});
  assert.equal(calls,3);assert.equal(result.delivery.repairs,0);assert.deepEqual(result.delivery.review.issues,review.issues);
  a.demoConfiguration=result.delivery.plan.configuration;a.configuration=a.demoConfiguration;a.demoConfigRevision=a.configuration.revision;
  a.artifacts!.demo={...artifactFor('demo',result.content,a),demoProject:result.project,demoDelivery:result.delivery};
  assert.doesNotThrow(()=>assertDemoDelivery(a,'demo'));
  const zip=await JSZip.loadAsync(await handoffZip(a,'demo'));assert.match(await zip.file('docs/quality.md')!.async('string'),/结算时重复发奖/);
  result.delivery.review.status='unavailable';assert.doesNotThrow(()=>assertDemoDelivery(a,'demo'));
  a.artifacts!.demo.content+='changed';assert.throws(()=>assertDemoDelivery(a,'demo'),/尚未通过/);
});

test('审查时暂停不会保存，恢复相同成果复用已有意见且不调用模型',async()=>{
  const controller=new AbortController();let count=0;
  await assert.rejects(generateDemo({activity:activity(),stage:'demo',model,secret:'test',signal:controller.signal,guidance:'',report:async()=>{},fetchImpl:responses([rawPlan,html,goodReview],index=>{count++;if(index===2)controller.abort();})}),{name:'AbortError'});
  assert.equal(count,3);
  let resumed=0;
  const result=await generateDemo({activity:activity(),stage:'demo',model,secret:'test',signal:new AbortController().signal,guidance:'',report:async()=>{},draft:{signature:'test',planText:JSON.stringify(rawPlan),project:project() as any,content:normalizeDemoHtml(html),reviewText:JSON.stringify({...goodReview,issues:['视觉问题']}),reviewContentHash:digest(normalizeDemoHtml(html))},fetchImpl:responses([],()=>resumed++)});
  assert.equal(resumed,0);assert.deepEqual(result.delivery.review.issues,['视觉问题']);assert.equal(result.delivery.validation?.passed,true);assert.equal(result.project.files['index.html'],html);
});


test('长需求清单、缺省说明与不同写法自动兼容，不再阻断实现',()=>{
  const requirements=Array.from({length:200},(_,index)=>({id:'重复编号',description:`功能${index}`,source:['正文',index],acceptance:{action:'点击',result:'生效'},tableIds:'nodes'}));
  const plan=parseDemoPlan(JSON.stringify({requirements,configuration:config,screens:{地图:{states:{正常:'可操作',完成:'领奖'}},奖励:'奖励弹层'},assumptions:{初始体力:'演示值100'}}),activity());
  assert.equal(plan.requirements.length,200);assert.equal(new Set(plan.requirements.map(rule=>rule.id)).size,200);
  assert.match(plan.requirements[199]!.description,/功能199/);assert.match(plan.requirements[0]!.acceptance,/生效/);
  assert.match(plan.screens[0]!.states[0]!,/可操作/);assert.match(plan.assumptions[0]!,/演示值100/);
  const minimal=parseDemoPlan(JSON.stringify({configuration:config}),activity());assert.equal(minimal.configuration.tables![0]!.rows.length,2);assert.equal(minimal.requirements.length,1);assert.equal(minimal.screens.length,1);
  const prose=parseDemoPlan('以下是规格：\n'+JSON.stringify({plan:{configuration:config,requirements:['全部入口可用']}})+'\n完成。',activity());assert.equal(prose.requirements[0]!.description,'全部入口可用');
});

test('只返回配置也直接进入实现，完整策划仍传入模型，不额外重写清单',async()=>{
  const calls:any[]=[];
  const result=await generateDemo({activity:activity(),stage:'demo',model,secret:'test',signal:new AbortController().signal,guidance:'实现时只返回HTML',report:async()=>{},fetchImpl:responses([{configuration:config},html,goodReview],(_index,body)=>calls.push(body))});
  assert.equal(calls.length,3);assert.match(result.content,/function advance/);
  assert.ok(JSON.stringify(calls[1].messages).includes('两个节点，均需操作。'));
  assert.ok(!calls[0].messages[0].content.includes('实现时只返回HTML'));
});

test('配置失败前保存模型返回，重试只补配置且已有用户值保持不变',async()=>{
  const a=activity();const draft:any={signature:'test'};const empty={...rawPlan,configuration:{...config,tables:config.tables.map(table=>({...table,rows:[{id:1,cost:'wrong'}]}))}};
  await assert.rejects(generateDemo({activity:a,stage:'demo',model,secret:'test',signal:new AbortController().signal,guidance:'',report:async()=>{},checkpoint:async patch=>{Object.assign(draft,patch);},fetchImpl:responses([empty,{tables:[{id:'broken'}],primaryTableId:'broken'}])}),/整理结果已保留/);
  assert.ok(draft.planText);assert.equal(JSON.parse(draft.planText).requirements[0].description,rawPlan.requirements[0]!.description);
  let calls=0;
  const result=await generateDemo({activity:a,stage:'demo',model,secret:'test',signal:new AbortController().signal,guidance:'',report:async()=>{},draft,fetchImpl:responses([config,html,goodReview],()=>calls++)});
  assert.equal(calls,3,'只请求配置、实现、审查，不重新整理需求');assert.equal(result.delivery.plan.configuration.tables![0]!.rows.length,2);
  a.configuration=result.delivery.plan.configuration;a.configuration.tables![0]!.rows[0]!.cost=99;
  const normalized=parseDemoPlan(JSON.stringify({configuration:config,requirements:[]}),a);
  assert.equal(normalized.configuration.tables![0]!.rows[0]!.cost,99);
  assert.throws(()=>parseDemoPlan(JSON.stringify({configuration:{...config,tables:config.tables.map(table=>({...table,rows:[{id:1,cost:'wrong'}]}))}}),activity()),/必须为 number/);
});

test('对话修改复用原需求和原工程，不重新策划或整页生成',async()=>{
  const a=activity();const plan=parseDemoPlan(JSON.stringify(rawPlan),a);
  a.configuration=plan.configuration;
  a.artifacts!.demo={...artifactFor('demo',html,a),demoProject:project() as any,demoDelivery:{scopeVersion:DEMO_SCOPE_VERSION,plan,review:goodReview as any,checkedAt:'',contentHash:'',configHash:'',repairs:0}};
  const calls:any[]=[];
  const result=await generateDemo({activity:a,stage:'demo',model,secret:'test',signal:new AbortController().signal,guidance:'',instruction:'把按钮变大，保留主玩法',inputImages:[{id:'reference-1',name:'参考.png',mimeType:'image/png',base64:fixturePng().toString('base64')}],inputContent:html,report:async()=>{},fetchImpl:responses([{edits:[{path:'index.html',find:'<button id="go">',replace:'<img alt="参考" src="attachment:reference-1"><button id="go" style="min-height:48px">'}]},goodReview],(_i,body)=>calls.push(body))});
  assert.equal(calls.length,2,'只修改与审查，不重新生成需求');
  assert.ok(calls[0].messages[1].content.some((part:any)=>part.type==='image_url'&&part.image_url.url==='data:image/png;base64,'+fixturePng().toString('base64')));
  assert.doesNotMatch(result.content,/attachment:reference-1/);assert.match(result.content,/data:image\/png;base64,/);
  assert.deepEqual(result.project.tests,tests);assert.match(result.content,/function advance/);assert.match(result.content,/min-height:48px/);
  assert.equal(result.delivery.plan.requirements[0]!.description,rawPlan.requirements[0]!.description);assert.equal(result.delivery.validation?.passed,true);
});

test('交付确认拒绝没有实际测试的旧版报告',()=>{
  const a=activity();const plan=parseDemoPlan(JSON.stringify(rawPlan),a);a.demoConfiguration=plan.configuration;
  a.artifacts!.demo={...artifactFor('demo',html,a),demoDelivery:{scopeVersion:DEMO_SCOPE_VERSION,plan,review:goodReview as any,checkedAt:'',contentHash:'',configHash:configDigest(plan.configuration),repairs:0}};
  assert.throws(()=>assertDemoDelivery(a,'demo'),/尚未通过自动验证/);
});
test('工程输出格式异常由模型修复，完整返回在解析前保留',async()=>{
  const checkpoints:any[]=[];
  const result=await generateDemo({activity:activity(),stage:'demo',model,secret:'test',signal:new AbortController().signal,guidance:'',report:async()=>{},checkpoint:async patch=>{checkpoints.push(patch);},fetchImpl:responses([rawPlan,'invalid project',html,goodReview])});
  assert.equal(result.delivery.validation?.passed,true);assert.ok(checkpoints.some(patch=>patch.implementationText==='invalid project'));
});


test('旧版主线需求和测试不进入活动专用范围，生成与审查统一使用 Debug 供给',async()=>{
  const a=activity();
  const oldPlan=structuredClone(rawPlan);oldPlan.requirements[0]!.id='MAINLINE_BOARD';oldPlan.requirements[0]!.description='制作主线棋盘并填满16格';
  a.artifacts!.demo={...artifactFor('demo','<html>old board</html>',a),demoProject:{files:{'index.html':'<html>old board</html>'},tests:[{id:'board-capacity',name:'主线棋盘容量',requirements:['MAINLINE_BOARD'],steps:[{action:'expectCount',selector:'#board .cell',count:16}]}]},demoDelivery:{plan:parseDemoPlan(JSON.stringify(oldPlan),a),review:goodReview as any,checkedAt:'',contentHash:'',configHash:'',repairs:0}};
  const calls:any[]=[];
  const result=await generateDemo({activity:a,stage:'demo',model,secret:'test',signal:new AbortController().signal,guidance:'旧 Skill 要求做主线棋盘',instruction:'只做活动，外部资源通过 Debug 点击发放',report:async()=>{},fetchImpl:responses([rawPlan,html,goodReview],(_i,body)=>calls.push(body))});
  assert.equal(calls.length,3);
  for(const body of calls){assert.match(body.messages[0].content,/不得以主线棋盘容量/);assert.match(body.messages[0].content,/所有外部产出只能在用户点击后发生/);}
  assert.ok(!JSON.stringify(calls).includes('board-capacity'));assert.ok(!JSON.stringify(calls).includes('MAINLINE_BOARD'));
  assert.equal(result.delivery.scopeVersion,DEMO_SCOPE_VERSION);assert.deepEqual(result.project.tests,tests);
  assert.equal(a.artifacts!.demo!.content,'<html>old board</html>','新版本验证完成前不改已保存版本');
});
