import { IVendorAcquisitionPlugin, VAMDownloadReport } from './vamEngine';
import { MultiVendorDownloadAgent } from '../multiVendorDownloadAgent';

export class MultiVendorVAMAdapter implements IVendorAcquisitionPlugin {
  public vendorId: string;
  private agent: MultiVendorDownloadAgent;

  constructor(vendorId: string, cdpUrl: string = 'http://127.0.0.1:9222') {
    this.vendorId = vendorId;
    this.agent = new MultiVendorDownloadAgent(cdpUrl);
  }

  public supportsFamily(_family: string): boolean {
    return true; // Supports any family for the assigned vendor
  }

  public async acquireResources(family: string, productPageUrl: string): Promise<VAMDownloadReport> {
    console.log(`[VAM ADAPTER - ${this.vendorId.toUpperCase()}] Delegating resource discovery to Playwright browser agent...`);
    const rawReport = await this.agent.runVendorHarvesting(this.vendorId as any, family, productPageUrl);

    return {
      vendor: this.vendorId,
      family,
      downloaded: rawReport.downloaded.map(d => ({
        vendor: d.vendor,
        family: d.processor,
        category: (d.documentType as any) || 'misc',
        originalFilename: d.originalFilename,
        downloadUrl: d.downloadUrl,
        fileSizeBytes: d.fileSize,
        sha256: d.sha256,
        downloadTimestamp: d.downloadTimestamp,
        licenseType: 'Vendor EULA (Browser Handshake)',
        acquisitionMethod: `VAM ${this.vendorId.toUpperCase()} Playwright Plugin`,
        readOnlyReference: true
      })),
      skipped: rawReport.skipped,
      failed: rawReport.failed,
      requiresUserAuth: false
    };
  }
}
