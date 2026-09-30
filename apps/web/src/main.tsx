import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Activity, ActivityStage, ActivityType, GenerationJob, ModelConfig, PublicStageSkill, StageArtifact, SourceImage } from '@ai-activity-studio/shared';
import './styles.css';
import { api } from './api';
import { DataCenter, DemoFrame, ConfigurationEditor } from './data-center';
import { GenerationSettingsPanel } from './generation-settings';
import { GenerationProgressPanel } from './generation-progress';
import { RefineChat } from './refine-chat';
import { DemoQualityPanel } from './demo-quality';
import { SourcePreview } from './source-preview';

import { PIPELINE, canEnterStage, stageConfirmed, activityImages, resolveActivityImages, type ProductProfile } from '@ai-activity-studio/shared';
import { ProductSkills, FigmaPanel, Review } from './pipeline-ui';

type View = 'activities' | 'models' | 'advanced' | 'configuration' | 'dashboard';
type Toast = { id: number; message: string; error?: boolean };
type StageMeta = { id: ActivityStage; name: string; description: string; kind?: 'outline' | 'copy' | 'image-prompt' };

const stageList: StageMeta[] = PIPELINE;
const labels: Record<string, string> = { race: '竞速', 'independent-merge': '独立合成线', 'gift-pack': '礼包', 'task-chain': '任务链', 'n-vs-n': 'NvsN', draft: '草稿', generating: '生成中', ready: '已就绪', failed: '失败', queued: '排队中', running: '生成中', paused: '已暂停', completed: '已完成' };


function App() {
  const [connected, setConnected] = useState(false);
  const [view, setView] = useState<View>('activities');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [configs, setConfigs] = useState<ModelConfig[]>([]);
  const [products, setProducts] = useState<ProductProfile[]>([]);
  const [skills, setSkills] = useState<PublicStageSkill[]>([]);
  const [selected, setSelected] = useState<Activity | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [deleting, setDeleting] = useState<Activity | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = (message: string, error = false) => {
    const id = Date.now();
    setToasts(items => [...items, { id, message, error }]);
    setTimeout(() => setToasts(items => items.filter(item => item.id !== id)), 3200);
  };
  const load = async () => {
    try {
      const [a, c, s, p] = await Promise.all([api<Activity[]>('/api/activities'), api<ModelConfig[]>('/api/model-configs'), api<PublicStageSkill[]>('/api/skills'), api<ProductProfile[]>('/api/products')]);
      setProducts(p); setActivities(a); if (!selected) { const initial = new URLSearchParams(location.search).get('activity'); if(initial) setSelected(a.find(item=>item.id===initial) ?? null); } setConfigs(c); setSkills(s); setConnected(true);
      if (selected) setSelected(a.find(item => item.id === selected.id) ?? null);
    } catch (error) { setConnected(false); toast((error as Error).message, true); }
  };
  useEffect(() => { void load(); }, []);
  if (new URLSearchParams(location.search).get('review') === '1') return <Review activity={selected ?? undefined} />;
  return <div className="shell">
    <aside><div className="brand"><b>A</b><span>Activity Studio<small>创意生产工作台</small></span></div><nav>
      {([['activities', '活动项目'], ['dashboard', '游玩节奏看板'], ['models', '模型中心'], ['advanced', '高级配置']] as [View, string][]).map(([id, name]) => <button key={id} className={view === id && !selected ? 'active' : ''} onClick={() => { setView(id); setSelected(null); }}>{name}</button>)}
    </nav><small className="local">{connected ? '本地服务已连接' : '服务连接未完成'}</small></aside>
    <main>{selected ? <Workspace configs={configs} activity={selected} onBack={() => setSelected(null)} reload={load} toast={toast} /> : view === 'activities' ? <Overview products={products} items={activities} onOpen={setSelected} onCreate={() => setCreateOpen(true)} onEdit={setEditing} onDelete={setDeleting} /> : view === 'configuration' || view === 'dashboard' ? <DataCenter activities={activities} dashboard={view === 'dashboard'} reload={load} onOpen={setSelected} toast={toast} /> : view === 'models' ? <Models configs={configs} reload={load} toast={toast} /> : <><GenerationSettingsPanel toast={toast} /><ProductSkills products={products} reload={load} toast={toast} /><Advanced items={skills} reload={load} toast={toast} /></>}</main>
    {createOpen && <ActivityForm products={products} close={() => setCreateOpen(false)} done={async () => { setCreateOpen(false); await load(); }} toast={toast} />}
    {editing && <ActivityForm products={products} activity={editing} close={() => setEditing(null)} done={async () => { setEditing(null); await load(); }} toast={toast} />}
    {deleting && <DeleteConfirm activity={deleting} close={() => setDeleting(null)} done={async () => { setDeleting(null); await load(); }} toast={toast} />}
    <div className="toasts">{toasts.map(item => <div className={item.error ? 'error' : ''} key={item.id}>{item.message}</div>)}</div>
  </div>;
}

function Overview({ products, items, onOpen, onCreate, onEdit, onDelete }: { products: ProductProfile[]; items: Activity[]; onOpen: (item: Activity) => void; onCreate: () => void; onEdit: (item: Activity) => void; onDelete: (item: Activity) => void }) {
  const [query, setQuery] = useState('');
  const list = items.filter(item => (item.name + item.description).includes(query));
  return <div className="page"><header><div><span className="eyebrow">ACTIVITY PROJECTS</span><h1>从创意到可体验方案</h1><p>原稿 → 策划（配置可选）→ UE 交互模型 → 交互验收 → 美术与 Unity 交付，逐步确认。</p></div><button className="primary" onClick={onCreate}>＋ 新建活动</button></header>
    <section className="stats"><div><strong>{items.length}</strong><span>全部项目</span></div><div><strong>{items.filter(x => x.status === 'ready').length}</strong><span>已就绪</span></div><div><strong>{items.filter(x => x.status === 'generating').length}</strong><span>生成中</span></div></section>
    <div className="bar"><h2>最近活动</h2><input placeholder="搜索活动" value={query} onChange={event => setQuery(event.target.value)} /></div>
    <div className="cards">{list.map(item => <article className="card" key={item.id}><span className={`pill ${item.status}`}>{labels[item.status]}</span><button className="card-open" onClick={() => onOpen(item)}><i>{item.name[0]}</i><small>{products.find(p=>p.id===item.productId)?.activityTypes.find(t=>t.id===item.type)?.name??labels[item.type]??item.type}</small><h3>{item.name}</h3><p>{item.description || '暂无说明'}</p></button><footer><button onClick={() => onOpen(item)}>打开工作台 →</button><span><button onClick={() => onEdit(item)}>编辑</button><button className="danger" onClick={() => onDelete(item)}>删除</button></span></footer></article>)}</div>
  </div>;
}

function ActivityForm({ activity, products, close, done, toast }: { activity?: Activity; products: ProductProfile[]; close: () => void; done: () => Promise<void>; toast: (message: string, error?: boolean) => void }) {
  const [product, setProduct] = useState(activity?.productId ?? products[0]?.id ?? 'mc');
  const [upload, setUpload] = useState<File>();
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true);
    try {
      const saved = await api<Activity>(activity ? `/api/activities/${activity.id}` : '/api/activities', { method: activity ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.fromEntries(form)) });
      if (upload) {
        const payload = new FormData(); payload.append('file', upload);
        try { await api(`/api/activities/${saved.id}/artifacts/source`, { method: 'POST', body: payload }); }
        catch (error) { await done(); toast(`活动已保存，原稿导入失败：${(error as Error).message}。可在第一步重新上传。`, true); return; }
      }
      await done(); toast(activity ? '活动已更新，请重新确认后续阶段' : '活动已创建');
    } catch (error) { toast((error as Error).message, true); } finally { setBusy(false); }
  };
  return <div className="modal" role="dialog" aria-modal="true"><form onSubmit={submit}><h2>{activity ? '编辑活动' : '新建活动'}</h2><label>名称<input name="name" required autoFocus defaultValue={activity?.name} /></label><label>产品<select name="productId" value={product} onChange={e=>setProduct(e.target.value)}>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>活动类型<select key={product} name="type" defaultValue={activity?.type}>{products.find(p=>p.id===product)?.activityTypes.map(type=><option key={type.id} value={type.id}>{type.name}</option>)}</select></label><small>类型及对应框架在高级配置中管理。</small><label>说明<textarea name="description" defaultValue={activity?.description} /></label><label>活动原稿<textarea name="markdown" placeholder="# 活动原稿" defaultValue={activity?.markdown} disabled={Boolean(upload)} /></label><label>上传 Word / 文本<input type="file" accept=".doc,.docx,.md,.txt" onChange={e=>setUpload(e.target.files?.[0])} /></label><small>支持 .doc 与 .docx 图文，最大 15 MB。上传文件将作为活动原稿；图片识别需使用支持图片输入的模型。</small><div><button type="button" disabled={busy} onClick={close}>取消</button><button className="primary" disabled={busy}>{busy ? '保存与导入中…' : activity ? '保存修改' : '创建'}</button></div></form></div>;
}

function DeleteConfirm({ activity, close, done, toast }: { activity: Activity; close: () => void; done: () => Promise<void>; toast: (message: string, error?: boolean) => void }) {
  const [value,setValue]=useState(''); const remove=async()=>{try{await api(`/api/activities/${activity.id}`,{method:'DELETE'});await done();toast('活动及关联任务/产物已删除');}catch(error){toast((error as Error).message,true);}};
  return <div className="modal" role="alertdialog" aria-modal="true"><div className="confirm-box"><h2>确认删除活动？</h2><p>此操作会同步清理“{activity.name}”的生成任务和全部阶段产物，且无法恢复。</p><label>请输入活动名称以确认<input autoFocus value={value} onChange={event=>setValue(event.target.value)} /></label><div><button onClick={close}>取消</button><button className="danger-solid" disabled={value!==activity.name} onClick={()=>void remove()}>永久删除</button></div></div></div>;
}

function Workspace({ activity, configs, onBack, reload, toast }: { configs: ModelConfig[]; activity: Activity; onBack: () => void; reload: () => Promise<void>; toast: (message: string, error?: boolean) => void }) {
  const [index, setIndex] = useState(0), [jobs, setJobs] = useState<GenerationJob[]>([]), [latest, setLatest] = useState(activity);
  const [content, setContent] = useState(''), [instruction, setInstruction] = useState(''), [busy, setBusy] = useState(false);
  const [configDirty,setConfigDirty]=useState(false);
  const [modelId,setModelId]=useState('');
  const enabledModels=configs.filter(config=>config.enabled);
  const selectedModel=enabledModels.find(config=>config.id===modelId)??enabledModels.find(config=>config.isDefault)??enabledModels.find(config=>config.provider!=='demo')??enabledModels[0];
  const [resetVersion,setResetVersion]=useState<string|null>(null), [clearConfiguration,setClearConfiguration]=useState(true);
  const [documentTab, setDocumentTab] = useState<'text'|'config'>('text');
  const file = useRef<HTMLInputElement>(null);
  const refreshSerial = useRef(0);
  const current = stageList[index]!, artifact = latest.artifacts?.[current.id];
  const html = current.id === 'demo' || current.id === 'ue-demo';
  const wordStage = current.id === 'source' || current.id === 'document';
  const importedWord = current.id === 'document' ? latest.planningDocument : latest.sourceDocument;
  const refresh = async () => { const serial=++refreshSerial.current; const [next, nextJobs] = await Promise.all([api<Activity>(`/api/activities/${activity.id}`), api<GenerationJob[]>(`/api/activities/${activity.id}/generation-jobs`)]); if(serial===refreshSerial.current){setLatest(next);setJobs(nextJobs);} return next; };
  const action = async (fn:()=>Promise<void>) => {setBusy(true);try {await fn();} catch(e){toast((e as Error).message,true);} finally{setBusy(false);}};
  useEffect(()=>{void refresh().catch(e=>toast(e.message,true));},[index]);
  useEffect(()=>{setContent(artifact?.encoding==='utf8'?artifact.content:'');},[artifact?.updatedAt,current.id]);
  const active=jobs.find(j=>j.stage===current.id&&['queued','running'].includes(j.state));
  const failed=jobs.find(j=>j.stage===current.id)?.state==='failed'?jobs.find(j=>j.stage===current.id):undefined;
  const paused=jobs.find(j=>j.stage===current.id&&j.state==='paused');
  const candidate=html&&!artifact?jobs.find(job=>job.stage===current.id)?.demoDraft:undefined;
  const candidateConfig=useMemo(()=>{try{const value=JSON.parse(candidate?.planText??'null')?.configuration;return Array.isArray(value?.fields)&&Array.isArray(value?.rows)?value as Activity['configuration']:undefined;}catch{return undefined;}},[candidate?.planText]);
  const candidateReady=Boolean(candidate?.content&&candidateConfig);
  useEffect(() => {
    if (!active) return;
    let stopped = false, failures = 0;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try { await refresh(); failures = 0; }
      catch { if (!stopped && failures++ === 0) toast('暂时无法连接本地服务，正在重试，请勿重复提交生成。', true); }
      if (!stopped) timer = setTimeout(() => void poll(), Math.min(900 * 2 ** Math.min(failures, 4), 10000));
    };
    timer = setTimeout(() => void poll(), 900);
    return () => { stopped = true; clearTimeout(timer); };
  }, [active?.id]);
  const dirty=content!==(artifact?.content??'');
  const allowed=canEnterStage(latest,current.id);
  const quality=artifact?.demoDelivery;
  const needsValidation=html&&Boolean(quality)&&(!quality!.validation?.passed||quality!.plan.configuration.revision!==latest.demoConfigRevision||quality!.plan.configuration.sourceDocumentUpdatedAt!==latest.artifacts?.document?.updatedAt);
  const confirm=()=>action(async()=>{await api(`/api/activities/${activity.id}/confirm/${current.id}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({expectedUpdatedAt:artifact?.updatedAt})});await refresh();await reload();toast('当前阶段已确认');if(index<4)setIndex(index+1);});
  const save=()=>action(async()=>{await api(`/api/activities/${activity.id}/artifacts/${current.id}`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({expectedUpdatedAt:artifact?.updatedAt??'',kind:html?'html':'markdown',fileName:current.id+(html?'.html':'.md'),mimeType:html?'text/html':'text/markdown',content})});await refresh();await reload();toast('已保存；当前及下游阶段需要重新确认');});
  const generate=()=>action(async()=>{await api('/api/generation-jobs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({modelId:selectedModel?.id,activityId:activity.id,stage:current.id,regenerate:Boolean(artifact)})});await refresh();});
  const upload=(selected:File)=>action(async()=>{const form=new FormData();form.append('file',selected);await api(`/api/activities/${activity.id}/artifacts/${current.id}`,{method:'POST',body:form});await refresh();await reload();toast('已上传，请核对产物');});
  const refine=async(request=instruction,images:SourceImage[]=[])=>{let sent=false;await action(async()=>{const result=await api<{job?: GenerationJob}>(`/api/activities/${activity.id}/artifacts/${current.id}/refine`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({modelId:selectedModel?.id,instruction:request,images,content,expectedUpdatedAt:artifact?.updatedAt??''})});sent=true;setInstruction('');await refresh();toast(result.job?'修改任务已提交，将检查并生成预览，可在进度区暂停':'AI 修改已保存，请核对');});return sent;};
  const shareLink=`${location.origin}${location.pathname}?activity=${encodeURIComponent(activity.id)}&review=1`;
  const resetDemo=()=>action(async()=>{
    await api(`/api/activities/${activity.id}/demo/reset`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({expectedUpdatedAt:resetVersion,clearConfiguration})});
    refreshSerial.current++;
    setResetVersion(null);setContent('');setInstruction('');await refresh();await reload();
    toast('交互模型和关联数据已清除，可重新根据策划生成');
  });
  return <div className={`workspace ${html?'demo-workspace':''}`}><div className="workspace-top"><button className="back" onClick={onBack}>← 返回活动</button><a href={shareLink} target="_blank" rel="noreferrer">打开活动评审页 ↗</a></div><header><div><span className="eyebrow">PRODUCT AI PIPELINE</span><h1>{latest.name}</h1><p>{latest.description}</p></div></header>
    <nav className="steps">{stageList.map((stage,i)=><React.Fragment key={stage.id}><button disabled={!canEnterStage(latest,stage.id)||busy} className={`${i===index?'current ':''}${stageConfirmed(latest,stage.id)?'done':''}`} onClick={()=>{if(dirty||configDirty){toast('请先保存当前编辑，再切换阶段',true);return;}setIndex(i);}}><b>{stageConfirmed(latest,stage.id)?'✓':i+1}</b><span>{stage.name}<small>{stageConfirmed(latest,stage.id)?'已确认':!canEnterStage(latest,stage.id)?'未解锁':latest.artifacts?.[stage.id]?'待核对确认':'待处理'}</small></span></button>{i<4&&<i/>}</React.Fragment>)}</nav>
    {current.id==='document'&&<div className="tabs"><button disabled={configDirty} onClick={()=>setDocumentTab('text')} className={documentTab==='text'?'active':''}>策划正文</button><button onClick={()=>setDocumentTab('config')} className={documentTab==='config'?'active':''}>可选配置表 · {latest.configuration?.tables?.length??(latest.configuration?1:0)} 张</button></div>}
    {current.id==='document'&&documentTab==='config'?<div className="workspace-configuration data-center"><ConfigurationEditor onDirtyChange={setConfigDirty} activity={latest} reload={async()=>{await refresh();await reload();}} toast={toast}/><button className="primary" disabled={configDirty} onClick={()=>setDocumentTab('text')}>返回正文并确认阶段</button></div>:<section className="stage-layout"><div className="stage-left"><div className="stage-head"><small>阶段 {index+1} / 5</small><h2>{current.name}</h2><p>{current.description}</p></div>
      <label className="generation-model">本次生成 / AI 修改使用的模型<select aria-label="本次使用的模型" disabled={busy||Boolean(active)} value={selectedModel?.id??''} onChange={event=>setModelId(event.target.value)}>{!enabledModels.length&&<option value="">请先在模型中心添加并启用模型</option>}{enabledModels.map(config=><option key={config.id} value={config.id}>{config.displayName||config.model}{config.isDefault?' · 默认':''}{config.provider==='demo'?' · 本地示例':''}</option>)}</select><small>每次提交保存所选模型；生成中不会随默认模型切换。继续任务使用原模型。</small></label>
      <div className="stage-tools">{html&&latest.configuration&&latest.demoConfigRevision!==latest.configuration.revision&&<button disabled={busy||!allowed} onClick={()=>void action(async()=>{await api('/api/activities/'+activity.id+'/configuration/sync',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({expectedRevision:latest.configuration!.revision})});await refresh();toast('整组配置已同步，请重新试玩');})}>同步最新配置表组</button>}<input hidden ref={file} type="file" accept={wordStage?'.doc,.docx,.md,.txt':html?'.html':'.md,.txt'} onChange={e=>{const selected=e.target.files?.[0];e.target.value='';if(selected)void upload(selected);}}/>{!html&&<><button disabled={busy||!allowed} onClick={()=>file.current?.click()}>{wordStage?'上传 Word / 文本':'上传'}</button><button disabled={busy||!allowed||!content.trim()||!dirty} onClick={()=>void save()}>保存编辑</button>{artifact&&<a href={`/api/activities/${activity.id}/artifacts/${current.id}?download=1`}>下载</a>}</>}{index>0&&<button className={html?'primary':undefined} disabled={busy||!selectedModel||!allowed||Boolean(active)||Boolean(paused)} onClick={()=>void generate()}>{active?'正在生成…':html?(artifact?'重新生成交互模型':'根据策划生成交互模型'):artifact?'重新生成':'AI 生成'}</button>}{active&&<button onClick={()=>void action(async()=>{await api(`/api/generation-jobs/${active.id}/pause`,{method:'POST'});await refresh();})}>暂停</button>}{paused&&<button disabled={!allowed} onClick={()=>void action(async()=>{await api(`/api/generation-jobs/${paused.id}/resume`,{method:'POST'});await refresh();})}>继续生成</button>}{html&&failed?.demoDraft&&!active&&!paused&&<button disabled={busy||!allowed} onClick={()=>void action(async()=>{await api(`/api/generation-jobs/${failed.id}/resume`,{method:'POST'});await refresh();})}>继续自动修复</button>}{!active&&(paused||failed)&&selectedModel&&selectedModel.id!==(paused??failed)?.modelId&&<button disabled={busy||!allowed} onClick={()=>void action(async()=>{await api(`/api/generation-jobs/${(paused??failed)!.id}/resume`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({modelId:selectedModel.id})});await refresh();})}>改用所选模型继续</button>}{needsValidation&&!active&&!paused&&!failed&&<button disabled={busy||!allowed} onClick={()=>void refine('保留完整活动玩法，外部主线供给改为用户主动点击 Debug 模拟，不制作主线棋盘、合成或订单玩法；自动修复活动问题，补充活动回归测试并完成浏览器验证后再交付。')}>完善并验证当前交互模型</button>}{current.id==='demo'&&<button className="danger" disabled={busy} onClick={()=>{setClearConfiguration(true);setResetVersion(latest.updatedAt);}}>清除交互模型</button>}</div>
      <GenerationProgressPanel job={active??paused??jobs.find(job=>job.stage===current.id)}/>
      {html && <DemoQualityPanel artifact={artifact} configRevision={latest.demoConfigRevision} documentVersion={latest.artifacts?.document?.updatedAt} dirty={dirty}/>}
      {wordStage&&<div className="source-import-info"><p>支持 .doc / .docx 图文（最大 15 MB）。保留正文、表格与图片；识图需使用支持图片输入的模型。</p>{current.id==='document'&&<p>可上传已有策划替换本阶段正文。核对并确认后，将依据策划图文生成 UE 交互模型。配置表可选；没有填写时自动使用默认值跑通流程，待确认值会记录在交付说明中。</p>}{importedWord&&<><a href={`/api/activities/${activity.id}/${current.id==='document'?'planning-document':'source-document'}`}>下载原 Word：{importedWord.fileName}</a><small>已保留 {importedWord.images.length} 张图片</small>{importedWord.warnings.length>0&&<details><summary>有 {importedWord.warnings.length} 条导入提示，请核对</summary>{importedWord.warnings.map((text,i)=><p key={i} className="data-warning">{text}</p>)}</details>}</>}{current.id==='source'&&(latest.artifacts?.flow||latest.artifacts?.ue)&&<details><summary>旧版历史产物</summary>{(['flow','ue'] as const).filter(s=>latest.artifacts?.[s]).map(s=><a key={s} href={`/api/activities/${activity.id}/artifacts/${s}?download=1`}>下载历史{s==='flow'?'流程图':'UE 图片'} </a>)}</details>}</div>}
      {current.id==='ue-demo'&&<><button disabled={Boolean(artifact)||busy} onClick={()=>void action(async()=>{await api(`/api/activities/${activity.id}/ue-demo/initialize`,{method:'POST'});await refresh();})}>从已确认交互模型开始验收</button><FigmaPanel activity={latest} reload={refresh} toast={toast}/></>}
      {candidateReady&&<a className="bundle-link" href={`/api/generation-jobs/${jobs.find(job=>job.stage===current.id)!.id}/candidate.zip`}>下载候选源码与功能文档（待验收）</a>}
      {html&&artifact?.demoProject&&!dirty&&!needsValidation&&<a className="bundle-link" href={`/api/activities/${activity.id}/${current.id}.zip`}>下载交互模型完整源码与功能文档（ZIP）</a>}
      {current.id==='handoff'&&artifact&&<a className="bundle-link" href={`/api/activities/${activity.id}/handoff.zip`}>下载完整程序交付包 ZIP</a>}
      {html?<><div className="demo-direct-info"><b>{active?'AI 正在将策划图文实现为 UE 交互模型':artifact?'当前保存的交互模型，可在右侧试玩':'从策划文档生成 UE 交互模型'}</b><p>读取已确认的策划图文；配置可选，未填时使用默认值，编译、试玩和自动修复通过后更新预览。对话修改保留原项目及回归测试，验证失败不会覆盖当前版本。</p></div><details className="demo-advanced"><summary>高级操作 · 导入或编辑 HTML</summary><div className="stage-tools"><button disabled={busy||!allowed} onClick={()=>file.current?.click()}>导入 HTML</button><button disabled={busy||!allowed||!dirty||!content.trim()} onClick={()=>void save()}>保存编辑</button>{artifact&&<a href={`/api/activities/${activity.id}/artifacts/${current.id}?download=1`}>下载 Demo HTML</a>}</div><label className="editor-label"><span>{html?'Demo 源码':'可编辑产物'}{dirty?' · 尚未保存':''}</span><textarea className="artifact-editor" value={content} onChange={e=>setContent(e.target.value)} /></label></details></>:<label className="editor-label"><span>{html?'Demo 源码':'可编辑产物'}{dirty?' · 尚未保存':''}</span><textarea className="artifact-editor" value={content} onChange={e=>setContent(e.target.value)} /></label>}<RefineChat key={current.id} modelName={selectedModel?.displayName||selectedModel?.model||'请先选择模型'} instruction={instruction} onInstruction={setInstruction} disabled={busy||!selectedModel||Boolean(active)||Boolean(paused)||!allowed||!content.trim()} onSend={refine}/>
      <div className="stage-confirm"><p>{stageConfirmed(latest,current.id)?'✓ 当前版本已确认':needsValidation?'请先完成自动修复与验证':'核对产物后确认，解锁下一步'}<small>修改上游内容后，后续阶段需重新确认</small></p><button className="primary" disabled={busy||dirty||!artifact||Boolean(active)||!allowed||needsValidation} onClick={()=>void confirm()}>{index===4?'确认程序交付':'确认并继续 →'}</button></div><div className="audit"><h3>任务轨迹</h3>{jobs.filter(j=>j.stage===current.id).map(j=><div key={j.id}><b>{labels[j.state]}</b>{j.auditTrail.slice(-2).map(e=><small key={e.id}>{e.summary}</small>)}{j.error&&<em>{j.error}</em>}</div>)}</div>
    </div><div className="stage-right"><div className="preview-head"><h2>{candidateReady?'最近编译草稿':'产物预览'}</h2><span>{candidateReady?'待验收 · 不代表生成通过':artifact?.fileName??'尚无产物'}</span></div>{candidateReady?<DemoFrame content={resolveActivityImages(candidate!.content!,latest)} configuration={candidateConfig} activityId={activity.id+':candidate'} recordEvents={false}/>:<Preview artifact={content.trim()?{stage:current.id,kind:html?'html':'markdown',fileName:current.id+(html?'.html':'.md'),mimeType:html?'text/html':'text/markdown',content,encoding:'utf8',updatedAt:artifact?.updatedAt??''}:undefined} demo={html} activity={latest}/>}</div></section>}
    {resetVersion!==null&&<div className="modal"><form role="dialog" aria-modal="true" aria-labelledby="reset-demo-title" onSubmit={e=>{e.preventDefault();void resetDemo();}}><h2 id="reset-demo-title">清除交互模型 并重新开始</h2><p>将停止此活动的 Demo、UE 联调和交付生成任务，并删除这些阶段的产物、候选草稿、审查记录、任务记录及确认状态，同时清空试玩数据和本地 Figma 关联。</p><p>保留活动信息、原稿和策划文档（含 Word 图文及确认状态）。不会删除 Figma 中的文件。</p><label className="checkbox"><input type="checkbox" checked={clearConfiguration} disabled={busy} onChange={e=>setClearConfiguration(e.target.checked)}/>同时清空活动配置表，重新依据策划生成（包含手动上传或编辑的数据）</label><p className="data-warning">清除后无法撤销，未保存的 Demo 编辑和修改要求也会丢弃。如需保留，请先下载。清除后点击「根据策划生成交互模型」开始，不会自动调用模型。</p><div><button type="button" autoFocus disabled={busy} onClick={()=>setResetVersion(null)}>取消</button><button className="danger" disabled={busy}>{busy?'正在清除…':'确认清除'}</button></div></form></div>}
  </div>;
}

function Preview({ artifact, demo, activity }: { artifact?: StageArtifact; demo: boolean; activity: Activity }) {
  if (!artifact) return <div className="empty">{demo?'点击「根据策划生成交互模型」，完成后即可在这里试玩':'等待生成或上传阶段产物'}</div>;
  if (demo && artifact.mimeType.includes('html')) return <DemoFrame content={resolveActivityImages(artifact.content,activity)} configuration={activity.demoConfiguration} activityId={activity.id} />;
  if ((artifact.stage === 'source' || artifact.stage === 'document' || artifact.stage === 'handoff') && artifact.encoding === 'utf8') return <SourcePreview content={artifact.content} images={activityImages(activity)} />;
  if (artifact.mimeType.startsWith('image/')) { const src=artifact.encoding==='base64'?`data:${artifact.mimeType};base64,${artifact.content}`:`data:${artifact.mimeType};utf8,${encodeURIComponent(artifact.content)}`; return <div className="preview visual"><img src={src} alt="阶段产物" /></div>; }
  return <pre className="preview">{artifact.encoding === 'utf8' ? artifact.content : '二进制产物，请下载查看'}</pre>;
}

const EMPTY_MODEL = { provider: 'openai-compatible', baseUrl: '', apiKey: '', model: '', displayName: '', fullUrl: false, isDefault: false, enabled: true };
function Models({ configs, reload, toast }: { configs: ModelConfig[]; reload: () => Promise<void>; toast: (message: string, error?: boolean) => void }) {
  const [editing, setEditing] = useState<ModelConfig | null | 'new'>(null);
  const [form, setForm] = useState(EMPTY_MODEL);
  const [testing, setTesting] = useState<string | null>(null);
  const open = (config?: ModelConfig) => { setEditing(config || 'new'); setForm(config ? { provider: config.provider, baseUrl: config.baseUrl || '', apiKey: '', model: config.model, displayName: config.displayName || '', fullUrl: config.fullUrl ?? false, isDefault: config.isDefault ?? false, enabled: config.enabled } : EMPTY_MODEL); };
  const save = async (event: FormEvent) => { event.preventDefault(); try { const body = { ...form, apiKey: form.apiKey || undefined }; if (editing === 'new') await api('/api/model-configs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); else if (editing) await api(`/api/model-configs/${editing.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); setEditing(null); await reload(); toast('模型配置已保存'); } catch (error) { toast((error as Error).message, true); } };
  const toggle = async (config: ModelConfig) => { try { await api(`/api/model-configs/${config.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled: !config.enabled }) }); await reload(); toast(config.enabled ? '模型已停用' : '模型已启用'); } catch (error) { toast((error as Error).message, true); } };
  const test = async (config: ModelConfig) => { setTesting(config.id); try { const result = await api<{ message: string; latencyMs: number }>(`/api/model-configs/${config.id}/test`, { method: 'POST' }); toast(`${result.message}（短请求总耗时 ${result.latencyMs}ms，不是完整 Demo 的生成时间）`); } catch (error) { toast((error as Error).message, true); } finally { setTesting(null); } };
  const remove = async (config: ModelConfig) => { if (!confirm(`删除模型 ${config.model}？`)) return; try { await api(`/api/model-configs/${config.id}`, { method: 'DELETE' }); await reload(); toast('模型配置已删除'); } catch (error) { toast((error as Error).message, true); } };
  return <div className="page"><header><div><span className="eyebrow">MODEL CENTER</span><h1>模型中心</h1><p>填写公司网关地址、模型 ID 和 API 密钥即可接入。默认模型用于后续生成；连通测试会发送少量请求。</p></div><button className="primary" onClick={() => open()}>＋ 添加模型</button></header>
    <div className="model-list">{configs.map(config => <article key={config.id}><div className="model-main"><span className={`status-dot ${config.enabled ? 'on' : ''}`} /><div><b>{config.displayName || config.model}{config.isDefault ? ' · 默认' : ''}</b><p>{config.provider} · {config.model} · {config.baseUrl || '内置演示运行时'}</p></div></div><div className="model-security"><span>API Key</span><b>{config.apiKeyConfigured ? `已配置 · ${config.keyFingerprint || '已加密'}` : '未配置'}</b></div><div className="model-actions"><button onClick={() => void test(config)} disabled={testing === config.id}>{testing === config.id ? '测试中…' : '连通测试'}</button><button onClick={() => open(config)}>编辑</button><button onClick={() => void toggle(config)}>{config.enabled ? '停用' : '启用'}</button><button className="danger" onClick={() => void remove(config)}>删除</button></div></article>)}</div>
    {editing && <div className="modal"><form onSubmit={save}><h2>{editing === 'new' ? '添加模型' : '编辑模型'}</h2><label>API 格式<select value={form.provider === 'demo' ? 'demo' : 'openai-compatible'} onChange={event => setForm({ ...form, provider: event.target.value })}><option value="openai-compatible">OpenAI Chat Completions 格式</option><option value="demo">本地演示（不调用 AI）</option></select></label><details><summary>高级配置</summary><label>自定义 Provider<input value={form.provider} onChange={event => setForm({ ...form, provider: event.target.value })} placeholder="openai-compatible" required /></label></details><label>自定义请求地址<input value={form.baseUrl} onChange={event => setForm({ ...form, baseUrl: event.target.value })} placeholder="https://api.example.com/v1" required={form.provider !== 'demo'} /></label><label className="checkbox"><input type="checkbox" checked={form.fullUrl} onChange={event => setForm({ ...form, fullUrl: event.target.checked })} />完整 URL（不追加 /chat/completions）</label><small>{form.fullUrl ? '将使用填写的完整请求地址' : '填写服务端基础地址；自动追加 /chat/completions，已有该路径时不会重复添加'}</small><label>API Key<input type="password" required={editing === 'new' && form.provider !== 'demo'} autoComplete="new-password" value={form.apiKey} onChange={event => setForm({ ...form, apiKey: event.target.value })} placeholder={editing === 'new' ? '输入 API Key；不会回显' : '留空则保留原密钥'} /></label><label>模型 ID<input value={form.model} onChange={event => setForm({ ...form, model: event.target.value })} placeholder="model-id" required /></label><label>模型显示名称<input maxLength={64} value={form.displayName} onChange={event => setForm({ ...form, displayName: event.target.value })} placeholder="留空显示模型 ID" /></label><label className="checkbox"><input type="checkbox" checked={form.isDefault} onChange={event => setForm({ ...form, isDefault: event.target.checked })} />设为默认生成模型</label><label className="checkbox"><input type="checkbox" checked={form.enabled} onChange={event => setForm({ ...form, enabled: event.target.checked })} /> 保存后启用</label><div><button type="button" onClick={() => setEditing(null)}>取消</button><button className="primary">保存</button></div></form></div>}
  </div>;
}

function Advanced({ items, reload, toast }: { items: PublicStageSkill[]; reload: () => Promise<void>; toast: (message: string, error?: boolean) => void }) {
  const [stage, setStage] = useState<ActivityStage>('source');
  const input = useRef<HTMLInputElement>(null);
  const visible = useMemo(() => items.filter(item => item.stage === stage), [items, stage]);
  const upload = async (uploadFile: File) => { if (!uploadFile.name.toLowerCase().endsWith('.zip')) return toast('仅接受 ZIP 文件', true); const form = new FormData(); form.append('file', uploadFile); try { await api(`/api/skills?stage=${stage}`, { method: 'POST', body: form }); await reload(); toast('Skill 已校验并保存；不会执行上传内容'); } catch (error) { toast((error as Error).message, true); } };
  const toggle = async (skill: PublicStageSkill) => { try { await api(`/api/skills/${skill.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled: !skill.enabled }) }); await reload(); toast(skill.enabled ? 'Skill 已停用' : 'Skill 已启用'); } catch (error) { toast((error as Error).message, true); } };
  const remove = async (skill: PublicStageSkill) => { try { await api(`/api/skills/${skill.id}`, { method: 'DELETE' }); await reload(); toast('Skill 已删除'); } catch (error) { toast((error as Error).message, true); } };
  return <div className="page"><header><div><span className="eyebrow">ADVANCED SETTINGS</span><h1>高级配置 · Skill</h1><p>策划文档与 Demo 使用指定 Skill 的说明和参考资料生成，启停即时影响后续请求。其他上传 ZIP 保留存档，不执行其中脚本。</p></div><input hidden ref={input} type="file" accept=".zip,application/zip" onChange={event => event.target.files?.[0] && void upload(event.target.files[0])} /><button className="primary" onClick={() => input.current?.click()}>上传 ZIP</button></header>
    <div className="tabs">{stageList.map(item => <button key={item.id} className={stage === item.id ? 'active' : ''} onClick={() => setStage(item.id)}>{item.name}</button>)}</div>
    <div className="list">{visible.map(skill => <article key={skill.id}><div><b>{skill.name}</b><p>{skill.description}{skill.productId?' · '+skill.productId:''}{skill.activityType?' / '+skill.activityType:''}</p>{skill.content&&<details><summary>查看 / 编辑 Skill 正文</summary><form onSubmit={event=>{event.preventDefault();const content=new FormData(event.currentTarget).get('content');void api('/api/skills/'+skill.id,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({content})}).then(async()=>{await reload();toast('Skill 正文已保存，后续生成将使用新内容');}).catch(error=>toast(error.message,true));}}><textarea name="content" defaultValue={skill.content}/><button>保存 Skill 正文</button></form></details>}</div><span>{skill.appliedToGeneration ? '生成指导' : skill.builtIn ? '默认' : '存档'} · {skill.version ? skill.version + ' · ' : ''} {skill.enabled ? '已启用' : '已停用'}</span><button onClick={() => void toggle(skill)}>{skill.enabled ? '停用' : '启用'}</button>{skill.downloadable && <a href={`/api/skills/${skill.id}/download`}>下载</a>}<button disabled={skill.builtIn} onClick={() => void remove(skill)}>删除</button></article>)}</div>
  </div>;
}

createRoot(document.getElementById('root')!).render(<App />);
