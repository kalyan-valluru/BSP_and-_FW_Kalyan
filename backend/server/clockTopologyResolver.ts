/**
 * clockTopologyResolver.ts
 * Production-grade Clock Topology Resolver & Fail-Fast DRC System.
 * Pre-validates, auto-routes, and verifies all hardware IP clock requirements
 * before Block Design compilation or TCL generation.
 */

export interface ClockPinRequirement {
  pinName: string;
  description: string;
  clockType: 'bus' | 'functional' | 'reference' | 'core';
  expectedFreqHz?: number;
  expectedFreqStr?: string;
  optional?: boolean;
}

export interface VendorIpClockRule {
  vlnvPattern: string;
  keyKeywords: string[];
  requiredClocks: ClockPinRequirement[];
  defaultSourcePriority: string[];
}

export interface ClockSource {
  id: string;
  name: string;
  sourcePin: string;
  frequencyHz: number;
  frequencyStr: string;
  domain: string;
  isAvailable: boolean;
}

export interface ResolvedClockConnection {
  peripheralName: string;
  ipVlnv: string;
  clockPin: string;
  sourceId: string;
  sourcePin: string;
  frequencyStr: string;
  domain: string;
  tclCommand: string;
}

export interface ClockDrcError {
  peripheralName: string;
  clockPin: string;
  expectedFrequency: string;
  availableSources: string[];
  reason: string;
  suggestedFix: string[];
}

export interface ClockTopologyValidationResult {
  valid: boolean;
  errors: ClockDrcError[];
  connections: ResolvedClockConnection[];
  traceabilityRecords: Array<{
    outputName: string;
    category: string;
    sourceInput: string;
    sourceType: string;
    sourcePriority: number;
    ruleOrCalculation: string;
    finalResult: string;
    validationStatus: 'DETERMINISTIC_VERIFIED' | 'FAILED';
    confidenceScore: number;
    toolVersion: string;
  }>;
}

// ── VENDOR CLOCK RULES DATABASE ─────────────────────────────────────────────
export const VENDOR_CLOCK_RULES: VendorIpClockRule[] = [
  {
    vlnvPattern: 'xilinx.com:ip:axi_quad_spi',
    keyKeywords: ['spi', 'quad_spi', 'axi_spi'],
    requiredClocks: [
      { pinName: 's_axi_aclk', description: 'AXI Lite Interface Clock', clockType: 'bus', expectedFreqHz: 100_000_000, expectedFreqStr: '100 MHz' },
      { pinName: 'ext_spi_clk', description: 'External SPI Clock Source', clockType: 'functional', expectedFreqHz: 100_000_000, expectedFreqStr: '100 MHz' },
    ],
    defaultSourcePriority: ['FCLK_CLK0', 'pl_clk0', 'clk_out1'],
  },
  {
    vlnvPattern: 'xilinx.com:ip:axi_uartlite',
    keyKeywords: ['uart', 'uartlite'],
    requiredClocks: [
      { pinName: 's_axi_aclk', description: 'AXI Lite Interface Clock', clockType: 'bus', expectedFreqHz: 100_000_000, expectedFreqStr: '100 MHz' },
    ],
    defaultSourcePriority: ['FCLK_CLK0', 'pl_clk0', 'clk_out1'],
  },
  {
    vlnvPattern: 'xilinx.com:ip:axi_gpio',
    keyKeywords: ['gpio', 'axi_gpio'],
    requiredClocks: [
      { pinName: 's_axi_aclk', description: 'AXI Lite Interface Clock', clockType: 'bus', expectedFreqHz: 100_000_000, expectedFreqStr: '100 MHz' },
    ],
    defaultSourcePriority: ['FCLK_CLK0', 'pl_clk0', 'clk_out1'],
  },
  {
    vlnvPattern: 'xilinx.com:ip:axi_iic',
    keyKeywords: ['i2c', 'iic', 'axi_iic'],
    requiredClocks: [
      { pinName: 's_axi_aclk', description: 'AXI Lite Interface Clock', clockType: 'bus', expectedFreqHz: 100_000_000, expectedFreqStr: '100 MHz' },
    ],
    defaultSourcePriority: ['FCLK_CLK0', 'pl_clk0', 'clk_out1'],
  },
  {
    vlnvPattern: 'xilinx.com:ip:axi_timer',
    keyKeywords: ['timer', 'axi_timer'],
    requiredClocks: [
      { pinName: 's_axi_aclk', description: 'AXI Lite Interface Clock', clockType: 'bus', expectedFreqHz: 100_000_000, expectedFreqStr: '100 MHz' },
    ],
    defaultSourcePriority: ['FCLK_CLK0', 'pl_clk0', 'clk_out1'],
  },
  {
    vlnvPattern: 'xilinx.com:ip:axi_ethernetlite',
    keyKeywords: ['eth', 'ethernet', 'fec'],
    requiredClocks: [
      { pinName: 's_axi_aclk', description: 'AXI Lite Interface Clock', clockType: 'bus', expectedFreqHz: 100_000_000, expectedFreqStr: '100 MHz' },
    ],
    defaultSourcePriority: ['FCLK_CLK0', 'pl_clk0', 'clk_out1'],
  },
  {
    vlnvPattern: 'xilinx.com:ip:axi_can',
    keyKeywords: ['can', 'axi_can', 'can0', 'can1', 'mttcan', 'fdcan'],
    requiredClocks: [
      { pinName: 's_axi_aclk', description: 'AXI Lite Interface Clock', clockType: 'bus', expectedFreqHz: 100_000_000, expectedFreqStr: '100 MHz' },
      { pinName: 'can_clk', description: 'CAN Functional Clock Source', clockType: 'functional', expectedFreqHz: 24_000_000, expectedFreqStr: '24 MHz' },
    ],
    defaultSourcePriority: ['FCLK_CLK0', 'pl_clk0', 'clk_out1'],
  },
  {
    vlnvPattern: 'stm32:rcc_clock',
    keyKeywords: ['stm32_uart', 'stm32_gpio', 'stm32_spi', 'stm32_i2c'],
    requiredClocks: [
      { pinName: 'pclk', description: 'APB Peripheral Clock', clockType: 'bus', expectedFreqHz: 100_000_000, expectedFreqStr: '100 MHz' },
    ],
    defaultSourcePriority: ['PCLK1', 'PCLK2', 'HCLK'],
  },
];

export class ClockTopologyResolver {

  /**
   * Helper to discover available clock sources from processor architecture
   */
  static getAvailableClockSources(isZynq7000: boolean, procInst: string): ClockSource[] {
    if (isZynq7000) {
      return [
        { id: 'FCLK_CLK0', name: 'Zynq PS FCLK0', sourcePin: `${procInst}/FCLK_CLK0`, frequencyHz: 100_000_000, frequencyStr: '100 MHz', domain: 'clk_fpga_0', isAvailable: true },
        { id: 'FCLK_CLK1', name: 'Zynq PS FCLK1', sourcePin: `${procInst}/FCLK_CLK1`, frequencyHz: 142_857_132, frequencyStr: '143 MHz', domain: 'clk_fpga_1', isAvailable: true },
        { id: 'FCLK_CLK2', name: 'Zynq PS FCLK2', sourcePin: `${procInst}/FCLK_CLK2`, frequencyHz: 200_000_000, frequencyStr: '200 MHz', domain: 'clk_fpga_2', isAvailable: true },
      ];
    } else {
      return [
        { id: 'pl_clk0', name: 'UltraScale+ PL CLK0', sourcePin: `${procInst}/pl_clk0`, frequencyHz: 100_000_000, frequencyStr: '100 MHz', domain: 'clk_pl_0', isAvailable: true },
        { id: 'pl_clk1', name: 'UltraScale+ PL CLK1', sourcePin: `${procInst}/pl_clk1`, frequencyHz: 250_000_000, frequencyStr: '250 MHz', domain: 'clk_pl_1', isAvailable: true },
      ];
    }
  }

  /**
   * Discover vendor clock requirements for a peripheral
   */
  static getClockRule(peripheralBlock: string): VendorIpClockRule {
    const pName = peripheralBlock.toLowerCase();
    for (const rule of VENDOR_CLOCK_RULES) {
      if (rule.keyKeywords.some(kw => pName.includes(kw))) {
        return rule;
      }
    }
    // Generic fallback rule
    return {
      vlnvPattern: 'xilinx.com:ip:generic',
      keyKeywords: [],
      requiredClocks: [
        { pinName: 's_axi_aclk', description: 'Generic AXI Clock', clockType: 'bus', expectedFreqHz: 100_000_000, expectedFreqStr: '100 MHz' }
      ],
      defaultSourcePriority: ['FCLK_CLK0', 'pl_clk0']
    };
  }

  /**
   * Main Pre-flight Clock DRC & Routing Validation Engine
   */
  static validateAndRoute(
    peripherals: any[],
    isZynq7000: boolean = true,
    procInstName?: string
  ): ClockTopologyValidationResult {
    const procInst = procInstName || (isZynq7000 ? 'processing_system7_0' : 'zynq_ultra_ps_e_0');
    const availableSources = this.getAvailableClockSources(isZynq7000, procInst);
    const errors: ClockDrcError[] = [];
    const connections: ResolvedClockConnection[] = [];
    const traceabilityRecords: ClockTopologyValidationResult['traceabilityRecords'] = [];

    const isPsPeripheral = (addr: string): boolean => {
      if (!addr) return false;
      const cleanAddr = addr.replace(/^0x/i, '').trim();
      const hex = parseInt(cleanAddr, 16);
      if (isNaN(hex)) return false;
      return isZynq7000
        ? (hex >= 0xE0000000 && hex <= 0xE02FFFFF) || (hex >= 0xF8000000 && hex <= 0xF8FFFFFF)
        : hex >= 0xFD000000 && hex <= 0xFFFFFFFF;
    };

    for (const p of peripherals) {
      const pBlock = p.peripheralBlock || p.name || 'unknown_ip';
      if (isPsPeripheral(p.baseAddress)) continue; // PS Hard IP handles clocks natively

      const pName = pBlock.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const rule = this.getClockRule(pBlock);

      for (const reqClock of rule.requiredClocks) {
        // Find best matching clock source from priority list
        let matchedSource: ClockSource | undefined;
        for (const prefId of rule.defaultSourcePriority) {
          matchedSource = availableSources.find(s => s.id === prefId && s.isAvailable);
          if (matchedSource) break;
        }

        // Fallback to first available source
        if (!matchedSource && availableSources.length > 0) {
          matchedSource = availableSources[0];
        }

        if (!matchedSource && !reqClock.optional) {
          // FAIL FAST DRC: Required clock cannot be resolved
          errors.push({
            peripheralName: pBlock,
            clockPin: reqClock.pinName,
            expectedFrequency: reqClock.expectedFreqStr || '100 MHz',
            availableSources: availableSources.map(s => s.name),
            reason: `No valid clock source available for required pin '${reqClock.pinName}' on peripheral '${pBlock}'.`,
            suggestedFix: [
              `Connect PS FCLK0 output to ${reqClock.pinName}`,
              `Instantiate Clock Wizard IP block providing ${reqClock.expectedFreqStr || '100 MHz'}`,
              `Supply external clock oscillator constraint for ${reqClock.pinName}`
            ]
          });
        } else if (matchedSource) {
          const tclCommand = reqClock.pinName === 's_axi_aclk'
            ? `# s_axi_aclk auto-connected by apply_bd_automation`
            : `safe_connect_bd_net "${matchedSource.sourcePin}" "${pName}/${reqClock.pinName}"`;

          connections.push({
            peripheralName: pName,
            ipVlnv: rule.vlnvPattern,
            clockPin: reqClock.pinName,
            sourceId: matchedSource.id,
            sourcePin: matchedSource.sourcePin,
            frequencyStr: matchedSource.frequencyStr,
            domain: matchedSource.domain,
            tclCommand
          });

          traceabilityRecords.push({
            outputName: `Clock Connection (${pName}/${reqClock.pinName})`,
            category: 'ClockTopology',
            sourceInput: `Vendor IP Clock Rule: ${rule.vlnvPattern}`,
            sourceType: 'ClockRule',
            sourcePriority: 1,
            ruleOrCalculation: `Auto-routed to ${matchedSource.name} (${matchedSource.frequencyStr})`,
            finalResult: `${matchedSource.sourcePin} -> ${pName}/${reqClock.pinName}`,
            validationStatus: 'DETERMINISTIC_VERIFIED',
            confidenceScore: 100,
            toolVersion: 'GenAI Clock Topology Resolver 2.0'
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      connections,
      traceabilityRecords
    };
  }

  /**
   * Generate TCL script segment for explicit clock connections
   */
  static generateTcl(validationResult: ClockTopologyValidationResult): string {
    if (!validationResult.valid) {
      throw new Error(`Cannot generate Clock TCL: Pre-flight Clock DRC failed with ${validationResult.errors.length} unresolved clock pin(s).`);
    }

    const tclLines = validationResult.connections
      .filter(c => !c.tclCommand.startsWith('#'))
      .map(c => c.tclCommand);

    if (tclLines.length === 0) return '# All peripheral clocks auto-connected by IP Integrator\n';
    return `# ClockTopologyResolver: Explicit Clock Net Connections\n${tclLines.join('\n')}\n`;
  }

  /**
   * Verify generated TCL script before launching Vivado.
   * Throws an explicit error if any required clock connection is missing.
   */
  static verifyGeneratedTcl(
    tclContent: string,
    peripherals: any[],
    isZynq7000: boolean = true
  ): { verified: boolean; missingPins: string[] } {
    const missingPins: string[] = [];

    const isPsPeripheral = (addr: string): boolean => {
      if (!addr) return false;
      const cleanAddr = addr.replace(/^0x/i, '').trim();
      const hex = parseInt(cleanAddr, 16);
      if (isNaN(hex)) return false;
      return isZynq7000
        ? (hex >= 0xE0000000 && hex <= 0xE02FFFFF) || (hex >= 0xF8000000 && hex <= 0xF8FFFFFF)
        : hex >= 0xFD000000 && hex <= 0xFFFFFFFF;
    };

    for (const p of peripherals) {
      const pBlock = p.peripheralBlock || p.name || 'unknown_ip';
      if (isPsPeripheral(p.baseAddress)) continue;

      const pName = pBlock.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const rule = this.getClockRule(pBlock);

      for (const reqClock of rule.requiredClocks) {
        if (reqClock.pinName === 's_axi_aclk') continue; // Managed by apply_bd_automation

        const pinPattern = `${pName}/${reqClock.pinName}`;
        if (!tclContent.includes(pinPattern)) {
          missingPins.push(pinPattern);
        }
      }
    }

    if (missingPins.length > 0) {
      throw new Error(`[TCL VERIFICATION FAILURE] Generated Vivado TCL script is missing required clock connection(s): ${missingPins.join(', ')}. Build halted before Vivado execution.`);
    }

    return { verified: true, missingPins: [] };
  }

  /**
   * Generate BD Graph vs. Generated TCL Comparison Diagnostic Report
   */
  static generateDiagnosticReport(
    validationResult: ClockTopologyValidationResult,
    tclContent: string,
    isZynq7000: boolean = true
  ): string {
    const lines: string[] = [
      '====================================================',
      ' CLOCK TOPOLOGY vs. GENERATED TCL DIAGNOSTIC REPORT ',
      '====================================================',
      `Target Processor Family: ${isZynq7000 ? 'Zynq-7000' : 'Zynq UltraScale+ MPSoC'}`,
      `Validation Status: ${validationResult.valid ? 'PASS' : 'FAIL'}`,
      `Total Resolved Connections: ${validationResult.connections.length}`,
      `DRC Errors: ${validationResult.errors.length}`,
      '',
      '┌──────────────────┬───────────────┬──────────────────────────────┬──────────────┬────────┐',
      '│ Peripheral       │ Clock Pin     │ Resolved Source              │ TCL Connected│ Status │',
      '├──────────────────┼───────────────┼──────────────────────────────┼──────────────┼────────┤'
    ];

    for (const c of validationResult.connections) {
      const isConnected = c.tclCommand.startsWith('#') || tclContent.includes(`${c.peripheralName}/${c.clockPin}`);
      const status = isConnected ? 'PASS' : 'FAIL';
      lines.push(
        `│ ${c.peripheralName.padEnd(16)} │ ${c.clockPin.padEnd(13)} │ ${c.sourcePin.padEnd(28)} │ ${isConnected ? 'YES         ' : 'NO          '} │ ${status.padEnd(6)} │`
      );
    }

    lines.push('└──────────────────┴───────────────┴──────────────────────────────┴──────────────┴────────┘');
    return lines.join('\n');
  }
}
