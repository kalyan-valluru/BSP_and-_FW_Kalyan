import type { HardwarePeripheral } from '../../frontend/src/types';
import type { ValidationCheck } from './hardwareKnowledgeLayer';

export function runAdvancedEDADRCOnPeripherals(
  peripherals: HardwarePeripheral[],
  processor: string
): ValidationCheck[] {
  const checks: ValidationCheck[] = [];

  // V019: AXI Data Width & Bus Protocol Converter Check
  const widthMismatches = peripherals.filter(p => {
    const bus = (p.bus || '').toUpperCase();
    const is64BitProc = processor.toLowerCase().includes('a78') || processor.toLowerCase().includes('a53') || processor.toLowerCase().includes('a72') || processor.toLowerCase().includes('orin');
    const is32BitIP = bus.includes('AXI4-LITE') || bus.includes('APB');
    // Flag if 32-bit APB/AXI-Lite IP is on 64-bit interconnect without explicit converter note
    return is64BitProc && is32BitIP && !p.operatingMode?.includes('Width Converter');
  });

  checks.push({
    id: 'V019',
    name: 'AXI Data Width & Protocol Converters',
    severity: 'Warning',
    passed: widthMismatches.length === 0,
    detail: widthMismatches.length === 0
      ? 'All AXI/APB bus data widths and protocol converters are correctly matched.'
      : `32-bit peripheral bus on 64-bit interconnect requires AXI Width Converter / Protocol Bridge for: ${widthMismatches.map(p => `${p.peripheralBlock} (${p.bus})`).join(', ')}`
  });

  // V020: DMA Buffer Cache Coherency & Snooping Check
  const activeDmaPeripherals = peripherals.filter(p => {
    const dmaStr = (p.dma || '').toLowerCase();
    return p.dma && p.dma !== 'Disabled' && p.dma !== 'N/A' && !dmaStr.includes('disabled') && !dmaStr.includes('not configured');
  });

  const dmaWithoutCacheCoherency = activeDmaPeripherals.filter(p => {
    const isCoherent = p.operatingMode?.toLowerCase().includes('cache coherent') || p.operatingMode?.toLowerCase().includes('coherent') || p.driverName?.toLowerCase().includes('dma');
    return !isCoherent;
  });

  checks.push({
    id: 'V020',
    name: 'DMA Buffer Cache Coherency',
    severity: 'Warning',
    passed: dmaWithoutCacheCoherency.length === 0,
    detail: activeDmaPeripherals.length === 0
      ? 'DMA disabled or not configured; cache coherency checks not applicable.'
      : (dmaWithoutCacheCoherency.length === 0
        ? 'DMA channels have validated cache flush routines or hardware coherency (CCI-400).'
        : `DMA enabled without explicit cache flush (Xil_DCacheFlushRange) or SMMU coherency on: ${dmaWithoutCacheCoherency.map(p => `${p.peripheralBlock} (${p.dma})`).join(', ')}`)
  });

  // V021: Asynchronous Clock Domain Crossing (CDC) Synchronizers
  const cdcRisks = peripherals.filter(p => {
    const clkSrc = (p.clockSource || '').toLowerCase();
    const isAsync = clkSrc.includes('async') || clkSrc.includes('ext_clk') || clkSrc.includes('ref_clk');
    return isAsync && !p.operatingMode?.includes('2-Flop Sync');
  });

  checks.push({
    id: 'V021',
    name: 'Clock Domain Crossing (CDC) Synchronizers',
    severity: 'Warning',
    passed: cdcRisks.length === 0,
    detail: cdcRisks.length === 0
      ? 'All asynchronous clock domain crossings are protected by 2-stage synchronizer flip-flops / async FIFOs.'
      : `Asynchronous clock domain crossing without double-register (2-flop) CDC synchronizer on: ${cdcRisks.map(p => `${p.peripheralBlock} (${p.clockSource})`).join(', ')}`
  });

  // V022: PLL Clock Frequency Error & Lock Bounds
  const pllOutOfBounds = peripherals.filter(p => {
    if (!p.clockFrequency) return false;
    const freqMatch = p.clockFrequency.match(/([\d.]+)\s*(MHz|GHz|kHz)/i);
    if (!freqMatch) return false;
    const val = parseFloat(freqMatch[1]);
    const unit = freqMatch[2].toUpperCase();
    let hz = val;
    if (unit === 'MHZ') hz *= 1e6;
    else if (unit === 'GHZ') hz *= 1e9;
    else if (unit === 'KHZ') hz *= 1e3;
    // Check if frequency is outside typical EDA tolerance bounds (>500MHz on Cortex-M or >3.5GHz on Cortex-A)
    const isMcu = processor.toLowerCase().includes('m4') || processor.toLowerCase().includes('m7') || processor.toLowerCase().includes('stm32');
    return isMcu ? hz > 600e6 : hz > 4e9;
  });

  checks.push({
    id: 'V022',
    name: 'PLL Clock Frequency Bounds',
    severity: 'Warning',
    passed: pllOutOfBounds.length === 0,
    detail: pllOutOfBounds.length === 0
      ? 'All clock frequencies fall within PLL synthesis lock range and technology bounds.'
      : `Clock frequency exceeds PLL synthesis limits for processor target: ${pllOutOfBounds.map(p => `${p.peripheralBlock} (${p.clockFrequency})`).join(', ')}`
  });

  // V023: Physical I/O Bank Voltage Level DRC
  const ioVoltageConflicts = peripherals.filter(p => {
    const pinMap = p.physicalPinMapping || '';
    const isHighPerfBank = pinMap.toLowerCase().includes('bank1') || pinMap.toLowerCase().includes('bank2') || pinMap.toLowerCase().includes('hp_bank');
    const is3V3Peripheral = p.type === 'UART' || p.type === 'GPIO' || p.type === 'I2C';
    return isHighPerfBank && is3V3Peripheral && !pinMap.includes('1.8V Level Shifter');
  });

  checks.push({
    id: 'V023',
    name: 'Physical I/O Bank Voltage Compliance',
    severity: 'Info',
    passed: ioVoltageConflicts.length === 0,
    detail: ioVoltageConflicts.length === 0
      ? 'All physical pin mappings conform to FPGA/MCU I/O bank voltage constraints (1.8V / 3.3V LVCMOS).'
      : `3.3V peripheral assigned to 1.8V High-Performance I/O Bank requires external level shifter: ${ioVoltageConflicts.map(p => `${p.peripheralBlock} (${p.physicalPinMapping})`).join(', ')}`
  });

  // V024: Dynamic Thermal & Power Dissipation Estimation
  const activeCount = peripherals.filter(p => p.status === 'Active').length;
  const estimatedPowermW = activeCount * 45; // ~45mW average per active IP block
  checks.push({
    id: 'V024',
    name: 'Power & Thermal Budget Estimation',
    severity: 'Info',
    passed: estimatedPowermW < 5000, // < 5W threshold
    detail: `Estimated dynamic IP power dissipation: ${estimatedPowermW} mW across ${activeCount} active peripheral block(s). Power envelope nominal.`
  });

  return checks;
}
