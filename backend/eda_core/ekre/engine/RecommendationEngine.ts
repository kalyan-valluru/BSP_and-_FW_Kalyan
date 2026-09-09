import { SolutionFinder } from './SolutionFinder';
import { TradeOffAnalyzer } from './TradeOffAnalyzer';
import { EngineeringRecommendation } from '../types/ekreTypes';

export class RecommendationEngine {
  private finder = new SolutionFinder();
  private tradeOffAnalyzer = new TradeOffAnalyzer();

  /**
   * Generates structured deterministic engineering recommendation for an EVE validation issue
   */
  public generateRecommendation(issue: {
    id: string;
    severity: string;
    category: string;
    affectedComponent: string;
    rootCause: string;
  }, targetProcessorId: string): EngineeringRecommendation {
    let candidateOptions: any[] = [];

    if (issue.category === 'clock') {
      candidateOptions = this.finder.findClockSolutions(targetProcessorId, issue.affectedComponent);
    } else if (issue.category === 'resource' || issue.rootCause.includes('overlap')) {
      candidateOptions = this.finder.findMemoryRelocationSolutions('0x41200000', 4096);
    } else {
      candidateOptions = this.finder.findDriverSolutions(issue.category);
    }

    const preferredSolution = candidateOptions.find(o => o.isPreferred) || candidateOptions[0];
    const alternativeSolutions = candidateOptions.filter(o => o !== preferredSolution);
    const tradeOffAnalysis = this.tradeOffAnalyzer.analyze(preferredSolution, alternativeSolutions);

    return {
      recommendationId: `REC-${issue.id}`,
      issueId: issue.id,
      priority: issue.severity === 'CRITICAL' ? 'HIGH' : issue.severity === 'ERROR' ? 'MEDIUM' : 'LOW',
      reason: issue.rootCause,
      preferredSolution,
      alternativeSolutions,
      tradeOffAnalysis,
      requiredDependencies: [issue.affectedComponent],
      engineeringReferences: [
        'AMD Xilinx Zynq-7000 TRM UG585',
        'STMicroelectronics STM32H7 Reference Manual RM0433'
      ]
    };
  }
}
