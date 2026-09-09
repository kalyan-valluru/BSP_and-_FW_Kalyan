export interface ClockConfig {
  source: string;
  frequencyHz: number;
  pllSource?: string;
  enabled: boolean;
}

export interface MemoryRange {
  name: string;
  baseAddress: string;
  sizeBytes: number;
  type: 'RAM' | 'ROM' | 'Flash' | 'Register';
  readOnly: boolean;
}

export interface InterruptRoute {
  sourcePeripheral: string;
  lineIndex: number;
  irqNumber: number;
  priority: number;
  triggerType: 'edge_rising' | 'edge_falling' | 'level_high' | 'level_low';
}

export interface BusNode {
  name: string;
  type: 'AXI4' | 'AXI4-Lite' | 'AHB' | 'APB' | 'APB4' | 'VBUSM';
  masterPort: string;
  slavePort: string;
  clockDomain: string;
}

export interface DMAChannel {
  id: string;
  peripheralBlock: string;
  direction: 'memory_to_peripheral' | 'peripheral_to_memory' | 'memory_to_memory';
  fifoDepthBytes: number;
  burstSizeBytes: number;
}

export interface HardwareTwin {
  clocks: Record<string, ClockConfig>;
  memoryMap: MemoryRange[];
  interrupts: InterruptRoute[];
  busTopology: BusNode[];
  dmaChannels: DMAChannel[];
}

export interface HardwareAbstractionLayer {
  configureClocks(clocks: Record<string, ClockConfig>): Promise<boolean>;
  getMemoryMap(): Promise<MemoryRange[]>;
  routeInterrupts(routes: InterruptRoute[]): Promise<boolean>;
  discoverPeripherals(): Promise<string[]>;
  getBusTopology(): Promise<BusNode[]>;
}
