export type HardwareFailureCategory = 
  | 'FLASH_FAILURE' 
  | 'BOOT_FAILURE' 
  | 'COMMUNICATION_FAILURE' 
  | 'UART_FAILURE' 
  | 'CLOCK_FAILURE' 
  | 'NONE';

export interface TelemetryEvent {
  timestamp: string;
  source: 'UART' | 'JTAG' | 'GPIO' | 'IRQ';
  message: string;
}

export interface HardwareValidationResult {
  validationId: string;
  timestamp: string;
  targetBoardId: string;
  targetProcessorId: string;
  transportType: 'UART' | 'JTAG' | 'OPENOCD' | 'USB';
  status: 'SUCCESS' | 'FAILED' | 'TIMEOUT';
  failureCategory: HardwareFailureCategory;
  bootTimeMs: number;
  durationMs: number;
  uartConsoleLog: string;
  telemetryEvents: TelemetryEvent[];
}

export interface HardwareValidationManifest {
  manifestVersion: string;
  generatorVersion: string;
  validationId: string;
  targetBoardId: string;
  targetProcessorId: string;
  transportType: string;
  timestamp: string;
  status: string;
  failureCategory: HardwareFailureCategory;
  artifactsFlashed: string[];
  bootTimeMs: number;
  durationMs: number;
}

export interface HardwareValidationReport {
  reportId: string;
  timestamp: string;
  targetBoard: string;
  targetProcessor: string;
  result: HardwareValidationResult;
  manifest: HardwareValidationManifest;
  validationTimeMs: number;
}
