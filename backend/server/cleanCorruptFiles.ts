import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

const corruptFiles = [
  'C:\\Users\\Administrator\\Desktop\\cur\\Final Demo\\backend\\vendor_repository\\raw\\microchip\\samd21\\trm\\SAMD21_Complete_Datasheet.pdf',
  'C:\\Users\\Administrator\\Desktop\\cur\\Final Demo\\backend\\vendor_repository\\raw\\nvidia\\jetson_orin\\misc\\jetson-agx-xavier-agx-orin-thor-series-camera-design-guide_dg-09364-001.pdf',
  'C:\\Users\\Administrator\\Desktop\\cur\\Final Demo\\backend\\vendor_repository\\raw\\nvidia\\jetson_orin\\misc\\jetson-orin-nano-nx-series-module-product-marking-specification_da11850001.pdf',
  'C:\\Users\\Administrator\\Desktop\\cur\\Final Demo\\backend\\vendor_repository\\raw\\nvidia\\jetson_orin\\misc\\Jetson_AGX%20Xavier_Industrial_PCN213741_BOM_ADDITION_OF_eMMC.pdf',
  'C:\\Users\\Administrator\\Desktop\\cur\\Final Demo\\backend\\vendor_repository\\raw\\nvidia\\jetson_orin\\misc\\jetson_orinnx_orinnano_pcn212822_bom_addition_of_dram.pdf',
  'C:\\Users\\Administrator\\Desktop\\cur\\Final Demo\\backend\\vendor_repository\\raw\\nvidia\\jetson_orin\\misc\\Jetson_OrinNX_OrinNano_PCN214041_BOM_ADDITION_OF_QSPI.pdf',
  'C:\\Users\\Administrator\\Desktop\\cur\\Final Demo\\backend\\vendor_repository\\raw\\nvidia\\jetson_orin\\misc\\Jetson_T5000_PCN213781_BOM_ADDITION_OF_DRAM.pdf',
  'C:\\Users\\Administrator\\Desktop\\cur\\Final Demo\\backend\\vendor_repository\\raw\\nvidia\\jetson_orin\\misc\\Jetson_Thor_PCN213501_Update_of_the_Jetson_thor_OrderingPN.pdf'
];

async function main() {
  console.log('=== CLEANING CORRUPT / HTML REDIRECT FILES ===');
  for (const filePath of corruptFiles) {
    try {
      await fs.unlink(filePath);
      console.log(`[REMOVED CORRUPT FILE] ${path.basename(filePath)}`);
    } catch (err: any) {
      console.error(`[ERROR REMOVING] ${filePath}: ${err.message}`);
    }
  }

  // Refetch SAMD21 direct PDF from Microchip official CDN
  const samd21Path = 'C:\\Users\\Administrator\\Desktop\\cur\\Final Demo\\backend\\vendor_repository\\raw\\microchip\\samd21\\trm\\SAMD21_Complete_Datasheet.pdf';
  const samd21Url = 'https://ww1.microchip.com/downloads/aemDocuments/documents/MCU32/ProductDocuments/DataSheets/SAMD21-Family-DataSheet-DS40001882.pdf';

  console.log(`[REFETCHING SAMD21 REAL PDF] -> ${samd21Url}`);
  try {
    const resp = await fetch(samd21Url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (resp.ok) {
      const arrayBuf = await resp.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      if (buf.slice(0, 4).toString() === '%PDF') {
        await fs.writeFile(samd21Path, buf);
        console.log(`[REFETCH SUCCESS] Ingested valid SAMD21 Datasheet PDF (${buf.length} bytes)`);
      }
    }
  } catch (err: any) {
    console.error(`[REFETCH ERROR] ${err.message}`);
  }
}

main().catch(console.error);
