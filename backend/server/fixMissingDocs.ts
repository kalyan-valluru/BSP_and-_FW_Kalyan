import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

interface AltDoc {
  vendor: string;
  family: string;
  boardName: string;
  category: 'trm' | 'datasheet' | 'sdk' | 'bsp' | 'errata';
  filename: string;
  url: string;
}

const altDocs: AltDoc[] = [
  // Allwinner H616 Datasheet (Direct official mirror)
  {
    vendor: 'allwinner',
    family: 'h616',
    boardName: 'Orange Pi Zero 2 (Allwinner H616)',
    category: 'datasheet',
    filename: 'Allwinner_H616_Datasheet_v1.0.pdf',
    url: 'https://dl.linux-sunxi.org/H616/H616_Datasheet_v1.0.pdf'
  },
  // Rockchip RK3588 TRM
  {
    vendor: 'rockchip',
    family: 'rk3588',
    boardName: 'Radxa ROCK 5B / Orange Pi 5 (RK3588)',
    category: 'trm',
    filename: 'Rockchip_RK3588_TRM_V1.0_Part1.pdf',
    url: 'https://dl.radxa.com/rock5/5b/docs/hw/datasheets/Rockchip_RK3588_TRM_V1.0_Part1.pdf'
  }
];

async function main() {
  const baseRepoDir = path.join(process.cwd(), 'vendor_repository', 'raw');
  console.log('=== RETRYING ALTERNATE CDN LINKS FOR ALLWINNER AND ROCKCHIP ===');

  for (const doc of altDocs) {
    const targetDir = path.join(baseRepoDir, doc.vendor, doc.family, doc.category);
    await fs.mkdir(targetDir, { recursive: true });
    const targetPath = path.join(targetDir, doc.filename);

    console.log(`[ALT FETCH] ${doc.boardName} -> ${doc.filename}`);

    try {
      const resp = await fetch(doc.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (resp.ok) {
        const arrayBuf = await resp.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        await fs.writeFile(targetPath, buf);
        const sha256 = crypto.createHash('sha256').update(buf).digest('hex');

        const metaPath = path.join(baseRepoDir, doc.vendor, doc.family, 'metadata.json');
        let metaList: any[] = [];
        try {
          const existing = await fs.readFile(metaPath, 'utf-8');
          metaList = JSON.parse(existing);
        } catch {}

        metaList.push({
          vendor: doc.vendor,
          familyName: doc.family,
          boardName: doc.boardName,
          category: doc.category,
          originalFilename: doc.filename,
          downloadUrl: doc.url,
          fileSize: buf.length,
          sha256,
          downloadTimestamp: new Date().toISOString()
        });

        await fs.writeFile(metaPath, JSON.stringify(metaList, null, 2));
        console.log(`[ALT SUCCESS] Ingested ${doc.filename} (${buf.length} bytes)`);
      } else {
        console.log(`[ALT NOTICE] HTTP ${resp.status} for ${doc.filename}`);
      }
    } catch (err: any) {
      console.error(`[ALT ERROR] ${doc.filename}: ${err.message}`);
    }
  }

  console.log('=== ALTERNATE FETCH PASS COMPLETE ===');
}

main().catch(console.error);
