import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

interface MainboardMapping {
  srcName: string;
  vendor: string;
  familyName: string;
  category: string;
  destName: string;
}

const mainboardFiles: MainboardMapping[] = [
  // Raspberry Pi 4 / 5 Broadcom Files
  {
    srcName: 'RP-008248-DS-1-bcm2711-peripherals.pdf',
    vendor: 'broadcom',
    familyName: 'bcm2711',
    category: 'trm',
    destName: 'BCM2711_ARM_Peripherals_Reference_Manual.pdf'
  },
  {
    srcName: 'RP-008348-DS-6-raspberry-pi-5-product-brief.pdf',
    vendor: 'broadcom',
    familyName: 'bcm2712',
    category: 'datasheet',
    destName: 'Raspberry_Pi_5_Product_Brief.pdf'
  },

  // BeagleBone Black TI AM3358 Files
  {
    srcName: 'spruh73q.pdf',
    vendor: 'ti',
    familyName: 'am3358',
    category: 'trm',
    destName: 'AM335x_Sitara_Technical_Reference_Manual.pdf'
  },

  // STMicroelectronics STM32H7 High-Performance MCU Files
  {
    srcName: 'rm0433-stm32h743753-and-stm32h745755-advanced-armbased-32bit-mcus-stmicroelectronics.pdf',
    vendor: 'st',
    familyName: 'stm32h7',
    category: 'trm',
    destName: 'RM0433_STM32H743_753_Reference_Manual.pdf'
  },
  {
    srcName: 'stm32h743vi.pdf',
    vendor: 'st',
    familyName: 'stm32h7',
    category: 'datasheet',
    destName: 'DS12110_STM32H743VI_Datasheet.pdf'
  }
];

async function main() {
  const downloadsDir = path.join(process.env.USERPROFILE || 'C:\\Users\\Administrator', 'Downloads');
  const baseRepoDir = path.join(process.cwd(), 'vendor_repository', 'raw');

  console.log('=== STARTING AUTOMATED MAINBOARD DOCUMENT INGESTION ===');

  for (const item of mainboardFiles) {
    const targetDir = path.join(baseRepoDir, item.vendor, item.familyName, item.category);
    await fs.mkdir(targetDir, { recursive: true });

    const srcPath = path.join(downloadsDir, item.srcName);
    const destPath = path.join(targetDir, item.destName);

    try {
      const buf = await fs.readFile(srcPath);
      await fs.writeFile(destPath, buf);
      const sha256 = crypto.createHash('sha256').update(buf).digest('hex');

      const metaPath = path.join(baseRepoDir, item.vendor, item.familyName, 'metadata.json');
      let currentMeta: any[] = [];
      try {
        const existing = await fs.readFile(metaPath, 'utf-8');
        currentMeta = JSON.parse(existing);
      } catch {}

      currentMeta.push({
        vendor: item.vendor,
        familyName: item.familyName,
        category: item.category,
        originalFilename: item.destName,
        fileSize: buf.length,
        sha256,
        downloadTimestamp: new Date().toISOString()
      });

      await fs.writeFile(metaPath, JSON.stringify(currentMeta, null, 2));
      console.log(`[INGESTED MAINBOARD FILE] ${item.destName} (${buf.length} bytes) -> raw/${item.vendor}/${item.familyName}/${item.category}/`);
    } catch (err: any) {
      console.error(`[ERROR INGESTING] ${item.srcName}: ${err.message}`);
    }
  }

  console.log('=== MAINBOARD INGESTION PASS COMPLETE ===');
}

main().catch(console.error);
