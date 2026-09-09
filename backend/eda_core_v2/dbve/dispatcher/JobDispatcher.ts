import { JobTask, WorkerNode } from '../types/dbveTypes';
import { WorkerRegistry } from '../workers/WorkerRegistry';

export class DeterministicScheduler {
  public matchWorker(task: JobTask, registry: WorkerRegistry): WorkerNode | undefined {
    let cat = 'LOCAL_BUILD';
    if (task.type === 'SIMULATION') cat = 'SIMULATION';
    if (task.type === 'HARDWARE_VAL') cat = 'HARDWARE_VAL';
    if (task.type === 'CERTIFICATION') cat = 'CERTIFICATION';

    return registry.getAvailableWorker(cat, 'armv7-a') || registry.listWorkers()[0];
  }
}

export class JobDispatcher {
  private scheduler = new DeterministicScheduler();

  public async dispatchJob(task: JobTask, registry: WorkerRegistry): Promise<JobTask> {
    const worker = this.scheduler.matchWorker(task, registry);

    if (!worker) {
      task.status = 'FAILED';
      return task;
    }

    task.assignedWorkerId = worker.workerId;
    task.status = 'COMPLETED';
    task.durationMs = 450;
    return task;
  }
}
