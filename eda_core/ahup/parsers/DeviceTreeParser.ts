import { IParserPlugin } from './IParserPlugin';
import { DocumentClassificationType, ExtractedHardwareFact } from '../types/ahupTypes';

export class DeviceTreeParser implements IParserPlugin {
  public readonly id = 'parser-device-tree';
  public readonly name = 'Native DeviceTree (.dts/.dtsi) Parser';
  public readonly supportedTypes: DocumentClassificationType[] = ['device_tree'];

  public canParse(filename: string, content: string | Buffer): boolean {
    const fn = filename.toLowerCase();
    return fn.endsWith('.dts') || fn.endsWith('.dtsi') || typeof content === 'string' && content.includes('/dts-v1/');
  }

  public async parse(filename: string, content: string | Buffer): Promise<ExtractedHardwareFact[]> {
    const str = typeof content === 'string' ? content : content.toString('utf-8');
    const facts: ExtractedHardwareFact[] = [];
    const timestamp = new Date().toISOString();

    // Regex extraction for compatible processor/board
    const compMatch = str.match(/compatible\s*=\s*"([^"]+)"/);
    if (compMatch) {
      facts.push({
        factId: `FACT-${filename}-COMPATIBLE`,
        propertyName: 'compatible',
        extractedValue: compMatch[1],
        provenance: {
          documentName: filename,
          fileType: 'device_tree',
          pageOrSection: 'root node',
          confidenceScore: 1.0,
          parserUsed: this.id,
          timestamp
        }
      });
    }

    // Regex extraction for peripheral baseAddress and irq
    const uartBlock = str.match(/serial[^{]*\{[^}]*\}/i) || str.match(/uart[^{]*\{[^}]*\}/i);
    if (uartBlock) {
      const regMatch = uartBlock[0].match(/reg\s*=\s*<\s*(0x[0-9a-fA-F]+)/);
      const irqMatch = uartBlock[0].match(/interrupts\s*=\s*<\s*(\d+)/);

      facts.push({
        factId: `FACT-${filename}-UART-BASE`,
        propertyName: 'uart_base_address',
        extractedValue: regMatch ? regMatch[1] : 'UNKNOWN',
        provenance: {
          documentName: filename,
          fileType: 'device_tree',
          pageOrSection: 'serial@41200000',
          confidenceScore: regMatch ? 1.0 : 0.0,
          parserUsed: this.id,
          timestamp
        }
      });

      facts.push({
        factId: `FACT-${filename}-UART-IRQ`,
        propertyName: 'uart_irq',
        extractedValue: irqMatch ? parseInt(irqMatch[1], 10) : 'UNKNOWN',
        provenance: {
          documentName: filename,
          fileType: 'device_tree',
          pageOrSection: 'serial@41200000',
          confidenceScore: irqMatch ? 1.0 : 0.0,
          parserUsed: this.id,
          timestamp
        }
      });
    }

    return facts;
  }
}
