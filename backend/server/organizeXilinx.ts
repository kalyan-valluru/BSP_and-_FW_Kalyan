import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

interface CopyMapping {
  srcName: string;
  category: 'trm' | 'datasheet' | 'sdk' | 'bsp' | 'errata';
  destName: string;
}

const copyList: CopyMapping[] = [
  {
    srcName: 'ug1085-zynq-ultrascale-trm.pdf',
    category: 'trm',
    destName: 'UG1085_Zynq_UltraScale_MPSoC_TRM.pdf'
  },
  {
    srcName: 'ug1087-zynq-ultrascale-registers (1).zip',
    category: 'trm',
    destName: 'UG1087_Zynq_UltraScale_Register_Reference.zip'
  },
  {
    srcName: 'ds891-zynq-ultrascale-plus-overview.pdf',
    category: 'datasheet',
    destName: 'DS891_Zynq_UltraScale_MPSoC_Overview.pdf'
  },
  {
    srcName: 'ds925-zynq-ultrascale-plus.pdf',
    category: 'datasheet',
    destName: 'DS925_Zynq_UltraScale_DC_Electrical_Datasheet.pdf'
  },
  {
    srcName: 'ug1137-zynq-ultrascale-mpsoc-swdev-en-us-2026.1.pdf',
    category: 'sdk',
    destName: 'UG1137_Zynq_UltraScale_Software_Developer_Guide.pdf'
  }
];

async function main() {
  const downloadsDir = path.join(process.env.USERPROFILE || 'C:\\Users\\Administrator', 'Downloads');
  const baseDir = path.join(process.cwd(), 'vendor_repository', 'raw', 'xilinx', 'zynq_ultrascale');
  console.log('=== MOVING DOWNLOADED AMD/XILINX FILES TO REPOSITORY ===');

  const categories = ['trm', 'datasheet', 'sdk', 'bsp', 'devicetree', 'drivers', 'examples', 'release_notes', 'errata', 'misc'];
  for (const cat of categories) {
    await fs.mkdir(path.join(baseDir, cat), { recursive: true });
  }

  const downloadedList: any[] = [];

  for (const item of copyList) {
    const srcPath = path.join(downloadsDir, item.srcName);
    const destPath = path.join(baseDir, item.category, item.destName);

    try {
      const buf = await fs.readFile(srcPath);
      await fs.writeFile(destPath, buf);
      const sha256 = crypto.createHash('sha256').update(buf).digest('hex');

      downloadedList.push({
        vendor: 'AMD / Xilinx',
        processor: 'zynq_ultrascale',
        board: 'ZCU102 / Ultra96-V2',
        documentType: item.category,
        originalFilename: item.destName,
        downloadUrl: item.srcName,
        fileSize: buf.length,
        sha256,
        downloadTimestamp: new Date().toISOString()
      });
      console.log(`[AMD COPIED SUCCESS] ${item.destName} (${buf.length} bytes) -> ${item.category}/`);
    } catch (err: any) {
      console.error(`[AMD COPY ERROR] Could not copy ${item.srcName}: ${err.message}`);
    }
  }

  await fs.writeFile(path.join(baseDir, 'download_report.json'), JSON.stringify({ downloaded: downloadedList }, null, 2));
  await fs.writeFile(path.join(baseDir, 'metadata.json'), JSON.stringify(downloadedList, null, 2));
  console.log('=== AMD/XILINX REPOSITORY INDEXING COMPLETE ===');
}

main().catch(console.error);
