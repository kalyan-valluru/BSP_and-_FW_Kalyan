export interface BoardCapability {
  boardName: string;
  processorName: string;
  supportedFlows: Array<{ id: 'linux' | 'bare_metal' | 'both'; label: string; description: string }>;
}

export function resolveBoardCapabilities(boardName?: string, processorName?: string, vendor?: string): BoardCapability['supportedFlows'] {
  const normBoard = (boardName || '').toLowerCase();
  const normProc = (processorName || '').toLowerCase();
  const normVendor = (vendor || '').toLowerCase();

  // 1. Microcontrollers / MCU (Cortex-M, STM32, PIC, MSP430, AVR) -> Bare Metal Only
  if (
    normProc.includes('cortex-m') ||
    normBoard.includes('stm32') ||
    normProc.includes('stm32') ||
    normVendor.includes('stmicro') ||
    normBoard.includes('microblaze standalone')
  ) {
    return [
      { id: 'bare_metal', label: 'Bare Metal Only', description: 'Standalone bare-metal C/C++ firmware for microcontrollers' }
    ];
  }

  // 2. High-Performance Heterogeneous SoCs (Zynq-7000, Versal, Sitara AM64x, i.MX8) -> Both (BM & Linux) + Linux + Bare Metal
  if (
    normProc.includes('cortex-a9') ||
    normBoard.includes('zynq') ||
    normProc.includes('zynq') ||
    normProc.includes('cortex-a53') ||
    normProc.includes('sitara') ||
    normProc.includes('i.mx')
  ) {
    return [
      { id: 'both', label: 'Both (Bare Metal & Linux)', description: 'Dual target flow: Bare Metal BSP + Linux Kernel & Device Tree' },
      { id: 'linux', label: 'Linux Only', description: 'Linux Kernel Device Tree Source (DTS/DTB) & Driver Subsystems' },
      { id: 'bare_metal', label: 'Bare Metal Only', description: 'Standalone bare-metal BSP drivers & vector tables' }
    ];
  }

  // 3. Application Processors (Raspberry Pi CM4 / BCM2711 / Cortex-A72) -> Linux Only & Both
  return [
    { id: 'linux', label: 'Linux Only', description: 'Linux Kernel Device Tree Source (DTS/DTB) & Driver Subsystems' },
    { id: 'both', label: 'Both (Bare Metal & Linux)', description: 'Dual target flow: Bare Metal BSP + Linux Kernel & Device Tree' },
    { id: 'bare_metal', label: 'Bare Metal Only', description: 'Standalone bare-metal BSP drivers' }
  ];
}
