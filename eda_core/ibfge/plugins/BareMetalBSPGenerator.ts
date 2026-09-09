import { GeneratedArtifactFile } from '../types/ibfgeTypes';
import { BareMetalTemplateEngine } from '../templates/BareMetalTemplateEngine';
import crypto from 'crypto';

export interface IGeneratorPlugin {
  readonly id: string;
  readonly name: string;
  generateBSP(context: Record<string, any>): Promise<GeneratedArtifactFile[]>;
}

export class BareMetalBSPGenerator implements IGeneratorPlugin {
  public readonly id = 'generator-baremetal-bsp';
  public readonly name = 'Production Bare-Metal BSP & Driver Generator';
  private templateEngine = new BareMetalTemplateEngine();

  public async generateBSP(context: Record<string, any>): Promise<GeneratedArtifactFile[]> {
    const files: GeneratedArtifactFile[] = [];

    const fileTemplates = [
      { name: 'system_init.c', path: 'src/system_init.c', lang: 'c' },
      { name: 'startup.S', path: 'startup/startup.S', lang: 'assembly' },
      { name: 'board.h', path: 'include/board.h', lang: 'header' },
      { name: 'linker.ld', path: 'linker/linker.ld', lang: 'linker' }
    ];

    for (const item of fileTemplates) {
      const content = this.templateEngine.render(item.name, context);
      const checksum = crypto.createHash('sha256').update(content).digest('hex');

      files.push({
        filename: item.name,
        relativePath: item.path,
        content,
        checksumSha256: checksum,
        language: item.lang as any
      });
    }

    return files;
  }
}
