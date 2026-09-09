export interface OfficialVendorSource {
  vendor: string;
  officialDomains: string[];
  officialGithubOrgs: string[];
  documentTypes: string[];
  docUrls: Record<string, string>;
  isAuthoritativeDomain: (url: string) => boolean;
}

export const OFFICIAL_VENDOR_REGISTRY: Record<string, OfficialVendorSource> = {
  AMD: {
    vendor: 'AMD',
    officialDomains: ['docs.xilinx.com', 'www.xilinx.com', 'xilinx.com', 'amd.com'],
    officialGithubOrgs: ['Xilinx', 'amd'],
    documentTypes: ['TRM', 'datasheet', 'product_guide', 'board_user_guide', 'reference_design', 'bsp_docs', 'driver_docs'],
    docUrls: {
      'ug585': 'https://docs.xilinx.com/r/en-US/ug585-zynq-7000-trm',
      'ug1085': 'https://docs.xilinx.com/r/en-US/ug1085-zynq-ultrascale-trm',
      'ds187': 'https://docs.xilinx.com/v/u/en-US/ds187-Zynq-7000-Data-Sheet',
      'pg150': 'https://docs.xilinx.com/r/en-US/pg150-axi-bram-ctrl'
    },
    isAuthoritativeDomain: (url: string) => {
      const u = url.toLowerCase();
      return ['docs.xilinx.com', 'www.xilinx.com', 'xilinx.com', 'amd.com', 'github.com/xilinx'].some(d => u.includes(d));
    }
  },

  STMicroelectronics: {
    vendor: 'STMicroelectronics',
    officialDomains: ['www.st.com', 'st.com'],
    officialGithubOrgs: ['STMicroelectronics'],
    documentTypes: ['reference_manual', 'datasheet', 'application_note', 'bsp_docs', 'user_manual'],
    docUrls: {
      'rm0090': 'https://www.st.com/resource/en/reference_manual/rm0090-stm32f405415-stm32f407417-stm32f427437-and-stm32f429439-advanced-armbased-32bit-mcus-stmicroelectronics.pdf',
      'ds8597': 'https://www.st.com/resource/en/datasheet/stm32f407vg.pdf',
      'um1472': 'https://www.st.com/resource/en/user_manual/um1472-stm32f4-discovery-stmicroelectronics.pdf',
      'es0182': 'https://www.st.com/resource/en/errata_sheet/es0182-stm32f405407xx-and-stm32f415417xx-device-limitations-stmicroelectronics.pdf',
      'stm32cubef4': 'https://www.st.com/en/embedded-software/stm32cubef4.html'
    },
    isAuthoritativeDomain: (url: string) => {
      const u = url.toLowerCase();
      return ['www.st.com', 'st.com', 'github.com/stmicroelectronics'].some(d => u.includes(d));
    }
  },

  NXP: {
    vendor: 'NXP',
    officialDomains: ['www.nxp.com', 'nxp.com'],
    officialGithubOrgs: ['nxp-imx', 'NXP'],
    documentTypes: ['reference_manual', 'datasheet', 'application_note', 'bsp_docs'],
    docUrls: {
      'imx8mprm': 'https://www.nxp.com/webapp/Download?colCode=IMX8MPRM'
    },
    isAuthoritativeDomain: (url: string) => {
      const u = url.toLowerCase();
      return ['www.nxp.com', 'nxp.com', 'github.com/nxp-imx'].some(d => u.includes(d));
    }
  },

  'Texas Instruments': {
    vendor: 'Texas Instruments',
    officialDomains: ['www.ti.com', 'ti.com'],
    officialGithubOrgs: ['texasinstruments'],
    documentTypes: ['TRM', 'datasheet', 'application_report', 'bsp_docs'],
    docUrls: {
      'spruh73q': 'https://www.ti.com/lit/ug/spruh73q/spruh73q.pdf'
    },
    isAuthoritativeDomain: (url: string) => {
      const u = url.toLowerCase();
      return ['www.ti.com', 'ti.com', 'github.com/texasinstruments'].some(d => u.includes(d));
    }
  },

  NVIDIA: {
    vendor: 'NVIDIA',
    officialDomains: ['developer.nvidia.com', 'nvidia.com', 'docs.nvidia.com'],
    officialGithubOrgs: ['NVIDIA'],
    documentTypes: ['TRM', 'datasheet', 'bsp_docs', 'design_guide', 'developer_guide'],
    docUrls: {
      'jetson_orin_trm': 'https://developer.nvidia.com/embedded/downloads',
      'jetson_linux_36_4_3_developer_guide': 'https://docs.nvidia.com/jetson/archives/r36.4.3/DeveloperGuide/',
      'jetson_orin_nx_platform': 'https://docs.nvidia.com/jetson/archives/r36.4.3/DeveloperGuide/SD/PlatformAdaptationAndBringUp/OrinNxNano.html',
      'tegra234_device_tree': 'https://docs.nvidia.com/jetson/archives/r36.4.3/DeveloperGuide/SD/Kernel/DeviceTree.html',
      'kernel_customization': 'https://docs.nvidia.com/jetson/archives/r36.4.3/DeveloperGuide/SD/Kernel/KernelCustomization.html',
      'pcie_bringup': 'https://docs.nvidia.com/jetson/archives/r36.4.3/DeveloperGuide/SD/PlatformAdaptationAndBringUp/Pcie.html',
      'pinmux_gpio': 'https://docs.nvidia.com/jetson/archives/r36.4.3/DeveloperGuide/SD/PlatformAdaptationAndBringUp/Pinmux.html'
    },
    isAuthoritativeDomain: (url: string) => {
      const u = url.toLowerCase();
      return ['developer.nvidia.com', 'nvidia.com', 'docs.nvidia.com', 'github.com/nvidia'].some(d => u.includes(d));
    }
  },

  'Raspberry Pi': {
    vendor: 'Raspberry Pi',
    officialDomains: ['datasheets.raspberrypi.com', 'www.raspberrypi.com', 'raspberrypi.com'],
    officialGithubOrgs: ['raspberrypi'],
    documentTypes: ['datasheet', 'product_brief', 'board_user_guide', 'bsp_docs'],
    docUrls: {
      'cm4_brief': 'https://datasheets.raspberrypi.com/cm4/cm4-product-brief.pdf',
      'bcm2711_peripherals': 'https://datasheets.raspberrypi.com/bcm2711/bcm2711-peripherals.pdf'
    },
    isAuthoritativeDomain: (url: string) => {
      const u = url.toLowerCase();
      return ['datasheets.raspberrypi.com', 'raspberrypi.com', 'github.com/raspberrypi'].some(d => u.includes(d));
    }
  }
};

/**
 * Verify whether a URL belongs to an authoritative vendor source domain.
 */
export function isAuthoritativeVendorUrl(url: string, vendor?: string): boolean {
  if (!url) return false;
  if (vendor && OFFICIAL_VENDOR_REGISTRY[vendor]) {
    return OFFICIAL_VENDOR_REGISTRY[vendor].isAuthoritativeDomain(url);
  }
  return Object.values(OFFICIAL_VENDOR_REGISTRY).some(v => v.isAuthoritativeDomain(url));
}
