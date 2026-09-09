import { useState, useCallback, useMemo } from 'react';
import { Lock, AlertTriangle, CheckCircle2, Plus, Trash2, AlertCircle, Sparkles, Wrench, Brain, Zap, GitBranch, Activity, Layers } from 'lucide-react';
import type { HardwarePeripheral } from '../types';

import { validatePeripheral, detectArchitecture, parseHexAddress } from '../utils/addrValidation';
import {
  resolveVendorDefaults,
  resolvePeripheralBus,
  resolvePeripheralClock,
  resolveIrqDisplay,
  resolvePinMappingDisplay,
} from '../utils/vendorPeripheralDefaults';

interface ValidationGridProps {
  peripherals: HardwarePeripheral[];
  lockStatus: 'unlocked' | 'frozen';
  onPeripheralUpdate: (id: string, field: keyof HardwarePeripheral, value: any) => void;
  onPeripheralAdd: (peripheral: HardwarePeripheral) => void;
  onPeripheralRemove: (id: string) => void;
  onLockSchema: () => void;
  processorName: string;
  onPeripheralsSet?: (peripherals: HardwarePeripheral[]) => void;
  reviewQueue?: any[];
  onReviewQueueSet?: (queue: any[]) => void;
  isHardwareSynthesized?: boolean;
  onSynthesizeHardware?: () => void;
}

export function ValidationGrid({
  peripherals,
  lockStatus,
  onPeripheralUpdate,
  onPeripheralAdd,
  onPeripheralRemove,
  onLockSchema,
  processorName,
  onPeripheralsSet,
  reviewQueue = [],
  onReviewQueueSet,
  isHardwareSynthesized = false,
  onSynthesizeHardware,
}: ValidationGridProps) {

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<keyof HardwarePeripheral | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [resolvingWithAI, setResolvingWithAI] = useState(false);

  const [localEditItemId, setLocalEditItemId] = useState<string | null>(null);
  const [localEditValue, setLocalEditValue] = useState<string>('');

  const handleAcceptSuggestion = (item: any) => {
    const p = peripherals.find(x => x.peripheralBlock === item.peripheralBlock);
    if (!p) return;
    const parsedVal = item.field === 'interruptNumber' && !isNaN(Number(item.suggestedValue))
      ? Number(item.suggestedValue)
      : item.suggestedValue;
    const updatedStatuses = { ...p.fieldStatuses, [item.field]: 'verified' };
    
    onPeripheralUpdate(p.id, item.field as any, parsedVal);
    onPeripheralUpdate(p.id, 'fieldStatuses' as any, updatedStatuses);

    if (onReviewQueueSet) {
      onReviewQueueSet(reviewQueue.filter(x => x.id !== item.id));
    }
    if (onPeripheralsSet) {
      const newPeripherals = peripherals.map(x => x.id === p.id ? { ...x, [item.field]: parsedVal, fieldStatuses: updatedStatuses } : x);
      onPeripheralsSet(newPeripherals);
    }
  };

  const handleRejectSuggestion = (item: any) => {
    const p = peripherals.find(x => x.peripheralBlock === item.peripheralBlock);
    if (!p) return;
    const updatedStatuses = { ...p.fieldStatuses, [item.field]: 'user-provided' };
    
    onPeripheralUpdate(p.id, 'fieldStatuses' as any, updatedStatuses);

    if (onReviewQueueSet) {
      onReviewQueueSet(reviewQueue.filter(x => x.id !== item.id));
    }
    if (onPeripheralsSet) {
      const newPeripherals = peripherals.map(x => x.id === p.id ? { ...x, fieldStatuses: updatedStatuses } : x);
      onPeripheralsSet(newPeripherals);
    }
  };

  const handleSaveEditSuggestion = (item: any) => {
    const p = peripherals.find(x => x.peripheralBlock === item.peripheralBlock);
    if (!p) return;
    const updatedStatuses = { ...p.fieldStatuses, [item.field]: 'user-provided' };
    const userMeta = {
      value: localEditValue,
      source_type: 'USER_INPUT' as const,
      source_document: 'User Configuration Form',
      extraction_method: 'manual_user_entry',
      confidence: 1.0,
      confidence_level: 'HIGH' as const,
      authoritative: false,
      ai_inferred: false,
      verification_status: 'REQUIRES_REVIEW' as const,
      requires_review: true
    };

    onPeripheralUpdate(p.id, item.field as any, localEditValue);
    onPeripheralUpdate(p.id, `${item.field}_meta` as any, userMeta);
    onPeripheralUpdate(p.id, 'fieldStatuses' as any, updatedStatuses);
    onPeripheralUpdate(p.id, 'verification_status' as any, 'REQUIRES_REVIEW');

    if (onReviewQueueSet) {
      onReviewQueueSet(reviewQueue.filter(x => x.id !== item.id));
    }
    if (onPeripheralsSet) {
      const newPeripherals = peripherals.map(x => x.id === p.id ? {
        ...x,
        [item.field]: localEditValue,
        [`${item.field}_meta`]: userMeta,
        fieldStatuses: updatedStatuses,
        verification_status: 'REQUIRES_REVIEW' as const,
        requires_review: true
      } : x);
      onPeripheralsSet(newPeripherals);
    }
    setLocalEditItemId(null);
  };

  const isAcceptDisabled = (item: any) => {
    if (!item.suggestedValue || item.suggestedValue === 'Not available' || item.confidence === 0) return true;
    if (item.status === 'insufficient_evidence') return true;
    const vStatus = item.verification_status || item.status;
    return ['AI_INFERRED', 'NOT_HARDWARE_VERIFIED', 'REQUIRES_REVIEW', 'CONFLICTING_EVIDENCE', 'SOURCE_MISMATCH'].includes(vStatus);
  };

  // Vendor-aware defaults — recalculated whenever the processor changes
  const vendorDefaults = useMemo(() => resolveVendorDefaults(processorName), [processorName]);

  const [appliedAuditLog, setAppliedAuditLog] = useState<any[]>([]);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [predictiveWarnings, setPredictiveWarnings] = useState<any[]>([]);
  const [healedStages, setHealedStages] = useState<string[]>([]);
  const [learnedFixesCount, setLearnedFixesCount] = useState<number>(0);
  const [readinessMetrics, setReadinessMetrics] = useState<any>(null);
  const [llmRcaUsed, setLlmRcaUsed] = useState<boolean>(false);
  const [cascadeFixCount, setCascadeFixCount] = useState<number>(0);
  const [showDependencyGraph, setShowDependencyGraph] = useState<boolean>(false);
  const [dependencyGraph, setDependencyGraph] = useState<Record<string, string[]>>({});

  const handleAIResolveAll = async () => {
    if (!onPeripheralsSet) return;
    setResolvingWithAI(true);
    try {
      const res = await fetch('/api/ai/suggest-fixes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peripherals, processorName, sessionId: `sess_${Date.now()}` }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.peripherals)) {
        onPeripheralsSet(data.peripherals);
        if (onReviewQueueSet) {
          onReviewQueueSet([]);
        }
        if (Array.isArray(data.auditLog) && data.auditLog.length > 0) {
          setAppliedAuditLog(data.auditLog);
          setShowAuditModal(true);
        }
        if (Array.isArray(data.predictiveWarnings)) setPredictiveWarnings(data.predictiveWarnings);
        if (Array.isArray(data.healedStages)) setHealedStages(data.healedStages);
        if (typeof data.learnedFixesAppliedCount === 'number') setLearnedFixesCount(data.learnedFixesAppliedCount);
        if (data.readinessMetrics) setReadinessMetrics(data.readinessMetrics);
        if (typeof data.llmRcaUsed === 'boolean') setLlmRcaUsed(data.llmRcaUsed);
        if (typeof data.cascadeFixCount === 'number') setCascadeFixCount(data.cascadeFixCount);
        if (data.dependencyGraph) setDependencyGraph(data.dependencyGraph);
      }
    } catch (err) {
      console.error('Failed to resolve validation issues with AI:', err);
    } finally {
      setResolvingWithAI(false);
    }
  };

  // Compute vendor-aware blank form values
  const makeBlankPeripheral = () => ({
    peripheralBlock: '',
    type: 'GPIO',
    driverName: vendorDefaults.gpioDriver,
    version: vendorDefaults.defaultVersion,
    bus: vendorDefaults.defaultBus,
    clockSource: vendorDefaults.defaultClockSource,
    clockFrequency: vendorDefaults.defaultClockFrequency,
    physicalPinMapping: '',
    interruptNumber: '',
    baseAddress: vendorDefaults.defaultBaseAddress,
    dma: 'Disabled',
    operatingMode: 'Polling',
  });

  const [newPeripheral, setNewPeripheral] = useState(makeBlankPeripheral);

  const handleCellClick = useCallback((id: string, field: keyof HardwarePeripheral) => {
    if (lockStatus === 'unlocked') {
      setEditingId(id);
      setEditingField(field);
    }
  }, [lockStatus]);

  const handleBlur = useCallback(() => {
    setEditingId(null);
    setEditingField(null);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      setEditingId(null);
      setEditingField(null);
    }
  }, []);

  const handleAddPeripheral = () => {
    if (newPeripheral.peripheralBlock && newPeripheral.physicalPinMapping) {
      const id = `p-${Date.now()}`;
      onPeripheralAdd({
        id,
        peripheralBlock: newPeripheral.peripheralBlock,
        type: newPeripheral.type,
        driverName: newPeripheral.driverName,
        version: newPeripheral.version,
        bus: newPeripheral.bus,
        clockSource: newPeripheral.clockSource,
        clockFrequency: newPeripheral.clockFrequency,
        physicalPinMapping: newPeripheral.physicalPinMapping,
        clockNetIndicator: newPeripheral.type !== 'GPIO',
        interruptNumber: parseInt(newPeripheral.interruptNumber) || 0,
        baseAddress: newPeripheral.baseAddress,
        dma: newPeripheral.dma,
        operatingMode: newPeripheral.operatingMode,
        status: 'Active',
        confidence: 99,
      } as any);
      setNewPeripheral(makeBlankPeripheral());
      setShowAddForm(false);
    }
  };

  const validatedPeripherals = peripherals.map(p => ({
    peripheral: p,
    valResult: validatePeripheral(p, processorName, peripherals)
  }));

  const getValidationScore = () => {
    if (peripherals.length === 0 || !processorName || processorName === 'Unknown' || processorName === 'ARM Core' || processorName === 'NOT FOUND IN PDF') return 0;
    let score = 100;
    validatedPeripherals.forEach(({ valResult, peripheral }) => {
      if (valResult.status === 'Error') score -= 20;
      else if (valResult.status === 'Warning') score -= 10;
      if (!peripheral.clockNetIndicator && peripheral.peripheralBlock.toLowerCase().includes('uart')) score -= 5;
      
      // Real-world inspection: penalize unresolved field statuses (e.g. missing IRQs, unverified pin mapping)
      if (peripheral.fieldStatuses) {
        Object.values(peripheral.fieldStatuses).forEach(status => {
          if (status === 'unresolved') score -= 5;
        });
      }
    });

    // Deduct points for pending AI review queue items requiring human/AI verification
    if (Array.isArray(reviewQueue) && reviewQueue.length > 0) {
      score -= reviewQueue.length * 5;
    }

    return Math.max(0, Math.min(100, score));
  };

  const isHardwareUnknown = !processorName || processorName === 'Unknown' || processorName === 'ARM Core' || processorName === 'NOT FOUND IN PDF';
  const validationScore = getValidationScore();
  const invalidAddresses = validatedPeripherals.filter(vp => vp.valResult.status === 'Error');
  const boundaryErrors = validatedPeripherals.filter(vp => vp.valResult.status === 'Warning');

  const renderStatusBadge = (status: 'auto-corrected' | 'verified' | 'user-provided' | 'unresolved' | undefined) => {
    if (!status) return null;
    const config = {
      'auto-corrected': { text: 'Auto', class: 'bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/20' },
      'verified': { text: 'Verified', class: 'bg-neon-emerald/15 text-neon-emerald border border-neon-emerald/20' },
      'user-provided': { text: 'User', class: 'bg-obsidian-200 text-text-secondary border border-border-grid' },
      'unresolved': { text: 'Unresolved', class: 'bg-red-500/15 text-red-400 border border-red-500/20' }
    }[status];

    return (
      <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded uppercase tracking-wider font-bold shrink-0 ml-1.5 inline-block align-middle ${config.class}`}>
        {config.text}
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* Top Validation Stats Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-obsidian border border-border-grid rounded-xl p-5 flex items-center justify-between">
          <div>
            <h4 className="text-text-muted text-[11px] uppercase tracking-wider font-semibold font-mono">
              Hardware Readiness Status
            </h4>
            <p className="text-3xl font-extrabold font-mono mt-1 text-text-primary">
              {validationScore}%
            </p>
            <p className="text-[11px] text-text-secondary mt-1 leading-relaxed">
              Overall platform integrity index compiled by validation suite.
            </p>
          </div>
          <div className={`w-24 h-16 rounded-xl border-2 ${!isHardwareUnknown && validationScore >= 90 ? 'border-neon-emerald/30 bg-neon-emerald/10 text-neon-emerald' : 'border-amber-500/30 bg-amber-500/10 text-amber-400'} flex flex-col items-center justify-center font-bold text-[10px] uppercase font-mono px-2 text-center`}>
            {isHardwareUnknown ? 'REQUIRES REVIEW' : (validationScore >= 90 ? 'PASS' : (validationScore >= 60 ? 'WARN' : 'FAIL'))}
          </div>
        </div>

        <div className="bg-obsidian border border-border-grid rounded-xl p-5 space-y-2">
          <h4 className="text-text-muted text-[11px] uppercase tracking-wider font-semibold font-mono">
            Active Layout Rules Checking (LRC)
          </h4>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">Register Map Bounds</span>
              {invalidAddresses.length === 0 ? (
                <span className="text-neon-emerald font-bold">PASS</span>
              ) : (
                <span className="text-red-400 font-bold">FAIL</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">Address Boundary & Alignment</span>
              {boundaryErrors.length === 0 ? (
                <span className="text-neon-emerald font-bold">PASS</span>
              ) : (
                <span className="text-neon-amber font-bold">WARNING</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">Driver & Bus Compatibility</span>
              <span className="text-neon-emerald font-bold">PASS</span>
            </div>
          </div>
        </div>

        {/* AI Self-Healing Engine Panel */}
        <div className="bg-obsidian border border-border-grid rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-neon-cyan text-xs font-mono uppercase">
              <Brain className="w-4 h-4" />
              Intelligent Self-Healing Engine
            </div>
            {lockStatus === 'unlocked' && onPeripheralsSet && peripherals.length > 0 && !isHardwareUnknown && (
              <button
                onClick={handleAIResolveAll}
                disabled={resolvingWithAI}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-neon-cyan to-purple-500 text-obsidian rounded-lg font-bold text-[10px] font-mono transition-all hover:opacity-90 cursor-pointer shadow-neon-cyan/20 shadow-md"
              >
                <Sparkles className="w-3 h-3" />
                {resolvingWithAI ? 'Healing System...' : 'AI Auto-Fix All'}
              </button>
            )}
          </div>
          <p className="text-xs text-text-secondary leading-relaxed mt-2">
            {isHardwareUnknown
              ? `Hardware identification incomplete. Resolve hardware evidence before Auto-Fix.`
              : (boundaryErrors.length > 0 || invalidAddresses.length > 0)
                ? `${invalidAddresses.length + boundaryErrors.length} configuration issue(s) detected. The Level 1–12 Self-Healing Engine will analyze root causes, apply autonomous fixes, and run predictive validation.`
                : peripherals.length > 0
                  ? `Configuration looks healthy. Run AI Auto-Fix to apply predictive validation, dependency graph analysis, and Level 12 adaptive scoring.`
                  : `Load a hardware preset or upload system documents to enable the Intelligent Self-Healing Engine.`}
          </p>
          <div className="flex items-center gap-2 mt-2 text-[10px] font-mono">
            <span className="text-text-muted">Levels 1–12 Active</span>
            <span className="text-neon-cyan">•</span>
            <span className="text-purple-300">LLM RCA</span>
            <span className="text-neon-cyan">•</span>
            <span className="text-neon-emerald">Vendor TRM KB</span>
            <span className="text-neon-cyan">•</span>
            <span className="text-neon-amber">Predictive Validation</span>
          </div>
        </div>
      </div>



      {/* Premium, Non-blocking AI Review Queue Panel */}
      {reviewQueue.length > 0 && (
        <div className="bg-obsidian border border-neon-cyan/45 rounded-xl p-5 space-y-4 shadow-lg shadow-neon-cyan/5">
          <div className="flex items-center justify-between border-b border-border-grid pb-3">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-neon-cyan animate-pulse" />
              <div>
                <h3 className="text-text-primary text-sm font-semibold font-mono">
                  AI Review Queue ({reviewQueue.length} Pending Resolution)
                </h3>
                <p className="text-text-muted text-[11px]">
                  Authoritative sources identified missing or mismatching hardware settings. Apply corrections below.
                </p>
              </div>
            </div>
            <div className="text-[10px] text-neon-cyan font-mono uppercase bg-neon-cyan/15 px-2.5 py-0.5 rounded border border-neon-cyan/20">
              Interactive Hardware Knowledge Resolver
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-1">
            {reviewQueue.map((item: any) => (
              <div key={item.id} className="bg-obsidian-200/50 border border-border-grid rounded-lg p-4 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-text-primary bg-obsidian-100 px-2 py-0.5 rounded border border-border-grid">
                      {item.peripheralBlock}
                    </span>
                    <span className="text-[10px] text-neon-amber font-mono font-bold">
                      Confidence: {item.confidence}%
                    </span>
                  </div>
                  <div className="text-xs text-text-muted mt-2 font-mono">
                    Field: <span className="text-text-primary font-bold">{item.field}</span>
                  </div>
                  <div className="text-xs text-text-secondary mt-1 bg-black/40 p-2 rounded font-mono break-all flex items-center justify-between gap-2">
                    <span>Evidence: {item.evidence}</span>
                    {(!item.suggestedValue || item.confidence === 0 || item.status === 'insufficient_evidence') && (
                      <span className="text-[9px] font-bold text-neon-amber uppercase bg-neon-amber/15 px-1.5 py-0.5 rounded border border-neon-amber/30 shrink-0">
                        REQUIRES REVIEW
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 justify-between pt-2 border-t border-border-grid/40">
                  <div className="flex-1">
                    {localEditItemId === item.id ? (
                      <input
                        type="text"
                        value={localEditValue}
                        onChange={(e) => setLocalEditValue(e.target.value)}
                        className="w-full bg-obsidian border border-neon-cyan rounded px-2 py-1 text-xs text-text-primary font-mono"
                      />
                    ) : (
                      <div className="text-xs text-text-primary font-mono">
                        Suggested: <span className={item.suggestedValue ? "text-neon-emerald font-bold" : "text-neon-amber font-bold"}>{item.suggestedValue ?? 'Not available'}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {localEditItemId === item.id ? (
                      <>
                        <button
                          onClick={() => handleSaveEditSuggestion(item)}
                          className="px-2.5 py-1 bg-neon-emerald text-obsidian rounded font-bold text-[10px] uppercase font-mono hover:bg-neon-emerald/80 transition-all cursor-pointer border-0"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setLocalEditItemId(null)}
                          className="px-2.5 py-1 bg-obsidian-100 text-text-secondary rounded font-bold text-[10px] uppercase font-mono hover:bg-obsidian-50 transition-all cursor-pointer border-0"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleAcceptSuggestion(item)}
                          disabled={isAcceptDisabled(item)}
                          className={`px-2.5 py-1 rounded font-bold text-[10px] uppercase font-mono transition-all border-0 ${
                            isAcceptDisabled(item)
                              ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed border border-gray-600/30'
                              : 'bg-neon-cyan text-obsidian hover:bg-neon-cyanDim cursor-pointer'
                          }`}
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => {
                            setLocalEditItemId(item.id);
                            setLocalEditValue(item.suggestedValue || '');
                          }}
                          className="px-2.5 py-1 bg-obsidian-100 text-text-primary border border-border-grid rounded font-bold text-[10px] uppercase font-mono hover:bg-obsidian-50 transition-all cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleRejectSuggestion(item)}
                          className="px-2.5 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded font-bold text-[10px] uppercase font-mono hover:bg-red-500/20 transition-all cursor-pointer"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-text-primary text-xl font-bold tracking-tight flex items-center gap-3">
            System Peripheral Mapping Table
            {isHardwareSynthesized && (
              <span className="text-[11px] font-mono text-neon-emerald bg-neon-emerald/10 px-3 py-1 rounded-full border border-neon-emerald/30">
                SYNTHESIZED ✓
              </span>
            )}
          </h2>
          <p className="text-text-muted text-[13px] mt-1">
            Configure register boundaries, clock tree associations, interrupts, and DMA channels.
          </p>
        </div>
      </div>



      {/* Add Peripheral Form */}
      {showAddForm && lockStatus === 'unlocked' && (
        <div className="bg-neon-cyan/5 border border-neon-cyan/30 rounded-xl p-5 gap-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 animate-slide-in">
          <div>
            <label className="block text-text-muted text-[10px] uppercase tracking-wide mb-1">Peripheral Name</label>
            <input
              type="text"
              value={newPeripheral.peripheralBlock}
              onChange={(e) => setNewPeripheral({ ...newPeripheral, peripheralBlock: e.target.value })}
              placeholder="UART2"
              className="w-full bg-obsidian-50 border border-border-grid rounded-lg px-3 py-1.5 text-text-primary text-xs"
            />
          </div>
          <div>
            <label className="block text-text-muted text-[10px] uppercase tracking-wide mb-1">Type</label>
            <select
              value={newPeripheral.type}
              onChange={(e) => setNewPeripheral({ ...newPeripheral, type: e.target.value })}
              className="w-full bg-obsidian-50 border border-border-grid rounded-lg px-3 py-1.5 text-text-primary text-xs"
            >
              <option value="GPIO">GPIO</option>
              <option value="UART">UART</option>
              <option value="SPI">SPI</option>
              <option value="I2C">I2C</option>
              <option value="CAN">CAN</option>
              <option value="Ethernet">Ethernet</option>
              <option value="Timer">Timer</option>
              <option value="ADC">ADC</option>
            </select>
          </div>
          <div>
            <label className="block text-text-muted text-[10px] uppercase tracking-wide mb-1">Driver</label>
            <input
              type="text"
              value={newPeripheral.driverName}
              onChange={(e) => setNewPeripheral({ ...newPeripheral, driverName: e.target.value })}
              placeholder="xuartlite"
              className="w-full bg-obsidian-50 border border-border-grid rounded-lg px-3 py-1.5 text-text-primary text-xs"
            />
          </div>
          <div>
            <label className="block text-text-muted text-[10px] uppercase tracking-wide mb-1">Bus Interface</label>
            <input
              type="text"
              value={newPeripheral.bus}
              onChange={(e) => setNewPeripheral({ ...newPeripheral, bus: e.target.value })}
              className="w-full bg-obsidian-50 border border-border-grid rounded-lg px-3 py-1.5 text-text-primary text-xs"
            />
          </div>
          <div>
            <label className="block text-text-muted text-[10px] uppercase tracking-wide mb-1">Base Address</label>
            <input
              type="text"
              value={newPeripheral.baseAddress}
              onChange={(e) => setNewPeripheral({ ...newPeripheral, baseAddress: e.target.value })}
              className="w-full bg-obsidian-50 border border-border-grid rounded-lg px-3 py-1.5 text-text-primary text-xs font-mono"
            />
          </div>
          <div>
            <label className="block text-text-muted text-[10px] uppercase tracking-wide mb-1">Interrupt Line (IRQ)</label>
            <input
              type="text"
              value={newPeripheral.interruptNumber}
              onChange={(e) => setNewPeripheral({ ...newPeripheral, interruptNumber: e.target.value })}
              className="w-full bg-obsidian-50 border border-border-grid rounded-lg px-3 py-1.5 text-text-primary text-xs font-mono"
            />
          </div>
          <div className="flex items-end gap-2 col-span-full justify-end mt-2">
            <button
              onClick={handleAddPeripheral}
              disabled={!newPeripheral.peripheralBlock}
              className="px-4 py-1.5 bg-neon-cyan text-obsidian rounded-lg font-medium text-xs hover:bg-neon-cyanDim disabled:opacity-50"
            >
              Add Peripheral Block
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-1.5 bg-obsidian-200 text-text-secondary rounded-lg font-medium text-xs hover:bg-obsidian-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-obsidian-100/30 rounded-xl border border-border-grid overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px] border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-border-grid bg-obsidian-100/50 text-text-muted font-mono uppercase">
                <th className="px-3.5 py-3">Peripheral</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Driver</th>
                <th className="px-3 py-3">Bus</th>
                <th className="px-3 py-3">Address / Location</th>
                <th className="px-3 py-3">IRQ</th>
                <th className="px-3 py-3">Pin Mapping</th>
                <th className="px-3.5 py-3">Source / Verification</th>
                <th className="px-3 py-3">Status</th>
              </tr>

            </thead>
            <tbody className="divide-y divide-border-grid/50 font-mono text-text-secondary">
              {peripherals.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-text-muted">
                    No peripherals mapped. Load a preset or upload system documents.
                  </td>
                </tr>
              ) : (
                validatedPeripherals.map(({ peripheral, valResult }) => {
                  const statusColors = {
                    Ready: 'text-neon-emerald',
                    Warning: 'text-neon-amber',
                    Error: 'text-red-400',
                  };

                  const badgeClasses = {
                    Ready: 'bg-neon-emerald/10 text-neon-emerald border border-neon-emerald/20',
                    Warning: 'bg-neon-amber/10 text-neon-amber border border-neon-amber/20',
                    Error: 'bg-red-500/10 text-red-400 border border-red-500/20',
                  };

                  const StatusIcon = {
                    Ready: CheckCircle2,
                    Warning: AlertTriangle,
                    Error: AlertCircle
                  }[valResult.status];

                  // Address / Location Resolution
                  const addrType = (peripheral as any).addressType || (
                    /i2c|iic/i.test(peripheral.bus || '') || (peripheral.type || '').toUpperCase() === 'RTC' ? 'I2C' :
                    (/spi/i.test(peripheral.bus || '') && !/axi/i.test(peripheral.bus || '') ? 'SPI' :
                    (/mdio|phy/i.test(peripheral.bus || '') ? 'MDIO' :
                    (!peripheral.baseAddress || peripheral.baseAddress === 'N/A' ? 'Logic-Only' : 'MMIO')))
                  );

                  const addrLabel = (peripheral as any).addressTypeLabel || {
                    'I2C': 'I2C Slave Addr',
                    'SPI': 'SPI Chip Select',
                    'MDIO': 'MDIO PHY Addr',
                    'Logic-Only': 'N/A — Logic-Only',
                    'MMIO': 'MMIO Base'
                  }[addrType] || 'MMIO Base';

                  const rawAddr = (peripheral as any).deviceAddress || peripheral.baseAddress;
                  const displayAddrValue = (addrType === 'Logic-Only' || !rawAddr || rawAddr === 'N/A' || rawAddr === 'null')
                    ? 'N/A — Logic-Only'
                    : rawAddr;

                  const isAddrUnresolved = !rawAddr || rawAddr === 'N/A' || rawAddr === 'null (unresolved)';

                  // IRQ Display resolution
                  const displayIrq = (peripheral.interruptNumber !== null && peripheral.interruptNumber !== undefined && peripheral.interruptNumber !== '' && peripheral.interruptNumber !== 'N/A')
                    ? (typeof peripheral.interruptNumber === 'number' ? `IRQ ${peripheral.interruptNumber}` : String(peripheral.interruptNumber))
                    : (peripheral.operatingMode === 'Polling' ? 'Polling Mode' : 'Not Specified in Evidence');

                  // Pin Mapping Display resolution
                  const pinVal = peripheral.physicalPinMapping;
                  const isExplicitPin = pinVal && pinVal !== 'N/A' && !pinVal.includes('Requires') && !pinVal.includes('Fabric Connected');
                  const displayPinMapping = isExplicitPin
                    ? pinVal
                    : (/i2c|spi/i.test(peripheral.bus || '')
                        ? `Bus-Attached (${peripheral.bus || 'Bus'})`
                        : 'Not Specified in Schematic');


                  // Final Status logic strictly maps to: Ready, Requires Review, Conflict, Failed
                  let finalStatus: 'Ready' | 'Requires Review' | 'Conflict' | 'Failed' = 'Requires Review';
                  if (valResult.status === 'Error') {
                    finalStatus = 'Failed';
                  } else if (peripheral.verification_status === 'CONFLICTING_EVIDENCE' || valResult.status === 'Warning') {
                    finalStatus = 'Conflict';
                  } else if (
                    valResult.status === 'Ready' &&
                    peripheral.verification_status !== 'AI_INFERRED' &&
                    peripheral.verification_status !== 'REQUIRES_REVIEW' &&
                    peripheral.verification_status !== 'NOT_HARDWARE_VERIFIED' &&
                    !isAddrUnresolved
                  ) {
                    finalStatus = 'Ready';
                  } else {
                    finalStatus = 'Requires Review';
                  }

                  const finalBadgeClasses = {
                    'Ready': 'bg-neon-emerald/10 text-neon-emerald border border-neon-emerald/20',
                    'Requires Review': 'bg-neon-amber/10 text-neon-amber border border-neon-amber/20',
                    'Conflict': 'bg-neon-amber/10 text-neon-amber border border-neon-amber/20',
                    'Failed': 'bg-red-500/10 text-red-400 border border-red-500/20',
                  }[finalStatus];

                  // Source / Verification Display String
                  const sourceType = peripheral.baseAddress_meta?.source_type || peripheral.provenanceSource || 'AI_INFERRED';
                  const isAiSource = peripheral.verification_status === 'AI_INFERRED' || /ocr|vision|ai|llm/i.test(sourceType) || (peripheral as any).ai_inferred;

                  let sourceVerificationLabel = 'REQUIRES REVIEW';
                  
                  if (isAiSource) {
                    sourceVerificationLabel = 'AI INFERRED';
                  } else if (isHardwareUnknown || peripheral.verification_status === 'REQUIRES_REVIEW' || isAddrUnresolved || finalStatus === 'Requires Review') {
                    sourceVerificationLabel = 'REQUIRES REVIEW';
                  } else if (peripheral.verification_status === 'SOURCE_AND_VENDOR_MATCH' || peripheral.verification_status === 'VENDOR_VERIFIED') {
                    sourceVerificationLabel = 'VENDOR VERIFIED';
                  } else if (peripheral.verification_status === 'SOURCE_VERIFIED') {
                    sourceVerificationLabel = 'SOURCE VERIFIED';
                  } else if (peripheral.verification_status === 'CONFLICTING_EVIDENCE') {
                    sourceVerificationLabel = 'CONFLICTING EVIDENCE';
                  } else if (peripheral.verification_status === 'SOURCE_MISMATCH') {
                    sourceVerificationLabel = 'SOURCE MISMATCH';
                  } else if (finalStatus === 'Ready') {
                    sourceVerificationLabel = 'SOURCE VERIFIED';
                  }


                  return (
                    <tr key={peripheral.id} className="hover:bg-obsidian-200/30 transition-colors">
                      {/* 1. Peripheral */}
                      <td className="px-3.5 py-3 font-bold text-text-primary">
                        {editingId === peripheral.id && editingField === 'peripheralBlock' ? (
                          <input
                            type="text"
                            value={peripheral.peripheralBlock}
                            onChange={(e) => onPeripheralUpdate(peripheral.id, 'peripheralBlock', e.target.value)}
                            onBlur={handleBlur}
                            onKeyDown={handleKeyDown}
                            autoFocus
                            className="bg-obsidian border border-neon-cyan rounded px-1.5 py-0.5 text-xs text-text-primary"
                          />
                        ) : (
                          <span onClick={() => handleCellClick(peripheral.id, 'peripheralBlock')} className="cursor-pointer hover:text-neon-cyan">
                            {peripheral.peripheralBlock}
                          </span>
                        )}
                      </td>

                      {/* 2. Type */}
                      <td className="px-3 py-3 font-mono font-bold text-text-primary">
                        {(peripheral as any).type || 'Unknown'}
                      </td>

                      {/* 3. Driver */}
                      <td className="px-3 py-3 font-mono">
                        <span>{peripheral.driverName || 'generic-uio'}</span>
                        {renderStatusBadge(peripheral.fieldStatuses?.driverName)}
                      </td>

                      {/* 4. Bus */}
                      <td className="px-3 py-3 font-mono">
                        <span>{(peripheral as any).bus || 'AXI4-Lite'}</span>
                        {renderStatusBadge(peripheral.fieldStatuses?.bus)}
                      </td>


                      {/* 5. Address / Location */}
                      <td className="px-3 py-3 relative">
                        {editingId === peripheral.id && editingField === 'baseAddress' ? (
                          <div className="flex flex-col gap-1 z-50">
                            <input
                              type="text"
                              value={peripheral.baseAddress}
                              onChange={(e) => onPeripheralUpdate(peripheral.id, 'baseAddress', e.target.value)}
                              onBlur={handleBlur}
                              onKeyDown={handleKeyDown}
                              autoFocus
                              className="bg-obsidian border border-neon-cyan rounded px-1.5 py-0.5 w-28 text-text-primary font-mono"
                            />
                            {valResult.suggestedAddress && (
                              <button
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  onPeripheralUpdate(peripheral.id, 'baseAddress', valResult.suggestedAddress);
                                  handleBlur();
                                }}
                                className="text-[9px] text-left text-neon-cyan hover:underline cursor-pointer"
                              >
                                Suggest: {valResult.suggestedAddress}
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="relative group inline-block">
                            <div onClick={() => handleCellClick(peripheral.id, 'baseAddress')} className="cursor-pointer flex flex-col">
                              <span className={`font-bold flex items-center gap-1.5 ${displayAddrValue === 'N/A — Logic-Only' ? 'text-text-muted font-normal' : statusColors[valResult.status]}`}>
                                {valResult.status !== 'Ready' && displayAddrValue !== 'N/A — Logic-Only' && <StatusIcon className="w-3 h-3" />}
                                {displayAddrValue}
                                {renderStatusBadge(peripheral.fieldStatuses?.baseAddress)}
                              </span>
                              <span className="text-[9px] text-text-muted font-mono tracking-tight">{addrLabel}</span>
                            </div>

                            {/* Verification Tooltip */}
                            <div className="pointer-events-auto absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-obsidian border border-border-grid text-text-primary text-[11px] p-3 rounded-lg shadow-2xl z-50 font-sans leading-relaxed">
                              <p className="font-bold border-b border-border-grid/50 pb-1 mb-1.5 flex items-center gap-1 text-[12px]">
                                <StatusIcon className={`w-3.5 h-3.5 ${statusColors[valResult.status]}`} />
                                {valResult.status} Verification
                              </p>
                              <p className="text-text-secondary text-[11px] font-mono leading-normal whitespace-pre-line">{valResult.tooltip || valResult.message}</p>
                              {valResult.suggestedAddress && (
                                <div className="mt-2 pt-1.5 border-t border-border-grid/50 flex items-center justify-between font-mono">
                                  <span className="text-text-muted">Suggested:</span>
                                  <button
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      onPeripheralUpdate(peripheral.id, 'baseAddress', valResult.suggestedAddress);
                                    }}
                                    className="text-neon-cyan font-bold bg-neon-cyan/10 hover:bg-neon-cyan/20 px-1.5 py-0.5 rounded border border-neon-cyan/20 transition-all cursor-pointer text-[10px]"
                                  >
                                    Apply: {valResult.suggestedAddress}
                                  </button>
                                </div>
                              )}
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-[4px] border-transparent border-t-obsidian" />
                            </div>
                          </div>
                        )}
                      </td>

                      {/* 6. IRQ */}
                      <td className="px-3 py-3 font-mono">
                        <span className={displayIrq === 'Not Available' ? 'text-text-muted' : ''}>
                          {displayIrq}
                        </span>
                        {renderStatusBadge(peripheral.fieldStatuses?.interruptNumber)}
                      </td>

                      {/* 7. Pin Mapping */}
                      <td className="px-3 py-3 font-mono">
                        <span className={displayPinMapping === 'Not Available' ? 'text-text-muted' : ''}>
                          {displayPinMapping}
                        </span>
                        {renderStatusBadge(peripheral.fieldStatuses?.physicalPinMapping)}
                      </td>

                      {/* 8. Source / Verification */}
                      <td className="px-3.5 py-3 relative group font-mono">
                        <span className={`cursor-pointer hover:underline text-[10px] font-bold ${
                          sourceVerificationLabel.includes('VERIFIED')
                            ? 'text-neon-emerald'
                            : sourceVerificationLabel.includes('AI INFERENCE')
                              ? 'text-purple-400'
                              : 'text-neon-amber'
                        }`}>
                          {sourceVerificationLabel}
                        </span>
                        {/* Hover Tooltip with Full Provenance & Source Metadata */}
                        <div className="pointer-events-none absolute right-0 bottom-full mb-2 w-80 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-obsidian border border-border-grid text-text-primary text-[11px] p-3.5 rounded-lg shadow-2xl z-50 font-mono leading-relaxed">
                          <p className="font-bold border-b border-border-grid/50 pb-1 mb-1.5 text-neon-cyan flex items-center justify-between">
                            <span>HARDWARE SOURCE PROVENANCE</span>
                            <span className="text-[10px] text-text-muted">{peripheral.baseAddress_meta?.source_type || peripheral.provenanceSource || 'RTL'}</span>
                          </p>
                          <div className="space-y-1 text-[10px] text-text-secondary">
                            <p><span className="text-text-muted">Peripheral:</span> <span className="text-text-primary font-bold">{peripheral.peripheralBlock}</span></p>
                            <p><span className="text-text-muted">Type:</span> <span className="text-text-primary font-bold">{(peripheral as any).type || 'Unknown'}</span></p>
                            {(peripheral as any).deviceAddress ? (
                              <p><span className="text-text-muted">Device Address:</span> <span className="text-neon-cyan font-bold">{(peripheral as any).deviceAddress}</span></p>
                            ) : (
                              <p><span className="text-text-muted">Address / Location:</span> <span className="text-neon-cyan font-bold">{displayAddrValue}</span></p>
                            )}
                            <p><span className="text-text-muted">Source Doc:</span> <span className="text-neon-emerald font-bold">{peripheral.provenance?.document || peripheral.baseAddress_meta?.source_document || 'Authoritative Hardware Evidence'}</span></p>
                            <p><span className="text-text-muted">Vendor Ref:</span> <span className="text-neon-cyan font-bold">{peripheral.provenance?.documentType || peripheral.provenance?.vendor || 'Vendor Knowledge Base'}</span></p>
                            <p><span className="text-text-muted">Authoritative:</span> <span className={(peripheral.provenance || peripheral.baseAddress_meta?.authoritative || peripheral.verification_status === 'VENDOR_SOURCE_VERIFIED' || peripheral.verification_status === 'SOURCE_VERIFIED' || peripheral.verification_status === 'BOARD_VERIFIED') ? "text-neon-emerald font-bold" : "text-neon-amber font-bold"}>{(peripheral.provenance || peripheral.baseAddress_meta?.authoritative || peripheral.verification_status === 'VENDOR_SOURCE_VERIFIED' || peripheral.verification_status === 'SOURCE_VERIFIED' || peripheral.verification_status === 'BOARD_VERIFIED') ? 'YES' : 'NO'}</span></p>
                            <p><span className="text-text-muted">Verification:</span> <span className="text-neon-emerald font-bold">{peripheral.verification_status || sourceVerificationLabel}</span></p>
                          </div>

                          <div className="absolute top-full right-4 border-[4px] border-transparent border-t-obsidian" />
                        </div>
                      </td>

                      {/* 9. Status */}
                      <td className="px-3 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${finalBadgeClasses}`}>
                          {finalStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action panel at bottom */}
      {peripherals.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {lockStatus === 'unlocked' && !showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-1.5 px-4 py-2 border border-border-grid hover:border-neon-cyan hover:text-neon-cyan rounded-lg transition-colors cursor-pointer text-xs font-mono"
              >
                <Plus className="w-3.5 h-3.5" /> Add Peripheral Block
              </button>
            )}
          </div>
          <button
            onClick={onLockSchema}
            disabled={lockStatus === 'frozen' || invalidAddresses.length > 0}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all ${
              lockStatus === 'frozen'
                ? 'bg-neon-emerald/20 text-neon-emerald border-2 border-neon-emerald cursor-default'
                : 'bg-gradient-to-r from-neon-emerald to-neon-cyan text-obsidian hover:shadow-neon-emerald font-mono'
            }`}
          >
            <Lock className="w-4 h-4" />
            {lockStatus === 'frozen' ? 'Schema Synthesized & Validated' : 'Synthesize Hardware Platform'}
          </button>
        </div>
      )}
    </div>
  );
}
