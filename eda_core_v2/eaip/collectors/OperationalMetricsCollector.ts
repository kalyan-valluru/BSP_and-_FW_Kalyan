import { ELERManager } from '../../eler/ELERManager';
import { AKEEManager } from '../../akee/AKEEManager';
import { PAFManager } from '../../paf/PAFManager';
import { ABDEManager } from '../../abde/ABDEManager';
import { CEVManager } from '../../cev/CEVManager';
import { DBVEManager } from '../../dbve/DBVEManager';

export class OperationalMetricsCollector {
  public collectAllSubsystemMetrics(): {
    elerCount: number;
    akeeCount: number;
    pafCount: number;
    abdeCount: number;
    cevCount: number;
    dbveCount: number;
  } {
    const eler = ELERManager.getInstance().pipeline.repository.listRecords().length;
    const akee = AKEEManager.getInstance().pipeline.repository.listKnowledge().length;
    const paf = PAFManager.getInstance().pipeline.repository.listModels().length;
    const abde = ABDEManager.getInstance().pipeline.repository.listModels().length;
    const cev = CEVManager.getInstance().pipeline.repository.listPlans().length;
    const dbve = DBVEManager.getInstance().pipeline.repository.listTasks().length;

    return {
      elerCount: eler,
      akeeCount: akee,
      pafCount: paf,
      abdeCount: abde,
      cevCount: cev,
      dbveCount: dbve
    };
  }
}
