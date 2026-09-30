import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { installDemoStorageHost } from '@ai-activity-studio/shared';
import assert from 'node:assert/strict';
import { readProject, patchProject, buildDemoProject } from './demo-project.js';
import { validateDemoBrowser, scenarioIssues } from './demo-browser.js';
import { validateConfiguration } from './configuration.js';
const config=validateConfiguration({tables:[{id:'main',name:'主流程',fields:[{key:'label',label:'名称',type:'string'}],rows:[{label:'完成'}],pacing:{}}],primaryTableId:'main'});
const project=readProject(JSON.stringify({files:{'index.html':'<!doctype html><html><head><link rel="stylesheet" href="./style.css"></head><body><button id="go">开始</button><p id="result"></p><script type="module" src="./src/app.ts"></script></body></html>','style.css':'body{margin:0}button{min-height:44px}', 'src/app.ts':'import {text} from "./state"; const sdk=(window as any).ActivityStudio;document.querySelector("#go")!.addEventListener("click",()=>{document.querySelector("#result")!.textContent=text+sdk.tables.main.rows[0].label;});','src/state.ts':'export const text: string = "已";'},tests:[{id:'flow',name:'读取配置并完成操作',requirements:['R1'],steps:[{action:'click',selector:'#go'},{action:'expectText',selector:'#result',value:'已完成'}]}]}));

test('内联 module 入口编译依赖后注入 SDK，平台与离线均可真实操作',async()=>{
  const inline=structuredClone(project);
  inline.files['index.html']=inline.files['index.html']!.replace('<script type="module" src="./src/app.ts"></script>','<script type = "module">import "./src/app.ts";</script>');
  const html=await buildDemoProject(inline);
  assert.doesNotMatch(html,/<script[^>]*type\s*=\s*["']module/);
  const result=await validateDemoBrowser(html,config,inline.tests,new AbortController().signal);
  assert.equal(result.passed,true,result.errors.join('；'));
  inline.files['index.html']=inline.files['index.html']!.replace('./src/app.ts','./missing.js');
  await assert.rejects(buildDemoProject(inline),/缺少工程文件/);
});

test('多文件 TS 工程真实编译，平台沙箱及离线页面执行相同配置测试',async()=>{
  const html=await buildDemoProject(project);
  assert.ok(!html.includes('src="./'));assert.ok(html.includes('<style>'));assert.ok(html.includes('已'));
  const result=await validateDemoBrowser(html,config,project.tests,new AbortController().signal);
  assert.equal(result.passed,true,JSON.stringify(result.errors));assert.equal(result.tests.length,4);assert.ok(result.screenshots?.length);
});
test('真实浏览器阻止运行错误、外网依赖和错误断言通过',async()=>{
  const html=await buildDemoProject(project);
  const wrong=structuredClone(project.tests);wrong[0]!.steps[1]!.value='不可能的结果';
  const result=await validateDemoBrowser(html.replace('</body>','<script>throw new Error("真实运行异常")</script><img src="https://outside.invalid/tracker"></body>'),config,wrong,new AbortController().signal);
  assert.equal(result.passed,false);assert.match(result.errors.join('\n'),/真实运行异常/);assert.match(result.errors.join('\n'),/网络依赖/);assert.match(result.errors.join('\n'),/未出现预期文本/);
});
test('聊天局部修改保留原文件和所有测试，拒绝整页替换与削弱测试',()=>{
  const next=patchProject(project,JSON.stringify({edits:[{path:'style.css',find:'min-height:44px',replace:'min-height:48px'}],files:[{path:'docs/notes.md',content:'变更说明'}]}));
  assert.equal(next.files['src/app.ts'],project.files['src/app.ts']);assert.deepEqual(next.tests,project.tests);assert.equal(next.files['docs/notes.md'],'变更说明');
  assert.throws(()=>patchProject(project,JSON.stringify({edits:[{path:'index.html',find:project.files['index.html'],replace:'<html>缩水</html>'}]})),/整份文件/);
  assert.throws(()=>patchProject(project,JSON.stringify({files:[{path:'index.html',content:'覆盖'}]})),/局部修改/);
  assert.throws(()=>patchProject(project,JSON.stringify({tests:[{...project.tests[0],steps:[{action:'expectVisible',selector:'body'}]}]})),/回归测试/);
  assert.deepEqual(scenarioIssues(project.tests,['R1']),[]);assert.equal(scenarioIssues([],['R1']).length,1);
});
test('工程编译拒绝宿主路径、外部包和未提供文件',async()=>{
  assert.throws(()=>readProject(JSON.stringify({files:{'index.html':'x','../secret':'x'}})),/路径/);
  for(const request of ['../../secret','node:fs','react','./missing']) {
    const bad=structuredClone(project);bad.files['src/app.ts']=`import x from '${request}'; console.log(x);`;
    await assert.rejects(buildDemoProject(bad));
  }
});

test('允许补齐独立测试的前置操作，但保留每条原始动作和断言',()=>{
  const original=structuredClone(project.tests[0]!);
  const setup=[{action:'click',selector:'#entry'},{action:'click',selector:'#start'}];
  const next=patchProject(project,JSON.stringify({testSetups:[{id:original.id,steps:setup}]}));
  assert.deepEqual(next.tests[0]!.steps.slice(2),original.steps);
  assert.deepEqual(next.tests[0]!.requirements,original.requirements);
  assert.deepEqual(project.tests[0],original);
  assert.throws(()=>patchProject(project,JSON.stringify({testSetups:[{id:original.id,steps:[{action:'expectVisible',selector:'body'}]}]})),/真实操作/);
  assert.throws(()=>patchProject(project,JSON.stringify({testSetups:[{id:'missing',steps:setup}]})),/唯一已有场景/);
});

test('修正测试定位器保留动作、期望值和次数，拒绝越界及重复步骤',()=>{
  const next=patchProject(project,JSON.stringify({testSelectors:[{id:'flow',step:1,selector:'main #result'}]}));
  assert.deepEqual(next.tests[0]!.steps[1],{...project.tests[0]!.steps[1],selector:'main #result'});
  assert.equal(project.tests[0]!.steps[1]!.selector,'#result');
  assert.deepEqual(next.tests[0]!.steps[0],project.tests[0]!.steps[0]);
  for(const changes of [[{id:'flow',step:99,selector:'#x'}],[{id:'flow',step:1,selector:''}],[{id:'flow',step:1,selector:'#x'},{id:'flow',step:1,selector:'#y'}]])assert.throws(()=>patchProject(project,JSON.stringify({testSelectors:changes})),/唯一已有步骤/);
});

test('错误测试按策划修订保留前后证据，不能减少断言或需求覆盖',()=>{
  const revised={...project.tests[0]!,steps:[{action:'click',selector:'#eligibility'},{action:'expectCount',selector:'#go',count:0}]};
  const next=patchProject(project,JSON.stringify({testRevisions:[{reason:'策划入口资格：不满足时隐藏入口；原测试错误地要求点击入口。',test:revised}]}));
  assert.deepEqual(next.tests[0],revised);
  const record=JSON.parse(next.files['docs/test-revision-1.json']!);
  assert.deepEqual(record.previous,project.tests[0]);assert.deepEqual(record.revised,revised);
  for(const changed of [{...revised,requirements:[]},{...revised,steps:[{action:'click',selector:'#go'}]},{...revised,steps:[{action:'expectVisible',selector:'body'}]}])assert.throws(()=>patchProject(project,JSON.stringify({testRevisions:[{reason:'fix',test:changed}]})),/不能减少/);
  assert.throws(()=>patchProject(project,JSON.stringify({testRevisions:[{reason:'',test:revised}]})),/具体原因/);
});

test('打包源码中的美元替换表达式保持原文，不被当作 HTML 替换指令',async()=>{
  const sample=structuredClone(project);
  sample.files['src/app.ts']='window.marker="x".replace(/x/,"$&")+"$$";';
  const html=await buildDemoProject(sample);
  const context:{window:Record<string,string>}={window:{}};
  for(const [,script] of html.matchAll(/<script>([\s\S]*?)<\/script>/g))runInNewContext(script!,context);
  assert.equal(context.window.marker,'x$$');
});

test('样式内嵌 SVG 数据无需网络或宿主文件即可编译',async()=>{
  const sample=structuredClone(project);sample.files['style.css']+=' body{background-image:url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E")}';
  assert.match(await buildDemoProject(sample),/data:image/);
});

test('平台预览存档跨整页刷新保留，清除后恢复初始值',async()=>{
  const html=`<html><head></head><body><button id="spend">抽取</button><button id="reset">清除</button><p id="tickets"></p><script>
const sdk=window.ActivityStudio;let count=Number(localStorage.getItem('tickets')??10);let visits=Number(sessionStorage.getItem('visits')??0);
function render(){document.querySelector('#tickets').textContent=count+' / '+visits;}
document.querySelector('#spend').onclick=()=>{count--;visits++;localStorage.setItem('tickets',count);sessionStorage.setItem('visits',visits);render()};
document.querySelector('#reset').onclick=()=>{localStorage.clear();sessionStorage.clear();count=10;visits=0;render()};render();</script></body></html>`;
  const tests:any=[{id:'storage',name:'抽取、刷新、继续、清除再刷新',requirements:['R1'],steps:[{action:'expectText',selector:'#tickets',value:'10 / 0'},{action:'click',selector:'#spend'},{action:'expectText',selector:'#tickets',value:'9 / 1'},{action:'reload'},{action:'expectText',selector:'#tickets',value:'9 / 1'},{action:'click',selector:'#spend'},{action:'expectText',selector:'#tickets',value:'8 / 2'},{action:'click',selector:'#reset'},{action:'reload'},{action:'expectText',selector:'#tickets',value:'10 / 0'}]}];
  const result=await validateDemoBrowser(html,config,tests,new AbortController().signal);assert.equal(result.passed,true,result.errors.join('；'));
});


test('预览存档仅接受本帧消息，清除不影响其他活动与平台数据',()=>{
  const local=new Map<string,string>([['other-activity','keep'],['platform-account','keep']]);
  const session=new Map<string,string>();
  const storage=(values:Map<string,string>)=>({getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)});
  let receive:(event:any)=>void=()=>{};
  let disposed=false;
  const frame={contentWindow:{postMessage:()=>{}}};
  const install=runInNewContext('('+installDemoStorageHost.toString()+')',{localStorage:storage(local),sessionStorage:storage(session),window:{addEventListener:(_name:string,listener:typeof receive)=>{receive=listener;},removeEventListener:()=>{disposed=true;}}});
  const host=install(frame,'session-1','demo-1');
  const send=(values:unknown,source:unknown=frame.contentWindow,sessionId='session-1')=>receive({source,data:{channel:'activity-studio-storage',sessionId,kind:'local',values}});
  send({tickets:'9'},{});send({tickets:'9'},frame.contentWindow,'wrong-session');
  const circular:any={};circular.self=circular;send(circular);send({tickets:'x'.repeat(1048577)});
  assert.equal(local.has('demo-1'),false);
  send({tickets:'9'});assert.equal(JSON.parse(local.get('demo-1')!).tickets,'9');
  const restored=install(frame,'session-2','demo-1');assert.equal(restored.snapshot.local.tickets,'9');
  host.clear();assert.equal(local.has('demo-1'),false);assert.equal(local.get('other-activity'),'keep');assert.equal(local.get('platform-account'),'keep');
  restored.dispose();assert.equal(disposed,true);
});

test('点击次数按逐次操作执行，不能静默忽略测试补给次数',async()=>{
  const html='<html><head></head><body><button id="add">补给</button><p id="count">0</p><script>let count=0;document.querySelector("#add").onclick=()=>document.querySelector("#count").textContent=String(++count)</script></body></html>';
  const sample=readProject(JSON.stringify({files:{'index.html':html},tests:[{id:'repeat',name:'连续三次补给',requirements:['R1'],steps:[{action:'click',selector:'#add',count:3},{action:'expectText',selector:'#count',value:'3'}]}]}));
  const result=await validateDemoBrowser(html,config,sample.tests,new AbortController().signal);
  assert.equal(result.passed,true,result.errors.join('；'));
  sample.tests[0]!.steps[0]!.count=-1;
  assert.throws(()=>readProject(JSON.stringify(sample)),/重复点击次数/);
});
