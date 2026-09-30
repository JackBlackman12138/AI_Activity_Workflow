import { activityImages, resolveActivityImages } from '@ai-activity-studio/shared';
import React, { useEffect, useState } from 'react';
import { PIPELINE, stageConfirmed, type Activity, type ProductProfile } from '@ai-activity-studio/shared';
import { api } from './api';
import { SourcePreview } from './source-preview';
import { DemoFrame } from './data-center';
type Toast = (message: string, error?: boolean) => void;

export function ProductSkills({ products, reload, toast }: { products: ProductProfile[]; reload: ()=>Promise<void>; toast: Toast }) {
  const [productId,setProductId]=useState('mc'), [type,setType]=useState(''), [stage,setStage]=useState('document');
  const [name,setName]=useState(''),[content,setContent]=useState(''),[busy,setBusy]=useState(false);
  const [catalogName,setCatalogName]=useState(''),[catalogId,setCatalogId]=useState('');
  const run=async(fn:()=>Promise<void>)=>{setBusy(true);try{await fn();await reload();toast('已保存');}catch(e){toast((e as Error).message,true);}finally{setBusy(false);}};
  const saveCatalog=(newProduct:boolean)=>run(async()=>{
    const next=newProduct?[...products,{id:catalogId,name:catalogName,activityTypes:[{id:'general',name:'通用活动'}]}]:products.map(p=>p.id===productId?{...p,activityTypes:[...p.activityTypes,{id:catalogId,name:catalogName}]}:p);
    await api('/api/products',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(next)});setCatalogName('');setCatalogId('');
  });
  return <section className="page product-skills"><span className="eyebrow">PRODUCT KNOWLEDGE</span><h1>产品与活动类型框架</h1><p>管理新建活动的分类，并为指定产品、类型和阶段配置通用 Skill。当前活动要求优先，参考稿只提供结构和同类写法。</p><label>产品<select value={productId} onChange={e=>{setProductId(e.target.value);setType('');}}>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <details><summary>添加产品 / 活动类型</summary><div className="data-actions"><input placeholder="标识，如 energy-map" value={catalogId} onChange={e=>setCatalogId(e.target.value)}/><input placeholder="显示名称，如体力清图" value={catalogName} onChange={e=>setCatalogName(e.target.value)}/><button disabled={busy||!catalogId||!catalogName} onClick={()=>void saveCatalog(false)}>添加到当前产品的活动类型</button><button disabled={busy||!catalogId||!catalogName} onClick={()=>void saveCatalog(true)}>作为新产品添加</button></div></details>
    <details><summary>新增通用模板 Skill</summary><div className="skill-form"><label>名称<input value={name} onChange={e=>setName(e.target.value)} placeholder="如 MC 独立合成线策划框架"/></label><label>适用活动类型<select value={type} onChange={e=>setType(e.target.value)}><option value="">当前产品所有类型</option>{products.find(p=>p.id===productId)?.activityTypes.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>适用阶段<select value={stage} onChange={e=>setStage(e.target.value)}>{PIPELINE.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label><label>导入 SKILL.md / 模板说明<input type="file" accept=".md,.txt" onChange={e=>{const file=e.target.files?.[0];if(file)void file.text().then(text=>{setContent(text);if(!name)setName(file.name);});}}/></label><label>Skill 正文 / 参考框架<textarea value={content} onChange={e=>setContent(e.target.value)} placeholder="填写章节框架、同类模块写法、产品约束。UE 模板可填写 Figma 模板链接及使用约定。"/></label><button className="primary" disabled={busy||!name.trim()||!content.trim()} onClick={()=>void run(async()=>{await api('/api/template-skills',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name,content,stage,productId,activityType:type})});setName('');setContent('');})}>保存为生成 Skill</button></div></details>
  </section>;
}

export function FigmaPanel({ activity, reload, toast }: { activity: Activity; reload: ()=>Promise<unknown>; toast: Toast }) {
  const [status,setStatus]=useState<{figma:{connectUrl:string|null;message:string;canGenerate:boolean}}>();
  const [url,setUrl]=useState(activity.figmaUrl??'');
  useEffect(()=>{void api<typeof status>('/api/integrations').then(setStatus).catch(e=>toast(e.message,true));},[]);
  return <details className="figma-panel"><summary>Figma 共创与产品 UE 模板</summary><p>{status?.figma.message??'正在读取连接状态…'}</p><div className="data-actions">{status?.figma.connectUrl?<a href={status.figma.connectUrl} target="_blank" rel="noreferrer">关联 Figma 账号</a>:<button disabled>关联 Figma 账号 · 待配置</button>}<button disabled>生成全部界面到 Figma · 待接入执行器</button></div><label>活动 Figma 文件链接<input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://www.figma.com/design/…"/></label><button disabled={!url} onClick={()=>void api(`/api/activities/${activity.id}/figma`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({url})}).then(async()=>{await reload();toast('Figma 文件链接已保存');}).catch(e=>toast(e.message,true))}>保存共创链接</button>{activity.figmaUrl&&<a href={activity.figmaUrl} target="_blank" rel="noreferrer">打开当前 Figma 文件 ↗</a>}<small>产品 UE 模板在高级配置中选择对应产品与“UE 联调 Demo”阶段维护。</small></details>;
}

export function Review({ activity }: { activity?: Activity }) {
  const [tab,setTab]=useState<'demo'|'document'>('demo');
  if(!activity)return <main className="page"><h1>活动评审</h1><p>正在加载活动；若持续未显示，请检查链接中的活动是否存在。</p><a href="/">返回平台</a></main>;
  const artifact=activity.artifacts?.['ue-demo']??activity.artifacts?.demo;
  return <main className="page review-page"><header><div><span className="eyebrow">ACTIVITY REVIEW</span><h1>{activity.name}</h1><p>只读评审 · 展示当前最新保存版本 · {new Date(activity.updatedAt).toLocaleString()}</p></div><a href="/">返回平台</a></header><p className="data-note">可复制浏览器地址分享。localhost 链接仅本机可用；公司部署后使用内网域名和飞书访问权限。当前本地模式未启用身份认证。</p><p>{stageConfirmed(activity,artifact?.stage??'demo')?'当前展示版本已确认':'当前展示版本待核对确认'}</p><div className="tabs"><button onClick={()=>setTab('demo')}>试玩 Demo</button><button onClick={()=>setTab('document')}>查看策划</button></div>{tab==='demo'?(artifact?<DemoFrame content={resolveActivityImages(artifact.content,activity)} configuration={activity.demoConfiguration} activityId={activity.id}/>:<p>尚无 Demo</p>):<SourcePreview content={activity.artifacts?.document?.content??'尚无策划文档'} images={activityImages(activity)}/>}</main>;
}
