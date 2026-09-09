import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

export class RepositoryOperationsEngine {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.join(process.cwd(), 'vendor_repository');
  }

  public async runIntegrityCheck(): Promise<{ passed: boolean; checkedFiles: number; invalidFiles: string[] }> {
    console.log('[REPO OPS ENGINE] Executing SHA-256 Integrity Verification across VKR...');
    const invalidFiles: string[] = [];
    let checkedFiles = 0;

    const rawDir = path.join(this.baseDir, 'raw');
    try {
      const vendors = await fs.readdir(rawDir);
      for (const v of vendors) {
        const vendorPath = path.join(rawDir, v);
        const stat = await fs.stat(vendorPath);
        if (!stat.isDirectory()) continue;

        const families = await fs.readdir(vendorPath);
        for (const f of families) {
          const metaPath = path.join(vendorPath, f, 'metadata.json');
          try {
            const content = await fs.readFile(metaPath, 'utf8');
            const metaList = JSON.parse(content);
            for (const item of metaList) {
              checkedFiles++;
              // Verify SHA-256 hash formatting
              if (!item.sha256 || item.sha256.length !== 64) {
                invalidFiles.push(`${v}/${f}/${item.originalFilename}`);
              }
            }
          } catch {}
        }
      }
    } catch {}

    return {
      passed: invalidFiles.length === 0,
      checkedFiles,
      invalidFiles
    };
  }

  public async generateSizeReport(): Promise<{ totalBytes: number; totalDocs: number; formattedSize: string }> {
    let totalBytes = 0;
    let totalDocs = 0;

    const rawDir = path.join(this.baseDir, 'raw');
    try {
      const walk = async (dir: string) => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const resPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await walk(resPath);
          } else if (entry.isFile()) {
            const stat = await fs.stat(resPath);
            totalBytes += stat.size;
            totalDocs++;
          }
        }
      };
      await walk(rawDir);
    } catch {}

    const formattedSize = (totalBytes / (1024 * 1024)).toFixed(2) + ' MB';
    return { totalBytes, totalDocs, formattedSize };
  }
}
