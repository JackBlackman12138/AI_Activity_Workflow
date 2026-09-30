import React, { useEffect, useState } from 'react';
import type { GenerationJob } from '@ai-activity-studio/shared';

const phases = { preparing: '整理需求与工程', requesting: '连接模型网关', waiting: '等待模型开始输出', receiving: '正在接收生成内容', saving: '检查并保存产物', completed: '生成完成' };
const duration = (ms: number) => `${Math.floor(ms / 60000)} 分 ${Math.floor(ms / 1000) % 60} 秒`;

export function GenerationProgressPanel({ job }: { job?: GenerationJob }) {
  const [now, setNow] = useState(Date.now());
  const running = job?.state === 'running' || job?.state === 'queued';
  useEffect(() => { setNow(Date.now()); if (!running) return; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [job?.id, job?.attempts, running]);
  if (!job) return null;
  const progress = job.progress;
  const sourceFiles=job.demoDraft?.project?.files??job.demoDraft?.authoring?.files??{};
  const checks=job.demoDraft?.validation?.tests??[];
  const start = progress?.startedAt ?? job.auditTrail.filter(event => event.type === 'attempt_started').at(-1)?.at ?? job.createdAt;
  const elapsed = Math.max(0, (running ? now : Date.parse(job.updatedAt)) - Date.parse(start));
  const quietSeconds = progress?.lastEventAt ? Math.max(0, Math.floor((now - Date.parse(progress.lastEventAt)) / 1000)) : 0;
  const legacy=job.state==='completed'&&['demo','ue-demo'].includes(job.stage)&&!job.demoDraft?.validation?.passed;
  const title = legacy?'历史生成已结束（未执行新版验证）':job.state === 'failed' ? '本次生成已停止' : job.state === 'paused' ? '已暂停，可手动继续' : job.state === 'queued' ? '任务已排队' : progress ? phases[progress.phase] : job.state === 'completed' ? '生成完成' : '正在等待模型响应';
  let reviewIssues: string[] = [];
  try {
    const review = JSON.parse((job.demoDraft?.reviewText ?? '').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));
    if (Array.isArray(review.issues)) reviewIssues = review.issues.map((item: unknown)=>typeof item==='string'?item:item&&typeof item==='object'?Object.values(item).map(value=>typeof value==='string'?value:JSON.stringify(value)).join(' · '):'').filter(Boolean);
  } catch { /* An incomplete review is not presented as a completed result. */ }
  return <section className={`generation-progress ${job.state}`} aria-label="AI 工作进度">
    <div className="generation-heading"><b>AI 工作进度</b><span>{duration(elapsed)}</span></div>
    <p className="generation-state" role="status"><i className={running ? 'pulsing' : ''} />{running && progress?.operation ? progress.operation + ' · ' : ''}{title}</p>
    {job.modelName&&<p className="generation-note">本次任务模型：{job.modelName}</p>}
    {job.instruction&&<details><summary>本次修改要求{job.inputImages?.length?` · ${job.inputImages.length} 张参考图`:""}</summary><p>{job.instruction}</p>{!!job.inputImages?.length&&<div className="reference-images">{job.inputImages.map((image,index)=><figure key={image.id}><img src={`data:${image.mimeType};base64,${image.base64}`} alt={`本次参考图 ${index+1}：${image.name}`}/><figcaption>图 {index+1} · {image.name}</figcaption></figure>)}</div>}</details>}
    {job.demoDraft?.authoring&&<p>源码完成 {Object.keys(sourceFiles).length} / {job.demoDraft.authoring.manifest.length} 个文件，已保存 {job.demoDraft.authoring.tests.length} 个试玩场景。</p>}
    {!!Object.keys(sourceFiles).length&&<details><summary>已生成源码（{Object.keys(sourceFiles).length} 个文件）</summary>{Object.entries(sourceFiles).map(([path,content])=><details key={path}><summary>{path} · {content.length.toLocaleString()} 字符</summary><pre className="generation-source">{content}</pre></details>)}</details>}
    {!!checks.length&&<details open={running}><summary>实际试玩结果 · {checks.filter(test=>test.passed).length}/{checks.length} 通过{running?'（本轮进行中）':''}</summary><ul>{checks.map(test=><li key={test.id}>{test.passed?'✓':'待修复'} {test.name}{test.error&&<details><summary>失败原因</summary><pre className="generation-source">{test.error}</pre></details>}</li>)}</ul></details>}
    {progress && <div className="generation-metrics"><span>模型 <b>{progress.model ?? '准备中'}</b></span><span>输入 <b>{progress.inputCharacters?.toLocaleString() ?? '—'} 字符 / {progress.imageCount ?? 0} 张图</b></span><span>已接收 <b>{progress.characters.toLocaleString()} 字符</b></span>{progress.firstContentMs !== undefined && <span>首次内容 <b>{(progress.firstContentMs / 1000).toFixed(1)} 秒</b></span>}</div>}
    {!!progress?.steps.length && <details open={running}><summary>{running?'执行进度':'执行记录'}</summary><ol>{progress.steps.map((step,index)=><li key={index}><time>{new Date(step.at).toLocaleTimeString()}</time><span>{step.title}</span></li>)}</ol></details>}
    {running && progress?.phase === 'saving' && <p className="generation-note">正在本地执行编译、浏览器试玩或保存，当前步骤不等待模型输出。试玩包含刷新、存档恢复等操作，结果会在本轮完成后更新。可随时暂停。</p>}
    {running && progress?.phase !== 'saving' && <p className="generation-note">{quietSeconds >= 10 ? `最近 ${quietSeconds} 秒未收到新的网关数据，仍在等待响应。` : progress?.phase === 'receiving' ? '正在接收本步骤内容。' : '网关可能正在处理输入或等待模型输出。'} 持续收到网关数据就继续等待；{progress?.idleTimeoutMinutes === 0 ? '当前不限等待时长' : `连续 ${progress?.idleTimeoutMinutes ?? 30} 分钟无数据会停止`}（高级配置可修改，下次任务生效）。只有编译或实际运行检查失败才自动修复，单次最多四轮；AI 参考意见不触发修改，也不阻塞确认。可随时暂停。</p>}
    {job.error && <p className="generation-error" role="alert">{job.error}</p>}
    {!!reviewIssues.length && <details><summary>{job.state==='completed'?'AI 参考意见（不阻塞下一步）':running?'已有检查记录（本轮处理中）':'检查详情'}（{reviewIssues.length}）</summary><p className="generation-note">{job.state==='completed'?'运行检查已通过，以下意见仅供参考。不会继续自动修改；需要调整时请在对话框提出。':'以下是已记录的检查结果，以实际运行检查和最终状态为准。'}</p><ul>{reviewIssues.map((issue,index)=><li key={index}>{issue}</li>)}</ul></details>}
    <small className="generation-note">显示实际执行状态与接收量，不代表模型的内部思考过程。</small>
  </section>;
}
