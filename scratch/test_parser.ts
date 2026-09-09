import { resolveHardwareKnowledge } from '../server/hardwareKnowledgeResolver';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const sampleText = `
Zynq-7000 Hardware Specification (Test Input 2)
Board: Zynq-7000 XC7Z020 Development Board

Processor
Device: XC7Z020
CPU: Dual ARM Cortex-A9
Architecture: ARMv7
Clock: 100 MHz

Memory
DDR3: 512 MB
QSPI Flash: 16 MB

Peripheral | Instance | Base Address | Size | IRQ
AXI GPIO | gpio_0 | 0x41200000 | 64 KB | 61
AXI UART Lite | uartlite_0 | 0x40600000 | 64 KB | 59
AXI Timer | timer_0 | 0x41C00000 | 64 KB | 60
AXI IIC | iic_0 | 0x41600000 | 64 KB | 62
AXI SPI | spi_0 | 0x44A00000 | 64 KB | 63

GPIO Connections
Channel 1: LED0, LED1, LED2, LED3
Channel 2: Push Button 0, Push Button 1, Push Button 2

UART
UART Lite, 115200 baud, 8 data bits, 1 stop bit, no parity.

Timer
32-bit AXI Timer with interrupts enabled.

SPI
Master Mode, SPI Mode 0, 8-bit transfer.

I2C
100 kHz, EEPROM connected.

Supported OS
Standalone, Linux
`;

async function runTest() {
  const projectRoot = process.cwd();
  const tempFile = path.join(projectRoot, 'scratch', 'test_spec.txt');
  fs.writeFileSync(tempFile, sampleText, 'utf-8');

  const pythonScript = path.join(projectRoot, 'server', 'parse_hardware.py');
  const localVenv = path.join(projectRoot, '.venv', 'Scripts', 'python.exe');
  const systemPy = 'C:\\Users\\Administrator\\AppData\\Local\\Python\\pythoncore-3.14-64\\python.exe';
  const pythonExe = fs.existsSync(localVenv) ? localVenv : (fs.existsSync(systemPy) ? systemPy : 'python');

  console.log('--- Testing Python Parser ---');
  const pyOutput = await new Promise<string>((resolve, reject) => {
    const proc = spawn(pythonExe, [pythonScript, 'text', tempFile], { shell: false });
    let stdout = '', stderr = '';
    proc.stdout.on('data', d => stdout += d.toString());
    proc.stderr.on('data', d => stderr += d.toString());
    proc.on('close', code => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout)));
  });

  const parsed = JSON.parse(pyOutput);
  console.log('Parsed Hardware Model Peripherals:', JSON.stringify(parsed.peripherals, null, 2));

  console.log('--- Testing Knowledge Resolver ---');
  const resolved = resolveHardwareKnowledge(parsed.peripherals, 'Zynq-7000');
  console.log('Resolved Peripherals:', JSON.stringify(resolved.resolvedPeripherals, null, 2));
}

runTest().catch(console.error);
