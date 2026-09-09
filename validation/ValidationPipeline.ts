import { StageResult } from './models/ValidationResult';

export type ValidationStageTask = () => Promise<StageResult>;

export class ValidationPipeline {
  private stages: Array<{ name: string; task: ValidationStageTask }> = [];

  public addStage(name: string, task: ValidationStageTask): void {
    this.stages.push({ name, task });
  }

  public async executeAll(): Promise<StageResult[]> {
    const results: StageResult[] = [];

    for (const stage of this.stages) {
      try {
        const res = await stage.task();
        results.push(res);
      } catch (err: any) {
        results.push({
          stageName: stage.name,
          toolName: 'Unknown',
          success: false,
          skipped: false,
          executionTimeMs: 0,
          errors: [
            {
              category: 'TOOL_EXECUTION_FAILED' as any,
              message: `Stage execution crashed: ${err.message || String(err)}`,
              tool: stage.name,
              fatal: true
            }
          ],
          warnings: [],
          outputArtifacts: []
        });
      }
    }

    return results;
  }
}
