import React, { useEffect, useRef, useState } from 'react';
import type { Activity, ActivityConfiguration, ConfigField, PacingMapping, PlayEvent } from '@ai-activity-studio/shared';
import { attachConfigRuntime, installDemoStorageHost, demoStorageKey } from '@ai-activity-studio/shared';
import { api } from './api';

type Toast = (message: string, error?: boolean) => void;
const mappingNames: Record<keyof PacingMapping, string> = { label: '节点名称', duration: '预计时长（秒）', actions: '操作次数', cost: '节点总消耗', reward: '节点总奖励' };
const blank: ActivityConfiguration = { fields: [{ key: 'name', label: '节点名称', type: 'string', required: true }], rows: [{ name: '' }], pacing: { label: 'name' }, revision: 0, updatedAt: '' };

export function DataCenter({ activities, dashboard, reload, onOpen, toast }: { activities: Activity[]; dashboard: boolean; reload: () => Promise<void>; onOpen: (activity: Activity) => void; toast: Toast }) {
  const [id, setId] = useState(activities[0]?.id ?? '');
  const activity = activities.find(a => a.id === id);
  useEffect(() => { if (!activities.some(a => a.id === id)) setId(activities[0]?.id ?? ''); }, [activities, id]);
  return <div className="page data-center"><header><div><span className="eyebrow">{dashboard ? 'PLAYER JOURNEY' : 'CONFIGURATION STUDIO'}</span><h1>{dashboard ? '游玩节奏看板' : '配置表中心'}</h1><p>{dashboard ? '从配置预测到实际试玩，观察每一步的耗时、操作与奖励。' : '策划文档 → 配置草稿 → 字段编辑与校验 → 同步 Demo'}</p></div><div className="data-actions"><button onClick={() => void reload()}>刷新数据</button>{activity && <button onClick={() => onOpen(activity)}>打开五阶段工作台</button>}</div></header>
    <label className="activity-picker">当前活动<select value={id} onChange={e => setId(e.target.value)}><option value="" disabled>选择活动</option>{activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
    {!activity ? <section className="data-panel">请先在活动项目中创建活动。</section> : dashboard ? <Dashboard activity={activity} /> : <ConfigurationEditor key={activity.id} activity={activity} reload={reload} toast={toast} />}
  </div>;
}

export function ConfigurationEditor({ activity, reload, toast, onDirtyChange }: { activity: Activity; reload: () => Promise<void>; toast: Toast; onDirtyChange?: (dirty:boolean)=>void }) {
  const asCollection = (config:ActivityConfiguration):ActivityConfiguration => config.tables ? config : {...config,primaryTableId:'main',tables:[{id:'main',name:'主流程表',fields:config.fields,rows:config.rows,pacing:config.pacing}]};
  const [collection,setDraft]=useState<ActivityConfiguration>(asCollection(structuredClone(activity.configuration??blank)));
  const [tableId,setTableId]=useState(activity.configuration?.primaryTableId??'main');
  const activeTable=collection.tables?.find(t=>t.id===tableId)??collection.tables?.[0];
  const draft:ActivityConfiguration={...collection,...activeTable};
  const [revision, setRevision] = useState(activity.configuration?.revision ?? 0);
  const [dirty, setDirty] = useState(false);
  useEffect(()=>{onDirtyChange?.(dirty);},[dirty,onDirtyChange]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const file = useRef<HTMLInputElement>(null);
  const base = `/api/activities/${activity.id}/configuration`;
  const mutate = (next:ActivityConfiguration) => { setDraft(current=>({...current,tables:current.tables?.map(t=>t.id===activeTable?.id?{id:t.id,name:t.name,fields:next.fields,rows:next.rows,pacing:next.pacing}:t)}));setDirty(true);setError(''); };
  const replaceCollection=(next:ActivityConfiguration & {warnings?:string[]})=>{const value=asCollection(next);setDraft(value);setTableId(value.primaryTableId??'main');setDirty(true);setError('');setWarnings(next.warnings??[]);};
  useEffect(() => { if (!dirty) { setDraft(asCollection(structuredClone(activity.configuration ?? blank))); setRevision(activity.configuration?.revision ?? 0); } }, [activity.configuration?.revision]);
  const action = async (fn: () => Promise<void>) => { setBusy(true); setError(''); try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  const save = async () => { const saved = await api<ActivityConfiguration>(base, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ configuration: collection, expectedRevision: revision }) }); setDraft(asCollection(saved)); setRevision(saved.revision); setDirty(false); await reload(); toast(`配置 v${saved.revision} 已校验保存`); };
  const sync = async () => { await api(base + '/sync', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expectedRevision: revision, createDemo: !activity.artifacts?.demo }) }); await reload(); toast('已同步配置，可开始试玩'); };
  const upload = async (selected: File) => { const form = new FormData(); form.append('file', selected); const next = await api<ActivityConfiguration>(base + '/import?table=' + encodeURIComponent(activeTable?.id??'main'), { method: 'POST', body: form }); if(next.tables)replaceCollection(next);else mutate(next); toast('上传校验通过，请检查草稿后保存'); };
  const fieldUpdate = (index: number, patch: Partial<ConfigField>) => mutate({ ...draft, fields: draft.fields.map((f, i) => i === index ? { ...f, ...patch } : f) });
  const sourceChanged = draft.sourceDocumentUpdatedAt && draft.sourceDocumentUpdatedAt !== activity.artifacts?.document?.updatedAt;
  return <>
    <section className="data-panel"><h2>当前活动的配置表组</h2><p>配置表是可选补充，可以直接确认策划并生成交互模型；未填写时自动提供默认配置，未知值标为待确认。填写后按版本同步并进入 Unity 交付包；主流程表用于节奏看板。</p><div className="tabs">{collection.tables?.map(table=><button key={table.id} className={activeTable?.id===table.id?'active':''} onClick={()=>setTableId(table.id)}>{table.name}</button>)}<button disabled={busy} onClick={()=>{let i=(collection.tables?.length??0)+1;while(collection.tables?.some(t=>t.id==='table_'+i))i++;const id='table_'+i;setDraft({...collection,tables:[...(collection.tables??[]),{id,name:'新配置表',fields:[{key:'id',label:'ID',type:'string',required:true}],rows:[{id:''}],pacing:{}}]});setTableId(id);setDirty(true);}}>＋ 新增表</button></div><div className="data-actions"><label>表名<input value={activeTable?.name??''} onChange={e=>{setDraft({...collection,tables:collection.tables?.map(t=>t.id===activeTable?.id?{...t,name:e.target.value}:t)});setDirty(true);}}/></label><span>表 ID：{activeTable?.id}</span><label>主流程表<select value={collection.primaryTableId} onChange={e=>{setDraft({...collection,primaryTableId:e.target.value});setDirty(true);}}>{collection.tables?.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select></label><button disabled={busy||(collection.tables?.length??0)<2} onClick={()=>{const tables=collection.tables!.filter(t=>t.id!==activeTable?.id);setDraft({...collection,tables,primaryTableId:collection.primaryTableId===activeTable?.id?tables[0]!.id:collection.primaryTableId});setTableId(tables[0]!.id);setDirty(true);}}>从草稿移除此表</button></div></section>
    <section className="data-panel"><div className="panel-heading"><div><h2>配置草稿</h2><p>已保存 v{activity.configuration?.revision ?? 0} · Demo {activity.demoConfigRevision ? `使用 v${activity.demoConfigRevision}` : '尚未同步'}{dirty ? ' · 有未保存修改' : ''}</p></div><span className="pill ready">{draft.rows.length} 行 / {draft.fields.length} 个字段</span></div>
      {sourceChanged && <p className="data-warning">策划文档已更新，当前配置来自旧版文档，请核对后重新提取。</p>}
      <div className="data-actions"><button disabled={busy || !activity.artifacts?.document || dirty} onClick={() => void action(async () => { replaceCollection(await api<ActivityConfiguration>(base + '/generate', { method: 'POST' })); toast('已提取多表草稿，请逐表核对用途、字段和数值'); })}>读取文档表格</button><button disabled={busy || !activity.artifacts?.document || dirty} onClick={() => void action(async () => { replaceCollection(await api<ActivityConfiguration>(base + '/generate?mode=ai', { method: 'POST' })); toast('AI 配置建议已生成，请核对字段和数值后保存'); })}>AI 提取图文与配置建议</button><button disabled={busy || dirty} onClick={() => file.current?.click()}>上传 XLSX / CSV / JSON</button><input hidden type="file" ref={file} accept=".xlsx,.csv,.json" onChange={e => { const selected = e.target.files?.[0]; e.target.value = ''; if (selected) void action(() => upload(selected)); }} />
        <button className="primary" disabled={busy || !dirty} onClick={() => void action(save)}>校验并保存</button><button disabled={busy || dirty || !revision || !activity.artifacts?.demo || !activity.approvals?.document} onClick={() => void action(sync)}>整组同步到 Demo</button>{dirty && <button disabled={busy} onClick={() => { setDraft(asCollection(structuredClone(activity.configuration ?? blank))); setRevision(activity.configuration?.revision ?? 0); setDirty(false); setError(''); }}>撤销草稿修改</button>}
        {activity.configuration && <><a href={base + '?format=csv&table=' + encodeURIComponent(activeTable?.id??'main')}>下载当前表 CSV</a><a href={base + '?format=xlsx'}>下载全部表 XLSX</a><a href={base + '?format=json'}>下载全部表 JSON</a></>}
      </div>
      {busy && <p role="status">正在处理，请稍候…</p>}{error && <p role="alert" className="data-error">{error}</p>}{warnings.map((warning,index)=><p role="status" className="data-warning" key={index}>{warning}</p>)}
      <p className="data-note">XLSX 的每张工作表对应一张配置表，上传后替换整组草稿；CSV 替换当前表，JSON 可导入整组。XLSX 支持单行字段名，或中文说明 / 字段名 / 类型三行表头。保存后需要重新确认策划，再同步整组配置。未生成 Demo 时请按顺序进入第三步。CSV 请使用 UTF-8 编码，JSON 保留完整字段定义。读取文档表格仅提取正文中明确的字段与数据；图片表格或配置建议请使用 AI 提取。只有字段定义的表可以保持空行，不阻塞交互模型生成；默认值生成后可核对调整。</p>
      <details><summary>字段定义 · 名称、类型与必填规则</summary><div className="table-scroll"><table><thead><tr><th>字段名</th><th>显示名称</th><th>类型</th><th>必填</th><th>说明</th><th>操作</th></tr></thead><tbody>{draft.fields.map((field, i) => <tr key={i}><td><input aria-label={`字段名 ${i + 1}`} value={field.key} disabled={busy} onChange={e => { const key = e.target.value; mutate({ ...draft, fields: draft.fields.map((f, n) => n === i ? { ...f, key } : f), rows: draft.rows.map(row => { const next = { ...row }; delete next[field.key]; if (key) next[key] = row[field.key] ?? ''; return next; }), pacing: Object.fromEntries(Object.entries(draft.pacing).map(([role, old]) => [role, old === field.key ? key : old])) }); }} /></td><td><input aria-label={`显示名称 ${i + 1}`} disabled={busy} value={field.label} onChange={e => fieldUpdate(i, { label: e.target.value })} /></td><td><select aria-label={`字段类型 ${i + 1}`} disabled={busy} value={field.type} onChange={e => fieldUpdate(i, { type: e.target.value as ConfigField['type'] })}><option value="string">文本</option><option value="number">数值</option><option value="boolean">布尔</option></select></td><td><input aria-label={`必填 ${i + 1}`} disabled={busy} type="checkbox" checked={field.required} onChange={e => fieldUpdate(i, { required: e.target.checked })} /></td><td><input aria-label={`字段说明 ${i + 1}`} disabled={busy} value={field.description ?? ''} onChange={e => fieldUpdate(i, { description: e.target.value })} /></td><td><button disabled={busy || draft.fields.length === 1} onClick={() => mutate({ ...draft, fields: draft.fields.filter((_, n) => n !== i), rows: draft.rows.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => key !== field.key))), pacing: Object.fromEntries(Object.entries(draft.pacing).filter(([, key]) => key !== field.key)) })}>移除字段</button></td></tr>)}</tbody></table></div><button disabled={busy} onClick={() => { let n = draft.fields.length + 1; while (draft.fields.some(f => f.key === `field_${n}`)) n++; mutate({ ...draft, fields: [...draft.fields, { key: `field_${n}`, label: '新字段', type: 'string', required: false }] }); }}>＋ 添加字段</button></details>
      <div className="table-scroll config-grid"><table><thead><tr><th>#</th>{draft.fields.map((field, index) => <th key={index}>{field.label}<small>{field.key} · {field.type}{field.required ? ' · 必填' : ''}</small></th>)}<th>操作</th></tr></thead><tbody>{draft.rows.map((row, i) => <tr key={i}><td>{i + 1}</td>{draft.fields.map((field, index) => <td key={index}>{field.type === 'boolean' ? <select disabled={busy} aria-label={`第 ${i + 1} 行 ${field.label}`} value={String(row[field.key] ?? '')} onChange={e => mutate({ ...draft, rows: draft.rows.map((r, n) => n === i ? { ...r, [field.key]: e.target.value === '' ? '' : e.target.value === 'true' } : r) })}><option value="">未填</option><option value="true">是</option><option value="false">否</option></select> : <input disabled={busy} aria-label={`第 ${i + 1} 行 ${field.label}`} type={field.type === 'number' ? 'number' : 'text'} step="any" value={String(row[field.key] ?? '')} onChange={e => mutate({ ...draft, rows: draft.rows.map((r, n) => n === i ? { ...r, [field.key]: field.type === 'number' && e.target.value !== '' ? Number(e.target.value) : e.target.value } : r) })} />}</td>)}<td><button disabled={busy || draft.rows.length === 1} onClick={() => mutate({ ...draft, rows: draft.rows.filter((_, n) => n !== i) })}>移除</button></td></tr>)}</tbody></table></div><button disabled={busy} onClick={() => mutate({ ...draft, rows: [...draft.rows, {}] })}>＋ 添加节点行</button>
      <h3>节奏字段映射</h3><p className="data-note">每行对应一个顺序节点。时长按秒统计；消耗与奖励是该节点总量，需要使用同一计量单位。缺少映射时看板显示“未配置”。</p><div className="mapping-grid">{Object.entries(mappingNames).map(([role, label]) => <label key={role}>{label}<select disabled={busy} value={draft.pacing[role as keyof PacingMapping] ?? ''} onChange={e => mutate({ ...draft, pacing: { ...draft.pacing, [role]: e.target.value || undefined } })}><option value="">未配置</option>{draft.fields.filter(f => role === 'label' || f.type === 'number').map((f, i) => <option value={f.key} key={i}>{f.label}</option>)}</select></label>)}</div>
    </section>
    <section className="data-panel"><div className="panel-heading"><div><h2>同步预览与试玩</h2><p>保存后再同步。每次载入为一次匿名试玩会话；实际操作会进入数据看板。</p></div></div>{activity.demoConfiguration && activity.artifacts?.demo ? <DemoFrame content={activity.artifacts.demo.content} configuration={activity.demoConfiguration} activityId={activity.id} /> : <p className="empty-inline">尚无已同步的配置 Demo。</p>}</section>
  </>;
}

export function DemoFrame({ content, configuration, activityId, recordEvents = true }: { content: string; configuration?: ActivityConfiguration; activityId: string; recordEvents?: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [scale, setScale] = useState(0.7);
  const [runtimeErrors, setRuntimeErrors] = useState<string[]>([]);
  const [runtimeReady, setRuntimeReady] = useState(false);
  useEffect(() => {
    const target = canvas.current; if (!target) return;
    const observer = new ResizeObserver(([entry]) => { if (entry) setScale(Math.max(0.1, Math.min(entry.contentRect.width / 414, entry.contentRect.height / 880, 1.5))); });
    observer.observe(target); return () => observer.disconnect();
  }, []);
  useEffect(() => { if (!expanded) return; const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [expanded]);

  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const storageHost=useRef<ReturnType<typeof installDemoStorageHost>|null>(null);
  const storageKey=React.useMemo(()=>demoStorageKey(activityId,content,configuration?.revision),[activityId,content,configuration?.revision]);
  const session = React.useMemo(() => crypto.randomUUID(), [content, configuration?.revision, retry]);
  const html = React.useMemo(() => {
    const page = content;
    const probe = `<script>(()=>{const send=(error)=>parent.postMessage({channel:'demo-runtime-check',session:${JSON.stringify(session)},error},'*');addEventListener('error',e=>send(e.message||'资源加载失败'));addEventListener('unhandledrejection',e=>send(String(e.reason?.message||e.reason||'未处理的运行错误')));addEventListener('load',()=>send(''));})();</script>`;
    return /<head\b[^>]*>/i.test(page) ? page.replace(/<head\b[^>]*>/i, match=>match+probe) : probe+page;
  }, [content, configuration, session]);
  useEffect(() => {
    setRuntimeErrors([]); setRuntimeReady(false);
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.data?.channel !== 'demo-runtime-check' || event.data?.session !== session) return;
      if (event.data.error === '') setRuntimeReady(true);
      else if (typeof event.data.error === 'string') setRuntimeErrors(old=>[...new Set([...old,event.data.error.slice(0,500)])].slice(0,8));
    };
    window.addEventListener('message', receive); return ()=>window.removeEventListener('message', receive);
  }, [session]);
  useEffect(() => {
    setError(''); if(!recordEvents)return; let queue = Promise.resolve(); let stopped = false;
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.data?.channel !== 'activity-studio' || event.data.sessionId !== session || event.data.revision !== configuration?.revision) return;
      const { id, sessionId, revision, type, stepIndex, elapsedMs } = event.data;
      queue = queue.then(async () => { if (stopped) return; try { await api(`/api/activities/${activityId}/play-events`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, sessionId, revision, type, stepIndex, elapsedMs }) }); } catch (e) { stopped = true; setError((e as Error).message); } });
    };
    window.addEventListener('message', receive); return () => window.removeEventListener('message', receive);
  }, [session, activityId, configuration?.revision, recordEvents]);
  useEffect(()=>{
    const element=frame.current;if(!element)return;
    const host=installDemoStorageHost(element,session,storageKey,message=>setRuntimeErrors(old=>[...new Set([...old,message])]));
    storageHost.current=host;
    element.srcdoc=configuration?attachConfigRuntime(html,configuration,session,false,host.snapshot):html;
    return ()=>{host.dispose();storageHost.current=null;};
  },[html,configuration,session,storageKey]);
  return <div className={`demo-session ${expanded ? 'is-expanded' : ''}`} role={expanded ? 'dialog' : undefined} aria-modal={expanded || undefined} aria-label={expanded ? '放大 Demo 预览' : undefined}>
    <div className="data-actions demo-toolbar"><span>390 × 844 · 竖屏{configuration ? ` · 配置 v${configuration.revision}` : ''}</span>{configuration && <button onClick={() => {try{storageHost.current?.clear();setRetry(n=>n+1);}catch{setError('无法清除本次试玩存档');}}}>重新试玩</button>}<button onClick={() => setExpanded(value => !value)}>{expanded ? '退出放大' : '放大预览'}</button></div>
    {error && <p role="alert" className="data-error">试玩记录未保存：{error}</p>}
    {runtimeErrors.length ? <p role="alert" className="data-error">Demo 运行错误：{runtimeErrors.join('；')}。请修正后再确认交付。</p> : <small className="data-note">{runtimeReady ? '页面已加载，当前未捕获脚本错误；仍需逐项试玩。' : '正在检查页面加载…'}</small>}
    <div className="phone-wrap" ref={canvas}><div className="phone-size" style={{ width: 414 * scale, height: 880 * scale }}><div className="phone" style={{ transform: `scale(${scale})` }}><div className="speaker" /><iframe ref={frame} key={session} sandbox="allow-scripts allow-forms" title="交互 Demo" /></div></div></div>
  </div>;
}

function Dashboard({ activity }: { activity: Activity }) {
  const config = activity.configuration;
  const [tab, setTab] = useState<'forecast' | 'observed'>('forecast');
  if (!config) return <section className="data-panel">请先在配置表中心生成并保存配置。</section>;
  const number = (index: number, role: keyof PacingMapping): number | undefined => { const key = config.pacing[role]; const value = key ? config.rows[index]?.[key] : undefined; return typeof value === 'number' ? value : undefined; };
  const label = (index: number) => String(config.rows[index]?.[config.pacing.label ?? ''] ?? `节点 ${index + 1}`);
  const sum = (role: keyof PacingMapping) => config.pacing[role] ? config.rows.reduce((total, _, i) => total + (number(i, role) ?? 0), 0) : undefined;
  const format = (value?: number, suffix = '') => value === undefined ? '未配置' : `${Math.round(value * 100) / 100}${suffix}`;
  const events = (activity.playEvents ?? []).filter(e => e.revision === config.revision);
  const sessions = new Set(events.filter(e => e.type === 'session_start').map(e => e.sessionId)).size;
  const completed = events.filter(e => e.type === 'session_complete');
  const maxDuration = Math.max(1, ...config.rows.map((_, i) => number(i, 'duration') ?? 0));
  const rowEvents = (index: number, type: PlayEvent['type']) => events.filter(e => e.stepIndex === index && e.type === type);
  let cumulative = 0;
  return <><div className="tabs"><button className={tab === 'forecast' ? 'active' : ''} onClick={() => setTab('forecast')}>配置预测</button><button className={tab === 'observed' ? 'active' : ''} onClick={() => setTab('observed')}>实际试玩</button></div>
    <section className="data-panel"><div className="panel-heading"><div><h2>{tab === 'forecast' ? '整体游玩节奏' : '试玩完成与节点耗时'}</h2><p>当前配置 v{config.revision} · {tab === 'forecast' ? '预测数据：按顺序累计，不代表真实玩家行为' : '仅统计当前版本在平台内的匿名 Demo 试玩，会话数不等于独立玩家数'}</p></div><span className="pill ready">{tab === 'forecast' ? '配置推算' : '实际采集'}</span></div>
    <div className="metric-grid">{(tab === 'forecast' ? [['节点数', config.rows.length], ['预计总时长', format(sum('duration'), ' 秒')], ['总操作数', format(sum('actions'))], ['总消耗 / 总奖励', `${format(sum('cost'))} / ${format(sum('reward'))}`]] : [['试玩会话', sessions], ['完成会话', completed.length], ['完成率', sessions ? `${Math.round(completed.length / sessions * 100)}%` : '暂无数据'], ['平均完成耗时', completed.length ? `${Math.round(completed.reduce((n, e) => n + e.elapsedMs, 0) / completed.length / 1000)} 秒` : '暂无数据']]).map(([name, value]) => <div key={name}><strong>{value}</strong><span>{name}</span></div>)}</div>
    {tab === 'observed' && !sessions && <p className="data-warning">暂无当前版本试玩记录。请先同步配置并在平台内操作 Demo，然后刷新数据。</p>}
    <div className="journey-chart">{config.rows.map((_, index) => { const duration = number(index, 'duration'); cumulative += duration ?? 0; const entered = new Set(rowEvents(index, 'step_enter').map(e => e.sessionId)).size; const done = rowEvents(index, 'step_complete'); const times = done.map(e => e.elapsedMs - (events.find(start => start.sessionId === e.sessionId && start.type === 'step_enter' && start.stepIndex === index)?.elapsedMs ?? e.elapsedMs)); const average = times.length ? times.reduce((a, b) => a + b, 0) / times.length / 1000 : undefined; return <div className="journey-node" key={index}><b className="node-number">{index + 1}</b><div><h3>{label(index)}</h3><div className="journey-track"><i style={{ width: `${tab === 'forecast' ? (duration ?? 0) / maxDuration * 100 : sessions ? entered / sessions * 100 : 0}%` }} /></div><p>{tab === 'forecast' ? `预计 ${format(duration, ' 秒')} · 累计 ${config.pacing.duration ? format(cumulative, ' 秒') : '未配置'} · 操作 ${format(number(index, 'actions'))}` : `进入 ${entered} 次 · 完成 ${done.length} 次 · 平均节点耗时 ${average === undefined ? '暂无数据' : format(average, ' 秒')}`}</p></div><span>{tab === 'forecast' ? `消耗 ${format(number(index, 'cost'))} / 奖励 ${format(number(index, 'reward'))}` : sessions ? `到达率 ${Math.round(entered / sessions * 100)}%` : '暂无数据'}</span></div>; })}</div>
    <p className="data-note">{tab === 'forecast' ? '横条按节点预计时长比较。当前按顺序节点分析；分支、并行路径、资源回复和付费行为尚未建模。' : '未完成会话可能仍在进行，不能直接视为流失。耗时包含页面停留；下载到本地的独立 Demo 不会回传记录。'}</p></section>
    {tab === 'observed' && sessions > 0 && <section className="data-panel"><h2>最近试玩路径（当前版本）</h2>{events.filter(e => e.type === 'session_start').slice(-8).reverse().map(start => { const path = events.filter(e => e.sessionId === start.sessionId); return <div className="session-row" key={start.id}><b>{new Date(start.at).toLocaleString()}</b><span>{path.filter(e => e.type === 'step_enter').map(e => label(e.stepIndex!)).join(' → ') || '尚未进入节点'}</span><small>{path.some(e => e.type === 'session_complete') ? '已完成' : '未完成 / 进行中'}</small></div>; })}</section>}
  </>;
}
