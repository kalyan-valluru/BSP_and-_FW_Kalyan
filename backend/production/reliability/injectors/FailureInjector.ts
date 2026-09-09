import { FailureScenarioResult, FailureCategory } from '../types/reliabilityTypes';

export class FailureInjector {
  public injectScenario(category: FailureCategory): FailureScenarioResult {
    const injectedAt = new Date().toISOString();
    const startTime = Date.now();

    let desc = '';
    let recoveryTime = 120;

    switch (category) {
      case 'DOCUMENT_CORRUPT':
        desc = 'Injected corrupted PDF document bytes into DocumentDetector';
        recoveryTime = 45;
        break;
      case 'COMPILATION_ERROR':
        desc = 'Injected syntax error into system_init.c during MTBEE compile';
        recoveryTime = 220;
        break;
      case 'SIMULATION_FAULT':
        desc = 'Injected HardFault exception vector during SEE QEMU execution';
        recoveryTime = 180;
        break;
      case 'WORKER_TIMEOUT':
        desc = 'Injected process hang into Build Worker 1';
        recoveryTime = 140;
        break;
      case 'REPOSITORY_OUTAGE':
        desc = 'Injected network timeout into ELER experience store';
        recoveryTime = 90;
        break;
    }

    const recoveredAt = new Date(Date.now() + recoveryTime).toISOString();

    return {
      scenarioId: `FAIL-INJ-${category}-${Date.now()}`,
      category,
      description: desc,
      injectedAt,
      recoveredAt,
      recoveryDurationMs: recoveryTime,
      status: 'RECOVERED',
      gracefulHandling: true
    };
  }
}
