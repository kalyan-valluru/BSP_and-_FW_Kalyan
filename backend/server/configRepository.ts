import fs from 'fs/promises';
import path from 'path';
import { llmRouter } from '../ai/router/llmRouter';

export interface BoardConfig {
  id: string;
  name: string;
  vendor: string;
  architecture: string;
  frequency: string;
  memorySize: string;
  flashType: string;
  defaultBus: string;
  defaultClock: string;
  defaultFreq: string;
  memoryRegions: Array<{ start: string; end: string; name: string }>;
  suggestedBaseAddresses: Record<string, string>;
  defaultDrivers: Record<string, string>;
}

export interface ProcessorConfig {
  name: string;
  architecture: string;
  cores: number;
  wordSize: number;
  interruptController: string;
}

export interface VendorRuleConfig {
  vendor: string;
  toolchain: string;
  dtsCompatiblePrefix: string;
  supportedArchitectures: string[];
  bspHeader: string;
  driverRules: Record<string, string>;
}

export class ConfigurationRepository {
  private boards: Map<string, BoardConfig> = new Map();
  private processors: Map<string, ProcessorConfig> = new Map();
  private vendors: Map<string, VendorRuleConfig> = new Map();
  private initialized = false;

  constructor() {
    this.loadDefaultsInMemory();
  }

  /**
   * Load baseline defaults in memory as a safe fallback
   */
  private loadDefaultsInMemory() {
    const defaultBoards: BoardConfig[] = [
      {
        id: 'xilinx-zynq-7000',
        name: 'Xilinx Zynq-7000',
        vendor: 'Xilinx',
        architecture: 'ARM Cortex-A9 + FPGA',
        frequency: '667 MHz',
        memorySize: '512 MB',
        flashType: 'QSPI Flash',
        defaultBus: 'AXI4-Lite',
        defaultClock: 's_axi_aclk',
        defaultFreq: '100 MHz',
        memoryRegions: [
          { start: '0x40000000', end: '0x7FFFFFFF', name: 'PL AXI GP0' },
          { start: '0x80000000', end: '0xBFFFFFFF', name: 'PL AXI GP1' },
          { start: '0xE0000000', end: '0xE02FFFFF', name: 'IOP Registers' },
        ],
        suggestedBaseAddresses: {
          uart: '0x40600000', gpio: '0x41200000', i2c: '0x41600000', spi: '0x44A00000', timer: '0x41C00000',
          can: '0xE0008000', eth: '0xE000B000', usb: '0xE0002000', sd: '0xE000E000',
        },
        defaultDrivers: {
          uart: 'xuartlite', gpio: 'xgpio', i2c: 'xiic', spi: 'xspi', timer: 'xtmrctr',
          can: 'xcanps', eth: 'xemacps', usb: 'xusbps', sd: 'xsdps',
        },
      },
      {
        id: 'xilinx-zynq-mpsoc',
        name: 'Xilinx Zynq MPSoC',
        vendor: 'Xilinx',
        architecture: 'ARM Cortex-A53 + FPGA',
        frequency: '1.2 GHz',
        memorySize: '2 GB',
        flashType: 'QSPI Flash',
        defaultBus: 'AXI4-Lite',
        defaultClock: 's_axi_aclk',
        defaultFreq: '100 MHz',
        memoryRegions: [
          { start: '0xFF000000', end: '0xFFBFFFFF', name: 'LPD Peripheral Map' },
          { start: '0xFD000000', end: '0xFDFFFFFF', name: 'FPD Peripheral Map' },
        ],
        suggestedBaseAddresses: {
          uart: '0xFF010000', gpio: '0xFF0A0000', i2c: '0xFF020000', spi: '0xFF040000',
          can: '0xFF060000', eth: '0xFF0B0000', usb: '0xFF9D0000', sd: '0xFF160000',
        },
        defaultDrivers: {
          uart: 'xuartps', gpio: 'xgpiops', i2c: 'xiicps', spi: 'xspips', timer: 'xttcps',
          can: 'xcanps', eth: 'xemacps', usb: 'xusbps', sd: 'xsdps',
        },
      },
      {
        id: 'stm32h7',
        name: 'STM32H7',
        vendor: 'STMicroelectronics',
        architecture: 'ARM Cortex-M7',
        frequency: '480 MHz',
        memorySize: '2 MB Flash',
        flashType: 'Internal Flash',
        defaultBus: 'APB/AHB',
        defaultClock: 'PCLK',
        defaultFreq: '100 MHz',
        memoryRegions: [
          { start: '0x40000000', end: '0x5FFFFFFF', name: 'APB/AHB Peripherals' },
        ],
        suggestedBaseAddresses: {
          uart: '0x40013800', gpio: '0x58020000', i2c: '0x40005400', spi: '0x40013000',
          timer: '0x40016C00', adc: '0x40022400', sd: '0x52007000', can: '0x4000A000',
        },
        defaultDrivers: {
          uart: 'stm32_uart', gpio: 'stm32_gpio', i2c: 'stm32_i2c', spi: 'stm32_spi',
          timer: 'stm32_timer', adc: 'stm32_adc', can: 'stm32_fdcan',
        },
      },
    ];

    for (const board of defaultBoards) {
      this.boards.set(board.id, board);
    }
  }

  /**
   * Load JSON configurations dynamically from disk (`data/` or `backend/data/`)
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const possibleDataDirs = [
        path.join(process.cwd(), 'data'),
        path.join(process.cwd(), 'backend', 'data'),
      ];

      for (const dataDir of possibleDataDirs) {
        const boardsDir = path.join(dataDir, 'boards');
        try {
          const files = await fs.readdir(boardsDir);
          for (const file of files) {
            if (file.endsWith('.json')) {
              const content = await fs.readFile(path.join(boardsDir, file), 'utf-8');
              const board: BoardConfig = JSON.parse(content);
              if (board.id) {
                this.boards.set(board.id, board);
              }
            }
          }
        } catch {
          // Directory may not exist yet, fall through
        }
      }
      this.initialized = true;
      console.log(`[ConfigRepo] Loaded ${this.boards.size} board configuration(s) into runtime repository.`);
    } catch (err: any) {
      console.warn(`[ConfigRepo] Initialization note: ${err.message}`);
    }
  }

  public getBoard(id: string): BoardConfig | undefined {
    return this.boards.get(id) || Array.from(this.boards.values()).find(b => b.name.toLowerCase() === id.toLowerCase());
  }

  public getAllBoards(): BoardConfig[] {
    return Array.from(this.boards.values());
  }

  /**
   * Automatically match hardware specification against repository or use AI inference for novel inputs
   */
  public async detectOrInferHardware(rawContent: string, fileName?: string): Promise<{
    board: BoardConfig;
    inferred: boolean;
    confidence: number;
  }> {
    await this.initialize();

    const lower = rawContent.toLowerCase();

    // 1. Direct Rule Matching against registered boards
    for (const board of this.boards.values()) {
      if (
        lower.includes(board.id.toLowerCase()) ||
        lower.includes(board.name.toLowerCase()) ||
        (board.vendor && lower.includes(board.vendor.toLowerCase()) && lower.includes(board.architecture.toLowerCase()))
      ) {
        return { board, inferred: false, confidence: 95 };
      }
    }

    // Keyword heuristics
    if (lower.includes('zynq-7') || lower.includes('xc7z') || lower.includes('arm cortex-a9')) {
      const b = this.getBoard('xilinx-zynq-7000') || Array.from(this.boards.values())[0];
      return { board: b, inferred: true, confidence: 90 };
    }
    if (lower.includes('mpsoc') || lower.includes('xczu') || lower.includes('cortex-a53')) {
      const b = this.getBoard('xilinx-zynq-mpsoc') || Array.from(this.boards.values())[0];
      return { board: b, inferred: true, confidence: 90 };
    }
    if (lower.includes('stm32') || lower.includes('cortex-m7')) {
      const b = this.getBoard('stm32h7') || Array.from(this.boards.values())[0];
      return { board: b, inferred: true, confidence: 90 };
    }

    // 2. AI-Assisted Hardware Inference via LLM Router for completely generic new inputs
    try {
      console.log(`[ConfigRepo] Unrecognized file (${fileName || 'custom_upload'}). Invoking AI Router for generic hardware inference...`);
      const prompt = `Analyze this custom user hardware specification file and extract the architecture, vendor, processor, memory base addresses, and peripheral list.
File Name: ${fileName || 'uploaded_spec'}
Content Sample:
${rawContent.slice(0, 1500)}

Return a raw JSON object matching this shape:
{
  "id": "custom-board",
  "name": "Custom Hardware Board",
  "vendor": "Generic",
  "architecture": "ARM Cortex-A9",
  "frequency": "500 MHz",
  "memorySize": "512 MB",
  "flashType": "Flash",
  "defaultBus": "AXI4-Lite",
  "defaultClock": "sys_clk",
  "defaultFreq": "100 MHz",
  "memoryRegions": [{"start": "0x40000000", "end": "0x7FFFFFFF", "name": "PL Region"}],
  "suggestedBaseAddresses": {"uart": "0x40600000", "gpio": "0x41200000"},
  "defaultDrivers": {"uart": "generic_uart", "gpio": "generic_gpio"}
}`;

      const aiResponse = await llmRouter.generate({
        prompt,
        taskCategory: 'complex_hardware',
      });

      if (aiResponse.success && aiResponse.output) {
        const clean = aiResponse.output.replace(/```json/g, '').replace(/```/g, '').trim();
        const inferredBoard: BoardConfig = JSON.parse(clean);
        return { board: inferredBoard, inferred: true, confidence: 85 };
      }
    } catch (err: any) {
      console.warn(`[ConfigRepo] AI Inference failed: ${err.message}. Falling back to default board template.`);
    }

    // Fallback: Return first available board template
    const fallbackBoard = Array.from(this.boards.values())[0];
    return { board: fallbackBoard, inferred: true, confidence: 70 };
  }
}

export const configRepository = new ConfigurationRepository();
