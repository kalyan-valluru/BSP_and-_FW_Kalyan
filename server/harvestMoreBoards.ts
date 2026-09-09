import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

interface NewBoardDoc {
  vendor: string;
  family: string;
  boardName: string;
  category: 'trm' | 'datasheet' | 'sdk' | 'bsp' | 'errata';
  filename: string;
  url: string;
}

const additionalMainstreamBoards: NewBoardDoc[] = [
  // 1. Raspberry Pi RP2040 / RP2350 (Raspberry Pi Pico & Pico 2)
  {
    vendor: 'raspberrypi',
    family: 'rp2040',
    boardName: 'Raspberry Pi Pico',
    category: 'trm',
    filename: 'RP2040_Datasheet.pdf',
    url: 'https://datasheets.raspberrypi.com/rp2040/rp2040-datasheet.pdf'
  },
  {
    vendor: 'raspberrypi',
    family: 'rp2350',
    boardName: 'Raspberry Pi Pico 2 RISC-V/ARM',
    category: 'trm',
    filename: 'RP2350_Datasheet.pdf',
    url: 'https://datasheets.raspberrypi.com/rp2350/rp2350-datasheet.pdf'
  },

  // 2. STMicroelectronics STM32F4 (STM32F4 Discovery / STM32F407)
  {
    vendor: 'st',
    family: 'stm32f4',
    boardName: 'STM32F4 Discovery (STM32F407VG)',
    category: 'trm',
    filename: 'RM0090_STM32F405_415_407_417_Reference_Manual.pdf',
    url: 'https://www.st.com/resource/en/reference_manual/rm0090-stm32f405415-stm32f407417-advanced-armbased-32bit-mcus-stmicroelectronics.pdf'
  },
  {
    vendor: 'st',
    family: 'stm32f4',
    boardName: 'STM32F4 Discovery (STM32F407VG)',
    category: 'datasheet',
    filename: 'DS8626_STM32F405_STM32F407_Datasheet.pdf',
    url: 'https://www.st.com/resource/en/datasheet/stm32f407vg.pdf'
  },

  // 3. Texas Instruments MSP430 (MSP430G2 LaunchPad)
  {
    vendor: 'ti',
    family: 'msp430',
    boardName: 'MSP430G2 LaunchPad',
    category: 'trm',
    filename: 'SLAU144_MSP430x2xx_Family_Users_Guide.pdf',
    url: 'https://www.ti.com/lit/pdf/slau144'
  },

  // 4. Espressif ESP8266 (NodeMCU v2 / ESP-12E)
  {
    vendor: 'espressif',
    family: 'esp8266',
    boardName: 'NodeMCU ESP8266',
    category: 'trm',
    filename: 'ESP8266_Technical_Reference_Manual.pdf',
    url: 'https://www.espressif.com/sites/default/files/documentation/esp8266-technical_reference_en.pdf'
  }
];

async function main() {
  const baseRepoDir = path.join(process.cwd(), 'vendor_repository', 'raw');
  console.log('=== HARVESTING MORE POPULAR MAINSTREAM EMBEDDED BOARDS ===');

  for (const doc of additionalMainstreamBoards) {
    const targetDir = path.join(baseRepoDir, doc.vendor, doc.family, doc.category);
    await fs.mkdir(targetDir, { recursive: true });
    const targetPath = path.join(targetDir, doc.filename);

    console.log(`[HARVESTING NEW BOARD] ${doc.boardName} (${doc.vendor}/${doc.family}) -> ${doc.filename}`);

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

  console.log('=== EXPANDED HARVESTING PASS COMPLETE ===');
}

main().catch(console.error);
