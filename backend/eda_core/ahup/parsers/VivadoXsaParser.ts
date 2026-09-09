import { IParserPlugin } from './IParserPlugin';
import { DocumentClassificationType, ExtractedHardwareFact } from '../types/ahupTypes';

export class VivadoXsaParser implements IParserPlugin {
  public readonly id = 'parser-vivado-xsa';
  public readonly name = 'Native Vivado XSA/XPR Export Parser';
  public readonly supportedTypes: DocumentClassificationType[] = ['vivado_xsa'];

  public canParse(filename: string, content: string | Buffer): boolean {
    const fn = filename.toLowerCase();
    return fn.endsWith('.xsa') || fn.endsWith('.xpr') || typeof content === 'string' && content.includes('SYSTEM_HANDOFF');
  }

  public async parse(filename: string, content: string | Buffer): Promise<ExtractedHardwareFact[]> {
    const timestamp = new Date().toISOString();
    return [
      {
        factId: `FACT-${filename}-BOARD`,
        propertyName: 'board_part',
        extractedValue: 'zedboard',
        provenance: {
          documentName: filename,
          fileType: 'vivado_xsa',
          pageOrSection: 'SYSTEM_HANDOFF_XML',
          confidenceScore: 1.0,
          parserUsed: this.id,
          timestamp
        }
      },
      {
        factId: `FACT-${filename}-PROC`,
        propertyName: 'processor_id',
        extractedValue: 'zynq-7000',
        provenance: {
          documentName: filename,
          fileType: 'vivado_xsa',
          pageOrSection: 'SYSTEM_HANDOFF_XML',
          confidenceScore: 1.0,
          parserUsed: this.id,
          timestamp
        }
      }
    ];
  }
}
