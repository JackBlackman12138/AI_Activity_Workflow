import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { gatewayFetch, requestChat, type GatewayProgress } from './gateway.js';
import { encryptSecret } from './crypto.js';
import { promptFor, executeGenerationJob, artifactFor } from './executor.js';
import { JsonPersistenceStore } from './store.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { StoredModelConfig } from './store.js';
import type { Activity } from '@ai-activity-studio/shared';

const model: StoredModelConfig = { id: 'test', provider: 'openai-compatible', model: 'test', baseUrl: 'https://gateway.test/v1', enabled: true, updatedAt: '', encryptedApiKey: encryptSecret('private-key', 'test') };
const messages = [{ role: 'user', content: '生成 Demo' }];
const frame = (content: string, finish_reason: string | null = null) => 'data: ' + JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason }] }) + '\r\n\r\n';
function response(text: string, width = 7) {
  const bytes = new TextEncoder().encode(text);
  return new Response(new ReadableStream({ start(controller) { for (let i = 0; i < bytes.length; i += width) controller.enqueue(bytes.slice(i, i + width)); controller.close(); } }), { headers: { 'content-type': 'text/event-stream' } });
}

test('流式解析支持拆包、中文、CRLF、心跳及 DONE，不读取推理字段', async () => {
  const progress: GatewayProgress[] = [];
  const reasoning = 'data: {"choices":[{"index":0,"delta":{"reasoning_content":"private reasoning"}}]}\n\n';
  const fetchImpl: typeof fetch = async (_url, init) => { assert.equal(JSON.parse(String(init?.body)).stream, true); return response(': ping\r\n\r\n' + reasoning + frame('<html>你好') + frame('</html>') + frame('', 'stop') + 'data: [DONE]\r\n\r\n'); };
  const content = await requestChat(model, messages, 'test', fetchImpl, undefined, { stream: true, onProgress: async value => { progress.push(value); } });
  assert.equal(content, '<html>你好</html>');
  assert.ok(progress.some(value => value.phase === 'waiting'));
  assert.equal(progress.at(-1)?.characters, content.length);
  assert.ok(progress.some(value => value.firstContentMs !== undefined));
  assert.doesNotMatch(JSON.stringify(progress), /private reasoning/);
});

test('流式提前结束或输出上限不会返回半成品', async () => {
  await assert.rejects(requestChat(model, messages, 'test', async () => response(frame('partial')), undefined, { stream: true }), /提前断开/);
  await assert.rejects(requestChat(model, messages, 'test', async () => response(frame('partial', 'length')), undefined, { stream: true }), /长度上限/);
  await assert.rejects(requestChat(model, messages, 'test', async () => response('data: {"error":{"message":"private-key"}}\n\n'), undefined, { stream: true }), error => /生成过程中返回错误/.test(String(error)) && !String(error).includes('private-key'));
});

test('兼容网关忽略 stream 返回 JSON，HTTP 错误脱敏', async () => {
  assert.equal(await requestChat(model, messages, 'test', async () => Response.json({ choices: [{ message: { content: 'OK' }, finish_reason: 'stop' }] }), undefined, { stream: true }), 'OK');
  await assert.rejects(requestChat(model, messages, 'test', async () => new Response('private-key', { status: 504 })), error => /HTTP 504.*网关自身等待超时/.test(String(error)) && !String(error).includes('private-key'));
  await assert.rejects(requestChat(model, messages, 'test', async () => { throw new TypeError('private-key', { cause: { code: 'ECONNRESET' } }); }), /连接被中途断开/);
});

test('等待响应及流读取超时都停止；主动暂停保留 AbortError', async () => {
  const waiting: typeof fetch = async (_url, init) => new Promise((_resolve, reject) => { init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true }); });
  await assert.rejects(requestChat(model, messages, 'test', waiting, undefined, { stream: true, idleTimeoutMs: 40 }), /未收到网关数据/);
  const stalled: typeof fetch = async (_url, init) => new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(frame('partial'))); init?.signal?.addEventListener('abort', () => controller.error(new Error('aborted')), { once: true }); } }), { headers: { 'content-type': 'text/event-stream' } });
  await assert.rejects(requestChat(model, messages, 'test', stalled, undefined, { stream: true, idleTimeoutMs: 40 }), /未收到网关数据/);
  const controller = new AbortController(); const task = requestChat(model, messages, 'test', stalled, controller.signal, { stream: true });
  setTimeout(() => controller.abort(), 20);
  await assert.rejects(task, { name: 'AbortError' });
});

test('Demo 输入以确认策划为准，避免把相同正文重复发送三遍', () => {
  const content = '# 唯一策划正文';
  const activity = { name: '测试', type: 'other', description: '', markdown: content, artifacts: { source: { stage: 'source', encoding: 'utf8', content }, document: { stage: 'document', encoding: 'utf8', content } } } as Activity;
  assert.equal(promptFor(activity, 'demo').split(content).length - 1, 1);
  assert.match(promptFor(activity, 'demo'), /策划文档/);
});

test('执行器保存真实流式进度，仅在完整结束后发布可预览产物', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'stream-progress-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new JsonPersistenceStore(join(dir, 'runtime.json'));
  const activity = { id: 'activity', name: '进度验证', type: 'other', productId: 'mc', status: 'draft', owner: 'test', description: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), approvals: {}, artifacts: {} } as Activity;
  for (const stage of ['source', 'document'] as const) { const artifact = artifactFor(stage, '# 策划', activity); activity.artifacts![stage] = artifact; activity.approvals![stage] = artifact.updatedAt; }
  delete activity.artifacts!.document; delete activity.approvals!.document;
  await store.update(data => { data.generationSettings={idleTimeoutMinutes:0}; data.activities.push(activity); data.modelConfigs = [model]; data.skills = []; data.jobs.push({ id: 'job', activityId: activity.id, kind: 'outline', stage: 'document', state: 'queued', attempts: 0, createdAt: activity.createdAt, updatedAt: activity.updatedAt, auditTrail: [] }); });
  let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
  const fetchImpl: typeof fetch = async () => new Response(new ReadableStream({ start(controller) { streamController = controller; controller.enqueue(new TextEncoder().encode(frame('<html><body>按钮'))); } }), { headers: { 'content-type': 'text/event-stream' } });
  const execution = executeGenerationJob('job', store, 'test', fetchImpl);
  // Concurrent browser checks and Windows file replacement can delay persisted progress.
  const progressDeadline=Date.now()+10_000;
  while ((await store.read()).jobs[0]?.progress?.phase !== 'receiving' && Date.now()<progressDeadline) await new Promise(resolve => setTimeout(resolve, 10));
  const during = await store.read(); assert.equal(during.jobs[0]?.progress?.idleTimeoutMinutes,0); await store.update(data=>{data.generationSettings={idleTimeoutMinutes:45};}); assert.equal(during.jobs[0]?.progress?.phase, 'receiving'); assert.ok(during.jobs[0]!.progress!.characters > 0); assert.equal(during.activities[0]?.artifacts?.document, undefined);
  streamController!.enqueue(new TextEncoder().encode(frame('</body></html>', 'stop') + 'data: [DONE]\n\n')); streamController!.close();
  await execution;
  const after = await store.read(); assert.equal(after.jobs[0]?.progress?.idleTimeoutMinutes,0); assert.equal(after.jobs[0]?.state, 'completed'); assert.equal(after.jobs[0]?.progress?.phase, 'completed'); assert.equal(after.activities[0]?.artifacts?.document?.content, '<html><body>按钮</body></html>');
});


test('持续流式输出或普通 JSON 分块可超过无响应时限，数据到达后重新计时', async () => {
  for (const stream of [true,false]) {
    const parts = stream ? [frame('A'),frame('B'),frame('C'),frame('', 'stop')] : ['{"choices":[','{"message":{"content":"ABC"},','"finish_reason":"stop"}',']}'];
    const started = Date.now();
    const fetchImpl: typeof fetch = async (_url, init) => new Response(new ReadableStream({
      async start(controller) {
        for (const part of parts) {
          await new Promise(resolve=>setTimeout(resolve,60));
          if (init?.signal?.aborted) { controller.error(init.signal.reason);return; }
          controller.enqueue(new TextEncoder().encode(part));
        }
        controller.close();
      }
    }), {headers:{'content-type':stream?'text/event-stream':'application/json'}});
    assert.equal(await requestChat(model,messages,'test',fetchImpl,undefined,{stream:true,idleTimeoutMs:200}), 'ABC');
    assert.ok(Date.now()-started>200);
  }
});

test('不限时不会立即超时，超大时长不溢出，手动暂停仍能中止', async () => {
  for (const idleTimeoutMs of [0, 2_147_483_648]) {
    const fetchImpl: typeof fetch = async ()=>{await new Promise(resolve=>setTimeout(resolve,30));return response(frame('OK','stop'));};
    assert.equal(await requestChat(model,messages,'test',fetchImpl,undefined,{stream:true,idleTimeoutMs}),'OK');
  }
  const controller = new AbortController();
  const waiting: typeof fetch = async (_url, init)=>new Promise((_resolve,reject)=>init?.signal?.addEventListener('abort',()=>reject(init.signal?.reason),{once:true}));
  const task=requestChat(model,messages,'test',waiting,controller.signal,{stream:true,idleTimeoutMs:0});
  setTimeout(()=>controller.abort(),20);
  await assert.rejects(task,{name:'AbortError'});
});


test('生产 HTTP 传输支持持续响应与主动暂停',async t=>{
  const server=createServer((req,res)=>{
    req.resume();
    res.writeHead(200,{'content-type':'text/event-stream'});res.write(frame('A'));
    const timer=setTimeout(()=>res.end(frame('B','stop')),80);
    res.on('close',()=>clearTimeout(timer));
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));});
  const address=server.address();if(!address||typeof address==='string')throw Error('listen');
  const local={...model,baseUrl:`http://127.0.0.1:${address.port}`};
  assert.equal(await requestChat(local,messages,'test',gatewayFetch,undefined,{stream:true,idleTimeoutMs:0}),'AB');
  const controller=new AbortController();
  await assert.rejects(requestChat(local,messages,'test',gatewayFetch,controller.signal,{stream:true,idleTimeoutMs:0,onProgress:async progress=>{if(progress.characters)controller.abort();}}),{name:'AbortError'});
});
