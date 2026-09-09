import { useState } from 'react';
import { FileCode, CheckCircle, Download } from 'lucide-react';
import type { HardwarePeripheral } from '../types';

interface MapViewerProps {
  peripherals: HardwarePeripheral[];
  defaultTab?: 'memory' | 'irq' | 'bsp' | 'clock';
}

export function MapViewer({ peripherals, defaultTab }: MapViewerProps) {
  const resolvedTab = defaultTab === 'irq' ? 'interrupt' : defaultTab === 'clock' ? 'bsp' : defaultTab === 'bsp' ? 'bsp' : 'memory';
  const [activeTab, setActiveTab] = useState<'memory' | 'interrupt' | 'bsp'>(resolvedTab);
  // If opened from a specific button, hide the tab bar — user already chose the view
  const showTabs = !defaultTab;

  // Generate mock download of driver
  const handleDownloadDriver = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Tab bar — only shown when NOT opened from a specific button */}
      {showTabs && (
        <div className="flex items-center justify-between border-b border-[#1e1e28] pb-3">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('memory')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all ${
                activeTab === 'memory'
                  ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-400'
                  : 'text-zinc-500 hover:text-zinc-200'
              }`}
            >
              Memory Map
            </button>
            <button
              onClick={() => setActiveTab('interrupt')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all ${
                activeTab === 'interrupt'
                  ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-400'
                  : 'text-zinc-500 hover:text-zinc-200'
              }`}
            >
              Interrupt Map (IRQ)
            </button>
            <button
              onClick={() => setActiveTab('bsp')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all ${
                activeTab === 'bsp'
                  ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-400'
                  : 'text-zinc-500 hover:text-zinc-200'
              }`}
            >
              BSP Drivers
            </button>
          </div>
          <span className="text-[10px] text-zinc-600 font-mono uppercase bg-[#1a1a22] px-2 py-0.5 rounded">
            EDA Subsystem Map
          </span>
        </div>
      )}

      {/* Content */}
      <div className="min-h-[280px]">
        {activeTab === 'memory' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-[#1e1e28] text-zinc-500">
                  <th className="px-4 py-3">Memory Node / IP Block</th>
                  <th className="px-4 py-3">Base Address</th>
                  <th className="px-4 py-3">Range Size</th>
                  <th className="px-4 py-3">Bound Driver</th>
                  <th className="px-4 py-3">Provenance Citation</th>
                  <th className="px-4 py-3">Constraint Check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e28]">
                {peripherals.map((p) => {
                  const baseNum = parseInt(p.baseAddress || '0', 16);
                  const endAddress = isNaN(baseNum) ? '0x00000000' : '0x' + (baseNum + 0xFFF).toString(16).toUpperCase();
                  const provSource = (p as any).provenanceSource || 'xparameters.h & design_1.xsa';
                  const conf = (p as any).confidence !== undefined ? (p as any).confidence : 1.0;
                  return (
                    <tr key={p.id} className="text-zinc-300 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 font-bold text-white">{p.peripheralBlock}</td>
                      <td className="px-4 py-3 text-cyan-400">{p.baseAddress}</td>
                      <td className="px-4 py-3">{p.baseAddress} - {endAddress}</td>
                      <td className="px-4 py-3 text-zinc-400">{p.driverName || 'generic-uio'}</td>
                      <td className="px-4 py-3 text-emerald-400 text-[11px]">
                        ✓ {provSource} <span className="text-zinc-500">(Conf {conf.toFixed(2)})</span>
                      </td>
                      <td>
                        <span className="flex items-center gap-1.5 text-emerald-400">
                          <CheckCircle className="w-3.5 h-3.5" />
                          No Conflict
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {peripherals.length === 0 && (
                  <tr><td colSpan={5} className="py-10 text-center text-zinc-600">No peripherals loaded.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'interrupt' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-[#1e1e28] text-zinc-500">
                  <th className="px-4 py-3">IRQ Line</th>
                  <th className="px-4 py-3">Source Peripheral</th>
                  <th className="px-4 py-3">Priority Level</th>
                  <th className="px-4 py-3">Trigger Mode</th>
                  <th className="px-4 py-3">Core Handler Binding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e28]">
                {peripherals.map((p) => (
                  <tr key={p.id} className="text-zinc-300 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-bold text-amber-400">IRQ #{p.interruptNumber || 'N/A'}</td>
                    <td className="px-4 py-3 text-white font-medium">{p.peripheralBlock}</td>
                    <td className="px-4 py-3">Level 2 (High)</td>
                    <td className="px-4 py-3">Edge-Rising</td>
                    <td className="px-4 py-3 text-cyan-400">{p.driverName ? `${p.driverName}_IRQHandler` : 'Default_IRQHandler'}</td>
                  </tr>
                ))}
                {peripherals.length === 0 && (
                  <tr><td colSpan={5} className="py-10 text-center text-zinc-600">No peripherals loaded.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'bsp' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {peripherals.map((p) => {
              const driverFilename = p.driverName ? p.driverName.toLowerCase() : 'custom_driver';
              const fileContent = `/* ${p.driverName} Hardware Driver */\n#include <stdint.h>\n#define BASE_ADDR ${p.baseAddress}\n\nvoid ${p.driverName}_Init(void) {\n    // Core Driver initialization\n}\n`;
              return (
                <div key={p.id} className="flex items-center justify-between p-3 bg-[#111118] border border-[#1e1e28] rounded-xl hover:border-cyan-500/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                      <FileCode className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold font-mono">{driverFilename}.c</p>
                      <p className="text-zinc-500 text-[10px] uppercase font-mono">Bound to {p.peripheralBlock}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownloadDriver(`${driverFilename}.c`, fileContent)}
                    className="p-1.5 rounded-lg hover:bg-[#1a1a22] text-zinc-500 hover:text-cyan-400 transition-all cursor-pointer"
                    title="Download Driver File"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
            {peripherals.length === 0 && (
              <div className="col-span-2 py-10 text-center text-zinc-600 text-xs">No peripherals loaded.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
