import { useState } from 'react';
import { HelpCircle, Layers, Cpu, Zap, Activity, ShieldCheck, CheckCircle2 } from 'lucide-react';
import type { HardwarePeripheral } from '../types';

interface BlockDiagramProps {
  peripherals: HardwarePeripheral[];
  processorName: string;
}

export function BlockDiagram({ peripherals, processorName }: BlockDiagramProps) {
  const [selectedNode, setSelectedNode] = useState<{
    id: string;
    name: string;
    type: string;
    details: string;
    address?: string;
    driver?: string;
    irq?: string;
    bus?: string;
    clock?: string;
    pin?: string;
    operatingMode?: string;
  } | null>(null);

  // Default node data
  const nodeDetails: Record<string, { type: string; details: string; bus?: string; clock?: string; irq?: string }> = {
    processor: {
      type: 'Primary SoC CPU Master Core',
      details: `${processorName} Core executing bare-metal/Linux supervisor code. Initiates AXI bus master read/write transactions and processes GIC interrupt service routines.`,
      bus: 'AXI4 Master (64-bit)',
      clock: 'FCLK0 (100 MHz)',
      irq: 'GIC Architecture'
    },
    axi: {
      type: 'AXI4 Interconnect Switch Matrix',
      details: 'High-speed system bus routing memory read/write cycles from CPU Master to Peripheral Slaves with hardware address decode.',
      bus: 'AXI4-Lite / AXI4-Full',
      clock: 's_axi_aclk (100 MHz)'
    },
    intc: {
      type: 'ARM Generic Interrupt Controller (GIC)',
      details: 'Consolidates peripheral IRQ lines, prioritizing vector lines and delivering hardware interrupts to the CPU core.',
      irq: 'Vector IRQ Lines 32-95'
    },
    clk: {
      type: 'System Clock PLL Generator',
      details: 'Primary phase-locked loop (PLL) synthesizing system clock domains and power-on reset (POR) sequencing.',
      clock: 'FCLK0 / FCLK1 / FCLK2'
    }
  };

  const handleNodeClick = (id: string, name: string) => {
    if (nodeDetails[id]) {
      setSelectedNode({ id, name, ...nodeDetails[id] });
    } else {
      const p = peripherals.find(per => per.peripheralBlock === name);
      setSelectedNode({
        id,
        name,
        type: `${p?.type || 'Hardware'} Peripheral Block`,
        details: `Hardware block active on ${p?.bus || 'AXI4-Lite'} bus. Base address aligned to 4KB memory aperture with active driver binding.`,
        address: p?.baseAddress || '0x40000000',
        driver: p?.driverName || 'xgpio',
        irq: String(p?.interruptNumber ?? 'N/A'),
        bus: p?.bus || 'AXI4-Lite',
        clock: p?.clockSource || 'FCLK0',
        pin: p?.physicalPinMapping || 'Fabric Connected',
        operatingMode: p?.operatingMode || 'Interrupt'
      });
    }
  };

  // Compute dynamic SVG dimensions based on number of peripherals
  const periphCount = Math.max(1, peripherals.length);
  const nodeHeight = 44;
  const nodeGap = 16;
  const periphColumnHeight = periphCount * nodeHeight + (periphCount - 1) * nodeGap;
  const svgHeight = Math.max(320, periphColumnHeight + 80);
  const busCenterY = svgHeight / 2;
  const periphStartY = busCenterY - periphColumnHeight / 2 + 22;

  return (
    <div className="bg-obsidian border border-border-grid rounded-xl p-4 space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Dynamic SVG Diagram Canvas */}
        <div className="lg:col-span-2 bg-obsidian-200/40 border border-border-grid rounded-xl p-4 flex items-center justify-center relative overflow-y-auto max-h-[460px]">
          {/* Animated Background Grids */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800d_1px,transparent_1px),linear-gradient(to_bottom,#8080800d_1px,transparent_1px)] bg-[size:15px_15px] pointer-events-none" />

          <svg className="w-full max-w-[550px]" viewBox={`0 0 540 ${svgHeight}`} fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Connection Lines: Processor to AXI Bus */}
            <path
              d={`M 125 ${busCenterY} L 220 ${busCenterY}`}
              stroke={selectedNode?.id === 'processor' || selectedNode?.id === 'axi' ? '#00F5FF' : '#06B6D4'}
              strokeWidth={selectedNode?.id === 'processor' || selectedNode?.id === 'axi' ? '4' : '3'}
              strokeDasharray="5,5"
              className="animate-[dash_10s_linear_infinite]"
            />

            {/* Connection Lines: AXI Bus to ALL Peripheral Slaves */}
            {peripherals.map((p, idx) => {
              const targetY = periphStartY + idx * (nodeHeight + nodeGap);
              const isSelected = selectedNode?.name === p.peripheralBlock;
              return (
                <path
                  key={`line_${idx}`}
                  d={`M 300 ${busCenterY} C 350 ${busCenterY}, 360 ${targetY}, 400 ${targetY}`}
                  stroke={isSelected ? '#00F5FF' : '#94A3B8'}
                  strokeWidth={isSelected ? '3' : '1.5'}
                  opacity={isSelected ? '1' : '0.6'}
                />
              );
            })}

            {/* Clocks / Resets / Interrupt Lines */}
            <path d={`M 65 ${busCenterY - 80} L 65 ${busCenterY - 40}`} stroke="#10B981" strokeWidth={selectedNode?.id === 'clk' ? '3' : '1.5'} />
            <path d={`M 65 ${busCenterY + 40} L 65 ${busCenterY + 80}`} stroke="#EF4444" strokeWidth={selectedNode?.id === 'intc' ? '3' : '1.5'} />

            {/* Core Processor Node */}
            <g className="cursor-pointer group" onClick={() => handleNodeClick('processor', processorName)}>
              <rect
                x="10" y={busCenterY - 40} width="115" height="80" rx="10"
                fill={selectedNode?.id === 'processor' ? '#0F2B38' : '#1E293B'}
                stroke={selectedNode?.id === 'processor' ? '#00F5FF' : '#06B6D4'}
                strokeWidth={selectedNode?.id === 'processor' ? '3' : '2'}
                className="group-hover:fill-neon-cyan/20 transition-all filter drop-shadow-md"
              />
              <text x="67" y={busCenterY - 5} fill="#E2E8F0" fontSize="11" fontWeight="bold" textAnchor="middle">{processorName.split(' ')[0]}</text>
              <text x="67" y={busCenterY + 12} fill="#94A3B8" fontSize="9" textAnchor="middle">CPU Master Core</text>
            </g>

            {/* AXI Interconnect Node */}
            <g className="cursor-pointer group" onClick={() => handleNodeClick('axi', 'AXI Interconnect')}>
              <rect
                x="220" y={busCenterY - 40} width="80" height="80" rx="10"
                fill={selectedNode?.id === 'axi' ? '#0F2B38' : '#1E293B'}
                stroke={selectedNode?.id === 'axi' ? '#00F5FF' : '#06B6D4'}
                strokeWidth={selectedNode?.id === 'axi' ? '3' : '2'}
                className="group-hover:fill-neon-cyan/20 transition-all"
              />
              <text x="260" y={busCenterY - 5} fill="#E2E8F0" fontSize="11" fontWeight="bold" textAnchor="middle">AXI BUS</text>
              <text x="260" y={busCenterY + 12} fill="#94A3B8" fontSize="9" textAnchor="middle">Switch Matrix</text>
            </g>

            {/* Clock PLL Node */}
            <g className="cursor-pointer group" onClick={() => handleNodeClick('clk', 'Clock PLL')}>
              <rect
                x="20" y={busCenterY - 120} width="90" height="40" rx="6"
                fill={selectedNode?.id === 'clk' ? '#043828' : '#0D1E19'}
                stroke={selectedNode?.id === 'clk' ? '#10B981' : '#10B981'}
                strokeWidth={selectedNode?.id === 'clk' ? '2.5' : '1'}
                className="group-hover:fill-neon-emerald/20 transition-all"
              />
              <text x="65" y={busCenterY - 95} fill="#10B981" fontSize="10" fontWeight="bold" textAnchor="middle">SYS_CLK</text>
            </g>

            {/* Interrupt GIC Node */}
            <g className="cursor-pointer group" onClick={() => handleNodeClick('intc', 'Interrupt GIC')}>
              <rect
                x="20" y={busCenterY + 80} width="90" height="40" rx="6"
                fill={selectedNode?.id === 'intc' ? '#3B0F18' : '#201115'}
                stroke={selectedNode?.id === 'intc' ? '#EF4444' : '#EF4444'}
                strokeWidth={selectedNode?.id === 'intc' ? '2.5' : '1'}
                className="group-hover:fill-red-500/20 transition-all"
              />
              <text x="65" y={busCenterY + 105} fill="#EF4444" fontSize="10" fontWeight="bold" textAnchor="middle">GIC / NVIC</text>
            </g>

            {/* All Peripheral Slaves — Rendered Dynamically with Active Glowing Ring */}
            {peripherals.map((p, idx) => {
              const y = periphStartY + idx * (nodeHeight + nodeGap) - 20;
              const shortName = p.peripheralBlock;
              const isSelected = selectedNode?.name === p.peripheralBlock;
              return (
                <g key={p.id} className="cursor-pointer group" onClick={() => handleNodeClick(p.id, p.peripheralBlock)}>
                  <rect
                    x="400" y={y} width="125" height="40" rx="6"
                    fill={isSelected ? '#0F2B38' : '#1E293B'}
                    stroke={isSelected ? '#00F5FF' : '#94A3B8'}
                    strokeWidth={isSelected ? '2.5' : '1'}
                    className="group-hover:stroke-neon-cyan group-hover:fill-neon-cyan/20 transition-all"
                  />
                  <text x="462" y={y + 17} fill={isSelected ? '#00F5FF' : '#E2E8F0'} fontSize="10" fontWeight="bold" textAnchor="middle">{shortName}</text>
                  <text x="462" y={y + 30} fill="#94A3B8" fontSize="8" className="font-mono" textAnchor="middle">{p.baseAddress}</text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Selected Component Inspector Panel with Rich Dynamic Metadata */}
        <div className="bg-obsidian-100/50 border border-border-grid rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-border-grid pb-3 mb-4">
              <h4 className="text-text-primary text-xs uppercase tracking-wider font-bold font-mono text-neon-cyan flex items-center gap-2">
                <Cpu className="w-4 h-4 text-neon-cyan" />
                RTL Component Inspector
              </h4>
              {selectedNode && (
                <span className="text-[9px] font-mono text-emerald-600 dark:text-neon-emerald bg-emerald-500/10 dark:bg-neon-emerald/10 border border-emerald-500/30 dark:border-neon-emerald/20 px-2 py-0.5 rounded font-bold">
                  ACTIVE BLOCK
                </span>
              )}
            </div>

            {selectedNode ? (
              <div className="space-y-4 animate-slide-in">
                <div>
                  <h5 className="text-text-primary text-base font-bold flex items-center gap-2">
                    {selectedNode.name}
                  </h5>
                  <p className="text-neon-cyan text-[11px] font-mono mt-0.5 font-bold">{selectedNode.type}</p>
                </div>

                <div className="text-text-secondary text-xs leading-relaxed bg-obsidian-200/80 border border-border-grid rounded-lg p-3 font-medium">
                  {selectedNode.details}
                </div>

                <div className="space-y-2 font-mono text-[11px] pt-1">
                  {selectedNode.address && (
                    <div className="flex items-center justify-between bg-obsidian-200/60 p-2.5 rounded-lg border border-border-grid">
                      <span className="text-text-muted font-medium">Base Address:</span>
                      <span className="text-cyan-600 dark:text-neon-cyan font-bold">{selectedNode.address}</span>
                    </div>
                  )}
                  {selectedNode.driver && (
                    <div className="flex items-center justify-between bg-obsidian-200/60 p-2.5 rounded-lg border border-border-grid">
                      <span className="text-text-muted font-medium">Bound Driver:</span>
                      <span className="text-emerald-600 dark:text-neon-emerald font-bold">{selectedNode.driver}</span>
                    </div>
                  )}
                  {selectedNode.irq && (
                    <div className="flex items-center justify-between bg-obsidian-200/60 p-2.5 rounded-lg border border-border-grid">
                      <span className="text-text-muted font-medium">IRQ Line:</span>
                      <span className="text-amber-600 dark:text-neon-amber font-bold">IRQ #{selectedNode.irq}</span>
                    </div>
                  )}
                  {selectedNode.bus && (
                    <div className="flex items-center justify-between bg-obsidian-200/60 p-2.5 rounded-lg border border-border-grid">
                      <span className="text-text-muted font-medium">Bus Interface:</span>
                      <span className="text-purple-600 dark:text-purple-300 font-bold">{selectedNode.bus}</span>
                    </div>
                  )}
                  {selectedNode.clock && (
                    <div className="flex items-center justify-between bg-obsidian-200/60 p-2.5 rounded-lg border border-border-grid">
                      <span className="text-text-muted font-medium">Clock Source:</span>
                      <span className="text-emerald-600 dark:text-neon-emerald font-bold">{selectedNode.clock}</span>
                    </div>
                  )}
                  {selectedNode.pin && (
                    <div className="flex items-center justify-between bg-obsidian-200/60 p-2.5 rounded-lg border border-border-grid">
                      <span className="text-text-muted font-medium">Pin Mapping:</span>
                      <span className="text-text-primary font-bold">{selectedNode.pin}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-xs text-text-muted font-mono italic p-3 rounded-lg border border-dashed border-border-grid bg-obsidian-100/30">
                Click any RTL hardware block in the diagram to inspect base addresses, clock nets, and driver bindings.
              </div>
            )}
          </div>

          {selectedNode && (
            <button
              onClick={() => setSelectedNode(null)}
              className="w-full mt-4 py-2 border border-border-grid rounded-lg text-xs font-medium text-text-secondary hover:bg-obsidian-200 hover:text-text-primary transition-colors cursor-pointer"
            >
              Clear Selection
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
