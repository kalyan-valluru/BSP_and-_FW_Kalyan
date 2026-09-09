import * as fs from 'fs/promises';
import * as path from 'path';

export interface MemoryRegion {
  name: string;
  base: string;     // e.g. "0x00100000"
  length: string;   // e.g. "0x1FF00000"
}

export interface ArchitectureConfig {
  compiler: string;
  startupObject: string;
  stackRequirements: string[];
  mmuRequirements: string[];
  requiredSymbols: string[];
  defaultLinkerFlags: string;
  supportedBspType: string;
  templateFile: string;
}

export interface ValidationIssue {
  rule: string;
  reason: string;
  affectedSymbol?: string;
  recommendedFix: string;
}

export interface ValidationReport {
  valid: boolean;
  issues: ValidationIssue[];
}

// ── 1. Architecture Registry & Processor Capability Model ─────────────────────
export const ArchitectureRegistry: Record<string, ArchitectureConfig> = {
  'cortexa9': {
    compiler: 'arm-none-eabi-gcc',
    startupObject: 'boot.o',
    stackRequirements: ['__irq_stack', '__supervisor_stack', '__abort_stack', '__fiq_stack', '__undef_stack'],
    mmuRequirements: [],
    requiredSymbols: ['_vector_table', '__stack'],
    defaultLinkerFlags: '-Wl,--build-id=none',
    supportedBspType: 'standalone',
    templateFile: 'cortex_a9.ld.template'
  },
  'cortexa53': {
    compiler: 'aarch64-none-elf-gcc',
    startupObject: 'boot.o',
    stackRequirements: ['__el3_stack', '__el2_stack', '__el1_stack', '__el0_stack'],
    mmuRequirements: ['.mmu_tbl0', '.mmu_tbl1', '.mmu_tbl2'],
    requiredSymbols: ['_vector_table', '__el3_stack'],
    defaultLinkerFlags: '-Wl,--build-id=none',
    supportedBspType: 'standalone',
    templateFile: 'cortex_a53.ld.template'
  },
  'cortexr5': {
    compiler: 'armr5-none-eabi-gcc',
    startupObject: 'boot.o',
    stackRequirements: ['__irq_stack', '__supervisor_stack', '__abort_stack', '__fiq_stack', '__undef_stack'],
    mmuRequirements: [],
    requiredSymbols: ['_boot', '__stack'],
    defaultLinkerFlags: '-Wl,--build-id=none',
    supportedBspType: 'standalone',
    templateFile: 'cortex_r5.ld.template'
  },
  'microblaze': {
    compiler: 'mb-gcc',
    startupObject: 'crt0.o',
    stackRequirements: ['__stack'],
    mmuRequirements: [],
    requiredSymbols: ['_start', '__stack'],
    defaultLinkerFlags: '-Wl,--build-id=none',
    supportedBspType: 'standalone',
    templateFile: 'microblaze.ld.template'
  }
};

// ── 2. Processor Capability Auto-Detection ─────────────────────────────────────
export function detectProcessorArchitecture(processorName: string, metadataArch?: string): string {
  const name = (processorName || '').toLowerCase();
  const arch = (metadataArch || '').toLowerCase();

  if (name.includes('a53') || name.includes('mpsoc') || arch.includes('aarch64') || arch.includes('arm64')) {
    return 'cortexa53';
  }
  if (name.includes('r5') || name.includes('cortexr5')) {
    return 'cortexr5';
  }
  if (name.includes('microblaze') || name.includes('mb_')) {
    return 'microblaze';
  }
  // Default to Cortex-A9 Zynq-7000
  return 'cortexa9';
}

// ── 3. Memory Region Discovery ──────────────────────────────────────────────────
export async function parseMemoryRegionsFromBsp(includePath: string): Promise<MemoryRegion[]> {
  const xparamsPath = path.join(includePath, 'xparameters.h');
  const regions: MemoryRegion[] = [];
  try {
    const content = await fs.readFile(xparamsPath, 'utf-8');
    const lines = content.split('\n');

    const baseMap = new Map<string, string>();
    const highMap = new Map<string, string>();

    // Scan for #define XPAR_<NAME>_BASEADDR <VAL> and HIGHADDR <VAL>
    const defineRegex = /#define\s+XPAR_([A-Z0-9_]+)_(BASE|HIGH)ADDR\s+(0x[0-9A-Fa-f]+|\d+)/i;
    for (const line of lines) {
      const match = defineRegex.exec(line);
      if (match) {
        const ipName = match[1].toUpperCase();
        const type = match[2].toUpperCase();
        const addrStr = match[3];
        if (type === 'BASE') {
          baseMap.set(ipName, addrStr);
        } else {
          highMap.set(ipName, addrStr);
        }
      }
    }

    for (const [ipName, baseVal] of baseMap.entries()) {
      const highVal = highMap.get(ipName);
      if (highVal) {
        const baseNum = BigInt(baseVal);
        const highNum = BigInt(highVal);
        if (highNum >= baseNum) {
          const lengthNum = highNum - baseNum + 1n;
          regions.push({
            name: ipName.toLowerCase(),
            base: baseVal,
            length: `0x${lengthNum.toString(16).toUpperCase()}`
          });
        }
      }
    }
  } catch (err) {
    // Ignore error if file doesn't exist
  }
  return regions;
}

// ── 4. Linker Validation Module ────────────────────────────────────────────────
export function validateLinkerScript(
  scriptContent: string,
  config: ArchitectureConfig,
  regions: MemoryRegion[]
): ValidationReport {
  const issues: ValidationIssue[] = [];

  // Check required symbols
  for (const sym of config.requiredSymbols) {
    if (!scriptContent.includes(sym)) {
      issues.push({
        rule: 'Required Symbol Check',
        reason: `Required symbol '${sym}' is missing in the linker script definitions.`,
        affectedSymbol: sym,
        recommendedFix: `Add '${sym}' symbol placement or entry marker to the template.`
      });
    }
  }

  // Check required stacks
  for (const stack of config.stackRequirements) {
    if (!scriptContent.includes(stack)) {
      issues.push({
        rule: 'Stack Symbol Check',
        reason: `Required stack boundary symbol '${stack}' is missing from stack allocation layout.`,
        affectedSymbol: stack,
        recommendedFix: `Ensure the stack section contains definition of '${stack}' alignment/offset.`
      });
    }
  }

  // Check MMU table placement if applicable
  for (const mmu of config.mmuRequirements) {
    if (!scriptContent.includes(mmu)) {
      issues.push({
        rule: 'MMU Section Check',
        reason: `Required translation table section '${mmu}' is omitted.`,
        affectedSymbol: mmu,
        recommendedFix: `Add '${mmu}' section configuration aligned to page boundaries (4096 bytes).`
      });
    }
  }

  // Check for duplicate memory regions
  const definedMemoryRegions: string[] = [];
  const memoryBlockMatch = scriptContent.match(/MEMORY\s*\{([^}]*)\}/i);
  if (memoryBlockMatch) {
    const memoryLines = memoryBlockMatch[1].split('\n');
    for (const line of memoryLines) {
      const match = line.trim().match(/^([a-z0-9_]+)\s*:/i);
      if (match) {
        const regionName = match[1].toLowerCase();
        if (definedMemoryRegions.includes(regionName)) {
          issues.push({
            rule: 'Duplicate Memory Region',
            reason: `Memory region name '${regionName}' is defined multiple times inside the MEMORY block.`,
            recommendedFix: `Ensure memory region names are unique in the generated linker mapping.`
          });
        } else {
          definedMemoryRegions.push(regionName);
        }
      }
    }
  }

  // Check memory overlap / sizes
  for (const region of regions) {
    try {
      const baseNum = BigInt(region.base);
      const lenNum = BigInt(region.length);
      if (baseNum + lenNum > 0xFFFFFFFFFFFFFFFFn) {
        issues.push({
          rule: 'Invalid Address range',
          reason: `Memory region '${region.name}' maps to an invalid address space (> 64-bit bounds).`,
          recommendedFix: `Correct base '${region.base}' and length '${region.length}' mapping.`
        });
      }
    } catch {
      // Ignored if parsing failed
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

// ── 5. Main Linker Generator Entrypoint ─────────────────────────────────────────
export async function generateLinkerScript(
  processorName: string,
  metadataArch: string | undefined,
  includePath: string,
  templatesDir: string
): Promise<{ success: boolean; content: string; report: ValidationReport }> {
  const archType = detectProcessorArchitecture(processorName, metadataArch);
  const config = ArchitectureRegistry[archType];

  if (!config) {
    throw new Error(`Unsupported architecture profile resolved: ${archType}`);
  }

  // Discover memory regions dynamically
  let regions = await parseMemoryRegionsFromBsp(includePath);

  // Fallback to defaults if no regions found in xparameters.h
  if (regions.length === 0) {
    if (archType === 'cortexa53') {
      regions = [
        { name: 'psu_ddr_0', base: '0x100000', length: '0x7FF00000' },
        { name: 'psu_ocm_ram_0', base: '0xFFFC0000', length: '0x40000' }
      ];
    } else if (archType === 'cortexr5') {
      regions = [
        { name: 'psu_r5_0_atcm', base: '0x00000000', length: '0x10000' },
        { name: 'psu_r5_0_btcm', base: '0x00020000', length: '0x10000' },
        { name: 'psu_ddr_0', base: '0x100000', length: '0x7FF00000' }
      ];
    } else if (archType === 'microblaze') {
      regions = [
        { name: 'microblaze_0_local_memory_ilmb_bram_if_cntlr', base: '0x00000000', length: '0x4000' },
        { name: 'microblaze_0_local_memory_dlmb_bram_if_cntlr', base: '0x00000000', length: '0x4000' }
      ];
    } else {
      regions = [
        { name: 'ps7_ddr_0', base: '0x100000', length: '0x1FF00000' },
        { name: 'ps7_ram_0', base: '0x00000000', length: '0x00030000' },
        { name: 'ps7_ram_1', base: '0xFFFF0000', length: '0x0000FE00' }
      ];
    }
  }

  // Load template file
  const templatePath = path.join(templatesDir, config.templateFile);
  let templateContent = await fs.readFile(templatePath, 'utf-8');

  // Format MEMORY section strings
  const memoryRegionLines = regions.map(r => `   ${r.name} : ORIGIN = ${r.base}, LENGTH = ${r.length}`).join('\n');
  const defaultRegion = regions.find(r => r.name.includes('ddr') || r.name.includes('ram_0') || r.name.includes('bram_if_cntlr'))?.name || regions[0].name;

  // Substitution
  templateContent = templateContent.replace(/\{\{MEMORY_REGIONS\}\}/g, memoryRegionLines);
  templateContent = templateContent.replace(/\{\{DEFAULT_MEMORY_REGION\}\}/g, defaultRegion);

  // Validate generated linker script
  const report = validateLinkerScript(templateContent, config, regions);

  return {
    success: report.valid,
    content: templateContent,
    report
  };
}
