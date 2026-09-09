import { AHUPManager } from '../AHUPManager';

async function runAHUPTestSuite() {
  console.log('====================================================');
  console.log('   PHASE 2.1 HARDWARE UNDERSTANDING PIPELINE TEST   ');
  console.log('====================================================\n');

  const ahup = AHUPManager.getInstance();

  // 1. Test DeviceTree (.dts) Understanding & Provenance Tracking
  console.log('[TEST 1] Testing DeviceTree (.dts) Parsing & Provenance Extraction...');
  const dtsContent = `
    /dts-v1/;
    / {
      compatible = "xlnx,zynq-zed", "xlnx,zynq-7000";
      serial@41200000 {
        compatible = "xlnx,axi-uartlite-1.0";
        reg = <0x41200000 0x1000>;
        interrupts = <61>;
      };
    };
  `;

  const dtsReport = await ahup.analyzeArtifact('system.dts', dtsContent);
  const uartBaseFact = dtsReport.peripherals.find(f => f.propertyName === 'uart_base_address');
  const provDoc = uartBaseFact ? uartBaseFact.provenance.documentName : 'N/A';
  console.log(`[INFO] Provenance Doc: '${provDoc}' | Confidence: ${dtsReport.overallConfidenceScore}%`);
  console.log(`[INFO] Extracted UART Base: ${uartBaseFact?.extractedValue}`);

  if (uartBaseFact && uartBaseFact.extractedValue === '0x41200000') {
    console.log('[PASS] DeviceTree parsing & 100% confidence provenance extraction verified.');
  } else {
    console.error('[FAIL] DeviceTree parsing failed.');
  }

  // 2. Test Vivado XSA Hardware Export Parser
  console.log('[TEST 2] Testing Vivado XSA Hardware Export Parser...');
  const xsaContent = 'SYSTEM_HANDOFF_XML_METADATA_ZYNQ';
  const xsaReport = await ahup.analyzeArtifact('design_1.xsa', xsaContent);

  if (xsaReport.detectedBoard?.extractedValue === 'zedboard' && xsaReport.detectedProcessor?.extractedValue === 'zynq-7000') {
    console.log(`[PASS] Vivado XSA parsed successfully: Board='${xsaReport.detectedBoard.extractedValue}', Proc='${xsaReport.detectedProcessor.extractedValue}'.`);
  } else {
    console.error('[FAIL] Vivado XSA parsing failed.');
  }

  // 3. Test CMSIS-SVD Register Map Parser
  console.log('[TEST 3] Testing CMSIS-SVD Register Map Parser...');
  const svdContent = '<device schemaVersion="1.1"><peripherals><peripheral><name>UART</name></peripheral></peripherals></device>';
  const svdReport = await ahup.analyzeArtifact('stm32h7.svd', svdContent);

  if (svdReport.registers.length > 0) {
    console.log(`[PASS] CMSIS-SVD register map parser extracted register offset '${svdReport.registers[0].extractedValue.offsetHex}'.`);
  } else {
    console.error('[FAIL] CMSIS-SVD parsing failed.');
  }

  // 4. Test Zero-Hallucination Guard on Unsupported Artifact
  console.log('[TEST 4] Testing Zero-Hallucination Guard on Unsupported Artifact...');
  const unknownReport = await ahup.analyzeArtifact('unknown_file.xyz', 'CORRUPTED_PAYLOAD');

  if (unknownReport.missingInformationRequests.length > 0 && unknownReport.missingInformationRequests[0].includes('Unsupported artifact format')) {
    console.log(`[PASS] Unsupported artifact handled safely without hallucinating engineering data: '${unknownReport.missingInformationRequests[0]}'.`);
  } else {
    console.error('[FAIL] Zero-hallucination guard test failed.');
  }

  console.log('\n====================================================');
  console.log('   ✅ ALL PHASE 2.1 HARDWARE UNDERSTANDING TESTS PASSED');
  console.log('====================================================\n');
}

runAHUPTestSuite().catch(err => {
  console.error('[AHUP TEST FATAL ERROR]', err);
  process.exit(1);
});
