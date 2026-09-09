import * as fs from 'fs/promises';
import * as path from 'path';

export interface ExtractedPeripheralMap {
  peripheralBlock: string;
  baseAddress: string;
  interruptNumber?: number;
  bus?: string;
  clockSource?: string;
  driverName?: string;
  evidence: string;
}

export interface TRMParseResult {
  processorName: string;
  peripherals: Record<string, ExtractedPeripheralMap>;
  rawMemoryRanges: { start: string; end: string; label: string }[];
}

export class TRMParser {
  public async parseFile(filePath: string): Promise<TRMParseResult> {
    const filename = path.basename(filePath).toLowerCase();
    console.log(`[KIM TRM PARSER] Parsing Technical Reference Manual: ${path.basename(filePath)}...`);

    const result: TRMParseResult = {
      processorName: this.inferProcessorFromFilename(filename),
      peripherals: {},
      rawMemoryRanges: []
    };

    try {
      const stats = await fs.stat(filePath);
      const isZip = filename.endsWith('.zip');
      const buf = await fs.readFile(filePath);
      const isPdf = filename.endsWith('.pdf') || buf.slice(0, 4).toString() === '%PDF';
      const contentText = buf.toString('utf8', 0, Math.min(buf.length, 100000));

      if (isZip || isPdf) {
        // Parse document for genuine register addresses via text regex without injecting synthetic defaults
        const text = contentText;

        const periphMatches = text.matchAll(/([A-Z0-9_]{3,15})\s+(?:base|address|reg)?\s*[:=]?\s*(0x[0-9A-Fa-f]{8})/g);
        for (const match of periphMatches) {
          const name = match[1];
          const addr = match[2].toUpperCase();
          if (!result.peripherals[name]) {
            result.peripherals[name] = {
              peripheralBlock: name,
              baseAddress: addr,
              bus: 'AHB/AXI',
              evidence: `Parsed from document ${path.basename(filePath)}`
            };
          }
        }
        return result;
      }


      // Extract Hex Address Mappings via Regex Search over TRM text
      const addrRegex = /([a-zA-Z0-9_-]{2,20})\s*(?:@|base\s+address|at|range)?\s*[:=]?\s*(0x[0-9a-fA-F]{8})/gi;
      let match;
      while ((match = addrRegex.exec(contentText)) !== null) {
        const pBlock = match[1].toLowerCase();
        const hexAddr = match[2];

        if (['uart', 'usart', 'gpio', 'spi', 'i2c', 'timer', 'eth', 'dma', 'adc', 'can', 'sys'].some(k => pBlock.includes(k))) {
          if (!result.peripherals[pBlock]) {
            result.peripherals[pBlock] = {
              peripheralBlock: pBlock,
              baseAddress: hexAddr,
              bus: this.inferBusType(pBlock),
              evidence: `Extracted base address ${hexAddr} for ${pBlock} from TRM document.`
            };
          }
        }
      }

    } catch (err: any) {
      console.error(`[KIM TRM PARSER ERROR] ${filePath}: ${err.message}`);
    }

    return result;
  }

  private inferProcessorFromFilename(filename: string): string {
    if (filename.includes('imx8') || filename.includes('imx')) return 'i.MX 8M Plus';
    if (filename.includes('am64')) return 'AM64x Sitara';
    if (filename.includes('stm32mp1')) return 'STM32MP157';
    if (filename.includes('stm32h7')) return 'STM32H743';
    if (filename.includes('stm32f4')) return 'STM32F407';
    if (filename.includes('ug1085') || filename.includes('zynq')) return 'Zynq UltraScale+';
    if (filename.includes('bcm2711')) return 'BCM2711';
    if (filename.includes('bcm2712')) return 'BCM2712';
    if (filename.includes('esp32')) return 'ESP32-C3';
    if (filename.includes('rp2040')) return 'RP2040';
    if (filename.includes('rp2350')) return 'RP2350';
    return 'Generic Embedded Processor';
  }

  private inferBusType(pBlock: string): string {
    if (pBlock.includes('gpio') || pBlock.includes('timer') || pBlock.includes('uart') || pBlock.includes('i2c')) return 'APB / AXI4-Lite';
    if (pBlock.includes('dma') || pBlock.includes('eth') || pBlock.includes('sd')) return 'AHB / AXI4';
    return 'System Bus';
  }
}
