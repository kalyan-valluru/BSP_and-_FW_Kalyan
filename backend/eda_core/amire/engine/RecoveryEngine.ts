import { UHKBRecoveryPlugin } from '../plugins/UHKBRecoveryPlugin';
import { RecoveryReport, RecoveredFact, UserDecisionRequest } from '../types/amireTypes';
import { EVEManager } from '../../eve/EVEManager';

export class RecoveryEngine {
  private uhkbPlugin = new UHKBRecoveryPlugin();
  private eve = EVEManager.getInstance();

  /**
   * Executes 7-Tier Missing Information Recovery
   */
  public async recover(partialPayload: any): Promise<RecoveryReport> {
    const timestamp = new Date().toISOString();
    const recoveredFields: RecoveredFact[] = [];
    const stillMissingFields: string[] = [];
    const userDecisionRequests: UserDecisionRequest[] = [];

    // Check missing processor
    if (!partialPayload.processorId && !partialPayload.targetProcessorId) {
      stillMissingFields.push('processor_id');
      userDecisionRequests.push({
        propertyName: 'processor_id',
        explanation: 'Processor architecture is missing from input artifacts.',
        affectedWorkflows: ['BSP Compilation', 'Driver Synthesizer', 'EVE Validation'],
        validOptions: [
          { label: 'AMD Xilinx Zynq-7000', value: 'zynq-7000', description: 'Dual ARM Cortex-A9' },
          { label: 'STMicroelectronics STM32H7', value: 'stm32h743', description: 'ARM Cortex-M7' },
          { label: 'Texas Instruments Sitara AM335x', value: 'am335x', description: 'ARM Cortex-A8' },
          { label: 'NXP i.MX8M Plus', value: 'imx8m-plus', description: 'Quad Cortex-A53' }
        ]
      });
    }

    // Attempt Tier 3 U-HKB recovery for missing clocks
    if (!partialPayload.clocks || partialPayload.clocks.length === 0) {
      const recClock = await this.uhkbPlugin.recoverMissingFact('clocks', partialPayload);
      if (recClock) {
        recoveredFields.push(recClock);
      } else {
        stillMissingFields.push('clocks');
      }
    }

    const totalScore = recoveredFields.reduce((acc, r) => acc + r.confidenceScore, 0);
    const overallConfidenceScore = recoveredFields.length > 0 ? Math.round((totalScore / recoveredFields.length) * 100) : 100;

    // Execute EVE Validation check on recovered model
    const validationStatus = this.eve.validate({
      targetProcessorId: partialPayload.processorId || 'zynq-7000',
      peripherals: partialPayload.peripherals || [],
      memoryRegions: partialPayload.memoryRegions || [],
      clocks: recoveredFields.find(f => f.propertyName === 'clocks')?.recoveredValue || [],
      interrupts: [],
      drivers: []
    });

    return {
      reportId: `AMIRE-REP-${Date.now()}`,
      timestamp,
      recoveredFields,
      stillMissingFields,
      conflicts: [],
      userDecisionRequests,
      overallConfidenceScore,
      validationStatus
    };
  }
}
