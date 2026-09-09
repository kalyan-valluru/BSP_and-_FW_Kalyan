import fs from 'fs/promises';
import path from 'path';

export interface ELFValidationResult {
  valid: boolean;
  elfPath: string;
  sizeBytes?: number;
  architecture?: 'ARM32' | 'AArch64' | 'Unknown';
  entryPoint?: string;
  sections: string[];
  errors: string[];
  warnings: string[];
}

/**
 * Reads and validates a compiled firmware ELF file for ARM/Zynq targets.
 * Performs deep binary structure validation of the ELF headers.
 */
export async function validateELF(
  elfPath: string,
  isZynq7000: boolean
): Promise<ELFValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sections: string[] = [];
  let sizeBytes = 0;
  let arch: 'ARM32' | 'AArch64' | 'Unknown' = 'Unknown';
  let entryPointHex = '0x0';

  try {
    const stat = await fs.stat(elfPath);
    sizeBytes = stat.size;

    if (sizeBytes === 0) {
      errors.push(`ELF file at ${elfPath} is 0 bytes. The build did not compile or link any code.`);
      return { valid: false, elfPath, sizeBytes, errors, warnings, sections };
    }

    // Open the ELF binary and read the header (Ehdr)
    const fd = await fs.open(elfPath, 'r');
    const headerBuffer = Buffer.alloc(64); // ELF32 needs 52 bytes, ELF64 needs 64
    const { bytesRead } = await fd.read(headerBuffer, 0, 64, 0);

    if (bytesRead < 52) {
      errors.push(`ELF file header is truncated (${bytesRead} bytes read, expected at least 52).`);
      await fd.close();
      return { valid: false, elfPath, sizeBytes, errors, warnings, sections };
    }

    // 1. Verify Magic Number: 0x7F 'E' 'L' 'F'
    if (
      headerBuffer[0] !== 0x7F ||
      headerBuffer[1] !== 0x45 || // 'E'
      headerBuffer[2] !== 0x4C || // 'L'
      headerBuffer[3] !== 0x46    // 'F'
    ) {
      errors.push(`Invalid ELF magic bytes: ${headerBuffer.subarray(0, 4).toString('hex')}. File is not a valid ELF binary.`);
      await fd.close();
      return { valid: false, elfPath, sizeBytes, errors, warnings, sections };
    }

    // 2. Identify Class: 1 = ELF32 (Zynq-7000 / ARM Cortex-A9), 2 = ELF64 (Zynq UltraScale+ / ARM Cortex-A53)
    const elfClass = headerBuffer[4];
    if (elfClass === 1) {
      arch = 'ARM32';
      if (!isZynq7000) {
        warnings.push(`Target is Zynq UltraScale+ MPSoC (64-bit expected), but output ELF is 32-bit ELF32.`);
      }
    } else if (elfClass === 2) {
      arch = 'AArch64';
      if (isZynq7000) {
        errors.push(`Target is Zynq-7000 (32-bit expected), but output ELF is 64-bit ELF64.`);
      }
    } else {
      errors.push(`Unknown ELF class: ${elfClass}`);
    }

    // 3. Endianness: 1 = Little Endian, 2 = Big Endian. ARM Cortex cores run in Little Endian.
    const endianness = headerBuffer[5];
    if (endianness !== 1) {
      errors.push(`Invalid ELF endianness: ${endianness}. ARM Cortex targets require Little Endian (1).`);
    }

    // 4. ELF Version
    const version = headerBuffer[6];
    if (version !== 1) {
      warnings.push(`Unusual ELF version: ${version}. Expected version 1.`);
    }

    // 5. Machine Architecture
    // e_machine is at offset 18 (2 bytes)
    const machine = headerBuffer.readUInt16LE(18);
    // EM_ARM (40) for 32-bit ARM, EM_AARCH64 (183) for 64-bit ARM
    if (elfClass === 1 && machine !== 40) {
      errors.push(`ELF Machine field is ${machine}, expected EM_ARM (40) for 32-bit ARM/Zynq-7000.`);
    } else if (elfClass === 2 && machine !== 183) {
      errors.push(`ELF Machine field is ${machine}, expected EM_AARCH64 (183) for 64-bit ARM/Zynq UltraScale+.`);
    }

    // 6. Entry Point Address
    // ELF32: e_entry is 4 bytes at offset 24
    // ELF64: e_entry is 8 bytes at offset 24
    if (elfClass === 1) {
      const entry32 = headerBuffer.readUInt32LE(24);
      entryPointHex = '0x' + entry32.toString(16);
      if (entry32 === 0) {
        errors.push(`ELF Entry Point is 0x0. Reset handler vector is likely misconfigured or linker script lacks Entry entry.`);
      }
    } else {
      // readUInt64LE is available in modern Node.js, we can also read 2 32-bit parts
      const entryLow = headerBuffer.readUInt32LE(24);
      const entryHigh = headerBuffer.readUInt32LE(28);
      // Constructing large hex string safely
      const val = (BigInt(entryHigh) << BigInt(32)) | BigInt(entryLow);
      entryPointHex = '0x' + val.toString(16);
      if (val === 0n && isZynq7000) {
        errors.push(`ELF Entry Point is 0x0. Reset handler vector is likely misconfigured.`);
      }
    }

    // 7. Parse Section Headers to collect present sections (optional but helpful verification)
    // ELF32: e_shoff (section header offset) is at offset 32 (4 bytes), e_shentsize is at offset 46 (2 bytes), e_shnum is at offset 48 (2 bytes), e_shstrndx at offset 50 (2 bytes)
    // ELF64: e_shoff is at offset 40 (8 bytes), e_shentsize is at offset 58 (2 bytes), e_shnum is at offset 60 (2 bytes), e_shstrndx at offset 62 (2 bytes)
    let shoff = 0;
    let shentsize = 0;
    let shnum = 0;
    let shstrndx = 0;

    if (elfClass === 1) {
      shoff = headerBuffer.readUInt32LE(32);
      shentsize = headerBuffer.readUInt16LE(46);
      shnum = headerBuffer.readUInt16LE(48);
      shstrndx = headerBuffer.readUInt16LE(50);
    } else {
      const shoffLow = headerBuffer.readUInt32LE(40);
      const shoffHigh = headerBuffer.readUInt32LE(44);
      shoff = Number((BigInt(shoffHigh) << BigInt(32)) | BigInt(shoffLow));
      shentsize = headerBuffer.readUInt16LE(58);
      shnum = headerBuffer.readUInt16LE(60);
      shstrndx = headerBuffer.readUInt16LE(62);
    }

    if (shoff > 0 && shnum > 0 && shentsize > 0 && shoff + shnum * shentsize <= sizeBytes) {
      // Let's read section names from the section header string table (shstrndx)
      // First, read all section headers
      const sectionsData = Buffer.alloc(shnum * shentsize);
      await fd.read(sectionsData, 0, shnum * shentsize, shoff);

      // Get string table section header (shstrndx)
      const strTableOffset = shstrndx * shentsize;
      let strTableFileOffset = 0;
      let strTableSize = 0;

      if (elfClass === 1) {
        strTableFileOffset = sectionsData.readUInt32LE(strTableOffset + 16); // sh_offset is at 16 in Elf32_Shdr
        strTableSize = sectionsData.readUInt32LE(strTableOffset + 20); // sh_size is at 20 in Elf32_Shdr
      } else {
        const offLow = sectionsData.readUInt32LE(strTableOffset + 24); // sh_offset is at 24 in Elf64_Shdr
        const offHigh = sectionsData.readUInt32LE(strTableOffset + 28);
        strTableFileOffset = Number((BigInt(offHigh) << BigInt(32)) | BigInt(offLow));
        const szLow = sectionsData.readUInt32LE(strTableOffset + 32); // sh_size is at 32 in Elf64_Shdr
        const szHigh = sectionsData.readUInt32LE(strTableOffset + 36);
        strTableSize = Number((BigInt(szHigh) << BigInt(32)) | BigInt(szLow));
      }

      if (strTableFileOffset > 0 && strTableSize > 0 && strTableFileOffset + strTableSize <= sizeBytes) {
        const strTable = Buffer.alloc(strTableSize);
        await fd.read(strTable, 0, strTableSize, strTableFileOffset);

        // Read all section names
        for (let i = 0; i < shnum; i++) {
          const entryOffset = i * shentsize;
          const nameIndex = sectionsData.readUInt32LE(entryOffset + 0); // sh_name is first 4 bytes
          if (nameIndex < strTableSize) {
            let nameEnd = nameIndex;
            while (nameEnd < strTableSize && strTable[nameEnd] !== 0) {
              nameEnd++;
            }
            const name = strTable.subarray(nameIndex, nameEnd).toString('utf-8');
            if (name) {
              sections.push(name);
            }
          }
        }
      }
    }

    await fd.close();

    // Verify presence of standard executable sections: .text, .data, .bss
    if (sections.length > 0) {
      if (!sections.includes('.text')) {
        errors.push(`ELF lacks a '.text' section (executable code).`);
      }
      if (!sections.includes('.data') && !sections.includes('.rodata')) {
        warnings.push(`ELF lacks a '.data' or '.rodata' section (initialized variables).`);
      }
      if (!sections.includes('.bss')) {
        warnings.push(`ELF lacks a '.bss' section (uninitialized variables).`);
      }
    } else {
      warnings.push(`No sections could be parsed from the ELF section header table.`);
    }

  } catch (e: any) {
    errors.push(`Failed to read/stat ELF file: ${e.message}`);
  }

  return {
    valid: errors.length === 0,
    elfPath,
    sizeBytes,
    architecture: arch,
    entryPoint: entryPointHex,
    sections,
    errors,
    warnings
  };
}
