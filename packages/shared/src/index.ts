export type ActivityStatus = 'draft' | 'generating' | 'ready' | 'failed';
export type ActivityType = 'race' | 'independent-merge' | 'gift-pack' | 'task-chain' | 'n-vs-n' | (string & {});
export type LegacyActivityType = 'campaign' | 'survey' | 'training' | 'event';
export type PipelineStage = 'source' | 'document' | 'demo' | 'ue-demo' | 'handoff';
export type ActivityStage = PipelineStage | 'flow' | 'ue';
export type ArtifactKind = 'markdown' | 'image' | 'html' | 'file';
export type DemoRequirement = { id: string; source: string; description: string; acceptance: string; tableIds: string[] };
export type DemoPlan = { requirements: DemoRequirement[]; screens: { id: string; name: string; states: string[] }[]; visualDirection: string; assumptions: string[]; configuration: ActivityConfiguration };
export type DemoReview = { status?: 'completed' | 'unavailable'; coverage: { id: string; status: 'pass' | 'fail'; evidence: string }[]; issues: string[]; manualChecks: string[] };
export type DemoTestStep = { action: 'click' | 'fill' | 'select' | 'expectText' | 'expectVisible' | 'expectCount' | 'expectDisabled' | 'reload'; selector?: string; value?: string; count?: number };
export type DemoScenario = { id: string; name: string; requirements: string[]; steps: DemoTestStep[] };
export type DemoProject = { files: Record<string,string>; tests: DemoScenario[] };
export type DemoValidation = { passed: boolean; checkedAt: string; tests: { id: string; name: string; passed: boolean; error?: string }[]; errors: string[]; screenshots?: { name: string; base64: string }[] };
export type DemoDelivery = { scopeVersion?: string; validation?: DemoValidation; plan: DemoPlan; review: DemoReview; checkedAt: string; contentHash: string; configHash: string; repairs: number };
export type StageArtifact = { demoProject?: DemoProject; stage: ActivityStage; kind: ArtifactKind; fileName: string; mimeType: string; content: string; encoding: 'utf8' | 'base64'; updatedAt: string; sourceContent?: string; sourceFormat?: 'svg' | 'mermaid' | 'text'; demoDelivery?: DemoDelivery };
export type Activity = { id: string; name: string; type: ActivityType; status: ActivityStatus; owner: string; productId?: string; approvals?: Partial<Record<PipelineStage, string>>; figmaUrl?: string; demoResetAt?: string; createdAt: string; updatedAt: string; description: string; markdown?: string; sourceDocument?: SourceDocument; planningDocument?: SourceDocument; artifacts?: Partial<Record<ActivityStage, StageArtifact>>; configuration?: ActivityConfiguration; demoConfigRevision?: number; demoConfiguration?: ActivityConfiguration; playEvents?: PlayEvent[] };
export type ModelProvider = 'demo' | 'openai-compatible' | 'azure-openai' | (string & {});
export type ModelConfig = { id: string; provider: ModelProvider; model: string; displayName?: string; fullUrl?: boolean; isDefault?: boolean; baseUrl?: string; enabled: boolean; apiKeyConfigured: boolean; keyFingerprint?: string; updatedAt: string };
export type GenerationJobState = 'queued' | 'running' | 'paused' | 'completed' | 'failed';
export type GenerationJobKind = 'outline' | 'copy' | 'image-prompt';
export type AuditEventType = 'created' | 'state_changed' | 'attempt_started' | 'artifact_saved' | 'paused' | 'resumed' | 'failed';
export type AuditEvent = { id: string; type: AuditEventType; at: string; actor: 'user' | 'system' | 'worker'; summary: string; fromState?: GenerationJobState; toState?: GenerationJobState };
export type GenerationSettings = { idleTimeoutMinutes: number };
export const DEFAULT_GENERATION_SETTINGS: GenerationSettings = { idleTimeoutMinutes: 30 };
export type GenerationProgress = { idleTimeoutMinutes?: number; operation?: string; phase: 'preparing' | 'requesting' | 'waiting' | 'receiving' | 'saving' | 'completed'; startedAt: string; updatedAt: string; characters: number; model?: string; inputCharacters?: number; imageCount?: number; skillCount?: number; firstContentMs?: number; lastEventAt?: string; steps: { title: string; at: string }[] };
export type DemoFileSpec = { path: string; purpose: string; requirements: string[]; dependsOn: string[]; contract: string };
export type DemoAuthoring = { manifest: DemoFileSpec[]; files: Record<string,string>; tests: DemoScenario[] };
export type DemoDraft = { authoring?: DemoAuthoring; implementationText?: string; project?: DemoProject; validation?: DemoValidation; qualityAttempted?: boolean; signature: string; planText?: string; content?: string; reviewText?: string; reviewContentHash?: string };
export type GenerationJob = { inputImages?: SourceImage[]; modelId?: string; modelName?: string; demoDraft?: DemoDraft; instruction?: string; inputContent?: string; progress?: GenerationProgress; id: string; activityId: string; stage: ActivityStage; kind: GenerationJobKind; state: GenerationJobState; attempts: number; result?: unknown; error?: string; createdAt: string; updatedAt: string; auditTrail: AuditEvent[] };
export type StageSkill = { id: string; stage: ActivityStage; name: string; description: string; version?: string; enabled: boolean; builtIn: boolean; fileName?: string; fileSize?: number; archiveBase64?: string; content?: string; productId?: string; activityType?: string; createdAt: string; updatedAt: string };
export type PublicStageSkill = Omit<StageSkill, 'archiveBase64'> & { downloadable: boolean; appliedToGeneration?: boolean };

export type ConfigField = { key: string; label: string; type: 'string' | 'number' | 'boolean'; required: boolean; description?: string };
export type ConfigRow = Record<string, string | number | boolean>;
export type PacingMapping = { label?: string; duration?: string; actions?: string; cost?: string; reward?: string };
export type ActivityConfiguration = { fields: ConfigField[]; rows: ConfigRow[]; pacing: PacingMapping; tables?: ConfigTable[]; primaryTableId?: string; revision: number; updatedAt: string; sourceDocumentUpdatedAt?: string };
export type PlayEvent = { id: string; sessionId: string; revision: number; type: 'session_start' | 'step_enter' | 'step_complete' | 'session_complete'; stepIndex?: number; elapsedMs: number; at: string };
export { attachConfigRuntime, configDrivenDemo, installDemoStorageHost, demoStorageKey, demoPreviewPage } from './demo.js';

export type SourceImage = { id: string; name: string; mimeType: string; base64: string };
export type SourceDocument = { mimeType?: string; fileName: string; size: number; images: SourceImage[]; warnings: string[]; importedAt: string; originalBase64?: string };

export type ConfigTable = { id: string; name: string; fields: ConfigField[]; rows: ConfigRow[]; pacing: PacingMapping };
export type ProductProfile = { id: string; name: string; activityTypes: { id: string; name: string }[] };
export const PIPELINE: { id: PipelineStage; name: string; description: string }[] = [
 { id: 'source', name: '活动原稿', description: '上传或整理图文需求，确认活动目标与已有规则。' },
 { id: 'document', name: '策划文档', description: '编写并确认策划；配置表可选，未填写时自动提供默认值。' },
 { id: 'demo', name: 'UE 交互模型', description: '生成交付美术与 Unity 程序前的完整交互依据；未填配置也可运行。' },
 { id: 'ue-demo', name: 'UE 交互验收', description: '与 UE 同学共创页面、状态和交互，核对产品模板后确认交付版本。' },
 { id: 'handoff', name: '美术与程序交付', description: '交付交互模型全源码、功能 Markdown、页面状态、Unity 接入说明与配置。' }
];
export function stageConfirmed(activity: Activity, stage: ActivityStage): boolean { return Boolean(activity.artifacts?.[stage]?.content?.trim() && activity.approvals?.[stage as PipelineStage] === activity.artifacts?.[stage]?.updatedAt); }
export function canEnterStage(activity: Activity, stage: ActivityStage): boolean { const index=PIPELINE.findIndex(s=>s.id===stage); return index>=0 && PIPELINE.slice(0,index).every(s=>stageConfirmed(activity,s.id)); }

export function activityImages(activity: Activity): SourceImage[] { return [...(activity.sourceDocument?.images ?? []), ...(activity.planningDocument?.images ?? [])]; }
export function resolveActivityImages(content: string, activity: Activity): string { for (const image of activityImages(activity)) content = content.replaceAll('attachment:' + image.id, 'data:' + image.mimeType + ';base64,' + image.base64); return content; }
