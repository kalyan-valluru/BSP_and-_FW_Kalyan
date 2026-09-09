import { VendorKnowledgeRepository } from './vendorKnowledgeRepository';

export interface QAResult {
  passed: boolean;
  totalPlatforms: number;
  checksExecuted: number;
  orphanedReferences: string[];
  missingAddresses: string[];
  invalidPinMappings: string[];
  missingProvenance: string[];
  schemaViolations: string[];
}

export class RepositoryQA {
  public runQA(): QAResult {
    const vkr = VendorKnowledgeRepository.getInstance();
    const result: QAResult = {
      passed: true,
      totalPlatforms: 0,
      checksExecuted: 0,
      orphanedReferences: [],
      missingAddresses: [],
      invalidPinMappings: [],
      missingProvenance: [],
      schemaViolations: []
    };

    console.log('=== STARTING AUTOMATED REPOSITORY QUALITY ASSURANCE SUITE ===');

    const searchResults = vkr.search('');
    const platforms = searchResults.filter(s => s.type === 'processor');
    result.totalPlatforms = platforms.length;

    for (const plat of platforms) {
      const parts = plat.path.split('/');
      const vendor = parts[0];
      const family = parts[1];

      // 1. Verify Processor Provenance
      result.checksExecuted++;
      const proc = vkr.getProcessor(vendor, family);
      if (!proc || !proc.provenance || !proc.provenance.document) {
        result.missingProvenance.push(`Processor ${plat.path} missing provenance metadata.`);
      }

      // 2. Verify Peripheral Addresses
      result.checksExecuted++;
      const periphs = vkr.getPeripherals(vendor, family);
      for (const p of periphs) {
        if (!p.baseAddress || p.baseAddress === '0x00000000') {
          result.missingAddresses.push(`Peripheral ${p.name} on ${plat.path} missing base address.`);
        }
      }

      // 3. Verify Pin Mappings
      result.checksExecuted++;
      const pins = vkr.getPinMux(vendor, family);
      for (const pin of pins) {
        if (!pin.pinNumber || !pin.signalName) {
          result.invalidPinMappings.push(`Invalid pin mapping on ${plat.path}: Pin ${pin.pinNumber}`);
        }
      }
    }

    result.passed = (
      result.orphanedReferences.length === 0 &&
      result.missingAddresses.length === 0 &&
      result.invalidPinMappings.length === 0 &&
      result.missingProvenance.length === 0 &&
      result.schemaViolations.length === 0
    );

    console.log(`[QA SUITE COMPLETE] Executed ${result.checksExecuted} QA rules across ${result.totalPlatforms} platforms.`);
    console.log(`  Passed: ${result.passed}`);
    return result;
  }
}
