import type { DemoAuthoring, DemoDraft, DemoFileSpec, DemoProject } from '@ai-activity-studio/shared';
import { projectJson, readProject, readScenarios, safePath } from './demo-project.js';
import { scenarioIssues } from './demo-browser.js';

export function readManifest(text: string, requirementIds: string[]): DemoFileSpec[] {
  const raw=projectJson(text).manifest;
  if(!Array.isArray(raw)||!raw.length||raw.length>500)throw new Error('缺少工程文件清单');
  const seen=new Set<string>();
  for(const file of raw) {
    if(!file||typeof file.path!=='string'||typeof file.purpose!=='string'||!file.purpose.trim()||typeof file.contract!=='string'||!file.contract.trim()||!Array.isArray(file.requirements)||!Array.isArray(file.dependsOn))throw new Error('文件清单缺少职责、接口或依赖');
    safePath(file.path);
    if(seen.has(file.path.toLowerCase()))throw new Error('文件路径重复：'+file.path);
    if(!file.requirements.every((id:unknown)=>typeof id==='string'&&requirementIds.includes(id)))throw new Error('文件引用了未知需求：'+file.path);
    if(!file.dependsOn.every((path:unknown)=>typeof path==='string'&&raw.some(other=>other.path===path)&&seen.has(path.toLowerCase())))throw new Error('文件依赖须在前面生成，不能循环引用：'+file.path);
    seen.add(file.path.toLowerCase());
  }
  if(!raw.some(file=>file.path==='index.html'))throw new Error('文件清单缺少 index.html');
  const covered=new Set(raw.flatMap(file=>file.requirements));
  if(requirementIds.some(id=>!covered.has(id)))throw new Error('文件清单未覆盖全部需求');
  return raw;
}

// The application owns the loop and tools. Each completed file is a durable checkpoint.
export async function authorDemoProject(options: {
  context: string; requirementIds: string[]; testContract: string; draft?: DemoDraft;
  request: (operation:string,instruction:string,input:string)=>Promise<string>;
  checkpoint: (patch:Partial<DemoDraft>)=>Promise<void>;
  report: (title:string)=>Promise<void>;
}):Promise<DemoProject> {
  const {context,requirementIds,request,checkpoint,report}=options;
  let state:DemoAuthoring;
  if(options.draft?.authoring) {
    state=structuredClone(options.draft.authoring);
    readManifest(JSON.stringify(state),requirementIds);
  } else {
    let text=options.draft?.implementationText??await request('2/3 规划源码文件与模块接口',
      '只返回 JSON {manifest:[{path,purpose,requirements:[需求ID],dependsOn:[工程路径],contract}]}，此步不返回代码。按依赖顺序列出完整工程，index.html 最后引用入口脚本。拆分规则、状态、视图、样式和输入模块；小功能不要过度拆分。contract 明确导出函数、参数、返回值、状态结构和稳定且唯一的测试定位器（弹层关闭叉号与底部关闭按钮须分别命名）。每项需求必须分配到实现文件，所有文件必须可离线编译，不引入第三方包。',context);
    await checkpoint({implementationText:text});
    // Compatibility with gateways that return a complete project despite the outline request.
    let raw: any;
    try { raw=projectJson(text); } catch { /* Retry the outline below with a concrete diagnostic. */ }
    if(raw?.files||/^(?:```html\s*)?(?:<!doctype|<html)/i.test(text.trim()))return readProject(text);
    let manifest:DemoFileSpec[];
    try { manifest=readManifest(text,requirementIds); }
    catch(error) {
      text=await request('修正工程文件清单','只返回有效 JSON {manifest:[{path,purpose,requirements:[],dependsOn:[],contract}]}。保留全部业务范围，依赖文件排列在使用者之前。',context+'\n原清单：'+text+'\n问题：'+(error as Error).message);
      await checkpoint({implementationText:text});
      if(projectJson(text)?.files)return readProject(text);
      manifest=readManifest(text,requirementIds);
    }
    state={manifest,files:{},tests:[]};
    await checkpoint({authoring:state,implementationText:undefined});
  }
  await report(`工程分工已确定：${state.manifest.length} 个文件，覆盖 ${requirementIds.length} 项需求`);
  for(const [index,file] of state.manifest.entries()) {
    if(Object.hasOwn(state.files,file.path))continue;
    // Batch only independent files whose dependencies are already durable.
    const batch=state.manifest.slice(index).filter(item=>!Object.hasOwn(state.files,item.path)&&item.dependsOn.every(path=>Object.hasOwn(state.files,path))).slice(0,3);
    if(!batch.length)throw Error('文件依赖尚未完成：'+file.path);
    const dependencies=new Set<string>();
    const visit=(path:string)=>{if(dependencies.has(path))return;dependencies.add(path);state.manifest.find(item=>item.path===path)!.dependsOn.forEach(visit);};
    batch.forEach(item=>item.dependsOn.forEach(visit));
    const input=context+'\n全部文件与接口约定：'+JSON.stringify(state.manifest)+'\n当前文件：'+JSON.stringify(batch.length===1?file:batch)+'\n已完成依赖源码：'+JSON.stringify(Object.fromEntries([...dependencies].map(path=>[path,state.files[path]])));
    const instruction=(batch.length===1?'只返回 JSON {path,content}，完整实现当前这一个文件。path 必须为 '+file.path:'只返回 JSON {files:[{path,content}]}，完整实现这组互不依赖的文件，路径必须恰好是 '+batch.map(item=>item.path).join('、'))+'。遵守已完成依赖的实际导出和接口，不能省略代码、伪造完成或顺手更改其他文件。全部业务值读取约定配置，不重复硬编码。';
    let text=await request(`2/3 编写文件 ${index+1}/${state.manifest.length}：${batch.map(item=>item.path).join('、')}`,instruction,input);
    const read=()=>{const value=projectJson(text),files=batch.length===1?[value]:value.files;
      if(!Array.isArray(files)||files.length!==batch.length||new Set(files.map(item=>item?.path)).size!==batch.length||files.some(item=>!item||!batch.some(file=>file.path===item.path)||typeof item.content!=='string'||!item.content.trim()))throw new Error('当前文件路径或内容无效');
      return Object.fromEntries(files.map(item=>[item.path,item.content])) as Record<string,string>;
    };
    let generated:Record<string,string>;
    try { generated=read(); } catch(error) {
      text=await request('修正文件输出：'+batch.map(item=>item.path).join('、'),instruction,input+'\n输出错误：'+(error as Error).message+'\n上次输出：'+text);generated=read();
    }
    if(JSON.stringify({...state.files,...generated}).length>20_000_000)throw new Error('工程超过单次处理大小');
    Object.assign(state.files,generated);await checkpoint({authoring:state});
    for(const item of batch)await report(`已保存 ${item.path} · ${generated[item.path]!.length} 字符 · ${item.purpose}${batch.length>1?' · 同批生成':''}`);
  }
  const covered=new Set(state.tests.flatMap(test=>test.requirements));
  const pending=requirementIds.filter(id=>!covered.has(id));
  for(let index=0;index<pending.length;index+=6) {
    const batch=pending.slice(index,index+6);
    const input=context+'\n当前完整源码：'+JSON.stringify(state.files)+'\n本组需要覆盖：'+JSON.stringify(batch)+'\n已有测试 ID：'+JSON.stringify(state.tests.map(test=>test.id));
    const instruction='只返回 JSON {tests:[]}。根据实际代码编写测试，不能凭空猜测选择器。每个测试从首次访问的全新页面开始，必须自行完成进入活动、封面和引导等前置操作；不能依赖前一个测试。弹层关闭用唯一选择器。'+options.testContract;
    let text=await request(`2/3 编写试玩场景：${batch.join('、')}`,instruction,input);
    const read=()=>{
      const tests=readScenarios(projectJson(text).tests);
      const issues=scenarioIssues(tests,batch);
      if(tests.some(test=>test.requirements.some(id=>!requirementIds.includes(id))))issues.push('引用了未知需求');
      readScenarios([...state.tests,...tests]);
      if(issues.length)throw new Error(issues.join('；'));return tests;
    };
    let tests;
    try { tests=read(); } catch(error) { text=await request('补齐试玩场景',instruction,input+'\n问题：'+(error as Error).message+'\n原场景：'+text);tests=read(); }
    state.tests.push(...tests);await checkpoint({authoring:state});
    await report(`已保存 ${tests.length} 个独立试玩场景，覆盖 ${batch.join('、')}`);
  }
  return readProject(JSON.stringify({files:state.files,tests:state.tests}));
}
