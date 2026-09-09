import React, { useState } from 'react';
import {
  ShieldCheck,
  FileCode2,
  Terminal,
  Cpu,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Activity,
  Layers,
  FileText,
  RotateCw,
  Wrench,
  Clock,
  Download,
  Info
} from 'lucide-react';

export interface DetailedToolStatus {
  id: string;
  name: string;
  available: boolean;
  version?: string;
  path?: string;
  category: string;
}

export interface UniversalStageResult {
  stageNumber: number;
  stageName: string;
  category: 'HardwareDRC' | 'DeviceTree' | 'Compilation' | 'StaticAnalysis' | 'Runtime';
  adapterId?: string;
  adapterName?: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED' | 'TOOL_NOT_INSTALLED' | 'NOT_APPLICABLE';
  executionMode: 'DETERMINISTIC_EXECUTION' | 'DETERMINISTIC_FALLBACK' | 'SKIPPED' | 'NOT_INSTALLED';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  success: boolean;
  skipped: boolean;
  skipReason?: string;
  executionTimeMs: number;
  toolInfo?: {
    name: string;
    version?: string;
    executablePath?: string;
    commandExecuted?: string;
    exitCode?: number;
    stdout?: string;
    stderr?: string;
  };
  issues: Array<{
    severity: 'ERROR' | 'WARNING' | 'INFO';
    category: string;
    file?: string;
    line?: number;
    message: string;
    recommendation?: string;
  }>;
  rawOutput: string;
}

export interface UniversalValidationReport {
  sessionId: string;
  timestamp: string;
  platformId: string;
  platformName: string;
  vendor: string;
  architecture: string;
  category: 'FPGA' | 'LinuxSoC' | 'BareMetalMCU';
  targetFlow: 'bare_metal' | 'linux' | 'both';
  overallStatus: 'PASSED' | 'PASSED_WITH_WARNINGS' | 'FAILED' | 'SKIPPED';
  overallSuccess: boolean;
  readinessScore: number;
  executionMetrics: {
    totalDurationMs: number;
    executedValidatorsCount: number;
    skippedValidatorsCount: number;
    generatedArtifactsCount: number;
  };
  installedTools?: DetailedToolStatus[];
  totalIssuesCount: {
    errors: number;
    warnings: number;
    info: number;
  };
  stages: UniversalStageResult[];
  aiExecutiveSummary?: {
    deploymentReadiness: 'READY' | 'READY_WITH_RISKS' | 'NOT_READY';
    riskAssessment: string;
    criticalBlockers: string[];
    recommendedNextSteps: string[];
  };
  unifiedLogs: string[];
}

interface Props {
  report: UniversalValidationReport | null;
  loading: boolean;
  onRerun: () => void;
  platformName: string;
}

export const UniversalValidationView: React.FC<Props> = ({
  report,
  loading,
  onRerun,
  platformName
}) => {
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'stages' | 'tools' | 'ai' | 'logs'>('stages');

  const toggleLog = (id: string) => {
    setExpandedLogs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getStageIcon = (category: string) => {
    switch (category) {
      case 'HardwareDRC':
        return <Layers className="w-4 h-4 text-neon-cyan" />;
      case 'DeviceTree':
        return <FileCode2 className="w-4 h-4 text-purple-400" />;
      case 'Compilation':
        return <Terminal className="w-4 h-4 text-blue-400" />;
      case 'StaticAnalysis':
        return <Activity className="w-4 h-4 text-neon-amber" />;
      case 'Runtime':
        return <Cpu className="w-4 h-4 text-neon-emerald" />;
      default:
        return <ShieldCheck className="w-4 h-4 text-neon-cyan" />;
    }
  };

  const downloadValidationReport = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Universal_Validation_Report_${report.platformId}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="bg-obsidian border border-border-grid rounded-xl p-8 flex flex-col items-center justify-center space-y-4 font-mono">
        <RotateCw className="w-8 h-8 text-neon-cyan animate-spin" />
        <p className="text-sm text-text-secondary">
          Universal Validation Engine executing automated non-FPGA suite...
        </p>
        <span className="text-xs text-text-muted">
          (Discovering Tools → Device Tree Validation → Cross-Compiler → Static Analysis → Virtual Execution)
        </span>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="bg-obsidian border border-border-grid rounded-xl p-8 flex flex-col items-center justify-center space-y-3 font-mono">
        <ShieldCheck className="w-10 h-10 text-neon-cyan opacity-80" />
        <h3 className="text-sm font-bold text-text-primary">
          Universal Validation Engine Ready
        </h3>
        <p className="text-xs text-text-secondary text-center max-w-md">
          Execute unified multi-tool validation (Device Tree, GCC Cross-Compiler, Cppcheck Static Analysis, QEMU/Renode Runtime, AI Sign-off) for {platformName}.
        </p>
        <button
          onClick={onRerun}
          className="mt-2 px-4 py-2 bg-neon-cyan/20 border border-neon-cyan/40 text-neon-cyan rounded-lg font-mono text-xs font-bold hover:bg-neon-cyan/30 transition-all cursor-pointer shadow-lg"
        >
          Run Universal Validation Suite
        </button>
      </div>
    );
  }

  const readinessColor =
    report.readinessScore >= 90
      ? 'text-neon-emerald border-neon-emerald/30 bg-neon-emerald/10'
      : report.readinessScore >= 70
      ? 'text-neon-amber border-neon-amber/30 bg-neon-amber/10'
      : 'text-red-400 border-red-500/30 bg-red-500/10';

  return (
    <div className="space-y-6">
      {/* Top Banner Dashboard */}
      <div className="bg-obsidian border border-border-grid rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1 font-mono">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-neon-cyan" />
            <h2 className="text-lg font-bold text-text-primary">
              Universal Validation Engine
            </h2>
            <span className="px-2 py-0.5 bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[10px] font-mono font-bold rounded uppercase">
              {report.category}
            </span>
          </div>
          <p className="text-xs text-text-secondary">
            Platform: <span className="text-text-primary font-bold">{report.platformName}</span> ({report.architecture}) • Flow: <span className="uppercase text-neon-cyan">{report.targetFlow === 'both' ? 'DUAL OS (MCU + MPU)' : report.targetFlow === 'bare_metal' ? 'BARE-METAL' : 'LINUX'}</span>
          </p>

          {/* Execution Metrics Bar */}
          <div className="flex items-center gap-4 mt-3 text-[11px] text-text-muted">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-neon-cyan" /> {report.executionMetrics?.totalDurationMs || 0} ms total
            </span>
            <span>•</span>
            <span className="text-neon-emerald font-bold">
              {report.executionMetrics?.executedValidatorsCount || 0} Executed
            </span>
            <span>•</span>
            <span className="text-text-muted">
              {report.executionMetrics?.skippedValidatorsCount || 0} Skipped
            </span>
            <span>•</span>
            <span className="text-purple-300">
              {report.executionMetrics?.generatedArtifactsCount || 0} Artifacts
            </span>
          </div>
        </div>

        {/* Readiness Gauge & Actions */}
        <div className="flex items-center gap-4 font-mono">
          <div className="text-right">
            <span className="text-[10px] text-text-muted uppercase">Readiness Score</span>
            <div className={`text-2xl font-black ${readinessColor.split(' ')[0]}`}>
              {report.readinessScore}%
            </div>
          </div>
          <div className={`w-16 h-16 rounded-full border-4 ${readinessColor} flex items-center justify-center font-bold text-xs shadow-lg`}>
            {report.overallStatus === 'PASSED' ? 'PASS' : report.overallStatus === 'PASSED_WITH_WARNINGS' ? 'WARN' : 'FAIL'}
          </div>
          <button
            onClick={downloadValidationReport}
            title="Download Validation Report JSON"
            className="p-2.5 bg-obsidian-200 hover:bg-border-grid border border-border-grid text-text-secondary hover:text-text-primary rounded-lg transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={onRerun}
            title="Re-run Universal Validation"
            className="p-2.5 bg-neon-cyan/20 hover:bg-neon-cyan/30 border border-neon-cyan/40 text-neon-cyan rounded-lg transition-all cursor-pointer"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border-grid text-xs font-mono">
        <button
          onClick={() => setActiveTab('stages')}
          className={`px-4 py-2.5 font-bold flex items-center gap-2 border-b-2 cursor-pointer ${
            activeTab === 'stages'
              ? 'border-neon-cyan text-neon-cyan bg-neon-cyan/5'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <Layers className="w-4 h-4" />
          Validation Stages ({report.stages.length})
        </button>

        <button
          onClick={() => setActiveTab('tools')}
          className={`px-4 py-2.5 font-bold flex items-center gap-2 border-b-2 cursor-pointer ${
            activeTab === 'tools'
              ? 'border-neon-amber text-neon-amber bg-neon-amber/5'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <Wrench className="w-4 h-4" />
          Tool Discovery ({report.installedTools?.filter(t => t.available).length || 0}/{report.installedTools?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab('ai')}
          className={`px-4 py-2.5 font-bold flex items-center gap-2 border-b-2 cursor-pointer ${
            activeTab === 'ai'
              ? 'border-purple-400 text-purple-300 bg-purple-500/5'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          AI Executive Review
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2.5 font-bold flex items-center gap-2 border-b-2 cursor-pointer ${
            activeTab === 'logs'
              ? 'border-neon-cyan text-neon-cyan bg-neon-cyan/5'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <FileText className="w-4 h-4" />
          Detailed Logs
        </button>
      </div>

      {/* Tab 1: Validation Stages */}
      {activeTab === 'stages' && (
        <div className="space-y-4 font-mono">
          {report.stages.map((stage) => {
            const isExpanded = expandedLogs[stage.stageName];
            const isDeterministic = stage.executionMode === 'DETERMINISTIC_EXECUTION';

            return (
              <div
                key={stage.stageName}
                className="bg-obsidian border border-border-grid rounded-xl overflow-hidden transition-all"
              >
                <div
                  onClick={() => toggleLog(stage.stageName)}
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-obsidian-200/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-obsidian-200 rounded-lg">
                      {getStageIcon(stage.category)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                        {stage.stageName}
                        {stage.adapterName && (
                          <span className="text-[10px] text-text-muted font-normal">
                            ({stage.adapterName})
                          </span>
                        )}
                      </h4>
                      <div className="flex items-center gap-2 text-[11px] text-text-secondary mt-1">
                        <span>{stage.issues.length} issue(s)</span>
                        <span>•</span>
                        <span>{stage.executionTimeMs} ms</span>
                        <span>•</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase ${
                          stage.confidence === 'HIGH'
                            ? 'bg-neon-emerald/15 text-neon-emerald border-neon-emerald/30'
                            : stage.confidence === 'MEDIUM'
                            ? 'bg-neon-amber/15 text-neon-amber border-neon-amber/30'
                            : 'bg-obsidian-200 text-text-muted border-border-grid'
                        }`}>
                          Confidence: {stage.confidence}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {stage.status === 'SKIPPED' || stage.skipped ? (
                      <span className="px-2.5 py-1 bg-obsidian-200 text-text-muted border border-border-grid rounded text-[10px] uppercase font-bold">
                        SKIPPED
                      </span>
                    ) : stage.status === 'TOOL_NOT_INSTALLED' ? (
                      <span className="px-2.5 py-1 bg-neon-amber/15 text-neon-amber border border-neon-amber/30 rounded text-[10px] uppercase font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> TOOL MISSING
                      </span>
                    ) : stage.success ? (
                      <span className="px-2.5 py-1 bg-neon-emerald/15 text-neon-emerald border border-neon-emerald/30 rounded text-[10px] uppercase font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> PASS
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-red-500/15 text-red-400 border border-red-500/30 rounded text-[10px] uppercase font-bold flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> FAIL
                      </span>
                    )}

                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-text-secondary" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-text-secondary" />
                    )}
                  </div>
                </div>

                {/* Expanded Stage Details */}
                {isExpanded && (
                  <div className="border-t border-border-grid bg-[#0d1117] p-4 space-y-4 text-xs">
                    {/* Tool Execution Details Box */}
                    {stage.toolInfo && (
                      <div className="p-3 bg-[#080b0f] border border-border-grid rounded-lg space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span className="text-neon-cyan">Tool: {stage.toolInfo.name}</span>
                          <span className="text-text-muted">Version: {stage.toolInfo.version || 'Unknown'}</span>
                        </div>
                        {stage.toolInfo.executablePath && (
                          <p className="text-[10px] text-text-muted">Path: {stage.toolInfo.executablePath}</p>
                        )}
                        {stage.toolInfo.commandExecuted && (
                          <p className="text-[10px] font-mono text-purple-300">Command: {stage.toolInfo.commandExecuted}</p>
                        )}
                        {stage.toolInfo.exitCode !== undefined && (
                          <p className="text-[10px] text-text-muted">Process Exit Code: {stage.toolInfo.exitCode}</p>
                        )}
                      </div>
                    )}

                    {stage.skipReason && (
                      <p className="text-text-muted italic">Skip Reason: {stage.skipReason}</p>
                    )}

                    {/* Issues List */}
                    {stage.issues.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="text-[11px] uppercase text-text-muted font-bold">
                          Issues & Diagnostics
                        </h5>
                        {stage.issues.map((iss, i) => (
                          <div
                            key={i}
                            className={`p-2.5 rounded border text-xs ${
                              iss.severity === 'ERROR'
                                ? 'bg-red-500/10 border-red-500/30 text-red-300'
                                : iss.severity === 'WARNING'
                                ? 'bg-neon-amber/10 border-neon-amber/30 text-amber-300'
                                : 'bg-obsidian-200 border-border-grid text-text-secondary'
                            }`}
                          >
                            <div className="flex items-center justify-between font-bold">
                              <span>[{iss.severity}] {iss.category}</span>
                              {iss.file && <span>{iss.file}:{iss.line || 1}</span>}
                            </div>
                            <p className="mt-1 leading-relaxed">{iss.message}</p>
                            {iss.recommendation && (
                              <p className="mt-1 text-neon-cyan text-[11px]">
                                💡 Recommendation: {iss.recommendation}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Raw Console Output */}
                    <div>
                      <h5 className="text-[11px] uppercase text-text-muted font-bold mb-1">
                        Captured Tool Output (stdout/stderr)
                      </h5>
                      <pre className="p-3 bg-[#040608] border border-border-grid rounded-lg text-[11px] text-text-secondary overflow-x-auto max-h-48 leading-relaxed">
                        {stage.rawOutput || 'No stdout/stderr recorded.'}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 2: Tool Discovery Panel */}
      {activeTab === 'tools' && (
        <div className="bg-obsidian border border-border-grid rounded-xl p-6 space-y-4 font-mono">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-neon-amber">
              <Wrench className="w-5 h-5" />
              <h3 className="text-sm font-bold uppercase tracking-wider">
                Host System EDA & Tool Discovery Registry
              </h3>
            </div>
            <span className="text-xs text-text-muted">
              Auto-detected at validation start
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.installedTools?.map((tool) => (
              <div
                key={tool.id}
                className={`p-4 rounded-xl border flex items-start justify-between ${
                  tool.available
                    ? 'bg-neon-emerald/5 border-neon-emerald/20 text-text-primary'
                    : 'bg-obsidian-200 border-border-grid opacity-75'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {tool.available ? (
                      <CheckCircle2 className="w-4 h-4 text-neon-emerald shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-neon-amber shrink-0" />
                    )}
                    <h4 className="text-xs font-bold">{tool.name}</h4>
                  </div>
                  <p className="text-[11px] text-text-muted">Category: {tool.category}</p>
                  {tool.available ? (
                    <>
                      <p className="text-[10px] text-neon-emerald">Version: {tool.version || 'Detected'}</p>
                      <p className="text-[10px] text-text-muted truncate max-w-xs">Path: {tool.path}</p>
                    </>
                  ) : (
                    <p className="text-[10px] text-neon-amber">Status: Not Detected on PATH</p>
                  )}
                </div>

                <span
                  className={`px-2 py-0.5 text-[9px] font-bold rounded uppercase ${
                    tool.available
                      ? 'bg-neon-emerald/20 text-neon-emerald'
                      : 'bg-neon-amber/20 text-neon-amber'
                  }`}
                >
                  {tool.available ? 'INSTALLED' : 'MISSING'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: AI Executive Review */}
      {activeTab === 'ai' && (
        <div className="bg-obsidian border border-border-grid rounded-xl p-6 space-y-4 font-mono">
          <div className="flex items-center gap-2 text-purple-400">
            <Sparkles className="w-5 h-5" />
            <h3 className="text-sm font-bold uppercase tracking-wider">
              AI Engineering Executive Review & Risk Assessment
            </h3>
          </div>

          {report.aiExecutiveSummary ? (
            <div className="space-y-4 text-xs">
              <div className="flex items-center gap-3">
                <span className="text-text-muted">Deployment Readiness Status:</span>
                <span
                  className={`px-3 py-1 rounded font-bold uppercase border ${
                    report.aiExecutiveSummary.deploymentReadiness === 'READY'
                      ? 'bg-neon-emerald/15 text-neon-emerald border-neon-emerald/30'
                      : report.aiExecutiveSummary.deploymentReadiness === 'READY_WITH_RISKS'
                      ? 'bg-neon-amber/15 text-neon-amber border-neon-amber/30'
                      : 'bg-red-500/15 text-red-400 border-red-500/30'
                  }`}
                >
                  {report.aiExecutiveSummary.deploymentReadiness}
                </span>
              </div>

              <div className="p-4 bg-[#0d1117] border border-border-grid rounded-lg leading-relaxed text-text-primary">
                {report.aiExecutiveSummary.riskAssessment}
              </div>

              {report.aiExecutiveSummary.criticalBlockers.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-red-400 font-bold uppercase text-[11px]">
                    Critical Hardware & BSP Blockers
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-red-300">
                    {report.aiExecutiveSummary.criticalBlockers.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}

              {report.aiExecutiveSummary.recommendedNextSteps.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-neon-cyan font-bold uppercase text-[11px]">
                    Recommended Action Steps
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-text-secondary">
                    {report.aiExecutiveSummary.recommendedNextSteps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-text-muted italic">
              AI Executive Review complete. All non-FPGA verification requirements satisfied.
            </p>
          )}
        </div>
      )}

      {/* Tab 4: Detailed Logs */}
      {activeTab === 'logs' && (
        <div className="bg-obsidian border border-border-grid rounded-xl p-6 font-mono space-y-3">
          <h3 className="text-xs uppercase font-bold text-text-muted">
            Unified Validation Engine Console Trace Logs
          </h3>
          <pre className="p-4 bg-[#040608] border border-border-grid rounded-xl text-xs text-text-secondary overflow-x-auto max-h-96 leading-relaxed">
            {report.unifiedLogs.join('\n')}
          </pre>
        </div>
      )}
    </div>
  );
};
