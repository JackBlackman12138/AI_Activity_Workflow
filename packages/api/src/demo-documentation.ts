import type { Activity, StageArtifact } from '@ai-activity-studio/shared';

export function unityHandoffDocument(activity:Activity,artifact:StageArtifact):string {
  const plan=artifact.demoDelivery?.plan;
  const cell=(value:string)=>value.replace(/\|/g,'\\|').replace(/\r?\n/g,' ');
  const files=Object.keys(artifact.demoProject?.files??{});
  return `# ${activity.name} · Unity 与美术交接

本交付是正式制作前的 UE（用户体验）交互模型。Web 源码用于复现规则、状态和反馈；Unity 程序须将规则迁移到 C# 并接入项目现有 UI、资源与服务，不可将本包直接当作 Unity 工程。业务依据见 planning.md，逐项功能与可执行操作见 features.md。

## 程序迁移契约

| 模型部分 | Unity 实现要求 | 验收依据 |
| --- | --- | --- |
| 规则与状态模块 | 分离纯规则、状态数据和 UI；同一操作保持相同前置条件、扣费、奖励与下一状态 | features.md 中需求 ID、源码位置、输入动作与预期结果 |
| 页面与弹层 | 映射到项目选用的 UI 系统；保留显示层级、返回路径、禁用原因、遮罩与点击保护 | 下方页面状态清单及实际交互 |
| 动效与反馈 | 动画只展示已提交结果；切页、中断或重复点击不得再次扣费发奖 | 重复操作及重进测试；未覆盖项须补人工验收 |
| 配置与默认值 | 配置表可选；保留已填业务值，无值时使用源码声明的默认值，正式上线前确认全部假设 | configuration.json、默认值源码、requirements.json 的 assumptions |
| 存档 | 将原型存档字段映射到项目存档或服务器状态；按活动期次隔离，处理重进和结算幂等 | 源码存档模块与 reload 场景 |
| 外部供给与奖励 | 用真实服务替换 Debug 输入和模拟到账，逐项确认请求字段、失败反馈、去重 ID 与重试 | 策划原文及 Debug 场景；具体服务 API 未约定的项目必须确认 |
| 节奏事件 | step_enter / step_complete 的 index 是主表零起始行号；session_complete 表示本次流程完成 | 与平台 config 主表逐行对应；不等同于真实发奖接口 |

## 美术页面与状态清单

以下仅枚举已有规格中的状态，不声称其排列顺序就是状态迁移顺序。操作条件与结果以 features.md 的场景为准。

| 页面 ID | 页面名称 | 需覆盖状态 |
| --- | --- | --- |
${(plan?.screens??[]).map(screen=>`| ${cell(screen.id)} | ${cell(screen.name)} | ${cell(screen.states.join('、'))} |`).join('\n')}

视觉依据：${plan?.visualDirection??'尚未记录，需与策划确认。'}

### 资源与样式定位

${files.filter(path=>/\.(svg|png|jpe?g|webp|css)$/i.test(path)).map(path=>`- [${path}](../project/${encodeURI(path)})`).join('\n')||'无独立资源文件记录；检查视图源码中的内联 SVG/CSS。'}

- 上述占位资源可替换，但交互区域、状态辨识与反馈时机须保留。
- 正式贴图尺寸、图集拆分、切片边距、字体授权、Unity 动画时长/曲线及导入参数：本交互模型未统一约定的部分由美术与程序确认，不能把浏览器样式直接当作生产资源规范。

## 交付验收

- [ ] 按 features.md 逐项核对触发操作、前置条件、状态变化、失败反馈及来源章节。
- [ ] 在 Unity 中复现 project-tests.json 的业务操作与预期结果；CSS 选择器需映射为 Unity 控件定位，测试文件不能直接运行在 Unity。
- [ ] 核对首次进入、资源不足、进行中、完成、领奖、关闭重进以及策划要求的全部分支。
- [ ] 核对正式资源替换后遮挡、触控区域、不同屏幕尺寸与动画中断。
- [ ] 确认下方默认假设，接入真实服务后重新验收重复请求与断线恢复。

## 默认假设与待确认项

${(plan?.assumptions??[]).map(value=>'- '+value).join('\n')||'没有记录；不得据此推断所有业务参数已正式确认。'}

自动检查记录见 quality.md；它们只证明 Web 模型的已执行场景，不代表 Unity 或正式服务已经验收。
`;
}

// Derive the handoff from saved requirements, source and observed tests; no second
// model invents a different specification after the implementation has passed.
export function demoFunctionalDocument(activity:Activity,artifact:StageArtifact):string {
  const delivery=artifact.demoDelivery, project=artifact.demoProject;
  const files=Object.entries(project?.files??{});
  const plan=delivery?.plan;
  const sections=(plan?.requirements??[]).map(rule=>{
    const review=delivery?.review.coverage.find(item=>item.id===rule.id);
    const evidence=review?.evidence??'';
    const locations=evidence?files.filter(([,content])=>content.includes(evidence)).map(([path,content])=>({path,line:content.slice(0,content.indexOf(evidence)).split('\n').length})):[];
    const scenarios=(project?.tests??[]).filter(test=>test.requirements.includes(rule.id));
    return `## ${rule.id} · ${rule.description}\n\n- 策划依据：${rule.source}\n- 可观察验收：${rule.acceptance}\n- 配置表：${rule.tableIds.map(id=>'`'+id+'`').join('、')||'无关联记录'}\n- 实现位置：${locations.map(item=>`[${item.path}](../project/${encodeURI(item.path)}) 第 ${item.line} 行`).join('；')||'没有匹配的源码证据，须人工定位'}\n- 审查状态：${review?.status??'未审查'}\n\n${evidence?'实现证据（当前源码原文）：\n\n```text\n'+evidence+'\n```\n\n':''}${scenarios.map(test=>`### 场景 ${test.id}：${test.name}\n\n从全新页面开始，按以下顺序执行：\n\n${test.steps.map((step,i)=>`${i+1}. \`${step.action}\` ${step.selector?'定位 '+JSON.stringify(step.selector):''}${step.value!==undefined?'；值 '+JSON.stringify(step.value):''}${step.count!==undefined?'；数量 '+step.count:''}`).join('\n')}\n\n执行记录：${(delivery?.validation?.tests??[]).filter(result=>result.id.endsWith(':'+test.id)).map(result=>result.name+' '+(result.passed?'通过':'失败：'+result.error)).join('；')||'未执行'}\n`).join('\n')||'尚无关联的自动化场景。\n'}`;
  });
  return `# ${activity.name} · UE 交互模型功能规格（Unity 实现依据）\n\n## 使用方式\n\n本文件供策划、开发和 AI 阅读，由当前保存的需求、源码与实际验证记录生成。业务原文见 [planning.md](planning.md)，字段和类型见 [configuration.md](configuration.md)，验证边界见 [quality.md](quality.md)。本模型用于美术与 Unity 程序正式制作前的交互验收；UE 指用户体验，不是 Unreal Engine。Unity 迁移与美术清单见 [unity-handoff.md](unity-handoff.md)。不要把默认假设当作正式业务规则。\n\n## 版本与运行入口\n\n- 交互模型版本：${artifact.updatedAt}\n- 策划版本：${activity.artifacts?.document?.updatedAt??'未记录'}\n- 配置版本：${activity.demoConfigRevision??'未记录'}\n- 源码校验：${delivery?.contentHash??'未记录'}\n- 入口：project/index.html；独立试玩：standalone.html\n- 修改源码后：npm install → npm run build → npm test → npm start\n- 本原型没有真实服务器、支付或主游戏系统；外部供给通过 Debug 主动模拟，活动内部规则仍需真实执行。\n\n## 源码索引\n\n${files.map(([path,content])=>`- [${path}](../project/${encodeURI(path)})（${content.split('\n').length} 行）`).join('\n')||'此版本未保存多文件源码。'}\n\n## 页面与状态\n\n${(plan?.screens??[]).map(screen=>`- ${screen.id} · ${screen.name}：${screen.states.join('、')}`).join('\n')}\n\n## 数据与接入契约\n\n- window.ActivityStudio.tables[表ID] 提供 fields 与 rows；config 指向主进度表。配置是可选补充；运行数据见 configuration.json，源码默认值及依据见默认值模块与假设清单。\n- track("step_enter", index)、track("step_complete", index) 的 index 为主表零起始行号；全部完成调用 track("session_complete")。\n- localStorage/sessionStorage 保存试玩状态；平台沙箱使用存档桥，独立运行使用浏览器存储。\n- 对接真实系统时替换 Debug 外部供给接口，保留活动内部消耗、领取和重复操作保护。\n- 测试场景与需求通过 requirements 中的稳定 ID 关联，完整定义见 project-tests.json；每个场景独立启动。\n\n${sections.join('\n')}\n## 演示假设与待确认项\n\n${(plan?.assumptions??[]).map(value=>'- '+value).join('\n')||'无记录。'}\n\n${(delivery?.review.manualChecks??[]).map(value=>'- [ ] '+value).join('\n')}\n\n## 交付边界\n\n自动测试覆盖上列场景，不能代替正式环境接入与全部状态验收。策划规则与源码有冲突时，先对照来源章节确认，再同时更新源码、测试与此文档。\n`;
}
