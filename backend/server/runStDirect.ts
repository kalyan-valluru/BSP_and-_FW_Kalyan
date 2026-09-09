import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

interface DocumentSpec {
  name: string;
  category: 'trm' | 'datasheet' | 'sdk' | 'bsp' | 'errata';
  url: string;
}

const stDocs: DocumentSpec[] = [
  {
    name: 'RM0436_STM32MP157_Reference_Manual.pdf',
    category: 'trm',
    url: 'https://www.st.com/resource/en/reference_manual/rm0436-stm32mp157-advanced-armbased-32bit-mpus-stmicroelectronics.pdf'
  },
  {
    name: 'RM0442_STM32MP153_Reference_Manual.pdf',
    category: 'trm',
    url: 'https://www.st.com/resource/en/reference_manual/rm0442-stm32mp153-advanced-armbased-32bit-mpus-stmicroelectronics.pdf'
  },
  {
    name: 'DS12500_STM32MP157C_Datasheet.pdf',
    category: 'datasheet',
    url: 'https://www.st.com/resource/en/datasheet/stm32mp157c.pdf'
  },
  {
    name: 'ES0438_STM32MP157_Errata_Sheet.pdf',
    category: 'errata',
    url: 'https://www.st.com/resource/en/errata_sheet/es0438-stm32mp157c-device-errata-stmicroelectronics.pdf'
  },
  {
    name: 'AN5031_STM32MP157_Hardware_Development_Guide.pdf',
    category: 'datasheet',
    url: 'https://www.st.com/resource/en/application_note/an5031-getting-started-with-stm32mp151-stm32mp153-and-stm32mp157-line-hardware-development-stmicroelectronics.pdf'
  }
];

async function main() {
  const baseDir = path.join(process.cwd(), 'vendor_repository', 'raw', 'st', 'stm32mp157');
  console.log('=== STARTING DIRECT FAST INGESTION FOR STMICROELECTRONICS (STM32MP157) ===');

  const categories = ['trm', 'datasheet', 'sdk', 'bsp', 'devicetree', 'drivers', 'examples', 'release_notes', 'errata', 'misc'];
  for (const cat of categories) {
    await fs.mkdir(path.join(baseDir, cat), { recursive: true });
  }

  const downloadedList: any[] = [];

  for (const doc of stDocs) {
    const targetPath = path.join(baseDir, doc.category, doc.name);
    console.log(`[ST INGESTING] [${doc.category}] ${doc.name} -> ${doc.url}`);

    try {
      const resp = await fetch(doc.url);
      if (resp.ok) {
        const arrayBuf = await resp.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        await fs.writeFile(targetPath, buf);
        const sha256 = crypto.createHash('sha256').update(buf).digest('hex');

        downloadedList.push({
          vendor: 'STMicroelectronics',
          processor: 'stm32mp157',
          board: 'STM32MP157C-DK2 / EV1',
          documentType: doc.category,
          originalFilename: doc.name,
          downloadUrl: doc.url,
          fileSize: buf.length,
          sha256,
          downloadTimestamp: new Date().toISOString()
        });
        console.log(`[ST FAST SUCCESS] Saved ${doc.name} (${buf.length} bytes)`);
      } else {
        console.log(`[ST HTTP NOTICE] HTTP ${resp.status} for ${doc.name}`);
      }
    } catch (err: any) {
      console.error(`[ST DOWNLOAD ERROR] ${doc.name}: ${err.message}`);
    }
  }

  await fs.writeFile(path.join(baseDir, 'download_report.json'), JSON.stringify({ downloaded: downloadedList }, null, 2));
  await fs.writeFile(path.join(baseDir, 'metadata.json'), JSON.stringify(downloadedList, null, 2));
  console.log('=== STMICROELECTRONICS INGESTION COMPLETE ===');
}

main().catch(console.error);
