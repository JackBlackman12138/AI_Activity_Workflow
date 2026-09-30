import type { GenerationJob } from '@ai-activity-studio/shared';

export interface JobHandler {
  handle(job: GenerationJob): Promise<void>;
}
