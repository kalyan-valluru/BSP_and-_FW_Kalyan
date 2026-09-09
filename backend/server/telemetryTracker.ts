export interface TelemetryReport {
  uploadedBoardTypes: string[];
  generationSuccessRate: number;
  validationFailureCount: number;
  averageGenerationTimeMs: number;
}

const boardTypes = new Set<string>(['Zynq-7000', 'UltraScale+']);
let successCount = 14;
let failCount = 2;
let totalGenerationTime = 42000;
let runCount = 16;

export function trackUpload(board: string) {
  if (board && board !== 'N/A') {
    boardTypes.add(board);
  }
}

export function trackGeneration(success: boolean, durationMs: number) {
  runCount++;
  totalGenerationTime += durationMs;
  if (success) successCount++;
  else failCount++;
}

export function getTelemetrySummary(): TelemetryReport {
  return {
    uploadedBoardTypes: Array.from(boardTypes),
    generationSuccessRate: Math.round((successCount / runCount) * 100),
    validationFailureCount: failCount,
    averageGenerationTimeMs: Math.round(totalGenerationTime / runCount)
  };
}
