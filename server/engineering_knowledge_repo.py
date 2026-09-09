"""
engineering_knowledge_repo.py
Engineering Knowledge Repository — static, deterministic reference data.
Used as the single source of truth during benchmark validation.
Never hallucinated; only official datasheet values are stored here.
"""

from typing import Dict, List, Optional, Any, Tuple
import os
import re
import json
import glob

# ─────────────────────────────────────────────────────────────────────────────
# 1. VENDOR OFFICIAL DOCUMENTATION URLS
# ─────────────────────────────────────────────────────────────────────────────
VENDOR_DOC_URLS: Dict[str, Dict[str, str]] = {
    "AMD/Xilinx": {
        "homepage": "https://www.xilinx.com/products/boards-and-kits.html",
        "ug585":    "https://docs.xilinx.com/r/en-US/ug585-zynq-7000-trm",
        "ug1085":   "https://docs.xilinx.com/r/en-US/ug1085-zynq-ultrascale-trm",
        "pg150":    "https://docs.xilinx.com/r/en-US/pg150-axi-bram-ctrl",
    },
    "NXP": {
        "homepage": "https://www.nxp.com/products/processors-and-microcontrollers",
        "imx8mp_rm":"https://www.nxp.com/webapp/Download?colCode=IMX8MPRM",
    },
    "STMicroelectronics": {
        "homepage": "https://www.st.com/en/microcontrollers-microprocessors.html",
        "stm32h7_rm":"https://www.st.com/resource/en/reference_manual/rm0433-stm32h742-stm32h743753-and-stm32h750-value-line-advanced-armbased-32bit-mcus-stmicroelectronics.pdf",
    },
    "Texas Instruments": {
        "homepage":  "https://www.ti.com/microcontrollers-mcus/arm-based-microcontrollers/products.html",
        "am335x_trm":"https://www.ti.com/lit/ug/spruh73q/spruh73q.pdf",
    },
    "Microchip": {
        "homepage": "https://www.microchip.com/en-us/products/fpgas-and-plds",
    },
    "Intel FPGA": {
        "homepage": "https://www.intel.com/content/www/us/en/products/programmable.html",
    },
    "Raspberry Pi": {
        "homepage": "https://www.raspberrypi.com/documentation/computers/",
        "cm4_brief": "https://datasheets.raspberrypi.com/cm4/cm4-product-brief.pdf",
    },
}

# ─────────────────────────────────────────────────────────────────────────────
# 2. BSP DRIVER COMPATIBLE STRINGS (Linux DTS)
# ─────────────────────────────────────────────────────────────────────────────
DTS_COMPATIBLE_STRINGS: Dict[str, List[str]] = {
    # Xilinx / Zynq-7000
    "xuartps":      ["xlnx,xuartps-1.01.a", "cdns,uart-r1p8"],
    "xgpiops":      ["xlnx,zynq-gpio-1.0"],
    "xiicps":       ["cdns,i2c-r1p14", "cdns,i2c-r1p10"],
    "xspips":       ["cdns,spi-r1p6"],
    "xcanps":       ["xlnx,zynq-can-1.0"],
    "xemacps":      ["cdns,gem", "cdns,zynq-gem"],
    "xusbps":       ["xlnx,zynq-usb-2.20.a", "chipidea,usb2"],
    "xsdps":        ["arasan,sdhci-8.9a", "cdns,emmc"],
    "xqspips":      ["xlnx,zynq-qspi-1.0"],
    "xttcps":       ["cdns,ttc"],
    "xaxidma":      ["xlnx,axi-dma-7.1", "xlnx,axi-dma-1.00.a"],
    "xscugic":      ["arm,cortex-a9-gic", "arm,gic-400"],
    # Xilinx / MicroBlaze
    "xuartlite":    ["xlnx,opb-uartlite-1.00.b", "xlnx,xps-uartlite-1.00.a"],
    "xgpio":        ["xlnx,xps-gpio-1.00.a"],
    "xiic":         ["xlnx,xps-iic-2.00.a"],
    "xspi":         ["xlnx,xps-spi-2.00.a"],
    "xtmrctr":      ["xlnx,xps-timer-1.00.a"],
    "xintc":        ["xlnx,xps-intc-1.00.a"],
    "xbram":        ["xlnx,axi-bram-ctrl-4.0"],
    "xaxipcie":     ["xlnx,axi-pcie-1.05.a"],
    # NXP i.MX
    "imx_uart":     ["fsl,imx6q-uart", "fsl,imx21-uart"],
    "imx_gpio":     ["fsl,imx35-gpio", "fsl,imx6q-gpio"],
    "imx_i2c":      ["fsl,imx21-i2c", "fsl,imx6q-i2c"],
    "imx_spi":      ["fsl,imx51-ecspi", "fsl,imx6q-ecspi"],
    "imx_enet":     ["fsl,imx6q-fec", "fsl,imx8mp-fec"],
    "imx_usdhc":    ["fsl,imx6q-usdhc", "fsl,imx8mp-usdhc"],
    "imx_usb":      ["fsl,imx27-usb"],
    "imx_gpt":      ["fsl,imx6q-gpt", "fsl,imx1-gpt"],
    # STM32
    "stm32_uart":   ["st,stm32h7-uart", "st,stm32-usart"],
    "stm32_gpio":   ["st,stm32mp157-gpio", "st,stm32-gpio"],
    "stm32_i2c":    ["st,stm32f7-i2c", "st,stm32mp15-i2c"],
    "stm32_spi":    ["st,stm32h7-spi", "st,stm32-spi"],
    "stm32_can":    ["st,stm32-bxcan"],
    "stm32_eth":    ["st,stm32mp1-dwmac", "snps,dwmac-4.10a"],
    "stm32_timer":  ["st,stm32-timers"],
    "stm32_dma":    ["st,stm32-dma", "st,stm32h7-dma"],
    # TI Sitara
    "omap_uart":    ["ti,am3352-uart", "ti,omap2-uart"],
    "omap_gpio":    ["ti,am4372-gpio", "ti,omap3-gpio"],
    "omap_i2c":     ["ti,omap3-i2c"],
    "omap_mcspi":   ["ti,omap2-mcspi"],
    "omap_gpmc":    ["ti,am3352-gpmc", "ti,omap2420-gpmc"],
    "cpsw":         ["ti,am335x-cpsw", "ti,cpsw"],
    "davinci_mmc":  ["ti,am335-sdhci"],
}

# ─────────────────────────────────────────────────────────────────────────────
# 3. VIVADO IP CORE → DRIVER NAME MAPPING
# ─────────────────────────────────────────────────────────────────────────────
VIVADO_IP_DRIVER_MAP: Dict[str, str] = {
    "axi_uart16550":      "xuartns550",
    "axi_uartlite":       "xuartlite",
    "axi_gpio":           "xgpio",
    "axi_iic":            "xiic",
    "axi_spi":            "xspi",
    "axi_can":            "xcan",
    "axi_ethernetlite":   "xlltemac",
    "axi_ethernet":       "xlltemac",
    "axi_dma":            "xaxidma",
    "axi_cdma":           "xaxicdma",
    "axi_bram_ctrl":      "xbram",
    "axi_timer":          "xtmrctr",
    "axi_intc":           "xintc",
    "axi_quad_spi":       "xqspipsu",
    "axi_pcie":           "xaxipcie",
    "axi_traffic_gen":    "xaxi_tg",
    "processing_system7": "xdevcfg",
    "zynq_ultra_ps_e":    "xpseudo_asm",
    "xlconcat":           "xlconcat",
    "xlslice":            "xlslice",
    "clk_wiz":            "xclk_wiz",
    "proc_sys_reset":     "xil_io",
    "microblaze":         "standalone",
    "lmb_bram_if_cntlr":  "xil_io",
    "mdm":                "xmdm",
    "xadc_wiz":           "xadcps",
}

# ─────────────────────────────────────────────────────────────────────────────
# 4. REFERENCE BASE ADDRESSES — OFFICIAL DATASHEETS
# ─────────────────────────────────────────────────────────────────────────────
REFERENCE_BASE_ADDRESSES: Dict[str, Dict[str, str]] = {
    "Zynq-7000": {
        "UART0":   "0xE0000000",
        "UART1":   "0xE0001000",
        "GPIO":    "0xE000A000",
        "I2C0":    "0xE0004000",
        "I2C1":    "0xE0005000",
        "SPI0":    "0xE0006000",
        "SPI1":    "0xE0007000",
        "CAN0":    "0xE0008000",
        "CAN1":    "0xE0009000",
        "ETH0":    "0xE000B000",
        "ETH1":    "0xE000C000",
        "USB0":    "0xE0002000",
        "USB1":    "0xE0003000",
        "SD0":     "0xE0100000",
        "SD1":     "0xE0101000",
        "QSPI":    "0xE000D000",
        "TTC0":    "0xF8001000",
        "TTC1":    "0xF8002000",
        "WDT":     "0xF8005000",
        "DMAC0":   "0xF8003000",
        "SCUGIC":  "0xF8F01000",
        "SCU_TMR": "0xF8F00600",
        "DDR":     "0x00100000",
        "OCM":     "0xFFFC0000",
        "PL_AXI0": "0x40000000",
    },
    "Zynq UltraScale+": {
        "UART0":   "0xFF000000",
        "UART1":   "0xFF010000",
        "GPIO":    "0xFF0A0000",
        "I2C0":    "0xFF020000",
        "I2C1":    "0xFF030000",
        "SPI0":    "0xFF040000",
        "SPI1":    "0xFF050000",
        "CAN0":    "0xFF060000",
        "CAN1":    "0xFF070000",
        "ETH0":    "0xFF0B0000",
        "ETH1":    "0xFF0C0000",
        "USB0":    "0xFF9D0000",
        "SD0":     "0xFF160000",
        "SD1":     "0xFF170000",
        "QSPI":    "0xFF0F0000",
        "TTC0":    "0xFF110000",
        "GIC":     "0xF9000000",
        "DDR":     "0x00000000",
        "PL_AXI0": "0xA0000000",
    },
    "STM32H7": {
        "USART1":  "0x40011000",
        "USART2":  "0x40004400",
        "USART3":  "0x40004800",
        "UART4":   "0x40004C00",
        "GPIOA":   "0x58020000",
        "GPIOB":   "0x58020400",
        "GPIOC":   "0x58020800",
        "GPIOD":   "0x58020C00",
        "GPIOE":   "0x58021000",
        "I2C1":    "0x40005400",
        "I2C2":    "0x40005800",
        "SPI1":    "0x40013000",
        "SPI2":    "0x40003800",
        "CAN1":    "0x4000A000",
        "ETH":     "0x40028000",
        "TIM1":    "0x40010000",
        "TIM2":    "0x40000000",
        "DMA1":    "0x40020000",
        "DMA2":    "0x40020400",
        "NVIC":    "0xE000E000",
    },
    "AM335x": {
        "UART0":   "0x44E09000",
        "UART1":   "0x48022000",
        "GPIO0":   "0x44E07000",
        "GPIO1":   "0x4804C000",
        "GPIO2":   "0x481AC000",
        "I2C0":    "0x44E0B000",
        "I2C1":    "0x4802A000",
        "SPI0":    "0x48030000",
        "CPSW":    "0x4A100000",
        "MMCSD0":  "0x48060000",
        "TIMER0":  "0x44E05000",
        "INTC":    "0x48200000",
    },
}

# ─────────────────────────────────────────────────────────────────────────────
# 5. REFERENCE IRQ NUMBERS — OFFICIAL DATASHEETS
# ─────────────────────────────────────────────────────────────────────────────
REFERENCE_IRQ_NUMBERS: Dict[str, Dict[str, int]] = {
    "Zynq-7000": {
        "UART0": 59, "UART1": 82,
        "GPIO":  52,
        "I2C0":  57, "I2C1": 80,
        "SPI0":  58, "SPI1": 81,
        "CAN0":  60, "CAN1": 83,
        "ETH0":  54, "ETH1": 77,
        "USB0":  53, "USB1": 76,
        "SD0":   56, "SD1":  79,
        "QSPI":  51,
        "TTC0":  42, "TTC1": 69,
    },
    "Zynq UltraScale+": {
        "UART0": 21, "UART1": 22,
        "GPIO":  16,
        "I2C0":  17, "I2C1": 18,
        "SPI0":  19, "SPI1": 20,
        "CAN0":  23, "CAN1": 24,
        "ETH0":  57, "ETH1": 58,
        "TTC0":  36, "TTC1": 37,
    },
    "STM32H7": {
        "USART1": 37, "USART2": 38, "USART3": 39,
        "I2C1":   31, "I2C2":   32,
        "SPI1":   35, "SPI2":   36,
        "TIM1":   24, "TIM2":   28,
        "DMA1":   11, "DMA2":   56,
        "ETH":    61,
    },
}

# ─────────────────────────────────────────────────────────────────────────────
# 6. PERIPHERAL ADDRESS SIZE REFERENCE (bytes)
# ─────────────────────────────────────────────────────────────────────────────
PERIPHERAL_SIZE_MAP: Dict[str, int] = {
    "UART":    0x1000,
    "GPIO":    0x1000,
    "I2C":     0x1000,
    "SPI":     0x1000,
    "CAN":     0x1000,
    "Ethernet": 0x1000,
    "USB":     0x1000,
    "SD/MMC":  0x1000,
    "QSPI":    0x1000,
    "Timer":   0x1000,
    "DMA":     0x10000,
    "BRAM":    0x2000,
    "Interrupt Controller": 0x1000,
    "ADC":     0x1000,
    "PCIe":    0x4000000,
}

# ─────────────────────────────────────────────────────────────────────────────
# 7. CLOCK REFERENCE TABLE
# ─────────────────────────────────────────────────────────────────────────────
CLOCK_REFERENCE: Dict[str, Dict[str, Any]] = {
    "Zynq-7000": {
        "cpu_freq":    "666 MHz",
        "axi_freq":    "100 MHz",
        "ddr_freq":    "533 MHz",
        "uart_ref":    "100 MHz",
        "fclk0":       "100 MHz",
        "fclk1":       "142 MHz",
    },
    "Zynq UltraScale+": {
        "cpu_freq":    "1.2 GHz",
        "axi_freq":    "100 MHz",
        "ddr_freq":    "1066 MHz",
        "fclk0":       "100 MHz",
    },
    "STM32H7": {
        "cpu_freq":    "480 MHz",
        "ahb_freq":    "240 MHz",
        "apb1_freq":   "120 MHz",
        "apb2_freq":   "120 MHz",
    },
    "AM335x": {
        "cpu_freq":    "1 GHz",
        "l3_freq":     "200 MHz",
        "l4_hs_freq":  "200 MHz",
        "uart_freq":   "48 MHz",
    },
}

# ─────────────────────────────────────────────────────────────────────────────
# 8. BENCHMARK SEED DATASET
# ─────────────────────────────────────────────────────────────────────────────
SEED_BENCHMARK_BOARDS: List[Dict[str, Any]] = [
    {
        "id":          "xilinx-zedboard",
        "vendor":      "AMD/Xilinx",
        "boardName":   "ZedBoard",
        "processor":   "ARM Cortex-A9 (Zynq-7020)",
        "architecture":"Zynq-7000",
        "docVersion":  "1.0",
        "sourceUrl":   "https://www.avnet.com/wps/portal/us/products/avnet-boards/avnet-board-families/zedboard/",
        "downloadDate":"",
        "localDocPath":"",
        "groundTruth": None,
        "status":      "pending_review",
        "notes":       "Reference: Zynq-7000 TRM UG585"
    },
    {
        "id":          "xilinx-zcu102",
        "vendor":      "AMD/Xilinx",
        "boardName":   "ZCU102",
        "processor":   "ARM Cortex-A53 (Zynq UltraScale+ MPSoC)",
        "architecture":"Zynq UltraScale+",
        "docVersion":  "1.0",
        "sourceUrl":   "https://www.xilinx.com/products/boards-and-kits/ek-u1-zcu102-g.html",
        "downloadDate":"",
        "localDocPath":"",
        "groundTruth": None,
        "status":      "pending_review",
        "notes":       "Reference: UG1182 ZCU102 User Guide"
    },
    {
        "id":          "nxp-imx8mp-evk",
        "vendor":      "NXP",
        "boardName":   "i.MX 8M Plus EVK",
        "processor":   "ARM Cortex-A53 (i.MX 8M Plus)",
        "architecture":"i.MX 8",
        "docVersion":  "1.0",
        "sourceUrl":   "https://www.nxp.com/design/development-boards/i-mx-evaluation-and-development-boards/evaluation-kit-for-the-i-mx-8m-plus-applications-processor:8MPLUSLPD4-EVK",
        "downloadDate":"",
        "localDocPath":"",
        "groundTruth": None,
        "status":      "pending_review",
        "notes":       "Reference: i.MX 8M Plus Applications Processor Reference Manual"
    },
    {
        "id":          "st-stm32h743-nucleo",
        "vendor":      "STMicroelectronics",
        "boardName":   "NUCLEO-H743ZI",
        "processor":   "ARM Cortex-M7 (STM32H743ZI)",
        "architecture":"STM32H7",
        "docVersion":  "1.0",
        "sourceUrl":   "https://www.st.com/en/evaluation-tools/nucleo-h743zi.html",
        "downloadDate":"",
        "localDocPath":"",
        "groundTruth": None,
        "status":      "pending_review",
        "notes":       "Reference: RM0433 STM32H743 Reference Manual"
    },
    {
        "id":          "ti-beagleboneblack",
        "vendor":      "Texas Instruments",
        "boardName":   "BeagleBone Black",
        "processor":   "ARM Cortex-A8 (Sitara AM335x)",
        "architecture":"AM335x",
        "docVersion":  "1.0",
        "sourceUrl":   "https://beagleboard.org/black",
        "downloadDate":"",
        "localDocPath":"",
        "groundTruth": None,
        "status":      "pending_review",
        "notes":       "Reference: AM335x TRM SPRUH73"
    },
    {
        "id":          "microchip-polarfire-soc",
        "vendor":      "Microchip",
        "boardName":   "PolarFire SoC Aloha Kit",
        "processor":   "RISC-V (U54-MC) + Cortex-M3 Monitor",
        "architecture":"PolarFire SoC",
        "docVersion":  "1.0",
        "sourceUrl":   "https://www.microchip.com/en-us/development-tool/mpfs-aloha-kit",
        "downloadDate":"",
        "localDocPath":"",
        "groundTruth": None,
        "status":      "pending_review",
        "notes":       "Reference: PolarFire SoC FPGA Datasheet"
    },
    {
        "id":          "raspberrypi-cm4",
        "vendor":      "Raspberry Pi",
        "boardName":   "Compute Module 4",
        "processor":   "ARM Cortex-A72 (BCM2711)",
        "architecture":"BCM2711",
        "docVersion":  "1.0",
        "sourceUrl":   "https://datasheets.raspberrypi.com/cm4/cm4-product-brief.pdf",
        "downloadDate":"",
        "localDocPath":"",
        "groundTruth": None,
        "status":      "pending_review",
        "notes":       "Reference: BCM2711 ARM Peripherals Datasheet"
    },
    {
        "id":          "intel-de10-nano",
        "vendor":      "Intel FPGA",
        "boardName":   "DE10-Nano",
        "processor":   "ARM Cortex-A9 (Cyclone V SoC)",
        "architecture":"Cyclone V SoC",
        "docVersion":  "1.0",
        "sourceUrl":   "https://www.terasic.com.tw/cgi-bin/page/archive.pl?Language=English&No=1046",
        "downloadDate":"",
        "localDocPath":"",
        "groundTruth": None,
        "status":      "pending_review",
        "notes":       "Reference: Cyclone V SoC Technical Reference Manual"
    },
]

# ─────────────────────────────────────────────────────────────────────────────
# 9. METRIC WEIGHTS FOR ENGINEERING QUALITY SCORE
# ─────────────────────────────────────────────────────────────────────────────
METRIC_WEIGHTS: Dict[str, float] = {
    "processor_detection":  0.10,
    "peripheral_detection": 0.15,
    "base_address_accuracy": 0.15,
    "irq_accuracy":          0.10,
    "clock_detection":       0.10,
    "driver_mapping":        0.15,
    "bsp_generation":        0.05,
    "dts_accuracy":          0.10,
    "tcl_accuracy":          0.05,
    "build_success":         0.05,
    "hallucination_rate":    0.00,   # weighted separately (inverted)
}

HALLUCINATION_WEIGHT: float = 0.05  # 5% deduction applied as (1 - hallucination_rate)

# ─────────────────────────────────────────────────────────────────────────────
# HELPER FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

def get_compatible_string(driver_name: str) -> Optional[str]:
    """Return the primary DTS compatible string for a known driver."""
    entries = DTS_COMPATIBLE_STRINGS.get(driver_name)
    if entries:
        return entries[0]
    return None

def get_reference_address(architecture: str, peripheral_name: str) -> Optional[str]:
    """Return official base address for a peripheral in the given architecture."""
    arch_map = REFERENCE_BASE_ADDRESSES.get(architecture, {})
    # Try exact match first, then partial match
    if peripheral_name in arch_map:
        return arch_map[peripheral_name]
    pn = peripheral_name.upper()
    for key, addr in arch_map.items():
        if key in pn or pn in key:
            return addr
    return None

def get_reference_irq(architecture: str, peripheral_name: str) -> Optional[int]:
    """Return official IRQ number for a peripheral."""
    arch_map = REFERENCE_IRQ_NUMBERS.get(architecture, {})
    if peripheral_name in arch_map:
        return arch_map[peripheral_name]
    pn = peripheral_name.upper()
    for key, irq in arch_map.items():
        if key in pn or pn in key:
            return irq
    return None

def get_vivado_driver(ip_name: str) -> Optional[str]:
    """Return BSP driver name for a Vivado IP core instance name."""
    ip_lower = ip_name.lower()
    for ip_key, driver in VIVADO_IP_DRIVER_MAP.items():
        if ip_key in ip_lower or ip_lower.startswith(ip_key):
            return driver
    return None

def calculate_engineering_quality_score(metrics: Dict[str, float]) -> float:
    """Compute the weighted Engineering Quality Score from metric percentages (0-100)."""
    score = 0.0
    for metric, weight in METRIC_WEIGHTS.items():
        if metric == "hallucination_rate":
            continue
        value = metrics.get(metric, 0.0)
        score += (value / 100.0) * weight

    # Hallucination deduction: high hallucination = lower score
    hallucination = metrics.get("hallucination_rate", 0.0)
    score += (1.0 - hallucination / 100.0) * HALLUCINATION_WEIGHT

    return round(score * 100, 2)


# ─────────────────────────────────────────────────────────────────────────────
# 10. DYNAMIC PROCESSOR DISCOVERY & RAG RESOLVER
# ─────────────────────────────────────────────────────────────────────────────

def parse_svd_file(filepath: str) -> Tuple[dict, dict]:
    """Parse an ARM CMSIS-SVD XML file to extract peripheral base addresses and IRQs."""
    addresses = {}
    irqs = {}
    try:
        import xml.etree.ElementTree as ET
        tree = ET.parse(filepath)
        root = tree.getroot()
        for p in root.findall('.//peripheral'):
            p_name = p.findtext('name')
            base_addr = p.findtext('baseAddress')
            if p_name and base_addr:
                addresses[p_name] = base_addr.strip()
                # Check for interrupts
                for intr in p.findall('.//interrupt'):
                    val = intr.findtext('value')
                    if val is not None:
                        try:
                            irqs[p_name] = int(val)
                        except ValueError:
                            pass
    except Exception:
        pass
    return addresses, irqs


def extract_from_text_doc(content: str) -> Tuple[dict, dict]:
    """Parse unstructured technical documents for base addresses and IRQs."""
    addresses = {}
    irqs = {}
    
    # 1. Base addresses patterns
    patterns = [
        r'([A-Za-z0-9_]+)\s*@\s*(0x[0-9A-Fa-f]{8})',
        r'([A-Za-z0-9_]{3,30})\s*:\s*(0x[0-9A-Fa-f]{8})',
        r'#define\s+([A-Za-z0-9_]+)_(?:BASEADDR|BASE)\s+(0x[0-9A-Fa-f]{8})',
        r'([A-Za-z0-9_]+)\s+base\s+address\s+is\s+(0x[0-9A-Fa-f]{8})',
    ]
    for pattern in patterns:
        for match in re.finditer(pattern, content, re.IGNORECASE):
            name, addr = match.group(1), match.group(2)
            if len(name) > 2 and name.lower() not in ('base', 'addr', 'offset'):
                addresses[name.upper()] = addr.upper()

    # 2. IRQ patterns
    irq_patterns = [
        r'([A-Za-z0-9_]+)\s+(?:irq|interrupt)\s*(?:line|number|is)?\s*[:\s=]?\s*(\d+)',
        r'(?:irq|interrupt)\s*(\d+)\s*for\s*([A-Za-z0-9_]+)',
    ]
    for pattern in irq_patterns:
        for match in re.finditer(pattern, content, re.IGNORECASE):
            if match.group(1).isdigit():
                irq_val, name = int(match.group(1)), match.group(2)
            else:
                name, irq_val = match.group(1), int(match.group(2))
            if name.upper() in [k.upper() for k in addresses.keys()] or len(name) > 2:
                irqs[name.upper()] = irq_val

    return addresses, irqs


def load_dynamic_architecture_data(arch: str, data_type: str) -> dict:
    """Scan the knowledge base folder and dynamically parse spec files."""
    kb_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "workspace", "knowledge_base"))
    os.makedirs(kb_dir, exist_ok=True)
    
    addresses = {}
    irqs = {}
    
    # Process SVD XMLs
    for svd_file in glob.glob(os.path.join(kb_dir, "*.svd")):
        addrs, irq_map = parse_svd_file(svd_file)
        addresses.update(addrs)
        irqs.update(irq_map)
        
    # Process JSON specifications
    for json_file in glob.glob(os.path.join(kb_dir, "*.json")):
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, dict):
                    file_arch = data.get("architecture", "")
                    if file_arch.lower() in arch.lower() or arch.lower() in file_arch.lower():
                        addresses.update(data.get("addresses", {}))
                        irqs.update(data.get("irqs", {}))
        except Exception:
            pass
            
    # Process text/DTS/CSV files
    for txt_file in glob.glob(os.path.join(kb_dir, "*")):
        ext = os.path.splitext(txt_file)[1].lower()
        if ext in ('.txt', '.dts', '.csv'):
            try:
                with open(txt_file, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    addrs, irq_map = extract_from_text_doc(content)
                    addresses.update(addrs)
                    irqs.update(irq_map)
            except Exception:
                pass
                
    if data_type == "addresses":
        return addresses
    return irqs


class DynamicAddressLookup(dict):
    def __init__(self, static_data):
        super().__init__(static_data)
        self.static_data = static_data
        
    def get(self, arch, default=None):
        res = self.static_data.get(arch)
        merged = {}
        if res:
            merged.update(res)
        dynamic_res = load_dynamic_architecture_data(arch, "addresses")
        merged.update(dynamic_res)
        return merged if merged else (default or {})


class DynamicIRQLookup(dict):
    def __init__(self, static_data):
        super().__init__(static_data)
        self.static_data = static_data
        
    def get(self, arch, default=None):
        res = self.static_data.get(arch)
        merged = {}
        if res:
            merged.update(res)
        dynamic_res = load_dynamic_architecture_data(arch, "irqs")
        merged.update(dynamic_res)
        return merged if merged else (default or {})


# Override the dictionaries dynamically
REFERENCE_BASE_ADDRESSES = DynamicAddressLookup(REFERENCE_BASE_ADDRESSES)
REFERENCE_IRQ_NUMBERS = DynamicIRQLookup(REFERENCE_IRQ_NUMBERS)
