import { EvidenceChainStep } from '../types/aerlTypes';

export class EvidenceChainBuilder {
  /**
   * Constructs end-to-end Chain of Evidence across all Phase 1 and 2 deterministic stages
   */
  public buildChain(pipelineOutputs: {
    ahupReport?: any;
    amireReport?: any;
    eveReport?: any;
    ekreRecommendations?: any[];
    etePlans?: any[];
  }): EvidenceChainStep[] {
    const chain: EvidenceChainStep[] = [];
    const timestamp = new Date().toISOString();

    // 1. AHUP Stage
    if (pipelineOutputs.ahupReport) {
      chain.push({
        stepNumber: chain.length + 1,
        stageName: 'AHUP (Hardware Understanding)',
        actionTaken: `Extracted ${pipelineOutputs.ahupReport.peripherals?.length || 0} peripheral facts from hardware artifacts.`,
        sourceDocument: pipelineOutputs.ahupReport.detectedBoard?.provenance?.documentName || 'system.dts',
        ruleOrModuleId: 'AHUPPipeline',
        confidence: (pipelineOutputs.ahupReport.overallConfidenceScore || 100) / 100,
        timestamp
      });
    }

    // 2. AMIRE Stage
    if (pipelineOutputs.amireReport) {
      chain.push({
        stepNumber: chain.length + 1,
        stageName: 'AMIRE (Information Recovery)',
        actionTaken: `Deterministically recovered ${pipelineOutputs.amireReport.recoveredFields?.length || 0} missing field(s).`,
        ruleOrModuleId: 'AMIREManager',
        confidence: (pipelineOutputs.amireReport.overallConfidenceScore || 100) / 100,
        timestamp
      });
    }

    // 3. EVE Stage
    if (pipelineOutputs.eveReport) {
      chain.push({
        stepNumber: chain.length + 1,
        stageName: 'EVE (Validation Engine)',
        actionTaken: `Evaluated 6-stage validation pipeline. Score: ${pipelineOutputs.eveReport.readinessScore}%. Issues: ${pipelineOutputs.eveReport.issues?.length || 0}`,
        ruleOrModuleId: 'ValidationPipeline',
        confidence: pipelineOutputs.eveReport.readinessScore / 100,
        timestamp
      });
    }

    // 4. EKRE Stage
    if (pipelineOutputs.ekreRecommendations && pipelineOutputs.ekreRecommendations.length > 0) {
      chain.push({
        stepNumber: chain.length + 1,
        stageName: 'EKRE (Recommendation Engine)',
        actionTaken: `Generated ${pipelineOutputs.ekreRecommendations.length} preferred repair solution(s).`,
        ruleOrModuleId: 'RecommendationEngine',
        confidence: (pipelineOutputs.ekreRecommendations[0]?.preferredSolution?.confidenceScore || 90) / 100,
        timestamp
      });
    }

    // 5. ETE Stage
    if (pipelineOutputs.etePlans && pipelineOutputs.etePlans.length > 0) {
      chain.push({
        stepNumber: chain.length + 1,
        stageName: 'ETE (Transformation Engine)',
        actionTaken: `Synthesized ${pipelineOutputs.etePlans.length} reversible transformation plan(s) and patch diffs.`,
        ruleOrModuleId: 'TransformationPlanner',
        confidence: 1.0,
        timestamp
      });
    }

    return chain;
  }
}
