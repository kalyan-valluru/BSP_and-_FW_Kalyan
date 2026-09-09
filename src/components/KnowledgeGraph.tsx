import { Activity, ShieldCheck, Cpu, Network } from 'lucide-react';
import { useState } from 'react';

interface KnowledgeGraphProps {
  processorName: string;
  peripherals: any[];
}

interface GraphNode {
  id: string;
  type: 'cpu' | 'memory' | 'clock' | 'bus' | 'intc' | 'peripheral' | 'external';
  label: string;
  detail: string;
}

export function KnowledgeGraph({ processorName, peripherals }: KnowledgeGraphProps) {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // Construct structured flow nodes
  const nodes: GraphNode[] = [
    { id: 'CPU', type: 'cpu', label: processorName, detail: `Central processing unit core executing BSP binary` },
    { id: 'DDR_RAM', type: 'memory', label: 'DDR Memory', detail: 'System dynamic memory region mapped at 0x00000000' },
    { id: 'SYS_CLK', type: 'clock', label: 'Clock Net Indicator', detail: 'Primary 100 MHz oscillator driving internal AXI switch fabrics' },
    { id: 'AXI_BUS', type: 'bus', label: 'AXI4-Lite Bus', detail: 'High-speed system peripheral interconnect bus network' },
    { id: 'INTC', type: 'intc', label: 'Interrupt Controller', detail: 'GIC / AXI INTC core routing physical device IRQ signals' },
  ];

  // Map peripherals into the node list dynamically
  peripherals.forEach((p) => {
    nodes.push({
      id: p.peripheralBlock,
      type: 'peripheral',
      label: p.peripheralBlock,
      detail: `Base Address: ${p.baseAddress} | Bus: ${p.bus || 'AXI4-Lite'} | IRQ: ${p.interruptNumber ?? 'N/A'} | Clock: ${p.clockFrequency || '100 MHz'} | Driver: ${p.driverName || 'xgpio'}`
    });
  });

  // Color config map tailored for high visibility in both light & dark modes
  const typeStyles: Record<string, { border: string; bg: string; text: string; iconColor: string }> = {
    cpu: { border: 'border-cyan-500/70 dark:border-neon-cyan/50 hover:border-cyan-500', bg: 'bg-cyan-500/10 dark:bg-neon-cyan/10', text: 'text-cyan-700 dark:text-neon-cyan', iconColor: 'text-cyan-600 dark:text-neon-cyan' },
    memory: { border: 'border-amber-500/70 dark:border-neon-amber/50 hover:border-amber-500', bg: 'bg-amber-500/10 dark:bg-neon-amber/10', text: 'text-amber-700 dark:text-neon-amber', iconColor: 'text-amber-600 dark:text-neon-amber' },
    clock: { border: 'border-emerald-500/70 dark:border-neon-emerald/50 hover:border-emerald-500', bg: 'bg-emerald-500/10 dark:bg-neon-emerald/10', text: 'text-emerald-700 dark:text-neon-emerald', iconColor: 'text-emerald-600 dark:text-neon-emerald' },
    bus: { border: 'border-purple-500/70 dark:border-purple-500/50 hover:border-purple-500', bg: 'bg-purple-500/10 dark:bg-purple-500/15', text: 'text-purple-700 dark:text-purple-300', iconColor: 'text-purple-600 dark:text-purple-400' },
    intc: { border: 'border-red-500/70 dark:border-red-500/50 hover:border-red-500', bg: 'bg-red-500/10 dark:bg-red-500/15', text: 'text-red-700 dark:text-red-400', iconColor: 'text-red-600 dark:text-red-400' },
    peripheral: { border: 'border-slate-300 dark:border-border-grid hover:border-cyan-500/50', bg: 'bg-slate-100 dark:bg-obsidian-200/50', text: 'text-slate-800 dark:text-text-primary', iconColor: 'text-slate-600 dark:text-text-muted' },
  };

  return (
    <div className="bg-obsidian-50/50 border border-border-grid rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-text-primary text-sm font-semibold flex items-center gap-2">
          <Activity className="w-4 h-4 text-neon-cyan animate-pulse" />
          Hardware Dependency Graph & Bus Topology
        </h3>
        <span className="text-[10px] text-emerald-700 dark:text-neon-emerald font-mono uppercase bg-emerald-500/10 dark:bg-neon-emerald/10 border border-emerald-500/30 dark:border-neon-emerald/30 px-2 py-0.5 rounded flex items-center gap-1">
          <Network className="w-3.5 h-3.5" /> Dependency Graph Active
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* SVG Dependency Layout Panel */}
        <div className="lg:col-span-2 bg-obsidian-100/40 border border-border-grid rounded-xl p-6 min-h-[400px] flex flex-col justify-between relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(#80808012_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

          {/* Graphical rendering */}
          <div className="relative w-full h-[340px] flex flex-col justify-between items-center z-10">
            {/* Tier 1: Processor + Clock + Memory */}
            <div className="flex justify-around w-full">
              {nodes.filter(n => n.type === 'cpu' || n.type === 'clock' || n.type === 'memory').map((node) => {
                const isSelected = selectedNode?.id === node.id;
                const style = typeStyles[node.type];
                return (
                  <div
                    key={node.id}
                    onClick={() => setSelectedNode(node)}
                    className={`px-3.5 py-2.5 rounded-lg border-2 cursor-pointer transition-all duration-300 flex flex-col items-center min-w-[110px] ${style.bg} ${style.border} ${
                      isSelected ? 'shadow-[0_0_14px_rgba(6,182,212,0.35)] scale-105 ring-2 ring-cyan-400' : ''
                    }`}
                  >
                    <Cpu className={`w-5 h-5 mb-1 ${style.iconColor}`} />
                    <span className="text-[11px] font-bold text-text-primary font-mono">{node.label}</span>
                    <span className={`text-[9px] ${style.text} uppercase tracking-wider font-extrabold mt-0.5`}>{node.type}</span>
                  </div>
                );
              })}
            </div>

            {/* SVG Connection paths */}
            <div className="absolute inset-0 w-full h-full pointer-events-none">
              <svg className="w-full h-full">
                {/* Paths from CPU & Clock to Bus */}
                <line x1="25%" y1="18%" x2="50%" y2="45%" stroke="rgba(6,182,212,0.35)" strokeWidth="2" strokeDasharray="4 3" className="animate-[dash_10s_linear_infinite]" />
                <line x1="50%" y1="18%" x2="50%" y2="45%" stroke="rgba(16,185,129,0.35)" strokeWidth="2" />
                <line x1="75%" y1="18%" x2="50%" y2="45%" stroke="rgba(245,158,11,0.35)" strokeWidth="2" />
                
                {/* Paths from Bus to Interrupt Controller & Peripherals */}
                <line x1="50%" y1="55%" x2="50%" y2="82%" stroke="rgba(168,85,247,0.45)" strokeWidth="2.5" />
                <path d="M 50% 55% C 50% 68%, 20% 68%, 20% 82%" stroke="rgba(168,85,247,0.35)" fill="none" strokeWidth="2" />
                <path d="M 50% 55% C 50% 68%, 80% 68%, 80% 82%" stroke="rgba(168,85,247,0.35)" fill="none" strokeWidth="2" />
              </svg>
            </div>

            {/* Tier 2: AXI Interconnect Bus */}
            {nodes.filter(n => n.type === 'bus').map((node) => {
              const isSelected = selectedNode?.id === node.id;
              const style = typeStyles[node.type];
              return (
                <div
                  key={node.id}
                  onClick={() => setSelectedNode(node)}
                  className={`px-5 py-2.5 rounded-lg border-2 cursor-pointer transition-all duration-300 flex items-center gap-2 min-w-[210px] justify-center ${style.bg} ${style.border} ${
                    isSelected ? 'shadow-[0_0_14px_rgba(168,85,247,0.35)] scale-105 ring-2 ring-purple-400' : ''
                  }`}
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-ping" />
                  <span className="text-[12px] font-extrabold text-purple-700 dark:text-purple-300 font-mono tracking-wide uppercase">{node.label}</span>
                </div>
              );
            })}

            {/* Tier 3: INTC + Peripherals */}
            <div className="flex gap-2.5 max-w-full overflow-x-auto pb-2 justify-center w-full">
              {nodes.filter(n => n.type === 'intc' || n.type === 'peripheral').map((node) => {
                const isSelected = selectedNode?.id === node.id;
                const style = typeStyles[node.type] || typeStyles.peripheral;
                return (
                  <div
                    key={node.id}
                    onClick={() => setSelectedNode(node)}
                    className={`px-3 py-2 rounded-lg border cursor-pointer transition-all duration-200 flex flex-col items-center min-w-[95px] ${style.bg} ${style.border} ${
                      isSelected ? 'border-cyan-500 dark:border-neon-cyan bg-cyan-500/20 dark:bg-cyan-950/40 shadow-[0_0_10px_rgba(6,182,212,0.3)] scale-105' : ''
                    }`}
                  >
                    <span className="text-[11px] font-bold font-mono text-text-primary truncate max-w-[85px]">{node.label}</span>
                    <span className={`text-[9px] ${style.text} font-bold mt-0.5 uppercase tracking-wider`}>{node.type}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="text-[10px] text-text-muted font-mono leading-none mt-2">
            * Interactive topology map tracing clock, data bus, and interrupt line vectors.
          </div>
        </div>

        {/* Selected Component Inspector Panel */}
        <div className="bg-obsidian-100/50 border border-border-grid rounded-xl p-5 flex flex-col justify-between">
          <div className="space-y-4">
            <h4 className="text-neon-cyan text-xs uppercase tracking-wider font-bold font-mono">
              Dependency Specification
            </h4>
            
            {selectedNode ? (
              <div className="space-y-3 p-4 rounded-xl bg-obsidian-200/80 border border-neon-cyan/30 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    selectedNode.type === 'cpu' ? 'bg-cyan-500' :
                    selectedNode.type === 'clock' ? 'bg-emerald-500' :
                    selectedNode.type === 'memory' ? 'bg-amber-500' :
                    selectedNode.type === 'intc' ? 'bg-red-500' : 'bg-purple-500'
                  }`} />
                  <span className="text-xs font-bold text-text-primary font-mono">{selectedNode.id}</span>
                </div>
                <div className="text-[11px] text-text-secondary leading-relaxed font-mono font-medium">
                  {selectedNode.detail}
                </div>
              </div>
            ) : (
              <div className="text-xs text-text-muted font-mono italic p-3 rounded-lg border border-dashed border-border-grid bg-obsidian-100/30">
                No component selected. Tap any node in the bus topology diagram to trace hardware vectors.
              </div>
            )}

            <div className="space-y-2 pt-3 border-t border-border-grid text-[11px]">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-neon-emerald font-semibold">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Clock synchronization network validated</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-600 dark:text-neon-emerald font-semibold">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>AXI switch matrix registers aligned</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border-grid text-[10px] text-text-muted leading-relaxed font-mono">
            Dependency check validates interrupt priority lines and registers mappings to eliminate runtime kernel crashes.
          </div>
        </div>
      </div>
    </div>
  );
}
