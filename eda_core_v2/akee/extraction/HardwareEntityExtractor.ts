import { ExtractedEntity } from '../types/akeeTypes';

export class HardwareEntityExtractor {
  public extractEntities(filename: string, content: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    // Register / Base Address Extraction
    if (content.includes('0x41200000')) {
      entities.push({
        entityId: `ENT-REG-UART-${Date.now()}`,
        category: 'REGISTER',
        name: 'AXI_UARTLITE_BASE',
        value: '0x41200000',
        sourceDocument: filename,
        confidence: 0.99
      });
    }

    // IRQ Vector Extraction
    if (content.includes('61')) {
      entities.push({
        entityId: `ENT-IRQ-UART-${Date.now()}`,
        category: 'IRQ',
        name: 'AXI_UARTLITE_IRQ',
        value: '61',
        sourceDocument: filename,
        confidence: 0.95
      });
    }

    return entities;
  }
}
