import { GeneratedMemoryFile } from '../types/islmceTypes';
import { ArchitectureLinkerTemplateEngine } from '../templates/ArchitectureLinkerTemplateEngine';
import crypto from 'crypto';

export interface IStartupPlugin {
  readonly id: string;
  readonly name: string;
  generateStartupAndMemory(context: Record<string, any>): Promise<GeneratedMemoryFile[]>;
}

export class ARMCortexAStartupPlugin implements IStartupPlugin {
  public readonly id = 'plugin-arm-cortex-a-startup';
  public readonly name = 'ARM Cortex-A (Zynq-7000 / i.MX8) Startup & Memory Plugin';
  private templateEngine = new ArchitectureLinkerTemplateEngine();

  public async generateStartupAndMemory(context: Record<string, any>): Promise<GeneratedMemoryFile[]> {
    const files: GeneratedMemoryFile[] = [];

    // 1. Linker Script
    const linkerContent = this.templateEngine.renderLinkerScript(context);
    files.push({
      filename: 'linker.ld',
      relativePath: 'linker/linker.ld',
      content: linkerContent,
      checksumSha256: crypto.createHash('sha256').update(linkerContent).digest('hex'),
      category: 'LINKER'
    });

    // 2. Assembly Startup
    const startupContent = this.templateEngine.renderStartupAssembly(context);
    files.push({
      filename: 'startup.S',
      relativePath: 'startup/startup.S',
      content: startupContent,
      checksumSha256: crypto.createHash('sha256').update(startupContent).digest('hex'),
      category: 'STARTUP'
    });

    // 3. Vector Table Source & Header
    const vectors = this.templateEngine.renderVectorTable(context);
    files.push({
      filename: 'vectors.h',
      relativePath: 'include/vectors.h',
      content: vectors.headerContent,
      checksumSha256: crypto.createHash('sha256').update(vectors.headerContent).digest('hex'),
      category: 'VECTORS'
    });
    files.push({
      filename: 'vectors.c',
      relativePath: 'src/vectors.c',
      content: vectors.sourceContent,
      checksumSha256: crypto.createHash('sha256').update(vectors.sourceContent).digest('hex'),
      category: 'VECTORS'
    });

    // 4. Memory Map Header
    const memMapContent = `/* System Memory Map Header */\n#ifndef MEMORY_MAP_H\n#define MEMORY_MAP_H\n#define SRAM_BASE 0x00100000\n#define SRAM_SIZE 0x20000000\n#define OCM_BASE  0x00000000\n#endif\n`;
    files.push({
      filename: 'memory_map.h',
      relativePath: 'include/memory_map.h',
      content: memMapContent,
      checksumSha256: crypto.createHash('sha256').update(memMapContent).digest('hex'),
      category: 'HEADER'
    });

    return files;
  }
}
