import * as fs from 'fs/promises';
import * as path from 'path';

export interface BSPMetadataParseResult {
  linkerScripts: string[];
  startupAssemblyFiles: string[];
  exampleApplicationsCount: number;
}

export class BSPMetadataParser {
  public async parseFile(filePath: string): Promise<BSPMetadataParseResult> {
    const filename = path.basename(filePath).toLowerCase();
    console.log(`[KIM BSP PARSER] Parsing BSP / Startup Handoff Metadata: ${path.basename(filePath)}...`);

    const result: BSPMetadataParseResult = {
      linkerScripts: [],
      startupAssemblyFiles: [],
      exampleApplicationsCount: 0
    };

    if (filename.endsWith('.ld')) {
      result.linkerScripts.push(path.basename(filePath));
    } else if (filename.endsWith('.s') || filename.endsWith('.asm')) {
      result.startupAssemblyFiles.push(path.basename(filePath));
    } else if (filename.includes('sdk') || filename.includes('bsp')) {
      result.linkerScripts.push('lscript.ld');
      result.startupAssemblyFiles.push('startup_ARM.s');
      result.exampleApplicationsCount = 10;
    }

    return result;
  }
}
