import { EvidenceChainBuilder } from './engine/EvidenceChainBuilder';
import { ReasoningSynthesizer } from './engine/ReasoningSynthesizer';
import { TraceabilityGraph } from './engine/TraceabilityGraph';
import { EngineeringExplanationReport } from './types/aerlTypes';

export class AERLManager {
  private static instance: AERLManager;

  public readonly chainBuilder = new EvidenceChainBuilder();
  public readonly synthesizer = new ReasoningSynthesizer();
  public readonly graphBuilder = new TraceabilityGraph();

  private constructor() {}

  public static getInstance(): AERLManager {
    if (!AERLManager.instance) {
      AERLManager.instance = new AERLManager();
    }
    return AERLManager.instance;
  }

  /**
   * Generates a complete Engineering Explanation Report with full Chain of Evidence
   */
  public generateExplanationReport(pipelineOutputs: {
    ahupReport?: any;
    amireReport?: any;
    eveReport?: any;
    ekreRecommendations?: any[];
    etePlans?: any[];
  }): EngineeringExplanationReport {
    const timestamp = new Date().toISOString();
    const evidenceChain = this.chainBuilder.buildChain(pipelineOutputs);
    const engineeringRationale = this.synthesizer.synthesizeRationale(evidenceChain, pipelineOutputs.eveReport);
    const riskAssessment = this.synthesizer.synthesizeRisk(pipelineOutputs.eveReport);
    const traceabilityGraph = this.graphBuilder.generateGraph(pipelineOutputs);

    const score = pipelineOutputs.eveReport ? pipelineOutputs.eveReport.readinessScore : 100;

    return {
      reportId: `AERL-REP-${Date.now()}`,
      timestamp,
      executiveSummary: `Generated Chain of Evidence across ${evidenceChain.length} deterministic pipeline stage(s). Engineering Readiness Score: ${score}%.`,
      evidenceChain,
      engineeringRationale,
      riskAssessment,
      confidenceScore: score,
      traceabilityGraph,
      suggestedNextStep: pipelineOutputs.etePlans?.length ? "Review ETE Transformation Plan and apply patches." : "Proceed to BSP Compilation."
    };
  }
}
