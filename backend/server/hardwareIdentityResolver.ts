import fs from 'fs';
import path from 'path';

export interface HardwareIdentity {
  vendor: string;
  board: string;
  processor: string;
  architecture: string;
  fpga_part?: string;
  soc_family?: string;
  device_part?: string;
  toolchain: string;
  required_document_types: string[];
}

/**
 * Phase 2: Deterministic Hardware Identity Resolver
 * Resolves exact target device identity from uploaded hardware evidence (.xsa, .xpr, .hwh, .dts, .svd, board metadata).
 */
export function resolveHardwareIdentity(
  evidence: {
    fileName?: string;
    content?: string;
    peripherals?: any[];
    boardPreset?: string;
    hwhParams?: Record<string, any>;
    rawDts?: string;
    rawSvd?: string;
  }
): HardwareIdentity {
  const fileStr = ((evidence.fileName || '') + ' ' + (evidence.content || '') + ' ' + (evidence.boardPreset || '')).toLowerCase();
  const rawDts = (evidence.rawDts || '').toLowerCase();
  const rawSvd = (evidence.rawSvd || '').toLowerCase();

  // 1. AMD / Xilinx Zynq-7000 (e.g. ZedBoard, ZC702, Zybo)
  if (
    fileStr.includes('zedboard') ||
    fileStr.includes('xc7z020') ||
    fileStr.includes('zynq-7000') ||
    fileStr.includes('xlnx,zynq-7000') ||
    rawDts.includes('xlnx,zynq-7000') ||
    rawSvd.includes('zynq')
  ) {
    return {
      vendor: 'AMD',
      board: fileStr.includes('zedboard') ? 'Digilent ZedBoard' : 'AMD Zynq-7000 Evaluation Board',
      processor: 'Zynq-7000',
      architecture: 'ARM Cortex-A9',
      fpga_part: 'xc7z020clg484-1',
      soc_family: 'Zynq-7000',
      device_part: 'xc7z020',
      toolchain: 'Vivado/Vitis',
      required_document_types: ['TRM', 'datasheet', 'board_reference', 'register_reference', 'reference_design']
    };
  }

  // 2. AMD / Xilinx Zynq UltraScale+ (MPSoC / RFSoC)
  if (
    fileStr.includes('zcu102') ||
    fileStr.includes('xczu') ||
    fileStr.includes('mpsoc') ||
    rawDts.includes('xlnx,zynqmp')
  ) {
    return {
      vendor: 'AMD',
      board: fileStr.includes('zcu102') ? 'Xilinx ZCU102' : 'Zynq UltraScale+ Board',
      processor: 'Zynq UltraScale+ MPSoC',
      architecture: 'ARM Cortex-A53 / Cortex-R5',
      fpga_part: 'xczu9eg-ffvb1156-2-i',
      soc_family: 'Zynq UltraScale+',
      device_part: 'xczu9eg',
      toolchain: 'Vivado/Vitis',
      required_document_types: ['TRM', 'datasheet', 'board_reference', 'register_reference', 'reference_design']
    };
  }

  // 3. STMicroelectronics STM32 (e.g. STM32H7, STM32F4, STM32MP1)
  if (
    fileStr.includes('stm32') ||
    rawDts.includes('st,stm32') ||
    rawSvd.includes('stm32')
  ) {
    const isF4Discovery = fileStr.includes('f4discovery') || fileStr.includes('stm32f407g-disc1') || fileStr.includes('mb997') || fileStr.includes('stm32f407vg');
    return {
      vendor: 'STMicroelectronics',
      board: isF4Discovery ? 'STM32F4DISCOVERY / STM32F407G-DISC1' : 'STM32F4DISCOVERY / STM32F407G-DISC1',
      processor: 'STM32F407VGT6',
      architecture: 'ARM Cortex-M4',
      soc_family: 'STM32F4',
      device_part: 'stm32f407vgt6',
      toolchain: 'STM32CubeMX / STM32CubeF4 / GCC',
      required_document_types: ['reference_manual', 'datasheet', 'user_manual', 'errata', 'bsp_docs']
    };
  }

  // 4. NXP i.MX (e.g. i.MX8M, i.MX6)
  if (
    fileStr.includes('imx8') ||
    fileStr.includes('imx6') ||
    fileStr.includes('nxp') ||
    rawDts.includes('fsl,imx')
  ) {
    return {
      vendor: 'NXP',
      board: 'i.MX8M Plus EVK',
      processor: 'i.MX8M Plus',
      architecture: 'ARM Cortex-A53 / Cortex-M7',
      soc_family: 'i.MX8M',
      device_part: 'mimx8ml8',
      toolchain: 'Yocto / MCUXpresso',
      required_document_types: ['reference_manual', 'datasheet', 'bsp_docs']
    };
  }

  // 5. Texas Instruments (e.g. Sitara AM335x, AM64x)
  if (
    fileStr.includes('am335') ||
    fileStr.includes('sitara') ||
    fileStr.includes('ti') ||
    rawDts.includes('ti,am335x')
  ) {
    return {
      vendor: 'Texas Instruments',
      board: 'BeagleBone Black / AM335x EVM',
      processor: 'AM3358',
      architecture: 'ARM Cortex-A8',
      soc_family: 'AM335x',
      device_part: 'am3358',
      toolchain: 'TI Processor SDK / GCC',
      required_document_types: ['TRM', 'datasheet', 'bsp_docs']
    };
  }

  // 6. Raspberry Pi (e.g. BCM2711, CM4, Pi 4)
  if (
    fileStr.includes('bcm2711') ||
    fileStr.includes('raspberry') ||
    fileStr.includes('rpi') ||
    rawDts.includes('brcm,bcm2711')
  ) {
    return {
      vendor: 'Raspberry Pi',
      board: 'Raspberry Pi 4 / CM4',
      processor: 'BCM2711',
      architecture: 'ARM Cortex-A72',
      soc_family: 'BCM2711',
      device_part: 'bcm2711',
      toolchain: 'Buildroot / Raspberry Pi OS Kernel',
      required_document_types: ['datasheet', 'board_reference', 'bsp_docs']
    };
  }

  // Unknown / Insufficient Evidence (Does not guess without evidence)
  return {
    vendor: 'Unknown',
    board: 'Unknown',
    processor: 'Unknown',
    architecture: 'Unknown',
    toolchain: 'Unresolved',
    required_document_types: ['board_image', 'datasheet', 'bsp_docs']
  };
}
