import * as fs from 'fs/promises';
import * as path from 'path';

export interface ToolchainInfo {
  id: string;
  name: string;
  vendor: string;
  found: boolean;
  installPath?: string;
  version?: string;
  guide: string;
}

export class ToolchainRegistry {
  private static tools: Record<string, ToolchainInfo> = {
    vivado: {
      id: 'vivado',
      name: 'Vivado Design Suite',
      vendor: 'AMD/Xilinx',
      found: false,
      guide: 'Download Vivado from the AMD Xilinx downloads website and install under C:\\AMD\\ or export AMD_BASE.'
    },
    vitis: {
      id: 'vitis',
      name: 'Vitis Unified Software Platform',
      vendor: 'AMD/Xilinx',
      found: false,
      guide: 'Install Vitis using Xilinx Unified Installer alongside Vivado.'
    },
    petalinux: {
      id: 'petalinux',
      name: 'PetaLinux Tools',
      vendor: 'AMD/Xilinx',
      found: false,
      guide: 'PetaLinux requires a Linux host. Install petalinux-v2025.2-final-installer.run on a supported Ubuntu/RHEL machine.'
    },
    stm32cubemx: {
      id: 'stm32cubemx',
      name: 'STM32CubeMX Code Generator',
      vendor: 'STMicroelectronics',
      found: false,
      guide: 'Download and install STM32CubeMX from ST.com. Ensure the executable is on your system PATH.'
    },
    mcuxpresso: {
      id: 'mcuxpresso',
      name: 'MCUXpresso Config Tools & SDK',
      vendor: 'NXP',
      found: false,
      guide: 'Download MCUXpresso SDK Builder package and place the SDK zip under C:\\NXP\\ or your workspace.'
    },
    ti_sysconfig: {
      id: 'ti_sysconfig',
      name: 'TI SysConfig Tool',
      vendor: 'Texas Instruments',
      found: false,
      guide: 'Install TI SysConfig tool under C:\\ti\\sysconfig_<version>\\ and ensure PATH contains it.'
    }
  };

  static async discoverAll(): Promise<Record<string, ToolchainInfo>> {
    // 1. Discover AMD/Xilinx
    const amdBase = process.env.AMD_BASE || 'C:\\AMD';
    try {
      const folders = await fs.readdir(amdBase);
      const versionFolder = folders.find(f => /^\d{4}\.\d+$/.test(f));
      if (versionFolder) {
        const vivadoPath = path.join(amdBase, versionFolder, 'Vivado', 'bin', 'vivado.bat');
        const vitisPath = path.join(amdBase, versionFolder, 'Vitis', 'bin', 'xsct.bat');
        
        await fs.access(vivadoPath);
        this.tools.vivado.found = true;
        this.tools.vivado.installPath = vivadoPath;
        this.tools.vivado.version = versionFolder;

        await fs.access(vitisPath);
        this.tools.vitis.found = true;
        this.tools.vitis.installPath = vitisPath;
        this.tools.vitis.version = versionFolder;
      }
    } catch {
      // Ignored if folder doesn't exist
    }

    // 2. Discover STM32
    try {
      const stBase = 'C:\\ST';
      const stFolders = await fs.readdir(stBase);
      if (stFolders.length > 0) {
        this.tools.stm32cubemx.found = true;
        this.tools.stm32cubemx.installPath = path.join(stBase, stFolders[0]);
      }
    } catch {}

    // 3. Discover TI
    try {
      const tiBase = 'C:\\ti';
      const tiFolders = await fs.readdir(tiBase);
      const sysConfig = tiFolders.find(f => f.startsWith('sysconfig'));
      if (sysConfig) {
        this.tools.ti_sysconfig.found = true;
        this.tools.ti_sysconfig.installPath = path.join(tiBase, sysConfig);
      }
    } catch {}

    return this.tools;
  }

  static getTool(id: string): ToolchainInfo | undefined {
    return this.tools[id];
  }
}
