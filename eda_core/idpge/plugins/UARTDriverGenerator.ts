import { GeneratedDriverFile } from '../types/idpgeTypes';
import { VendorDriverTemplateEngine } from '../templates/VendorDriverTemplateEngine';
import crypto from 'crypto';

export interface IDriverGeneratorPlugin {
  readonly id: string;
  readonly name: string;
  generateDriver(context: Record<string, any>): Promise<GeneratedDriverFile[]>;
}

export class UARTDriverGenerator implements IDriverGeneratorPlugin {
  public readonly id = 'generator-uart-driver';
  public readonly name = 'Production UART Peripheral Driver Generator';
  private templateEngine = new VendorDriverTemplateEngine();

  public async generateDriver(context: Record<string, any>): Promise<GeneratedDriverFile[]> {
    const rendered = this.templateEngine.renderDriver('UART', context);
    const files: GeneratedDriverFile[] = [];

    const hChecksum = crypto.createHash('sha256').update(rendered.headerContent).digest('hex');
    files.push({
      filename: 'uart.h',
      relativePath: 'drivers/uart.h',
      content: rendered.headerContent,
      checksumSha256: hChecksum,
      category: 'UART'
    });

    const cChecksum = crypto.createHash('sha256').update(rendered.sourceContent).digest('hex');
    files.push({
      filename: 'uart.c',
      relativePath: 'drivers/uart.c',
      content: rendered.sourceContent,
      checksumSha256: cChecksum,
      category: 'UART'
    });

    return files;
  }
}
