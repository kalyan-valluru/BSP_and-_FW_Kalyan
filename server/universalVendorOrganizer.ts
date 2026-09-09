import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

export interface VendorFolderSpec {
  vendor: string;       // e.g. 'renesas', 'microchip', 'nordic', 'espressif', 'nxp', 'ti', 'st', 'xilinx'
  familyName: string;   // e.g. 'rz_g2l', 'sama5d2', 'nrf52840', 'esp32s3'
}

export class UniversalVendorOrganizer {
  private baseRepoDir: string;
  private downloadsDir: string;

  constructor(baseRepoDir?: string, downloadsDir?: string) {
    this.baseRepoDir = baseRepoDir || path.join(process.cwd(), 'vendor_repository', 'raw');
    this.downloadsDir = downloadsDir || path.join(process.env.USERPROFILE || 'C:\\Users\\Administrator', 'Downloads');
  }

  public async scanAndOrganize(vendor: string, familyName: string): Promise<number> {
    const targetRepoDir = path.join(this.baseRepoDir, vendor, familyName);
    console.log(`[UNIVERSAL ORGANIZER] Scanning Downloads folder for ${vendor.toUpperCase()} (${familyName})...`);

    const categories = ['trm', 'datasheet', 'sdk', 'bsp', 'devicetree', 'drivers', 'examples', 'release_notes', 'errata', 'misc'];
    for (const cat of categories) {
      await fs.mkdir(path.join(targetRepoDir, cat), { recursive: true });
    }

    const files = await fs.readdir(this.downloadsDir);
    let movedCount = 0;
    const metadataList: any[] = [];

    for (const filename of files) {
      const ext = path.extname(filename).toLowerCase();
      if (!['.pdf', '.zip', '.tar.gz', '.tgz', '.bsdl', '.exe', '.bin'].includes(ext)) {
        continue;
      }

      const category = this.categorizeFilename(filename);
      const srcPath = path.join(this.downloadsDir, filename);
      const destPath = path.join(targetRepoDir, category, filename);

      try {
        const buf = await fs.readFile(srcPath);
        await fs.writeFile(destPath, buf);
        const sha256 = crypto.createHash('sha256').update(buf).digest('hex');

        metadataList.push({
          vendor,
          familyName,
          category,
          originalFilename: filename,
          fileSize: buf.length,
          sha256,
          downloadTimestamp: new Date().toISOString()
        });

        console.log(`[ORGANIZED] Moved '${filename}' (${buf.length} bytes) -> vendor_repository/raw/${vendor}/${familyName}/${category}/`);
        movedCount++;
      } catch (err: any) {
        console.error(`[ORGANIZER ERROR] Failed processing ${filename}: ${err.message}`);
      }
    }

    if (movedCount > 0) {
      await fs.writeFile(path.join(targetRepoDir, 'metadata.json'), JSON.stringify(metadataList, null, 2));
      console.log(`[UNIVERSAL ORGANIZER COMPLETE] Successfully indexed ${movedCount} files for ${vendor}/${familyName}.`);
    } else {
      console.log(`[UNIVERSAL ORGANIZER] No matching downloaded files found for ${vendor}/${familyName}.`);
    }

    return movedCount;
  }

  private categorizeFilename(filename: string): string {
    const text = filename.toLowerCase();
    if (text.includes('trm') || text.includes('reference_manual') || text.includes('user_manual') || text.includes('ug')) return 'trm';
    if (text.includes('datasheet') || text.includes('ds') || text.includes('data_sheet')) return 'datasheet';
    if (text.includes('sdk') || text.includes('harmony') || text.includes('fsp') || text.includes('cube')) return 'sdk';
    if (text.includes('bsp') || text.includes('petalinux') || text.includes('yocto') || text.includes('openstlinux')) return 'bsp';
    if (text.includes('dts') || text.includes('dtb') || text.includes('devicetree')) return 'devicetree';
    if (text.includes('driver')) return 'drivers';
    if (text.includes('example') || text.includes('sample')) return 'examples';
    if (text.includes('release') || text.includes('note')) return 'release_notes';
    if (text.includes('errata') || text.includes('es')) return 'errata';
    return 'misc';
  }
}
