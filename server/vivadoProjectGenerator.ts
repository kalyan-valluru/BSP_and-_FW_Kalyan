import path from 'path';
import fs from 'fs/promises';
import { spawn } from 'child_process';
import { LogType } from './vitisBridge';
import { TOOL_PATHS } from './buildEnvironmentChecker';

export class ClockGenerator {}
export class PeripheralGenerator {}
export class AddressGenerator {}

export interface HKLModel {
  processor?: string;
  fpgaPart?: string;
  clock?: string;
  peripherals?: any[];
  pinMappings?: Array<{ port: string; pin: string; iostandard?: string }>;
  clockFrequency?: string;
  boardPreset?: string;
}

export interface HKLValidationResult {
  valid: boolean;
  missingFields: string[];
  recommendation?: string;
}

export interface VivadoProjectResult {
  success: boolean;
  projectDirectory: string;
  xprPath: string;
  tclPath: string;
  xdcPath?: string;
  xsaPath?: string;
  generatedIPs: string[];
  warnings: string[];
  error?: string;
}

export interface VivadoGenOptions {
  hkl: HKLModel;
  workspace: string;
  presetId?: string;
  peripherals?: any[];
  onLog: (type: LogType, line: string) => void;
  signal?: AbortSignal;
}

export class VivadoProjectGenerator {
  /**
   * Performs feasibility validation on the HKL model before attempting project generation.
   */
  static validateHKL(hkl: HKLModel, presetId: string = ''): HKLValidationResult {
    const missing: string[] = [];

    const isXilinxPreset = presetId.toLowerCase().includes('xilinx') || presetId.toLowerCase().includes('zynq');

    if (!hkl.processor && !isXilinxPreset) {
      missing.push('Processor Architecture');
    }
    if (!hkl.fpgaPart && !isXilinxPreset) {
      missing.push('FPGA Part Number');
    }
    if (!hkl.clock && !hkl.clockFrequency && !isXilinxPreset) {
      missing.push('Clock Source / Frequency');
    }
    if ((!hkl.peripherals || hkl.peripherals.length === 0) && !isXilinxPreset) {
      missing.push('Peripheral List');
    }

    if (missing.length > 0) {
      return {
        valid: false,
        missingFields: missing,
        recommendation: 'Select a valid AMD/Xilinx platform preset (e.g. Zynq-7000 or Zynq UltraScale+) or upload complete hardware specifications with FPGA part number & clock configuration.',
      };
    }

    return { valid: true, missingFields: [] };
  }

  /**
   * Generates constraints.xdc from pin mappings and clock frequency in HKL.
   */
  static generateXdcConstraints(hkl: HKLModel, warnings: string[]): string {
    let xdc = `# Auto-Generated XDC Constraints from HKL\n\n`;

    // Clock constraint
    const clockFreq = hkl.clockFrequency || hkl.clock || '100MHz';
    let periodNs = 10.0;
    if (clockFreq.includes('100')) periodNs = 10.0;
    else if (clockFreq.includes('50')) periodNs = 20.0;
    else if (clockFreq.includes('125')) periodNs = 8.0;
    else if (clockFreq.includes('200')) periodNs = 5.0;

    xdc += `create_clock -period ${periodNs.toFixed(2)} [get_ports sys_clk]\n\n`;

    if (hkl.pinMappings && hkl.pinMappings.length > 0) {
      for (const pm of hkl.pinMappings) {
        if (pm.port && pm.pin) {
          const ioStd = pm.iostandard || 'LVCMOS33';
          xdc += `set_property PACKAGE_PIN ${pm.pin} [get_ports ${pm.port}]\n`;
          xdc += `set_property IOSTANDARD ${ioStd} [get_ports ${pm.port}]\n`;
        }
      }
    } else if (hkl.peripherals && hkl.peripherals.length > 0) {
      for (const p of hkl.peripherals) {
        const pName = typeof p === 'string' ? p : p.peripheralBlock || p.name || '';
        const pinMappingStr = typeof p === 'object' ? p.physicalPinMapping : '';
        if (pinMappingStr && !pinMappingStr.startsWith('MIO')) {
          const m = pinMappingStr.match(/([A-Z0-9]+)/i);
          if (m) {
            xdc += `set_property PACKAGE_PIN ${m[1]} [get_ports ${pName.toLowerCase()}_io]\n`;
            xdc += `set_property IOSTANDARD LVCMOS33 [get_ports ${pName.toLowerCase()}_io]\n`;
          }
        } else {
          warnings.push(`Peripheral '${pName}' has MIO/PS pin mapping. Physical FPGA XDC package pins omitted.`);
        }
      }
    } else {
      warnings.push('Pin mapping missing in HKL. Generated partial constraints.xdc with clock only.');
    }

    return xdc;
  }

  /**
   * Generates production-ready Vivado Tcl script from HKL model.
   */
  static generateTcl(
    hkl: HKLModel,
    projDirTcl: string,
    xsaPathTcl: string,
    isZynq7000: boolean,
    generatedIPs: string[]
  ): string {
    const rawPart = (hkl.fpgaPart || hkl.fpgaDevice || '').toLowerCase().trim();
    let part = 'xc7z020clg484-1';
    if (!isZynq7000) {
      part = 'xczu3eg-sbva484-1-e';
    } else if (rawPart.includes('clg400')) {
      part = 'xc7z020clg400-1';
    } else if (rawPart.includes('xc7z010')) {
      part = 'xc7z010clg400-1';
    } else {
      part = 'xc7z020clg484-1';
    }
    const procIp = isZynq7000 ? 'processing_system7' : 'zynq_ultra_ps_e';
    const procInst = isZynq7000 ? 'processing_system7_0' : 'zynq_ultra_ps_e_0';
    const masterPin = isZynq7000 ? 'M_AXI_GP0' : 'M_AXI_HPM0_FPD';

    generatedIPs.push(procIp);
    generatedIPs.push('axi_interconnect');
    generatedIPs.push('proc_sys_reset');

    let tcl = `# Auto-Generated Vivado Automation Script from Validated HKL Model
proc safe_connect_bd_net {src dst} {
  set src_obj [get_bd_pins -quiet $src]
  if {[llength $src_obj] == 0} {
    set src_obj [get_bd_ports -quiet $src]
  }
  set dst_obj [get_bd_pins -quiet $dst]
  if {[llength $dst_obj] == 0} {
    set dst_obj [get_bd_ports -quiet $dst]
  }
  if {[llength $src_obj] == 0} {
    puts "VIVADO INFO: safe_connect_bd_net: Source '$src' pin/port does not exist. Skipping connection."
    return
  }
  if {[llength $dst_obj] == 0} {
    puts "VIVADO INFO: safe_connect_bd_net: Destination '$dst' pin/port does not exist. Skipping connection."
    return
  }
  set src_path [get_property PATH $src_obj]
  set dst_path [get_property PATH $dst_obj]
  if {[string equal $src_path $dst_path]} {
    puts "VIVADO INFO: safe_connect_bd_net: Source and Destination are identical ($src_path). Skipping self-connection."
    return
  }
  puts "VIVADO INFO: safe_connect_bd_net: Connecting '$src_path' -> '$dst_path'"
  if {[catch { connect_bd_net $src_obj $dst_obj } err]} {
    puts "VIVADO WARNING: connect_bd_net '$src_path' -> '$dst_path' failed: $err"
  }
}

create_project -force auto_project {${projDirTcl}} -part ${part}

puts "VIVADO PROJECT PART: [get_property PART [current_project]]"

create_bd_design "design_1"

# Create Core Processing System
create_bd_cell -type ip -vlnv xilinx.com:ip:${procIp} ${procInst}
apply_bd_automation -rule xilinx.com:bd_rule:${procIp} -config {apply_board_preset "1"} [get_bd_cells ${procInst}]

# Create Processor System Reset IP & connect reset network
create_bd_cell -type ip -vlnv xilinx.com:ip:proc_sys_reset proc_sys_reset_0

`;

    if (isZynq7000) {
      tcl += `set_property -dict [list CONFIG.PCW_USE_M_AXI_GP0 {1}] [get_bd_cells ${procInst}]\n`;
      tcl += `safe_connect_bd_net "${procInst}/FCLK_CLK0" "${procInst}/M_AXI_GP0_ACLK"\n`;
      tcl += `safe_connect_bd_net "${procInst}/FCLK_CLK0" "proc_sys_reset_0/slowest_sync_clk"\n`;
      tcl += `safe_connect_bd_net "${procInst}/FCLK_RESET0_N" "proc_sys_reset_0/ext_reset_in"\n\n`;
    } else {
      tcl += `set_property -dict [list CONFIG.PSU__USE__M_AXI_GP0 {1} CONFIG.PSU__USE__M_AXI_GP1 {0} CONFIG.PSU__USE__M_AXI_GP2 {0} CONFIG.PSU__MAXIGP0__DATA_WIDTH {32} CONFIG.PSU__MAXIGP0__AWUSER_WIDTH {0} CONFIG.PSU__MAXIGP0__ARUSER_WIDTH {0}] [get_bd_cells ${procInst}]\n`;
      tcl += `safe_connect_bd_net "${procInst}/pl_clk0" "${procInst}/maxihpm0_fpd_aclk"\n`;
      tcl += `safe_connect_bd_net "${procInst}/pl_clk0" "proc_sys_reset_0/slowest_sync_clk"\n`;
      tcl += `safe_connect_bd_net "${procInst}/pl_resetn0" "proc_sys_reset_0/ext_reset_in"\n\n`;
    }

    // Add peripherals from HKL
    const periphList = hkl.peripherals || [];
    for (let i = 0; i < periphList.length; i++) {
      const p = periphList[i];
      const pNameStr = typeof p === 'string' ? p : p.peripheralBlock || p.name || `periph_${i}`;
      const pName = pNameStr.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const baseAddress = typeof p === 'object' ? p.baseAddress : undefined;

      // Skip PS internal peripherals
      if (baseAddress) {
        const cleanAddr = baseAddress.replace(/^0x/i, '').trim();
        const hex = parseInt(cleanAddr, 16);
        if (!isNaN(hex)) {
          if (isZynq7000 && (hex >= 0xE0000000 && hex <= 0xF8FFFFFF)) continue;
          if (!isZynq7000 && (hex >= 0xFD000000 && hex <= 0xFFFFFFFF)) continue;
        }
      }

      let ipVlnv = 'xilinx.com:ip:axi_gpio';
      let axiPin = 'S_AXI';

      if (pName.includes('uart')) {
        ipVlnv = 'xilinx.com:ip:axi_uartlite';
      } else if (pName.includes('spi')) {
        ipVlnv = 'xilinx.com:ip:axi_quad_spi';
        axiPin = 'AXI_LITE';
      } else if (pName.includes('i2c') || pName.includes('iic')) {
        ipVlnv = 'xilinx.com:ip:axi_iic';
      } else if (pName.includes('can')) {
        ipVlnv = 'xilinx.com:ip:axi_can';
      } else if (pName.includes('ethernet') || pName.includes('eth')) {
        ipVlnv = 'xilinx.com:ip:axi_ethernetlite';
      }

      generatedIPs.push(ipVlnv);

      tcl += `# Adding ${pNameStr} IP
create_bd_cell -type ip -vlnv ${ipVlnv} ${pName}
catch { apply_bd_automation -rule xilinx.com:bd_rule:axi4 -config { Master "/${procInst}/${masterPin}" Clk "Auto" } [get_bd_intf_pins ${pName}/${axiPin}] }
`;
      if (baseAddress && baseAddress !== 'unresolved' && baseAddress !== '0x00000000') {
        const addrSpace = isZynq7000 ? 'processing_system7_0/Data' : 'zynq_ultra_ps_e_0/Data';
        const segName = pName.includes('spi') ? 'AXI_LITE/Reg' : 'S_AXI/Reg';
        tcl += `catch { assign_bd_address -offset ${baseAddress} -range 4K -target_address_space [get_bd_addr_spaces ${addrSpace}] [get_bd_addr_segs ${pName}/${segName}] }\n`;
      }
      tcl += `\n`;
    }

    // AI Auto-Fix: Automatically assign all remaining unmapped AXI slave address segments
    tcl += `# AI Auto-Fix: Assign all unmapped AXI addresses\ncatch { assign_bd_address }\n\n`;

    // Add constraint file to project if available
    tcl += `# Validate & Export Hardware
validate_bd_design
save_bd_design

generate_target all [get_files *.bd]
set wrapper_file [make_wrapper -files [get_files *.bd] -top]
catch { add_files -norecurse -force $wrapper_file }
set bdName [get_property NAME [current_bd_design]]
set_property top \${bdName}_wrapper [current_fileset]
update_compile_order -fileset sources_1

puts "VIVADO: Exporting Hardware Platform XSA to {${xsaPathTcl}}..."
write_hw_platform -fixed -include_bit -force -file {${xsaPathTcl}}
close_project
exit
`;

    return tcl;
  }

  /**
   * Main entry point: Generates Tcl, XDC, and executes Vivado Batch Mode.
   */
  static async generateAndBuild(opts: VivadoGenOptions): Promise<VivadoProjectResult> {
    const { hkl, workspace, presetId = '', onLog, signal } = opts;
    const warnings: string[] = [];
    const generatedIPs: string[] = [];

    // Dedicated Execution Banner
    const proc = hkl.processor || (presetId.includes('mpsoc') ? 'Zynq UltraScale+' : 'Zynq-7000');
    const fpgaPart = hkl.fpgaPart || (presetId.includes('mpsoc') ? 'xczu3eg-sbva484-1-e' : 'xc7z020clg400-1');

    onLog('system', '═══════════════════════════════════════════════');
    onLog('system', '   Vivado Project Generator (HKL Engine)');
    onLog('system', '═══════════════════════════════════════════════');
    onLog('info',   `Processor : ${proc}`);
    onLog('info',   `FPGA Part : ${fpgaPart}`);
    onLog('info',   `Workflow  : vivado_xpr`);
    onLog('info',   `Project   : Auto Generated from HKL Model`);
    onLog('system', '═══════════════════════════════════════════════');

    // 1. Feasibility Validation
    const valReport = this.validateHKL(hkl, presetId);
    if (!valReport.valid) {
      const err = `HKL Feasibility Validation Failed. Missing required fields: ${valReport.missingFields.join(', ')}. ${valReport.recommendation}`;
      onLog('error', `[VIVADO GENERATOR ERROR] ${err}`);
      return {
        success: false,
        projectDirectory: workspace,
        xprPath: '',
        tclPath: '',
        generatedIPs: [],
        warnings,
        error: err,
      };
    }

    const isZynq7000 = !proc.toLowerCase().includes('a53') && !proc.toLowerCase().includes('ultrascale');
    const projDir = path.join(workspace, 'generated_project');
    const projDirTcl = projDir.replace(/\\/g, '/');
    const xprPath = path.join(projDir, 'auto_project.xpr');
    const tclPath = path.join(workspace, 'generate_project.tcl');
    const xdcPath = path.join(workspace, 'constraints.xdc');
    const xsaPath = path.join(workspace, 'auto_project.xsa');
    const xsaPathTcl = xsaPath.replace(/\\/g, '/');

    await fs.mkdir(workspace, { recursive: true });
    await fs.mkdir(projDir, { recursive: true });

    // 2. Generate Constraints XDC
    const xdcContent = this.generateXdcConstraints(hkl, warnings);
    await fs.writeFile(xdcPath, xdcContent, 'utf-8');
    onLog('info', `[VIVADO] Synthesized XDC constraints at ${xdcPath}`);

    // 3. Generate Automation TCL
    const tclContent = this.generateTcl(hkl, projDirTcl, xsaPathTcl, isZynq7000, generatedIPs);
    await fs.writeFile(tclPath, tclContent, 'utf-8');
    onLog('info', `[VIVADO] Generated Tcl automation script at ${tclPath}`);

    // 4. Resolve Vivado Executable
    const vivadoBin = TOOL_PATHS.vivado;
    if (!vivadoBin) {
      const err = `AMD Vivado batch executable not found in PATH or standard installation directories. Ensure Vivado 2025.2 is installed.`;
      onLog('error', `[VIVADO ERROR] ${err}`);
      return {
        success: false,
        projectDirectory: projDir,
        xprPath,
        tclPath,
        xdcPath,
        generatedIPs,
        warnings,
        error: err,
      };
    }

    // 5. Invoke Vivado in Batch Mode
    onLog('system', '[PROGRESS] PHASE: vivado_batch_mode');
    onLog('info', '[VIVADO] Launching Vivado Batch Mode to build block design & export XSA...');

    const isWin = process.platform === 'win32';
    const spawnCmd = isWin ? 'cmd.exe' : vivadoBin;
    const spawnArgs = isWin
      ? ['/c', vivadoBin, '-mode', 'batch', '-source', tclPath, '-nojournal', '-nolog']
      : ['-mode', 'batch', '-source', tclPath, '-nojournal', '-nolog'];

    const startTime = Date.now();
    const res = await new Promise<{ exitCode: number; stdout: string; stderr: string }>((resolve) => {
      if (signal?.aborted) {
        resolve({ exitCode: 1, stdout: '', stderr: 'Aborted' });
        return;
      }

      const procChild = spawn(spawnCmd, spawnArgs, { cwd: workspace });
      let stdoutStr = '';
      let stderrStr = '';

      procChild.stdout?.on('data', (d) => {
        const line = d.toString().trim();
        if (line) {
          stdoutStr += line + '\n';
          onLog('info', `[VIVADO] ${line}`);
        }
      });

      procChild.stderr?.on('data', (d) => {
        const line = d.toString().trim();
        if (line) {
          stderrStr += line + '\n';
          onLog('warning', `[VIVADO ERR] ${line}`);
        }
      });

      procChild.on('close', (code) => {
        resolve({ exitCode: code ?? 0, stdout: stdoutStr, stderr: stderrStr });
      });

      procChild.on('error', (err) => {
        resolve({ exitCode: 1, stdout: stdoutStr, stderr: err.message });
      });
    });

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

    if (res.exitCode !== 0) {
      const err = `Vivado Batch Mode project generation failed with exit code ${res.exitCode} (${durationSec}s)`;
      onLog('error', `[VIVADO ERROR] ${err}`);
      return {
        success: false,
        projectDirectory: projDir,
        xprPath,
        tclPath,
        xdcPath,
        generatedIPs,
        warnings,
        error: err,
      };
    }

    onLog('success', `[VIVADO SUCCESS] Project created successfully in ${durationSec}s. Artifacts generated: auto_project.xpr, design_1.bd, auto_project.xsa`);

    return {
      success: true,
      projectDirectory: projDir,
      xprPath,
      tclPath,
      xdcPath,
      xsaPath,
      generatedIPs,
      warnings,
    };
  }
}

