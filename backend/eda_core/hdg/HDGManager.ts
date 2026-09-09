import { DirectedGraph } from './graph/DirectedGraph';
import { TopologicalSort } from './algorithms/TopologicalSort';
import { CycleDetector } from './algorithms/CycleDetector';
import { ImpactAnalyzer } from './algorithms/ImpactAnalyzer';
import { HDGQueryEngine } from './query/HDGQueryEngine';
import { HDGValidator } from './validator/HDGValidator';
import { UHKBManager } from '../uhkb/UHKBManager';
import { HDGValidationIssue, ImpactAnalysisResult } from './types/hdgTypes';

export class HDGManager {
  private static instance: HDGManager;

  public readonly graph = new DirectedGraph();
  public readonly topoSort = new TopologicalSort();
  public readonly cycleDetector = new CycleDetector();
  public readonly impactAnalyzer = new ImpactAnalyzer();
  public readonly queryEngine = new HDGQueryEngine();
  public readonly validator = new HDGValidator();

  private uhkb = UHKBManager.getInstance();
  private isConstructed = false;

  private constructor() {}

  public static getInstance(): HDGManager {
    if (!HDGManager.instance) {
      HDGManager.instance = new HDGManager();
    }
    return HDGManager.instance;
  }

  /**
   * Constructs the Hardware Dependency Graph from Universal Hardware Knowledge Base
   */
  public async buildGraph(): Promise<{ nodesCount: number; validationIssues: HDGValidationIssue[] }> {
    if (this.isConstructed) {
      return { nodesCount: this.graph.countNodes(), validationIssues: [] };
    }

    console.log('[HDG] Building Hardware Dependency Graph...');
    await this.uhkb.initialize();
    this.graph.clear();

    const zynqProc = this.uhkb.queryEngine.findProcessor('zynq-7000');
    if (zynqProc) {
      // Add nodes
      this.graph.addNode({ id: 'zedboard', type: 'board', name: 'ZedBoard' });
      this.graph.addNode({ id: zynqProc.id, type: 'processor', name: zynqProc.name });
      this.graph.addNode({ id: 'ps7_cortexa9_0', type: 'processor', name: 'Cortex-A9 Core 0' });
      this.graph.addNode({ id: 'fclk_0', type: 'clock_controller', name: 'FPGA Fabric Clock 0' });
      this.graph.addNode({ id: 'ddr3_ram', type: 'memory_region', name: 'DDR3 Memory' });
      this.graph.addNode({ id: 'gic_0', type: 'interrupt_controller', name: 'Generic Interrupt Controller' });
      this.graph.addNode({ id: 'axi_uartlite_0', type: 'peripheral', name: 'AXI UART Lite' });
      this.graph.addNode({ id: 'xuartlite_driver', type: 'driver', name: 'Xilinx UART Lite Driver' });

      // Add directed dependencies (Edges)
      this.graph.addEdge({ sourceId: 'zedboard', targetId: zynqProc.id, type: 'HOSTS_PROCESSOR' });
      this.graph.addEdge({ sourceId: zynqProc.id, targetId: 'ps7_cortexa9_0', type: 'HOSTS_PROCESSOR' });
      this.graph.addEdge({ sourceId: zynqProc.id, targetId: 'fclk_0', type: 'REQUIRES_CLOCK' });
      this.graph.addEdge({ sourceId: zynqProc.id, targetId: 'ddr3_ram', type: 'REQUIRES_MEMORY' });
      this.graph.addEdge({ sourceId: zynqProc.id, targetId: 'gic_0', type: 'ROUTES_INTERRUPT' });

      this.graph.addEdge({ sourceId: 'fclk_0', targetId: 'axi_uartlite_0', type: 'REQUIRES_CLOCK' });
      this.graph.addEdge({ sourceId: 'ddr3_ram', targetId: 'axi_uartlite_0', type: 'REQUIRES_MEMORY' });
      this.graph.addEdge({ sourceId: 'gic_0', targetId: 'axi_uartlite_0', type: 'ROUTES_INTERRUPT' });
      this.graph.addEdge({ sourceId: 'axi_uartlite_0', targetId: 'xuartlite_driver', type: 'REQUIRES_DRIVER' });
    }

    const validationIssues = this.validator.validateGraph(this.graph);
    this.isConstructed = true;
    console.log(`[HDG] Hardware Dependency Graph construction complete. Total Nodes: ${this.graph.countNodes()}`);

    return { nodesCount: this.graph.countNodes(), validationIssues };
  }

  public analyzeImpact(sourceEntityId: string): ImpactAnalysisResult {
    return this.impactAnalyzer.analyzeImpact(this.graph, sourceEntityId);
  }

  public resetState(): void {
    this.graph.clear();
    this.isConstructed = false;
  }
}
