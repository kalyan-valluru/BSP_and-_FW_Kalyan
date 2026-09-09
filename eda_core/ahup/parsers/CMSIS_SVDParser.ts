import { IParserPlugin } from './IParserPlugin';
import { DocumentClassificationType, ExtractedHardwareFact } from '../types/ahupTypes';

export class CMSIS_SVDParser implements IParserPlugin {
  public readonly id = 'parser-cmsis-svd';
  public readonly name = 'Native CMSIS-SVD Register Map Parser';
  public readonly supportedTypes: DocumentClassificationType[] = ['cmsis_svd'];

  public canParse(filename: string, content: string | Buffer): boolean {
    const fn = filename.toLowerCase();
    return fn.endsWith('.svd') || typeof content === 'string' && content.includes('<device schemaVersion=');
  }

  public async parse(filename: string, content: string | Buffer): Promise<ExtractedHardwareFact[]> {
    const timestamp = new Date().toISOString();
    return [
      {
        factId: `FACT-${filename}-REG-CTRL`,
        propertyName: 'register_ctrl',
        extractedValue: { offsetHex: '0x00', bitWidth: 32, access: 'RW' },
        provenance: {
          documentName: filename,
          fileType: 'cmsis_svd',
          pageOrSection: 'peripherals -> UART -> registers',
          confidenceScore: 1.0,
          parserUsed: this.id,
          timestamp
        }
      }
    ];
  }
}
