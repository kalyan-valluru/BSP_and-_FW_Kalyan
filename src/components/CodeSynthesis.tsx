import { useState, useEffect, useCallback } from 'react';
import {
  Download, Play, Usb, Server, Settings, Zap, ArrowRight, Sparkles,
  FileCode2, FileText, ChevronRight, FolderOpen, Cpu, GitBranch, Terminal,
} from 'lucide-react';
import type { HardwarePeripheral } from '../types';
import type { PlatformPreset } from '../data/presets';

interface BspFile {
  filename: string;
  code: string;
}

interface CodeSynthesisProps {
  activePreset: PlatformPreset | null;
  peripherals: HardwarePeripheral[];
  onCodeUpdate: (bareMetal: string, deviceTree: string, allFiles?: BspFile[]) => void;
  requirement?: string;
  requirementPlan?: any;
}

type ExecutionPathway = 'download' | 'sandbox' | 'jtag';

function getFileIcon(filename: string) {
  if (filename.endsWith('.h'))   return <FileCode2 className="w-3.5 h-3.5 text-neon-amber" />;
  if (filename.endsWith('.dts')) return <Settings className="w-3.5 h-3.5 text-neon-emerald" />;
  if (filename.endsWith('.tcl')) return <Terminal className="w-3.5 h-3.5 text-neon-cyan" />;
  return <FileCode2 className="w-3.5 h-3.5 text-neon-cyan" />;
}

function getFileGroupLabel(filename: string): string {
  if (filename === 'main.c' || filename === 'platform.h' || filename === 'platform.c') return 'Application Core';
  if (filename.includes('system_init') || filename.includes('interrupt')) return 'System';
  if (filename.includes('uart'))  return 'UART Driver';
  if (filename.includes('gpio'))  return 'GPIO Driver';
  if (filename.includes('spi'))   return 'SPI Driver';
  if (filename.includes('i2c'))   return 'I2C Driver';
  if (filename.includes('timer')) return 'Timer Driver';
  if (filename.endsWith('.dts'))  return 'Linux Device Tree';
  if (filename.endsWith('.tcl'))  return 'Vivado TCL';
  return 'Other';
}

// Simple syntax-highlighted token colorizer (no deps)
function tokenize(code: string): React.ReactNode[] {
  const keywords = /\b(int|void|return|while|for|if|else|static|const|uint32_t|uint8_t|u32|u8|u16|bool|true|false|NULL|struct|typedef|include|define|ifndef|endif|extern)\b/g;
  const strings  = /"[^"]*"/g;
  const comments = /\/\/[^\n]*|\/\*[\s\S]*?\*\//g;
  const numbers  = /\b(0x[0-9A-Fa-f]+|\d+)\b/g;
  const macros   = /\bXPAR_[A-Z0-9_]+\b/g;

  // Build segments with type tags
  type Seg = { start: number; end: number; type: string };
  const segs: Seg[] = [];
  const re = new RegExp(`(${comments.source}|${strings.source}|${keywords.source}|${macros.source}|${numbers.source})`, 'gm');
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    let t = 'keyword';
    if (m[0].startsWith('//') || m[0].startsWith('/*')) t = 'comment';
    else if (m[0].startsWith('"'))                       t = 'string';
    else if (/^0x|^\d/.test(m[0]))                      t = 'number';
    else if (m[0].startsWith('XPAR_'))                   t = 'macro';
    segs.push({ start: m.index, end: m.index + m[0].length, type: t });
  }
  segs.sort((a, b) => a.start - b.start);

  const nodes: React.ReactNode[] = [];
  let pos = 0;
  for (const seg of segs) {
    if (seg.start > pos) nodes.push(<span key={pos}>{code.slice(pos, seg.start)}</span>);
    const colorMap: Record<string, string> = {
      keyword: 'text-[#c792ea]',
      comment: 'text-[#546e7a] italic',
      string:  'text-[#c3e88d]',
      number:  'text-[#f78c6c]',
      macro:   'text-neon-amber font-semibold',
    };
    nodes.push(
      <span key={seg.start} className={colorMap[seg.type] || ''}>
        {code.slice(seg.start, seg.end)}
      </span>
    );
    pos = seg.end;
  }
  if (pos < code.length) nodes.push(<span key={pos}>{code.slice(pos)}</span>);
  return nodes;
}

export function CodeSynthesis({
  activePreset,
  peripherals,
  onCodeUpdate,
  requirement = '',
  requirementPlan,
}: CodeSynthesisProps) {
  const [executionPathway, setExecutionPathway] = useState<ExecutionPathway>('download');
  const [isExecuting, setIsExecuting]   = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [bspFiles, setBspFiles]         = useState<BspFile[]>([]);
  const [activeFile, setActiveFile]     = useState<string>('main.c');
  const [modelUsed, setModelUsed]       = useState('Offline BSP Builder');
  const [flowMode, setFlowMode]         = useState<'bare-metal' | 'linux'>('bare-metal');

  // ── Generate / load code ──────────────────────────────────────────────────
  const generateCode = useCallback(async (force: boolean = false) => {
    if (peripherals.length === 0) return;
    if (requirement && requirementPlan && !requirementPlan.readyForGeneration) return;
    const generationPeripherals = requirementPlan?.selectedPeripheralIds?.length
      ? peripherals.filter(p => requirementPlan.selectedPeripheralIds.includes(p.id))
      : peripherals;

    // Only use raw static preset snippet if explicitly forced or no server generation requested
    // Otherwise, generate full multi-file BSP drivers with real peripheral configurations
    const matchesPreset = !force && activePreset &&
      activePreset.peripherals.length === generationPeripherals.length &&
      activePreset.peripherals.every((p, i) =>
        p.peripheralBlock.toLowerCase() === (generationPeripherals[i]?.peripheralBlock || '').toLowerCase() &&
        (p.baseAddress || '').toLowerCase() === (generationPeripherals[i]?.baseAddress || '').toLowerCase()
      );

    // If preset matches strictly AND we already have files, keep them
    if (matchesPreset && bspFiles.length > 0) {
      return;
    }

    setIsGenerating(true);
    try {
      const arch = activePreset?.architecture || 'Zynq-7000';

      // ── Fetch multi-file BSP from server ────────────────────────────────
      const [codeResp, tclResp] = await Promise.all([
        fetch('/api/generate-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ peripherals: generationPeripherals, architecture: arch, vendor: activePreset?.vendor, requirement, requirementPlan }),
        }),
        fetch('/api/generate-vivado-tcl', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ peripherals: generationPeripherals, architecture: arch }),
        }),
      ]);

      const codeData = await codeResp.json();
      const tclData  = await tclResp.json();

      let files: BspFile[] = [];
      if (codeResp.ok && Array.isArray(codeData.files) && codeData.files.length > 0) {
        files = codeData.files;
        setModelUsed(codeData.modelUsed || 'Offline BSP Builder');
      } else {
        // fallback: wrap legacy response or preset code
        const fallbackC = codeData.bareMetal || activePreset?.bareMetalCode || '/* Auto-generated BSP */\n#include <stdio.h>\nint main(void) { return 0; }\n';
        const fallbackDts = codeData.deviceTree || activePreset?.deviceTreeCode || '/dts-v1/;\n/ { };';
        files = [
          { filename: 'main.c',     code: fallbackC },
          { filename: 'system.dts', code: fallbackDts },
        ];
      }

      if (tclResp.ok && tclData.tcl) {
        files = [...files.filter(f => f.filename !== 'vivado_project.tcl'),
                 { filename: 'vivado_project.tcl', code: tclData.tcl }];
      }

      setBspFiles(files);
      setActiveFile(files[0]?.filename || 'main.c');

      const mainCode = files.find(f => f.filename === 'main.c')?.code || '';
      const dtsCode  = files.find(f => f.filename === 'system.dts')?.code || '';
      onCodeUpdate(mainCode, dtsCode, files);

    } catch (err) {
      console.error('[CodeSynthesis] Error:', err);
      setBspFiles([
        { filename: 'main.c',    code: '// Network error generating code' },
        { filename: 'system.dts', code: '/* Network error generating code */' },
      ]);
    } finally {
      setIsGenerating(false);
    }
  }, [activePreset, peripherals, requirement, requirementPlan, onCodeUpdate]);

  useEffect(() => { generateCode(); }, [generateCode]);

  // ── Download ZIP ─────────────────────────────────────────────────────────
  const handleExecute = async () => {
    setIsExecuting(true);
    const mainCode = bspFiles.find(f => f.filename === 'main.c')?.code || '';
    const dtsCode  = bspFiles.find(f => f.filename === 'system.dts')?.code || '';
    onCodeUpdate(mainCode, dtsCode, bspFiles);

    if (executionPathway === 'download') {
      try {
        const resp = await fetch('/api/download-zip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bareMetalCode: mainCode, deviceTreeCode: dtsCode, peripherals, files: bspFiles }),
        });
        if (!resp.ok) throw new Error('Failed to generate ZIP');
        const blob = await resp.blob();
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = 'raw_source.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (err: any) {
        console.error(err);
        alert('Error downloading ZIP: ' + err.message);
      }
    }
    await new Promise(r => setTimeout(r, 800));
    setIsExecuting(false);
  };

  // ── Group files for sidebar ────────────────────────────────────────────
  const fileGroups: Record<string, BspFile[]> = {};
  
  const displayedFiles = bspFiles.filter(f => {
    if (f.filename.endsWith('.tcl')) return true; // TCL is needed for both
    if (flowMode === 'linux') {
      return f.filename.endsWith('.dts');
    } else {
      return !f.filename.endsWith('.dts');
    }
  });

  for (const f of displayedFiles) {
    const g = getFileGroupLabel(f.filename);
    if (!fileGroups[g]) fileGroups[g] = [];
    fileGroups[g].push(f);
  }

  const activeCode = displayedFiles.find(f => f.filename === activeFile)?.code || '';
  const lines      = activeCode.split('\n');

  const pathwayOptions = [
    { id: 'download' as const, icon: Download, title: 'Download Workspace ZIP', subtitle: 'raw_source.zip archive',         color: 'cyan'    },
    { id: 'sandbox'  as const, icon: Play,     title: 'Virtual Compiler Sandbox', subtitle: 'Vivado XSIM / QEMU Emulator', color: 'emerald' },
    { id: 'jtag'     as const, icon: Usb,      title: 'Physical Target Telemetry', subtitle: 'OpenOCD JTAG Flashing',       color: 'amber'   },
  ];

  return (
    <div className="space-y-5 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-6">
          <div>
            <h2 className="text-text-primary text-xl font-bold tracking-tight flex items-center gap-2">
              Generated BSP Output
              {isGenerating && <Sparkles className="w-5 h-5 text-neon-cyan animate-pulse" />}
            </h2>
            <p className="text-text-muted text-[13px] mt-1">
              {isGenerating
                ? 'Synthesizing multi-file BSP with XPAR_ macros and Xilinx SDK driver APIs...'
                : `${bspFiles.length} total files generated · ${modelUsed}`}
            </p>
          </div>
          
          {/* OS Flow Tabs */}
          <div className="flex bg-obsidian-200/50 p-1 rounded-lg border border-border-grid mt-1">
            <button
              onClick={() => { setFlowMode('bare-metal'); setActiveFile('main.c'); }}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
                flowMode === 'bare-metal' 
                  ? 'bg-neon-cyan/20 text-neon-cyan shadow-sm border border-neon-cyan/30' 
                  : 'text-text-muted hover:text-text-primary border border-transparent'
              }`}
            >
              Bare Metal
            </button>
            <button
              onClick={() => { setFlowMode('linux'); setActiveFile('system.dts'); }}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
                flowMode === 'linux' 
                  ? 'bg-purple-400/20 text-purple-400 shadow-sm border border-purple-400/30' 
                  : 'text-text-muted hover:text-text-primary border border-transparent'
              }`}
            >
              Linux Flow
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => generateCode(true)}
            disabled={isGenerating}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-neon-cyan/20 hover:bg-neon-cyan/30 text-neon-cyan rounded-lg border border-neon-cyan/40 text-sm font-semibold transition-all disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
            {isGenerating ? 'Synthesizing...' : 'Synthesize BSP Code'}
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-neon-emerald/10 rounded-lg border border-neon-emerald/30">
            <Zap className="w-4 h-4 text-neon-emerald" />
            <span className="text-neon-emerald text-sm font-medium">{peripherals.length} Peripherals</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-neon-cyan/10 rounded-lg border border-neon-cyan/30">
            <Cpu className="w-4 h-4 text-neon-cyan" />
            <span className="text-neon-cyan text-sm font-medium">{displayedFiles.length} Files Shown</span>
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-[180px,1fr,260px] gap-3 flex-1 min-h-0">

        {/* LEFT: File tree sidebar */}
        <div className="bg-obsidian-100/50 rounded-xl border border-border-grid overflow-hidden flex flex-col">
          <div className="px-3 py-2.5 border-b border-border-grid bg-obsidian-100/50 flex items-center gap-2">
            <FolderOpen className="w-3.5 h-3.5 text-neon-amber" />
            <span className="text-text-secondary text-[11px] font-semibold tracking-wider uppercase">BSP Sources</span>
          </div>
          <div className="flex-1 overflow-y-auto py-2 space-y-3 px-2">
            {isGenerating ? (
              <div className="space-y-2 pt-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="h-6 bg-obsidian-200 rounded animate-pulse" style={{ width: `${50 + Math.random() * 40}%` }} />
                ))}
              </div>
            ) : (
              Object.entries(fileGroups).map(([group, files]) => (
                <div key={group}>
                  <p className="text-[9px] text-text-muted/60 font-semibold uppercase tracking-widest px-1 mb-1">{group}</p>
                  {files.map(f => (
                    <button
                      key={f.filename}
                      onClick={() => setActiveFile(f.filename)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-all text-[11px] font-mono ${
                        activeFile === f.filename
                          ? 'bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/30'
                          : 'text-text-secondary hover:bg-obsidian-200 hover:text-text-primary'
                      }`}
                    >
                      {getFileIcon(f.filename)}
                      <span className="truncate">{f.filename}</span>
                      {activeFile === f.filename && <ChevronRight className="w-3 h-3 ml-auto flex-shrink-0 text-neon-cyan" />}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        {/* CENTER: Code editor */}
        <div className="bg-obsidian-100/50 rounded-xl border border-border-grid overflow-hidden flex flex-col">
          {/* Tab bar (just current file) */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border-grid bg-obsidian-100/50 min-h-[44px]">
            <GitBranch className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-text-secondary text-[12px] font-mono font-medium">{activeFile}</span>
            <span className="ml-auto text-text-muted text-[10px] font-mono">{lines.length} lines</span>
          </div>

          {/* Code content */}
          <div className="relative flex-1 overflow-auto">
            <div className="absolute left-0 top-0 bottom-0 w-12 bg-obsidian border-r border-border-grid">
              <div className="py-4 px-2 text-right select-none">
                {lines.map((_, i) => (
                  <div key={i} className="text-text-muted/40 text-[10px] font-mono leading-5">{i + 1}</div>
                ))}
              </div>
            </div>
            <div className="ml-12 p-4">
              {isGenerating ? (
                <div className="space-y-2 animate-pulse pt-1">
                  {Array.from({ length: 30 }).map((_, i) => (
                    <div key={i} className="h-4 bg-obsidian-200 rounded" style={{ width: `${20 + Math.random() * 75}%` }} />
                  ))}
                </div>
              ) : (
                <pre className="font-mono text-[12px] text-text-primary leading-5 whitespace-pre">
                  {tokenize(activeCode)}
                </pre>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Execution Controller */}
        <div className="space-y-4 flex flex-col">
          {/* Pathway selector */}
          <div className="bg-obsidian-100/50 rounded-xl border border-border-grid overflow-hidden">
            <div className="px-4 py-3 bg-obsidian-100/50 border-b border-border-grid">
              <div className="flex items-center gap-2 text-text-secondary text-[12px] font-medium">
                <Server className="w-3.5 h-3.5 text-neon-cyan" />
                Execution Pathway
              </div>
            </div>
            <div className="p-3 space-y-2">
              {pathwayOptions.map(option => {
                const Icon    = option.icon;
                const isActive = executionPathway === option.id;
                const colorMap = {
                  cyan:    'border-neon-cyan bg-neon-cyan/10',
                  emerald: 'border-neon-emerald bg-neon-emerald/10',
                  amber:   'border-neon-amber bg-neon-amber/10',
                };
                return (
                  <button
                    key={option.id}
                    onClick={() => setExecutionPathway(option.id)}
                    className={`w-full p-3 rounded-lg border transition-all text-left group ${
                      isActive ? colorMap[option.color as keyof typeof colorMap] : 'border-border-grid hover:border-neon-cyan/30 hover:bg-obsidian-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                          isActive
                            ? option.color === 'cyan' ? 'bg-neon-cyan/20' : option.color === 'emerald' ? 'bg-neon-emerald/20' : 'bg-neon-amber/20'
                            : 'bg-obsidian-200'
                        }`}>
                          <Icon className={`w-4 h-4 ${isActive
                            ? option.color === 'cyan' ? 'text-neon-cyan' : option.color === 'emerald' ? 'text-neon-emerald' : 'text-neon-amber'
                            : 'text-text-muted'}`} />
                        </div>
                        <div>
                          <p className="text-text-primary text-[12px] font-medium">{option.title}</p>
                          <p className="text-text-muted text-[10px]">{option.subtitle}</p>
                        </div>
                      </div>
                      {isActive && <ArrowRight className="w-3.5 h-3.5 text-neon-cyan" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* BSP File Summary */}
          <div className="bg-obsidian-100/50 rounded-xl border border-border-grid overflow-hidden flex-1">
            <div className="px-4 py-3 border-b border-border-grid">
              <span className="text-text-secondary text-[12px] font-medium flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-neon-emerald" />
                BSP File Manifest
              </span>
            </div>
            <div className="p-3 space-y-1 overflow-y-auto max-h-48">
              {bspFiles.map(f => (
                <div key={f.filename} className="flex items-center justify-between py-1 px-1">
                  <div className="flex items-center gap-1.5">
                    {getFileIcon(f.filename)}
                    <span className="text-text-secondary text-[10px] font-mono">{f.filename}</span>
                  </div>
                  <span className="text-text-muted text-[9px]">{f.code.split('\n').length}L</span>
                </div>
              ))}
            </div>
          </div>

          {/* Execute button */}
          <button
            onClick={handleExecute}
            disabled={isExecuting || isGenerating}
            className={`w-full px-4 py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2.5 ${
              isExecuting
                ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan cursor-wait'
                : isGenerating
                ? 'bg-obsidian-200 text-text-muted cursor-not-allowed'
                : 'bg-gradient-to-r from-neon-cyan to-neon-emerald text-obsidian hover:shadow-neon-cyan'
            }`}
          >
            {isExecuting ? (
              <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />Executing...</>
            ) : isGenerating ? (
              <><Sparkles className="w-4 h-4 animate-pulse" />Generating BSP...</>
            ) : executionPathway === 'download' ? (
              <><Download className="w-4 h-4" />Download ZIP ({bspFiles.length} files)</>
            ) : executionPathway === 'sandbox' ? (
              <><Play className="w-4 h-4" />Prepare Sandbox</>
            ) : (
              <><Usb className="w-4 h-4" />Initialize JTAG</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
