import { chromium, BrowserContext, Page } from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

export interface DocumentMetadata {
  vendor: string;
  processor: string;
  board: string;
  documentType: string;
  originalFilename: string;
  downloadUrl: string;
  version?: string;
  releaseDate?: string;
  fileSize: number;
  sha256: string;
  downloadTimestamp: string;
}

export interface DownloadReport {
  downloaded: DocumentMetadata[];
  skipped: string[];
  failed: Array<{ url: string; reason: string }>;
  summary: {
    totalDetected: number;
    totalDownloaded: number;
    totalSkipped: number;
    totalFailed: number;
  };
}

export class NxpVendorDownloadAgent {
  private repoDir: string;
  private processorName: string;
  private cdpUrl: string;

  constructor(processorName: string = 'imx8mplus', cdpUrl: string = 'http://127.0.0.1:9222', repoDir?: string) {
    this.processorName = processorName;
    this.cdpUrl = cdpUrl;
    this.repoDir = repoDir || path.join(process.cwd(), 'vendor_repository', 'raw', 'nxp', processorName);
  }

  public async run(productPageUrl: string): Promise<DownloadReport> {
    console.log(`[NXP AGENT] Connecting to existing authenticated Chrome instance via CDP at ${this.cdpUrl}...`);
    
    let context: BrowserContext;
    try {
      const browser = await chromium.connectOverCDP(this.cdpUrl);
      context = browser.contexts()[0] || (await browser.newContext());
    } catch (err: any) {
      console.log(`[NXP AGENT INFO] Could not connect to CDP port at ${this.cdpUrl}. Launching local browser context...`);
      const browser = await chromium.launch({ headless: false });
      context = await browser.newContext();
    }

    const pages = context.pages();
    let page: Page = pages[0] || (await context.newPage());

    console.log(`[NXP AGENT] Navigating active browser tab to target NXP product hub: ${productPageUrl}`);
    if (!page.url().includes('i.MX8MPLUS')) {
      await page.goto(productPageUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
    }

    console.log('[NXP AGENT LOGIN WAIT] Waiting 30 seconds to allow user to complete login in the opened browser window...');
    await new Promise(r => setTimeout(r, 30000));
    console.log('[NXP AGENT LOGIN WAIT] 30 seconds completed. Proceeding with DOM scan and asset harvesting...');

    const report: DownloadReport = {
      downloaded: [],
      skipped: [],
      failed: [],
      summary: { totalDetected: 0, totalDownloaded: 0, totalSkipped: 0, totalFailed: 0 }
    };

    // Ensure directory structure exists
    const categories = ['trm', 'datasheet', 'sdk', 'bsp', 'devicetree', 'drivers', 'examples', 'release_notes', 'errata', 'misc'];
    for (const cat of categories) {
      await fs.mkdir(path.join(this.repoDir, cat), { recursive: true });
    }

    // Locate document download links
    console.log(`[NXP AGENT] Scanning DOM for downloadable vendor resources...`);
    await page.waitForTimeout(3000);
    const links = await page.$$eval('a[href]', (anchors) =>
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
            item.url.includes('mod_download.jsp') ||
            item.url.includes('Download?colCode=') ||
            item.url.includes('downloadqueue')
          )
        )
    );

    report.summary.totalDetected = links.length;
    console.log(`[NXP AGENT] Found ${links.length} potential vendor resource download links.`);

    for (const link of links) {
      const category = this.categorizeDocument(link.title, link.url);
      const filename = path.basename(new URL(link.url).pathname) || `${category}_${Date.now()}.pdf`;
      const targetDir = path.join(this.repoDir, category);
      const filePath = path.join(targetDir, filename);

      // Check if file already exists (Skip duplicate download)
      try {
        const stat = await fs.stat(filePath);
        if (stat.size > 0) {
          console.log(`[NXP AGENT SKIPPED] File already exists: ${filename}`);
          report.skipped.push(link.url);
          report.summary.totalSkipped++;
          continue;
        }
      } catch {
        // File does not exist, proceed with download
      }

      console.log(`[NXP AGENT DOWNLOADING] [Category: ${category}] ${link.title} -> ${link.url}`);

      try {
        if (link.url.toLowerCase().endsWith('.pdf') || link.url.toLowerCase().endsWith('.zip') || link.url.toLowerCase().endsWith('.tar.gz')) {
          const resp = await fetch(link.url);
          if (resp.ok) {
            const arrayBuf = await resp.arrayBuffer();
            const buf = Buffer.from(arrayBuf);
            await fs.writeFile(filePath, buf);
            const sha256 = crypto.createHash('sha256').update(buf).digest('hex');

            const metadata: DocumentMetadata = {
              vendor: 'NXP Semiconductors',
              processor: this.processorName,
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
            console.log(`[NXP AGENT FAST SUCCESS] Saved: ${filePath} (${buf.length} bytes)`);
            continue;
          }
        }

        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 1500 }).catch(() => null),
          page.evaluate((url) => { window.location.href = url; }, link.url).catch(() => {})
        ]);

        if (download) {
          await download.saveAs(filePath);
          const fileBuf = await fs.readFile(filePath);
          const stat = await fs.stat(filePath);
          const sha256 = crypto.createHash('sha256').update(fileBuf).digest('hex');

          const metadata: DocumentMetadata = {
            vendor: 'NXP Semiconductors',
            processor: this.processorName,
            board: 'Target Board',
            documentType: category,
            originalFilename: filename,
            downloadUrl: link.url,
            fileSize: stat.size,
            sha256,
            downloadTimestamp: new Date().toISOString()
          };

          report.downloaded.push(metadata);
          report.summary.totalDownloaded++;
          console.log(`[NXP AGENT SUCCESS] Saved: ${filePath} (${stat.size} bytes)`);
        } else {
          report.failed.push({ url: link.url, reason: 'Download event timed out or required interaction.' });
          report.summary.totalFailed++;
        }
      } catch (err: any) {
        console.error(`[NXP AGENT FAILED] ${link.url}: ${err.message}`);
        report.failed.push({ url: link.url, reason: err.message });
        report.summary.totalFailed++;
      }
    }

    // Write metadata.json and download report
    const metadataPath = path.join(this.repoDir, 'metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(report.downloaded, null, 2));

    const reportPath = path.join(this.repoDir, 'download_report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    console.log(`[NXP AGENT COMPLETED] Total Downloaded: ${report.summary.totalDownloaded} | Total Skipped: ${report.summary.totalSkipped} | Total Failed: ${report.summary.totalFailed}`);
    return report;
  }

  private categorizeDocument(title: string, url: string): string {
    const text = `${title} ${url}`.toLowerCase();
    if (text.includes('trm') || text.includes('technical reference')) return 'trm';
    if (text.includes('datasheet')) return 'datasheet';
    if (text.includes('sdk') || text.includes('mcuxpresso')) return 'sdk';
    if (text.includes('bsp') || text.includes('linux bsp')) return 'bsp';
    if (text.includes('dts') || text.includes('device tree')) return 'devicetree';
    if (text.includes('driver')) return 'drivers';
    if (text.includes('example') || text.includes('sample')) return 'examples';
    if (text.includes('release note')) return 'release_notes';
    if (text.includes('errata')) return 'errata';
    return 'misc';
  }
}
