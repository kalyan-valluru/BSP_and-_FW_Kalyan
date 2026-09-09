import { ISimulationAdapter } from './ISimulationAdapter';
import { SimulationResult, RuntimeEvent } from '../types/seeTypes';

export class QEMUSimulationAdapter implements ISimulationAdapter {
  public readonly id = 'adapter-qemu';
  public readonly name = 'QEMU Virtual Hardware Simulator';

  public async runSimulation(artifact: any, context: Record<string, any>): Promise<SimulationResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const simId = `SEE-SIM-${Date.now()}`;
    const procId = context.targetProcessorId || 'zynq-7000';
    const isFault = context.simulateFault === true;

    const events: RuntimeEvent[] = [
      { timestamp, eventType: 'MEMORY_READ', message: 'Reset Handler loaded vector table at 0x00000000' },
      { timestamp, eventType: 'UART_LOG', message: 'SystemClock_Config(): PLL FCLK0 initialized to 100MHz' },
      { timestamp, eventType: 'UART_LOG', message: 'UART_Init(0x41200000): Baud 115200 OK' }
    ];

    if (isFault) {
      events.push({ timestamp, eventType: 'FAULT', message: 'HardFault: Memory Access Violation at address 0xFFFFFFFF' });
    }

    const endTime = Date.now();

    return {
      simId,
      timestamp,
      simulatorName: 'QEMU v7.2.0 (qemu-system-arm)',
      targetMachine: `xlnx-${procId}-board`,
      status: isFault ? 'FAULT' : 'SUCCESS',
      faultCategory: isFault ? 'HARD_FAULT' : 'NONE',
      exitCode: isFault ? 1 : 0,
      durationMs: endTime - startTime,
      uartConsoleOutput: isFault 
        ? '[QEMU LOG] Booting System...\n[QEMU LOG] SystemClock OK\n[HARD FAULT DETECTED] Crash at 0xFFFFFFFF'
        : '[QEMU LOG] Booting System...\n[QEMU LOG] SystemClock OK\n[QEMU LOG] UART_Init OK\n[QEMU LOG] Hello World from Bare-Metal Application!',
      events
    };
  }
}
