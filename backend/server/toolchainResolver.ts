import { getPluginForProcessor } from './vendorPlugins';
import { TOOL_PATHS } from './buildEnvironmentChecker';

export type ToolchainType = 
  | 'vivado_vitis'          // AMD/Xilinx (Vivado + Vitis flow)
  | 'arm-none-eabi-gcc'     // ARM Cortex-M / Bare-Metal 32-bit
  | 'aarch64-linux-gnu-gcc' // ARM Cortex-A / 64-bit Linux
  | 'riscv64-unknown-elf-gcc' // RISC-V Cross-Compiler
  | 'gcc'                   // x86 / Host GCC
  | 'stm32cubeide'          // Legacy alias mapped to arm-none-eabi-gcc
  | 'mcuxpresso'            // Legacy alias mapped to aarch64-linux-gnu-gcc or arm-none-eabi-gcc
  | 'ccs'                   // Legacy alias mapped to aarch64-linux-gnu-gcc / arm-none-eabi-gcc
  | 'gcc_linux'             // Legacy alias mapped to aarch64-linux-gnu-gcc
  | 'qualcomm_sdk';         // Legacy alias mapped to aarch64-linux-gnu-gcc

export interface ToolchainCapabilities {
  vendor: string;
  processorFamily: string;
  supportsVivado: boolean;
  supportsVitis: boolean;
  supportsBareMetal?: boolean;
  supportsLinux?: boolean;
  supportsDeviceTree?: boolean;
  compiler: string;
  projectGenerator?: string;
  bspType?: string;
}

export interface ToolchainResolution {
  toolchain: ToolchainType;
  capabilities: ToolchainCapabilities;
  compatReport: {
    valid: boolean;
    errors: string[];
  };
}

export interface HardwareModelMetadata {
  sessionId?: string;
  boardName?: string;
  fpgaDevice?: string;
  memorySize?: string;
  flashType?: string;
  architecture?: string;
  processorName?: string;
  clockSources?: string[];
  interruptController?: string;
  vendor?: string;
  hklStatus?: string;
  hkl?: any;
  skipVivadoBuild?: boolean;
  pinMappings?: any[];
  busInterfaces?: any[];
}

/**
 * Toolchain Resolver Class & Engine
 * Resolves the appropriate compilation toolchain based on processor and architecture.
 *
 * Rules:
 * - AMD/Xilinx: Uses Vivado + Vitis (unchanged).
 * - Non-AMD: Uses vendor-independent command-line GCC cross-compilers:
 *   - ARM Cortex-M / Cortex-M4 / Cortex-M7 -> arm-none-eabi-gcc
 *   - ARM Cortex-A / Cortex-A53 / Cortex-A72 / Linux -> aarch64-linux-gnu-gcc
 *   - RISC-V -> riscv64-unknown-elf-gcc
 *   - x86 / Native Embedded -> gcc
 */
export class ToolchainResolver {
  public static resolve(processorName: string, architecture: string, vendor?: string, fpgaDevice?: string): ToolchainResolution {
    return resolveToolchain(processorName, architecture, fpgaDevice, vendor);
  }
}

export function resolveToolchain(
  processorName: string,
  architecture: string,
  fpgaDevice?: string,
  vendorName?: string
): ToolchainResolution {
  const proc = (processorName || '').toLowerCase();
  const arch = (architecture || '').toLowerCase();
  const fpga = (fpgaDevice || '').toLowerCase();
  const vendor = (vendorName || '').toLowerCase();

  const isAMD =
    vendor.includes('amd') ||
    vendor.includes('xilinx') ||
    proc.includes('zynq') ||
    proc.includes('microblaze') ||
    proc.includes('versal') ||
    proc.includes('mpsoc') ||
    (fpga !== '' && fpga !== 'n/a' && (fpga.includes('xc7') || fpga.includes('xcz') || fpga.includes('xcv') || fpga.includes('zynq')));

  // 1. AMD / Xilinx Workflow — Preserve Vivado + Vitis Architecture
  if (isAMD) {
    return {
      toolchain: 'vivado_vitis',
      capabilities: {
        vendor: 'AMD/Xilinx',
        processorFamily: proc.includes('mpsoc') ? 'Zynq UltraScale+ MPSoC' : proc.includes('versal') ? 'Versal' : proc.includes('microblaze') ? 'MicroBlaze' : 'Zynq-7000',
        supportsVivado: true,
        supportsVitis: true,
        supportsBareMetal: true,
        supportsLinux: true,
        supportsDeviceTree: true,
        compiler: 'arm-none-eabi-gcc',
        projectGenerator: 'vivado_tcl'
      },
      compatReport: {
        valid: true,
        errors: []
      }
    };
  }

  // 2. Non-AMD Platforms — Pure Architecture-Driven Compiler Selection
  let targetCompiler = 'arm-none-eabi-gcc';
  const resolvedVendor = vendorName || 'Generic Platform Vendor';
  const processorFamily = architecture || processorName || 'Generic Processor';

  // Architectural feature matching (Supports any future Cortex-M, Cortex-A, Cortex-R, RISC-V, or x86 processor)
  if (
    arch.includes('risc-v') ||
    arch.includes('riscv') ||
    arch.includes('rv64') ||
    arch.includes('rv32') ||
    proc.includes('riscv') ||
    proc.includes('risc-v')
  ) {
    targetCompiler = process.env.RISCV_GCC || 'riscv64-unknown-elf-gcc';
  } else if (
    arch.includes('64') ||
    arch.includes('arm64') ||
    arch.includes('aarch64') ||
    arch.includes('cortex-a53') ||
    arch.includes('cortex-a55') ||
    arch.includes('cortex-a72') ||
    arch.includes('cortex-a76') ||
    arch.includes('cortex-a78') ||
    proc.includes('aarch64')
  ) {
    targetCompiler = process.env.AARCH64_GCC || (TOOL_PATHS.gccAarch64 ? TOOL_PATHS.gccAarch64 : 'aarch64-none-elf-gcc');
  } else if (
    arch.includes('cortex-a') ||
    arch.includes('armv7-a') ||
    arch.includes('cortex-a7') ||
    arch.includes('cortex-a8') ||
    arch.includes('cortex-a9') ||
    arch.includes('cortex-a15')
  ) {
    targetCompiler = process.env.ARM_LINUX_GNUEABIHF_GCC || 'arm-linux-gnueabihf-gcc';
  } else if (
    arch.includes('cortex-m') ||
    arch.includes('cortex-r') ||
    arch.includes('armv7-m') ||
    arch.includes('armv6-m') ||
    arch.includes('armv8-m') ||
    arch.includes('cortex-m0') ||
    arch.includes('cortex-m3') ||
    arch.includes('cortex-m4') ||
    arch.includes('cortex-m7') ||
    arch.includes('cortex-m33') ||
    arch.includes('cortex-m55') ||
    arch.includes('cortex-r5') ||
    arch.includes('cortex-r8')
  ) {
    targetCompiler = process.env.ARM_NONE_EABI_GCC || 'arm-none-eabi-gcc';
  } else if (arch.includes('x86') || arch.includes('x86_64') || proc.includes('x86')) {
    targetCompiler = process.env.GCC || 'gcc';
  } else {
    // Universal default for 32-bit embedded ARM targets
    targetCompiler = process.env.ARM_NONE_EABI_GCC || 'arm-none-eabi-gcc';
  }

  const toolchainType = targetCompiler as ToolchainType;

  return {
    toolchain: toolchainType,
    capabilities: {
      vendor: resolvedVendor,
      processorFamily,
      supportsVivado: false,
      supportsVitis: false,
      supportsBareMetal: true,
      supportsLinux: targetCompiler === 'aarch64-linux-gnu-gcc' || targetCompiler === 'gcc',
      supportsDeviceTree: true,
      compiler: targetCompiler,
      projectGenerator: 'gcc_makefile'
    },
    compatReport: {
      valid: true,
      errors: []
    }
  };
}

