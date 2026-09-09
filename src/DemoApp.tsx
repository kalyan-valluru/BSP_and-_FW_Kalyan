import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { DashboardPanel } from './components/DashboardPanel';
import { IngestionView } from './components/IngestionView';
import { ValidationGrid } from './components/ValidationGrid';
import { CodeSynthesis } from './components/CodeSynthesis';
import { TerminalStream } from './components/TerminalStream';
import { BlockDiagram } from './components/BlockDiagram';
import { MapViewer } from './components/MapViewer';
import { SimulationStatus } from './components/SimulationStatus';
import { KnowledgeGraph } from './components/KnowledgeGraph';
import { Modal } from './components/Modal';
import { AiAssistantDrawer } from './components/AiAssistantDrawer';
import { ChevronLeft, ChevronRight, Cpu, Cpu as CpuIcon, Layers, FileCode, Terminal, Presentation, Download, FileText, GitBranch, MemoryStick, Zap, Network, Check } from 'lucide-react';
import type { HardwarePeripheral, TerminalLine, PlatformPreset } from './types';
import { ConclusionView } from './components/ConclusionView';
import { resolveVendorDefaults } from './utils/vendorPeripheralDefaults';
import { parseFile } from './utils/fileParser';
import { ThemeToggle } from './components/ThemeToggle';
import { validatePeripheral } from './utils/addrValidation';
import { BenchmarkDashboard } from './components/BenchmarkDashboard';
import { UniversalValidationView, UniversalValidationReport } from './components/UniversalValidationView';
import { resolveBoardCapabilities } from './utils/boardCapability';

import { Bot } from 'lucide-react';

type Step = 'ingestion' | 'validation' | 'synthesis' | 'terminal' | 'conclusion' | 'chipgenie';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const steps: { id: Step; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'ingestion', label: 'Hardware Ingestion', icon: Cpu },
  { id: 'validation', label: 'Peripheral Config', icon: Layers },
  { id: 'synthesis', label: 'Code Generation', icon: FileCode },
  { id: 'terminal', label: 'Compilation', icon: Terminal },
  { id: 'conclusion', label: 'Conclusion', icon: Presentation },
  { id: 'chipgenie', label: '🤖 ChipGenie', icon: Bot },
];

export function DemoApp() {
  const [currentStep, setCurrentStep] = useState<Step>('ingestion');
  const [lockStatus, setLockStatus] = useState<'unlocked' | 'frozen'>('unlocked');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [selectedFileNames, setSelectedFileNames] = useState<string[]>([]);
  const [parsedPeripheralsCache, setParsedPeripheralsCache] = useState<Record<string, HardwarePeripheral[]>>({});
  const [activePreset, setActivePreset] = useState<PlatformPreset | null>(null);
  const [peripherals, setPeripherals] = useState<HardwarePeripheral[]>([]);
  const [terminalOutput, setTerminalOutput] = useState<TerminalLine[]>([]);
  const [compilationStatus, setCompilationStatus] = useState<'idle' | 'running' | 'error' | 'success'>('idle');
  const [parsingFiles, setParsingFiles] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  type ModalView = 'block-diagram' | 'memory-map' | 'irq-map' | 'clock-tree' | 'peripheral-list' | null;
  const [activeModal, setActiveModal] = useState<ModalView>(null);
  
  const [currentBareMetalCode, setCurrentBareMetalCode] = useState<string>('');
  const [currentDeviceTreeCode, setCurrentDeviceTreeCode] = useState<string>('');
  const [generatedBspFiles, setGeneratedBspFiles] = useState<{filename: string; code: string}[]>([]);
  const [compiledElfUrl, setCompiledElfUrl] = useState<string | null>(null);
  const [triggerCompileCount, setTriggerCompileCount] = useState(0);
  const [customProcessorName, setCustomProcessorName] = useState<string>('ARM Core');
  // Hardware metadata from parsed files / presets
  const [hwBoardName,   setHwBoardName]   = useState<string>('N/A');
  const [hwFpgaDevice,  setHwFpgaDevice]  = useState<string>('N/A');
  const [hwMemorySize,  setHwMemorySize]  = useState<string>('N/A');
  const [hwFlashType,   setHwFlashType]   = useState<string>('N/A');
  const [hwArchitecture,setHwArchitecture]= useState<string>('Unknown');
  const [hwVendor,      setHwVendor]      = useState<string>('Unknown');
  const [validationReport, setValidationReport] = useState<any>(null);
  const [universalReport, setUniversalReport] = useState<UniversalValidationReport | null>(null);
  const [universalLoading, setUniversalLoading] = useState<boolean>(false);
  const [decisionLog, setDecisionLog] = useState<any[]>([]);
  const [confidenceScores, setConfidenceScores] = useState<any>(null);
  const [ingestionStatus, setIngestionStatus] = useState<'IDLE' | 'PARSING' | 'COMPLETED' | 'REQUIRES_REVIEW' | 'FAILED'>('IDLE');
  const [understandingStatus, setUnderstandingStatus] = useState<'VERIFIED' | 'UNVERIFIED' | 'CONFLICT'>('UNVERIFIED');
  const [hklStatus, setHklStatus] = useState<'READY' | 'NOT_READY'>('NOT_READY');
  const [showBenchmark, setShowBenchmark] = useState(false);
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [hasUnreadAiMessage, setHasUnreadAiMessage] = useState(false);
  const [engineeringRequirement, setEngineeringRequirement] = useState('');
  const [requirementPlan, setRequirementPlan] = useState<any>(null);
  const [resolvingRequirement, setResolvingRequirement] = useState(false);

  const toggleAiAssistant = () => {
    setShowAiAssistant(prev => {
      const next = !prev;
      if (next) setHasUnreadAiMessage(false);
      return next;
    });
  };
  type Step2State = 
    | 'SCHEMA_UNSYNTHESIZED'
    | 'SCHEMA_SYNTHESIZING'
    | 'HARDWARE_SCHEMA_LOCKED'
    | 'TARGET_FLOW_SELECTED'
    | 'AUTONOMOUS_EXECUTION'
    | 'MANUAL_ENGINEERING';

  const [targetFlow, setTargetFlow] = useState<'bare_metal' | 'linux' | 'both' | ''>('');
  const [step2State, setStep2State] = useState<Step2State>('SCHEMA_UNSYNTHESIZED');
  const isHardwareSynthesized = step2State !== 'SCHEMA_UNSYNTHESIZED';




  const [pipelineSessionId] = useState(() => `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);
  const [reviewQueue, setReviewQueue] = useState<any[]>([]);

  const handleRunUniversalValidation = useCallback(async () => {
    setUniversalLoading(true);
    try {
      const res = await fetch('/api/validation/universal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: pipelineSessionId,
          platformId: activePreset?.id || 'custom-hardware',
          platformName: activePreset ? activePreset.name : customProcessorName,
          vendor: activePreset ? activePreset.vendor : (hwVendor !== 'Unknown' ? hwVendor : 'Generic'),
          architecture: activePreset ? activePreset.architecture : hwArchitecture,
          targetFlow: activePreset?.supportedFlow ? (activePreset.supportedFlow.toLowerCase() === 'both' ? 'both' : activePreset.supportedFlow.toLowerCase()) : targetFlow,
          peripherals
        }),
      });
      const data = await res.json();
      if (data.success && data.report) {
        setUniversalReport(data.report);
      }
    } catch (err) {
      console.error('Failed to execute Universal Validation Engine:', err);
    } finally {
      setUniversalLoading(false);
    }
  }, [pipelineSessionId, activePreset, customProcessorName, hwArchitecture, targetFlow, peripherals]);

  // Dynamic Target Flow options per active processor & architecture capabilities
  const supportedFlowOptions = useMemo(() => {
    const procLower = (activePreset ? activePreset.name : customProcessorName || '').toLowerCase();
    const archLower = (activePreset ? activePreset.architecture : hwArchitecture || '').toLowerCase();

    // MCU-only platforms (MicroBlaze, STM32 MCU, Cortex-M, RP2040)
    if (procLower.includes('microblaze') || procLower.includes('stm32f') || procLower.includes('cortex-m') || procLower.includes('rp2040')) {
      return [{ value: 'bare_metal' as const, label: 'Bare Metal Only' }];
    }
    // Linux MPU-only platforms (Jetson, Raspberry Pi CM4, Cortex-A72 Linux)
    if (procLower.includes('jetson') || procLower.includes('raspberry pi') || procLower.includes('cm4') || procLower.includes('orin')) {
      return [{ value: 'linux' as const, label: 'Linux Only' }];
    }
    // Dual / Multi-OS heterogeneous SoCs (Zynq, Versal, MPSoC, STM32MP, i.MX8, Sitara)
    return [
      { value: 'linux' as const, label: 'Linux Only' },
      { value: 'bare_metal' as const, label: 'Bare Metal Only' },
      { value: 'both' as const, label: 'Both (BM & Linux)' },
    ];
  }, [activePreset, customProcessorName, hwArchitecture]);

  // Keep targetFlow in sync with active supported flow options
  useEffect(() => {
    if (supportedFlowOptions.length > 0) {
      const validValues = supportedFlowOptions.map(o => o.value);
      if (!validValues.includes(targetFlow)) {
        setTargetFlow(validValues[0]);
      }
    }
  }, [supportedFlowOptions, targetFlow]);

  // Invalidate universalReport when platform or target flow changes so validation re-runs fresh
  useEffect(() => {
    setUniversalReport(null);
  }, [activePreset, customProcessorName, hwArchitecture, targetFlow]);

  // Auto-run Universal Validation when entering Conclusion step (Step 5) if not already run
  useEffect(() => {
    if (currentStep === 'conclusion' && !universalReport && !universalLoading) {
      handleRunUniversalValidation();
    }
  }, [currentStep, universalReport, universalLoading, handleRunUniversalValidation]);

  // Ref for main scrollable content container (scroll-to-top on step change)
  const contentScrollRef = useRef<HTMLDivElement>(null);

  const uploadedInputType = useMemo(() => {
    if (uploadedFiles.length === 0) {
      return 'vivado_xpr'; // default/fallback when using preset or starting fresh
    }

    const hasXpr = uploadedFiles.some(f => f.name.toLowerCase().endsWith('.xpr'));
    if (hasXpr) return 'vivado_xpr';

    const hasXsa = uploadedFiles.some(f => f.name.toLowerCase().endsWith('.xsa'));
    if (hasXsa) return 'xsa';

    const docExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.svg', '.docx'];
    const hasDoc = uploadedFiles.some(f => {
      const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
      return docExtensions.includes(ext);
    });
    if (hasDoc) return 'circuit_doc';

    return 'spec_tree';
  }, [uploadedFiles]);

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  // ── Scroll main content to top on step change ──────────────────────────
  useEffect(() => {
    // Use requestAnimationFrame to wait for the new step's content to mount
    requestAnimationFrame(() => {
      if (contentScrollRef.current) {
        contentScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }, [currentStep]);

  // ── Batched terminal line system ─────────────────────────────────────
  // Queues lines in a ref and flushes to state in rAF batches of 12 lines.
  // This prevents thousands of individual React re-renders during log streaming.
  const lineQueueRef = useRef<TerminalLine[]>([]);
  const flushScheduledRef = useRef(false);

  const flushQueue = useCallback(() => {
    flushScheduledRef.current = false;
    if (lineQueueRef.current.length === 0) return;
    const batch = lineQueueRef.current.splice(0);
    setTerminalOutput(prev => [...prev, ...batch]);
  }, []);

  const addTerminalLine = useCallback((
    type: TerminalLine['type'],
    content: string,
    stageId?: string,
    stageStatus?: 'running' | 'completed' | 'failed'
  ) => {
    lineQueueRef.current.push({
      id: `line-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      content,
      timestamp: new Date(),
      stageId,
      stageStatus,
    });
    if (!flushScheduledRef.current) {
      flushScheduledRef.current = true;
      requestAnimationFrame(flushQueue);
    }
  }, [flushQueue]);

  // Bulk-add many lines at once (for streaming compilation logs) — single state update
  const addTerminalLines = useCallback((lines: { type: TerminalLine['type']; content: string }[]) => {
    const now = new Date();
    const newLines: TerminalLine[] = lines.map((l, i) => ({
      id: `line-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 6)}`,
      type: l.type,
      content: l.content,
      timestamp: now,
    }));
    setTerminalOutput(prev => [...prev, ...newLines]);
  }, []);

  // Handler: File Upload
  const handleFileUpload = useCallback(async (files: File[]) => {
    // Reset preset/stale hardware state on new upload session
    setActivePreset(null);
    setPeripherals([]);
    setParsedPeripheralsCache({});
    setSelectedFileNames([]);
    setValidationReport(null);
    setUniversalReport(null);
    setDecisionLog([]);
    setConfidenceScores(null);
    setHwBoardName('N/A');
    setHwFpgaDevice('N/A');
    setHwMemorySize('N/A');
    setHwFlashType('N/A');
    setHwArchitecture('Unknown');
    setHwVendor('Unknown');
    setCustomProcessorName('ARM Core');
    setEngineeringRequirement('');
    setRequirementPlan(null);

    for (const f of files) {
      console.log(`[UPLOAD] file selected`);
      console.log(`[UPLOAD] filename=${f.name}`);
      console.log(`[UPLOAD] size=${(f.size / 1024).toFixed(1)} KB`);
      console.log(`[UPLOAD] File received`);
      console.log(`[UPLOAD] Name: ${f.name}`);
      console.log(`[UPLOAD] Type: ${f.type || 'application/pdf'}`);
      console.log(`[UPLOAD] Size: ${f.size} bytes`);
      console.log(`[UPLOAD] Upload accepted`);
      console.log(`[UPLOAD] Session ID: ${pipelineSessionId}`);
      addTerminalLine('system', `[UPLOAD] File received: ${f.name} (${f.size} bytes)`);
    }

    console.log('[INGESTION] start requested');
    console.log(`[INGESTION] session created:\n${pipelineSessionId}`);
    console.log('[FRONTEND STATE] ingestion=uploading');
    setIngestionStatus('PARSING');
    console.log('[FRONTEND STATE] ingestion=running');

    console.log(`[INGESTION REQUEST]`);
    console.log(`uploadedFileNames: [${files.map(f => `"${f.name}"`).join(', ')}]`);
    console.log(`workflow: circuit_doc`);
    console.log(`targetFlow: bare_metal`);

    setUploadedFiles((prev) => [...prev, ...files]);
    addTerminalLine('system', `[SYSTEM] Ingested ${files.length} design file(s): ${files.map(f => f.name).join(', ')}`);
    addTerminalLine('info', '[INFO] DeepReader Vision Processing Engine scanning schematic pins and clock networks...');

    const fileNames = files.map((f) => f.name);
    setParsingFiles(fileNames);

    for (const file of files) {
      addTerminalLine('info', `[INFO] Parsing target hardware description file: ${file.name}`);
      try {
        console.log('[INGESTION] backend request sent');
        const result = await parseFile(file);
        console.log('[INGESTION] backend acknowledged');
        console.log('[FRONTEND PARSE_FILE_RESULT]', result);

        if (result.error) {
          addTerminalLine('error', `[ERROR] [${file.name}] ${result.error}`);
          setIngestionStatus('REQUIRES_REVIEW');
          setUnderstandingStatus('UNVERIFIED');
          setHklStatus('NOT_READY');
        } else if (result.ingestionStatus === 'COMPLETED' && result.hklStatus === 'READY') {
          setIngestionStatus('COMPLETED');
          setUnderstandingStatus(result.understandingStatus || 'VERIFIED');
          setHklStatus('READY');
          const modelTag = result.modelUsed ? ` via ${result.modelUsed}` : '';
          addTerminalLine('success', `[SUCCESS] [${file.name}] Hardware Ingestion status: COMPLETED. Extracted ${result.peripherals.length} peripheral blocks${modelTag}.`);
          addTerminalLine('info', `[INGESTION RESULT] inputType=${result.inputType || 'BOARD_IMAGE'}, boardDetected=${result.boardDetected ?? true}, understandingStatus=${result.understandingStatus || 'VERIFIED'}, hklStatus=${result.hklStatus || 'READY'}, verificationStatus=${result.verificationStatus || 'DETERMINISTIC_VERIFIED'}`);
          
          // Extract hardware metadata dynamically from parsed result
          if (result.boardName && result.boardName !== 'NOT FOUND IN PDF') setHwBoardName(result.boardName);
          if (result.fpgaDevice && result.fpgaDevice !== 'NOT FOUND IN PDF') setHwFpgaDevice(result.fpgaDevice);
          if (result.memorySize && result.memorySize !== 'NOT FOUND IN PDF') setHwMemorySize(result.memorySize);
          if (result.flashType && result.flashType !== 'NOT FOUND IN PDF') setHwFlashType(result.flashType);
          if (result.architecture && result.architecture !== 'NOT FOUND IN PDF') setHwArchitecture(result.architecture);
          if (result.vendorName && result.vendorName !== 'NOT FOUND IN PDF') setHwVendor(result.vendorName);
          else if (file.name.toLowerCase().includes('zynq') || file.name.toLowerCase().includes('board') || file.name.toLowerCase().includes('bsp')) setHwVendor('AMD / Xilinx');

          // Detect or assign discovered processor name dynamically
          const discoveredProc = result.processorName || result.architecture;
          if (discoveredProc && discoveredProc !== 'NOT FOUND IN PDF' && discoveredProc !== 'N/A') {
            setCustomProcessorName(discoveredProc);
          }

          // Clear preset board selection so single canonical hardware model from uploaded file is used
          setActivePreset(null);

          let periphsToUse = result.peripherals || [];
          const withSource = periphsToUse.map(p => ({ ...p, sourceFile: file.name }));
          setParsedPeripheralsCache(prev => ({ ...prev, [file.name]: withSource }));
          setSelectedFileNames(prev => [...prev, file.name]);
          setPeripherals(withSource);

          console.log(`[FRONTEND HARDWARE STATE]`);
          console.log(`sessionId=${pipelineSessionId}`);
          console.log(`board=${result.boardName || 'Unknown'}`);
          console.log(`processor=${result.processorName || 'Unknown'}`);
          console.log(`architecture=${result.architecture || 'Unknown'}`);
          console.log(`hklStatus=${result.hklStatus || 'READY'}`);

          console.log(`[FRONTEND PERIPHERALS]`);
          console.log(`source=validatedHKL`);
          console.log(`count=${withSource.length}`);
          withSource.forEach((p: any) => {
            console.log(`name=${p.peripheralBlock}`);
            console.log(`type=${p.type || 'MMIO'}`);
            console.log(`baseAddress=${p.baseAddress || 'null'}`);
            console.log(`deviceAddress=${p.deviceAddress || 'null'}`);
            console.log(`gpio=${p.gpioNumber ?? 'null'}`);
            console.log(`irq=${p.interruptNumber ?? 'null'}`);
            console.log(`driver=${p.driverName || 'null'}`);
            console.log(`provenance=${p.verification_status || 'SOURCE_VERIFIED'}`);
            console.log(`vendorReference=${p.provenance?.document || 'CM4 Hardware Evidence'}`);
          });
        } else if (result.ingestionStatus === 'REQUIRES_REVIEW' || result.hklStatus === 'NOT_READY' || (result.peripherals.length === 0 && (!result.processorName || result.processorName === 'NOT FOUND IN PDF') && (!result.architecture || result.architecture === 'NOT FOUND IN PDF'))) {
          // Determine if board was at least partially identified
          const boardIdentified = result.boardName && result.boardName !== 'NOT FOUND IN PDF' && result.boardName !== 'Unknown';
          const procIdentified = result.processorName && result.processorName !== 'NOT FOUND IN PDF' && result.processorName !== 'Unknown' && result.processorName !== 'N/A';
          const archIdentified = result.architecture && result.architecture !== 'NOT FOUND IN PDF' && result.architecture !== 'Unknown';

          if (boardIdentified || procIdentified) {
            addTerminalLine('warning', `[WARNING] [${file.name}] Board identity DETECTED but peripheral addresses require Knowledge Base lookup. Status: REQUIRES_REVIEW.`);
            addTerminalLine('info', `[BOARD ID] Detected: ${result.boardName || 'Unknown'} | Processor: ${result.processorName || result.architecture || 'Unknown'} | Architecture: ${result.architecture || 'Unknown'}`);
          } else {
            addTerminalLine('warning', `[WARNING] [${file.name}] Hardware Ingestion status: REQUIRES_REVIEW. Board or processor identity could not be deterministically verified.`);
          }
          addTerminalLine('info', `[VERIFY] Board identity: ${result.understandingStatus || 'UNVERIFIED'} | HKL status: ${result.hklStatus || 'NOT_READY'}`);
          setIngestionStatus('REQUIRES_REVIEW');
          setUnderstandingStatus(result.understandingStatus || 'UNVERIFIED');
          setHklStatus(result.hklStatus || 'NOT_READY');

          // Extract whatever board identity metadata IS available (partial evidence)
          if (boardIdentified) setHwBoardName(result.boardName!);
          if (archIdentified) setHwArchitecture(result.architecture!);
          if (procIdentified) setCustomProcessorName(result.processorName!);
          else if (archIdentified && result.architecture !== 'NOT FOUND IN PDF') setCustomProcessorName(result.architecture!);

          // Set vendor from board name or architecture
          if (result.boardName && (result.boardName.toLowerCase().includes('raspberry') || result.boardName.toLowerCase().includes('cm4'))) {
            setHwVendor('Raspberry Pi Foundation');
          } else if (result.architecture && result.architecture.toLowerCase().includes('raspberry')) {
            setHwVendor('Raspberry Pi Foundation');
          } else if (result.architecture && result.architecture.toLowerCase().includes('stm32')) {
            setHwVendor('STMicroelectronics');
          } else if (result.architecture && (result.architecture.toLowerCase().includes('imx') || result.architecture.toLowerCase().includes('nxp'))) {
            setHwVendor('NXP Semiconductors');
          }

          // Populate peripherals and cache so UI immediately reflects enriched KB/parsed data
          let periphsToUse = result.peripherals || [];
          const withSource = periphsToUse.map(p => ({ ...p, sourceFile: file.name }));
          setParsedPeripheralsCache(prev => ({ ...prev, [file.name]: withSource }));
          setSelectedFileNames(prev => [...prev, file.name]);
          setPeripherals(withSource);
          setActivePreset(null);
        }
      } catch (err) {
        addTerminalLine('error', `[ERROR] [${file.name}] Unexpected error parsing file: ${err instanceof Error ? err.message : String(err)}`);
        setIngestionStatus('REQUIRES_REVIEW');
      }
    }

    setParsingFiles([]);
    addTerminalLine('system', '[SYSTEM] Hardware source file parsing complete. Review the extracted peripheral blocks in the mapping table.');
  }, [addTerminalLine]);

  const handleResolveRequirement = useCallback(async () => {
    if (!engineeringRequirement.trim() || peripherals.length === 0) return;
    setResolvingRequirement(true);
    addTerminalLine('system', '[REQUIREMENT] Mapping natural-language requirement to verified hardware peripherals...');
    try {
      const response = await fetch('/api/requirements/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirement: engineeringRequirement, peripherals }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Requirement resolution failed');
      setRequirementPlan(data.plan);
      if (data.plan.readyForGeneration) {
        addTerminalLine('success', `[REQUIREMENT] Mapped successfully: ${data.plan.selectedPeripheralIds.length} verified peripheral(s).`);
      } else {
        addTerminalLine('warning', `[REQUIREMENT] Mapping requires review: ${data.plan.unresolved.join(' | ')}`);
      }
    } catch (err: any) {
      setRequirementPlan(null);
      addTerminalLine('error', `[REQUIREMENT] ${err.message}`);
    } finally {
      setResolvingRequirement(false);
    }
  }, [engineeringRequirement, peripherals, addTerminalLine]);

  // Handler: Toggle File Selection
  const handleToggleFileSelection = useCallback((fileName: string) => {
    setSelectedFileNames((prev) => {
      const isSelected = prev.includes(fileName);
      if (isSelected) {
        setPeripherals(prevPeriphs => prevPeriphs.filter(p => p.sourceFile !== fileName));
        addTerminalLine('info', `[INFO] Disabled peripheral components associated with: ${fileName}`);
        return prev.filter(name => name !== fileName);
      } else {
        const cached = parsedPeripheralsCache[fileName] || [];
        setPeripherals(prevPeriphs => {
          const existingIds = new Set(prevPeriphs.map(p => p.peripheralBlock));
          const newOnes = cached.filter(p => !existingIds.has(p.peripheralBlock));
          return [...prevPeriphs, ...newOnes];
        });
        addTerminalLine('info', `[INFO] Enabled peripheral components associated with: ${fileName}`);
        return [...prev, fileName];
      }
    });
  }, [parsedPeripheralsCache, addTerminalLine]);

  // Handler: Remove Individual File
  const handleFileRemove = useCallback((fileName: string) => {
    setUploadedFiles(prev => prev.filter(f => f.name !== fileName));
    setSelectedFileNames(prev => prev.filter(name => name !== fileName));
    setParsedPeripheralsCache(prev => {
      const next = { ...prev };
      delete next[fileName];
      return next;
    });
    setPeripherals(prev => prev.filter(p => p.sourceFile !== fileName));
    addTerminalLine('info', `[INFO] Removed source file: ${fileName}`);
  }, [addTerminalLine]);

  // Handler: Clear All Files
  const handleFilesClear = useCallback(() => {
    setUploadedFiles([]);
    setSelectedFileNames([]);
    setParsedPeripheralsCache({});
    setPeripherals(prev => prev.filter(p => !p.sourceFile));
    setCustomProcessorName('ARM Core');
    addTerminalLine('info', '[INFO] Cleared all uploaded hardware design files.');
  }, [addTerminalLine]);

  // Handler: Preset Load
  const handlePresetLoad = useCallback((preset: PlatformPreset) => {
    setActivePreset(preset);
    setRequirementPlan(null);
    setPeripherals([...preset.peripherals]);
    setLockStatus('unlocked');
    setUploadedFiles([]);
    setSelectedFileNames([]);
    setParsedPeripheralsCache({});
    setTerminalOutput([]);
    setHwArchitecture(preset.architecture);
    setCustomProcessorName(preset.name);
    setIngestionStatus('COMPLETED');
    setUnderstandingStatus('VERIFIED');
    setHklStatus('READY');
    addTerminalLine('system', `[SYSTEM] Loaded platform preset: ${preset.name}`);
    addTerminalLine('info', `[INFO] Initialized ${preset.peripherals.length} hardware peripheral blocks.`);
    
    // Run HKL Pipeline immediately for selected preset
    fetch('/api/pipeline/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: pipelineSessionId,
        peripherals: preset.peripherals,
        fpgaDevice: preset.name.toLowerCase().includes('ultrascale') || preset.name.toLowerCase().includes('mpsoc') ? 'xczu3eg-sbva484-1-e' : 'xc7z020clg484-1',
        memorySize: '512 MB',
        flashType: 'QSPI Flash'
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success && data.hkl) {
        setPeripherals(data.hkl.peripherals);
        setValidationReport(data.hkl.validationReport);
        setDecisionLog(data.hkl.decisionLog);
        setConfidenceScores(data.hkl.confidenceScores);
        setReviewQueue(data.hkl.reviewQueue || []);
        if (data.logs && Array.isArray(data.logs)) {
          data.logs.forEach((logLine: string) => {
            addTerminalLine('info', logLine);
          });
        }
      }
    })
    .catch(err => console.error('Failed to run preset pipeline:', err));

    addTerminalLine('success', '[SUCCESS] Ready for validation. Click "Next Step" to proceed.');
  }, [addTerminalLine]);

  // Handler: Peripheral Update
  const handlePeripheralUpdate = useCallback(
    (id: string, field: keyof HardwarePeripheral, value: string | boolean) => {
      setPeripherals((prev) =>
        prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
      );
    },
    []
  );

  // Handler: Add Peripheral
  const handlePeripheralAdd = useCallback((peripheral: HardwarePeripheral) => {
    setPeripherals((prev) => [...prev, peripheral]);
  }, []);

  // Handler: Remove Peripheral
  const handlePeripheralRemove = useCallback((id: string) => {
    setPeripherals((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // Handler: Lock Schema (Synthesize Hardware Platform)
  const handleLockSchema = useCallback(async () => {
    try {
      const lockRes = await fetch('/api/hardware/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hkl: { peripherals, boardName: activePreset ? activePreset.name : hwBoardName, processorName: customProcessorName },
          targetFlow: 'unspecified',
          sessionContext: { sessionId: pipelineSessionId, boardName: activePreset ? activePreset.name : hwBoardName, processorName: customProcessorName, vendor: hwVendor, architecture: hwArchitecture }
        })
      }).then(r => r.json());

      if (lockRes.success && lockRes.hardwareLock) {
        console.log(`[LOCK] Schema Synthesized & Validated. Hardware Schema Automatically Locked | lockId: ${lockRes.hardwareLock.hardwareLockId}`);
      }

      setLockStatus('frozen');
      setTerminalOutput([]);
      addTerminalLine('success', '[SUCCESS] Hardware layout schema locked and frozen successfully.');
      addTerminalLine('info', '[INFO] Pre-flight validation passed. Hardware schema locked. Select target flow below.');
    } catch {
      setLockStatus('frozen');
      setTerminalOutput([]);
      addTerminalLine('success', '[SUCCESS] Hardware layout schema locked and frozen successfully.');
      addTerminalLine('info', '[INFO] Pre-flight validation passed. Hardware schema locked. Select target flow below.');
    }
  }, [peripherals, activePreset, hwBoardName, customProcessorName, pipelineSessionId, hwVendor, hwArchitecture, addTerminalLine]);


  // Handler: Run Compilation — POST session then SSE stream for real-time logs
  const handleRunCompilation = useCallback(async () => {
    setTerminalOutput([]);
    lineQueueRef.current = [];
    setCompilationStatus('running');

    // ── Front-end pre-flight checks ─────────────────────────────
    // Use preset code as fallback if code generation hasn't run yet
    const effectiveBareMetalCode = (currentBareMetalCode || '').trim()
      || (activePreset?.bareMetalCode || '').trim();
    const effectiveDeviceTreeCode = (currentDeviceTreeCode || '').trim()
      || (activePreset?.deviceTreeCode || '').trim();

    const trimmedCode = effectiveBareMetalCode;

    if (!trimmedCode) {
      addTerminalLines([
        { type: 'error', content: '[ERROR] Pre-flight failed: Bare-metal C code is empty.' },
        { type: 'info',  content: '[INFO] Go back to "Code Generation" and wait for code synthesis to complete.' },
      ]);
      setCompilationStatus('error');
      return;
    }
    if (trimmedCode.startsWith('// Generating code') || trimmedCode.startsWith('// Failed') ||
        trimmedCode.startsWith('// Network error') || trimmedCode.startsWith('// Error')) {
      addTerminalLines([
        { type: 'error', content: '[ERROR] Pre-flight failed: Code generation did not complete.' },
        { type: 'info',  content: '[INFO] Navigate back to "Code Generation" and wait for Llama 3.3 to finish.' },
      ]);
      setCompilationStatus('error');
      return;
    }
    if (!trimmedCode.includes('int main')) {
      addTerminalLines([
        { type: 'error', content: '[ERROR] Pre-flight failed: Missing int main() entry point.' },
        { type: 'info',  content: '[INFO] Re-generate the code or check the Code Generation step for errors.' },
      ]);
      setCompilationStatus('error');
      return;
    }
    if (peripherals.length === 0) {
      addTerminalLines([
        { type: 'error', content: '[ERROR] Pre-flight failed: No peripherals configured.' },
        { type: 'info',  content: '[INFO] Return to Hardware Ingestion and load a preset.' },
      ]);
      setCompilationStatus('error');
      return;
    }

    // ── Submit job to execution bridge ──
    try {
      const fileNames = uploadedFiles.map(f => f.name.toLowerCase());
      let explicitWorkflow = '';
      if (fileNames.some(f => f.endsWith('.xpr'))) {
        explicitWorkflow = 'vivado_xpr';
      } else if (fileNames.some(f => f.endsWith('.xsa'))) {
        explicitWorkflow = 'xsa';
      } else if (fileNames.some(f => f.endsWith('.dts') || f.endsWith('.dtsi'))) {
        explicitWorkflow = 'device_tree';
      } else if (fileNames.some(f => ['.pdf', '.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.svg', '.docx'].some(ext => f.endsWith(ext)))) {
        explicitWorkflow = 'circuit_doc';
      } else if (activePreset) {
        const pid = activePreset.id.toLowerCase();
        if (pid.includes('xilinx') || pid.includes('zynq')) explicitWorkflow = 'vivado_xpr';
        else if (pid.includes('dts') || pid.includes('rpi') || pid.includes('nvidia') || pid.includes('jetson')) explicitWorkflow = 'device_tree';
        else if (pid.includes('stm32')) explicitWorkflow = 'spec_tree';
        else explicitWorkflow = 'circuit_doc';
      } else {
        explicitWorkflow = 'circuit_doc';
      }

      // Step 1: POST the large payload to get a short session ID
      const sessionResponse = await fetch('/api/compile-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId:      pipelineSessionId,
          presetId:       activePreset?.id || '',
          bareMetalCode:  effectiveBareMetalCode,
          deviceTreeCode: effectiveDeviceTreeCode,
          peripherals,
          workflow:       explicitWorkflow,
          metadata: {
            processorName: activePreset ? activePreset.name : customProcessorName,
            architecture:  activePreset ? activePreset.architecture : hwArchitecture,
            vendor:        activePreset ? activePreset.vendor : (hwVendor || 'AMD / Xilinx'),
          },
          uploadedFileNames: uploadedFiles.map(f => f.name),
          targetFlow,
        }),
      });

      if (!sessionResponse.ok) {
        let errMsg = `HTTP ${sessionResponse.status} ${sessionResponse.statusText}`;
        try {
          const errBody = await sessionResponse.json();
          errMsg = errBody.error || errMsg;
        } catch {
          // Response was not JSON (proxy error, HTML page, etc.)
          errMsg = sessionResponse.status === 502 || sessionResponse.status === 503
            ? 'Backend server unreachable — please restart the server'
            : errMsg;
        }
        addTerminalLine('error', '[ERROR] Failed to create compilation session: ' + errMsg);
        addTerminalLine('info', '[INFO] Ensure the backend is running: npm start');
        setCompilationStatus('error');
        return;
      }

      const { sessionId } = await sessionResponse.json();
      addTerminalLine('system', `[SYSTEM] Session created: ${sessionId} — opening real-time stream...`);

      // Step 2: Open SSE stream using the session ID (short URL, no length limit)
      let doneReceived = false;
      const es = new EventSource(`/api/compile-stream/${sessionId}`);

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'log') {
            const logType = (data.logType as TerminalLine['type']) || 'info';
            addTerminalLine(logType, data.line || '');
          } else if (data.type === 'progress') {
            // Progress events carry pipeline stage markers for the stage-tracker UI.
            // We intentionally do NOT add a terminal line here — the backend already
            // emits a 'log' event for the same [PROGRESS] PHASE: xxx message which
            // is rendered above. Adding a line here would cause each phase to appear twice.
            // (stageId and status can be used by a future stage-indicator component)

          } else if (data.type === 'done') {
            doneReceived = true;
            es.close();

            if (data.success) {
              const binPath = data.binaryPath || '';
              const match = binPath.match(/build_[a-z0-9_]+|sess_[a-z0-9_]+/i);
              if (match) {
                setCompiledElfUrl(`/api/download-elf/${match[0]}`);
              } else {
                setCompiledElfUrl(`/api/download-elf/${sessionId}`);
              }
              addTerminalLines([
                { type: 'success', content: '[SUCCESS] ══════════════════════════════════════════════════' },
                { type: 'success', content: '[SUCCESS]   ✓ Compilation Pipeline COMPLETE — Target Artifact Ready' },
                { type: 'success', content: '[SUCCESS] ══════════════════════════════════════════════════' },
              ]);
              setCompilationStatus('success');
              setCompletedSteps(prev => ({
                ...prev,
                ingestion: true,
                validation: true,
                synthesis: true,
                terminal: true,
                conclusion: true,
              }));
              handleRunUniversalValidation();
              
              // Automatically continue to conclusion after a brief delay
              setTimeout(() => {
                setCurrentStep('conclusion');
              }, 1500);
            } else {
              setCompilationStatus('error');
              addTerminalLines([
                { type: 'error', content: `[ERROR] Compilation failed: ${data.error || 'Unknown error occurred during build'}` },
                { type: 'warning', content: '[HOLD] ⏱️ Holding terminal view for 20 seconds to allow error log review...' },
              ]);

              // Wait 20 seconds so user can read error log before AI repair
              sleep(20000).then(async () => {
                addTerminalLines([
                  { type: 'system', content: '[SYSTEM] ── Gemini AI Repair Engine Activated ──────────────' },
                  { type: 'info',   content: '[INFO] Analyzing address map configuration and compile diagnostics...' },
                ]);
                await sleep(1000);
                try {
                  const processorName = activePreset ? activePreset.name : customProcessorName;
                  const repairRes = await fetch('/api/ai/suggest-fixes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ peripherals, processorName }),
                  });
                  const repairData = await repairRes.json();
                  if (repairData.success && Array.isArray(repairData.peripherals)) {
                    addTerminalLines([
                      { type: 'success', content: '[SUCCESS] AI Diagnosis: Memory map and driver configuration corrected.' },
                      { type: 'system',  content: '[SYSTEM] Applying corrections to internal state...' },
                    ]);

                    const patched = repairData.peripherals.map((p: any) => {
                      const orig = peripherals.find(o => o.id === p.id);
                      return {
                        ...p,
                        originalAddress: orig ? (orig.originalAddress || orig.baseAddress) : p.baseAddress,
                        correctedAddress: p.baseAddress,
                      };
                    });

                    setPeripherals(patched);
                    await sleep(1000);

                    addTerminalLines([
                      { type: 'success', content: '[SUCCESS] Peripheral Table, Device Tree, and Build configs patched.' },
                      { type: 'system',  content: '[SYSTEM] Automatically re-running validation and compiling...' },
                    ]);

                    setTimeout(() => {
                      setTriggerCompileCount(prev => prev + 1);
                    }, 500);
                  }
                } catch (err: any) {
                  addTerminalLine('warning', '[WARNING] AI repair service failed: ' + err.message);
                }
              });
            }
          }
        } catch { /* malformed event — ignore */ }
      };

      es.onerror = () => {
        if (doneReceived) return; // Clean disconnect after 'done' — not an error
        es.close();
        setCompilationStatus(prev => prev === 'running' ? 'error' : prev);
        addTerminalLines([
          { type: 'error', content: '[ERROR] Real-time stream connection lost.' },
          { type: 'info',  content: '[INFO] The backend may have timed out or restarted. Check that the server is running on port 3001.' },
        ]);
      };

    } catch (err: any) {
      addTerminalLines([
        { type: 'error', content: '[ERROR] Failed to connect to compilation bridge: ' + err.message },
        { type: 'info',  content: '[INFO] Ensure the backend server is running on port 3001.' },
      ]);
      setCompilationStatus('error');
    }
  }, [peripherals, currentBareMetalCode, currentDeviceTreeCode, addTerminalLine, addTerminalLines, activePreset, lineQueueRef, targetFlow, customProcessorName, hwArchitecture, uploadedFiles, pipelineSessionId]);

  useEffect(() => {
    if (triggerCompileCount > 0) {
      handleRunCompilation();
    }
  }, [triggerCompileCount, handleRunCompilation]);

  const [generatingReport, setGeneratingReport] = useState(false);


  const getValidationScore = useCallback(() => {
    if (peripherals.length === 0) return 0;
    let score = 100;
    let hasUnverifiedOrReview = false;
    const processorName = activePreset ? activePreset.name : customProcessorName;
    peripherals.forEach(p => {
      const valResult = validatePeripheral(p, processorName, peripherals);
      if (valResult.status === 'Error') { score -= 25; hasUnverifiedOrReview = true; }
      else if (valResult.status === 'Warning') score -= 10;
      if (!p.clockNetIndicator) score -= 5;

      const isAiInferred = p.verification_status === 'AI_INFERRED' || p.provenanceSource === 'AI_INFERRED' || (p as any).ai_inferred;
      const requiresReview = p.verification_status === 'REQUIRES_REVIEW' || (p as any).requires_review;
      if (isAiInferred || requiresReview || p.type === 'Unknown' || p.driverName === 'generic-uio') {
        hasUnverifiedOrReview = true;
        score -= 15;
      }

      if (p.fieldStatuses) {
        Object.values(p.fieldStatuses).forEach(status => {
          if (status === 'unresolved') { score -= 10; hasUnverifiedOrReview = true; }
        });
      }
    });

    if (Array.isArray(reviewQueue) && reviewQueue.length > 0) {
      score -= reviewQueue.length * 10;
      hasUnverifiedOrReview = true;
    }

    const calculatedScore = Math.max(0, Math.min(100, score));
    return hasUnverifiedOrReview ? Math.min(85, calculatedScore) : calculatedScore;
  }, [peripherals, activePreset, customProcessorName, reviewQueue]);


  const handleGenerateReport = useCallback(async () => {
    setGeneratingReport(true);
    addTerminalLine('system', '[SYSTEM] Initiating engineering PDF synthesis report generation...');
    try {
      const response = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processor: activePreset ? activePreset.name : customProcessorName,
          operatingSystem: activePreset?.operatingSystems?.[0] || 'Bare Metal',
          memoryType: activePreset?.memoryType || 'DDR4 SDRAM',
          readiness: getValidationScore(),
          buildStatus: compilationStatus === 'success' ? 'SUCCESS' : 'FAILED',
          timestamp: new Date().toLocaleString(),
          architecture: activePreset?.architecture || 'ARM',
          clockSource: activePreset?.clockSource || resolveVendorDefaults(activePreset ? activePreset.name : customProcessorName).defaultClockSource,
          resetController: activePreset?.resetController || 'System Reset Controller',
          interruptController: activePreset?.interruptController || 'GIC',
          axiInterconnect: activePreset?.axiInterconnect || resolveVendorDefaults(activePreset ? activePreset.name : customProcessorName).defaultBus,
          bootDevice: activePreset?.bootDevice || 'QSPI Flash',
          peripherals: peripherals,
          validation: peripherals.map(p => {
            const val = validatePeripheral(p, activePreset?.name || 'ARM Cortex SoC', peripherals);
            return {
              checkName: p.peripheralBlock,
              rule: 'Address range configuration and boundary check',
              status: val.status === 'Ready' ? 'PASS' : (val.status === 'Warning' ? 'WARNING' : 'FAIL'),
              details: val.tooltip || val.message
            };
          }),
          compilationLogs: terminalOutput.map(l => `[${l.type.toUpperCase()}] ${l.content}`),
          elfPath: 'firmware.elf'
        }),
      });
      const data = await response.json();
      if (data.success && data.pdfBase64) {
        addTerminalLine('success', '[SUCCESS] Engineering synthesis report PDF compiled successfully. Saved to Desktop: C:\\Users\\Administrator\\Desktop\\Engineering_Report.pdf');
        
        try {
          const byteCharacters = atob(data.pdfBase64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          
          const link = document.createElement('a');
          link.href = url;
          link.download = 'Engineering_Report.pdf';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          
          alert('Engineering Report PDF generated successfully and downloaded to your computer!');
        } catch (downloadErr: any) {
          addTerminalLine('error', '[ERROR] Report generated successfully, but browser download initialization failed: ' + downloadErr.message);
          alert('Report compiled and saved to Desktop, but browser download failed.');
        }
      } else {
        addTerminalLine('error', '[ERROR] Synthesis report PDF generation failed: ' + (data.error || 'No PDF data received'));
      }
    } catch (err: any) {
      addTerminalLine('error', '[ERROR] An error occurred while generating the engineering synthesis report: ' + err.message);
    } finally {
      setGeneratingReport(false);
    }
  }, [peripherals, activePreset, compilationStatus, terminalOutput, addTerminalLine, getValidationScore]);

  // Handler: Emergency Reset
  const handleEmergencyReset = useCallback(() => {
    setPeripherals([]);
    setLockStatus('unlocked');
    setActivePreset(null);
    setUploadedFiles([]);
    setTerminalOutput([]);
    setCompilationStatus('idle');
    setCurrentStep('ingestion');

    setTimeout(() => {
      addTerminalLine('warning', '[WARNING] EMERGENCY OVERRIDE TRIGGERED: System reset in progress...');
      addTerminalLine('system', '[SYSTEM] Memory space and cached variables purged.');
      addTerminalLine('system', '[SYSTEM] Build progress indicators and console log buffers cleared.');
      addTerminalLine('info', '[INFO] System restored to clean initial state.');
    }, 100);
  }, [addTerminalLine]);


  const handleCodeUpdate = useCallback((bareMetal: string, deviceTree: string, allFiles?: {filename: string; code: string}[]) => {
    setCurrentBareMetalCode(bareMetal);
    setCurrentDeviceTreeCode(deviceTree);
    if (allFiles && allFiles.length > 0) {
      setGeneratedBspFiles(allFiles);
    }
  }, []);

  const [completedSteps, setCompletedSteps] = useState<Record<Step, boolean>>({
    ingestion: false,
    validation: false,
    synthesis: false,
    terminal: false,
    conclusion: false,
    chipgenie: false,
  });

  // Track completion strictly when backend reports COMPLETED + VERIFIED + READY or preset is selected
  useEffect(() => {
    const isIngestedReady = ingestionStatus === 'COMPLETED' && understandingStatus === 'VERIFIED' && hklStatus === 'READY';
    if (isIngestedReady || (activePreset !== null && peripherals.length > 0)) {
      if (!completedSteps.ingestion) {
        console.log('[FRONTEND STATE] ingestion=completed');
        setCompletedSteps(prev => ({ ...prev, ingestion: true }));
      }
    } else {
      if (completedSteps.ingestion) {
        console.log(`[FRONTEND STATE] ingestion=${ingestionStatus === 'PARSING' ? 'running' : ingestionStatus.toLowerCase()}`);
        setCompletedSteps(prev => ({ ...prev, ingestion: false }));
      }
    }
  }, [peripherals.length, ingestionStatus, understandingStatus, hklStatus, activePreset, completedSteps.ingestion]);

  // Navigation helpers - check conditions inline for fresh state
  const goToNextStep = () => {
    // Check if we can proceed from current step
    let canProceed = false;
    if (currentStep === 'ingestion') {
      canProceed = uploadedFiles.length > 0 || peripherals.length > 0 || activePreset !== null;
    } else if (currentStep === 'validation') {
      canProceed = lockStatus === 'frozen';
    } else if (currentStep === 'synthesis') {
      canProceed = lockStatus === 'frozen';
    } else if (currentStep === 'terminal') {
      canProceed = compilationStatus === 'success' || compilationStatus === 'error';
    } else {
      canProceed = true;
    }

    if (canProceed && currentStepIndex < steps.length - 1) {
      if (currentStep !== 'ingestion') {
        setCompletedSteps(prev => ({ ...prev, [currentStep]: true }));
      }
      setCurrentStep(steps[currentStepIndex + 1].id);
    }
  };

  const goToPrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(steps[currentStepIndex - 1].id);
    }
  };

  const canGoNext = () => {
    if (currentStep === 'ingestion') {
      return uploadedFiles.length > 0 || peripherals.length > 0 || activePreset !== null;
    }
    if (currentStep === 'validation') return lockStatus === 'frozen';
    if (currentStep === 'terminal') return compilationStatus === 'success' || compilationStatus === 'error';
    if (currentStep === 'conclusion') return false;
    return currentStepIndex < steps.length - 1;
  };

  // Check if a step is completed
  const isStepCompleted = (stepId: Step) => {
    if (stepId === 'ingestion') {
      return (ingestionStatus === 'COMPLETED' && understandingStatus === 'VERIFIED' && hklStatus === 'READY') || (activePreset !== null && peripherals.length > 0);
    }
    if (stepId === 'validation') return lockStatus === 'frozen' || !!completedSteps['validation'];
    if (stepId === 'synthesis') return lockStatus === 'frozen' || !!completedSteps['synthesis'];
    if (stepId === 'terminal') return compilationStatus === 'success' || !!completedSteps['terminal'];
    if (stepId === 'conclusion') return compilationStatus === 'success' || !!completedSteps['conclusion'];
    return !!completedSteps[stepId];
  };

  // Check if a step can be navigated to
  const canNavigateToStep = (stepId: Step, index: number) => {
    // Can always go to current step
    if (currentStep === stepId) return true;
    // Can go to previous steps
    if (index < currentStepIndex) return true;
    // Can go to next step if current step conditions are met
    if (index === currentStepIndex + 1) {
      if (currentStep === 'ingestion') return uploadedFiles.length > 0 || peripherals.length > 0 || activePreset !== null;
      if (currentStep === 'validation') return lockStatus === 'frozen';
      if (currentStep === 'synthesis') return lockStatus === 'frozen';
      if (currentStep === 'terminal') return compilationStatus === 'success';
    }
    // Can go to any previously completed step
    return !!completedSteps[stepId];
  };

  return (
    <div className="flex h-screen bg-obsidian relative selection:bg-neon-cyan/30 text-text-primary">
      {/* Dynamic Blueprint Background */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Major Grid Lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080801a_1px,transparent_1px),linear-gradient(to_bottom,#8080801a_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:40px_40px]" />
        {/* Minor Grid Lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:10px_10px]" />
        
        {/* Vignette Mask */}
        <div className="absolute inset-0 bg-obsidian [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black_100%)] opacity-40 dark:opacity-80" />
      </div>

      {/* Sidebar */}
      <div className="relative z-10 shrink-0 h-full">
        <DashboardPanel
          lockStatus={lockStatus}
          peripheralCount={peripherals.length}
          clockNetCount={peripherals.filter((p) => p.clockNetIndicator).length}
          compilationStatus={compilationStatus}
          activePreset={activePreset}
          peripherals={peripherals}
          currentStep={currentStep}
          steps={steps}
          isStepCompleted={isStepCompleted}
          canNavigateToStep={canNavigateToStep}
          onStepChange={(step) => {
            if (step === 'chipgenie') {
              toggleAiAssistant();
            } else {
              setCurrentStep(step);
            }
          }}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(v => !v)}
          onOpenAiAssistant={toggleAiAssistant}
          hasUnreadAiMessage={hasUnreadAiMessage}
          isParsing={parsingFiles.length > 0}
          ingestionStatus={ingestionStatus}
          processorName={customProcessorName}
          boardName={hwBoardName}
          architecture={hwArchitecture}
        />
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative z-10">
        {/* ── Top Bar (clean — steps are in sidebar) ──────────── */}
        <header className="bg-obsidian-50 border-b border-border-grid shrink-0">
          <div className="px-6 py-3 flex items-center justify-between">

            {/* Current step breadcrumb */}
            <div className="flex items-center gap-3">
              {(() => {
                const step = steps.find(s => s.id === currentStep);
                const Icon = step?.icon;
                const idx = steps.findIndex(s => s.id === currentStep);
                const textAccents = ['text-neon-cyan', 'text-blue-400', 'text-purple-400', 'text-yellow-400', 'text-neon-emerald'];
                const bgAccents   = ['bg-neon-cyan/15', 'bg-blue-400/15', 'bg-purple-400/15', 'bg-yellow-400/15', 'bg-neon-emerald/15'];
                return (
                  <>
                    {Icon && (
                      <div className={`w-8 h-8 rounded-lg ${bgAccents[idx]} flex items-center justify-center`}>
                        <Icon className={`w-4 h-4 ${textAccents[idx]}`} />
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] font-mono text-text-muted uppercase tracking-widest leading-none mb-0.5">
                        Step {idx + 1} of {steps.length}
                      </p>
                      <p className={`text-sm font-bold leading-none ${textAccents[idx]}`}>
                        {step?.label}
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-3">
              {activePreset && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-neon-cyan/10 rounded-lg border border-neon-cyan/30">
                  <Cpu className="w-3.5 h-3.5 text-neon-cyan" />
                  <span className="text-neon-cyan text-xs font-semibold font-mono truncate max-w-[180px]">
                    {activePreset.name}
                  </span>
                </div>
              )}
              <ThemeToggle />
            </div>

          </div>
        </header>


        {/* Step Content */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full p-6">
            <div className="h-full bg-obsidian-100/30 rounded-2xl border border-border-grid overflow-hidden flex flex-col">
              {/* Content Area */}
              <div ref={contentScrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
                 {currentStep === 'ingestion' && (
                  <IngestionView
                    uploadedFiles={uploadedFiles}
                    selectedFileNames={selectedFileNames}
                    onFileUpload={handleFileUpload}
                    onPresetLoad={handlePresetLoad}
                    onFileRemove={handleFileRemove}
                    onToggleFileSelection={handleToggleFileSelection}
                    onFilesClear={handleFilesClear}
                    selectedPresetId={activePreset?.id || null}
                    parsingFiles={parsingFiles}
                    requirement={engineeringRequirement}
                    requirementPlan={requirementPlan}
                    onRequirementChange={(value) => { setEngineeringRequirement(value); setRequirementPlan(null); }}
                    onResolveRequirement={handleResolveRequirement}
                    resolvingRequirement={resolvingRequirement}
                  />
                )}

                {currentStep === 'validation' && (
                  <div className="space-y-6">
                    <ValidationGrid
                      peripherals={peripherals}
                      lockStatus={lockStatus}
                      onPeripheralUpdate={handlePeripheralUpdate}
                      onPeripheralAdd={handlePeripheralAdd}
                      onPeripheralRemove={handlePeripheralRemove}
                      onLockSchema={handleLockSchema}
                      processorName={activePreset ? activePreset.name : customProcessorName}
                      reviewQueue={reviewQueue}
                      onReviewQueueSet={setReviewQueue}
                      isHardwareSynthesized={isHardwareSynthesized}
                      onSynthesizeHardware={() => setIsHardwareSynthesized(true)}
                      onPeripheralsSet={(newPeripherals) => {

                        setPeripherals(newPeripherals);
                        // Trigger HKL pipeline check dynamically for the updated peripheral layout
                        fetch('/api/pipeline/run', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            sessionId: pipelineSessionId,
                            peripherals: newPeripherals,
                            processorName: activePreset ? activePreset.name : customProcessorName,
                            boardName: activePreset ? activePreset.name : customProcessorName,
                                                fpgaDevice: 'xc7z020clg484-1',
                            memorySize: '512 MB',
                            flashType: 'QSPI Flash'
                          })
                        })
                        .then(res => res.json())
                        .then(data => {
                          if (data.success && data.hkl) {
                            setPeripherals(data.hkl.peripherals);
                            setValidationReport(data.hkl.validationReport);
                            setDecisionLog(data.hkl.decisionLog);
                            setConfidenceScores(data.hkl.confidenceScores);
                            setReviewQueue(data.hkl.reviewQueue || []);
                          }
                        })
                        .catch(err => console.error('Failed to run pipeline post-AI fix:', err));
                      }}
                    />

                    {/* Step 2 Target Flow & Execution Flow Panel (Revealed after Original Synthesize Button is clicked) */}
                    {(() => {
                      const supportedFlows = resolveBoardCapabilities(activePreset ? activePreset.name : hwBoardName, customProcessorName, hwVendor);
                      const isSchemaLocked = lockStatus === 'frozen';
                      const isTargetFlowSelected = Boolean(targetFlow);

                      // ONLY render control panel after Hardware Schema is synthesized and locked
                      if (!isSchemaLocked) return null;

                      return (
                        <div className="p-5 rounded-2xl border border-neon-cyan/40 bg-obsidian-100/60 backdrop-blur-md shadow-xl space-y-4 animate-fade-in">

                          {/* Header: Hardware Schema Status & Target Flow Selector */}
                          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-border-grid/40">
                            <div className="space-y-1">
                              <div className="flex items-center gap-3">
                                <h3 className="text-text-primary text-base font-bold flex items-center gap-2">
                                  🔒 Schema Synthesized & Validated
                                </h3>
                                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-md border font-bold text-neon-emerald bg-neon-emerald/10 border-neon-emerald/30">
                                  HARDWARE SCHEMA LOCKED ✓
                                </span>
                              </div>
                              <p className="text-text-muted text-xs">
                                Hardware schema locked. Target flows dynamically evaluated for <strong>{activePreset ? activePreset.name : hwBoardName || 'Detected Board'}</strong> ({customProcessorName || 'Processor'}). Select target flow.
                              </p>
                            </div>

                            {/* Target Flow Selector */}
                            <div className="flex flex-col w-full md:w-auto">
                              <label className="text-[10px] font-mono text-text-muted uppercase tracking-wider mb-1">TARGET FLOW *</label>
                              <select
                                value={targetFlow}
                                onChange={(e) => {
                                  const selected = e.target.value as any;
                                  setTargetFlow(selected);
                                }}
                                className="bg-obsidian border border-neon-cyan/40 text-neon-cyan text-xs font-mono font-bold rounded-lg px-3.5 py-2 focus:outline-none focus:border-neon-cyan"
                              >
                                <option value="">-- Select Target Flow ({supportedFlows.length} available) * --</option>
                                {supportedFlows.map(flow => (
                                  <option key={flow.id} value={flow.id}>{flow.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* HOW WOULD YOU LIKE TO PROCEED? (Revealed IMMEDIATELY when Target Flow is selected) */}
                          {isTargetFlowSelected ? (
                            <div className="pt-2 space-y-3 animate-fade-in">
                              <h4 className="text-xs font-mono uppercase tracking-wider text-neon-cyan font-bold flex items-center gap-2">
                                <Zap className="w-4 h-4" />
                                HOW WOULD YOU LIKE TO PROCEED?
                              </h4>

                              <div className="flex flex-col sm:flex-row items-center gap-4">
                                {/* Choice A: Autonomous Agent */}
                                <button
                                  onClick={async () => {
                                    if (!targetFlow) {
                                      alert("Select Target Flow before starting autonomous execution.");
                                      return;
                                    }
                                    try {
                                      console.log(`[WORKFLOW] Starting Autonomous Agent for flow: ${targetFlow}`);

                                      const lockRes = await fetch('/api/hardware/lock', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          hkl: { peripherals, boardName: activePreset ? activePreset.name : hwBoardName, processorName: customProcessorName },
                                          targetFlow,
                                          sessionContext: { sessionId: pipelineSessionId, boardName: activePreset ? activePreset.name : hwBoardName, processorName: customProcessorName, vendor: hwVendor, architecture: hwArchitecture }
                                        })
                                      }).then(r => r.json());

                                      if (!lockRes.success || !lockRes.hardwareLock) {
                                        alert(lockRes.error || "Hardware lock validation failed.");
                                        return;
                                      }

                                      const startRes = await fetch('/api/agent/start', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          hardwareLock: lockRes.hardwareLock,
                                          sessionContext: { sessionId: pipelineSessionId, peripherals }
                                        })
                                      }).then(r => r.json());

                                      if (startRes.success && startRes.executionState) {
                                        console.log(`[AGENT] Agent started successfully | executionId: ${startRes.executionState.executionId}`);
                                        setCompilationStatus('running');
                                        setCurrentStep('terminal');
                                        handleRunCompilation();
                                      } else {
                                        alert(`Autonomous Agent Start Failed: ${startRes.error || 'Unknown error'}`);
                                      }
                                    } catch (err: any) {
                                      alert(`Autonomous Agent Error: ${err.message}`);
                                    }
                                  }}
                                  className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-neon-cyan text-obsidian hover:bg-neon-cyanDim shadow-lg shadow-neon-cyan/20 cursor-pointer flex items-center justify-center gap-2 font-mono"
                                >
                                  <Zap className="w-4 h-4" />
                                  🤖 LAUNCH AUTONOMOUS AGENT
                                </button>

                                {/* Choice B: Manual Engineering Flow */}
                                <button
                                  onClick={() => {
                                    if (!targetFlow) {
                                      alert("Select Target Flow before proceeding manually.");
                                      return;
                                    }
                                    console.log(`[WORKFLOW] Manual Engineering Flow selected for target flow: ${targetFlow}`);
                                    setCurrentStep('synthesis');
                                  }}
                                  className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-obsidian-200 text-text-primary border border-text-muted/30 hover:border-text-primary hover:bg-obsidian-300 cursor-pointer flex items-center justify-center gap-2 font-mono"
                                >
                                  👤 MANUAL ENGINEERING FLOW
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="pt-2 text-text-muted text-xs font-mono italic">
                              Select a Target Flow above to unlock execution mode options.
                            </div>
                          )}
                        </div>
                      );
                    })()}






                    {/* ── Engineering View Launchers ── */}

                    <div className="rounded-2xl border border-border-grid bg-obsidian-100/30 p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-1 h-4 rounded-full bg-neon-cyan" />
                        <h3 className="text-sm font-bold text-text-primary">Engineering Views</h3>
                        <span className="text-[11px] text-text-muted font-mono ml-1">— click to open in fullscreen</span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {[
                          {
                            id: 'block-diagram' as const,
                            label: 'RTL Block Design',
                            sub: 'Interactive SoC topology',
                            icon: <GitBranch className="w-5 h-5" />,
                            accent: 'text-neon-cyan',
                            border: 'border-neon-cyan/30',
                            bg: 'bg-neon-cyan/10',
                            hover: 'hover:border-neon-cyan hover:bg-neon-cyan/15',
                          },
                          {
                            id: 'memory-map' as const,
                            label: 'Memory Map',
                            sub: 'Address space layout',
                            icon: <MemoryStick className="w-5 h-5" />,
                            accent: 'text-purple-400',
                            border: 'border-purple-400/30',
                            bg: 'bg-purple-400/10',
                            hover: 'hover:border-purple-400 hover:bg-purple-400/15',
                          },
                          {
                            id: 'irq-map' as const,
                            label: 'IRQ / Interrupt Map',
                            sub: 'Interrupt assignments',
                            icon: <Zap className="w-5 h-5" />,
                            accent: 'text-neon-amber',
                            border: 'border-neon-amber/30',
                            bg: 'bg-neon-amber/10',
                            hover: 'hover:border-neon-amber hover:bg-neon-amber/15',
                          },
                          {
                            id: 'clock-tree' as const,
                            label: 'Clock Tree',
                            sub: 'Domain & frequency map',
                            icon: <Network className="w-5 h-5" />,
                            accent: 'text-neon-emerald',
                            border: 'border-neon-emerald/30',
                            bg: 'bg-neon-emerald/10',
                            hover: 'hover:border-neon-emerald hover:bg-neon-emerald/15',
                          },
                          {
                            id: 'peripheral-list' as const,
                            label: 'Peripheral Matrix',
                            sub: 'All bus & driver entries',
                            icon: <CpuIcon className="w-5 h-5" />,
                            accent: 'text-blue-400',
                            border: 'border-blue-400/30',
                            bg: 'bg-blue-400/10',
                            hover: 'hover:border-blue-400 hover:bg-blue-400/15',
                          },
                        ].map((view) => (
                          <button
                            key={view.id}
                            onClick={() => setActiveModal(view.id)}
                            className={`group flex items-start gap-3 p-4 rounded-xl border ${view.border} ${view.bg} ${view.hover} transition-all duration-200 text-left cursor-pointer`}
                          >
                            <div className={`shrink-0 mt-0.5 ${view.accent} group-hover:scale-110 transition-transform duration-150`}>
                              {view.icon}
                            </div>
                            <div className="min-w-0">
                              <p className={`text-sm font-bold leading-tight ${view.accent}`}>{view.label}</p>
                              <p className="text-[11px] text-text-muted mt-0.5 leading-snug">{view.sub}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Modals */}
                    <Modal
                      isOpen={activeModal === 'block-diagram'}
                      onClose={() => setActiveModal(null)}
                      title="Interactive RTL / Block Design Diagram"
                      subtitle="SoC topology — click any block to inspect"
                      icon={<GitBranch className="w-4.5 h-4.5" />}
                      accentColor="text-neon-cyan"
                      size="xl"
                    >
                      <BlockDiagram
                        peripherals={peripherals}
                        processorName={activePreset ? activePreset.name : customProcessorName}
                      />
                    </Modal>

                    <Modal
                      isOpen={activeModal === 'memory-map'}
                      onClose={() => setActiveModal(null)}
                      title="Memory Map"
                      subtitle="Address space layout & BSP drivers"
                      icon={<MemoryStick className="w-4.5 h-4.5" />}
                      accentColor="text-purple-400"
                      size="xl"
                    >
                      <MapViewer peripherals={peripherals} />
                    </Modal>

                    <Modal
                      isOpen={activeModal === 'irq-map'}
                      onClose={() => setActiveModal(null)}
                      title="IRQ / Interrupt Map"
                      subtitle="Interrupt assignments & vector table"
                      icon={<Zap className="w-4.5 h-4.5" />}
                      accentColor="text-neon-amber"
                      size="xl"
                    >
                      <MapViewer peripherals={peripherals} defaultTab="irq" />
                    </Modal>

                    <Modal
                      isOpen={activeModal === 'clock-tree'}
                      onClose={() => setActiveModal(null)}
                      title="Clock Tree"
                      subtitle="Clock domain & frequency distribution"
                      icon={<Network className="w-4.5 h-4.5" />}
                      accentColor="text-neon-emerald"
                      size="xl"
                    >
                      <MapViewer peripherals={peripherals} defaultTab="clock" />
                    </Modal>

                    <Modal
                      isOpen={activeModal === 'peripheral-list'}
                      onClose={() => setActiveModal(null)}
                      title="Peripheral Matrix"
                      subtitle="All registered bus & driver entries"
                      icon={<CpuIcon className="w-4.5 h-4.5" />}
                      accentColor="text-blue-400"
                      size="xl"
                    >
                      <MapViewer peripherals={peripherals} defaultTab="bsp" />
                    </Modal>

                  </div>
                )}

                {currentStep === 'synthesis' && (
                  <div className="space-y-6">
                    <CodeSynthesis
                      activePreset={activePreset}
                      peripherals={peripherals}
                      requirement={engineeringRequirement}
                      requirementPlan={requirementPlan}
                      onCodeUpdate={handleCodeUpdate}
                    />
                    <KnowledgeGraph
                      processorName={activePreset ? activePreset.name : customProcessorName}
                      peripherals={peripherals}
                    />
                  </div>
                )}

                {currentStep === 'terminal' && (
                  <div className="flex flex-col gap-6">
                    {/* Step 4 Target Flow & Hardware Lock Panel */}
                    <div className="p-5 rounded-2xl border border-neon-cyan/30 bg-obsidian-100/60 backdrop-blur-md shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-text-primary text-base font-bold flex items-center gap-2">
                            🤖 Autonomous Engineering Agent
                          </h3>
                          <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-md border font-bold ${
                            lockStatus === 'frozen'
                              ? 'text-neon-emerald bg-neon-emerald/10 border-neon-emerald/30'
                              : 'text-neon-amber bg-neon-amber/10 border-neon-amber/30'
                          }`}>
                            {lockStatus === 'frozen' ? 'LOCKED ✓' : 'UNLOCKED'}
                          </span>
                        </div>
                        <p className="text-text-muted text-xs">
                          Select mandatory target flow, perform final pre-flight validation, and click Lock Hardware to launch autonomous execution.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <div className="flex flex-col">
                          <label className="text-[10px] font-mono text-text-muted uppercase tracking-wider mb-1">Target Flow *</label>
                          <select
                            value={targetFlow}
                            disabled={lockStatus === 'frozen'}
                            onChange={(e) => setTargetFlow(e.target.value as any)}
                            className="bg-obsidian border border-neon-cyan/40 text-neon-cyan text-xs font-mono font-bold rounded-lg px-3 py-1.5 focus:outline-none focus:border-neon-cyan disabled:opacity-60"
                          >
                            <option value="">-- Select Target Flow * --</option>
                            <option value="linux">Linux Only</option>
                            <option value="bare_metal">Bare Metal Only</option>
                            <option value="both">Both (BM & Linux)</option>
                          </select>
                        </div>

                        <button
                          disabled={lockStatus === 'frozen' || compilationStatus === 'running'}
                          onClick={async () => {
                            if (!targetFlow) {
                              alert("Select Target Flow before starting autonomous execution.");
                              return;
                            }
                            try {
                              console.log(`[WORKFLOW] Lock button clicked | Target flow: ${targetFlow}`);
                              // 1. Lock Hardware
                              const lockRes = await fetch('/api/hardware/lock', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  hkl: { peripherals, boardName: activePreset ? activePreset.name : hwBoardName, processorName: customProcessorName },
                                  targetFlow,
                                  sessionContext: { sessionId: pipelineSessionId, boardName: activePreset ? activePreset.name : hwBoardName, processorName: customProcessorName, vendor: hwVendor, architecture: hwArchitecture }
                                })
                              }).then(r => r.json());

                              if (!lockRes.success || !lockRes.hardwareLock) {
                                alert(lockRes.error || "Select Target Flow before starting autonomous execution.");
                                return;
                              }

                              setLockStatus('frozen');
                              console.log(`[LOCK] Hardware lock successful | lockId: ${lockRes.hardwareLock.hardwareLockId}`);
                              console.log(`[WORKFLOW] Hardware locked | Advancing to AUTONOMOUS_ENGINEERING`);

                              // 2. Automatically Start Autonomous Agent (No second click needed!)
                              console.log(`[AGENT] Automatically starting autonomous execution for ${targetFlow}...`);
                              const startRes = await fetch('/api/agent/start', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  hardwareLock: lockRes.hardwareLock,
                                  sessionContext: { sessionId: pipelineSessionId, peripherals }
                                })
                              }).then(r => r.json());

                              if (startRes.success && startRes.executionState) {
                                console.log(`[AGENT] Agent started successfully | executionId: ${startRes.executionState.executionId}`);
                                setCompilationStatus('running');
                                handleRunCompilation();
                              } else {
                                alert(`Autonomous Agent Start Failed: ${startRes.error || 'Unknown error'}`);
                              }
                            } catch (err: any) {
                              alert(`Hardware Lock / Autonomous Agent Error: ${err.message}`);
                            }
                          }}
                          className={`mt-3 md:mt-0 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                            lockStatus === 'frozen'
                              ? 'bg-neon-emerald/20 text-neon-emerald border border-neon-emerald/40 cursor-not-allowed'
                              : 'bg-neon-cyan text-obsidian hover:bg-neon-cyanDim shadow-lg shadow-neon-cyan/20 cursor-pointer'
                          }`}
                        >
                          <Zap className="w-4 h-4" />
                          {lockStatus === 'frozen' ? 'HARDWARE LOCKED ✓' : 'LOCK HARDWARE'}
                        </button>
                      </div>
                    </div>

                    {lockStatus !== 'frozen' && (
                      <div className="p-4 rounded-xl border border-neon-amber/40 bg-neon-amber/5 flex items-start gap-3">
                        <span className="text-neon-amber text-lg mt-0.5">⚠</span>
                        <div>
                          <p className="text-neon-amber text-sm font-bold">Hardware Not Locked</p>
                          <p className="text-text-muted text-xs mt-1">Select your mandatory <strong>Target Flow</strong> above and click <strong>LOCK HARDWARE</strong> to lock hardware and automatically start autonomous engineering execution.</p>
                        </div>
                      </div>
                    )}


                    {/* Compilation loading banner — visible during initial Vivado startup */}
                    {compilationStatus === 'running' && terminalOutput.length <= 5 && (
                      <div className="flex flex-col items-center justify-center py-12 gap-4 rounded-2xl border border-neon-cyan/20 bg-neon-cyan/5">
                        <div className="flex items-center gap-3">
                          <div className="w-5 h-5 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />
                          <span className="text-neon-cyan font-mono text-sm font-semibold tracking-wide">Initializing Vivado Design Suite...</span>
                        </div>
                        <p className="text-text-muted text-xs font-mono">Launching background toolchain & validating block design (takes 1-2 mins)</p>
                        <div className="flex gap-1.5 mt-1">
                          {[0, 1, 2, 3, 4].map(i => (
                            <div
                              key={i}
                              className="w-1.5 h-1.5 rounded-full bg-neon-cyan/60"
                              style={{ animation: `pulse 1.2s ease-in-out ${i * 0.15}s infinite` }}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    <TerminalStream
                      terminalOutput={terminalOutput}
                      compilationStatus={compilationStatus}
                      onEmergencyReset={handleEmergencyReset}
                      onResumeBuild={handleRunCompilation}
                      inputType={uploadedInputType}
                    />

                    <SimulationStatus
                      hasPeripherals={peripherals.length > 0}
                      compilationSuccess={compilationStatus === 'success'}
                    />
                  </div>
                )}


                {currentStep === 'conclusion' && (
                  <div className="space-y-6">
                    <ConclusionView
                      peripherals={peripherals}
                      compilationStatus={compilationStatus}
                      architecture={hwArchitecture}
                      boardName={activePreset ? activePreset.name : hwBoardName}
                      fpgaDevice={hwFpgaDevice}
                      processorName={activePreset ? activePreset.name : customProcessorName}
                      memorySize={hwMemorySize}
                      flashType={hwFlashType}
                      validationReport={validationReport}
                      decisionLog={decisionLog}
                      confidenceScores={confidenceScores}
                      compiledElfUrl={compiledElfUrl}
                      targetFlow={activePreset?.supportedFlow ? (activePreset.supportedFlow.toLowerCase() as any) : targetFlow}
                      bareMetalCode={currentBareMetalCode}
                      deviceTreeCode={currentDeviceTreeCode}
                      bspFiles={generatedBspFiles}
                    />

                    {/* ── Universal Validation Engine (Non-FPGA Validation Suite) ── */}
                    <UniversalValidationView
                      report={universalReport}
                      loading={universalLoading}
                      onRerun={handleRunUniversalValidation}
                      platformName={activePreset ? activePreset.name : customProcessorName}
                    />
                    
                    {/* PDF Generation Panel */}
                    <div className="bg-neon-cyan/5 border border-neon-cyan/30 rounded-xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-3 bg-neon-cyan/20 rounded-xl border border-neon-cyan/30 text-neon-cyan">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="text-text-primary text-sm font-bold">Generate Engineering Report PDF</h4>
                          <p className="text-text-muted text-[11px] mt-0.5 leading-relaxed">
                            Compile all parsed registers, IRQ bindings, clock topologies, and build diagnostics into a formal AMD-aligned documentation.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleGenerateReport}
                        disabled={generatingReport}
                        className="px-6 py-2.5 bg-neon-cyan text-obsidian rounded-xl font-semibold text-xs uppercase tracking-wider hover:bg-neon-cyanDim disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                      >
                        {generatingReport ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-obsidian border-t-transparent rounded-full animate-spin" />
                            Compiling PDF...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4" />
                            Download PDF Report
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Bar */}
              <div className="px-6 py-4 bg-obsidian-50/80 border-t border-border-grid">
                <div className="flex items-center justify-between">
                  <button
                    onClick={goToPrevStep}
                    disabled={currentStepIndex === 0}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                      currentStepIndex === 0
                        ? 'bg-obsidian-100 text-text-muted cursor-not-allowed opacity-50'
                        : 'bg-obsidian-100 border border-border-grid text-text-secondary hover:border-neon-cyan/30 hover:text-text-primary'
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>

                  {currentStep === 'terminal' ? (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 mr-2">
                        <span className="text-[11px] text-text-muted font-mono font-bold uppercase tracking-wider">Target Flow:</span>
                        <select
                          value={targetFlow}
                          onChange={(e) => setTargetFlow(e.target.value as 'bare_metal' | 'linux' | 'both')}
                          disabled={compilationStatus === 'running'}
                          className="bg-obsidian-100 border border-border-grid text-text-primary text-[11px] font-bold rounded-lg px-2.5 py-1.5 outline-none focus:border-neon-cyan/50 transition-all cursor-pointer disabled:opacity-50"
                        >
                          {supportedFlowOptions.map((opt) => (
                            <option key={opt.value} value={opt.value} className="bg-obsidian">
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={handleRunCompilation}
                        disabled={compilationStatus === 'running' || lockStatus !== 'frozen'}
                        title={lockStatus !== 'frozen' ? 'Lock Schema first in Peripheral Config' : ''}
                        className={`flex items-center gap-2.5 px-8 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                          compilationStatus === 'running'
                            ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan cursor-wait'
                            : compilationStatus === 'success'
                            ? 'bg-neon-emerald text-obsidian hover:bg-neon-emeraldDim shadow-neon-emerald'
                            : lockStatus !== 'frozen'
                            ? 'bg-obsidian-100 text-text-muted cursor-not-allowed opacity-50'
                            : 'bg-gradient-to-r from-neon-cyan to-neon-emerald text-obsidian hover:shadow-neon-cyan'
                        }`}
                      >
                        {compilationStatus === 'running' ? (
                          <>
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            Compiling...
                          </>
                        ) : compilationStatus === 'success' ? (
                          <>
                            <Check className="w-4 h-4" />
                            Compilation Complete
                          </>
                        ) : (
                          'Run Compilation Sandbox'
                        )}
                      </button>
                      {(compilationStatus === 'success' || compilationStatus === 'error') && (
                        <>
                          {compiledElfUrl && (
                            <a
                              href={compiledElfUrl}
                              download="firmware.elf"
                              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-neon-emerald text-obsidian hover:bg-neon-emeraldDim transition-all cursor-pointer"
                            >
                              Download firmware.elf
                            </a>
                          )}
                          <button
                            onClick={handleGenerateReport}
                            disabled={generatingReport}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm border border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 transition-all cursor-pointer"
                          >
                            {generatingReport ? 'Compiling PDF...' : 'Download PDF Report'}
                          </button>
                          <button
                            onClick={goToNextStep}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-neon-cyan to-neon-emerald text-obsidian hover:shadow-neon-cyan transition-all"
                          >
                            Next Step
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={goToNextStep}
                      disabled={!canGoNext()}
                      className={`flex items-center gap-2 px-8 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                        !canGoNext()
                          ? 'bg-obsidian-100 text-text-muted cursor-not-allowed opacity-50'
                          : 'bg-gradient-to-r from-neon-cyan to-neon-emerald text-obsidian hover:shadow-neon-cyan'
                      }`}
                    >
                      Next Step
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

        {/* COLLAPSED VERTICAL CHIPGENIE TAB ON FAR RIGHT */}
        {!showAiAssistant && (
          <div className="relative z-30 shrink-0 flex items-center h-full border-l border-border-grid bg-obsidian">
            <button
              onClick={toggleAiAssistant}
              title="Open ChipGenie - AI Embedded Engineering Assistant"
              className="group px-2 py-4 flex flex-col items-center gap-3 bg-neon-cyan/10 hover:bg-neon-cyan/20 border-l border-neon-cyan/40 text-neon-cyan transition-all cursor-pointer select-none"
            >
              <div className="relative">
                <Bot className="w-5 h-5 animate-pulse group-hover:scale-110 transition-transform" />
                {hasUnreadAiMessage && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-neon-cyan rounded-full ring-2 ring-obsidian animate-ping" />
                )}
              </div>
              <span
                className="text-[11px] font-bold font-mono uppercase tracking-widest text-text-secondary group-hover:text-neon-cyan transition-colors"
                style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
              >
                🤖 ChipGenie
              </span>
            </button>
          </div>
        )}

        {showBenchmark && (
          <BenchmarkDashboard
            onClose={() => setShowBenchmark(false)}
            peripherals={peripherals}
            generatedDts={currentDeviceTreeCode}
            generatedTcl={""}
            generatedBsp={currentBareMetalCode}
            architecture={hwArchitecture}
          />
        )}

        {/* RESIZABLE RIGHT-SIDE AI PANEL */}
        <AiAssistantDrawer
          isOpen={showAiAssistant}
          onClose={() => setShowAiAssistant(false)}
          peripherals={peripherals}
          processorName={activePreset?.name || customProcessorName}
          architecture={hwArchitecture}
          boardName={hwBoardName}
          compilationStatus={compilationStatus}
          terminalOutput={terminalOutput}
          currentStep={currentStep}
          bareMetalCode={currentBareMetalCode}
          deviceTreeCode={currentDeviceTreeCode}
          compiledElfUrl={compiledElfUrl}
          onNewUnreadMessage={() => setHasUnreadAiMessage(true)}
        />
    </div>
  );
}
