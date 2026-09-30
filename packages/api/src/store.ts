import { setTimeout as delay } from 'node:timers/promises';
import { mkdir, readFile, rename, writeFile, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { DEFAULT_GENERATION_SETTINGS, stageConfirmed } from '@ai-activity-studio/shared';
import { packagedSkills } from './stage-guidance.js';
import type { Activity, ActivityStage, ActivityType, GenerationJob, ModelConfig, StageSkill, ProductProfile } from '@ai-activity-studio/shared';

export type StoredModelConfig = Omit<ModelConfig, 'apiKeyConfigured'> & { encryptedApiKey?: string; keyFingerprint?: string };
export type StoreData = { generationSettings?: import('@ai-activity-studio/shared').GenerationSettings; activities: Activity[]; modelConfigs: StoredModelConfig[]; jobs: GenerationJob[]; skills: StageSkill[]; products: ProductProfile[] };
export interface PersistenceStore { read(): Promise<StoreData>; update<T>(mutate: (data: StoreData) => T | Promise<T>): Promise<T> }
const EMPTY: StoreData = { activities: [], modelConfigs: [], jobs: [], skills: [], products: [] };
export function defaultDataFile(): string {
  if (process.env.DATA_FILE) return process.env.DATA_FILE;
  const canonical = fileURLToPath(new URL('../../../data/runtime.json', import.meta.url));
  const legacy = fileURLToPath(new URL('../data/runtime.json', import.meta.url));
  if (existsSync(legacy)) {
    const data = existsSync(canonical) ? JSON.parse(readFileSync(canonical, 'utf8')) as Partial<StoreData> : {};
    if (![data.activities, data.modelConfigs, data.jobs].some(items => items?.length)) return legacy;
  }
  return canonical;
}
const legacyTypes: Record<string, ActivityType> = { campaign: 'race', survey: 'independent-merge', training: 'task-chain', event: 'n-vs-n' };
const kindStages: Record<string, ActivityStage> = { outline: 'flow', 'image-prompt': 'ue', copy: 'document' };
const defaultDescriptions: Record<ActivityStage,string> = { source:'辅助整理活动目标、受众与原始约束', flow:'梳理规则、分支和异常闭环', ue:'生成页面结构、状态与交互说明', document:'沉淀可开发、可验收的策划文档', demo:'生成可独立交互的 HTML Demo', 'ue-demo':'与 UE 共创并核对预上线交互', handoff:'生成程序交付说明与源码包' };
export function defaultSkills(now = new Date().toISOString()): StageSkill[] { return (Object.keys(defaultDescriptions) as ActivityStage[]).map(stage=>({ id:`builtin-${stage}`, stage, name:`默认${stage==='source'?'原稿':stage==='flow'?'流程图':stage==='ue'?'UE':stage==='document'?'策划文档':stage==='ue-demo'?'UE 联调':stage==='handoff'?'程序交付':'Demo'} Skill`, description:defaultDescriptions[stage], enabled:true, builtIn:true, ...((stage === 'document' || stage === 'demo') ? packagedSkills[stage] : {}), createdAt:now, updatedAt:now })); }

export function normalizeStoreData(raw: Partial<StoreData> | undefined): StoreData {
  const activities = Array.isArray(raw?.activities) ? raw.activities.map(item => ({ ...item, type: legacyTypes[item.type] ?? item.type, productId: item.productId ?? 'mc', status: item.status==='ready'&&!stageConfirmed(item,'handoff')?'draft':item.status, approvals: item.approvals ?? {}, artifacts: item.artifacts ?? {} } as Activity)) : [];
  const jobs = Array.isArray(raw?.jobs) ? raw.jobs.map(job => ({ ...job, stage: job.stage ?? kindStages[job.kind] ?? 'document', auditTrail: Array.isArray(job.auditTrail) ? job.auditTrail : [{ id: randomUUID(), type: 'created' as const, at: job.createdAt, actor: 'system' as const, summary: '由旧版运行时数据迁移；历史私有推理过程未记录' }] })) : [];
  const storedSkills = Array.isArray(raw?.skills) ? raw.skills.map(skill => ({ ...skill, ...((skill.id === 'builtin-document' || skill.id === 'builtin-demo') ? packagedSkills[skill.stage as 'document' | 'demo'] : {}) })) : [];
  const builtIns = defaultSkills().filter(skill=>!storedSkills.some(saved=>saved.id===skill.id));
  const products = raw?.products?.length ? raw.products : [{ id: 'mc', name: 'MC', activityTypes: [{id:'race',name:'竞速'},{id:'independent-merge',name:'独立合成线'},{id:'gift-pack',name:'礼包'},{id:'task-chain',name:'任务链'},{id:'n-vs-n',name:'NvsN'},{id:'other',name:'其他'}] }];
  return { generationSettings: { ...DEFAULT_GENERATION_SETTINGS, ...raw?.generationSettings }, activities, products, modelConfigs: Array.isArray(raw?.modelConfigs) ? raw.modelConfigs.map(config => ({ ...config })) : [], jobs, skills:[...storedSkills,...builtIns] };
}

// Windows may temporarily deny replacing a file while another reader or scanner holds it.
export async function replaceFileWithRetry(source: string, destination: string, move = rename) {
  for (let attempt = 0; ; attempt++) {
    try { await move(source, destination); return; }
    catch (error) {
      if (!['EPERM', 'EACCES', 'EBUSY'].includes((error as NodeJS.ErrnoException).code ?? '') || attempt >= 5) throw error;
      await delay(50 * 2 ** attempt);
    }
  }
}

export class JsonPersistenceStore implements PersistenceStore {
  private chain: Promise<unknown> = Promise.resolve();
  constructor(private readonly filePath: string) {}
  async read(): Promise<StoreData> { try { return normalizeStoreData(JSON.parse(await readFile(this.filePath, 'utf8')) as Partial<StoreData>); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; await this.save(structuredClone(EMPTY)); return normalizeStoreData(EMPTY); } }
  update<T>(mutate: (data: StoreData) => T | Promise<T>): Promise<T> { const operation = this.chain.then(async () => { const data = await this.read(); const result = await mutate(data); await this.save(data); return result; }); this.chain = operation.catch(() => undefined); return operation; }
  private async save(data: StoreData) { await mkdir(dirname(this.filePath), { recursive: true }); const temp = `${this.filePath}.${randomUUID()}.tmp`; try { await writeFile(temp, JSON.stringify(data, null, 2), 'utf8'); await replaceFileWithRetry(temp, this.filePath); } finally { await rm(temp, { force: true }).catch(() => undefined); } }
}
export interface PostgresPersistenceStore extends PersistenceStore {}
