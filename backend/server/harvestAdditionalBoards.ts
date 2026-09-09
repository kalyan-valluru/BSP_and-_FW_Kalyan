import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

interface AutoDownloadDoc {
  vendor: string;
  family: string;
  boardName: string;
  category: 'trm' | 'datasheet' | 'sdk' | 'bsp' | 'errata';
  filename: string;
  url: string;
}

const additionalBoards: AutoDownloadDoc[] = [
  // 1. Rockchip RK3588 (Radxa ROCK 5B / Orange Pi 5 / Pine64)
  {
    vendor: 'rockchip',
    family: 'rk3588',
    boardName: 'Radxa ROCK 5B / Orange Pi 5',
    category: 'trm',
    filename: 'Rockchip_RK3588_TRM_V1.0_Part1.pdf',
    url: 'https://opensource.rock-chips.com/images/0/04/Rockchip_RK3588_TRM_V1.0_Part1.pdf'
  },
  {
    vendor: 'rockchip',
    family: 'rk3588',
    boardName: 'Radxa ROCK 5B / Orange Pi 5',
    category: 'datasheet',
    filename: 'Rockchip_RK3588_Datasheet_V1.0.pdf',
    url: 'https://opensource.rock-chips.com/images/7/77/Rockchip_RK3588_Datasheet_V1.0.pdf'
  },

  // 2. Allwinner H616 / H6 (Orange Pi Zero 2 / Banana Pi M4)
  {
    vendor: 'allwinner',
    family: 'h616',
    boardName: 'Orange Pi Zero 2',
    category: 'datasheet',
    filename: 'Allwinner_H616_User_Manual_v1.0.pdf',
    url: 'https://linux-sunxi.org/images/7/79/H616_User_Manual_v1.0.pdf'
  },

  // 3. Microchip SAMD21 / SAMD51 (Arduino Zero / Adafruit Grand Central)
  {
    vendor: 'microchip',
    family: 'samd21',
    boardName: 'Arduino Zero / SAMD21 Development Board',
    category: 'trm',
    filename: 'SAMD21_Complete_Datasheet.pdf',
    url: 'https://ww1.microchip.com/downloads/en/DeviceDoc/SAMD21-Complete-Datasheet-DS40001882.pdf'
  },

  // 4. Espressif ESP32-C3 RISC-V Platform (ESP32-C3-DevKitC-02)
  {
    vendor: 'espressif',
    family: 'esp32c3',
    boardName: 'ESP32-C3 RISC-V DevKit',
    category: 'trm',
    filename: 'ESP32-C3_Technical_Reference_Manual.pdf',
    url: 'https://www.espressif.com/sites/default/files/documentation/esp32-c3_technical_reference_manual_en.pdf'
  },
  {
    vendor: 'espressif',
    family: 'esp32c3',
    boardName: 'ESP32-C3 RISC-V DevKit',
    category: 'datasheet',
    filename: 'ESP32-C3_Datasheet.pdf',
    url: 'https://www.espressif.com/sites/default/files/documentation/esp32-c3_datasheet_en.pdf'
  }
];

async function main() {
  const baseRepoDir = path.join(process.cwd(), 'vendor_repository', 'raw');
  console.log('=== STARTING AUTOMATED HARVESTING FOR ADDITIONAL POPULAR EMBEDDED BOARDS ===');

  for (const doc of additionalBoards) {
    const targetDir = path.join(baseRepoDir, doc.vendor, doc.family, doc.category);
    await fs.mkdir(targetDir, { recursive: true });
    const targetPath = path.join(targetDir, doc.filename);

    console.log(`[HARVESTING BOARD] ${doc.boardName} (${doc.vendor}/${doc.family}) -> ${doc.filename}`);

    try {
      const resp = await fetch(doc.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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
        console.log(`[SUCCESS] Ingested ${doc.filename} (${buf.length} bytes)`);
      } else {
        console.log(`[NOTICE] HTTP ${resp.status} for ${doc.filename}`);
      }
    } catch (err: any) {
      console.error(`[ERROR] ${doc.filename}: ${err.message}`);
    }
  }

  console.log('=== ADDITIONAL BOARDS HARVESTING PASS COMPLETE ===');
}

main().catch(console.error);
