import { WorkerRegistry } from '../workers/WorkerRegistry';
import { JobDispatcher } from '../dispatcher/JobDispatcher';
import { ExecutionRepository } from '../repository/ExecutionRepository';
import { JobTask, DistributedExecutionReport } from '../types/dbveTypes';

export class DBVEPipeline {
  public registry = new WorkerRegistry();
  private dispatcher = new JobDispatcher();
  public repository = new ExecutionRepository();

  constructor() {
    this.initDefaultWorkers();
  }

  private initDefaultWorkers(): void {
    const timestamp = new Date().toISOString();
    this.registry.registerWorker({
      workerId: 'worker-local-build-1',
      name: 'Local High-Speed Build Worker',
      category: 'LOCAL_BUILD',
      supportedArchitectures: ['armv7-a', 'riscv64', 'x86_64'],
      supportedToolchains: ['arm-none-eabi-gcc', 'riscv64-unknown-elf-gcc'],
      maxConcurrentJobs: 4,
      currentActiveJobs: 0,
      status: 'ONLINE',
      heartbeatTimestamp: timestamp
    });

    this.registry.registerWorker({
      workerId: 'worker-sim-qemu-1',
      name: 'QEMU Virtual Hardware Simulation Worker',
      category: 'SIMULATION',
      supportedArchitectures: ['armv7-a', 'armv7e-m', 'riscv64'],
      supportedToolchains: ['qemu-system-arm', 'qemu-system-riscv64'],
      maxConcurrentJobs: 2,
      currentActiveJobs: 0,
      status: 'ONLINE',
      heartbeatTimestamp: timestamp
    });
  }

  /**
   * Executes 7-Stage Distributed Build & Validation Pipeline
   */
  public async executeWorkload(tasks: JobTask[]): Promise<DistributedExecutionReport> {
    const timestamp = new Date().toISOString();

    // Stage 1 - 5: Match workers, dispatch tasks, execute, track artifact lineage
    for (const task of tasks) {
      const dispatched = await this.dispatcher.dispatchJob(task, this.registry);
      this.repository.addTask(dispatched);
    }

    const allTasks = this.repository.listTasks();
    const activeWorkers = this.registry.listWorkers();
    const stats = this.repository.computeStatistics(activeWorkers);

    return {
      reportId: `DBVE-REP-${Date.now()}`,
      timestamp,
      tasks: allTasks,
      activeWorkers,
      statistics: stats
    };
  }
}
