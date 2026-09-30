import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { PIPELINE, type ProductProfile, type StageSkill, type DemoPlan } from '@ai-activity-studio/shared';
import type { PersistenceStore } from './store.js';
import { confirmStage, assertStage, invalidate } from './workflow.js';
import { handoffZip } from './handoff.js';
import { digest, configDigest, normalizeDemoHtml } from './demo-pipeline.js';
import { buildDemoProject } from './demo-project.js';
import { validateConfiguration } from './configuration.js';

type Context = { req: IncomingMessage; res: ServerResponse; path: string; store: PersistenceStore; body: (req: IncomingMessage, limit?: number) => Promise<Buffer>; json: (res: ServerResponse, status: number, value: unknown) => void };
export async function pipelineRoutes({ req, res, path, store, body, json }: Context): Promise<boolean> {
  const reply = (status: number, value: unknown) => { json(res, status, value); return true; };
  if (path === '/api/products') {
    if (req.method === 'GET') return reply(200, (await store.read()).products);
    if (req.method === 'PUT') {
      const products = JSON.parse((await body(req, 100_000)).toString()) as ProductProfile[];
      const ids = new Set<string>();
      if (!Array.isArray(products) || !products.length || products.length > 30) throw new Error('产品需要 1–30 项');
      for (const product of products) {
        if (!/^[a-zA-Z][\w-]{0,63}$/.test(product.id) || ids.has(product.id) || !product.name?.trim()) throw new Error('产品 ID 唯一且以字母开头，名称必填');
        ids.add(product.id); const types = new Set<string>();
        if (!Array.isArray(product.activityTypes) || !product.activityTypes.length || product.activityTypes.length > 50) throw new Error('每个产品需要 1–50 种活动类型');
        for (const type of product.activityTypes) { if (!/^[a-zA-Z][\w-]{0,63}$/.test(type.id) || types.has(type.id) || !type.name?.trim()) throw new Error('活动类型 ID 唯一且以字母开头，名称必填'); types.add(type.id); }
      }
      await store.update(data => { if (data.activities.some(a => !products.some(p => p.id === a.productId && p.activityTypes.some(t => t.id === a.type)))) throw new Error('不能删除已有活动使用的产品或类型'); data.products = products; });
      return reply(200, products);
    }
  }
  if (path === '/api/template-skills' && req.method === 'POST') {
    const input = JSON.parse((await body(req, 500_000)).toString());
    if (!input.name?.trim() || typeof input.content !== 'string' || !input.content.trim() || input.content.length > 100_000 || !PIPELINE.some(s => s.id === input.stage)) throw new Error('Skill 名称、适用阶段和正文必填（最多 10 万字）');
    const now = new Date().toISOString();
    const skill: StageSkill = { id: randomUUID(), stage: input.stage, name: input.name.trim().slice(0,100), description: '产品与活动类型的生成指导', content: input.content, productId: input.productId || undefined, activityType: input.activityType || undefined, enabled: true, builtIn: false, createdAt: now, updatedAt: now };
    await store.update(data => { if (skill.productId && !data.products.some(p => p.id === skill.productId && (!skill.activityType || p.activityTypes.some(t => t.id === skill.activityType)))) throw new Error('产品或类型不存在'); data.skills.push(skill); });
    return reply(201, { ...skill, appliedToGeneration: true, downloadable: false });
  }
  const confirm = path.match(/^\/api\/activities\/([^/]+)\/confirm\/([^/]+)$/);
  if (confirm && req.method === 'POST') {
    const input = JSON.parse((await body(req)).toString());
    const activity = await store.update(data => {
      const item = data.activities.find(a => a.id === confirm[1]); if (!item) throw new Error('活动不存在');
      if (data.jobs.some(j => j.activityId === item.id && ['queued','running'].includes(j.state))) throw new Error('请等待生成任务完成后确认');
      confirmStage(item, confirm[2] as import('@ai-activity-studio/shared').ActivityStage, input.expectedUpdatedAt); return { approvals: item.approvals };
    });
    return reply(200, activity);
  }
  const candidate=path.match(/^\/api\/generation-jobs\/([^/]+)\/candidate\.zip$/);
  if(candidate&&req.method==='GET'){
    const data=await store.read(),job=data.jobs.find(job=>job.id===candidate[1]);
    const saved=data.activities.find(activity=>activity.id===job?.activityId);
    if(!job||!saved||!job.demoDraft?.project||!job.demoDraft.planText||!['demo','ue-demo'].includes(job.stage))return reply(404,{error:'尚无可导出的候选工程'});
    const activity=structuredClone(saved),stage=job.stage as 'demo'|'ue-demo',draft=job.demoDraft;
    const plan=JSON.parse(draft.planText!) as DemoPlan,content=normalizeDemoHtml(await buildDemoProject(draft.project!));
    validateConfiguration(plan.configuration);
    const issues=[job.error||'此包来自生成过程中的候选工程，尚未完成本版本验收；请查看任务中的当前检查与修复记录。'];
    if(plan.configuration.sourceDocumentUpdatedAt!==activity.artifacts?.document?.updatedAt)issues.push('当前策划文档与候选工程来源版本不同，请以 requirements.json 中的来源版本和需求逐项核对。');
    try{const review=JSON.parse(draft.reviewText??'{}');if(Array.isArray(review.issues))issues.push(...review.issues.map((value:unknown)=>typeof value==='string'?value:JSON.stringify(value)));}catch{/* Raw responses are not a verified report. */}
    activity.configuration=plan.configuration;activity.demoConfiguration=plan.configuration;activity.demoConfigRevision=plan.configuration.revision;
    activity.artifacts={...activity.artifacts,[stage]:{stage,kind:'html',fileName:'candidate.html',mimeType:'text/html',content,encoding:'utf8',updatedAt:job.updatedAt,demoProject:draft.project,demoDelivery:{plan,contentHash:digest(content),configHash:configDigest(plan.configuration),checkedAt:job.updatedAt,repairs:0,validation:draft.content===content?draft.validation:undefined,review:{status:'unavailable',coverage:[],issues,manualChecks:['对照策划确认后再进入正式交付流程']}}}};
    const buffer=await handoffZip(activity,stage,true);
    res.writeHead(200,{'content-type':'application/zip','content-disposition':`attachment; filename="candidate.zip"; filename*=UTF-8''${encodeURIComponent(activity.name+'-交互模型候选源码与文档.zip')}`});res.end(buffer);return true;
  }
  const bundle = path.match(/^\/api\/activities\/([^/]+)\/(handoff|demo|ue-demo)\.zip$/);
  if (bundle && req.method === 'GET') {
    const activity = (await store.read()).activities.find(a => a.id === bundle[1]); if (!activity) return reply(404, { error: '活动不存在' });
    const buffer = await handoffZip(activity,bundle[2] as 'handoff'|'demo'|'ue-demo');
    res.writeHead(200, { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="${bundle[2]}.zip"; filename*=UTF-8''${encodeURIComponent(activity.name + (bundle[2]==='handoff'?'-程序交付.zip':'-Demo源码与功能文档.zip'))}` }); res.end(buffer); return true;
  }
  const ue = path.match(/^\/api\/activities\/([^/]+)\/ue-demo\/initialize$/);
  if (ue && req.method === 'POST') {
    await store.update(data => { const item = data.activities.find(a => a.id === ue[1]); if (!item) throw new Error('活动不存在'); assertStage(item, 'ue-demo'); if (item.artifacts?.['ue-demo']) throw new Error('已有 UE 联调产物，请继续编辑或使用 AI 修改'); const demo = item.artifacts!.demo!; item.artifacts!['ue-demo'] = { ...demo, stage: 'ue-demo', fileName: 'ue-demo.html', updatedAt: new Date().toISOString() }; invalidate(item, 'ue-demo'); item.updatedAt = new Date().toISOString(); });
    return reply(200, { ok: true });
  }
  if (path === '/api/integrations' && req.method === 'GET') return reply(200, {
    mode: 'local',
    feishu: { status: 'not_configured', message: '本地模式无需登录；公司部署前接入飞书身份和活动权限。' },
    figma: { status: process.env.FIGMA_CONNECT_URL ? 'authorization_entry_configured' : 'not_configured', connectUrl: process.env.FIGMA_CONNECT_URL || null, canGenerate: false, message: '需配置公司授权入口与支持写入的 MCP 执行器。仅账号关联不代表已有画布写入能力。' }
  });
  if (path === '/api/integrations/feishu/login') return reply(503, { error: '飞书应用尚未配置，本地模式可直接使用；生产部署需由公司配置应用和访问权限。' });
  const figma = path.match(/^\/api\/activities\/([^/]+)\/figma(?:\/(generate))?$/);
  if (figma) {
    if (req.method === 'POST' && figma[2]) return reply(503, { error: 'Figma 写入执行器尚未配置；请先完成公司 MCP 客户端能力及模板接入，未向 Figma 提交内容。' });
    if (req.method === 'PUT' && !figma[2]) {
      const input = JSON.parse((await body(req)).toString());
      const link = new URL(input.url); if (link.protocol !== 'https:' || !['figma.com','www.figma.com'].includes(link.hostname)) throw new Error('请填写 HTTPS Figma 文件链接');
      await store.update(data => { const item = data.activities.find(a => a.id === figma[1]); if (!item) throw new Error('活动不存在'); assertStage(item, 'ue-demo'); item.figmaUrl = link.href; });
      return reply(200, { url: link.href });
    }
  }
  return false;
}
