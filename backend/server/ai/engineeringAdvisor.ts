/**
 * engineeringAdvisor.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Central EDA-style AI Advisory Module
 *
 * Design rule: AI reasons at decision/checkpoint stages. Tools execute.
 *
 * Zone 1 — triageVivadoWarnings()
 *   Called after VivadoLogAnalyzer regex parse. AI decides which warnings
 *   block deployment vs. are cosmetic. Vivado still runs unchanged.
 *
 * Zone 4 — explainValidationFailures()
 *   Called after runValidation(). AI converts structured check results into
 *   engineering impact + actionable recommendations.
 *   Cannot modify passed/severity/id — additive annotation only.
 *
 * Zone 5 — generateExecutiveSummary()
 *   Called after all validation stages complete. AI produces risk assessment,
 *   deployment readiness judgment, and ordered action list.
 *
 * Zones 2 and 3 are routed through geminiRepairEngine.analyzeFailure()
 * which already has the correct interface and confidence gates.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { AIService } from '../aiService';

const aiService = new AIService();

// ─── Timeout helper ────────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      ()    => { clearTimeout(timer); resolve(fallback); }
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Zone 1 — Vivado Warning Triage
// ─────────────────────────────────────────────────────────────────────────────

export interface VivadoDiagnosticInput {
  category: string;
  severity: 'WARNING' | 'ERROR' | 'CRITICAL_WARNING';
  issue: string;
  rootCause: string;
  impact: string;
  recommendation: string;
  canAutoRecover: boolean;
  rawLogSnippet: string;
}

export interface WarningTriage {
  /** Original diagnostic index — used to correlate back to the array */
  diagnosticIndex: number;
  deploymentRisk: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  blocksHardwareBringup: boolean;
  blocksTimingClosure: boolean;
  engineeringExplanation: string;
  recommendedAction: string;
}

const TRIAGE_SYSTEM_PROMPT = `You are an expert AMD Vivado EDA verification engineer.
You receive Vivado diagnostic messages (warnings and critical warnings) and classify each one for deployment readiness.

For each diagnostic, reason about:
- Whether it will cause hardware malfunction (bus errors, wrong timing, wrong IP behaviour)
- Whether it will cause synthesis or implementation failure downstream
- Whether it is a cosmetic issue safe to dismiss for initial bring-up

You must produce a single valid JSON array (NO markdown, NO surrounding text) of objects with this exact shape:
[
  {
    "diagnosticIndex": 0,
    "deploymentRisk": "CRITICAL"|"HIGH"|"MEDIUM"|"LOW",
    "blocksHardwareBringup": true|false,
    "blocksTimingClosure": true|false,
    "engineeringExplanation": "Single sentence — what hardware behaviour this causes",
    "recommendedAction": "Concrete action — what the engineer should do"
  }
]

Rules:
- deploymentRisk = CRITICAL → must be fixed before XSA export
- deploymentRisk = HIGH → should be fixed before tape-out
- deploymentRisk = MEDIUM → should be reviewed
- deploymentRisk = LOW → cosmetic, safe for initial bring-up
- blocksHardwareBringup = true → firmware cannot run correctly
- blocksTimingClosure = true → timing analysis will fail`;

/**
 * Zone 1: Classify Vivado warnings by deployment impact.
 * Returns empty array (fallback) if AI fails or times out.
 */
export async function triageVivadoWarnings(
  diagnostics: VivadoDiagnosticInput[],
  processorContext: string,
  targetFlow: string
): Promise<WarningTriage[]> {
  if (diagnostics.length === 0) return [];

  // Only triage non-ERROR diagnostics — errors are handled by geminiRepairEngine
  const warningsOnly = diagnostics.filter(d => d.severity !== 'ERROR');
  if (warningsOnly.length === 0) return [];

  const diagnosticsJson = warningsOnly.map((d, idx) => ({
    index: diagnostics.indexOf(d),
    category: d.category,
    severity: d.severity,
    issue: d.issue,
    rootCause: d.rootCause,
    rawLogSnippet: d.rawLogSnippet.substring(0, 300)
  }));

  const prompt = `Processor: ${processorContext}
Target Flow: ${targetFlow}

Vivado Diagnostics to classify (${warningsOnly.length} items):
${JSON.stringify(diagnosticsJson, null, 2)}

Classify each diagnostic for deployment readiness. Return only the JSON array.`;

  const fallback: WarningTriage[] = [];

  try {
    const raw = await withTimeout(
      aiService.getChatCompletion(prompt, TRIAGE_SYSTEM_PROMPT),
      8000,
      ''
    );
    if (!raw) return fallback;

    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const parsed: WarningTriage[] = JSON.parse(cleaned);

    // Schema validation
    if (!Array.isArray(parsed)) return fallback;
    const validated = parsed.filter(item =>
      typeof item.diagnosticIndex === 'number' &&
      ['CRITICAL','HIGH','MEDIUM','LOW'].includes(item.deploymentRisk) &&
      typeof item.blocksHardwareBringup === 'boolean' &&
      typeof item.blocksTimingClosure === 'boolean' &&
      typeof item.engineeringExplanation === 'string' &&
      typeof item.recommendedAction === 'string'
    );

    return validated;
  } catch {
    return fallback;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Zone 4 — Validation Check Engineering Explanation
// ─────────────────────────────────────────────────────────────────────────────

export interface FailingCheckInput {
  id: string;
  name: string;
  severity: 'Critical' | 'Warning' | 'Info';
  detail: string;
}

export interface PeripheralSummaryInput {
  name: string;
  baseAddress?: string;
  irq?: number | string;
  clockSource?: string;
  driverName?: string;
}

export interface CheckNarrative {
  /** Must match an id from the failing checks input */
  id: string;
  impact: string;
  blocksHardwareBringup: boolean;
  fixPriority: number;       // 1 = highest priority
  suggestedFix: string;
  combinedRiskNote?: string; // Present if multiple checks interact
  provenanceCitation?: {
    document: string;
    documentType: string;
    chapter?: string;
    page?: number;
    confidence: number;
  };
}

const EXPLANATION_SYSTEM_PROMPT = `You are an expert embedded systems and EDA verification engineer.
You receive a list of FAILING validation checks from an automated DRC engine for an FPGA/embedded design.
Your role is to explain the engineering impact of each failure — exactly like a senior engineer reviewing the checklist before hardware bring-up.

Reason about:
- What hardware malfunction or software crash does this failure produce?
- Does it combine with other failures to create a worse problem?
- Is it a blocker for hardware bring-up or a risk for later?
- What is the precise fix action?

Every recommendation MUST originate from verified vendor documentation. Never invent hardware addresses or function signatures.

You must produce a single valid JSON array (NO markdown, NO surrounding text):
[
  {
    "id": "V003",
    "impact": "What hardware behaviour this causes — be specific (e.g. which register, which operation fails)",
    "blocksHardwareBringup": true|false,
    "fixPriority": 1,
    "suggestedFix": "Concrete engineering action",
    "combinedRiskNote": "If this check interacts with another failing check — explain the combined risk. Omit if independent.",
    "provenanceCitation": {
      "document": "IMX8MPRM.pdf",
      "documentType": "TRM",
      "chapter": "UART Controller",
      "page": 1487,
      "confidence": 1.0
    }
  }
]

Rules:
- One object per failing check id. Do not invent check ids.
- fixPriority 1 = must fix first. Higher number = lower urgency.
- impact must be hardware-specific, not generic ("This will cause AXI bus timeout" not "This may cause issues")
- suggestedFix must be actionable ("Reallocate axi_gpio_0 to 0x40010000 in Vivado Address Editor")`;


/**
 * Zone 4: Convert failing validation checks into engineering narratives.
 * Returns empty array (fallback) if AI fails or times out.
 * NOTE: The caller must NOT apply AI output to passed/severity/id — annotation only.
 */
export async function explainValidationFailures(
  failingChecks: FailingCheckInput[],
  peripherals: PeripheralSummaryInput[],
  processor: string
): Promise<CheckNarrative[]> {
  if (failingChecks.length === 0) return [];

  const prompt = `Processor: ${processor}

FAILING CHECKS (${failingChecks.length}):
${JSON.stringify(failingChecks, null, 2)}

PERIPHERAL CONTEXT:
${JSON.stringify(peripherals.slice(0, 12), null, 2)}

Produce one narrative per failing check. Return only the JSON array.`;

  const fallback: CheckNarrative[] = [];

  try {
    const raw = await withTimeout(
      aiService.getChatCompletion(prompt, EXPLANATION_SYSTEM_PROMPT, { processor, peripherals }),
      10000,
      ''
    );

    if (!raw) return fallback;

    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const parsed: CheckNarrative[] = JSON.parse(cleaned);

    if (!Array.isArray(parsed)) return fallback;

    // Schema validation — AI cannot invent check IDs
    const validIds = new Set(failingChecks.map(c => c.id));
    const validated = parsed.filter(item =>
      typeof item.id === 'string' &&
      validIds.has(item.id) &&          // only IDs that actually failed
      typeof item.impact === 'string' &&
      typeof item.blocksHardwareBringup === 'boolean' &&
      typeof item.fixPriority === 'number' &&
      item.fixPriority >= 1 &&
      typeof item.suggestedFix === 'string'
    );

    return validated;
  } catch {
    return fallback;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Zone 5 — Engineering Report Executive Summary
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidationSummaryInput {
  processor: string;
  overallSuccess: boolean;
  criticalFailureCount: number;
  warningCount: number;
  infoCount: number;
  autoRecoveryCount: number;
  failingCheckIds: string[];
  failingCheckDetails: string[];         // detail strings from failing checks
  buildStageResults: Record<string, string>;  // e.g. { vivado: 'SUCCESS_WITH_WARNINGS', bsp: 'PASS' }
  traceabilityConfidenceAvg: number;     // 0–100
  traceabilityResolvedCount: number;
  traceabilityUnresolvedCount: number;
}

export interface ExecutiveSummary {
  riskAssessment: string;
  deploymentReadiness: 'READY' | 'READY_WITH_RISKS' | 'NOT_READY';
  criticalBlockers: string[];
  recommendedNextSteps: string[];
}

const SUMMARY_SYSTEM_PROMPT = `You are an expert embedded systems verification engineer producing a hardware sign-off summary.
You receive structured validation results from an automated EDA validation engine and produce an executive engineering summary.

The summary must help the engineer decide:
1. Can this design be built on hardware today?
2. What must be fixed first?
3. What can be deferred to a later iteration?

You must produce a single valid JSON object (NO markdown, NO surrounding text):
{
  "riskAssessment": "2-3 sentence risk assessment. Be technically specific.",
  "deploymentReadiness": "READY"|"READY_WITH_RISKS"|"NOT_READY",
  "criticalBlockers": ["Ordered list of issues that MUST be fixed before hardware bring-up"],
  "recommendedNextSteps": ["Ordered action list — specific and actionable"]
}

Rules:
- deploymentReadiness must match overallSuccess: if overallSuccess=false AND criticalFailureCount>0, use NOT_READY
- criticalBlockers must cite specific check IDs and peripheral names
- recommendedNextSteps must be engineer-executable actions, not vague advice
- Total combined text must be under 500 words
- Do NOT contradict the input data (e.g., don't say READY if overallSuccess=false)`;

/**
 * Zone 5: Generate engineering executive summary from all validation results.
 * Returns null (fallback) if AI fails or violates constraints.
 */
export async function generateExecutiveSummary(
  input: ValidationSummaryInput
): Promise<ExecutiveSummary | null> {
  const prompt = `Validation Results:
${JSON.stringify(input, null, 2)}

Produce the engineering executive summary JSON object.`;

  try {
    const raw = await withTimeout(
      aiService.getChatCompletion(prompt, SUMMARY_SYSTEM_PROMPT),
      12000,
      ''
    );
    if (!raw) return null;

    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const parsed: ExecutiveSummary = JSON.parse(cleaned);

    // Schema gate
    if (!parsed.riskAssessment || typeof parsed.riskAssessment !== 'string') return null;
    if (!['READY','READY_WITH_RISKS','NOT_READY'].includes(parsed.deploymentReadiness)) return null;
    if (!Array.isArray(parsed.criticalBlockers)) return null;
    if (!Array.isArray(parsed.recommendedNextSteps)) return null;

    // Consistency gate: if critical failures exist, deploymentReadiness must not be READY
    if (input.criticalFailureCount > 0 && !input.overallSuccess &&
        parsed.deploymentReadiness === 'READY') {
      return null; // AI contradicted the data — discard
    }

    return parsed;
  } catch {
    return null;
  }
}
