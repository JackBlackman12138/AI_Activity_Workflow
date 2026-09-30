import {readFile,writeFile} from 'node:fs/promises';
import {buildDemoProject} from './project-builder.mjs';
const root=new URL('../',import.meta.url);
const paths=JSON.parse(await readFile(new URL('project-files.json',root),'utf8'));
const files=Object.fromEntries(await Promise.all(paths.map(async path=>[path,await readFile(new URL('project/'+path,root),'utf8')])));
const html=await buildDemoProject({files,tests:[]});
await writeFile(new URL('src/demo.html',root),html);
await writeFile(new URL('index.html',root),html.replace(/<head\b[^>]*>/i,head=>head+'<script src="./config/runtime.js"></script>'));
const config=JSON.parse(await readFile(new URL('configuration.json',root),'utf8'));
const attachConfigRuntime=function attachConfigRuntime(html, config, sessionId, offline = false, storage) {
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
};
await writeFile(new URL('standalone.html',root),attachConfigRuntime(html,config,'offline',true));
console.log('原始工程已重新构建，index.html 与 standalone.html 已更新');
