import type { HALDevice, HALPeripheral } from './hal_bsp_engine';

export interface TwinNode {
  id: string;
  type: 'cpu' | 'memory' | 'clock' | 'bus' | 'interrupt' | 'dma' | 'pin' | 'peripheral' | 'reset' | 'power';
  label: string;
  detail: string;
  properties: Record<string, any>;
}

export interface TwinEdge {
  source: string;
  target: string;
  relation: string;
}

/**
 * DigitalHardwareTwin
 *
 * Connected system model representing the single source of truth for hardware.
 * All modules (generators, validators, reviews, simulation) query this model.
 */
export class DigitalHardwareTwin {
  boardName: string;
  processor: string;
  architecture: string;
  memorySize: string;
  flashType: string;
  
  nodes: Map<string, TwinNode> = new Map();
  edges: TwinEdge[] = [];

  constructor(device: HALDevice) {
    this.boardName = device.boardName;
    this.processor = device.processor;
    this.architecture = device.architecture;
    this.memorySize = device.memorySize;
    this.flashType = device.flashType;

    this.buildGraph(device);
  }

  private buildGraph(device: HALDevice) {
    // 1. Add CPU Node
    this.addNode({
      id: 'CPU',
      type: 'cpu',
      label: device.processor,
      detail: `SoC Processor Core based on ${device.architecture} architecture.`,
      properties: {
        architecture: device.architecture,
        processor: device.processor,
        frequency: device.clockSources?.[0]?.split('=')?.[1]?.trim() || 'Unknown'
      }
    });

    // 2. Add Memory Node
    this.addNode({
      id: 'DDR_RAM',
      type: 'memory',
      label: 'System RAM',
      detail: `Volatile RAM memory map boundary of size ${device.memorySize}.`,
      properties: {
        size: device.memorySize,
        startAddress: '0x00000000'
      }
    });
    this.addEdge('CPU', 'DDR_RAM', 'controls');

    // 3. Add Flash/Boot Node
    this.addNode({
      id: 'BOOT_FLASH',
      type: 'memory',
      label: 'Boot Flash',
      detail: `Non-volatile storage media type: ${device.flashType}.`,
      properties: {
        type: device.flashType
      }
    });
    this.addEdge('CPU', 'BOOT_FLASH', 'boots_from');

    // 4. Add System Interconnect Bus Node
    const busName = device.architecture.toLowerCase().includes('arm') ? 'AHB/APB Switch Matrix' : 'AXI SmartConnect';
    this.addNode({
      id: 'SYSTEM_BUS',
      type: 'bus',
      label: busName,
      detail: 'High-speed system peripheral interconnect bus network.',
      properties: {
        type: busName,
        dataWidth: '32-bit'
      }
    });
    this.addEdge('CPU', 'SYSTEM_BUS', 'masters');

    // 5. Add Reset Domain & Power Domain Nodes
    this.addNode({
      id: 'RESET_CONTROLLER',
      type: 'reset',
      label: 'System Reset Domain',
      detail: 'Processor System Reset controller driving peripheral resets.',
      properties: {
        activeLow: true
      }
    });
    this.addEdge('CPU', 'RESET_CONTROLLER', 'monitors');

    this.addNode({
      id: 'POWER_CONTROLLER',
      type: 'power',
      label: 'VCC Core Domain',
      detail: 'Power management controller supplying voltage domains.',
      properties: {
        voltage: '1.2V / 3.3V'
      }
    });

    // 6. Process Clock Sources
    const clockSourceNames: string[] = [];
    if (Array.isArray(device.clockSources)) {
      device.clockSources.forEach(c => {
        const parts = c.split('=');
        const name = parts[0].trim();
        const freq = parts[1] ? parts[1].trim() : '100 MHz';
        this.addNode({
          id: `CLK_${name}`,
          type: 'clock',
          label: name,
          detail: `Reference oscillator frequency: ${freq}`,
          properties: { frequency: freq }
        });
        clockSourceNames.push(name);
      });
    }

    // 7. Add Peripherals
    if (Array.isArray(device.peripherals)) {
      device.peripherals.forEach(p => {
        // Peripheral block node
        const peripheralId = p.name;
        this.addNode({
          id: peripheralId,
          type: 'peripheral',
          label: p.name,
          detail: `${p.category} Controller at Base Address ${p.baseAddress}.`,
          properties: {
            category: p.category,
            baseAddress: p.baseAddress,
            driverName: p.driverName,
            busType: p.busType,
            clockSource: p.clockSource,
            clockFrequency: p.clockFrequency,
            operatingMode: p.operatingMode,
            status: p.status,
            memoryRange: p.memoryRange
          }
        });

        // Bus connection
        this.addEdge('SYSTEM_BUS', peripheralId, 'routes_to');
        
        // Power & Reset domain connection
        this.addEdge('RESET_CONTROLLER', peripheralId, 'resets');
        this.addEdge('POWER_CONTROLLER', peripheralId, 'powers');

        // Clock dependency
        if (p.clockSource && p.clockSource !== 'N/A') {
          const clockId = `CLK_${p.clockSource}`;
          if (!this.nodes.has(clockId)) {
            this.addNode({
              id: clockId,
              type: 'clock',
              label: p.clockSource,
              detail: `Dynamic Peripheral Clock domain: ${p.clockFrequency}`,
              properties: { frequency: p.clockFrequency }
            });
          }
          this.addEdge(clockId, peripheralId, 'drives');
        }

        // Interrupt line
        if (p.interrupt) {
          const irqId = `IRQ_${p.interrupt.number}`;
          this.addNode({
            id: irqId,
            type: 'interrupt',
            label: `IRQ #${p.interrupt.number}`,
            detail: `Hardware Interrupt request signal vector (Trigger: ${p.interrupt.trigger}).`,
            properties: {
              number: p.interrupt.number,
              trigger: p.interrupt.trigger,
              priority: p.interrupt.priority || 0
            }
          });
          this.addEdge(peripheralId, irqId, 'asserts');

          // Connect IRQ to CPU
          this.addEdge(irqId, 'CPU', 'signals');
        }

        // DMA connection
        if (p.dma && p.dma !== 'Disabled') {
          const dmaNodeId = `${peripheralId}_DMA`;
          this.addNode({
            id: dmaNodeId,
            type: 'dma',
            label: `DMA Channel`,
            detail: `Direct Memory Access transaction channel bound to ${peripheralId}.`,
            properties: { mode: p.dma }
          });
          this.addEdge(peripheralId, dmaNodeId, 'requests_dma');
          this.addEdge(dmaNodeId, 'DDR_RAM', 'transfers_to');
        }

        // GPIO Pin maps
        if (Array.isArray(p.pins)) {
          p.pins.forEach(pin => {
            const pinNodeId = `PIN_${pin.replace(/[^a-zA-Z0-9_]/g, '_')}`;
            this.addNode({
              id: pinNodeId,
              type: 'pin',
              label: pin,
              detail: `Physical SoC micro-controller pin connection: ${pin}.`,
              properties: { pin }
            });
            this.addEdge(peripheralId, pinNodeId, 'routes_pin');
          });
        }
      });
    }
  }

  addNode(node: TwinNode) {
    this.nodes.set(node.id, node);
  }

  addEdge(source: string, target: string, relation: string) {
    this.edges.push({ source, target, relation });
  }

  getNodes(): TwinNode[] {
    return Array.from(this.nodes.values());
  }

  getEdges(): TwinEdge[] {
    return this.edges;
  }

  getConnectedNodes(nodeId: string): TwinNode[] {
    const connectedIds = new Set<string>();
    this.edges.forEach(e => {
      if (e.source === nodeId) connectedIds.add(e.target);
      if (e.target === nodeId) connectedIds.add(e.source);
    });

    return Array.from(connectedIds)
      .map(id => this.nodes.get(id))
      .filter((n): n is TwinNode => !!n);
  }

  getClockTree(): Record<string, string[]> {
    const tree: Record<string, string[]> = {};
    this.getNodes()
      .filter(n => n.type === 'clock')
      .forEach(clk => {
        const driven: string[] = [];
        this.edges.forEach(e => {
          if (e.source === clk.id && e.relation === 'drives') {
            driven.push(e.target);
          }
        });
        tree[clk.label] = driven;
      });
    return tree;
  }

  getInterruptTree(): Record<string, number> {
    const tree: Record<string, number> = {};
    this.getNodes()
      .filter(n => n.type === 'interrupt')
      .forEach(irq => {
        const edge = this.edges.find(e => e.target === irq.id && e.relation === 'asserts');
        if (edge) {
          tree[edge.source] = irq.properties.number;
        }
      });
    return tree;
  }

  getMemoryMap(): Array<{ peripheral: string; baseAddress: string; range: string }> {
    return this.getNodes()
      .filter(n => n.type === 'peripheral')
      .map(p => {
        const startNum = parseInt((p.properties.baseAddress || '0').replace(/^0x/i, ''), 16);
        const size = p.properties.memoryRange?.size || 0x1000;
        const endStr = isNaN(startNum) ? 'N/A' : '0x' + (startNum + size - 1).toString(16).toUpperCase();
        return {
          peripheral: p.id,
          baseAddress: p.properties.baseAddress,
          range: `${p.properties.baseAddress} - ${endStr}`
        };
      });
  }
}
