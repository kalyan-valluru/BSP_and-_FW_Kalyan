import { IGeneratorPlugin } from './BareMetalBSPGenerator';
import { GeneratedArtifactFile } from '../types/ibfgeTypes';
import { LinuxDeviceTreeTemplateEngine } from '../templates/LinuxDeviceTreeTemplateEngine';
import crypto from 'crypto';

export class LinuxBSPGenerator implements IGeneratorPlugin {
  public readonly id = 'generator-linux-bsp';
  public readonly name = 'Linux DeviceTree & BSP Generator';
  private templateEngine = new LinuxDeviceTreeTemplateEngine();

  public async generateBSP(context: Record<string, any>): Promise<GeneratedArtifactFile[]> {
    const files: GeneratedArtifactFile[] = [];
    const dtsContent = this.templateEngine.render('device_tree.dts', context);
    const checksum = crypto.createHash('sha256').update(dtsContent).digest('hex');

    files.push({
      filename: 'system.dts',
      relativePath: 'arch/arm/boot/dts/system.dts',
      content: dtsContent,
      checksumSha256: checksum,
      language: 'devicetree'
    });

    const makefileContent = "# Linux DeviceTree Compilation Makefile\nall:\n\tdtc -I dts -O dtb -o system.dtb system.dts\n";
    files.push({
      filename: 'Makefile',
      relativePath: 'Makefile',
      content: makefileContent,
      checksumSha256: crypto.createHash('sha256').update(makefileContent).digest('hex'),
      language: 'makefile'
    });

    return files;
  }
}
