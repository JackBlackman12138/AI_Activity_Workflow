import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { createApiServer } from './server.js';
import { JsonPersistenceStore } from './store.js';
import { stageGuidance } from './stage-guidance.js';
import { configurationFromDocument, validateConfiguration } from './configuration.js';
import { attachConfigRuntime, canEnterStage } from '@ai-activity-studio/shared';

async function setup(t: any, options: Parameters<typeof createApiServer>[0] = {}) {
  const dir=await mkdtemp(join(tmpdir(),'pipeline-v3-')); const store=new JsonPersistenceStore(join(dir,'runtime.json'));
  const server=createApiServer({...options,store,encryptionSecret:'test'});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw new Error('listen');
  const base=`http://127.0.0.1:${address.port}`;
  t.after(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(dir,{recursive:true,force:true});});
  const call=async(path:string,method='GET',data?:unknown)=>{const res=await fetch(base+path,{method,...(data===undefined?{}:{headers:{'content-type':'application/json'},body:JSON.stringify(data)})});return {status:res.status,data:await res.json() as any};};
  const created=await call('/api/activities','POST',{name:'新管线测试',type:'race',productId:'mc',markdown:'# 原稿'});assert.equal(created.status,201);
  const id=created.data.id;const path='/api/activities/'+id;
  const save=async(stage:string,content:string)=>call(path+'/artifacts/'+stage,'PUT',{content,kind:stage.includes('demo')?'html':'markdown',mimeType:stage.includes('demo')?'text/html':'text/markdown',fileName:stage+(stage.includes('demo')?'.html':'.md')});
  const confirm=async(stage:string)=>{const artifact=(await call(path+'/artifacts/'+stage)).data;return call(path+'/confirm/'+stage,'POST',{expectedUpdatedAt:artifact.updatedAt});};
  const wait=async(jobId:string)=>{let job:any;for(let n=0;n<100;n++){job=(await call('/api/generation-jobs/'+jobId)).data;if(['completed','failed'].includes(job.state))return job;await new Promise(r=>setTimeout(r,10));}throw new Error('timeout '+JSON.stringify(job));};
  return {base,store,call,id,path,save,confirm,wait};
}

test('新流程不能通过导航外的保存、上传、生成、修改和配置同步跳阶段',async t=>{
  const app=await setup(t); const {call,path,id,save,confirm}=app;
  await call('/api/model-configs','POST',{provider:'demo',model:'demo'});
  assert.equal((await save('document','# 未确认原稿')).status,400);
  assert.equal((await call('/api/generation-jobs','POST',{activityId:id,stage:'demo'})).status,409);
  assert.equal((await call(path+'/artifacts/ue-demo/refine','POST',{content:'html',instruction:'改'})).status,400);
  assert.equal((await confirm('source')).status,200);
  assert.equal((await save('flow','legacy')).status,400);
  assert.equal((await save('document','# 已确认来源')).status,200);
  assert.equal((await call(path+'/confirm/document','POST',{expectedUpdatedAt:'old'})).status,400);
  assert.equal((await save('demo','<html>跳过确认</html>')).status,400);
  assert.equal((await confirm('document')).status,200);
  assert.equal((await save('demo','<html><body><button>试玩</button></body></html>')).status,200);
  assert.equal((await confirm('demo')).status,200);
  assert.equal((await call(path+'/ue-demo/initialize','POST',{})).status,200);
  assert.equal((await call(path)).data.artifacts['ue-demo'].content,(await call(path)).data.artifacts.demo.content);
  assert.equal((await confirm('ue-demo')).status,200);
  await save('handoff','# 交付'); await confirm('handoff');
  await save('source','# 修改上游');
  const changed=(await call(path)).data;assert.deepEqual(changed.approvals,{});assert.ok(changed.artifacts['ue-demo']);
  assert.equal((await fetch(app.base+path+'/handoff.zip')).status,400);
});

test('清除 Demo 同时清理下游和草稿，保留策划图文且可全新生成',async t=>{
  const {call,path,id,save,confirm,store,wait}=await setup(t);
  await call('/api/model-configs','POST',{provider:'demo',model:'demo'});await confirm('source');await save('document','# 已确认策划');await confirm('document');
  await save('demo','<html>old</html>');await confirm('demo');await call(path+'/ue-demo/initialize','POST',{});await confirm('ue-demo');await save('handoff','# 旧交付');await confirm('handoff');
  await store.update(data=>{
    const a=data.activities.find(a=>a.id===id)!;a.sourceDocument={fileName:'source.docx',size:1,images:[],warnings:[],importedAt:''};a.planningDocument={...a.sourceDocument,fileName:'planning.docx'};
    a.configuration={...validateConfiguration({fields:[{key:'id',label:'ID',type:'number',required:true}],rows:[{id:1}],pacing:{}}),revision:3,updatedAt:'config'};a.demoConfiguration=structuredClone(a.configuration);a.demoConfigRevision=3;a.playEvents=[{id:'old-event',sessionId:'old-session',type:'session_start',revision:3,elapsedMs:0,at:''}];a.figmaUrl='https://www.figma.com/design/test';
    for(const stage of ['source','document','demo','ue-demo','handoff'] as const)data.jobs.push({id:'reset-'+stage,activityId:id,stage,kind:'outline',state:stage==='demo'?'paused':'completed',attempts:0,createdAt:'',updatedAt:'',auditTrail:[],demoDraft:{signature:'old',content:'stale'}});
    data.activities.push({...structuredClone(a),id:'other-activity'});data.jobs.push({...data.jobs.at(-1)!,id:'other-job',activityId:'other-activity'});
  });
  const before=(await call(path)).data;const other=structuredClone((await store.read()).activities.find(a=>a.id==='other-activity'));
  assert.equal((await call(path+'/demo/reset','POST',{expectedUpdatedAt:'stale',clearConfiguration:true})).status,409);
  assert.equal((await call(path+'/demo/reset','POST',{expectedUpdatedAt:before.updatedAt})).status,400);
  const cleared=await call(path+'/demo/reset','POST',{expectedUpdatedAt:before.updatedAt,clearConfiguration:true});assert.equal(cleared.status,200);
  const a=cleared.data;for(const stage of ['source','document']){assert.deepEqual(a.artifacts[stage],before.artifacts[stage]);assert.equal(a.approvals[stage],before.approvals[stage]);}
  assert.deepEqual(a.sourceDocument,before.sourceDocument);assert.deepEqual(a.planningDocument,before.planningDocument);
  for(const stage of ['demo','ue-demo','handoff']){assert.equal(a.artifacts[stage],undefined);assert.equal(a.approvals[stage],undefined);}
  for(const key of ['configuration','demoConfiguration','demoConfigRevision','playEvents','figmaUrl'])assert.equal(a[key],undefined,key);
  assert.equal(canEnterStage(a,'demo'),true);assert.equal(canEnterStage(a,'ue-demo'),false);
  assert.deepEqual((await store.read()).activities.find(a=>a.id==='other-activity'),other);
  assert.deepEqual((await call(path+'/generation-jobs')).data.map((j:any)=>j.stage).sort(),['document','source']);
  assert.equal((await call('/api/generation-jobs/reset-demo/resume','POST')).status,404);
  assert.equal((await call(path+'/play-events','POST',before.playEvents[0])).status,400);
  const job=await call('/api/generation-jobs','POST',{activityId:id,stage:'demo'});assert.equal(job.status,201);assert.equal(job.data.demoDraft,undefined);assert.equal((await wait(job.data.id)).state,'completed');
});

test('清除 Demo 可保留手工配置，运行中的请求被终止且迟到结果不回写',async t=>{
  let resolveResponse!:(response:Response)=>void;let signal:AbortSignal|undefined;
  const {call,path,id,save,confirm,store}=await setup(t,{fetchImpl:async(_url,init)=>{signal=init?.signal as AbortSignal;return new Promise(resolve=>{resolveResponse=resolve;});}});
  await call('/api/model-configs','POST',{provider:'openai-compatible',model:'test',baseUrl:'https://example.test/v1',apiKey:'test'});await confirm('source');await save('document','# 策划');await confirm('document');await save('demo','<html>old</html>');await confirm('demo');await call(path+'/ue-demo/initialize','POST',{});await confirm('ue-demo');
  await store.update(data=>{data.activities.find(a=>a.id===id)!.configuration={...validateConfiguration({fields:[{key:'id',label:'ID',type:'number',required:true}],rows:[{id:42}],pacing:{}}),revision:2,updatedAt:'manual'};});
  const job=(await call('/api/generation-jobs','POST',{activityId:id,stage:'handoff'})).data;
  for(let n=0;n<100&&!signal;n++)await new Promise(resolve=>setTimeout(resolve,10));assert.ok(signal);
  const before=(await call(path)).data;
  const reset=await call(path+'/demo/reset','POST',{expectedUpdatedAt:before.updatedAt,clearConfiguration:false});assert.equal(reset.status,200);assert.equal(signal.aborted,true);assert.deepEqual(reset.data.configuration,before.configuration);
  resolveResponse(Response.json({choices:[{message:{content:'# 迟到交付'}}]}));await new Promise(resolve=>setTimeout(resolve,40));
  const after=(await call(path)).data;assert.equal(after.artifacts.handoff,undefined);assert.equal(after.artifacts.demo,undefined);assert.equal((await call('/api/generation-jobs/'+job.id)).status,404);
});

test('活动类型可配置，产品类型 Skill 精确匹配且受启停控制',async t=>{
  const {call,store}=await setup(t);
  const products=(await call('/api/products')).data;products[0].activityTypes.push({id:'energy-map',name:'体力清图'});
  assert.equal((await call('/api/products','PUT',products)).status,200);
  const activity=(await call('/api/activities','POST',{name:'清图',type:'energy-map',productId:'mc'})).data;
  assert.equal((await call('/api/activities/'+activity.id,'PATCH',{type:'energy-map',productId:'mc',name:'清图改名'})).status,200);
  const template=(await call('/api/template-skills','POST',{name:'清图框架',stage:'document',productId:'mc',activityType:'energy-map',content:'仅清图活动使用的框架标识XYZ'})).data;
  assert.equal(template.appliedToGeneration,true);
  assert.match((await stageGuidance('document',(await store.read()).skills,activity)).content,/框架标识XYZ/);
  assert.doesNotMatch((await stageGuidance('document',(await store.read()).skills,{...activity,type:'race'})).content,/框架标识XYZ/);
  await call('/api/skills/'+template.id,'PATCH',{enabled:false});
  assert.doesNotMatch((await stageGuidance('document',(await store.read()).skills,activity)).content,/框架标识XYZ/);
  products[0].activityTypes=products[0].activityTypes.filter((type:any)=>type.id!=='energy-map');
  assert.equal((await call('/api/products','PUT',products)).status,400);
  assert.equal((await call('/api/integrations')).data.mode,'local');
  assert.equal((await call('/api/integrations/feishu/login')).status,503);
});

test('多张配置表统一版本、同步、UE 联调和源码 ZIP 交付',async t=>{
  const app=await setup(t);const {call,id,path,save,confirm,wait}=app;
  await call('/api/model-configs','POST',{provider:'demo',model:'demo'}); await confirm('source');
  const markdown='# 主流程\n| name | actions |\n| --- | --- |\n| 入口 | 1 |\n\n# 奖励表\n| rewardId | amount |\n| --- | --- |\n| gold | 10 |';
  await save('document',markdown);
  const config=(await call(path+'/configuration/generate','POST',{})).data;assert.equal(config.tables.length,2);
  assert.equal(config.tables[1].rows[0].amount,10);
  const saved=await call(path+'/configuration','PUT',{configuration:config,expectedRevision:0});assert.equal(saved.status,200);
  assert.equal((await call(path+'/configuration','PUT',{configuration:config,expectedRevision:0})).status,409);
  await confirm('document');
  const generated=await call('/api/generation-jobs','POST',{activityId:id,stage:'demo'});assert.equal((await wait(generated.data.id)).state,'completed');
  assert.equal((await call(path)).data.demoConfiguration.tables.length,2);
  assert.match(attachConfigRuntime('<head></head>',saved.data,'session'),/tables:Object.fromEntries/);
  await confirm('demo'); await call(path+'/ue-demo/initialize','POST',{});
  const initial=(await call(path)).data.artifacts.demo.content;
  await call(path+'/artifacts/ue-demo/refine','POST',{content:initial,instruction:'联调新增状态提示'});
  assert.equal((await call(path)).data.artifacts.demo.content,initial);
  assert.match((await call(path)).data.artifacts['ue-demo'].content,/联调新增状态提示/);
  await confirm('ue-demo');
  const handoff=await call('/api/generation-jobs','POST',{activityId:id,stage:'handoff'});assert.equal((await wait(handoff.data.id)).state,'completed');
  const download=await fetch(app.base+path+'/handoff.zip');assert.equal(download.status,200);
  const zip=await JSZip.loadAsync(await download.arrayBuffer());
  for(const file of ['src/demo.html','index.html','configuration.json','config/main.csv','config/table_2.csv','docs/implementation.md','docs/planning.md','manifest.json'])assert.ok(zip.file(file),file);
  assert.match(await zip.file('src/demo.html')!.async('string'),/联调新增状态提示/);
  const collection=JSON.parse(await zip.file('configuration.json')!.async('string'));assert.equal(collection.tables[1].rows[0].amount,10);
  assert.match(await zip.file('index.html')!.async('string'),/data-activity-studio-runtime/);
  const changed=structuredClone(saved.data);changed.tables[1].rows[0].amount=20;
  await call(path+'/configuration','PUT',{configuration:changed,expectedRevision:1});
  const after=(await call(path)).data;assert.ok(after.approvals.source);assert.equal(after.approvals.document,undefined);assert.equal(after.demoConfiguration.tables[1].rows[0].amount,10);
  assert.equal((await call(path+'/configuration/sync','POST',{expectedRevision:2})).status,400);
});

test('生成过程中上游修改，迟到结果不能覆盖当前活动',async t=>{
  let release!:()=>void;let started=false;
  const app=await setup(t,{fetchImpl:async()=>{started=true;await new Promise<void>(r=>release=r);return Response.json({choices:[{message:{content:'# 已过期输出'}}]});}});
  await app.call('/api/model-configs','POST',{provider:'custom',model:'mock',baseUrl:'https://example.test/v1',apiKey:'test'});
  await app.confirm('source');const job=await app.call('/api/generation-jobs','POST',{activityId:app.id,stage:'document'});
  for(let i=0;i<100&&!started;i++)await new Promise(r=>setTimeout(r,5));assert.ok(started);
  await app.save('source','# 新原稿');release();
  assert.equal((await app.wait(job.data.id)).state,'failed');assert.equal((await app.call(app.path)).data.artifacts.document,undefined);
});

test('多表拒绝重复 ID，配置仍校验字段和主流程映射',()=>{
  const table={id:'main',name:'流程',fields:[{key:'name',label:'名称',type:'string',required:true}],rows:[{name:'入口'}],pacing:{label:'name'}};
  assert.throws(()=>validateConfiguration({tables:[table,table],primaryTableId:'main'}),/ID/);
  assert.throws(()=>validateConfiguration({tables:[table],primaryTableId:'missing'}),/主流程/);
  assert.throws(()=>validateConfiguration({tables:[{...table,fields:[{...table.fields[0],key:'__proto__'}]}],primaryTableId:'main'}),/字段/);
});


test('高级等待设置默认30分钟，支持不限时及大时长，拒绝非法设置并持久化', async t=>{
  const {call,store}=await setup(t);
  assert.deepEqual((await call('/api/generation-settings')).data,{idleTimeoutMinutes:30});
  for(const value of [0,45,100000]) {
    const saved=await call('/api/generation-settings','PUT',{idleTimeoutMinutes:value});
    assert.equal(saved.status,200);
    assert.equal((await store.read()).generationSettings?.idleTimeoutMinutes,value);
    assert.equal((await call('/api/generation-settings')).data.idleTimeoutMinutes,value);
  }
  for(const value of [-1,0.5,'30',null,Number.MAX_SAFE_INTEGER]) assert.equal((await call('/api/generation-settings','PUT',{idleTimeoutMinutes:value})).status,400);
  assert.equal((await store.read()).generationSettings?.idleTimeoutMinutes,100000);
});
