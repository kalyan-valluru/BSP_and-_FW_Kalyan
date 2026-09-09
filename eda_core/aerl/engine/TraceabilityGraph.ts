import { TraceabilityGraphData, TraceabilityNode, TraceabilityLink } from '../types/aerlTypes';

export class TraceabilityGraph {
  public generateGraph(pipelineOutputs: {
    ahupReport?: any;
    eveReport?: any;
    ekreRecommendations?: any[];
    etePlans?: any[];
  }): TraceabilityGraphData {
    const nodes: TraceabilityNode[] = [];
    const links: TraceabilityLink[] = [];

    // Document node
    nodes.push({ id: 'DOC-1', label: 'system.dts', type: 'document' });
    nodes.push({ id: 'FACT-1', label: 'UART Base Address 0x41200000', type: 'fact' });
    links.push({ source: 'DOC-1', target: 'FACT-1', relationship: 'EXTRACTED_BY' });

    // Validation Issue node
    if (pipelineOutputs.eveReport?.issues?.length > 0) {
      const issue = pipelineOutputs.eveReport.issues[0];
      nodes.push({ id: issue.id, label: issue.rootCause, type: 'issue' });
      links.push({ source: 'FACT-1', target: issue.id, relationship: 'EVALUATED_BY' });

      // Recommendation node
      if (pipelineOutputs.ekreRecommendations?.length > 0) {
        const rec = pipelineOutputs.ekreRecommendations[0];
        nodes.push({ id: rec.recommendationId, label: rec.preferredSolution.action, type: 'recommendation' });
        links.push({ source: issue.id, target: rec.recommendationId, relationship: 'RESOLVED_BY' });

        // Transformation node
        if (pipelineOutputs.etePlans?.length > 0) {
          const plan = pipelineOutputs.etePlans[0];
          nodes.push({ id: plan.transformationId, label: plan.patchDiff.patchId, type: 'transformation' });
          links.push({ source: rec.recommendationId, target: plan.transformationId, relationship: 'SYNTHESIZED_INTO' });
        }
      }
    }

    return { nodes, links };
  }
}
