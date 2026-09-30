import type { ActivityConfiguration } from './index.js';

// The sandboxed frame can only send events; the parent validates its source and payload.
export function attachConfigRuntime(html: string, config: ActivityConfiguration, sessionId: string, offline = false, storage?: { local: Record<string,string>; session: Record<string,string> }): string {
  const payload = JSON.stringify({ config, sessionId, storage }).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const script = `<script data-activity-studio-runtime>(()=>{const {config,sessionId,storage}=${payload};
if(!${offline}&&storage){
  const make=(kind,seed)=>{
    let values=Object.assign(Object.create(null),seed||{});
    const update=(next)=>{if(JSON.stringify(next).length>1048576)throw new DOMException('预览存档超过1MB','QuotaExceededError');values=next;parent.postMessage({channel:'activity-studio-storage',sessionId,kind,values},'*')};
    return {get length(){return Object.keys(values).length},key(i){return Object.keys(values)[Number(i)]??null},getItem(key){return Object.hasOwn(values,String(key))?values[String(key)]:null},setItem(key,value){update(Object.assign(Object.create(null),values,{[String(key)]:String(value)}))},removeItem(key){const next=Object.assign(Object.create(null),values);delete next[String(key)];update(next)},clear(){update(Object.create(null))}};
  };
  Object.defineProperty(window,'localStorage',{value:make('local',storage.local),configurable:true});
  Object.defineProperty(window,'sessionStorage',{value:make('session',storage.session),configurable:true});
}
const start=performance.now();window.ActivityStudio={config,tables:Object.fromEntries((config.tables||[{id:"main",fields:config.fields,rows:config.rows,pacing:config.pacing}]).map(table=>[table.id,table])),track(type,stepIndex){if(${offline})return;parent.postMessage({channel:'activity-studio',id:crypto.randomUUID(),sessionId,revision:config.revision,type,stepIndex,elapsedMs:Math.round(performance.now()-start)},'*')}};window.ActivityStudio.flushStorage=()=>{if(${offline}||!storage)return Promise.resolve();return new Promise((resolve,reject)=>{const requestId=crypto.randomUUID();const receive=e=>{if(e.source!==parent||e.data?.channel!=='activity-studio-storage-ack'||e.data.sessionId!==sessionId||e.data.requestId!==requestId)return;clearTimeout(timer);removeEventListener('message',receive);e.data.error?reject(new Error(e.data.error)):resolve()};const timer=setTimeout(()=>{removeEventListener('message',receive);reject(new Error('预览存档未收到保存确认'))},3000);addEventListener('message',receive);parent.postMessage({channel:'activity-studio-storage',sessionId,requestId,kind:'flush'},'*')})};window.ActivityStudio.track('session_start')})();</script>`;
  // Inject before application scripts, including scripts in <head>.
  return /<head\b[^>]*>/i.test(html) ? html.replace(/<head\b[^>]*>/i, match => match + script) : script + html;
}

export function configDrivenDemo(): string {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;background:#eff6f1;color:#143f31;font:15px system-ui}main{padding:26px 20px}small{color:#628473}h1{font-size:24px}article{background:white;padding:22px;border-radius:20px;margin:20px 0}button{width:100%;padding:14px;border:0;border-radius:12px;background:#176b55;color:white;font:inherit}progress{width:100%;accent-color:#176b55}dl{display:grid;grid-template-columns:1fr 1fr;gap:10px}dd{margin:0;text-align:right;overflow-wrap:anywhere}p{line-height:1.7}</style></head><body><main><small>配置驱动 · 核心流程试玩</small><h1 id="title"></h1><progress id="progress" value="0" max="100"></progress><article><p id="status"></p><dl id="fields"></dl><p id="balance"></p></article><button id="next">完成一次操作</button><p>数值来自已同步配置。预计时长用于节奏分析，不会强制等待。</p></main><script>
const sdk=window.ActivityStudio;
if(!sdk){document.getElementById('title').textContent='请先在配置表中心保存并同步配置';document.getElementById('next').disabled=true}else{
const {rows,fields,pacing}=sdk.config;let index=0,actions=0,cost=0,reward=0;
const numeric=(row,key,fallback=0)=>key&&typeof row[key]==='number'?row[key]:fallback;
function render(){const row=rows[index];document.getElementById('title').textContent=String(row[pacing.label]??('节点 '+(index+1)));document.getElementById('status').textContent='节点 '+(index+1)+' / '+rows.length+' · 已操作 '+actions+' / '+Math.max(1,numeric(row,pacing.actions,1));document.getElementById('fields').replaceChildren();fields.forEach(field=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=field.label;dd.textContent=String(row[field.key]??'');document.getElementById('fields').append(dt,dd)});document.getElementById('balance').textContent='累计消耗 '+cost+' · 累计奖励 '+reward}
sdk.track('step_enter',0);render();document.getElementById('next').onclick=()=>{const row=rows[index];actions++;if(actions>=Math.max(1,numeric(row,pacing.actions,1))){cost+=numeric(row,pacing.cost);reward+=numeric(row,pacing.reward);sdk.track('step_complete',index);document.getElementById('progress').value=(index+1)/rows.length*100;if(index===rows.length-1){sdk.track('session_complete');document.getElementById('status').textContent='流程完成';document.getElementById('balance').textContent='累计消耗 '+cost+' · 累计奖励 '+reward;document.getElementById('next').disabled=true;document.getElementById('next').textContent='已完成全部节点';return}index++;actions=0;sdk.track('step_enter',index)}render()};}
</script></body></html>`;
}

// Runs in the trusted host, never in the generated iframe. A frame can write only
// its own namespaced string records; it never gains same-origin or account access.
export function installDemoStorageHost(frame: HTMLIFrameElement, sessionId: string, key: string, onError?: (message:string)=>void) {
  const valid=(value:unknown):value is Record<string,string>=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.values(value).every(item=>typeof item==='string')&&JSON.stringify(value).length<=1048576;
  const read=(kind:'local'|'session'):Record<string,string>=>{try{const parsed=JSON.parse((kind==='local'?localStorage:sessionStorage).getItem(key)||'{}');return valid(parsed)?parsed:{};}catch{return {};}};
  const snapshot={local:read('local'),session:read('session')};
  let error='';
  const receive=(event:MessageEvent)=>{
    const data=event.data;
    if(event.source!==frame.contentWindow||data?.channel!=='activity-studio-storage'||data.sessionId!==sessionId)return;
    if(data.kind==='flush') {frame.contentWindow?.postMessage({channel:'activity-studio-storage-ack',sessionId,requestId:data.requestId,error},'*');return;}
    if(!['local','session'].includes(data.kind)||!valid(data.values))return;
    try{(data.kind==='local'?localStorage:sessionStorage).setItem(key,JSON.stringify(data.values));error='';}
    catch {error='浏览器未能保存预览存档，请检查浏览器存储空间或权限';onError?.(error);}
  };
  window.addEventListener('message',receive);
  return {snapshot,dispose:()=>window.removeEventListener('message',receive),clear:()=>{localStorage.removeItem(key);sessionStorage.removeItem(key);}};
}

export function demoStorageKey(activityId:string,content:string,revision=0):string {
  let hash=2166136261;for(let i=0;i<content.length;i++)hash=Math.imul(hash^content.charCodeAt(i),16777619);
  return 'activity-studio-demo:'+activityId+':'+revision+':'+content.length+':'+(hash>>>0).toString(16);
}

// The browser runner uses the same host bridge as the product UI, including a
// host-page reload. Storage is rehydrated before any generated script executes.
export function demoPreviewPage(html:string,config:ActivityConfiguration,sessionId:string):string {
  const input=JSON.stringify({html,config,sessionId}).replace(/</g,'\\u003c');
  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0"><iframe title="demo" sandbox="allow-scripts allow-forms" style="border:0;width:100vw;height:100vh"></iframe><script>(()=>{const {html,config,sessionId}=${input};const frame=document.querySelector('iframe');const install=${installDemoStorageHost.toString()};const attach=${attachConfigRuntime.toString().replace(/<\/script/gi,'<\\/script')};const host=install(frame,sessionId,'activity-studio-demo-validation');frame.srcdoc=attach(html,config,sessionId,false,host.snapshot);})();</script></body></html>`;
}
