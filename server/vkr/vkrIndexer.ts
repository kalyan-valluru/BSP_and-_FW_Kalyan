import * as fs from 'fs';
import * as path from 'path';
import { VKRSemanticIndex } from './vkrTypes';

export class VKRIndexer {
  public buildIndex(vkrVendorsDir: string): VKRSemanticIndex {
    const index: VKRSemanticIndex = {
      processors: {},
      peripherals: {},
      registers: {},
      addresses: {},
      interrupts: {},
      pins: {},
      clockDomains: {},
      drivers: {}
    };

    if (!fs.existsSync(vkrVendorsDir)) return index;

    const vendors = fs.readdirSync(vkrVendorsDir, { withFileTypes: true });
    for (const vDir of vendors) {
      if (!vDir.isDirectory()) continue;
      const vPath = path.join(vkrVendorsDir, vDir.name);

      const families = fs.readdirSync(vPath, { withFileTypes: true });
      for (const fDir of families) {
        if (!fDir.isDirectory()) continue;
        const fPath = path.join(vPath, fDir.name);

        const procFile = path.join(fPath, 'processor.json');
        if (fs.existsSync(procFile)) {
          try {
            const proc = JSON.parse(fs.readFileSync(procFile, 'utf8'));
            index.processors[proc.processorName.toLowerCase()] = `${vDir.name}/${fDir.name}`;
          } catch {}
        }

        const periphFile = path.join(fPath, 'peripherals.json');
        if (fs.existsSync(periphFile)) {
          try {
            const periphs = JSON.parse(fs.readFileSync(periphFile, 'utf8'));
            for (const p of periphs) {
              index.peripherals[p.name.toLowerCase()] = { vendor: vDir.name, family: fDir.name, baseAddress: p.baseAddress };
              index.addresses[p.baseAddress.toLowerCase()] = { vendor: vDir.name, family: fDir.name, peripheral: p.name };
              if (p.irq !== undefined) {
                index.interrupts[p.irq] = { vendor: vDir.name, family: fDir.name, peripheral: p.name };
              }
            }
          } catch {}
        }
      }
    }

    return index;
  }
}
