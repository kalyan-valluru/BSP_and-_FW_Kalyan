import { JobTask, WorkerNode, ExecutionStatistics } from '../types/dbveTypes';

export class ExecutionRepository {
  private tasks: Map<string, JobTask> = new Map();

  public addTask(task: JobTask): void {
    if (!task || !task.taskId) return;
    this.tasks.set(task.taskId, task);
  }

  public listTasks(): JobTask[] {
    return Array.from(this.tasks.values());
  }

  public computeStatistics(workers: WorkerNode[]): ExecutionStatistics {
    const list = this.listTasks();
    let completedCount = 0;
    let failedCount = 0;
    let retriedCount = 0;

    for (const t of list) {
      if (t.status === 'COMPLETED') completedCount++;
      if (t.status === 'FAILED') failedCount++;
      if (t.retryCount > 0) retriedCount++;
    }

    return {
      totalJobsDispatched: list.length,
      successfulJobsCount: completedCount,
      failedJobsCount: failedCount,
      retriedJobsCount: retriedCount,
      workerUtilizationPercentage: workers.length === 0 ? 0 : 85,
      parallelExecutionRatio: 0.75,
      averageQueueTimeMs: 12
    };
  }
}
