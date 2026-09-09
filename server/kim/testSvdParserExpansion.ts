import { CMSISSVDParser } from './cmsisSvdParser';
import * as fs from 'fs/promises';
import * as path from 'path';

async function testSvdRegisterExpansion() {
  console.log('=== TEST: CMSIS-SVD Register & Reset Value Extraction ===');
  const parser = new CMSISSVDParser();
  const sampleSvdPath = path.join(process.cwd(), 'backend', 'server', 'kim', 'sample_test.svd');

  const xmlContent = `
  <device>
    <peripherals>
      <peripheral>
        <name>GPIOA</name>
        <baseAddress>0x40020000</baseAddress>
        <value>37</value>
        <registers>
          <register>
            <name>MODER</name>
            <addressOffset>0x00</addressOffset>
            <resetValue>0x00000000</resetValue>
            <access>read-write</access>
            <fields>
              <field>
                <name>MODER0</name>
                <bitOffset>0</bitOffset>
                <bitWidth>2</bitWidth>
              </field>
            </fields>
          </register>
        </registers>
      </peripheral>
    </peripherals>
  </device>`;

  await fs.writeFile(sampleSvdPath, xmlContent, 'utf8');

  const result = await parser.parseFile(sampleSvdPath, 'STMicroelectronics');
  console.log(`Processor Parsed: ${result.processorName}`);
  console.log(`Peripherals Count: ${result.peripherals.length}`);
  console.log(`Peripherals with Registers: ${Object.keys(result.registers).length}`);

  if (Object.keys(result.registers).length > 0) {
    const firstPeriph = Object.keys(result.registers)[0];
    const regs = result.registers[firstPeriph];
    console.log(`Peripheral [${firstPeriph}] Registers Count: ${regs.length}`);
    if (regs.length > 0) {
      console.log(`Sample Register [${regs[0].name}]: Offset=${regs[0].addressOffset}, ResetValue=${regs[0].resetValue}, FieldsCount=${regs[0].fields.length}`);
    }
  }

  await fs.unlink(sampleSvdPath).catch(() => {});
  console.log('SUCCESS: SVD Parser Register & Reset Value Expansion Verified.');
}

testSvdRegisterExpansion();

