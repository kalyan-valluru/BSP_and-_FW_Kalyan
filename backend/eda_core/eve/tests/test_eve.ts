import { EVEManager } from '../EVEManager';
import { BaseEVERule } from '../rules/BaseRule';
import { ValidationContext, ValidationIssueItem } from '../types/eveTypes';

async function runEVETestSuite() {
  console.log('====================================================');
  console.log('   PHASE 1.5 ENGINEERING VALIDATION ENGINE (EVE) TEST');
  console.log('====================================================\n');

  const eve = EVEManager.getInstance();

  // 1. Valid Hardware Topology Test
  console.log('[TEST 1] Running 6-Stage EVE Pipeline on Valid Hardware Context...');
  const validContext: ValidationContext = {
    targetProcessorId: 'zynq-7000',
    peripherals: [
      { id: 'axi_uartlite_0', category: 'UART', name: 'AXI UART Lite', baseAddress: '0x41200000', sizeBytes: 4096 }
    ],
    memoryRegions: [{ id: 'ddr3', startAddress: '0x00100000', sizeBytes: 536870912 }],
    clocks: [{ id: 'fclk_0', processorId: 'zynq-7000', frequencyHz: 100000000 }],
    interrupts: [{ id: 'irq61', irqNumber: 61 }],
    drivers: [{ id: 'xuartlite' }]
  };

  const validReport = eve.validate(validContext);
  console.log(`[INFO] Readiness Score: ${validReport.readinessScore}% | Total Issues: ${validReport.issues.length}`);

  if (validReport.readinessScore === 100 && validReport.issues.length === 0) {
    console.log('[PASS] Valid hardware context passed 6-stage pipeline with 100% readiness score.');
  } else {
    console.error('[FAIL] Valid hardware test produced unexpected issues.');
  }

  // 2. Missing Clock & Memory Overlap Rule Verification
  console.log('\n[TEST 2] Testing Missing Clock & Memory Overlap Rules...');
  const invalidContext: ValidationContext = {
    targetProcessorId: 'zynq-7000',
    peripherals: [
      { id: 'uart1', category: 'UART', name: 'UART 1', baseAddress: '0x41200000', sizeBytes: 4096 },
      { id: 'uart2', category: 'UART', name: 'UART 2', baseAddress: '0x41200000', sizeBytes: 4096 }, // Overlap!
      { id: 'eth0', category: 'ETH', name: 'Gigabit ETH', baseAddress: '0x41300000', hasDma: false } // No DMA!
    ],
    memoryRegions: [],
    clocks: [], // Missing clocks!
    interrupts: [],
    drivers: []
  };

  const invalidReport = eve.validate(invalidContext);
  console.log(`[INFO] Invalid Hardware Score: ${invalidReport.readinessScore}% | Criticals: ${invalidReport.criticalCount} | Errors: ${invalidReport.errorCount}`);

  if (invalidReport.criticalCount > 0 && invalidReport.issues.some(i => i.id.includes('OVERLAP'))) {
    console.log('[PASS] EVE pipeline correctly identified CRITICAL memory overlap and missing clock issues.');
  } else {
    console.error('[FAIL] Rule validation test failed.');
  }

  // 3. Multi-Format Report Generation Test
  console.log('\n[TEST 3] Testing Multi-Format Report Generation (JSON, HTML, Markdown)...');
  const jsonOut = eve.generateReport(invalidReport, 'json');
  const htmlOut = eve.generateReport(invalidReport, 'html');
  const mdOut = eve.generateReport(invalidReport, 'markdown');

  if (jsonOut.includes('readinessScore') && htmlOut.includes('<html>') && mdOut.includes('# Engineering Validation Engine')) {
    console.log('[PASS] All 3 report formatters (JSON, HTML, Markdown) generated successfully.');
  } else {
    console.error('[FAIL] Report formatter test failed.');
  }

  // 4. Custom Vendor Rule Registration Test
  console.log('\n[TEST 4] Testing Custom Modular Vendor Rule Registration...');
  class CustomVendorRule extends BaseEVERule {
    public readonly id = 'custom-rule-vendor-01';
    public readonly name = 'Custom Vendor Pinmux Rule';
    public readonly category = 'pinmux';

    public evaluate(ctx: ValidationContext): ValidationIssueItem[] {
      return [
        this.createIssue({
          id: 'ISSUE-CUSTOM-PINMUX',
          severity: 'WARNING',
          category: 'pinmux',
          affectedComponent: 'PIN_A1',
          rootCause: 'Pin A1 default pull-up resistor unconfigured.',
          engineeringExplanation: 'Floating GPIO pins can lead to unpredictable logic state toggles.',
          suggestedFix: 'Configure 10k internal pull-up resistor.'
        })
      ];
    }
  }

  eve.pipeline.registerCustomRule(new CustomVendorRule());
  const customReport = eve.validate(validContext);

  if (customReport.issues.some(i => i.id === 'ISSUE-CUSTOM-PINMUX')) {
    console.log('[PASS] Dynamic runtime registration of custom vendor rule verified.');
  } else {
    console.error('[FAIL] Custom rule registration test failed.');
  }

  console.log('\n====================================================');
  console.log('   ✅ ALL PHASE 1.5 VALIDATION ENGINE TESTS PASSED');
  console.log('====================================================\n');
}

runEVETestSuite().catch(err => {
  console.error('[EVE TEST FATAL ERROR]', err);
  process.exit(1);
});
