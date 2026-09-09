import fs from 'fs/promises';
import path from 'path';

export interface StageVerificationResult {
  passed: boolean;
  issues: string[];
}

export interface StageTrace {
  stageName: string;
  startTimestamp: string;
  finishTimestamp?: string;
  durationMs?: number;
  executedCommand: string;
  exitCode: number | string;
  stdout: string;
  stderr: string;
  producedArtifacts: string[];
  verificationResult: StageVerificationResult;
  rootCause?: string;
  suggestedResolution?: string;
}

export interface PipelineTraceReport {
  sessionId: string;
  presetId: string;
  architecture?: string;
  processor?: string;
  timestamp: string;
  overallStatus: 'PASS' | 'FAIL';
  totalDurationMs: number;
  stages: StageTrace[];
}

export class PipelineTracer {
  private sessionId: string;
  private presetId: string;
  private architecture?: string;
  private processor?: string;
  private startTime: number;
  private stages: StageTrace[] = [];
  private currentStage?: Partial<StageTrace>;

  constructor(sessionId: string, presetId: string, architecture?: string, processor?: string) {
    this.sessionId = sessionId;
    this.presetId = presetId;
    this.architecture = architecture;
    this.processor = processor;
    this.startTime = Date.now();
  }

  startStage(stageName: string, executedCommand: string = 'Internal Pipeline Step'): void {
    const now = new Date();
    this.currentStage = {
      stageName,
      startTimestamp: now.toISOString(),
      executedCommand,
      exitCode: 'IN_PROGRESS',
      stdout: '',
      stderr: '',
      producedArtifacts: [],
      verificationResult: { passed: false, issues: [] },
    };
  }

  recordStageExecution(
    executedCommand: string,
    exitCode: number | string,
    stdout: string,
    stderr: string
  ): void {
    if (!this.currentStage) return;
    this.currentStage.executedCommand = executedCommand;
    this.currentStage.exitCode = exitCode;
    this.currentStage.stdout = stdout;
    this.currentStage.stderr = stderr;
  }

  completeStage(
    producedArtifacts: string[] = [],
    verificationResult: StageVerificationResult = { passed: true, issues: [] }
  ): StageTrace {
    const finishDate = new Date();
    const startDate = this.currentStage?.startTimestamp
      ? new Date(this.currentStage.startTimestamp)
      : finishDate;

    const completedStage: StageTrace = {
      stageName: this.currentStage?.stageName || 'Unknown Stage',
      startTimestamp: startDate.toISOString(),
      finishTimestamp: finishDate.toISOString(),
      durationMs: finishDate.getTime() - startDate.getTime(),
      executedCommand: this.currentStage?.executedCommand || 'N/A',
      exitCode: this.currentStage?.exitCode !== undefined ? this.currentStage.exitCode : 0,
      stdout: this.currentStage?.stdout || '',
      stderr: this.currentStage?.stderr || '',
      producedArtifacts,
      verificationResult,
      rootCause: verificationResult.passed ? undefined : (verificationResult.issues[0] || 'Stage verification failed'),
      suggestedResolution: verificationResult.passed
        ? undefined
        : 'Inspect captured stderr/stdout and verify precursor stage artifacts exist.',
    };

    this.stages.push(completedStage);
    this.currentStage = undefined;
    return completedStage;
  }

  failStage(
    exitCode: number | string,
    errorMsg: string,
    rootCause: string,
    suggestedResolution: string,
    stdout: string = '',
    stderr: string = ''
  ): StageTrace {
    const finishDate = new Date();
    const startDate = this.currentStage?.startTimestamp
      ? new Date(this.currentStage.startTimestamp)
      : finishDate;

    const failedStage: StageTrace = {
      stageName: this.currentStage?.stageName || 'Unknown Stage',
      startTimestamp: startDate.toISOString(),
      finishTimestamp: finishDate.toISOString(),
      durationMs: finishDate.getTime() - startDate.getTime(),
      executedCommand: this.currentStage?.executedCommand || 'N/A',
      exitCode,
      stdout: stdout || this.currentStage?.stdout || '',
      stderr: stderr || this.currentStage?.stderr || errorMsg,
      producedArtifacts: this.currentStage?.producedArtifacts || [],
      verificationResult: { passed: false, issues: [errorMsg] },
      rootCause,
      suggestedResolution,
    };

    this.stages.push(failedStage);
    this.currentStage = undefined;
    return failedStage;
  }

  getStages(): StageTrace[] {
    return this.stages;
  }

  generateReport(overallSuccess: boolean): PipelineTraceReport {
    const endTime = Date.now();
    return {
      sessionId: this.sessionId,
      presetId: this.presetId,
      architecture: this.architecture,
      processor: this.processor,
      timestamp: new Date().toISOString(),
      overallStatus: overallSuccess ? 'PASS' : 'FAIL',
      totalDurationMs: endTime - this.startTime,
      stages: this.stages,
    };
  }

  async saveTraceReport(reportsDir: string, overallSuccess: boolean): Promise<string> {
    const report = this.generateReport(overallSuccess);
    await fs.mkdir(reportsDir, { recursive: true });
    const tracePath = path.join(reportsDir, 'pipeline_trace.json');
    await fs.writeFile(tracePath, JSON.stringify(report, null, 2), 'utf-8');
    return tracePath;
  }
}
