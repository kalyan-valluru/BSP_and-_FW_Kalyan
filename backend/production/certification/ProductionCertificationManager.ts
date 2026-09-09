import { CertificationPipeline } from './pipeline/CertificationPipeline';
import { ProductionCertificate } from './types/certificationTypes';

export class ProductionCertificationManager {
  private static instance: ProductionCertificationManager;

  public readonly pipeline = new CertificationPipeline();

  private constructor() {}

  public static getInstance(): ProductionCertificationManager {
    if (!ProductionCertificationManager.instance) {
      ProductionCertificationManager.instance = new ProductionCertificationManager();
    }
    return ProductionCertificationManager.instance;
  }

  /**
   * Evaluates overall enterprise readiness and synthesizes production certificate
   */
  public async certifyPlatform(): Promise<ProductionCertificate> {
    return this.pipeline.certifyPlatform();
  }
}
