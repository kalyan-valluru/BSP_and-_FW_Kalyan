import * as fs from 'fs/promises';
import * as path from 'path';

async function fetchRealSamd21() {
  const samd21Path = 'C:\\Users\\Administrator\\Desktop\\cur\\Final Demo\\backend\\vendor_repository\\raw\\microchip\\samd21\\trm\\SAMD21_Complete_Datasheet.pdf';
  const samd21Url = 'https://ww1.microchip.com/downloads/aemDocuments/documents/MCU32/ProductDocuments/DataSheets/SAMD21-Family-DataSheet-DS40001882.pdf';

  console.log(`[FETCHING REAL SAMD21 PDF] -> ${samd21Url}`);
  try {
    const resp = await fetch(samd21Url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (resp.ok) {
      const arrayBuf = await resp.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      if (buf.slice(0, 4).toString() === '%PDF') {
        await fs.mkdir(path.dirname(samd21Path), { recursive: true });
        await fs.writeFile(samd21Path, buf);
        console.log(`[SUCCESS] Saved REAL SAMD21 Datasheet PDF (${buf.length} bytes)`);
      } else {
        console.log(`[NOTICE] Content header: ${buf.slice(0, 15).toString()}`);
      }
    }
  } catch (err: any) {
    console.error(`[ERROR] ${err.message}`);
  }
}

fetchRealSamd21().catch(console.error);
