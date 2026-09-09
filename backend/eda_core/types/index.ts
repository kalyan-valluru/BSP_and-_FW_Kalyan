export interface BaseEntity {
  id: string;
  name: string;
  description?: string;
  version?: string;
  metadata?: Record<string, any>;
}

export interface ProcessorEntity extends BaseEntity {
  vendorId: string;
  architecture: string;
  family: string;
  registerWidth: 32 | 64;
  defaultClockMHz: number;
  coresCount: number;
  memoryRanges: { name: string; start: string; size: string }[];
}

export interface PeripheralEntity extends BaseEntity {
  vendorId: string;
  category: 'UART' | 'SPI' | 'I2C' | 'GPIO' | 'TIMER' | 'ETH' | 'CAN' | 'USB' | 'CUSTOM';
  registerMapSize: number;
  supportedBuses: string[];
  defaultDrivers: string[];
}

export interface BoardEntity extends BaseEntity {
  vendorId: string;
  processorId: string;
  fpgaPartNumber?: string;
  flashSizeBytes: number;
  ramSizeBytes: number;
  onboardPeripherals: string[];
}

export interface VendorEntity extends BaseEntity {
  website?: string;
  supportedArchitectures: string[];
  toolchainIds: string[];
}

export interface ToolchainEntity extends BaseEntity {
  vendorId: string;
  compilerBinary: string;
  supportedArchitectures: string[];
  minimumVersion: string;
  defaultFlags: string;
}

export interface RuleEntity extends BaseEntity {
  category: 'address_overlap' | 'clock_sanity' | 'irq_collision' | 'pinmux' | 'bus_bandwidth';
  severity: 'critical' | 'warning' | 'info';
  enabled: boolean;
}
