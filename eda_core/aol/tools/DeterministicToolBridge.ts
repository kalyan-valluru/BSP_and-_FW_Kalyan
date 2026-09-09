import { UHKBManager } from '../../uhkb/UHKBManager';
import { HDGManager } from '../../hdg/HDGManager';
import { EVEManager } from '../../eve/EVEManager';
import { EKREManager } from '../../ekre/EKREManager';
import { ETEManager } from '../../ete/ETEManager';
import { ValidationContext, ValidationReportSummary } from '../../eve/types/eveTypes';
import { EngineeringRecommendation } from '../../ekre/types/ekreTypes';
import { TransformationPlan } from '../../ete/types/eteTypes';

export class DeterministicToolBridge {
  private uhkb = UHKBManager.getInstance();
  private hdg = HDGManager.getInstance();
  private eve = EVEManager.getInstance();
  private ekre = EKREManager.getInstance();
  private ete = ETEManager.getInstance();

  public async queryHardware(processorId: string): Promise<any> {
    await this.uhkb.initialize();
    const proc = this.uhkb.queryEngine.findProcessor(processorId);
    const peripherals = this.uhkb.queryEngine.findPeripherals(processorId);
    const memMap = this.uhkb.queryEngine.findMemoryMap(processorId);
    const clocks = this.uhkb.queryEngine.findClockTree(processorId);

    return { proc, peripherals, memMap, clocks };
  }

  public async validateHardware(ctx: ValidationContext): Promise<ValidationReportSummary> {
    return this.eve.validate(ctx);
  }

  public async getRecommendations(issues: any[], targetProcessorId: string): Promise<EngineeringRecommendation[]> {
    return this.ekre.generateRecommendations(issues, targetProcessorId);
  }

  public async generateTransformations(recs: EngineeringRecommendation[], targetProcessorId: string): Promise<TransformationPlan[]> {
    return this.ete.generateTransformationPlan(recs, targetProcessorId);
  }
}
