import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ActivityStage } from '@ai-activity-studio/shared';
import { createApiServer } from './server.js';
import { JsonPersistenceStore } from './store.js';
import { decryptSecret, encryptSecret } from './crypto.js';
import { executeGenerationJob } from './executor.js';

async function startServer(prefix: string, options: Parameters<typeof createApiServer>[0] = {}) {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  const file = join(dir, 'runtime.json');
  const store = new JsonPersistenceStore(file);
  const server = createApiServer({ ...options, store, encryptionSecret: 'test-secret' });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('listen failed');
  return {
    base: `http://127.0.0.1:${address.port}`,
    file,
    store,
    close: async () => {
      await new Promise<void>(resolve => server.close(() => resolve()));
      await rm(dir, { recursive: true, force: true });
    }
  };
}

async function jsonRequest(base: string, path: string, init?: RequestInit) {
  const response = await fetch(base + path, init);
  return { status: response.status, data: await response.json() as any };
}

const postJson = (base: string, path: string, value: unknown) => jsonRequest(base, path, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(value)
});

async function putArtifact(base: string, activityId: string, stage: ActivityStage, content: string = stage) {
  return jsonRequest(base, `/api/activities/${activityId}/artifacts/${stage}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind: 'markdown', fileName: `${stage}.md`, mimeType: 'text/markdown', content })
  });
}

async function seedPriorArtifacts(base: string, activityId: string, stage: ActivityStage) {
  const order: ActivityStage[] = ['source', 'document', 'demo', 'ue-demo', 'handoff'];
  for (const prior of order.slice(0, order.indexOf(stage))) { await putArtifact(base, activityId, prior); await confirmArtifact(base, activityId, prior); }
}

async function confirmArtifact(base:string,id:string,stage:ActivityStage) { const artifact=(await jsonRequest(base, '/api/activities/'+id+'/artifacts/'+stage)).data; const result=await postJson(base,'/api/activities/'+id+'/confirm/'+stage,{expectedUpdatedAt:artifact.updatedAt}); assert.equal(result.status,200,JSON.stringify(result.data)); }

test('本次选择绑定到任务，默认切换不串模型；对话修改、恢复可指定模型',async t=>{
  const used:string[]=[];
  const fetchImpl:typeof fetch=async(_url,init)=>{used.push(JSON.parse(String(init?.body)).model);return Response.json({choices:[{message:{content:'# 指定模型的策划'},finish_reason:'stop'}]});};
  const app=await startServer('selected-model-',{fetchImpl,schedule:()=>{}});t.after(app.close);
  const a=(await postJson(app.base,'/api/model-configs',{provider:'openai-compatible',model:'model-a',baseUrl:'https://gateway.test/v1',apiKey:'test-a',enabled:true,isDefault:true})).data;
  const b=(await postJson(app.base,'/api/model-configs',{provider:'openai-compatible',model:'model-b',displayName:'模型 B',baseUrl:'https://gateway.test/v1',apiKey:'test-b',enabled:true})).data;
  const activity=(await postJson(app.base,'/api/activities',{name:'多模型验证',type:'other',markdown:'# 原稿'})).data;
  await confirmArtifact(app.base,activity.id,'source');
  const submitted=await postJson(app.base,'/api/generation-jobs',{activityId:activity.id,stage:'document',modelId:b.id});
  assert.equal(submitted.status,201);assert.equal(submitted.data.modelId,b.id);assert.equal(submitted.data.modelName,'模型 B');
  await app.store.update(data=>{data.modelConfigs.forEach(model=>model.isDefault=model.id===a.id);});
  await executeGenerationJob(submitted.data.id,app.store,'test-secret',fetchImpl);
  assert.deepEqual(used,['model-b']);
  const refined=await postJson(app.base,`/api/activities/${activity.id}/artifacts/document/refine`,{instruction:'更明确',content:'# 策划',modelId:a.id});
  assert.equal(refined.status,200);assert.equal(used.at(-1),'model-a');
  const invalid=await postJson(app.base,'/api/generation-jobs',{activityId:activity.id,stage:'document',regenerate:true,modelId:'missing'});
  assert.equal(invalid.status,400);
  const queued=await postJson(app.base,'/api/generation-jobs',{activityId:activity.id,stage:'document',regenerate:true,modelId:b.id});
  await postJson(app.base,`/api/generation-jobs/${queued.data.id}/pause`,{});
  const resumed=await postJson(app.base,`/api/generation-jobs/${queued.data.id}/resume`,{modelId:a.id});
  assert.equal(resumed.data.modelId,a.id);
  await app.store.update(data=>{data.modelConfigs.find(model=>model.id===a.id)!.enabled=false;});
  await executeGenerationJob(queued.data.id,app.store,'test-secret',fetchImpl);
  const failed=(await app.store.read()).jobs.find(job=>job.id===queued.data.id)!;
  assert.equal(failed.state,'failed');assert.match(failed.error!,/停用或删除/);assert.equal(used.length,2);
});

function testZip(entryName = 'SKILL.md', content = '# Test Skill') {
  const name = Buffer.from(entryName);
  const data = Buffer.from(content);
  const local = Buffer.alloc(30 + name.length + data.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);
  name.copy(local, 30);
  data.copy(local, 30 + name.length);
  const central = Buffer.alloc(46 + name.length);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(name.length, 28);
  name.copy(central, 46);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(local.length, 16);
  return Buffer.concat([local, central, end]);
}

test('AES-GCM 可解密且篡改会失败', () => {
  const value = encryptSecret('sk-secret', 'test-key');
  assert.equal(decryptSecret(value, 'test-key'), 'sk-secret');
  assert.throws(() => decryptSecret(value.slice(0, -2) + 'aa', 'test-key'));
});

test('兼容旧 runtime 并自动补齐五阶段默认 Skill', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'activity-legacy-'));
  const file = join(dir, 'runtime.json');
  await writeFile(file, JSON.stringify({
    activities: [{ id: 'a', name: '旧活动', type: 'campaign', status: 'draft', owner: 'u', description: '', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' }],
    modelConfigs: [],
    jobs: [{ id: 'j', activityId: 'a', kind: 'outline', state: 'queued', attempts: 0, createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' }]
  }));
  const data = await new JsonPersistenceStore(file).read();
  assert.equal(data.activities[0]?.type, 'race');
  assert.deepEqual(data.activities[0]?.artifacts, {});
  assert.equal(data.jobs[0]?.stage, 'flow');
  assert.equal(data.jobs[0]?.auditTrail.length, 1);
  assert.deepEqual(data.skills.map(skill => skill.stage).sort(), ['demo', 'document', 'flow', 'handoff', 'source', 'ue', 'ue-demo']);
  await rm(dir, { recursive: true, force: true });
});

test('Skill 默认项可见，ZIP 校验、启停、下载与删除完整可用', async t => {
  const app = await startServer('activity-skill-', { schedule: () => undefined });
  t.after(app.close);
  const initial = await jsonRequest(app.base, '/api/skills');
  assert.equal(initial.data.length, 7);
  assert.equal(initial.data.every((skill: any) => skill.builtIn && !('archiveBase64' in skill)), true);
  assert.equal((await jsonRequest(app.base, `/api/skills/${initial.data[0].id}`, { method: 'DELETE' })).status, 409);
  const nonZip = new FormData();
  nonZip.append('file', new Blob(['text']), 'bad.txt');
  assert.equal((await jsonRequest(app.base, '/api/skills?stage=flow', { method: 'POST', body: nonZip })).status, 400);
  const missing = new FormData();
  missing.append('file', new Blob([testZip('README.md')]), 'missing.zip');
  const missingResult = await jsonRequest(app.base, '/api/skills?stage=flow', { method: 'POST', body: missing });
  assert.equal(missingResult.status, 400);
  assert.match(missingResult.data.error, /SKILL\.md/);
  const archive = testZip('folder/SKILL.md');
  const valid = new FormData();
  valid.append('file', new Blob([archive]), 'flow-helper.zip');
  const uploaded = await jsonRequest(app.base, '/api/skills?stage=flow', { method: 'POST', body: valid });
  assert.equal(uploaded.status, 201);
  assert.equal(uploaded.data.downloadable, true);
  assert.equal('archiveBase64' in uploaded.data, false);
  const disabled = await jsonRequest(app.base, `/api/skills/${uploaded.data.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled: false }) });
  assert.equal(disabled.data.enabled, false);
  const downloaded = await fetch(`${app.base}/api/skills/${uploaded.data.id}/download`);
  assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), archive);
  assert.equal((await jsonRequest(app.base, `/api/skills/${uploaded.data.id}`, { method: 'DELETE' })).status, 200);
  assert.equal((await jsonRequest(app.base, `/api/skills/${uploaded.data.id}/download`)).status, 404);
});

test('创建任务后自动执行 demo 模型并保存可预览产物', async t => {
  const app = await startServer('activity-auto-demo-');
  t.after(app.close);
  await postJson(app.base, '/api/model-configs', { provider: 'demo', model: 'demo-creative-v1', enabled: true });
  const created = await postJson(app.base, '/api/activities', { name: '自动执行活动', type: 'race', description: '验证 Demo' });
  await seedPriorArtifacts(app.base, created.data.id, 'demo');
  const queued = await postJson(app.base, '/api/generation-jobs', { activityId: created.data.id, kind: 'outline', stage: 'demo' });
  let job: any;
  for (let i = 0; i < 50; i++) {
    await new Promise(resolve => setTimeout(resolve, 10));
    job = (await jsonRequest(app.base, `/api/generation-jobs/${queued.data.id}`)).data;
    if (job.state === 'completed' || job.state === 'failed') break;
  }
  assert.equal(job.state, 'completed');
  assert.deepEqual(job.auditTrail.map((item: any) => item.type), ['created', 'attempt_started', 'artifact_saved', 'state_changed']);
  const artifact = (await jsonRequest(app.base, `/api/activities/${created.data.id}/artifacts/demo`)).data;
  assert.equal(artifact.mimeType, 'text/html');
  assert.match(artifact.content, /可预览示例产物/);
  assert.doesNotMatch(artifact.content, /思维链/);
});

test('OpenAI-compatible 网关成功保存产物，失败任务可重试', async t => {
  let fail = false;
  const fetchImpl: typeof fetch = async () => fail
    ? new Response('gateway down', { status: 503 })
    : Response.json({ choices: [{ message: { content: '# 网关策划产物\n\n仅含最终内容' } }] });
  const app = await startServer('activity-auto-gateway-', { fetchImpl });
  t.after(app.close);
  const configResult = await postJson(app.base, '/api/model-configs', { provider: 'openai-compatible', model: 'gateway-model', baseUrl: 'https://gateway.test/v1', apiKey: 'sk-test', enabled: true });
  assert.equal(configResult.data.provider, 'openai-compatible');
  const created = await postJson(app.base, '/api/activities', { name: '网关活动', type: 'task-chain', description: '测试' });
  await seedPriorArtifacts(app.base, created.data.id, 'document');
  const wait = async (id: string) => {
    let job: any;
    for (let i = 0; i < 2000; i++) {
      await new Promise(resolve => setTimeout(resolve, 10));
      job = (await jsonRequest(app.base, `/api/generation-jobs/${id}`)).data;
      if (['completed', 'failed'].includes(job.state)) break;
    }
    return job;
  };
  const success = await postJson(app.base, '/api/generation-jobs', { activityId: created.data.id, kind: 'copy', stage: 'document' });
  const successJob = await wait(success.data.id);
  assert.equal(successJob.state, 'completed');
  assert.match(successJob.result.summary, /gateway-model/);
  assert.match((await jsonRequest(app.base, `/api/activities/${created.data.id}/artifacts/document`)).data.content, /网关策划产物/);
  await confirmArtifact(app.base,created.data.id,'document');
  fail = true;
  const failed = await postJson(app.base, '/api/generation-jobs', { activityId: created.data.id, kind: 'outline', stage: 'demo' });
  const failedJob = await wait(failed.data.id);
  assert.equal(failedJob.state, 'failed');
  assert.match(failedJob.error, /503/);
  const retry = await postJson(app.base, '/api/generation-jobs', { activityId: created.data.id, kind: 'outline', stage: 'demo' });
  assert.equal(retry.status, 201);
  assert.equal((await wait(retry.data.id)).state, 'failed');
});


test('模型中心支持自定义 Provider 编辑启停与注入式连通测试且不泄露密钥', async t => {
  let authorization = '';
  const fetchImpl: typeof fetch = async (_input, init) => {
    authorization = String((init?.headers as Record<string, string>)?.authorization ?? '');
    return Response.json({ choices: [{ message: { content: 'OK' } }] });
  };
  const app = await startServer('activity-model-center-', { fetchImpl });
  t.after(app.close);
  const created = await postJson(app.base, '/api/model-configs', { provider: 'custom-provider', model: 'model-a', baseUrl: 'https://gateway.test/v1/', apiKey: 'test-key-value', enabled: true });
  assert.equal(created.status, 201);
  assert.equal(created.data.provider, 'custom-provider');
  assert.equal(created.data.baseUrl, 'https://gateway.test/v1');
  assert.equal(JSON.stringify(created.data).includes('test-key-value'), false);
  const tested = await postJson(app.base, `/api/model-configs/${created.data.id}/test`, {});
  assert.equal(tested.status, 200);
  assert.equal(tested.data.ok, true);
  assert.equal(authorization, 'Bearer test-key-value');
  const updated = await jsonRequest(app.base, `/api/model-configs/${created.data.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider: 'another-provider', model: 'model-b', enabled: false }) });
  assert.equal(updated.data.provider, 'another-provider');
  assert.equal(updated.data.model, 'model-b');
  assert.equal(updated.data.enabled, false);
  assert.equal(updated.data.apiKeyConfigured, true);
  assert.equal(JSON.stringify(await app.store.read()).includes('test-key-value'), false);
});

test('排队任务可暂停并在恢复后完成，审计轨迹完整', async t => {
  const scheduled: Array<() => void> = [];
  const app = await startServer('activity-pause-queued-', { schedule: task => scheduled.push(task) });
  t.after(app.close);
  await postJson(app.base, '/api/model-configs', { provider: 'demo', model: 'demo-creative-v1', enabled: true });
  const created = await postJson(app.base, '/api/activities', { name: '排队暂停', type: 'race', markdown: '# 原稿' });
  await confirmArtifact(app.base,created.data.id,'source');
  const queued = await postJson(app.base, '/api/generation-jobs', { activityId: created.data.id, stage: 'document', kind: 'outline' });
  const paused = await postJson(app.base, `/api/generation-jobs/${queued.data.id}/pause`, {});
  assert.equal(paused.data.state, 'paused');
  scheduled.shift()?.();
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal((await jsonRequest(app.base, `/api/generation-jobs/${queued.data.id}`)).data.state, 'paused');
  const resumed = await postJson(app.base, `/api/generation-jobs/${queued.data.id}/resume`, {});
  assert.equal(resumed.data.state, 'queued');
  scheduled.shift()?.();
  let completed: any;
  for (let i = 0; i < 50; i++) {
    await new Promise(resolve => setTimeout(resolve, 10));
    completed = (await jsonRequest(app.base, `/api/generation-jobs/${queued.data.id}`)).data;
    if (completed.state === 'completed' || completed.state === 'failed') break;
  }
  assert.equal(completed.state, 'completed');
  assert.equal(completed.attempts, 1);
  assert.deepEqual(completed.auditTrail.map((item: any) => item.type), ['created', 'paused', 'resumed', 'attempt_started', 'artifact_saved', 'state_changed']);
});

test('运行任务暂停会中断 fetch，迟到响应不写入，恢复后重新尝试', async t => {
  let calls = 0;
  let aborted = false;
  let releaseFirst!: () => void;
  const fetchImpl: typeof fetch = async (_input, init) => {
    calls += 1;
    if (calls === 1) {
      await new Promise<void>(resolve => {
        releaseFirst = resolve;
        init?.signal?.addEventListener('abort', () => { aborted = true; resolve(); }, { once: true });
      });
      return Response.json({ choices: [{ message: { content: '迟到内容' } }] });
    }
    return Response.json({ choices: [{ message: { content: '恢复后的正式内容' } }] });
  };
  const app = await startServer('activity-pause-running-', { fetchImpl });
  t.after(app.close);
  await postJson(app.base, '/api/model-configs', { provider: 'openai-compatible', model: 'gateway', baseUrl: 'https://gateway.test/v1', apiKey: 'sk', enabled: true });
  const created = await postJson(app.base, '/api/activities', { name: '运行暂停', type: 'race', markdown: '# 原稿' });
  await confirmArtifact(app.base,created.data.id,'source');
  const queued = await postJson(app.base, '/api/generation-jobs', { activityId: created.data.id, stage: 'document', kind: 'outline' });
  for (let i = 0; i < 50 && calls === 0; i++) await new Promise(resolve => setTimeout(resolve, 5));
  const paused = await postJson(app.base, `/api/generation-jobs/${queued.data.id}/pause`, {});
  assert.equal(paused.data.state, 'paused');
  assert.equal(aborted, true);
  releaseFirst();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal((await jsonRequest(app.base, `/api/activities/${created.data.id}/artifacts/document`)).status, 404);
  await postJson(app.base, `/api/generation-jobs/${queued.data.id}/resume`, {});
  let completed = (await jsonRequest(app.base, `/api/generation-jobs/${queued.data.id}`)).data;
  for (let i = 0; i < 100 && ['queued', 'running'].includes(completed.state); i++) { await new Promise(resolve => setTimeout(resolve, 10)); completed = (await jsonRequest(app.base, `/api/generation-jobs/${queued.data.id}`)).data; }
  assert.equal(completed.state, 'completed');
  assert.equal(completed.attempts, 2);
  assert.deepEqual(completed.auditTrail.filter((item: any) => ['paused', 'resumed'].includes(item.type)).map((item: any) => item.type), ['paused', 'resumed']);
  const artifact = (await jsonRequest(app.base, `/api/activities/${created.data.id}/artifacts/document`)).data;
  assert.equal(artifact.content, '恢复后的正式内容');
  assert.doesNotMatch(artifact.content, /迟到内容/);
});

test('删除活动会中断关联运行请求并阻止迟到产物写入', async t => {
  let requestStarted = false;
  let aborted = false;
  const fetchImpl: typeof fetch = async (_input, init) => {
    requestStarted = true;
    await new Promise<void>(resolve => {
      init?.signal?.addEventListener('abort', () => {
        aborted = true;
        resolve();
      }, { once: true });
    });
    return Response.json({ choices: [{ message: { content: '删除后的迟到内容' } }] });
  };
  const app = await startServer('activity-delete-running-', { fetchImpl });
  t.after(app.close);
  await postJson(app.base, '/api/model-configs', { provider: 'openai-compatible', model: 'gateway', baseUrl: 'https://gateway.test/v1', apiKey: 'sk', enabled: true });
  const created = await postJson(app.base, '/api/activities', { name: '运行中删除', type: 'race', markdown: '# 原稿' });
  await confirmArtifact(app.base,created.data.id,'source');
  const job = await postJson(app.base, '/api/generation-jobs', { activityId: created.data.id, stage: 'document', kind: 'outline' });
  for (let i = 0; i < 50 && !requestStarted; i++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(requestStarted, true);
  const removed = await jsonRequest(app.base, `/api/activities/${created.data.id}`, { method: 'DELETE' });
  assert.equal(removed.status, 200);
  assert.equal(aborted, true);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal((await jsonRequest(app.base, `/api/activities/${created.data.id}`)).status, 404);
  assert.equal((await jsonRequest(app.base, `/api/generation-jobs/${job.data.id}`)).status, 404);
  assert.equal((await jsonRequest(app.base, `/api/activities/${created.data.id}/artifacts/document`)).status, 404);
});

test('活动编辑校验与删除会级联清理任务和阶段数据', async t => {
  const app = await startServer('activity-crud-', { schedule: () => undefined });
  t.after(app.close);
  const created = await postJson(app.base, '/api/activities', { name: '待编辑活动', type: 'race', markdown: '# 原稿' });
  const updated = await jsonRequest(app.base, `/api/activities/${created.data.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: '已编辑活动', type: 'gift-pack' }) });
  assert.equal(updated.data.name, '已编辑活动');
  assert.equal((await jsonRequest(app.base, `/api/activities/${created.data.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: '' }) })).status, 400);
  await confirmArtifact(app.base,created.data.id,'source');
  const job = await postJson(app.base, '/api/generation-jobs', { activityId: created.data.id, stage: 'document', kind: 'outline' });
  assert.equal(job.status, 201);
  const removed = await jsonRequest(app.base, `/api/activities/${created.data.id}`, { method: 'DELETE' });
  assert.equal(removed.data.clearedJobs, 1);
  assert.equal((await jsonRequest(app.base, `/api/activities/${created.data.id}`)).status, 404);
  assert.equal((await jsonRequest(app.base, `/api/generation-jobs/${job.data.id}`)).status, 404);
});

test('五阶段产物支持 AI 修改并直接持久化', async t => {
  const app = await startServer('activity-refine-');
  t.after(app.close);
  await postJson(app.base, '/api/model-configs', { provider: 'demo', model: 'demo-creative-v1', enabled: true });
  const created = await postJson(app.base, '/api/activities', { name: '修改测试', type: 'race', markdown: '# 原稿' });
  const refined = await postJson(app.base, `/api/activities/${created.data.id}/artifacts/source/refine`, { instruction: '补充验收标准', content: '# 原稿' });
  assert.equal(refined.status, 200);
  assert.match(refined.data.content, /补充验收标准/);
  const activity = await jsonRequest(app.base, `/api/activities/${created.data.id}`);
  assert.equal(activity.data.markdown, refined.data.content);
  assert.equal(activity.data.artifacts.source.content, refined.data.content);
});

test('网关支持基础地址、完整地址、默认模型、上下文和错误脱敏', async t => {
  let requestUrl = '', prompt = '', failing = false;
  const fetchImpl: typeof fetch = async (input, init) => { requestUrl = String(input); prompt = String(init?.body); return failing ? new Response('Bearer private-test-key', { status: 401 }) : Response.json({ choices: [{ message: { content: '# 生成结果' } }] }); };
  const app = await startServer('gateway-v2-', { fetchImpl }); t.after(app.close);
  await postJson(app.base, '/api/model-configs', { provider: 'demo', model: 'demo', enabled: true });
  const config = (await postJson(app.base, '/api/model-configs', { provider: 'custom', model: 'company-model', displayName: '公司模型', baseUrl: 'https://example.test/custom/chat?version=1', fullUrl: true, isDefault: true, apiKey: 'private-test-key', enabled: true })).data;
  assert.equal(config.displayName, '公司模型');
  assert.equal((await postJson(app.base, `/api/model-configs/${config.id}/test`, {})).status, 200);
  assert.equal(requestUrl, 'https://example.test/custom/chat?version=1');
  const activity = (await postJson(app.base, '/api/activities', { name: '上下文回归', type: 'race', markdown: '# 原稿' })).data;
  await seedPriorArtifacts(app.base, activity.id, 'document');
  await putArtifact(app.base, activity.id, 'source', '特殊流程约束123'); await confirmArtifact(app.base,activity.id,'source');
  const job = (await postJson(app.base, '/api/generation-jobs', { activityId: activity.id, stage: 'document' })).data;
  for (let i = 0; i < 60 && (await jsonRequest(app.base, `/api/generation-jobs/${job.id}`)).data.state !== 'completed'; i++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.ok(prompt.includes('特殊流程约束123'));
  assert.ok(prompt.includes('company-model'));
  assert.equal((await postJson(app.base, '/api/generation-jobs', { activityId: activity.id, stage: 'document' })).status, 409);
  const regeneration = await postJson(app.base, '/api/generation-jobs', { activityId: activity.id, stage: 'document', regenerate: true });
  assert.equal(regeneration.status, 201);
  for (let i = 0; i < 100 && (await jsonRequest(app.base, `/api/generation-jobs/${regeneration.data.id}`)).data.state !== 'completed'; i++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal((await jsonRequest(app.base, `/api/generation-jobs/${regeneration.data.id}`)).data.state, 'completed');
  await jsonRequest(app.base, `/api/model-configs/${config.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ baseUrl: 'https://example.test/v1/chat/completions', fullUrl: false }) });
  await postJson(app.base, `/api/model-configs/${config.id}/test`, {});
  assert.equal(requestUrl, 'https://example.test/v1/chat/completions');
  failing = true;
  const result = await postJson(app.base, `/api/model-configs/${config.id}/test`, {});
  assert.equal(result.status, 400); assert.ok(!JSON.stringify(result).includes('private-test-key'));
});

test('配置文档提取、校验、版本冲突、CSV/JSON 上传、Demo 快照和事件闭环', async t => {
  const app = await startServer('configuration-v2-'); t.after(app.close);
  await postJson(app.base, '/api/model-configs', { provider: 'demo', model: 'demo', enabled: true });
  const activity = (await postJson(app.base, '/api/activities', { name: '配置测试', type: 'task-chain', markdown: '# 测试' })).data;
  const path = `/api/activities/${activity.id}/configuration`;
  assert.equal((await postJson(app.base, path + '/generate', {})).status, 409);
  await confirmArtifact(app.base,activity.id,'source');
  await putArtifact(app.base, activity.id, 'document', '# 配置\n| name | durationSeconds | actions | cost | reward |\n| --- | --- | --- | --- | --- |\n| 入口 | 5 | 1 | 0 | 10 |\n| 挑战 | 30 | 2 | 5 | 20 |');
  const draft = (await postJson(app.base, path + '/generate', {})).data;
  assert.equal(draft.rows.length, 2); assert.equal(draft.rows[1].durationSeconds, 30); assert.equal(draft.pacing.duration, 'durationSeconds');
  const save = (configuration: unknown, expectedRevision: number) => jsonRequest(app.base, path, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ configuration, expectedRevision }) });
  assert.equal((await save({ ...draft, tables:undefined, rows: [{ ...draft.rows[0], durationSeconds: -1 }] }, 0)).status, 400);
  const v1 = (await save(draft, 0)).data;
  assert.equal(v1.revision, 1);
  assert.equal((await save(draft, 0)).status, 409);
  await confirmArtifact(app.base,activity.id,'document');
  assert.equal((await postJson(app.base,path+'/sync',{expectedRevision:1,createDemo:true})).status,409);
  const generated=await postJson(app.base,'/api/generation-jobs',{activityId:activity.id,stage:'demo'});
  for(let i=0;i<100;i++){const job=(await jsonRequest(app.base,'/api/generation-jobs/'+generated.data.id)).data;if(job.state==='completed')break;await new Promise(r=>setTimeout(r,10));}
  const synced = (await jsonRequest(app.base, `/api/activities/${activity.id}`)).data;
  assert.equal(synced.demoConfiguration.revision, 1);
  assert.ok(synced.artifacts.demo.content.includes('window.ActivityStudio'));
  const download = await fetch(app.base + `/api/activities/${activity.id}/artifacts/demo?download=1`);
  assert.ok((await download.text()).includes('data-activity-studio-runtime'));
  const csv = await (await fetch(app.base + path + '?format=csv')).text();
  const form = new FormData(); form.append('file', new Blob([csv]), 'config.csv');
  const imported = await jsonRequest(app.base, path + '/import', { method: 'POST', body: form });
  assert.equal(imported.status, 200); assert.deepEqual(imported.data.rows, draft.rows);
  const badCsv = new FormData(); badCsv.append('file', new Blob(['name,actions\n"unterminated,1']), 'bad.csv');
  assert.equal((await jsonRequest(app.base, path + '/import', { method: 'POST', body: badCsv })).status, 400);
  const jsonForm = new FormData(); jsonForm.append('file', new Blob([JSON.stringify(v1)]), 'config.json');
  assert.equal((await jsonRequest(app.base, path + '/import', { method: 'POST', body: jsonForm })).status, 200);
  const eventPath = `/api/activities/${activity.id}/play-events`;
  let seq = 0;
  const emit = (type: string, stepIndex?: number, revision = 1) => postJson(app.base, eventPath, { id: `event-${++seq}`, sessionId: 'session-1', revision, type, stepIndex, elapsedMs: seq * 100 });
  assert.equal((await emit('step_enter', 0)).status, 400);
  assert.equal((await emit('session_start')).status, 201);
  assert.equal((await emit('step_enter', 0)).status, 201);
  assert.equal((await emit('step_complete', 0)).status, 201);
  assert.equal((await emit('session_complete')).status, 400);
  assert.equal((await emit('step_enter', 1)).status, 201);
  assert.equal((await emit('step_complete', 1)).status, 201);
  assert.equal((await emit('session_complete')).status, 201);
  const changed = structuredClone(draft); changed.tables[0].rows[1].actions = 3;
  assert.equal((await save(changed, 1)).data.revision, 2);
  const beforeSync = (await jsonRequest(app.base, `/api/activities/${activity.id}`)).data;
  assert.equal(beforeSync.demoConfiguration.rows[1].actions, 2);
  await confirmArtifact(app.base,activity.id,'document');
  assert.equal((await postJson(app.base, path + '/sync', { expectedRevision: 2 })).status, 200);
  assert.equal((await emit('session_start', undefined, 1)).status, 400);
  const final = (await jsonRequest(app.base, `/api/activities/${activity.id}`)).data;
  assert.equal(final.demoConfiguration.rows[1].actions, 3);
  assert.equal(final.playEvents.filter((e: any) => e.type === 'session_complete').length, 1);
});

test('配置拒绝恶意字段与无效映射，CSV 支持逗号换行，旧 Demo 不被静默覆盖', async t => {
  const app = await startServer('configuration-guard-'); t.after(app.close);
  const activity = (await postJson(app.base, '/api/activities', { name: '边界测试', type: 'race' })).data;
  const base = `/api/activities/${activity.id}`;
  await putArtifact(app.base,activity.id,'source'); await confirmArtifact(app.base,activity.id,'source');
  const fields = [{ key: 'name', label: '名称', type: 'string', required: true }, { key: 'duration', label: '时长', type: 'number', required: true }];
  const config = { fields, rows: [{ name: '入口,说明\n换行', duration: 10 }], pacing: { label: 'name', duration: 'duration' } };
  const put = (configuration: unknown) => jsonRequest(app.base, base + '/configuration', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ configuration, expectedRevision: 0 }) });
  assert.equal((await put({ ...config, fields: [...fields, { ...fields[0], key: '__proto__' }] })).status, 400);
  assert.equal((await put({ ...config, pacing: { duration: 'name' } })).status, 400);
  assert.equal((await put(config)).status, 200);
  const csv = await (await fetch(app.base + base + '/configuration?format=csv')).text();
  const form = new FormData(); form.append('file', new Blob([csv]), 'config.csv');
  assert.equal((await jsonRequest(app.base, base + '/configuration/import', { method: 'POST', body: form })).data.rows[0].name, config.rows[0]!.name);
  await putArtifact(app.base,activity.id,'document'); await confirmArtifact(app.base,activity.id,'document');
  await putArtifact(app.base, activity.id, 'demo', '<html><body>保留原来的 Demo</body></html>');
  assert.equal((await postJson(app.base, base + '/configuration/sync', { expectedRevision: 1, createDemo: true })).status, 409);
  assert.equal((await jsonRequest(app.base, base)).data.artifacts.demo.content, '<html><body>保留原来的 Demo</body></html>');
});

