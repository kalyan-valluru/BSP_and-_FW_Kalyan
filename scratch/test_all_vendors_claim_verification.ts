import { verifyFieldClaimAgainstEvidence, verifyHardwareValueAgainstSource } from '../server/hardwareSourceVerifier';
import { buildHKL } from '../server/hardwareKnowledgeLayer';

async function runMultiVendorClaimVerification() {
  console.log('=================================================');
  console.log(' MULTI-VENDOR FIELD-LEVEL CLAIM VERIFICATION     ');
  console.log('=================================================\n');

  let passed = true;

  const targets = [
    {
      name: 'Raspberry Pi CM4',
      vendor: 'raspberrypi',
      claims: [
        { block: 'pcf8523', field: 'baseAddress', val: '0x68', expectedStatus: 'VENDOR_SOURCE_VERIFIED', sourceType: 'vendor_repository' },
        { block: 'pcf8523', field: 'type', val: 'RTC', expectedStatus: 'VENDOR_SOURCE_VERIFIED', sourceType: 'vendor_repository' },
        { block: 'uart0', field: 'baseAddress', val: '0xFE201000', expectedStatus: 'VENDOR_SOURCE_VERIFIED', sourceType: 'vendor_repository' }
      ]
    },
    {
      name: 'TI Sitara AM335x',
      vendor: 'ti',
      claims: [
        { block: 'uart0', field: 'baseAddress', val: '0x44E09000', expectedStatus: 'VENDOR_SOURCE_VERIFIED', sourceType: 'vendor_repository' },
        { block: 'spi0', field: 'baseAddress', val: '0x48030000', expectedStatus: 'VENDOR_SOURCE_VERIFIED', sourceType: 'vendor_repository' },
        { block: 'gpio1', field: 'baseAddress', val: '0x4804C000', expectedStatus: 'VENDOR_SOURCE_VERIFIED', sourceType: 'vendor_repository' }
      ]
    },
    {
      name: 'NXP i.MX 8M Plus',
      vendor: 'nxp',
      claims: [
        { block: 'uart1', field: 'baseAddress', val: '0x30860000', expectedStatus: 'VENDOR_SOURCE_VERIFIED', sourceType: 'vendor_repository' },
        { block: 'gpio1', field: 'baseAddress', val: '0x30200000', expectedStatus: 'VENDOR_SOURCE_VERIFIED', sourceType: 'vendor_repository' }
      ]
    },
    {
      name: 'STMicroelectronics STM32MP157',
      vendor: 'st',
      claims: [
        { block: 'usart3', field: 'baseAddress', val: '0x4000F000', expectedStatus: 'VENDOR_SOURCE_VERIFIED', sourceType: 'vendor_repository' },
        { block: 'gpioa', field: 'baseAddress', val: '0x50002000', expectedStatus: 'VENDOR_SOURCE_VERIFIED', sourceType: 'vendor_repository' }
      ]
    },
    {
      name: 'NVIDIA Jetson Orin NX',
      vendor: 'nvidia',
      claims: [
        { block: 'uarta', field: 'baseAddress', val: '0x03100000', expectedStatus: 'VENDOR_SOURCE_VERIFIED', sourceType: 'vendor_repository' },
        { block: 'i2c1', field: 'baseAddress', val: '0x03160000', expectedStatus: 'VENDOR_SOURCE_VERIFIED', sourceType: 'vendor_repository' }
      ]
    },
    {
      name: 'AMD Xilinx ZynqMP',
      vendor: 'xilinx',
      claims: [
        { block: 'uart0', field: 'baseAddress', val: '0xFF000000', expectedStatus: 'VENDOR_SOURCE_VERIFIED', sourceType: 'vendor_repository' },
        { block: 'gpio', field: 'baseAddress', val: '0xFF0A0000', expectedStatus: 'VENDOR_SOURCE_VERIFIED', sourceType: 'vendor_repository' }
      ]
    },
    {
      name: 'Generic Unverified Candidate',
      vendor: 'generic',
      claims: [
        { block: 'unknown_ip', field: 'baseAddress', val: '0x99999999', expectedStatus: 'AI_INFERRED', sourceType: 'Vision/OCR Inference' }
      ]
    }
  ];

  for (const target of targets) {
    console.log(`[TESTING TARGET] ${target.name}`);
    let targetPass = true;

    for (const claim of target.claims) {
      const res = verifyFieldClaimAgainstEvidence(
        claim.field,
        claim.val,
        claim.val, // evidence match
        claim.sourceType,
        `${target.vendor}_doc.pdf`
      );

      if (res.verification_status === claim.expectedStatus) {
        console.log(`  ✅ Claim ${claim.block}.${claim.field} = '${claim.val}' -> ${res.verification_status}`);
      } else {
        console.error(`  ❌ Claim ${claim.block}.${claim.field} failed: Expected ${claim.expectedStatus}, got ${res.verification_status}`);
        targetPass = false;
        passed = false;
      }
    }

    if (targetPass) {
      console.log(`  ✅ ${target.name} CLAIM VERIFICATION PASSED\n`);
    } else {
      console.error(`  ❌ ${target.name} CLAIM VERIFICATION FAILED\n`);
    }
  }

  // Test Core vs Optional Gate Gating
  console.log('[TESTING GATING] Core vs Optional Peripheral Gate Differentiation');
  const hklInput = {
    processorName: 'TI Sitara AM335x',
    boardName: 'BeagleBone Black',
    architecture: 'ARM Cortex-A8',
    peripherals: [
      { peripheralBlock: 'uart0', baseAddress: '0x44E09000', verification_status: 'VENDOR_SOURCE_VERIFIED' }, // Core
      { peripheralBlock: 'gpio1', baseAddress: '0x4804C000', verification_status: 'VENDOR_SOURCE_VERIFIED' }, // Core
      { peripheralBlock: 'optional_sensor', baseAddress: '0x4802A000', verification_status: 'AI_INFERRED', requires_review: true } // Optional
    ]
  };

  const hkl = buildHKL(hklInput);
  if (hkl.hklStatus === 'READY' && hkl.readinessScore === 67) {
    console.log(`  ✅ Platform buildable (hklStatus: READY) with optional peripheral unverified (Readiness: ${hkl.readinessScore}%). Core gates preserved.`);
  } else {
    console.error(`  ❌ Gating check failed: hklStatus=${hkl.hklStatus}, readinessScore=${hkl.readinessScore}`);
    passed = false;
  }

  console.log('\n=================================================');
  if (passed) {
    console.log(' SUMMARY: ALL 7 HARDWARE VENDORS & GATING PASSED ');
  } else {
    console.log(' SUMMARY: MULTI-VENDOR CLAIM VERIFICATION FAILED ');
  }
  console.log('=================================================');
}

runMultiVendorClaimVerification().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
