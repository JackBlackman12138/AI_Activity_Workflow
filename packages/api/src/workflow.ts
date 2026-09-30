import { configDigest, digest } from './demo-pipeline.js';
import { PIPELINE, canEnterStage, type Activity, type ActivityStage, type PipelineStage } from '@ai-activity-studio/shared';

export function assertStage(activity: Activity, stage: ActivityStage) {
  if (!canEnterStage(activity, stage)) throw new Error('请先依次确认前序阶段；历史流程图和 UE 图片仅供下载');
}
export function invalidate(activity: Activity, stage: ActivityStage) {
  activity.approvals ??= {};
  for (const next of PIPELINE.slice(Math.max(0, PIPELINE.findIndex(s => s.id === stage)))) delete activity.approvals[next.id];
  activity.status = 'draft';
}
export function confirmStage(activity: Activity, stage: ActivityStage, expectedUpdatedAt: unknown) {
  assertStage(activity, stage);
  const artifact = activity.artifacts?.[stage];
  if (!artifact?.content.trim()) throw new Error('请先保存或生成当前阶段产物');
  if (artifact.updatedAt !== expectedUpdatedAt) throw new Error('产物已更新，请刷新并检查后确认');
  if ((stage === 'demo' || stage === 'ue-demo') && activity.configuration && activity.demoConfigRevision !== activity.configuration.revision) throw new Error('请先同步最新配置并完成试玩检查');
  if (stage === 'demo' || stage === 'ue-demo') assertDemoDelivery(activity, stage);
  activity.approvals ??= {};
  activity.approvals[stage as PipelineStage] = artifact.updatedAt;
  activity.updatedAt = new Date().toISOString();
  activity.status = stage === 'handoff' ? 'ready' : 'draft';
}
export function inputSignature(activity: Activity) {
  return JSON.stringify([activity.name, activity.type, activity.productId, activity.description, activity.artifacts, activity.configuration, activity.approvals, activity.demoResetAt]);
}

export function assertDemoDelivery(activity: Activity, stage: 'demo'|'ue-demo') {
  const artifact=activity.artifacts?.[stage], info=artifact?.demoDelivery;
  // User-imported and local sample artifacts have no automatic certification.
  if(!info)return;
  if(!info.validation?.passed||info.contentHash!==digest(artifact!.content)||!activity.demoConfiguration||info.configHash!==configDigest(activity.demoConfiguration)||info.plan.configuration.sourceDocumentUpdatedAt!==activity.artifacts?.document?.updatedAt) throw new Error('此版本尚未通过自动验证，请完成运行检查后再确认交付');
}
