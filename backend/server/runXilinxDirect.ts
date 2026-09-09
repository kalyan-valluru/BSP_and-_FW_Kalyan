import { chromium } from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

interface DocumentSpec {
  name: string;
  category: 'trm' | 'datasheet' | 'sdk' | 'bsp' | 'errata';
  searchQuery: string;
}

const xilinxDocs: DocumentSpec[] = [
  {
    name: 'UG1085_Zynq_UltraScale_MPSoC_TRM.pdf',
    category: 'trm',
    searchQuery: 'UG1085 Zynq UltraScale MPSoC Technical Reference Manual PDF'
  },
  {
    name: 'UG1087_Zynq_UltraScale_Register_Reference.pdf',
    category: 'trm',
    searchQuery: 'UG1087 Zynq UltraScale Register Reference PDF'
  },
  {
    name: 'DS891_Zynq_UltraScale_MPSoC_Overview.pdf',
    category: 'datasheet',
    searchQuery: 'DS891 Zynq UltraScale MPSoC Overview PDF'
  },
  {
    name: 'DS925_Zynq_UltraScale_DC_Electrical_Datasheet.pdf',
    category: 'datasheet',
    searchQuery: 'DS925 Zynq UltraScale DC AC Electrical Data Sheet PDF'
  },
  {
    name: 'UG1137_Zynq_UltraScale_Software_Developer_Guide.pdf',
    category: 'sdk',
    searchQuery: 'UG1137 Zynq UltraScale MPSoC Software Developer Guide PDF'
  }
];

async function main() {
  const baseDir = path.join(process.cwd(), 'vendor_repository', 'raw', 'xilinx', 'zynq_ultrascale');
  console.log('=== STARTING AUTOMATED PLAYWRIGHT REAL PDF HARVESTING FOR AMD/XILINX ===');

  const categories = ['trm', 'datasheet', 'sdk', 'bsp', 'devicetree', 'drivers', 'examples', 'release_notes', 'errata', 'misc'];
  for (const cat of categories) {
    await fs.mkdir(path.join(baseDir, cat), { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const downloadedList: any[] = [];

  for (const doc of xilinxDocs) {
    const targetPath = path.join(baseDir, doc.category, doc.name);
    console.log(`[AMD HARVESTING] Searching real PDF link for ${doc.name}...`);

    try {
      await page.goto(`https://www.google.com/search?q=${encodeURIComponent(doc.searchQuery)}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      const pdfUrl = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a[href]'));
        for (const a of anchors) {
          const href = (a as HTMLAnchorElement).href;
          if (href.includes('.pdf') && (href.includes('amd.com') || href.includes('xilinx.com'))) {
            return href;
          }
        }
        return null;
      });

      if (pdfUrl) {
        console.log(`[AMD FOUND DIRECT PDF LINK] ${pdfUrl}`);
        const resp = await fetch(pdfUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        if (resp.ok) {
          const arrayBuf = await resp.arrayBuffer();
          const buf = Buffer.from(arrayBuf);
          if (buf.slice(0, 4).toString() === '%PDF') {
            await fs.writeFile(targetPath, buf);
            const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
            downloadedList.push({
              vendor: 'AMD / Xilinx',
              processor: 'zynq_ultrascale',
              board: 'ZCU102 / Ultra96-V2',
              documentType: doc.category,
              originalFilename: doc.name,
              downloadUrl: pdfUrl,
              fileSize: buf.length,
              sha256,
              downloadTimestamp: new Date().toISOString()
            });
            console.log(`[AMD SUCCESS] Downloaded REAL PDF ${doc.name} (${buf.length} bytes)`);
            continue;
          }
        }
      }

      console.log(`[AMD NOTICE] Could not fetch raw PDF for ${doc.name}`);
    } catch (err: any) {
      console.error(`[AMD ERROR] ${doc.name}: ${err.message}`);
    }
  }

  await browser.close();
  await fs.writeFile(path.join(baseDir, 'download_report.json'), JSON.stringify({ downloaded: downloadedList }, null, 2));
  await fs.writeFile(path.join(baseDir, 'metadata.json'), JSON.stringify(downloadedList, null, 2));
  console.log('=== AMD/XILINX REAL PDF INGESTION COMPLETE ===');
}

main().catch(console.error);
