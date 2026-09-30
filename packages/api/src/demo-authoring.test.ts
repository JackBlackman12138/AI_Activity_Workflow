import test from 'node:test';
import assert from 'node:assert/strict';
import type { DemoDraft } from '@ai-activity-studio/shared';
import { authorDemoProject,readManifest } from './demo-authoring.js';
import { buildDemoProject } from './demo-project.js';
const manifest=[
  {path:'src/main.js',purpose:'按钮行为',requirements:['R1'],dependsOn:[],contract:'绑定 #go，点击后显示 完成'},
  {path:'index.html',purpose:'离线入口',requirements:['R1'],dependsOn:['src/main.js'],contract:'包含 #go 按钮，引用 ./src/main.js'}
];
const files={'src/main.js':'document.querySelector("#go").onclick=()=>{document.querySelector("#go").textContent="完成"};','index.html':'<!doctype html><html><head></head><body><button id="go">开始</button><script src="./src/main.js"></script></body></html>'};
const tests=[{id:'flow',name:'完成操作',requirements:['R1'],steps:[{action:'click',selector:'#go'},{action:'expectText',selector:'#go',value:'完成'}]}];
test('文件分步保存，中断后只生成未完成文件并补齐测试',async()=>{
  const draft:DemoDraft={signature:'test'},titles:string[]=[],calls:string[]=[];
  const options={context:'测试策划全文',requirementIds:['R1'],testContract:'场景契约',checkpoint:async(patch:Partial<DemoDraft>)=>{Object.assign(draft,structuredClone(patch));},report:async(title:string)=>{titles.push(title);}};
  let count=0;
  await assert.rejects(authorDemoProject({...options,request:async(operation)=>{
    calls.push(operation);count++;
    if(count===1)return JSON.stringify({manifest});
    if(count===2)return JSON.stringify({path:'src/main.js',content:files['src/main.js']});
    throw new Error('模拟网关断开');
  }}),/网关断开/);
  assert.equal(draft.authoring?.files['src/main.js'],files['src/main.js']);
  assert.equal(draft.authoring?.files['index.html'],undefined);
  const resumed:string[]=[];
  const project=await authorDemoProject({...options,draft,request:async(operation,_instruction,input)=>{
    resumed.push(operation);assert.ok(input.includes('测试策划全文'));
    return JSON.stringify(operation.includes('编写文件')?{path:'index.html',content:files['index.html']}:{tests});
  }});
  assert.equal(resumed.length,2);assert.ok(resumed[0]?.includes('2/2'));
  assert.deepEqual(project.files,files);assert.deepEqual(project.tests,tests);
  assert.match(await buildDemoProject(project),/完成/);assert.ok(titles.some(title=>title.includes('已保存 src/main.js')));
});
test('工程清单拒绝越界、依赖倒置、大小写重名和需求遗漏',()=>{
  assert.deepEqual(readManifest(JSON.stringify({manifest}),['R1']),manifest);
  for(const invalid of [[...manifest].reverse(),[...manifest,{...manifest[0],path:'INDEX.HTML'}],[{...manifest[0],path:'../outside'},manifest[1]],manifest.map(file=>({...file,requirements:[]}))])assert.throws(()=>readManifest(JSON.stringify({manifest:invalid}),['R1']));
});

test('独立文件合并请求且保存完整源码，依赖文件仍在下一批生成',async()=>{
  const expanded=[...['a','b','c'].map(name=>({path:name+'.js',purpose:name,requirements:['R1'],dependsOn:[],contract:'export '+name})),{path:'index.html',purpose:'入口',requirements:['R1'],dependsOn:['a.js','b.js','c.js'],contract:'使用所有模块'}];
  const draft:DemoDraft={signature:'batch'},calls:string[]=[];
  const result=await authorDemoProject({context:'完整策划',requirementIds:['R1'],testContract:'测试约定',checkpoint:async patch=>{Object.assign(draft,structuredClone(patch));},report:async()=>{},request:async(operation,_instruction,input)=>{
    calls.push(operation);
    if(calls.length===1)return JSON.stringify({manifest:expanded});
    if(calls.length===2){assert.match(input,/a\.js/);return JSON.stringify({files:['a','b','c'].map(name=>({path:name+'.js',content:`export const ${name}=1;`}))});}
    if(calls.length===3){assert.equal(Object.keys(draft.authoring!.files).length,3);assert.match(input,/export const c=1/);return JSON.stringify({path:'index.html',content:files['index.html']});}
    return JSON.stringify({tests});
  }});
  assert.equal(calls.length,4,'清单、独立文件组、依赖入口、测试各一次，原逐文件模式需六次');
  assert.equal(Object.keys(result.files).length,4);assert.deepEqual(result.tests,tests);
});
