import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Terminal, Trash2, AlertTriangle, CheckCircle2, Activity, AlertCircle, Search, Download, ArrowDown, ChevronDown, Pause, Clock, Zap, ChevronRight, X, Loader2, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TerminalLine } from '../types';

interface TerminalStreamProps {
  terminalOutput: TerminalLine[];
  compilationStatus: 'idle' | 'running' | 'error' | 'success';
  onEmergencyReset: () => void;
  onResumeBuild?: () => void;
  inputType: 'vivado_xpr' | 'xsa' | 'circuit_doc' | 'spec_tree';
}

type TabType = 'all' | 'ai' | 'parser' | 'vivado' | 'vitis' | 'compiler' | 'warning' | 'error';

export function TerminalStream({
  terminalOutput,
  compilationStatus,
  onEmergencyReset,
  onResumeBuild,
  inputType,
}: TerminalStreamProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [showEmergencyConfirm, setShowEmergencyConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Terminal Auto-Scroll & Status State
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevOutputLengthRef = useRef<number>(0);

  // Pipeline detail panel state
  const [selectedStageIdx, setSelectedStageIdx] = useState<number | null>(null);

  // Elapsed timer
  const [buildStartTime] = useState<number>(() => Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (compilationStatus !== 'running') return;
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - buildStartTime) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [compilationStatus, buildStartTime]);

  const fmtElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec < 10 ? '0' : ''}${sec}s`;
  };

  const formatTime = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handleEmergencyClick = () => {
    if (showEmergencyConfirm) {
      onEmergencyReset();
      setShowEmergencyConfirm(false);
    } else {
      setShowEmergencyConfirm(true);
      setTimeout(() => setShowEmergencyConfirm(false), 3000);
    }
  };

  // Filter logs based on active tab and search query
  const filteredOutput = useMemo(() => {
    return (terminalOutput || []).filter((line) => {
      if (!line) return false;
      
      // 1. Filter by Tab
      const contentStr = typeof line.content === 'string' ? line.content : '';
      const text = contentStr.toLowerCase();
      if (activeTab === 'ai') {
        if (!text.includes('[system] ai') && !text.includes('ai analysis') && !text.includes('gemini') && !text.includes('deepreader') && line.type !== 'system') return false;
      } else if (activeTab === 'parser') {
        if (!text.includes('[system] writing') && !text.includes('parsing') && !text.includes('ingested') && !text.includes('scanner')) return false;
      } else if (activeTab === 'vivado') {
        if (!text.includes('vivado') && !text.includes('v++') && !text.includes('synthesis') && !text.includes('implementation') && !text.includes('bitstream')) return false;
      } else if (activeTab === 'vitis') {
        if (!text.includes('vitis') && !text.includes('xsct') && !text.includes('tcl')) return false;
      } else if (activeTab === 'compiler') {
        if (!text.includes('gcc') && !text.includes('compiler') && !text.includes('compilation') && !text.includes('firmware.elf')) return false;
      } else if (activeTab === 'warning') {
        if (line.type !== 'warning' && !text.includes('[warning]')) return false;
      } else if (activeTab === 'error') {
        if (line.type !== 'error' && !text.includes('[error]')) return false;
      }

      // 2. Filter by Search Query
      if (searchQuery.trim() !== '') {
        return text.includes(searchQuery.toLowerCase());
      }

      return true;
    });
  }, [terminalOutput, activeTab, searchQuery]);

  const displayedOutput = useMemo(() => {
    // Only render the last 400 lines to prevent DOM bloat and preserve high performance
    if (filteredOutput.length > 400) {
      return filteredOutput.slice(-400);
    }
    return filteredOutput;
  }, [filteredOutput]);

  // ── Scroll position & Auto-scroll detection ────────────────────────────────
  const handleScroll = useCallback(() => {
    if (!terminalRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = terminalRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    const atBottom = distanceToBottom <= 20;

    setIsAtBottom(atBottom);

    if (atBottom) {
      setAutoScrollEnabled(true);
      setUnreadCount(0);
    } else {
      setAutoScrollEnabled(false);
    }
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    if (terminalRef.current) {
      terminalRef.current.scrollTo({
        top: terminalRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
    setAutoScrollEnabled(true);
    setIsAtBottom(true);
    setUnreadCount(0);
  }, []);

  // Handle incoming stream line increments & auto-scroll
  useEffect(() => {
    const newCount = displayedOutput.length;
    const prevCount = prevOutputLengthRef.current;
    const addedLines = Math.max(0, newCount - prevCount);
    prevOutputLengthRef.current = newCount;

    if (!terminalRef.current) return;

    if (autoScrollEnabled || isAtBottom) {
      terminalRef.current.scrollTo({
        top: terminalRef.current.scrollHeight,
        behavior: 'smooth'
      });
      setUnreadCount(0);
    } else if (addedLines > 0) {
      setUnreadCount(prev => prev + addedLines);
    }
  }, [displayedOutput, autoScrollEnabled, isAtBottom]);

  // Reset scroll and unread count on tab/search change
  useEffect(() => {
    setUnreadCount(0);
    scrollToBottom(false);
  }, [activeTab, searchQuery, scrollToBottom]);

  // Export log to text file
  const handleExportLogs = () => {
    const logContent = filteredOutput.map(line => `[${formatTime(line.timestamp)}] ${line.content}`).join('\n');
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bsp_eda_console_${activeTab}_logs.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getLineStyles = (type: TerminalLine['type']) => {
    switch (type) {
      case 'error':
        return 'text-red-400';
      case 'success':
        return 'text-neon-emerald';
      case 'warning':
        return 'text-neon-amber';
      case 'system':
        return 'text-neon-cyan';
      default:
        return 'text-text-secondary';
    }
  };

  const phases = useMemo(() => {
    switch (inputType) {
      case 'xsa':
        return [
          { id: 'workspace_preflight', name: 'Pre-flight', shortName: 'Pre-flight', desc: 'Verify source code & system constraints' },
          { id: 'stage_9_launch_vitis', name: 'Platform', shortName: 'Platform', desc: 'Ingest hardware platform XSA into Vitis' },
          { id: 'stage_10_generate_bsp', name: 'Gen BSP', shortName: 'BSP', desc: 'Synthesize standalone BSP domain & drivers' },
          { id: 'stage_11_compile_firmware', name: 'Compile', shortName: 'Compile', desc: 'Build bare-metal firmware.elf application' },
          { id: 'stage_12_post_build_verification', name: 'Verify', shortName: 'Verify', desc: 'Verify generated binary artifacts & ELF image' },
        ];
      case 'circuit_doc':
        return [
          { id: 'ocr', name: 'OCR', shortName: 'OCR', desc: 'Extract text from schematic images' },
          { id: 'vision_analysis', name: 'Vision', shortName: 'Vision', desc: 'Identify components and connections' },
          { id: 'processor_detection', name: 'Processor', shortName: 'Proc', desc: 'Determine target processor architecture' },
          { id: 'semantic_retrieval', name: 'Retrieval', shortName: 'HKL', desc: 'Query specs for register mapping' },
          { id: 'hal_generation', name: 'HAL', shortName: 'HAL', desc: 'Generate HAL structures' },
          { id: 'validation', name: 'Validation', shortName: 'Valid', desc: 'Validate address and clock constraints' },
          { id: 'vivado_project_generator', name: 'Vivado Gen', shortName: 'Vivado', desc: 'Auto-generate Vivado Tcl project from HKL' },
          { id: 'generate_bsp', name: 'Gen BSP', shortName: 'BSP', desc: 'Synthesize driver templates' },
          { id: 'generate_firmware', name: 'Firmware', shortName: 'FW', desc: 'Synthesize application firmware.elf' },
          { id: 'simulation_package', name: 'Simulation', shortName: 'Sim', desc: 'Create validation simulation models' },
        ];
      case 'spec_tree':
        return [
          { id: 'parse_specification', name: 'Parse Spec', shortName: 'Parse', desc: 'Ingest DTS/SVD/JSON structures' },
          { id: 'semantic_retrieval', name: 'Retrieval', shortName: 'HKL', desc: 'Scan register schemas against database' },
          { id: 'hal_generation', name: 'HAL Gen', shortName: 'HAL', desc: 'Create HAL headers and bindings' },
          { id: 'validation', name: 'Validation', shortName: 'Valid', desc: 'Run DRC check and memory layout validation' },
          { id: 'generate_bsp', name: 'Gen BSP', shortName: 'BSP', desc: 'Synthesize BSP source code templates' },
        ];
      case 'vivado_xpr':
      default:
        return [
          { id: 'stage_1_hardware_detection', name: 'Stage 1: Pre-flight', shortName: 'Pre-flight', desc: 'Verify toolchain & system environment' },
          { id: 'stage_4_vivado_project_creation', name: 'Stage 4: Vivado Create', shortName: 'Create', desc: 'Initialize project & create block design' },
          { id: 'stage_5_rtl_synthesis', name: 'Stage 5: Synthesis', shortName: 'Synth', desc: 'Run RTL synthesis (synth_1)' },
          { id: 'stage_6_implementation', name: 'Stage 6: Implementation', shortName: 'Impl', desc: 'Run Place & Route (impl_1)' },
          { id: 'stage_7_bitstream_generation', name: 'Stage 7: Bitstream', shortName: 'Bitstream', desc: 'Generate physical FPGA bitstream (.bit)' },
          { id: 'stage_8_export_hardware', name: 'Stage 8: Export XSA', shortName: 'XSA', desc: 'Export hardware container (.xsa)' },
          { id: 'stage_9_launch_vitis', name: 'Stage 9: Launch Vitis', shortName: 'Vitis', desc: 'Create 64-bit Vitis XSCT platform' },
          { id: 'stage_10_generate_bsp', name: 'Stage 10: Generate BSP', shortName: 'BSP', desc: 'Synthesize standalone BSP domain (libxil.a)' },
          { id: 'stage_11_compile_firmware', name: 'Stage 11: GCC Compile', shortName: 'GCC', desc: 'Cross-compile bare-metal firmware.elf' },
          { id: 'stage_12_post_build_verification', name: 'Stage 12: Verification', shortName: 'Verify', desc: 'Verify binary layout & post-build report' },
        ];
    }
  }, [inputType]);

  // Determine Current Build Phase directly from Backend Stage Identifiers
  const buildPhase = useMemo(() => {
    if (compilationStatus === 'idle') return { step: 0, status: 'idle' };
    if (compilationStatus === 'error') return { step: -1, status: 'error' };
    if (compilationStatus === 'success') return { step: phases.length, status: 'success' };

    // Search terminal output in reverse for explicit [PROGRESS] PHASE stage markers
    const progressLine = [...terminalOutput]
      .reverse()
      .find(l => l && typeof l.content === 'string' && (l.content.includes('[PROGRESS] PHASE:') || l.content.includes('PHASE: stage_')));

    if (progressLine) {
      const content = progressLine.content as string;
      let phaseId = '';
      const matchProgress = content.match(/\[PROGRESS\]\s+PHASE:\s*([^\s|]+)/i);
      if (matchProgress) {
        phaseId = matchProgress[1].trim().toLowerCase();
      }

      if (phaseId) {
        const matchingIdx = phases.findIndex(p => p.id.toLowerCase() === phaseId || phaseId.includes(p.id.toLowerCase()));
        if (matchingIdx !== -1) {
          return { step: matchingIdx + 1, status: 'running' };
        }
      }
    }

    return { step: 1, status: 'running' };
  }, [terminalOutput, compilationStatus, phases]);

  // Count warnings & errors from log output
  const logCounts = useMemo(() => {
    let warnings = 0, errors = 0;
    for (const l of terminalOutput) {
      if (!l) continue;
      if (l.type === 'warning') warnings++;
      if (l.type === 'error') errors++;
    }
    return { warnings, errors };
  }, [terminalOutput]);

  // Compute per-stage status
  const getStageStatus = (idx: number): 'completed' | 'running' | 'failed' | 'waiting' => {
    const stepNum = idx + 1;
    if (buildPhase.status === 'success') return 'completed';
    if (buildPhase.status === 'error' && buildPhase.step === stepNum) return 'failed';
    if (buildPhase.step > stepNum && buildPhase.status !== 'error') return 'completed';
    if (buildPhase.status === 'running' && buildPhase.step === stepNum) return 'running';
    return 'waiting';
  };

  // Overall progress %
  const overallProgress = useMemo(() => {
    if (compilationStatus === 'success') return 100;
    if (compilationStatus === 'idle') return 0;
    const completed = phases.filter((_, i) => getStageStatus(i) === 'completed').length;
    const running = phases.filter((_, i) => getStageStatus(i) === 'running').length;
    return Math.round(((completed + running * 0.5) / phases.length) * 100);
  }, [compilationStatus, phases, buildPhase]);

  // Active stage name for metrics bar
  const activeStage = useMemo(() => {
    if (compilationStatus === 'success') return 'Completed';
    if (compilationStatus === 'error') return 'Failed';
    const activeIdx = phases.findIndex((_, i) => getStageStatus(i) === 'running');
    if (activeIdx >= 0) return phases[activeIdx].name;
    return 'Idle';
  }, [compilationStatus, phases, buildPhase]);

  return (
    <div className="space-y-3 flex flex-col min-h-[480px]">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-text-primary text-xl font-bold tracking-tight flex items-center gap-3">
            Multi-Console System Logs
            <span className={`text-[11px] font-mono px-3 py-1 rounded-full border ${
              compilationStatus === 'running'
                ? 'text-neon-cyan bg-neon-cyan/10 border-neon-cyan/30 animate-pulse'
                : compilationStatus === 'error'
                ? 'text-red-400 bg-red-500/10 border-red-500/30'
                : compilationStatus === 'success'
                ? 'text-neon-emerald bg-neon-emerald/10 border-neon-emerald/30'
                : 'text-text-muted bg-obsidian-100 border-border-grid'
            }`}>
              {compilationStatus === 'running' ? 'Compiling' : compilationStatus === 'error' ? 'Failed' : compilationStatus === 'success' ? 'Success' : 'Ready'}
            </span>
            {(() => {
              const stateLine = [...(terminalOutput || [])].reverse().find(l => l && typeof l.content === 'string' && l.content.includes('[PIPELINE STATE]'));
              if (!stateLine) return null;
              const content = stateLine.content as string;
              const match = content.match(/\[PIPELINE STATE\]\s+(\w+)(?:\s+\|\s+(.*))?/);
              if (!match) return null;
              const state = match[1];
              const detail = match[2];

              let badgeStyle = 'text-neon-cyan bg-neon-cyan/10 border-neon-cyan/30';
              if (state === 'WarningDetected') badgeStyle = 'text-neon-amber bg-neon-amber/10 border-neon-amber/30';
              if (state === 'AIRepairing') badgeStyle = 'text-purple-400 bg-purple-500/10 border-purple-500/30 animate-pulse';
              if (state === 'Retrying') badgeStyle = 'text-blue-400 bg-blue-500/10 border-blue-500/30 animate-pulse';
              if (state === 'Recovered') badgeStyle = 'text-neon-emerald bg-neon-emerald/10 border-neon-emerald/30';
              if (state === 'Failed') badgeStyle = 'text-red-400 bg-red-500/10 border-red-500/30';

              return (
                <span className={`text-[11px] font-mono px-3 py-1 rounded-full border ${badgeStyle} flex items-center gap-1.5`} title={detail || state}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {state === 'AIRepairing' ? '🤖 AI Repairing' : state === 'WarningDetected' ? '⚠️ Warning Detected' : state}
                </span>
              );
            })()}
          </h2>
          <p className="text-text-muted text-[13px] mt-1">
            Browse and search synthesis logs across Vivado, Vitis, compiler, and AI debuggers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {compilationStatus === 'success' && (
            <button
              onClick={() => {
                const connectBtn = document.querySelector('button:has(svg.lucide-wifi)') as HTMLButtonElement;
                if (connectBtn) connectBtn.click();
              }}
              className="px-4 py-2.5 rounded-xl font-bold text-[12px] uppercase tracking-wide transition-all flex items-center gap-2 bg-gradient-to-r from-neon-emerald/20 to-neon-cyan/20 border-2 border-neon-emerald/60 text-neon-emerald hover:border-neon-emerald hover:shadow-neon-emerald shadow-lg cursor-pointer animate-pulse"
            >
              <Wifi className="w-4 h-4 text-neon-emerald" />
              <span>Connect with Target Hardware Board →</span>
            </button>
          )}
          {compilationStatus === 'error' && onResumeBuild && (
            <button
              onClick={onResumeBuild}
              className="px-5 py-2.5 rounded-xl font-bold text-[12px] uppercase tracking-wide transition-all flex items-center gap-2.5 bg-neon-amber/10 border-2 border-neon-amber/50 text-neon-amber hover:bg-neon-amber/20 hover:border-neon-amber shadow-sm"
            >
              <Activity className="w-4 h-4" />
              Resume Build
            </button>
          )}
          <button
            onClick={handleEmergencyClick}
            className={`px-5 py-2.5 rounded-xl font-bold text-[12px] uppercase tracking-wide transition-all flex items-center gap-2.5 ${
              showEmergencyConfirm
                ? 'bg-status-error text-white border-2 border-status-error shadow-neon-error animate-pulse'
                : 'bg-obsidian-100 border-2 border-status-error/30 text-status-error hover:bg-status-error hover:text-white hover:border-status-error'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            {showEmergencyConfirm ? 'CONFIRM RESET' : 'Clear System'}
          </button>
        </div>
      </div>

      {/* ── Compact EDA Pipeline Tracker ──────────────────────────── */}
      {compilationStatus !== 'idle' && (
        <div className="bg-obsidian-100/40 border border-border-grid rounded-2xl overflow-hidden">
          {/* Compact Metrics Bar */}
          <div className="flex items-center gap-6 px-5 py-2.5 border-b border-border-grid bg-obsidian-100/30">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">Progress</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 rounded-full bg-obsidian-200 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${compilationStatus === 'error' ? 'bg-red-500' : compilationStatus === 'success' ? 'bg-emerald-500' : 'bg-cyan-400'}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${overallProgress}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </div>
                <span className="text-[11px] font-mono font-bold text-text-primary">{overallProgress}%</span>
              </div>
            </div>
            <div className="w-px h-4 bg-border-grid" />
            <div className="flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-neon-cyan" />
              <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">Stage</span>
              <span className="text-[11px] font-mono font-semibold text-neon-cyan">{activeStage}</span>
            </div>
            <div className="w-px h-4 bg-border-grid" />
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-text-muted" />
              <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">Elapsed</span>
              <span className="text-[11px] font-mono font-semibold text-text-primary">{fmtElapsed(elapsed)}</span>
            </div>
            <div className="w-px h-4 bg-border-grid" />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">Step</span>
              <span className="text-[11px] font-mono font-bold text-text-primary">
                {Math.max(1, Math.min(buildPhase.step, phases.length))}/{phases.length}
              </span>
            </div>
            {logCounts.warnings > 0 && (
              <>
                <div className="w-px h-4 bg-border-grid" />
                <div className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-neon-amber" />
                  <span className="text-[11px] font-mono font-bold text-neon-amber">{logCounts.warnings}</span>
                </div>
              </>
            )}
            {logCounts.errors > 0 && (
              <>
                <div className="w-px h-4 bg-border-grid" />
                <div className="flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-red-400" />
                  <span className="text-[11px] font-mono font-bold text-red-400">{logCounts.errors}</span>
                </div>
              </>
            )}
          </div>

          {/* Horizontal Pipeline + Optional Side Panel */}
          <div className="flex">
            {/* Pipeline Nodes */}
            <div className="flex-1 px-5 py-4">
              <div className="flex items-center gap-0">
                {phases.map((phase, idx) => {
                  const status = getStageStatus(idx);
                  const isSelected = selectedStageIdx === idx;

                  // Node colors
                  let nodeBg = 'bg-obsidian-200';
                  let nodeRing = 'ring-border-grid';
                  let textColor = 'text-text-muted';
                  let nodeIcon: React.ReactNode = <span className="w-1.5 h-1.5 rounded-full bg-text-muted/40" />;

                  if (status === 'completed') {
                    nodeBg = 'bg-emerald-500/15';
                    nodeRing = 'ring-emerald-500/40';
                    textColor = 'text-emerald-400';
                    nodeIcon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
                  } else if (status === 'running') {
                    nodeBg = 'bg-cyan-500/15';
                    nodeRing = 'ring-cyan-400/50';
                    textColor = 'text-cyan-400';
                    nodeIcon = <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />;
                  } else if (status === 'failed') {
                    nodeBg = 'bg-red-500/15';
                    nodeRing = 'ring-red-500/50';
                    textColor = 'text-red-400';
                    nodeIcon = <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
                  }

                  // Connector line
                  const connectorStatus = getStageStatus(idx);
                  let lineColor = 'bg-border-grid';
                  if (connectorStatus === 'completed') lineColor = 'bg-emerald-500/50';
                  else if (connectorStatus === 'running') lineColor = 'bg-cyan-400/50';

                  return (
                    <div key={idx} className="flex items-center flex-1 min-w-0">
                      {/* Node */}
                      <motion.button
                        onClick={() => setSelectedStageIdx(isSelected ? null : idx)}
                        className={`flex flex-col items-center gap-1.5 px-1 py-1.5 rounded-xl cursor-pointer transition-all group relative min-w-[56px] ${
                          isSelected ? 'bg-obsidian-200/60 ring-1 ring-neon-cyan/40' : 'hover:bg-obsidian-200/40'
                        }`}
                        whileTap={{ scale: 0.95 }}
                      >
                        {/* Icon circle */}
                        <div className={`w-8 h-8 rounded-full ${nodeBg} ring-1 ${nodeRing} flex items-center justify-center transition-all ${
                          status === 'running' ? 'shadow-[0_0_12px_rgba(0,245,212,0.25)]' : ''
                        }`}>
                          {nodeIcon}
                        </div>
                        {/* Label */}
                        <span className={`text-[9px] font-mono font-semibold ${textColor} leading-tight text-center truncate w-full`}>
                          {phase.shortName}
                        </span>
                      </motion.button>

                      {/* Connector Line */}
                      {idx < phases.length - 1 && (
                        <div className="flex-1 h-[2px] min-w-[8px] relative mx-0.5">
                          <div className="absolute inset-0 bg-border-grid rounded-full" />
                          <motion.div
                            className={`absolute inset-y-0 left-0 ${lineColor} rounded-full`}
                            initial={{ width: 0 }}
                            animate={{ width: connectorStatus === 'completed' ? '100%' : connectorStatus === 'running' ? '50%' : '0%' }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Side Details Panel */}
            <AnimatePresence>
              {selectedStageIdx !== null && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 260, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="border-l border-border-grid overflow-hidden flex-shrink-0"
                >
                  <div className="w-[260px] px-4 py-3">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-[11px] font-mono font-bold text-text-primary uppercase tracking-wider">Stage Details</h4>
                      <button
                        onClick={() => setSelectedStageIdx(null)}
                        className="p-0.5 rounded hover:bg-obsidian-200 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {(() => {
                      const phase = phases[selectedStageIdx];
                      const status = getStageStatus(selectedStageIdx);
                      const statusLabel = status === 'completed' ? 'Completed' : status === 'running' ? 'Running' : status === 'failed' ? 'Failed' : 'Waiting';
                      const statusColor = status === 'completed' ? 'text-emerald-400' : status === 'running' ? 'text-cyan-400' : status === 'failed' ? 'text-red-400' : 'text-text-muted';

                      return (
                        <div className="space-y-2.5">
                          <div>
                            <p className="text-[13px] font-bold text-text-primary">{phase.name}</p>
                            <p className="text-[10px] text-text-muted leading-snug mt-0.5">{phase.desc}</p>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-text-muted font-mono">Status</span>
                              <span className={`text-[10px] font-mono font-bold ${statusColor} flex items-center gap-1`}>
                                {status === 'running' && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
                                {statusLabel}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-text-muted font-mono">Step</span>
                              <span className="text-[10px] font-mono text-text-primary">{selectedStageIdx + 1} / {phases.length}</span>
                            </div>
                            {status === 'running' && (
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-text-muted font-mono">Elapsed</span>
                                <span className="text-[10px] font-mono text-text-primary">{fmtElapsed(elapsed)}</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-text-muted font-mono">Warnings</span>
                              <span className={`text-[10px] font-mono ${logCounts.warnings > 0 ? 'text-neon-amber font-bold' : 'text-text-muted'}`}>{logCounts.warnings}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-text-muted font-mono">Errors</span>
                              <span className={`text-[10px] font-mono ${logCounts.errors > 0 ? 'text-red-400 font-bold' : 'text-text-muted'}`}>{logCounts.errors}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ── Fixed-Height Terminal Console ─────────────────────────── */}
      <div className="bg-obsidian rounded-2xl border border-border-grid overflow-hidden flex flex-col relative">
        {/* Console Search & Filter bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-5 py-3 bg-obsidian-100/50 border-b border-border-grid">
          {/* Tabs */}
          <div className="flex flex-wrap gap-1 text-[11px] font-semibold tracking-wider">
            {(['all', 'ai', 'parser', 'vivado', 'vitis', 'compiler', 'warning', 'error'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-2.5 py-1.5 rounded transition-all cursor-pointer ${
                  activeTab === tab
                    ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {tab === 'ai' ? 'AI' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Filter logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-obsidian border border-border-grid rounded-lg pl-8 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-cyan"
              />
              <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2.5" />
            </div>

            {/* Export */}
            <button
              onClick={handleExportLogs}
              disabled={filteredOutput.length === 0}
              className="p-1.5 rounded-lg border border-border-grid text-text-secondary hover:text-neon-cyan hover:border-neon-cyan disabled:opacity-40 transition-all cursor-pointer"
              title="Export Current Logs"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Log Viewport Container (Fixed Height) */}
        <div className="relative">
          <div
            ref={terminalRef}
            onScroll={handleScroll}
            className="h-[380px] md:h-[420px] overflow-y-auto p-5 font-mono text-[12px] bg-obsidian relative select-text scroll-smooth"
          >
            {filteredOutput.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-text-muted py-10">
                {compilationStatus === 'running' ? (
                  <>
                    <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin mb-3" />
                    <p className="text-xs text-neon-cyan font-mono animate-pulse">Streaming compilation output...</p>
                    <p className="text-[10px] text-text-muted mt-1 font-mono">Waiting for toolchain response</p>
                  </>
                ) : (
                  <>
                    <Terminal className="w-8 h-8 opacity-30 mb-2" />
                    <p className="text-xs">No matching log traces found.</p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {displayedOutput.map((line) => {
                  let icon = null;
                  if (line.type === 'error') icon = <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
                  if (line.type === 'success') icon = <CheckCircle2 className="w-3.5 h-3.5 text-neon-emerald" />;
                  if (line.type === 'warning') icon = <AlertTriangle className="w-3.5 h-3.5 text-neon-amber" />;

                  return (
                    <div
                      key={line.id}
                      className={`flex items-start gap-3 py-0.5 ${getLineStyles(line.type)} animate-fade-in`}
                    >
                      <span className="text-text-muted/50 select-none shrink-0 text-[10px]">
                        [{formatTime(line.timestamp)}]
                      </span>
                      {icon && <span className="shrink-0 mt-0.5">{icon}</span>}
                      <span className="flex-1 whitespace-pre-wrap">{line.content}</span>
                    </div>
                  );
                })}

                {compilationStatus === 'running' && (
                  <div className="flex items-center gap-3 text-neon-cyan py-1">
                    <div className="w-2 h-4 bg-neon-cyan animate-pulse rounded-sm" />
                    <span className="animate-pulse text-[12px]">Running target synthesis toolchain...</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Floating Badges & Scroll-To-Bottom Overlay */}
          {(!isAtBottom || !autoScrollEnabled) && (
            <div className="absolute bottom-4 right-6 z-20 flex items-center gap-2 pointer-events-auto">
              {unreadCount > 0 && (
                <button
                  onClick={() => scrollToBottom(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-neon-cyan text-obsidian font-bold text-xs rounded-full shadow-neon-cyan hover:brightness-110 transition-all transform hover:scale-105 cursor-pointer animate-bounce"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                  <span>{unreadCount} New {unreadCount === 1 ? 'Log' : 'Logs'}</span>
                </button>
              )}
              <button
                onClick={() => scrollToBottom(true)}
                className="p-2 bg-obsidian-200/90 border border-border-grid hover:border-neon-cyan text-text-primary hover:text-neon-cyan rounded-full shadow-xl backdrop-blur-md transition-all cursor-pointer group"
                title="Scroll to latest log"
              >
                <ChevronDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
              </button>
            </div>
          )}
        </div>

        {/* Status Bar / Auto-Scroll Indicator */}
        <div className="flex items-center justify-between px-5 py-2 bg-obsidian-100/70 border-t border-border-grid text-[11px] font-mono text-text-muted select-none">
          <div className="flex items-center gap-2">
            {autoScrollEnabled && isAtBottom ? (
              <span className="flex items-center gap-1.5 text-neon-emerald font-medium">
                <span className="w-2 h-2 rounded-full bg-neon-emerald animate-pulse" />
                🟢 Live • Auto-scroll ON
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-neon-amber font-medium">
                <Pause className="w-3 h-3 text-neon-amber" />
                ⏸ Viewing Previous Logs • Auto-scroll Paused
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 text-[10px]">
            <span>Showing {displayedOutput.length} of {filteredOutput.length} lines</span>
            {searchQuery && (
              <span className="text-neon-cyan font-semibold">Filtered by: "{searchQuery}"</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
