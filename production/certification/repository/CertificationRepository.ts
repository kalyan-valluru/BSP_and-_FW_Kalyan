import { ProductionCertificate } from '../types/certificationTypes';

export class CertificationRepository {
  private certificates: Map<string, ProductionCertificate> = new Map();

  public addCertificate(cert: ProductionCertificate): void {
    if (!cert || !cert.certificateId) return;
    this.certificates.set(cert.certificateId, cert);
  }

  public listCertificates(): ProductionCertificate[] {
    return Array.from(this.certificates.values());
  }
}
