import { ProjectFileEntry } from '../types/ibspseTypes';
import { CMakeTemplateEngine } from '../templates/CMakeTemplateEngine';
import { MakefileTemplateEngine } from '../templates/MakefileTemplateEngine';
import crypto from 'crypto';

export interface IProjectScaffoldPlugin {
  readonly id: string;
  readonly name: string;
  scaffoldProject(context: Record<string, any>, upstreamArtifacts: any[]): Promise<ProjectFileEntry[]>;
}

export class BareMetalProjectScaffoldPlugin implements IProjectScaffoldPlugin {
  public readonly id = 'plugin-baremetal-scaffold';
  public readonly name = 'Production Bare-Metal Embedded Project Scaffolding Plugin';
  private cmakeEngine = new CMakeTemplateEngine();
  private makefileEngine = new MakefileTemplateEngine();

  public async scaffoldProject(context: Record<string, any>, upstreamArtifacts: any[]): Promise<ProjectFileEntry[]> {
    const files: ProjectFileEntry[] = [];
    const procId = context.targetProcessorId || 'zynq-7000';

    // 1. Top-Level Main File (src/main.c)
    const mainContent = `/* Main Entry Point for ${procId} Bare-Metal Application */
#include "board.h"

int main(void) {
    /* Initialize All Peripherals via Topological Order */
    Peripheral_Init_All();
    
    while (1) {
        UART_SendChar('A');
    }
    return 0;
}
`;
    files.push({
      filename: 'main.c',
      relativePath: 'src/main.c',
      content: mainContent,
      checksumSha256: crypto.createHash('sha256').update(mainContent).digest('hex'),
      category: 'SOURCE'
    });

    // 2. Map Upstream Artifacts (IBFGE, IDPGE, ISLMCE)
    const seenPaths = new Set<string>();
    for (const art of upstreamArtifacts) {
      let category: any = 'SOURCE';
      if (art.filename.endsWith('.h')) category = 'HEADER';
      else if (art.filename.endsWith('.S')) category = 'STARTUP';
      else if (art.filename.endsWith('.ld')) category = 'LINKER';
      else if (art.filename.endsWith('.dts')) category = 'DEVICETREE';

      let relPath = art.relativePath || art.filename;
      if (art.filename === 'linker.ld') relPath = 'linker/linker.ld';
      if (art.filename === 'startup.S') relPath = 'startup/startup.S';

      if (seenPaths.has(relPath)) continue;
      seenPaths.add(relPath);

      files.push({
        filename: art.filename,
        relativePath: relPath,
        content: art.content,
        checksumSha256: crypto.createHash('sha256').update(art.content).digest('hex'),
        category
      });
    }

    // 3. Build Scripts (CMakeLists.txt, Makefile, toolchain.cmake, compile_commands.json)
    const cmakeContent = this.cmakeEngine.renderBuildScript('cmake', context);
    files.push({
      filename: 'CMakeLists.txt',
      relativePath: 'CMakeLists.txt',
      content: cmakeContent,
      checksumSha256: crypto.createHash('sha256').update(cmakeContent).digest('hex'),
      category: 'BUILD_SCRIPT'
    });

    const toolchainContent = this.cmakeEngine.renderBuildScript('toolchain', context);
    files.push({
      filename: 'toolchain.cmake',
      relativePath: 'toolchain.cmake',
      content: toolchainContent,
      checksumSha256: crypto.createHash('sha256').update(toolchainContent).digest('hex'),
      category: 'BUILD_SCRIPT'
    });

    const makefileContent = this.makefileEngine.renderBuildScript('makefile', context);
    files.push({
      filename: 'Makefile',
      relativePath: 'Makefile',
      content: makefileContent,
      checksumSha256: crypto.createHash('sha256').update(makefileContent).digest('hex'),
      category: 'BUILD_SCRIPT'
    });

    const compileCmds = this.makefileEngine.renderBuildScript('compile_commands', context);
    files.push({
      filename: 'compile_commands.json',
      relativePath: 'compile_commands.json',
      content: compileCmds,
      checksumSha256: crypto.createHash('sha256').update(compileCmds).digest('hex'),
      category: 'BUILD_SCRIPT'
    });

    // 4. README.md & Build Config
    const readmeContent = `# ${procId} Production Embedded Software Project\n\n## Build Instructions\n\`\`\`bash\nmake all\n\`\`\`\n`;
    files.push({
      filename: 'README.md',
      relativePath: 'README.md',
      content: readmeContent,
      checksumSha256: crypto.createHash('sha256').update(readmeContent).digest('hex'),
      category: 'DOC'
    });

    return files;
  }
}
