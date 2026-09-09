import { chromium, BrowserContext, Page } from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { DocumentMetadata, DownloadReport } from './nxpVendorDownloadAgent';

export class MultiVendorDownloadAgent {
  private baseRepoDir: string;
  private cdpUrl: string;

  constructor(cdpUrl: string = 'http://127.0.0.1:9222', baseRepoDir?: string) {
    this.cdpUrl = cdpUrl;
    this.baseRepoDir = baseRepoDir || path.join(process.cwd(), 'vendor_repository', 'raw');
  }

  public async runVendorHarvesting(vendor: 'nvidia' | 'ti' | 'st' | 'xilinx', familyName: string, productPageUrl: string): Promise<DownloadReport> {
    const repoDir = path.join(this.baseRepoDir, vendor, familyName);
    console.log(`[VENDOR AGENT - ${vendor.toUpperCase()}] Initializing harvesting pass for ${familyName}...`);
    
    let context: BrowserContext;
    try {
      const browser = await chromium.connectOverCDP(this.cdpUrl);
      context = browser.contexts()[0] || (await browser.newContext());
    } catch (err: any) {
      console.log(`[VENDOR AGENT - ${vendor.toUpperCase()}] CDP connection not found. Launching local browser context...`);
      const browser = await chromium.launch({ headless: false });
      context = await browser.newContext();
    }

    const page = await context.newPage();

    console.log(`[VENDOR AGENT - ${vendor.toUpperCase()}] Navigating to product hub in new browser tab: ${productPageUrl}`);
    await page.goto(productPageUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});

    console.log(`[VENDOR AGENT - ${vendor.toUpperCase()}] Waiting 20 seconds to allow login / user interaction in the opened tab...`);
    await new Promise(r => setTimeout(r, 20000));

    const categories = ['trm', 'datasheet', 'sdk', 'bsp', 'devicetree', 'drivers', 'examples', 'release_notes', 'errata', 'misc'];
    for (const cat of categories) {
      await fs.mkdir(path.join(repoDir, cat), { recursive: true });
    }

    const report: DownloadReport = {
      downloaded: [],
      skipped: [],
      failed: [],
      summary: { totalDetected: 0, totalDownloaded: 0, totalSkipped: 0, totalFailed: 0 }
    };

    console.log(`[VENDOR AGENT - ${vendor.toUpperCase()}] Scanning DOM for engineering resources...`);
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(3000);

    let links: Array<{ title: string; url: string }> = [];
    try {
      links = await page.$$eval('a[href]', (anchors) =>
        anchors
          .map((a) => ({
            title: (a.textContent || a.getAttribute('title') || '').trim(),
            url: (a as any).href,
          }))
          .filter((item) =>
            item.url && (
              item.url.includes('.pdf') ||
              item.url.includes('.zip') ||
              item.url.includes('.tar.gz') ||
              item.url.includes('.bsdl') ||
              item.url.includes('download') ||
              item.url.includes('document')
            )
          )
      );
    } catch {
      await page.waitForTimeout(2000);
      links = await page.$$eval('a[href]', (anchors) =>
        anchors
          .map((a) => ({
            title: (a.textContent || a.getAttribute('title') || '').trim(),
            url: (a as any).href,
          }))
          .filter((item) =>
            item.url && (
              item.url.includes('.pdf') ||
              item.url.includes('.zip') ||
              item.url.includes('.tar.gz') ||
              item.url.includes('.bsdl') ||
              item.url.includes('download') ||
              item.url.includes('document')
            )
          )
      ).catch(() => []);
    }

    report.summary.totalDetected = links.length;
    console.log(`[VENDOR AGENT - ${vendor.toUpperCase()}] Found ${links.length} potential downloadable resources.`);

    for (const link of links) {
      const category = this.categorizeDocument(link.title, link.url);
      const filename = path.basename(new URL(link.url).pathname) || `${category}_${Date.now()}.pdf`;
      const targetDir = path.join(repoDir, category);
      const filePath = path.join(targetDir, filename);

      try {
        const stat = await fs.stat(filePath);
        if (stat.size > 0) {
          console.log(`[VENDOR AGENT SKIPPED] File exists: ${filename}`);
          report.skipped.push(link.url);
          report.summary.totalSkipped++;
          continue;
        }
      } catch {}

      console.log(`[VENDOR AGENT DOWNLOADING] [${category}] ${link.title} -> ${link.url}`);

      try {
        if (link.url.toLowerCase().endsWith('.pdf') || link.url.toLowerCase().endsWith('.zip') || link.url.toLowerCase().endsWith('.tar.gz')) {
          const resp = await fetch(link.url);
          if (resp.ok) {
            const arrayBuf = await resp.arrayBuffer();
            const buf = Buffer.from(arrayBuf);
            await fs.writeFile(filePath, buf);
            const sha256 = crypto.createHash('sha256').update(buf).digest('hex');

            const metadata: DocumentMetadata = {
              vendor: vendor.toUpperCase(),
              processor: familyName,
              board: 'Target Board',
              documentType: category,
              originalFilename: filename,
              downloadUrl: link.url,
              fileSize: buf.length,
              sha256,
              downloadTimestamp: new Date().toISOString()
            };

            report.downloaded.push(metadata);
            report.summary.totalDownloaded++;
            console.log(`[VENDOR AGENT FAST SUCCESS] Saved: ${filePath} (${buf.length} bytes)`);
            continue;
          }
        }
      } catch (err: any) {
        report.failed.push({ url: link.url, reason: err.message });
        report.summary.totalFailed++;
      }
    }

    await fs.writeFile(path.join(repoDir, 'download_report.json'), JSON.stringify(report, null, 2));
    await fs.writeFile(path.join(repoDir, 'metadata.json'), JSON.stringify(report.downloaded, null, 2));
    console.log(`[VENDOR AGENT - ${vendor.toUpperCase()}] Harvesting complete for ${familyName}. Summary:`, report.summary);
    return report;
  }

  private categorizeDocument(title: string, url: string): string {
    const text = (title + ' ' + url).toLowerCase();
    if (text.includes('reference manual') || text.includes('trm') || text.includes('technical reference')) return 'trm';
    if (text.includes('datasheet') || text.includes('data sheet')) return 'datasheet';
    if (text.includes('sdk') || text.includes('software development kit')) return 'sdk';
    if (text.includes('bsp') || text.includes('board support package')) return 'bsp';
    if (text.includes('device tree') || text.includes('dts') || text.includes('.dtb')) return 'devicetree';
    if (text.includes('driver')) return 'drivers';
    if (text.includes('example') || text.includes('sample')) return 'examples';
    if (text.includes('release note')) return 'release_notes';
    if (text.includes('errata')) return 'errata';
    return 'misc';
  }
}
