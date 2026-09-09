import { WorkerNode } from '../types/dbveTypes';

export class WorkerRegistry {
  private workers: Map<string, WorkerNode> = new Map();

  public registerWorker(worker: WorkerNode): void {
    if (!worker || !worker.workerId) return;
    this.workers.set(worker.workerId, worker);
  }

  public getWorker(id: string): WorkerNode | undefined {
    return this.workers.get(id);
  }

  public listWorkers(): WorkerNode[] {
    return Array.from(this.workers.values());
  }

  public getAvailableWorker(category: string, arch: string): WorkerNode | undefined {
    for (const w of this.workers.values()) {
      if (w.status === 'ONLINE' && w.category === category && w.supportedArchitectures.includes(arch)) {
        return w;
      }
    }
    return undefined;
  }
}
