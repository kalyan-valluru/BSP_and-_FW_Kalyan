import { BoardComponent, BoardTopology } from '../types/abdeTypes';

export class BoardConflictResolver {
  public resolveConflicts(components: BoardComponent[]): BoardComponent[] {
    const compMap: Map<string, BoardComponent> = new Map();
    for (const c of components) {
      compMap.set(c.componentId, c);
    }
    return Array.from(compMap.values());
  }
}

export class TopologyReconstructor {
  public reconstructTopology(components: BoardComponent[]): BoardTopology {
    return {
      powerDomains: [
        { railName: 'VCC_3V3', voltageV: 3.3, sourceComponentId: 'PMIC_1' },
        { railName: 'VCC_1V8', voltageV: 1.8, sourceComponentId: 'PMIC_1' },
        { railName: 'VCC_DDR_1V5', voltageV: 1.5, sourceComponentId: 'PMIC_1' }
      ],
      clockSources: [
        { clockName: 'PS_CLK', frequencyHz: 33333333, sourceComponentId: 'OSC_1' },
        { clockName: 'ETH_CLK', frequencyHz: 125000000, sourceComponentId: 'OSC_2' }
      ],
      resetTopology: [
        { resetName: 'PS_POR_B', activeLow: true },
        { resetName: 'PS_SRST_B', activeLow: true }
      ],
      memoryMap: [
        { regionName: 'DDR_RAM', startAddress: '0x00000000', sizeBytes: 536870912 },
        { regionName: 'QSPI_NOR', startAddress: '0xFC000000', sizeBytes: 33554432 }
      ],
      peripheralMap: [
        { peripheralId: 'eth0', componentId: 'U4' },
        { peripheralId: 'qspi0', componentId: 'U3' }
      ]
    };
  }
}
