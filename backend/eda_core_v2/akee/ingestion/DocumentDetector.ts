import { DocumentCategory } from '../types/akeeTypes';

export class DocumentDetector {
  public detectDocumentMetadata(filename: string, content: string): { vendor: string; processor: string; version: string } {
    const isXilinx = filename.includes('xilinx') || content.includes('Xilinx') || content.includes('zynq');
    const isStm = filename.includes('stm32') || content.includes('STM32');

    return {
      vendor: isXilinx ? 'AMD Xilinx' : isStm ? 'STMicroelectronics' : 'Generic Vendor',
      processor: isXilinx ? 'zynq-7000' : isStm ? 'stm32h7' : 'generic-cpu',
      version: 'v2.1'
    };
  }
}

export class DocumentClassifier {
  public classifyDocument(filename: string): DocumentCategory {
    if (filename.endsWith('.svd')) return 'SVD';
    if (filename.endsWith('.dts') || filename.endsWith('.dtsi')) return 'DEVICETREE';
    if (filename.includes('trm') || filename.includes('manual')) return 'TRM';
    if (filename.includes('boot')) return 'BOOT_GUIDE';
    return 'DATASHEET';
  }
}
