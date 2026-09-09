export type RuntimeFaultCategory = 'BOOT_FAILURE' | 'MEMORY_FAULT' | 'HARD_FAULT' | 'TIMEOUT' | 'NONE';

export interface RuntimeEvent {
  timestamp: string;
  eventType: 'UART_LOG' | 'INTERRUPT' | 'MEMORY_READ' | 'MEMORY_WRITE' | 'FAULT';
  message: string;
}

export interface SimulationResult {
  simId: string;
  timestamp: string;
  simulatorName: string;
  targetMachine: string;
  status: 'SUCCESS' | 'FAULT' | 'TIMEOUT';
  faultCategory: RuntimeFaultCategory;
  exitCode: number;
  durationMs: number;
  uartConsoleOutput: string;
  events: RuntimeEvent[];
}

export interface SimulationManifest {
  manifestVersion: string;
  generatorVersion: string;
  simId: string;
  simulatorName: string;
  targetMachine: string;
  timestamp: string;
  status: string;
  faultCategory: RuntimeFaultCategory;
  artifactsUsed: string[];
  durationMs: number;
}

export interface SimulationReport {
  reportId: string;
  timestamp: string;
  targetProcessor: string;
  simulatorName: string;
  result: SimulationResult;
  manifest: SimulationManifest;
  simulationTimeMs: number;
}
