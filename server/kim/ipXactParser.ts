import * as fs from 'fs/promises';
import * as path from 'path';
import { VKRPeripheral } from '../vkr/vkrTypes';

export interface IPXACTParseResult {
  ipName: string;
  peripherals: VKRPeripheral[];
}

export class IPXACTParser {
  public async parseFile(filePath: string, vendor: string): Promise<IPXACTParseResult> {
    const filename = path.basename(filePath);
    console.log(`[KIM IP-XACT PARSER] Parsing IEEE 1685 IP-XACT XML: ${filename}...`);

    const result: IPXACTParseResult = {
      ipName: filename.replace('.xml', ''),
      peripherals: []
    };

    try {
      const buf = await fs.readFile(filePath);
      const xml = buf.toString('utf8', 0, Math.min(buf.length, 500000));

      const addrBlockRegex = /<spirit:addressBlock>([\s\S]*?)<\/spirit:addressBlock>/g;
      let match;

      while ((match = addrBlockRegex.exec(xml)) !== null) {
        const block = match[1];
        const nameMatch = /<spirit:name>\s*([a-zA-Z0-9_]+)\s*<\/spirit:name>/.exec(block);
        const baseMatch = /<spirit:baseAddress>\s*(0x[0-9a-fA-F]+|[0-9]+)\s*<\/spirit:baseAddress>/.exec(block);

        if (nameMatch && baseMatch) {
          result.peripherals.push({
            name: nameMatch[1],
            baseAddress: baseMatch[1],
            busInterface: 'AXI4-Lite',
            provenance: {
              document: filename,
              documentType: 'IP-XACT',
              vendor,
              chapter: 'AddressBlock',
              parser: 'ipXactParser',
              confidence: 0.98
            }
          });
        }
      }
    } catch (err: any) {
      console.error(`[IP-XACT PARSER ERROR] ${filePath}: ${err.message}`);
    }

    return result;
  }
}
