import React from 'react';
import type { StageArtifact } from '@ai-activity-studio/shared';

export function DemoQualityPanel({ artifact, configRevision, documentVersion, dirty }: { artifact?: StageArtifact; configRevision?: number; documentVersion?: string; dirty: boolean }) {
  if (!artifact) return null;
  const info = artifact.demoDelivery;
  const matched=info && !dirty && info.plan.configuration.revision===configRevision && info.plan.configuration.sourceDocumentUpdatedAt===documentVersion;
  const passed=matched && info.validation?.passed;
  return <section className="generation-progress" aria-label="Demo 自动验证">
    <div className="generation-heading"><b>交互模型运行检查</b><span>{passed?'已通过，可确认继续':'此版本尚未通过运行检查'}</span></div>
    <p>{passed?`编译成功 · ${info.validation!.tests.length} 项浏览器检查通过 · ${Object.keys(artifact.demoProject?.files??{}).length} 个源文件`:'原 Demo 仍可试玩。可让 AI 继续完善，验证通过后才会更新项目。'}</p>
    <small>自动检查覆盖已保存的测试场景；最终玩法体验和美术方向仍由团队评审。</small>
    {info&&<details><summary>验证记录与演示配置</summary>
      {info.validation?.tests.map(test=><p key={test.id}>{test.passed?'✓':'待修复'} {test.name}</p>)}
      <p>{info.plan.requirements.length} 项需求 · {info.plan.screens.length} 个界面 · {info.plan.configuration.tables?.length??1} 张配置表</p>
      {!!info.plan.assumptions.length&&<details><summary>默认演示值的依据</summary><ul>{info.plan.assumptions.map((text,i)=><li key={i}>{text}</li>)}</ul></details>}
    </details>}
    {info&&!!info.review.issues.length&&<details><summary>AI 参考意见（不阻塞下一步）</summary><p>这些意见未必是实际缺陷，不会触发自动修改。需要调整时，在下方对话框明确提出修改要求。</p><ul>{info.review.issues.map((text,i)=><li key={i}>{text}</li>)}</ul></details>}
  </section>;
}
