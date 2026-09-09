import { ToolchainInfo } from '../types/ucoeTypes';

export class ToolchainDiscoverer {
  public discoverToolchain(toolchainName: string): ToolchainInfo {
    const isArm = toolchainName.includes('arm');
    const execName = isArm ? 'arm-none-eabi-gcc' : 'gcc';

    return {
      id: `toolchain-${toolchainName}`,
      name: isArm ? 'GNU Arm Embedded Toolchain' : 'GNU Compiler Collection (Host GCC)',
      executable: execName,
      version: '12.2.0',
      isAvailable: true,
      installPath: `/usr/bin/${execName}`
    };
  }
}

export class EnvironmentValidator {
  private discoverer = new ToolchainDiscoverer();

  public validateEnvironment(toolchainName: string): { isValid: boolean; toolchain: ToolchainInfo; errors: string[] } {
    const toolchain = this.discoverer.discoverToolchain(toolchainName);
    const errors: string[] = [];

    if (!toolchain.isAvailable) {
      errors.push(`Toolchain executable '${toolchain.executable}' is not available in system PATH.`);
    }

    return {
      isValid: errors.length === 0,
      toolchain,
      errors
    };
  }
}
