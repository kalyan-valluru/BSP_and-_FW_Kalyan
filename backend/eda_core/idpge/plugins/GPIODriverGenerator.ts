import { IDriverGeneratorPlugin } from './UARTDriverGenerator';
import { GeneratedDriverFile } from '../types/idpgeTypes';
import { VendorDriverTemplateEngine } from '../templates/VendorDriverTemplateEngine';
import crypto from 'crypto';

export class GPIODriverGenerator implements IDriverGeneratorPlugin {
  public readonly id = 'generator-gpio-driver';
  public readonly name = 'Production GPIO Peripheral Driver Generator';
  private templateEngine = new VendorDriverTemplateEngine();

  public async generateDriver(context: Record<string, any>): Promise<GeneratedDriverFile[]> {
    const rendered = this.templateEngine.renderDriver('GPIO', context);
    const files: GeneratedDriverFile[] = [];

    files.push({
      filename: 'gpio.h',
      relativePath: 'drivers/gpio.h',
      content: rendered.headerContent,
      checksumSha256: crypto.createHash('sha256').update(rendered.headerContent).digest('hex'),
      category: 'GPIO'
    });

    files.push({
      filename: 'gpio.c',
      relativePath: 'drivers/gpio.c',
      content: rendered.sourceContent,
      checksumSha256: crypto.createHash('sha256').update(rendered.sourceContent).digest('hex'),
      category: 'GPIO'
    });

    return files;
  }
}
