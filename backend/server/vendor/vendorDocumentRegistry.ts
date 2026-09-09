export interface VendorDocumentMeta {
  documentId: string;
  vendor: string;
  title: string;
  documentNumber: string;
  revision: string;
  publicationDate?: string;
  officialUrl: string;
  sourceDomain: string;
  documentType: 'TRM' | 'Datasheet' | 'ProductGuide' | 'UserGuide' | 'ReferenceManual' | 'RegisterReference' | 'BoardUserGuide' | 'ApplicationNote' | 'ReferenceDesign';
  deviceFamily?: string;
  checksum?: string;
  downloadedAt?: string;
  localPath?: string;
  ingestionStatus?: 'VERIFIED_DOWNLOAD' | 'CACHED' | 'INGESTED' | 'FAILED';
}

export interface OfficialVendorConfig {
  vendor: string;
  approvedDomains: string[];
  officialGithubOrgs: string[];
  documents: Record<string, VendorDocumentMeta>;
}

export const VENDOR_DOCUMENT_REGISTRY: Record<string, OfficialVendorConfig> = {
  AMD: {
    vendor: 'AMD',
    approvedDomains: ['amd.com', 'docs.amd.com', 'docs.xilinx.com', 'www.xilinx.com', 'xilinx.com'],
    officialGithubOrgs: ['Xilinx', 'amd'],
    documents: {
      'UG585': {
        documentId: 'AMD-UG585',
        vendor: 'AMD',
        title: 'Zynq-7000 SoC Technical Reference Manual',
        documentNumber: 'UG585',
        revision: '1.13',
        publicationDate: '2021-04-02',
        officialUrl: 'https://docs.xilinx.com/r/en-US/ug585-zynq-7000-trm',
        sourceDomain: 'docs.xilinx.com',
        documentType: 'TRM',
        deviceFamily: 'Zynq-7000'
      },
      'DS190': {
        documentId: 'AMD-DS190',
        vendor: 'AMD',
        title: 'Zynq-7000 SoC Overview Data Sheet',
        documentNumber: 'DS190',
        revision: '1.11',
        publicationDate: '2020-09-22',
        officialUrl: 'https://docs.xilinx.com/v/u/en-US/ds190-Zynq-7000-Overview',
        sourceDomain: 'docs.xilinx.com',
        documentType: 'Datasheet',
        deviceFamily: 'Zynq-7000'
      },
      'UG1165': {
        documentId: 'AMD-UG1165',
        vendor: 'AMD',
        title: 'Zynq-7000 Embedded Design Tutorial',
        documentNumber: 'UG1165',
        revision: '2021.2',
        publicationDate: '2021-11-10',
        officialUrl: 'https://docs.xilinx.com/r/en-US/ug1165-zynq-embedded-design-tutorial',
        sourceDomain: 'docs.xilinx.com',
        documentType: 'UserGuide',
        deviceFamily: 'Zynq-7000'
      },
      'PG144': {
        documentId: 'AMD-PG144',
        vendor: 'AMD',
        title: 'AXI GPIO v2.0 Product Guide',
        documentNumber: 'PG144',
        revision: '2.0',
        publicationDate: '2022-10-19',
        officialUrl: 'https://docs.xilinx.com/r/en-US/pg144-axi-gpio',
        sourceDomain: 'docs.xilinx.com',
        documentType: 'ProductGuide',
        deviceFamily: 'LogiCORE IP'
      }
    }
  },

  Digilent: {
    vendor: 'Digilent',
    approvedDomains: ['digilent.com', 'reference.digilentinc.com', 'digilentinc.com'],
    officialGithubOrgs: ['Digilent'],
    documents: {
      'ZedBoard-RM': {
        documentId: 'DIGILENT-ZEDBOARD-RM',
        vendor: 'Digilent',
        title: 'ZedBoard Hardware Reference Manual',
        documentNumber: 'ZedBoard-RM',
        revision: 'D.2',
        publicationDate: '2014-01-24',
        officialUrl: 'https://reference.digilentinc.com/reference/programmable-logic/zedboard/reference-manual',
        sourceDomain: 'reference.digilentinc.com',
        documentType: 'BoardUserGuide',
        deviceFamily: 'ZedBoard'
      }
    }
  },

  STMicroelectronics: {
    vendor: 'STMicroelectronics',
    approvedDomains: ['st.com', 'www.st.com'],
    officialGithubOrgs: ['STMicroelectronics'],
    documents: {
      'DS8597': { documentId: 'ST-DS8597', vendor: 'STMicroelectronics', title: 'STM32F405/407 Datasheet', documentNumber: 'DS8597', revision: 'official-current', officialUrl: 'https://www.st.com/resource/en/datasheet/stm32f407vg.pdf', sourceDomain: 'www.st.com', documentType: 'Datasheet', deviceFamily: 'STM32F407' },
      'RM0090': { documentId: 'ST-RM0090', vendor: 'STMicroelectronics', title: 'STM32F405/407/415/417 Reference Manual', documentNumber: 'RM0090', revision: 'official-current', officialUrl: 'https://www.st.com/resource/en/reference_manual/rm0090-stm32f405415-stm32f407417-stm32f427437-and-stm32f429439-advanced-armbased-32bit-mcus-stmicroelectronics.pdf', sourceDomain: 'www.st.com', documentType: 'ReferenceManual', deviceFamily: 'STM32F407' },
      'UM1472': { documentId: 'ST-UM1472', vendor: 'STMicroelectronics', title: 'STM32F4DISCOVERY User Manual', documentNumber: 'UM1472', revision: 'Rev 9', officialUrl: 'https://www.st.com/resource/en/user_manual/um1472-stm32f4-discovery-stmicroelectronics.pdf', sourceDomain: 'www.st.com', documentType: 'BoardUserGuide', deviceFamily: 'STM32F4DISCOVERY' },
      'ES0182': { documentId: 'ST-ES0182', vendor: 'STMicroelectronics', title: 'STM32F405/407xx Device Errata', documentNumber: 'ES0182', revision: 'official-current', officialUrl: 'https://www.st.com/resource/en/errata_sheet/es0182-stm32f405407xx-and-stm32f415417xx-device-limitations-stmicroelectronics.pdf', sourceDomain: 'www.st.com', documentType: 'ApplicationNote', deviceFamily: 'STM32F407' }
    }
  },

  NXP: {
    vendor: 'NXP',
    approvedDomains: ['nxp.com', 'www.nxp.com'],
    officialGithubOrgs: ['nxp-imx', 'NXP'],
    documents: {}
  },

  'Texas Instruments': {
    vendor: 'Texas Instruments',
    approvedDomains: ['ti.com', 'www.ti.com'],
    officialGithubOrgs: ['texasinstruments'],
    documents: {}
  },

  NVIDIA: {
    vendor: 'NVIDIA',
    approvedDomains: ['nvidia.com', 'developer.nvidia.com', 'docs.nvidia.com'],
    officialGithubOrgs: ['NVIDIA'],
    documents: {
      'jetson_linux_36_4_3_developer_guide': {
        docId: 'jetson_linux_36_4_3_developer_guide',
        vendor: 'NVIDIA',
        title: 'NVIDIA Jetson Linux 36.4.3 Developer Guide',
        url: 'https://docs.nvidia.com/jetson/archives/r36.4.3/DeveloperGuide/',
        documentType: 'bsp_docs',
        targetSoCs: ['Tegra234', 'Orin NX', 'Orin Nano', 'AGX Orin']
      },
      'tegra234_device_tree_guide': {
        docId: 'tegra234_device_tree_guide',
        vendor: 'NVIDIA',
        title: 'Kernel Device Tree & T23x Structure Guide',
        url: 'https://docs.nvidia.com/jetson/archives/r36.4.3/DeveloperGuide/SD/Kernel/DeviceTree.html',
        documentType: 'bsp_docs',
        targetSoCs: ['Tegra234', 'Orin NX']
      }
    }
  },

  'Raspberry Pi': {
    vendor: 'Raspberry Pi',
    approvedDomains: ['raspberrypi.com', 'datasheets.raspberrypi.com'],
    officialGithubOrgs: ['raspberrypi'],
    documents: {}
  }
};

/**
 * Validate whether a URL belongs to an approved official vendor domain allowlist.
 */
export function isApprovedVendorDomain(url: string, vendor?: string): boolean {
  if (!url) return false;
  const urlLower = url.toLowerCase();

  if (vendor && VENDOR_DOCUMENT_REGISTRY[vendor]) {
    return VENDOR_DOCUMENT_REGISTRY[vendor].approvedDomains.some(domain => urlLower.includes(domain));
  }

  return Object.values(VENDOR_DOCUMENT_REGISTRY).some(config =>
    config.approvedDomains.some(domain => urlLower.includes(domain))
  );
}
