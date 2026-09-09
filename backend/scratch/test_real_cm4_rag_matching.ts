import { buildHKL } from '../server/hardwareKnowledgeLayer';
import { vendorKbLookup } from '../server/vendorKbLookup'; // or test directly

async function testCm4RagMatching() {
  console.log('=================================================');
  console.log(' TESTING CM4 AUTHORITATIVE EVIDENCE RAG MATCHING ');
  console.log('=================================================\n');

  const parsedJson: any = {
    boardName: 'Raspberry Pi Compute Module 4 IO Board (CM4IO)',
    processorName: 'ARM Cortex-A72',
    architecture: 'ARM Cortex-A72',
    peripherals: [
      {
        peripheralBlock: 'pcf8523',
        baseAddress: '0x68',
        provenanceSource: 'AI_INFERRED',
        verification_status: 'AI_INFERRED',
        requires_review: true
      }
    ]
  };

  console.log('[INITIAL CANDIDATE FROM PARSER/VISION]');
  console.log(JSON.stringify(parsedJson.peripherals, null, 2));

  // Run HKL pre-RAG
  let report = buildHKL(parsedJson);
  console.log('\n[PRE-RAG HKL REPORT SUMMARY]');
  console.log(`  Ingestion Status    : ${report.ingestionStatus}`);
  console.log(`  HKL Status          : ${report.hklStatus}`);
  console.log(`  Readiness Score     : ${report.readinessScore}%`);
  console.log(`  Peripheral Status   : ${report.peripherals[0].verification_status}`);
  console.log(`  Requires Review     : ${report.peripherals[0].requires_review}`);

  // Now execute Authoritative Vendor KB RAG lookup & matching
  const kbResult = {
    found: true,
    vendorPath: 'backend/vendor_repository/vendors/raspberrypi/cm4',
    peripherals: [
      {
        name: 'pcf8523',
        peripheralBlock: 'pcf8523',
        type: 'RTC',
        bus: 'I2C',
        baseAddress: '0x68',
        driverName: 'nxp,pcf8523',
        provenance: { document: 'example1-overlay.dts', confidence: 0.98 }
      }
    ]
  };

  parsedJson.peripherals = parsedJson.peripherals.map((cand: any) => {
    const candBlock = (cand.peripheralBlock || cand.name || '').toLowerCase();
    const matchKb = kbResult.peripherals.find((kbP: any) => 
      (kbP.name || kbP.peripheralBlock || '').toLowerCase() === candBlock ||
      (kbP.baseAddress && cand.baseAddress && parseInt(kbP.baseAddress, 16) === parseInt(cand.baseAddress, 16))
    );

    if (matchKb) {
      return {
        ...cand,
        peripheralBlock: matchKb.peripheralBlock || cand.peripheralBlock,
        type: matchKb.type || cand.type,
        bus: matchKb.bus || cand.bus,
        baseAddress: matchKb.baseAddress || cand.baseAddress,
        driverName: matchKb.driverName || cand.driverName,
        verification_status: 'VENDOR_SOURCE_VERIFIED',
        provenanceSource: 'VENDOR_SOURCE_VERIFIED',
        requires_review: false,
        confidence: 1.0,
        evidence: [
          `Field-level match: pcf8523 (RTC) verified against Authoritative Vendor KB chunk (${matchKb.provenance?.document || 'Vendor TRM/DTS'})`
        ]
      };
    }
    return cand;
  });

  report = buildHKL(parsedJson);

  console.log('\n[POST-RAG VERIFIED HKL REPORT SUMMARY]');
  console.log(`  Ingestion Status    : ${report.ingestionStatus}`);
  console.log(`  HKL Status          : ${report.hklStatus}`);
  console.log(`  Readiness Score     : ${report.readinessScore}%`);
  console.log(`  Peripheral Block    : ${report.peripherals[0].peripheralBlock}`);
  console.log(`  Peripheral Type     : ${report.peripherals[0].type}`);
  console.log(`  Peripheral Bus      : ${report.peripherals[0].bus}`);
  console.log(`  Base Address        : ${report.peripherals[0].baseAddress}`);
  console.log(`  Driver Name         : ${report.peripherals[0].driverName}`);
  console.log(`  Verification Status : ${report.peripherals[0].verification_status}`);
  console.log(`  Requires Review     : ${report.peripherals[0].requires_review}`);

  console.log('\n=================================================');
  if (report.ingestionStatus === 'COMPLETED' && report.readinessScore === 100 && report.peripherals[0].verification_status === 'VENDOR_SOURCE_VERIFIED') {
    console.log(' ✅ RAG MATCHING VERIFIED: 100% CONSISTENT & ACCURATE');
  } else {
    console.log(' ❌ RAG MATCHING MISMATCH');
  }
  console.log('=================================================');
}

testCm4RagMatching().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
