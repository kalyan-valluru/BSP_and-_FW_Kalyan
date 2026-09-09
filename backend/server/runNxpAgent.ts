import { NxpVendorDownloadAgent } from './nxpVendorDownloadAgent';

async function main() {
  const agent = new NxpVendorDownloadAgent('imx8mplus', 'http://127.0.0.1:9222');
  const url = 'https://www.nxp.com/products/processors-and-microcontrollers/arm-processors/i-mx-applications-processors/i-mx-8-processors/i-mx-8m-plus-arm-cortex-a53-m7-cortex-m4:i.MX8MPLUS';
  console.log('[NXP DOWNLOAD AGENT] Starting document harvesting...');
  const report = await agent.run(url);
  console.log('[NXP DOWNLOAD AGENT] Harvesting complete. Output summary:', JSON.stringify(report.summary, null, 2));
}

main().catch(err => {
  console.error('[NXP DOWNLOAD AGENT FATAL ERROR]', err);
  process.exit(1);
});
