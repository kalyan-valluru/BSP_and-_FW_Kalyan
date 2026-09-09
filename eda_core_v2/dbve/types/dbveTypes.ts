export type WorkerCategory = 'LOCAL_BUILD' | 'REMOTE_BUILD' | 'SIMULATION' | 'HARDWARE_VAL' | 'CERTIFICATION';

export interface WorkerNode {
  workerId: string;
  name: string;
  category: WorkerCategory;
  supportedArchitectures: string[];
  supportedToolchains: string[];
  maxConcurrentJobs: number;
  currentActiveJobs: number;
  status: 'ONLINE' | 'BUSY' | 'OFFLINE';
  heartbeatTimestamp: string;
}

export interface JobTask {
  taskId: string;
  type: 'BSP_GEN' | 'DRIVER_GEN' | 'COMPILE' | 'SIMULATION' | 'HARDWARE_VAL' | 'CERTIFICATION';
  targetProcessorId: string;
  toolchain: string;
  status: 'PENDING' | 'DISPATCHED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  assignedWorkerId?: string;
  retryCount: number;
  maxRetries: number;
  durationMs?: number;
}

export interface ExecutionStatistics {
  totalJobsDispatched: number;
  successfulJobsCount: number;
  failedJobsCount: number;
  retriedJobsCount: number;
  workerUtilizationPercentage: number;
  parallelExecutionRatio: number;
  averageQueueTimeMs: number;
}

export interface DistributedExecutionReport {
  reportId: string;
  timestamp: string;
  tasks: JobTask[];
  activeWorkers: WorkerNode[];
  statistics: ExecutionStatistics;
}
