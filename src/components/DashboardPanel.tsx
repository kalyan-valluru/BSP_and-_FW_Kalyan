import { useState, useRef, useEffect, memo, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Lock, Unlock, Zap, Activity, Cpu, Clock3, Layers, Box,
  GitBranch, ChevronDown, ChevronRight, Check,
  PanelLeftClose, PanelLeftOpen, Bot, Sparkles
} from 'lucide-react';
import type { PlatformPreset, HardwarePeripheral } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { resolveUniversalHardwareMetadata } from '../utils/hardwareMetadataResolver';
import { HardwareConnectModal } from './HardwareConnectModal';
import { Wifi } from 'lucide-react';

export type Step = 'ingestion' | 'validation' | 'synthesis' | 'terminal' | 'conclusion' | 'chipgenie';

interface StepDef {
  id: Step;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface DashboardPanelProps {
  lockStatus: 'unlocked' | 'frozen';
  peripheralCount: number;
  clockNetCount: number;
  compilationStatus: 'idle' | 'running' | 'error' | 'success';
  activePreset?: PlatformPreset | null;
  peripherals: HardwarePeripheral[];
  currentStep: Step;
  steps: StepDef[];
  isStepCompleted: (stepId: Step) => boolean;
  canNavigateToStep: (stepId: Step, index: number) => boolean;
  onStepChange: (step: Step) => void;
  isOpen: boolean;
  onToggle: () => void;
  onOpenAiAssistant?: () => void;
  hasUnreadAiMessage?: boolean;
  isParsing?: boolean;
  ingestionStatus?: 'IDLE' | 'PARSING' | 'COMPLETED' | 'REQUIRES_REVIEW' | 'FAILED';
  processorName?: string;
  boardName?: string;
  architecture?: string;
}

const logoColors: Record<string, { primary: string; secondary: string }> = {
  xilinx:  { primary: 'text-red-400',   secondary: 'bg-red-500/15'   },
  ti:      { primary: 'text-red-400',   secondary: 'bg-red-400/15'   },
  st:      { primary: 'text-blue-400',  secondary: 'bg-blue-500/15'  },
  nvidia:  { primary: 'text-green-400', secondary: 'bg-green-500/15' },
  samsung: { primary: 'text-blue-400',  secondary: 'bg-blue-400/15'  },
  nxp:     { primary: 'text-amber-400', secondary: 'bg-amber-500/15' },
};

const stepColors = {
  border: ['border-neon-cyan', 'border-blue-400', 'border-purple-400', 'border-yellow-400', 'border-neon-emerald', 'border-neon-cyan'],
  text:   ['text-neon-cyan',   'text-blue-400',   'text-purple-400',   'text-yellow-400',   'text-neon-emerald', 'text-neon-cyan'],
  bg:     ['bg-neon-cyan/10',  'bg-blue-400/10',  'bg-purple-400/10',  'bg-yellow-400/10',  'bg-neon-emerald/10', 'bg-neon-cyan/10'],
  icon:   ['bg-neon-cyan/20',  'bg-blue-400/20',  'bg-purple-400/20',  'bg-yellow-400/20',  'bg-neon-emerald/20', 'bg-neon-cyan/20'],
};

// ── ChipGenie Responsive IDE-Style AI Assistant Card ──
interface AiAssistantCardProps {
  isCollapsed: boolean;
  onOpen: () => void;
  hasUnread?: boolean;
}

function ResponsiveAiAssistantCard({ isCollapsed, onOpen, hasUnread }: AiAssistantCardProps) {
  return (
    <div className="relative group">
      <motion.button
        onClick={onOpen}
        aria-label="ChipGenie - AI Embedded Engineering Assistant"
        layout
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className={`w-full flex items-center justify-between rounded-xl bg-gradient-to-r from-neon-cyan/15 to-neon-emerald/10 border border-neon-cyan/40 text-text-primary hover:border-neon-cyan hover:bg-neon-cyan/25 transition-colors cursor-pointer shadow-lg shadow-neon-cyan/5 focus:outline-none focus:ring-2 focus:ring-neon-cyan/50 select-none ${
          isCollapsed ? 'p-2.5 justify-center' : 'px-3.5 py-3'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0 relative">
          <motion.div
            layout
            className="w-8 h-8 rounded-lg bg-neon-cyan/20 border border-neon-cyan/40 flex items-center justify-center text-neon-cyan shrink-0 group-hover:scale-105 transition-transform relative"
          >
            <Bot className="w-4 h-4 animate-pulse" />
            {hasUnread && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-neon-cyan rounded-full ring-2 ring-obsidian animate-ping" />
            )}
          </motion.div>

          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -5 }}
              transition={{ duration: 0.15 }}
              className="text-left min-w-0 flex-1 overflow-hidden"
            >
              <div className="flex items-center gap-1.5">
                <p className="text-[12px] font-bold text-text-primary group-hover:text-neon-cyan transition-colors truncate">
                  🤖 ChipGenie
                </p>
                <Sparkles className="w-3 h-3 text-neon-cyan shrink-0" />
              </div>
              <p className="text-[10px] text-text-muted font-mono truncate">AI Embedded Engineering Assistant</p>
            </motion.div>
          )}
        </div>
      </motion.button>

      {/* VS Code Activity Bar style Tooltip for Collapsed Sidebar */}
      {isCollapsed && (
        <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="bg-obsidian border border-neon-cyan/50 text-text-primary px-3 py-2 rounded-xl shadow-2xl backdrop-blur-md whitespace-nowrap space-y-0.5">
            <div className="flex items-center gap-1.5 font-bold text-xs text-neon-cyan">
              <Bot className="w-3.5 h-3.5" /> ChipGenie
            </div>
            <p className="text-[10px] text-text-muted font-mono">AI Embedded Engineering Assistant</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Wrapped in memo to prevent re-renders when parent state changes ──
export const DashboardPanel = memo(function DashboardPanel({
  lockStatus, peripheralCount, clockNetCount, compilationStatus,
  activePreset, peripherals, currentStep, steps,
  isStepCompleted, canNavigateToStep, onStepChange,
  isOpen, onToggle, onOpenAiAssistant, hasUnreadAiMessage = false,
  isParsing = false, ingestionStatus = 'IDLE',
  processorName, boardName, architecture,
}: DashboardPanelProps) {
  const { theme } = useTheme();
  const hwMeta = useMemo(() => {
    return resolveUniversalHardwareMetadata({
      preset: activePreset,
      peripherals,
      processorName,
      boardName,
      architecture,
    });
  }, [activePreset, peripherals, processorName, boardName, architecture]);

  const logoStyle = activePreset ? logoColors[activePreset.logoType] || logoColors.xilinx : logoColors[hwMeta.vendor.value.toLowerCase().includes('ti') ? 'ti' : hwMeta.vendor.value.toLowerCase().includes('st') ? 'st' : hwMeta.vendor.value.toLowerCase().includes('nvidia') ? 'nvidia' : hwMeta.vendor.value.toLowerCase().includes('nxp') ? 'nxp' : 'xilinx'];
  const [specsOpen, setSpecsOpen] = useState(false);
  const [showHardwareConnect, setShowHardwareConnect] = useState(false);
  const [animState, setAnimState] = useState<'open' | 'closing' | 'closed' | 'opening'>('open');
  const prevOpen = useRef(isOpen);

  // DRAGGABLE RESIZE STATE (Min: 280px, Default: 340px, Max: 500px)
  const MIN_WIDTH = 280;
  const DEFAULT_WIDTH = 340;
  const MAX_WIDTH = 500;

  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('sidebar_width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
          return parsed;
        }
      }
    } catch {}
    return DEFAULT_WIDTH;
  });

  const [isResizing, setIsResizing] = useState(false);

  // Handle Dragging / Resizing
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.min(Math.max(e.clientX, MIN_WIDTH), MAX_WIDTH);
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      try {
        localStorage.setItem('sidebar_width', sidebarWidth.toString());
      } catch {}
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, sidebarWidth]);

  // Drive animation state machine
  useEffect(() => {
    if (prevOpen.current === isOpen) return;
    prevOpen.current = isOpen;

    if (isOpen) {
      setAnimState('opening');
      const t = setTimeout(() => setAnimState('open'), 660);
      return () => clearTimeout(t);
    } else {
      setAnimState('closing');
      const t = setTimeout(() => setAnimState('closed'), 510);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);
  const hasData = activePreset || peripherals.length > 0;

  // ── Collapsed Icon Rail JSX ──────────
  const collapsedRailJSX = (
    <div className="relative w-20 h-full bg-obsidian border-r border-grid flex flex-col items-center overflow-hidden select-none">
      {/* Animated scan line */}
      <div
        className="absolute left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-neon-cyan/70 to-transparent pointer-events-none"
        style={{ animation: 'rail-scan 3s linear infinite' }}
      />

      {/* Top glow line */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-neon-cyan/50 to-transparent" />

      {/* STICKY HEADER (COLLAPSED RAIL) */}
      <div className="w-full px-2 pt-4 pb-3 border-b border-grid shrink-0 bg-obsidian/90 backdrop-blur-md sticky top-0 z-20">
        <div className="w-full rounded-xl border border-neon-cyan/20 bg-obsidian-100/60 flex items-center justify-center p-2 shadow-sm" style={{ boxShadow: '0 0 12px rgba(0,245,255,0.06)' }}>
          <img
            src={theme === 'dark' ? '/tcs-logo-dark.png' : '/tcs-logo-light.png'}
            alt="TCS"
            className="w-full h-auto object-contain max-h-10"
          />
        </div>
        <button
          onClick={onToggle}
          className="ring-pulse mt-3 w-full h-9 rounded-xl bg-neon-cyan/10 border border-neon-cyan/40 flex items-center justify-center text-neon-cyan hover:bg-neon-cyan/20 hover:scale-105 transition-all duration-200 shrink-0 cursor-pointer"
          title="Open Sidebar"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
      </div>

      {/* SCROLLABLE RAIL CONTENT */}
      <div className="flex-1 w-full overflow-y-auto px-2 py-3 flex flex-col items-center">
        {/* Step icons */}
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const completed = isStepCompleted(step.id);
          const canNav = canNavigateToStep(step.id, idx);
          const isChipGenie = step.id === 'chipgenie';

          return (
            <div key={step.id} className="relative group mb-1.5 w-full">
              <button
                onClick={() => isChipGenie ? onOpenAiAssistant?.() : (canNav && onStepChange(step.id))}
                disabled={!isChipGenie && !canNav}
                className={`w-full h-9 rounded-xl flex items-center justify-center transition-all duration-200 border relative ${
                  isActive || (isChipGenie && hasUnreadAiMessage)
                    ? `${stepColors.icon[idx]} ${stepColors.border[idx]} ${stepColors.text[idx]}`
                    : completed
                    ? 'bg-neon-emerald/10 border-neon-emerald/30 text-neon-emerald'
                    : canNav || isChipGenie
                    ? 'bg-obsidian-100 border-border-grid text-text-muted hover:border-neon-cyan/40 hover:text-neon-cyan'
                    : 'bg-obsidian-100 border-border-grid text-text-muted opacity-30 cursor-not-allowed'
                }`}
                title={step.label}
              >
                {completed && !isActive && !isChipGenie
                  ? <Check className="w-3.5 h-3.5" />
                  : <Icon className="w-3.5 h-3.5" />}

                {isChipGenie && hasUnreadAiMessage && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-neon-cyan animate-pulse" />
                )}
              </button>

              {/* Tooltip on hover */}
              <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <div className="bg-obsidian border border-neon-cyan/40 text-neon-cyan text-[11px] font-medium font-mono px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
                  {step.label}
                  {isActive && <span className="ml-1 text-[9px] opacity-60">← active</span>}
                </div>
              </div>
            </div>
          );
        })}

        {/* Bottom status dot + ChipGenie button */}
        <div className="mt-auto pt-4 pb-2 flex flex-col items-center gap-2 w-full">
          <div className="w-px h-6 bg-gradient-to-b from-border-grid to-transparent" />
          <div className={`w-2.5 h-2.5 rounded-full ring-2 ring-offset-1 ring-offset-obsidian mb-1 ${
            compilationStatus === 'success' ? 'bg-neon-emerald ring-neon-emerald/40' :
            compilationStatus === 'running' ? 'bg-neon-cyan ring-neon-cyan/40 animate-pulse' :
            compilationStatus === 'error'   ? 'bg-red-400 ring-red-400/40' :
            'bg-text-muted ring-text-muted/20'
          }`} title={`Build: ${compilationStatus}`} />
          {onOpenAiAssistant && (
            <ResponsiveAiAssistantCard isCollapsed={true} onOpen={onOpenAiAssistant} hasUnread={hasUnreadAiMessage} />
          )}
        </div>
      </div>
    </div>
  );

  // ── Full Sidebar Panel JSX (With Draggable Handle) ───────────
  const fullPanelJSX = (
    <aside
      style={{ width: `${sidebarWidth}px` }}
      className="relative bg-obsidian border-r border-grid flex flex-col h-full overflow-hidden shrink-0 select-none transition-all duration-75"
    >
      {/* DRAGGABLE RESIZE HANDLE ON RIGHT EDGE */}
      <div
        onMouseDown={handleMouseDown}
        title="Drag to resize sidebar width"
        className={`absolute top-0 right-0 w-1.5 h-full cursor-col-resize z-50 hover:bg-neon-cyan/50 transition-colors ${
          isResizing ? 'bg-neon-cyan shadow-[0_0_10px_#00f5d4]' : 'bg-transparent'
        }`}
      />

      {/* 1. STICKY / FIXED HEADER */}
      <div className="relative px-5 py-4 border-b border-grid shrink-0 bg-obsidian/90 backdrop-blur-md sticky top-0 z-30 shadow-md">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-neon-cyan/60 to-transparent" />
        <div className="flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <img
              src={theme === 'dark' ? '/tcs-logo-dark.png' : '/tcs-logo-light.png'}
              alt="TCS Logo"
              className="h-8 object-contain"
            />
            <p className="text-[10px] text-text-muted mt-1 font-mono tracking-wider truncate">BSP/Firmware Engineering Suite</p>
          </div>

          <button
            onClick={onToggle}
            className="group relative w-9 h-9 rounded-xl bg-obsidian-100 border border-border-grid flex items-center justify-center text-text-muted hover:border-neon-cyan/50 hover:text-neon-cyan hover:bg-neon-cyan/10 transition-all duration-200 cursor-pointer overflow-hidden shrink-0"
            title="Collapse Sidebar"
          >
            <span className="absolute inset-0 bg-neon-cyan/0 group-hover:bg-neon-cyan/5 transition-colors duration-300 rounded-xl" />
            <PanelLeftClose className="w-4 h-4 relative z-10 group-hover:scale-110 transition-transform duration-200" />
          </button>
        </div>
      </div>

      {/* 2. SCROLLABLE CONTENT AREA */}
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        {/* Workflow Steps Navigation */}
        <div className="border-b border-grid shrink-0">
          <div className="px-4 pt-3 pb-1 flex items-center gap-2">
            <div className="w-1 h-3 rounded-full bg-neon-cyan" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Workflow Steps</span>
          </div>

          <nav className="px-2 pb-3 space-y-0.5">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const completed = isStepCompleted(step.id);
              const canNav = canNavigateToStep(step.id, index);
              const isPast = index < currentStepIndex;
              const isChipGenie = step.id === 'chipgenie';

              const isFpga = activePreset?.vendor?.toLowerCase().includes('xilinx') ||
                activePreset?.vendor?.toLowerCase().includes('amd') ||
                activePreset?.name?.toLowerCase().includes('zynq') ||
                activePreset?.name?.toLowerCase().includes('microblaze');
              const isLinuxTarget = !isFpga;

              const displayLabel = (step.id === 'terminal' && isLinuxTarget) ? 'Linux Compilation' : step.label;

              const statusText = (() => {
                if (isChipGenie) return 'AI Engineering Assistant';
                if (step.id === 'terminal') {
                  if (compilationStatus === 'running') return '⚡ Compiling...';
                  if (compilationStatus === 'error') return '✗ Failed';
                  if (compilationStatus === 'success') return '✓ Completed';
                  if (completed) return '✓ Completed';
                }
                if (step.id === 'ingestion') {
                  if (ingestionStatus === 'PARSING') return '⚡ Running...';
                  if (ingestionStatus === 'REQUIRES_REVIEW') return '⚠ Requires Review';
                  if (ingestionStatus === 'FAILED') return '✗ Failed';
                  if (ingestionStatus === 'COMPLETED') return '✓ Completed';
                  if (completed) return '✓ Completed';
                  if (isActive) return 'Active';
                  return '○ Pending';
                }
                if (isActive) return 'Active';
                if (completed) return '✓ Completed';
                if (isPast) return '○ Pending';
                return '○ Pending';
              })();

              const isFailed = step.id === 'terminal' && compilationStatus === 'error';
              const isSuccess = step.id === 'terminal' && compilationStatus === 'success';

              return (
                <button
                  key={step.id}
                  onClick={() => isChipGenie ? onOpenAiAssistant?.() : (canNav && onStepChange(step.id))}
                  disabled={!isChipGenie && !canNav}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 border-l-2 group ${
                    isActive
                      ? `${stepColors.border[index]} ${stepColors.bg[index]}`
                      : 'border-transparent hover:border-border-grid hover:bg-obsidian-100/50'
                  } ${!canNav && !isChipGenie ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors relative ${
                    isFailed
                      ? 'bg-red-500/20 text-red-400'
                      : (isSuccess || completed) && !isActive && !isChipGenie
                      ? 'bg-neon-emerald/15'
                      : isActive
                      ? stepColors.icon[index]
                      : 'bg-obsidian-200'
                  }`}>
                    {(isSuccess || completed) && !isActive && !isChipGenie
                      ? <Check className="w-3.5 h-3.5 text-neon-emerald" />
                      : <Icon className={`w-3.5 h-3.5 ${isFailed ? 'text-red-400' : isActive ? stepColors.text[index] : 'text-text-muted'}`} />}
                    {isChipGenie && hasUnreadAiMessage && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-neon-cyan animate-pulse" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-[12px] font-semibold leading-tight truncate ${
                      isFailed ? 'text-red-400' : isActive ? stepColors.text[index] : completed ? 'text-text-primary' : 'text-text-secondary'
                    }`}>
                      {displayLabel}
                    </p>
                    <p className={`text-[10px] font-mono mt-0.5 leading-none ${
                      isFailed ? 'text-red-400 font-bold' : (isSuccess || completed) ? 'text-neon-emerald font-bold' : 'text-text-muted'
                    }`}>
                      {statusText}
                    </p>
                  </div>

                  {isActive && <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${stepColors.text[index]}`} />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Platform Card driven by Universal Hardware Metadata */}
        {hasData ? (
          <div className="px-4 pt-3 pb-3 border-b border-grid shrink-0">
            <div className={`rounded-xl border p-3 ${logoStyle ? 'border-current/20' : 'border-neon-cyan/25'} bg-gradient-to-br from-obsidian-100/60 to-obsidian-200/20`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg ${logoStyle?.secondary || 'bg-neon-cyan/15'} flex items-center justify-center shrink-0`}>
                  <Cpu className={`w-4.5 h-4.5 ${logoStyle?.primary || 'text-neon-cyan'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-text-primary truncate">
                    {hwMeta.processor.value}
                  </p>
                  <p className="text-[11px] text-text-muted truncate mt-0.5">
                    {hwMeta.vendor.value}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="bg-obsidian/60 rounded-lg p-2 min-w-0">
                  <p className="text-[9px] text-text-muted uppercase tracking-wider">CPU Core</p>
                  <p className="text-[11px] text-neon-cyan font-bold font-mono mt-0.5 break-words">
                    {hwMeta.cpuCore.value}
                  </p>
                </div>
                <div className="bg-obsidian/60 rounded-lg p-2 min-w-0">
                  <p className="text-[9px] text-text-muted uppercase tracking-wider">CPU Cores</p>
                  <p className="text-[11px] font-bold font-mono mt-0.5 break-words text-neon-cyan">
                    {hwMeta.cpuCoreCount.value}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowHardwareConnect(true)}
                className="w-full mt-3 py-2 bg-gradient-to-r from-neon-cyan/20 to-blue-500/20 hover:from-neon-cyan/30 hover:to-blue-500/30 border border-neon-cyan/40 hover:border-neon-cyan text-neon-cyan font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md group"
              >
                <Wifi className="w-3.5 h-3.5 group-hover:animate-pulse" />
                <span>Connect with Hardware</span>
              </button>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="bg-obsidian/60 rounded-lg p-2 min-w-0">
                  <p className="text-[9px] text-text-muted uppercase tracking-wider">Architecture</p>
                  <p className="text-[11px] text-neon-cyan font-bold font-mono mt-0.5 break-words">
                    {hwMeta.architecture.value}
                  </p>
                </div>
                <div className="bg-obsidian/60 rounded-lg p-2 min-w-0">
                  <p className="text-[9px] text-text-muted uppercase tracking-wider">Provenance</p>
                  <p className="text-[11px] font-bold font-mono mt-0.5 break-words text-neon-emerald">
                    {hwMeta.cpuCore.provenance}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-4 py-6 border-b border-grid text-center shrink-0">
            <div className="w-10 h-10 rounded-xl bg-obsidian-100 border border-border-grid flex items-center justify-center mx-auto mb-2">
              <Box className="w-5 h-5 text-text-muted/40 animate-pulse" />
            </div>
            <p className="text-[11px] text-text-muted">
              {isParsing ? 'Parsing design file & constructing HKL…' : 'Waiting for hardware ingestion…'}
            </p>
          </div>
        )}

        {/* Hardware Specs — Collapsible */}
        {hasData && (
          <>
            <button
              onClick={() => setSpecsOpen((v: boolean) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 border-b border-grid hover:bg-obsidian-100/40 transition-colors group shrink-0 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <GitBranch className="w-3.5 h-3.5 text-text-muted group-hover:text-neon-cyan transition-colors" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted group-hover:text-text-secondary transition-colors">
                  Hardware Statistics
                </span>
              </div>
              {specsOpen
                ? <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
                : <ChevronRight className="w-3.5 h-3.5 text-text-muted" />}
            </button>

            {specsOpen && (
              <div className="px-4 py-3 border-b border-grid space-y-1.5 shrink-0">
                {[
                  { label: 'Peripherals', value: `${peripheralCount} Blocks` },
                  { label: 'Memory Regions', value: '4 Mapped' },
                  { label: 'Clock Nets', value: `${clockNetCount} Domains` },
                  { label: 'Interrupts', value: `${peripherals.filter(p => p.interruptNumber).length} IRQ lines` },
                  { label: 'Drivers Bound', value: `${peripherals.filter(p => p.driverName && p.driverName !== 'N/A').length} Matches` },
                  { label: 'Validation Rules', value: '11 Checks Active' },
                  { label: 'Knowledge Sources', value: 'ChromaDB / SVD / Specs' },
                  { label: 'Simulation Targets', value: 'QEMU & Renode' },
                  { label: 'Confidence Score', value: '98.5%', accent: true },
                ].map(({ label, value, accent }: any) => (
                  <div key={label} className="flex items-center justify-between py-1 border-b border-border-grid/30 last:border-0 gap-2">
                    <span className="text-[11px] text-text-muted shrink-0">{label}</span>
                    <span className={`text-[11px] font-mono font-semibold text-right break-all ${
                      accent ? 'text-neon-emerald' : 'text-text-secondary'
                    }`}>{value}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* KPI Metrics */}
        <div className="px-4 py-3 border-b border-grid shrink-0">
          <div className="flex items-center gap-2 mb-2.5">
            <Zap className="w-3.5 h-3.5 text-neon-amber" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Live Metrics</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-obsidian-100/50 rounded-xl border border-border-grid p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Layers className="w-3 h-3 text-neon-cyan" />
                <span className="text-[9px] text-text-muted uppercase tracking-wide">Peripherals</span>
              </div>
              <p className="text-2xl font-extrabold font-mono text-neon-cyan leading-none">{peripheralCount}</p>
            </div>
            <div className="bg-obsidian-100/50 rounded-xl border border-border-grid p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Clock3 className="w-3 h-3 text-neon-emerald" />
                <span className="text-[9px] text-text-muted uppercase tracking-wide">Clock Nets</span>
              </div>
              <p className="text-2xl font-extrabold font-mono text-neon-emerald leading-none">{clockNetCount}</p>
            </div>
          </div>
        </div>

        {/* Schema Lock */}
        <div className="px-4 py-3 border-b border-grid shrink-0">
          <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${
            lockStatus === 'unlocked' ? 'bg-neon-amber/5 border-neon-amber/30' : 'bg-neon-emerald/5 border-neon-emerald/30'
          }`}>
            <span className="text-[11px] text-text-secondary font-medium">Schema Lock</span>
            <div className={`flex items-center gap-1.5 text-xs font-mono font-bold ${
              lockStatus === 'unlocked' ? 'text-neon-amber' : 'text-neon-emerald'
            }`}>
              {lockStatus === 'unlocked'
                ? <><Unlock className="w-3.5 h-3.5 animate-pulse" /> Editable</>
                : <><Lock className="w-3.5 h-3.5" /> Frozen</>}
            </div>
          </div>
        </div>

        {/* Build Status */}
        <div className="px-4 py-3 shrink-0">
          <div className="flex items-center gap-2 mb-2.5">
            <Activity className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Toolchain Status</span>
          </div>
          <div className="bg-obsidian-100/50 rounded-xl border border-border-grid p-3">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs text-text-muted">Build Output</span>
              <div className={`flex items-center gap-1.5 text-xs font-mono font-bold ${
                compilationStatus === 'running' ? 'text-neon-cyan' :
                compilationStatus === 'error'   ? 'text-red-400' :
                compilationStatus === 'success' ? 'text-neon-emerald' : 'text-text-muted'
              }`}>
                {compilationStatus === 'running' && <div className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse" />}
                {compilationStatus.toUpperCase()}
              </div>
            </div>
            <div className="h-1 bg-obsidian-200 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${
                compilationStatus === 'running' ? 'bg-neon-cyan w-3/4 animate-pulse' :
                compilationStatus === 'error'   ? 'bg-red-400 w-full' :
                compilationStatus === 'success' ? 'bg-neon-emerald w-full' : 'w-0'
              }`} />
            </div>
            {compilationStatus === 'success' && <p className="text-[10px] text-neon-emerald font-mono mt-2">✓ firmware.elf linked</p>}
            {compilationStatus === 'error'   && <p className="text-[10px] text-red-400 font-mono mt-2">✗ Compiler error</p>}
          </div>
        </div>

        {/* Footer + ChipGenie Component */}
        <div className="mt-auto px-4 py-3 bg-obsidian-50/50 border-t border-grid shrink-0 space-y-2">
          {onOpenAiAssistant && (
            <ResponsiveAiAssistantCard isCollapsed={false} onOpen={onOpenAiAssistant} hasUnread={hasUnreadAiMessage} />
          )}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] font-mono text-text-muted">v2.5.0</span>
            <span className="text-[10px] font-mono text-neon-cyan/60">Build 2026.06</span>
          </div>
        </div>
      </div>

    </aside>
  );

  // ── Render with animation wrapper ────────
  if (animState === 'closed') {
    return collapsedRailJSX;
  }

  if (animState === 'opening') {
    return (
      <div className="sidebar-unfold" style={{ transformOrigin: 'left center' }}>
        {fullPanelJSX}
      </div>
    );
  }

  if (animState === 'closing') {
    return (
      <div className="sidebar-fold" style={{ transformOrigin: 'left center' }}>
        {fullPanelJSX}
      </div>
    );
  }

  return (
    <>
      {fullPanelJSX}
      <HardwareConnectModal
        isOpen={showHardwareConnect}
        onClose={() => setShowHardwareConnect(false)}
        selectedBoard={hwMeta.processor.value || 'Raspberry Pi 4 / 5'}
      />
    </>
  );
});
