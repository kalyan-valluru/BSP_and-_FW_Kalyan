export type HDGNodeType = 
  | 'board'
  | 'processor'
  | 'clock_controller'
  | 'reset_controller'
  | 'memory_region'
  | 'interrupt_controller'
  | 'dma_controller'
  | 'pin_controller'
  | 'peripheral'
  | 'register'
  | 'interrupt'
  | 'clock_source'
  | 'dma_channel'
  | 'driver'
  | 'power_domain'
  | 'boot_config'
  | 'os_support'
  | 'toolchain';

export type HDGEdgeType = 
  | 'REQUIRES_CLOCK'
  | 'REQUIRES_RESET'
  | 'REQUIRES_MEMORY'
  | 'ROUTES_INTERRUPT'
  | 'USES_DMA'
  | 'USES_PIN'
  | 'CONTAINS_REGISTER'
  | 'REQUIRES_DRIVER'
  | 'SUPPORTS_OS'
  | 'REQUIRES_TOOLCHAIN'
  | 'POWERED_BY'
  | 'HOSTS_PROCESSOR';

export interface HDGNode {
  id: string;
  type: HDGNodeType;
  name: string;
  attributes?: Record<string, any>;
}

export interface HDGEdge {
  sourceId: string;
  targetId: string;
  type: HDGEdgeType;
  metadata?: Record<string, any>;
}

export interface ImpactAnalysisResult {
  sourceEntityId: string;
  directlyAffectedCount: number;
  totalAffectedCount: number;
  affectedNodes: HDGNode[];
}

export interface HDGValidationIssue {
  nodeId: string;
  severity: 'error' | 'warning';
  message: string;
}
