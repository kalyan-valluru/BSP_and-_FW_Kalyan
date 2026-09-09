import { VKRNormalizationEngine } from './vkrNormalizationEngine';

async function main() {
  const engine = new VKRNormalizationEngine();
  const catalog = await engine.runIngestionPipeline();
  console.log('=== VKR CATALOG INGESTION SUMMARY ===');
  console.log(JSON.stringify(Object.keys(catalog).map(k => ({
    key: k,
    processorName: catalog[k].processorName,
    architecture: catalog[k].cpuArchitecture,
    peripheralsCount: Object.keys(catalog[k].peripherals).length,
    provenanceFilesCount: catalog[k].provenanceFiles.length
  })), null, 2));
}

main().catch(console.error);
