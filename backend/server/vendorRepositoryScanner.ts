import * as fs from 'fs';
import * as path from 'path';

export interface VendorRepositoryStatus {
  totalVendors: number;
  totalFamilies: number;
  totalFiles: number;
  totalSizeBytes: number;
  totalSizeMB: string;
  vendors: {
    name: string;
    families: {
      name: string;
      fileCount: number;
      sizeBytes: number;
      categories: string[];
    }[];
  }[];
}

export function scanVendorRepository(): VendorRepositoryStatus {
  const repoDir = path.join(process.cwd(), 'vendor_repository', 'raw');
  const result: VendorRepositoryStatus = {
    totalVendors: 0,
    totalFamilies: 0,
    totalFiles: 0,
    totalSizeBytes: 0,
    totalSizeMB: '0 MB',
    vendors: []
  };

  if (!fs.existsSync(repoDir)) return result;

  const vendorDirs = fs.readdirSync(repoDir, { withFileTypes: true }).filter(d => d.isDirectory());
  result.totalVendors = vendorDirs.length;

  for (const vDir of vendorDirs) {
    const vPath = path.join(repoDir, vDir.name);
    const familyDirs = fs.readdirSync(vPath, { withFileTypes: true }).filter(d => d.isDirectory());

    const vendorObj = {
      name: vDir.name,
      families: [] as any[]
    };

    for (const fDir of familyDirs) {
      result.totalFamilies++;
      const fPath = path.join(vPath, fDir.name);
      let familyFiles = 0;
      let familyBytes = 0;
      const categoriesSet = new Set<string>();

      const subItems = fs.readdirSync(fPath, { withFileTypes: true });
      for (const item of subItems) {
        if (item.isDirectory()) {
          categoriesSet.add(item.name);
          const catPath = path.join(fPath, item.name);
          const files = fs.readdirSync(catPath);
          for (const file of files) {
            const stat = fs.statSync(path.join(catPath, file));
            familyFiles++;
            familyBytes += stat.size;
          }
        }
      }

      result.totalFiles += familyFiles;
      result.totalSizeBytes += familyBytes;

      vendorObj.families.push({
        name: fDir.name,
        fileCount: familyFiles,
        sizeBytes: familyBytes,
        categories: Array.from(categoriesSet)
      });
    }

    result.vendors.push(vendorObj);
  }

  result.totalSizeMB = (result.totalSizeBytes / (1024 * 1024)).toFixed(2) + ' MB';
  return result;
}

scanVendorRepository();
console.log(JSON.stringify(scanVendorRepository(), null, 2));

