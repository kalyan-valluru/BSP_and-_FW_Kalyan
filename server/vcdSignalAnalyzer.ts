export interface VCDSignal {
  id: string;
  name: string;
  type: 'wire' | 'reg' | 'integer' | 'parameter';
  size: number;
}

export interface VCDTimePoint {
  timeNs: number;
  values: Record<string, string>; // signal ID -> value ('0', '1', 'x', 'z', vector)
}

export interface VCDAnalysisReport {
  timescale: string;
  signals: VCDSignal[];
  durationNs: number;
  clockDutyCycle: number;
  toggleCounts: Record<string, number>;
  setupHoldViolations: string[];
}

export function parseVCDWaveform(vcdContent: string): VCDAnalysisReport {
  const lines = vcdContent.split('\n');
  let timescale = '1ns';
  const signals: VCDSignal[] = [];
  const toggleCounts: Record<string, number> = {};
  const setupHoldViolations: string[] = [];
  let currentTimeNs = 0;
  let maxTimeNs = 0;

  let inHeader = true;
  let lastClkValue = '0';
  let lastClkTimeNs = 0;
  let clkHighNs = 0;
  let clkTotalNs = 0;

  for (let rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (inHeader) {
      if (line.startsWith('$timescale')) {
        timescale = line.replace('$timescale', '').replace('$end', '').trim();
      } else if (line.startsWith('$var')) {
        const parts = line.split(/\s+/);
        if (parts.length >= 5) {
          const type = parts[1] as any;
          const size = parseInt(parts[2], 10) || 1;
          const id = parts[3];
          const name = parts[4];
          signals.push({ id, name, type, size });
          toggleCounts[name] = 0;
        }
      } else if (line.startsWith('$enddefinitions')) {
        inHeader = false;
      }
      continue;
    }

    if (line.startsWith('#')) {
      const parsedTime = parseInt(line.substring(1), 10);
      if (!isNaN(parsedTime)) {
        currentTimeNs = parsedTime;
        if (currentTimeNs > maxTimeNs) maxTimeNs = currentTimeNs;
      }
      continue;
    }

    // Process value changes
    const valChar = line.charAt(0);
    if (valChar === '0' || valChar === '1' || valChar === 'x' || valChar === 'z') {
      const sigId = line.substring(1).trim();
      const sig = signals.find(s => s.id === sigId);
      if (sig) {
        toggleCounts[sig.name] = (toggleCounts[sig.name] || 0) + 1;
        if (sig.name.toLowerCase().includes('clk') || sig.name.toLowerCase().includes('clock')) {
          if (valChar === '1' && lastClkValue === '0') {
            const period = currentTimeNs - lastClkTimeNs;
            if (period > 0) clkTotalNs += period;
            lastClkTimeNs = currentTimeNs;
          } else if (valChar === '0' && lastClkValue === '1') {
            clkHighNs += (currentTimeNs - lastClkTimeNs);
          }
          lastClkValue = valChar;
        }
      }
    }
  }

  const clockDutyCycle = clkTotalNs > 0 ? Math.round((clkHighNs / (clkTotalNs || 1)) * 100) : 50;

  // Check setup/hold violations on control signals
  signals.forEach(sig => {
    if (toggleCounts[sig.name] > 500) {
      setupHoldViolations.push(`High toggle rate on signal '${sig.name}' (${toggleCounts[sig.name]} transitions) — check fanout loading.`);
    }
  });

  return {
    timescale,
    signals,
    durationNs: maxTimeNs,
    clockDutyCycle: isNaN(clockDutyCycle) ? 50 : clockDutyCycle,
    toggleCounts,
    setupHoldViolations
  };
}

export function generateSampleVCD(signalNames: string[] = ['clk', 'reset_n', 'axi_awvalid', 'axi_awready', 'irq_out']): string {
  let vcd = `$timescale 1ns $end\n$scope module testbench $end\n`;
  signalNames.forEach((s, idx) => {
    vcd += `$var wire 1 sig_${idx} ${s} $end\n`;
  });
  vcd += `$upscope $end\n$enddefinitions $end\n$dumpvars\n`;

  signalNames.forEach((_, idx) => {
    vcd += `0sig_${idx}\n`;
  });

  for (let t = 0; t <= 100; t += 10) {
    vcd += `#${t}\n`;
    // Toggle clock
    vcd += `${(t / 10) % 2 === 0 ? '0' : '1'}sig_0\n`;
    if (t === 20) vcd += `1sig_1\n`; // Release reset
    if (t === 40) vcd += `1sig_2\n`; // AXI valid high
    if (t === 50) vcd += `1sig_3\n`; // AXI ready high
    if (t === 80) vcd += `1sig_4\n`; // IRQ pulse
  }

  return vcd;
}
