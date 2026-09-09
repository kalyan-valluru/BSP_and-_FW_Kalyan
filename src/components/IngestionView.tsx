import { useState, useCallback } from 'react';
import { Upload, FileText, Cpu, ChevronDown, Check, Zap, Clock, Trash2, X, Sparkles, AlertTriangle, Download } from 'lucide-react';
import { hardwarePresets } from '../data/presets';
import type { PlatformPreset } from '../data/presets';

const logoStyles: Record<string, { bg: string; border: string; text: string }> = {
  xilinx: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-500' },
  ti: { bg: 'bg-red-400/10', border: 'border-red-400/30', text: 'text-red-400' },
  st: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-500' },
  nvidia: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-500' },
  samsung: { bg: 'bg-blue-400/10', border: 'border-blue-400/30', text: 'text-blue-400' },
  nxp: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-500' },
};

interface IngestionViewProps {
  uploadedFiles: File[];
  selectedFileNames?: string[];
  onFileUpload: (files: File[]) => void;
  onPresetLoad: (preset: PlatformPreset) => void;
  onFileRemove?: (fileName: string) => void;
  onToggleFileSelection?: (fileName: string) => void;
  onFilesClear: () => void;
  selectedPresetId: string | null;
  parsingFiles?: string[];
  requirement?: string;
  requirementPlan?: any;
  onRequirementChange?: (value: string) => void;
  onResolveRequirement?: () => void;
  resolvingRequirement?: boolean;
}

export function IngestionView({
  uploadedFiles,
  selectedFileNames = [],
  onFileUpload,
  onPresetLoad,
  onFileRemove,
  onToggleFileSelection,
  onFilesClear,
  selectedPresetId,
  parsingFiles = [],
  requirement = '',
  requirementPlan,
  onRequirementChange,
  onResolveRequirement,
  resolvingRequirement = false,
}: IngestionViewProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loadingPreset, setLoadingPreset] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);

    const files = Array.from(e.dataTransfer.files).filter(
      (file) =>
        file.name.endsWith('.pdf') ||
        file.name.endsWith('.png') ||
        file.name.endsWith('.jpg') ||
        file.name.endsWith('.jpeg') ||
        file.name.endsWith('.bmp') ||
        file.name.endsWith('.tiff') ||
        file.name.endsWith('.netlist') ||
        file.name.endsWith('.csv') ||
        file.name.endsWith('.xlsx') ||
        file.name.endsWith('.xls') ||
        file.name.endsWith('.docx') ||
        file.name.endsWith('.zip') ||
        file.name.endsWith('.xpr') ||
        file.name.endsWith('.xsa') ||
        file.name.endsWith('.dts') ||
        file.name.endsWith('.dtsi') ||
        file.name.endsWith('.rdl') ||
        file.name.endsWith('.svd')
    );

    if (files.length > 0) {
      onFileUpload(files);
    }
  }, [onFileUpload]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[INGESTION_VIEW] handleFileInput fired with files:', e.target.files ? Array.from(e.target.files).map(f => f.name) : []);
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onFileUpload(files);
      e.target.value = '';
    }
  };

  const handlePresetSelect = async (preset: PlatformPreset) => {
    setIsDropdownOpen(false);
    setLoadingPreset(preset.id);
    await new Promise((resolve) => setTimeout(resolve, 400));
    onPresetLoad(preset);
    setLoadingPreset(null);
  };

  const handleDownloadExampleInput = async (preset: PlatformPreset) => {
    try {
      const response = await fetch('/api/example-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presetId: preset.id }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${preset.id}-example-input.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('[INGESTION_VIEW] Example input download failed:', error);
      alert(`Unable to download example input: ${error.message}`);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const selectedPreset = hardwarePresets.find((p) => p.id === selectedPresetId);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-text-primary text-2xl font-bold tracking-tight mb-2">
            Step 1: AI-Powered Hardware Ingestion
          </h2>
          <p className="text-text-secondary text-[13px] max-w-2xl leading-relaxed">
            Upload raw board schematics, datasheets, or netlists. Our specialized GenAI Copilot automatically parses unstructured documents, extracts pin mappings, and identifies hardware peripherals in seconds—eliminating weeks of manual data entry and human error.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-text-muted font-mono flex-wrap justify-end max-w-xs">
          {['.pdf','.png','.jpg','.csv','.xpr','.xsa','.dts','.rdl','.svd','.zip'].map(ext => (
            <span key={ext} className="px-2 py-1 bg-obsidian-100 rounded-md border border-neon-cyan/30 text-neon-cyan">
              {ext}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-neon-cyan/30 bg-neon-cyan/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-neon-cyan" />
          <span className="text-neon-cyan text-sm font-bold">Engineering Requirement</span>
          <span className="text-[10px] text-text-muted ml-auto">Astra interprets the requirement; hardware evidence supplies the addresses</span>
        </div>
        <textarea
          value={requirement}
          onChange={(e) => onRequirementChange?.(e.target.value)}
          placeholder="Example: Blink the board LED every 500 ms and print READY on UART."
          className="w-full min-h-[82px] resize-y rounded-lg border border-border-grid bg-obsidian-100/70 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted/60 outline-none focus:border-neon-cyan/50"
        />
        <div className="flex items-center justify-between gap-3 mt-3">
          <div className="text-[11px] text-text-muted">
            {requirementPlan ? (requirementPlan.readyForGeneration
              ? <span className="text-neon-emerald">✓ Requirement mapped to verified hardware</span>
              : <span className="text-neon-amber">⚠ Review required before code generation</span>)
              : 'Upload/select hardware first, then resolve the requirement against the verified peripheral map.'}
          </div>
          <button
            onClick={onResolveRequirement}
            disabled={resolvingRequirement || !requirement.trim() || uploadedFiles.length === 0 && !selectedPreset}
            className="px-4 py-2 rounded-lg bg-neon-cyan/20 border border-neon-cyan/40 text-neon-cyan text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {resolvingRequirement ? 'Resolving…' : 'Analyze & Map Hardware'}
          </button>
        </div>
        {requirementPlan && requirementPlan.explanation?.length > 0 && (
          <div className="mt-3 grid gap-1">
            {requirementPlan.explanation.map((line: string, i: number) => <div key={i} className="text-[11px] font-mono text-text-secondary">• {line}</div>)}
          </div>
        )}
        {requirementPlan?.unresolved?.length > 0 && (
          <div className="mt-3 rounded-lg border border-neon-amber/30 bg-neon-amber/5 p-3">
            {requirementPlan.unresolved.map((line: string, i: number) => <div key={i} className="flex gap-2 text-[11px] text-neon-amber"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{line}</div>)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-xl p-6 transition-all duration-300 ${
            isDragActive
              ? 'border-neon-cyan bg-neon-cyan/10 shadow-neon-cyan'
              : 'border-border-grid bg-obsidian-100/50 hover:border-neon-cyan/40 hover:bg-obsidian-100'
          }`}
        >
          <input
            id="file-upload-input"
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.bmp,.tiff,.netlist,.csv,.xlsx,.xls,.docx,.zip,.xpr,.xsa,.dts,.dtsi,.rdl,.svd"
            onChange={handleFileInput}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
          />

          <div className="flex flex-col items-center text-center py-4">
            <div
              className={`p-5 rounded-2xl mb-4 transition-all duration-300 ${
                isDragActive
                  ? 'bg-neon-cyan/30 text-neon-cyan shadow-lg shadow-neon-cyan/20'
                  : 'bg-obsidian-200 text-text-muted'
              }`}
            >
              <Upload className="w-10 h-10" />
            </div>
            <p className="text-text-secondary text-base font-medium mb-1">
              {isDragActive ? 'Release to parse with GenAI' : 'Upload board images, hardware designs, schematics, datasheets, or hardware description files'}
            </p>
            <p className="text-text-muted text-[12px]">
              or click to browse • Board image + user requirement is supported.
            </p>
          </div>
        </div>

        {/* Platform Dropdown */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-neon-cyan" />
            <span className="text-text-secondary text-[13px] font-medium">Platform Preset</span>
          </div>

          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              disabled={loadingPreset !== null}
              className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all duration-200 ${
                loadingPreset
                  ? 'border-neon-cyan bg-neon-cyan/10'
                  : selectedPreset
                  ? 'border-neon-emerald/50 bg-neon-emerald/5'
                  : isDropdownOpen
                  ? 'border-neon-cyan bg-obsidian-100'
                  : 'border-border-grid bg-obsidian-100/50 hover:border-neon-cyan/40'
              }`}
            >
              {loadingPreset ? (
                <div className="flex items-center gap-3 w-full">
                  <div className="w-5 h-5 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />
                  <span className="text-text-secondary text-sm">Loading preset...</span>
                </div>
              ) : selectedPreset ? (
                <div className="flex items-center gap-3 w-full">
                  <div className={`w-10 h-10 rounded-lg ${logoStyles[selectedPreset.logoType]?.bg || 'bg-neon-emerald/20'} border ${logoStyles[selectedPreset.logoType]?.border || 'border-neon-emerald/30'} flex items-center justify-center`}>
                    <Cpu className={`w-5 h-5 ${logoStyles[selectedPreset.logoType]?.text || 'text-neon-emerald'}`} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-text-primary text-sm font-medium">{selectedPreset.name}</p>
                    <p className="text-text-muted text-[11px] mt-0.5">
                      {selectedPreset.peripherals.length} peripherals • {selectedPreset.architecture}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 w-full">
                  <div className="w-10 h-10 rounded-lg bg-obsidian-200 flex items-center justify-center">
                    <Cpu className="w-5 h-5 text-text-muted" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-text-secondary text-sm">Select a platform</p>
                    <p className="text-text-muted text-[11px] mt-0.5">
                      Quick-load pre-configured peripherals
                    </p>
                  </div>
                </div>
              )}
              <ChevronDown
                className={`w-5 h-5 text-text-muted transition-transform duration-200 ${
                  isDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-obsidian-50 border border-neon-cyan/30 rounded-xl overflow-hidden shadow-xl shadow-black/50 z-50 max-h-[500px] overflow-y-auto">
                <div className="p-2 bg-obsidian-100/80 border-b border-border-grid text-[11px] font-semibold text-neon-cyan uppercase tracking-wider">
                  Engineering Demo Library — Production Platforms
                </div>
                {hardwarePresets.map((preset) => {
                  const style = logoStyles[preset.logoType] || logoStyles.xilinx;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => handlePresetSelect(preset)}
                      className="w-full flex flex-col gap-2 p-4 hover:bg-obsidian-100/50 transition-colors text-left border-b border-border-grid last:border-0 group"
                    >
                      <div className="flex items-center gap-4 w-full">
                        <div className={`w-12 h-12 rounded-lg ${style.bg} border ${style.border} flex items-center justify-center shrink-0`}>
                          <Cpu className={`w-6 h-6 ${style.text}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-text-primary text-sm font-semibold group-hover:text-neon-cyan transition-colors truncate">
                              {preset.name}
                            </p>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-mono ${style.bg} ${style.text} shrink-0`}>
                              {preset.vendor}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-neon-emerald/10 text-neon-emerald border border-neon-emerald/20 shrink-0">
                              {preset.supportedFlow || 'Both'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-text-muted">
                            <span>{preset.architecture}</span>
                            <span>•</span>
                            <span>{preset.frequency}</span>
                            <span>•</span>
                            <span>{preset.toolchainUsed?.split('+')[0] || 'Standard Compiler'}</span>
                          </div>
                        </div>
                        {selectedPresetId === preset.id && (
                          <Check className="w-5 h-5 text-neon-emerald shrink-0" />
                        )}
                      </div>

                      {/* Example Input Download */}
                      <div className="mt-1 flex items-center justify-between gap-3 rounded-lg border border-neon-cyan/20 bg-neon-cyan/5 p-2.5">
                        <div className="min-w-0">
                          <div className="text-[10px] uppercase tracking-wider font-semibold text-neon-cyan">Example Input</div>
                          <div className="text-[10px] text-text-muted truncate mt-0.5">Download a ready-to-upload sample circuit/requirement package</div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); void handleDownloadExampleInput(preset); }}
                          className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-neon-cyan/30 bg-neon-cyan/10 text-neon-cyan text-[10px] font-bold hover:bg-neon-cyan/20"
                          title={`Download example input for ${preset.name}`}
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download Input
                        </button>
                      </div>

                      {/* Engineering Workflow Summary */}
                      {preset.workflow && (
                        <div className="mt-1 p-2.5 rounded-lg bg-obsidian-200/50 border border-border-grid text-[11px] space-y-1">
                          <div className="text-text-secondary font-mono text-[10px] uppercase font-medium text-neon-cyan">
                            Pipeline Workflow:
                          </div>
                          <div className="text-text-muted truncate font-mono">
                            {preset.workflow.join(' → ')}
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-text-muted pt-1">
                            <span>Artifacts: {preset.generatedArtifacts?.slice(0, 3).join(', ')}...</span>
                            <span>Toolchain: {preset.toolchainUsed}</span>
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Circuit Diagram Preview for Selected Preset */}
          {selectedPreset && (
            <div className="rounded-xl border border-neon-cyan/30 bg-obsidian-100/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-neon-cyan" />
                  <span className="text-xs font-bold text-text-primary">Circuit Input Diagram — {selectedPreset.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDownloadExampleInput(selectedPreset)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan text-[10px] font-bold hover:bg-neon-cyan/20 cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  Download Input Package
                </button>
              </div>

              {/* Dynamic SVG Schematic Render */}
              <div className="rounded-lg border border-border-grid bg-obsidian-200/80 p-4 overflow-x-auto">
                <svg viewBox="0 0 760 220" className="w-full h-auto min-w-[500px]">
                  <rect width="100%" height="100%" fill="#0b0f14" rx="8" />
                  {/* MCU Box */}
                  <rect x="260" y="45" width="240" height="130" rx="10" fill="#141b24" stroke="#38d9ff" strokeWidth="2" />
                  <text x="380" y="100" textAnchor="middle" fill="#38d9ff" fontFamily="sans-serif" fontSize="16" fontWeight="bold">
                    {selectedPreset.processor || selectedPreset.architecture}
                  </text>
                  <text x="380" y="125" textAnchor="middle" fill="#a9b4c2" fontFamily="sans-serif" fontSize="12">
                    {selectedPreset.boardName || selectedPreset.name}
                  </text>
                  <text x="380" y="150" textAnchor="middle" fill="#697586" fontFamily="sans-serif" fontSize="10">
                    GenAI Input Circuit Schematic
                  </text>

                  {/* Peripheral Connections */}
                  {selectedPreset.peripherals.slice(0, 4).map((p, i) => {
                    const isLeft = i % 2 === 0;
                    const y = i < 2 ? 65 : 145;
                    const boxX = isLeft ? 20 : 540;
                    const lineStartX = isLeft ? 200 : 540;
                    const lineEndX = isLeft ? 260 : 500;

                    return (
                      <g key={i}>
                        {/* Wire Net Line */}
                        <line x1={lineStartX} y1={y + 20} x2={lineEndX} y2={y + 20} stroke="#38d9ff" strokeWidth="2" strokeDasharray="4,2" />
                        {/* Component Block */}
                        <rect x={boxX} y={y} width="180" height="40" rx="6" fill="#111820" stroke="#2b3948" />
                        <text x={boxX + 10} y={y + 18} fill="#e6edf3" fontFamily="sans-serif" fontSize="11" fontWeight="bold">
                          {p.peripheralBlock}
                        </text>
                        <text x={boxX + 10} y={y + 32} fill="#38d9ff" fontFamily="sans-serif" fontSize="9">
                          {p.physicalPinMapping}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div className="flex items-center justify-between text-[11px] text-text-muted">
                <span>Verified Inputs: {selectedPreset.peripherals.map(p => p.physicalPinMapping).join(', ')}</span>
                <span className="text-neon-emerald font-mono">✓ Verified Pins</span>
              </div>
            </div>
          )}


          {/* Info Box */}
          <div className="flex items-start gap-3 text-[12px] text-text-muted bg-obsidian-100/50 p-4 rounded-xl border border-border-grid">
            <Zap className="w-5 h-5 text-neon-cyan shrink-0" />
            <div className="flex flex-col gap-1">
              <span className="text-text-primary font-medium">Why use a Platform Preset?</span>
              <span className="leading-relaxed">
                Presets simulate a completed AI ingestion. They instantly load complex, pre-verified register maps, memory addresses, and driver configurations for industry-standard development boards.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-text-muted text-[11px] uppercase tracking-wide font-medium">
              Uploaded Files ({uploadedFiles.length})
            </p>
            <div className="flex items-center gap-4">
              {parsingFiles.length > 0 && (
                <span className="flex items-center gap-1.5 text-[11px] text-neon-cyan font-mono">
                  <span className="w-3 h-3 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin inline-block" />
                  AI reading via Ollama…
                </span>
              )}
              <button
                onClick={onFilesClear}
                className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 font-medium transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear All
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {uploadedFiles.map((file, idx) => {
              const isParsing = parsingFiles.includes(file.name);
              const isSelected = selectedFileNames.includes(file.name);
              return (
                <div
                  key={idx}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    isParsing
                      ? 'bg-neon-cyan/5 border-neon-cyan/50 shadow-sm shadow-neon-cyan/20'
                      : isSelected
                      ? 'border-neon-cyan/30 bg-obsidian-100/50'
                      : 'border-border-grid bg-obsidian-100/20'
                  }`}
                >
                  {/* Selection Checkbox */}
                  {!isParsing && onToggleFileSelection && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleFileSelection(file.name)}
                      className="w-4 h-4 rounded border-border-grid text-neon-cyan focus:ring-neon-cyan/50 cursor-pointer"
                    />
                  )}

                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isParsing ? 'bg-neon-cyan/20' : 'bg-neon-cyan/10'
                  }`}>
                    {isParsing ? (
                      <span className="w-5 h-5 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin block" />
                    ) : (
                      <FileText className="w-5 h-5 text-neon-cyan" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-text-primary text-sm font-medium truncate">{file.name}</p>
                    <p className="text-text-muted text-[10px] font-mono">
                      {isParsing ? (
                        <span className="text-neon-cyan animate-pulse">AI reading via Ollama…</span>
                      ) : (
                        formatFileSize(file.size)
                      )}
                    </p>
                  </div>

                  {/* Remove Button */}
                  {!isParsing && onFileRemove && (
                    <button
                      onClick={() => onFileRemove(file.name)}
                      className="p-1 rounded-lg hover:bg-obsidian-200 text-text-muted hover:text-red-400 transition-colors cursor-pointer"
                      title="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
