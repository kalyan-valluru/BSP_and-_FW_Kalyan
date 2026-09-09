import * as fs from 'fs/promises';
import * as path from 'path';
import { VKRPeripheral } from '../vkr/vkrTypes';

export interface ExtractedRegisterField {
  name: string;
  bitOffset: number;
  bitWidth: number;
  access?: string;
  description?: string;
}

export interface ExtractedRegisterSpec {
  name: string;
  addressOffset: string;
  resetValue: string;
  resetMask?: string;
  access?: string;
  fields: ExtractedRegisterField[];
}

export interface CMSISParseResult {
  processorName: string;
  peripherals: VKRPeripheral[];
  registers: Record<string, ExtractedRegisterSpec[]>;
}

export class CMSISSVDParser {
  public async parseFile(filePath: string, vendor: string): Promise<CMSISParseResult> {
    const filename = path.basename(filePath);
    console.log(`[DOM CMSIS-SVD PARSER] DOM-parsing SVD spec: ${filename}...`);

    const result: CMSISParseResult = {
      processorName: filename.replace('.svd', '').toUpperCase(),
      peripherals: [],
      registers: {}
    };

    try {
      const stats = await fs.stat(filePath);
      if (stats.size > 50000000) return result;

      const xmlText = await fs.readFile(filePath, 'utf8');
      const peripheralsBlock = this.getTagContent(xmlText, 'peripherals');
      if (!peripheralsBlock) return result;

      const peripheralNodes = this.getAllTagBlocks(peripheralsBlock, 'peripheral');
      for (const pNode of peripheralNodes) {
        const name = this.getTagContent(pNode, 'name') || 'PERIPH';
        const baseAddress = this.getTagContent(pNode, 'baseAddress') || '0x40000000';
        const irqVal = this.getTagContent(pNode, 'value');

        result.peripherals.push({
          name,
          baseAddress,
          irq: irqVal ? parseInt(irqVal, 10) : undefined,
          busInterface: 'AHB / APB',
          provenance: {
            document: filename,
            documentType: 'CMSIS-SVD',
            vendor,
            chapter: 'Peripherals DOM Tree',
            section: 'Register Map',
            parserVersion: 'v2.1.0-dom',
            importVersion: 'v25.03',
            checksum: 'svd_hash',
            confidence: 1.0,
            extractionTimestamp: new Date().toISOString()
          }
        });

        // Parse Register Map & Reset Values for Peripheral
        const registersNode = this.getTagContent(pNode, 'registers');
        if (registersNode) {
          const regNodes = this.getAllTagBlocks(registersNode, 'register');
          const regList: ExtractedRegisterSpec[] = [];

          for (const rNode of regNodes) {
            const regName = this.getTagContent(rNode, 'name') || 'REG';
            const addressOffset = this.getTagContent(rNode, 'addressOffset') || '0x0';
            const resetValue = this.getTagContent(rNode, 'resetValue') || '0x00000000';
            const access = this.getTagContent(rNode, 'access') || 'read-write';

            const fieldsNode = this.getTagContent(rNode, 'fields');
            const fieldList: ExtractedRegisterField[] = [];
            if (fieldsNode) {
              const fieldNodes = this.getAllTagBlocks(fieldsNode, 'field');
              for (const fNode of fieldNodes) {
                const fName = this.getTagContent(fNode, 'name') || 'FIELD';
                const bitOffset = parseInt(this.getTagContent(fNode, 'bitOffset') || '0', 10);
                const bitWidth = parseInt(this.getTagContent(fNode, 'bitWidth') || '1', 10);
                fieldList.push({ name: fName, bitOffset, bitWidth, access });
              }
            }

            regList.push({
              name: regName,
              addressOffset,
              resetValue,
              access,
              fields: fieldList
            });
          }

          result.registers[name] = regList;
        }
      }
    } catch (err: any) {
      console.error(`[DOM CMSIS-SVD PARSER ERROR] ${filePath}: ${err.message}`);
    }

    return result;
  }


  private getTagContent(xml: string, tag: string): string | null {
    const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(xml);
    return match ? match[1].trim() : null;
  }

  private getAllTagBlocks(xml: string, tag: string): string[] {
    const blocks: string[] = [];
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    let match;
    while ((match = regex.exec(xml)) !== null) {
      blocks.push(match[1]);
    }
    return blocks;
  }
}
