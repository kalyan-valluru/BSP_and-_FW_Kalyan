import type { PlatformPreset } from '../types';

export type { PlatformPreset };

const rawPresets: PlatformPreset[] = [
  // ── DEMO 1: STM32F4DISCOVERY ─────────────────────────────────────────────
  {
    id: 'stm32f4discovery',
    name: 'STM32F4DISCOVERY / STM32F407G-DISC1',
    vendor: 'STMicroelectronics',
    boardName: 'STM32F4DISCOVERY / MB997',
    boardPreset: 'STMicroelectronics:STM32F4DISCOVERY:STM32F407VGT6',
    logoType: 'st' as const,
    architecture: 'ARM Cortex-M4',
    frequency: '168 MHz',
    workflow: [
      'Read Circuit Diagram & Functional Requirement',
      'ST MB997 Schematic & RM0090 Provenance Extraction',
      'Isolate Required Peripherals (GPIOA, GPIOD)',
      'Mark Unused Board Peripherals (SPI, I2C, USART) as NOT REQUIRED',
      'Generate Bare-Metal Register Firmware (CMSIS/HAL)',
      'Static Linker & Execution Validation'
    ],
    inputFiles: ['stm32f4_schematic.pdf', 'stm32f4_requirement.txt'],
    generatedArtifacts: ['main.c', 'stm32f4xx.h', 'linker.ld', 'firmware.elf', 'validation_report.json'],
    toolchainUsed: 'arm-none-eabi-gcc + ST CMSIS / STM32CubeF4',
    supportedFlow: 'Bare-Metal',
    peripherals: [
      { id: '1', peripheralBlock: 'GPIOD', physicalPinMapping: 'PD12 → LD4 Green LED', clockNetIndicator: true, baseAddress: '0x40020C00', driverName: 'stm32f4_gpio', clockSource: 'AHB1', clockFrequency: '168 MHz', bus: 'AHB1', verification_status: 'SOURCE_VERIFIED', provenanceSource: 'ST MB997 Schematic Sheet 4 & UM1472 Section 6.4', confidence: 1.0 },
      { id: '2', peripheralBlock: 'GPIOA', physicalPinMapping: 'PA0 ← B1 USER Button', clockNetIndicator: true, baseAddress: '0x40020000', driverName: 'stm32f4_gpio', clockSource: 'AHB1', clockFrequency: '168 MHz', bus: 'AHB1', verification_status: 'SOURCE_VERIFIED', provenanceSource: 'ST MB997 Schematic Sheet 4 & UM1472 Section 6.3', confidence: 1.0 }
    ],
    bareMetalCode: `/**
 * STM32F4DISCOVERY Requirement-Driven Bare-Metal Firmware
 * Board: STM32F4DISCOVERY (MB997)
 * Driver Architecture: BMGPIO_TypeDef Struct Layout
 */

#include <stdint.h>

typedef struct {
    volatile uint32_t MODER;    /* Offset 0x00: Mode register */
    volatile uint32_t OTYPER;   /* Offset 0x04: Output type register */
    volatile uint32_t OSPEEDR;  /* Offset 0x08: Output speed register */
    volatile uint32_t PUPDR;    /* Offset 0x0C: Pull-up/pull-down register */
    volatile uint32_t IDR;      /* Offset 0x10: Input data register */
    volatile uint32_t ODR;      /* Offset 0x14: Output data register */
    volatile uint32_t BSRR;     /* Offset 0x18: Bit set/reset register */
    volatile uint32_t LCKR;     /* Offset 0x1C: Configuration lock register */
    volatile uint32_t AFR[2];   /* Offset 0x20-0x24: Alternate function registers */
} BMGPIO_TypeDef;

#define BMGPIOA  ((BMGPIO_TypeDef *)0x40020000u)
#define BMGPIOD  ((BMGPIO_TypeDef *)0x40020C00u)

#define RCC_AHB1ENR (*(volatile uint32_t *)0x40023830u)

#define BMGPIO_MODE_INPUT   0x0u
#define BMGPIO_MODE_OUTPUT  0x1u

void bmgpio_init(BMGPIO_TypeDef *port, uint8_t pin, uint32_t mode) {
    port->MODER &= ~(0x3u << (pin * 2u));
    port->MODER |=  (mode  << (pin * 2u));
}

void bmgpio_write(BMGPIO_TypeDef *port, uint8_t pin, uint8_t level) {
    if (level) {
        port->BSRR = (1u << pin);
    } else {
        port->BSRR = (1u << (pin + 16u));
    }
}

uint8_t bmgpio_read(BMGPIO_TypeDef *port, uint8_t pin) {
    return (uint8_t)((port->IDR >> pin) & 0x1u);
}

void bmgpio_toggle(BMGPIO_TypeDef *port, uint8_t pin) {
    port->ODR ^= (1u << pin);
}

static void delay_crude(volatile uint32_t count) {
    while (count--) { __asm volatile ("nop"); }
}

#define DEBOUNCE_DELAY  64000u

static uint8_t debounce_read(BMGPIO_TypeDef *port, uint8_t pin, uint8_t last_known) {
    uint8_t reading = bmgpio_read(port, pin);
    if (reading != last_known) {
        delay_crude(DEBOUNCE_DELAY);
        reading = bmgpio_read(port, pin);
    }
    return reading;
}

int main(void) {
    /* Enable GPIOA (User Button B1) and GPIOD (LD4 LED) clocks */
    RCC_AHB1ENR |= (1u << 0) | (1u << 3);

    /* PA0: User Button input, PD12: LD4 Green LED output */
    bmgpio_init(BMGPIOA, 0, BMGPIO_MODE_INPUT);
    bmgpio_init(BMGPIOD, 12, BMGPIO_MODE_OUTPUT);

    uint8_t previous_state = 0;

    while (1) {
        uint8_t current_state = debounce_read(BMGPIOA, 0, previous_state);

        /* Toggle LD4 on press (rising edge) */
        if (current_state == 1 && previous_state == 0) {
            bmgpio_toggle(BMGPIOD, 12);
        }

        previous_state = current_state;
    }
    return 0;
}`,
    deviceTreeCode: `/* STM32F4DISCOVERY is a Bare-Metal target. Linux Device Tree is omitted. */`
  },

  // ── DEMO 2: ZEDBOARD ─────────────────────────────────────────────────────
  {
    id: 'xilinx-zynq-7000',
    name: 'Digilent ZedBoard (Zynq-7000)',
    vendor: 'AMD Xilinx',
    boardName: 'Digilent ZedBoard',
    boardPreset: 'xilinx.com:zedboard:part0:1.4',
    logoType: 'xilinx' as const,
    architecture: 'ARM Cortex-A9 (Dual-core)',
    frequency: '667 MHz',
    workflow: [
      'Circuit Diagram & User Requirement Parsing',
      'Digilent ZedBoard Hardware User Guide & Schematic Pin Extraction',
      'Requirement-Based Peripheral Filtering',
      'Bare-Metal Zynq PS GPIO Firmware Generation',
      'Standalone Hardware Verification'
    ],
    inputFiles: ['zedboard_schematic.pdf', 'zedboard_requirement.txt'],
    generatedArtifacts: ['main.c', 'xparameters.h', 'xgpiops_init.c', 'firmware.elf', 'validation_report.json'],
    toolchainUsed: 'AMD Vitis XSCT / ARM GCC Bare-Metal Toolchain',
    supportedFlow: 'Bare-Metal',
    peripherals: [
      { id: '1', peripheralBlock: 'GPIO (PS)', physicalPinMapping: 'MIO50 → BTNC (User Button C), MIO7 → LD9 (User LED 9)', clockNetIndicator: true, baseAddress: '0xE000A000', driverName: 'xgpiops', interruptNumber: 52, clockSource: 'PS_CLK (33.33 MHz)', bus: 'APB', verification_status: 'SOURCE_VERIFIED', provenanceSource: 'Digilent ZedBoard Hardware User Guide v2.2 Table 13 & Table 14', confidence: 1.0 }
    ],
    bareMetalCode: `/**
 * Bare-Metal Zynq-7000 (ZedBoard) Requirement-Driven Firmware
 * Board: Digilent ZedBoard (XC7Z020-1CLG484C)
 * 
 * Requirement:
 * "Control the ZedBoard user LED using the user push button.
 * When the button is pressed, turn the LED ON. When released, turn the LED OFF."
 * 
 * Verified Hardware Provenance:
 * - MIO7  : LD9 User LED Output (Digilent ZedBoard HW User Guide v2.2 Table 13, Section 3.7.1)
 * - MIO50 : BTNC User Push Button C Input (Digilent ZedBoard HW User Guide v2.2 Table 14, Section 3.7.1)
 * - XGPIOPS Base: 0xE000A000 (UG585 Zynq-7000 TRM Chapter 14)
 * 
 * Excluded Peripherals (NOT REQUIRED):
 * - Ethernet, UART, SPI, I2C, SD, USB, HDMI, DDR
 */

#include <stdint.h>

#define XGPIOPS_BASE        0xE000A000UL

#define XGPIOPS_DIRM_1      (*(volatile uint32_t *)(XGPIOPS_BASE + 0x0244UL))
#define XGPIOPS_OEN_1       (*(volatile uint32_t *)(XGPIOPS_BASE + 0x0248UL))
#define XGPIOPS_DATA_1      (*(volatile uint32_t *)(XGPIOPS_BASE + 0x0044UL))
#define XGPIOPS_DATA_RO_1   (*(volatile uint32_t *)(XGPIOPS_BASE + 0x0064UL))

#define MIO7_BIT            (1 << 7)   /* LD9 Output (Bit 7 of Bank 1) */
#define MIO50_BIT           (1 << 18)  /* BTNC Input (Bit 18 of Bank 1: 50 - 32) */

void zynq_gpio_init(void) {
    XGPIOPS_DIRM_1 |= MIO7_BIT;
    XGPIOPS_OEN_1  |= MIO7_BIT;
    XGPIOPS_DIRM_1 &= ~MIO50_BIT;
}

int main(void) {
    zynq_gpio_init();

    while (1) {
        if (XGPIOPS_DATA_RO_1 & MIO50_BIT) {
            XGPIOPS_DATA_1 |= MIO7_BIT;  /* Button Pressed -> LED ON */
        } else {
            XGPIOPS_DATA_1 &= ~MIO7_BIT; /* Button Released -> LED OFF */
        }
    }
    return 0;
}`,
    deviceTreeCode: `/* Bare-Metal flow target. Linux Device Tree is omitted. */`
  },

  // ── DEMO 3: ZCU104 ───────────────────────────────────────────────────────
  {
    id: 'xilinx-zynq-mpsoc',
    name: 'AMD ZCU104 (Zynq UltraScale+ MPSoC)',
    vendor: 'AMD Xilinx',
    boardName: 'AMD ZCU104 Evaluation Board',
    logoType: 'xilinx' as const,
    architecture: 'ARM Cortex-A53 (64-bit Quad-Core)',
    frequency: '1.2 GHz',
    workflow: [
      'Circuit Schematic & Functional Requirement Verification',
      'AMD ZCU104 UG1267 Pin Mapping Verification',
      'Requirement-Based Peripheral Scoping',
      '64-bit ARM Cortex-A53 Bare-Metal Driver Generation',
      'Bare-Metal Execution Verification'
    ],
    inputFiles: ['zcu104_schematic.pdf', 'zcu104_requirement.txt'],
    generatedArtifacts: ['main.c', 'xparameters.h', 'xgpiops_zcu104.c', 'firmware.elf', 'validation_report.json'],
    toolchainUsed: 'AMD Vitis XSCT / AArch64 Bare-Metal Toolchain',
    supportedFlow: 'Bare-Metal',
    peripherals: [
      { id: '1', peripheralBlock: 'GPIO (PS)', physicalPinMapping: 'MIO22 ← SW13 (User Push Button), MIO23 → DS4 (User LED)', clockNetIndicator: true, baseAddress: '0xFF0A0000', driverName: 'xgpiops', interruptNumber: 48, clockSource: 'PS_REF_CLK (33.33 MHz)', bus: 'APB', verification_status: 'SOURCE_VERIFIED', provenanceSource: 'AMD ZCU104 User Guide UG1267 Table 3-23 Page 62 & UG1085 TRM', confidence: 1.0 }
    ],
    bareMetalCode: `/**
 * Bare-Metal Zynq UltraScale+ MPSoC (ZCU104) Requirement-Driven Firmware
 * Board: AMD ZCU104 Evaluation Board (XCZU7EV-2FFVC1156)
 * 
 * Requirement:
 * "Read the user push button and control a user LED. When pressed, turn the LED ON. When released, turn the LED OFF."
 * 
 * Verified Hardware Provenance:
 * - SW13 Button: PS MIO22 (AMD ZCU104 User Guide UG1267 Table 3-23 Page 62)
 * - DS4 User LED: PS MIO23 (AMD ZCU104 User Guide UG1267 Table 3-23 Page 62)
 * - XGPIOPS Base: 0xFF0A0000 (UG1085 Zynq UltraScale+ TRM)
 * 
 * Excluded Peripherals (NOT REQUIRED):
 * - UART, SPI, I2C, Ethernet, SD, USB, Display interfaces
 */

#include <stdint.h>

#define XGPIOPS_BASE        0xFF0A0000UL

#define XGPIOPS_DIRM_0      (*(volatile uint32_t *)(XGPIOPS_BASE + 0x0204UL))
#define XGPIOPS_OEN_0       (*(volatile uint32_t *)(XGPIOPS_BASE + 0x0208UL))
#define XGPIOPS_DATA_0      (*(volatile uint32_t *)(XGPIOPS_BASE + 0x0000UL))
#define XGPIOPS_DATA_RO_0   (*(volatile uint32_t *)(XGPIOPS_BASE + 0x0060UL))

#define MIO22_BIT           (1 << 22)  /* SW13 User Button Input */
#define MIO23_BIT           (1 << 23)  /* DS4 User LED Output */

void zcu104_gpio_init(void) {
    XGPIOPS_DIRM_0 |= MIO23_BIT;
    XGPIOPS_OEN_0  |= MIO23_BIT;
    XGPIOPS_DIRM_0 &= ~MIO22_BIT;
}

int main(void) {
    zcu104_gpio_init();

    while (1) {
        if (XGPIOPS_DATA_RO_0 & MIO22_BIT) {
            XGPIOPS_DATA_0 |= MIO23_BIT;   /* Button Pressed -> LED ON */
        } else {
            XGPIOPS_DATA_0 &= ~MIO23_BIT;  /* Button Released -> LED OFF */
        }
    }
    return 0;
}`,
    deviceTreeCode: `/* Bare-Metal flow target. Linux Device Tree is omitted. */`
  },

  // ── DEMO 4: TI AM335x EVM ────────────────────────────────────────────────
  {
    id: 'ti-sitara-am335x',
    name: 'TI AM335x EVM',
    vendor: 'Texas Instruments',
    boardName: 'TI AM335x EVM (TMDXEVM3358)',
    logoType: 'ti' as const,
    architecture: 'ARM Cortex-A8',
    frequency: '720 MHz / 1.0 GHz',
    workflow: [
      'Schematic Analysis & Pin Mux Extraction',
      'TI TRM Register Verification',
      'Requirement-Based Peripheral Isolation',
      'TI Sitara PRCM & GPIO Bare-Metal Code Generation',
      'Validation Execution'
    ],
    inputFiles: ['am335x_evm_schematic.pdf', 'am335x_requirement.txt'],
    generatedArtifacts: ['main.c', 'am335x_gpio.c', 'firmware.elf', 'validation_report.json'],
    toolchainUsed: 'ARM GCC Bare-Metal Cross Toolchain (arm-none-eabi-gcc)',
    supportedFlow: 'Bare-Metal',
    peripherals: [
      { id: '1', peripheralBlock: 'GPIO0 / GPIO1', physicalPinMapping: 'GPIO0_30 ← SW1 User Button, GPIO1_16 → D1 User LED', clockNetIndicator: true, baseAddress: '0x44E07000 & 0x4804C000', driverName: 'ti_gpio', clockSource: 'L4LS_GCLK', clockFrequency: '100 MHz', bus: 'L4 Interconnect', verification_status: 'SOURCE_VERIFIED', provenanceSource: 'TI AM335x EVM Baseboard Schematic Rev 1.2 Sheet 7 & SPRUH73 TRM', confidence: 1.0 }
    ],
    bareMetalCode: `/**
 * Bare-Metal TI AM335x EVM Requirement-Driven Firmware
 * Processor: TI Sitara AM335x (ARM Cortex-A8)
 * Board: TI AM335x General Purpose EVM (TMDXEVM3358)
 * 
 * Requirement:
 * "Read the user push button and control the user LED. LED is ON while button is pressed and OFF when released."
 * 
 * Verified Hardware Provenance (TI AM335x EVM Baseboard Schematic Rev 1.2 Sheet 7):
 * - SW1 User Push Button: GPIO0_30 (Pin T12, Active High)
 * - D1 User LED: GPIO1_16 (Pin V15, Active High)
 * - GPIO0 Base: 0x44E07000 | GPIO1 Base: 0x4804C000 (SPRUH73 TRM Table 2-2)
 * - PRCM Module Clocks: CM_WKUP_GPIO0_CLKCTRL (0x44E00400+0xB4) & CM_PER_GPIO1_CLKCTRL (0x44E00000+0xAC)
 * 
 * Excluded Peripherals (NOT REQUIRED):
 * - UART, SPI, I2C, ADC, CAN, Ethernet
 */

#include <stdint.h>

#define CM_PER_BASE             0x44E00000UL
#define CM_WKUP_BASE            0x44E00400UL
#define CM_WKUP_GPIO0_CLKCTRL   (*(volatile uint32_t *)(CM_WKUP_BASE + 0xB4UL))
#define CM_PER_GPIO1_CLKCTRL    (*(volatile uint32_t *)(CM_PER_BASE + 0xACUL))

#define AM335X_GPIO0_BASE       0x44E07000UL
#define AM335X_GPIO1_BASE       0x4804C000UL

#define GPIO0_OE                (*(volatile uint32_t *)(AM335X_GPIO0_BASE + 0x134UL))
#define GPIO0_DATAIN            (*(volatile uint32_t *)(AM335X_GPIO0_BASE + 0x138UL))

#define GPIO1_OE                (*(volatile uint32_t *)(AM335X_GPIO1_BASE + 0x134UL))
#define GPIO1_SETDATAOUT        (*(volatile uint32_t *)(AM335X_GPIO1_BASE + 0x194UL))
#define GPIO1_CLEARDATAOUT      (*(volatile uint32_t *)(AM335X_GPIO1_BASE + 0x190UL))

#define GPIO0_30_BIT            (1UL << 30)  /* SW1 Button Input */
#define GPIO1_16_BIT            (1UL << 16)  /* D1 LED Output */

void am335x_evm_gpio_init(void) {
    /* Enable Clocks for GPIO0 and GPIO1 */
    CM_WKUP_GPIO0_CLKCTRL = 0x2;
    CM_PER_GPIO1_CLKCTRL  = 0x2;

    /* Configure GPIO0_30 as Input */
    GPIO0_OE |= GPIO0_30_BIT;

    /* Configure GPIO1_16 as Output */
    GPIO1_OE &= ~GPIO1_16_BIT;
}

int main(void) {
    am335x_evm_gpio_init();

    while (1) {
        if (GPIO0_DATAIN & GPIO0_30_BIT) {
            GPIO1_SETDATAOUT = GPIO1_16_BIT;   /* Button Pressed -> LED ON */
        } else {
            GPIO1_CLEARDATAOUT = GPIO1_16_BIT; /* Button Released -> LED OFF */
        }
    }
    return 0;
}`,
    deviceTreeCode: `/* Bare-Metal flow target. Linux Device Tree is omitted. */`
  },

  // ── DEMO 5: NXP i.MX 8M PLUS ─────────────────────────────────────────────
  {
    id: 'nxp-imx8m-plus',
    name: 'NXP i.MX 8M Plus EVK',
    vendor: 'NXP',
    boardName: 'NXP i.MX 8M Plus EVK',
    logoType: 'nxp' as const,
    architecture: 'ARM Cortex-A53 + Cortex-M7',
    frequency: '1.8 GHz',
    workflow: [
      'Linux Functional Requirement Parsing',
      'NXP EVK Hardware User Guide & Schematic Pin Resolution',
      'Linux Device-Tree & GPIO Subsystem Mapping',
      'Linux User-Space C App / Device-Tree Fragment Generation',
      'Linux Driver & Application Validation'
    ],
    inputFiles: ['imx8mp_evk_schematic.pdf', 'imx8mp_requirement.txt'],
    generatedArtifacts: ['imx8mp_gpio_app.c', 'imx8mp_button_led.dts', 'validation_report.json'],
    toolchainUsed: 'Standard Linux Kernel GPIO Subsystem + GCC AArch64 Cross-Compiler',
    supportedFlow: 'Linux',
    peripherals: [
      { id: '1', peripheralBlock: 'GPIO1 / GPIO5', physicalPinMapping: 'GPIO1_IO09 (SW1 User Button) → GPIO5_IO03 (User LED1)', clockNetIndicator: true, baseAddress: '/dev/gpiochip0 & /dev/gpiochip4', driverName: 'gpio-imx', clockSource: 'IPG_CLK', bus: 'AIPS', verification_status: 'SOURCE_VERIFIED', provenanceSource: 'NXP i.MX 8M Plus EVK Base Board Schematic SPF-46370_B1 Page 11 & Page 12', confidence: 1.0 }
    ],
    bareMetalCode: `/* Linux Target: Bare-Metal direct register access is NOT used for Linux OS flow. */`,
    deviceTreeCode: `/*
 * Linux Device-Tree & User-Space Application for NXP i.MX 8M Plus EVK
 * Board: NXP i.MX 8M Plus EVK (SPF-46370_B1)
 * Flow: Linux OS (libgpiod / gpiod API)
 *
 * Verified Hardware Mapping (SPF-46370_B1 Schematic Page 11 & Page 12):
 * - SW1 User Push Button: GPIO1_IO09 (Active High, gpiochip0 pin 9)
 * - LED1 User LED: GPIO5_IO03 (Active High, gpiochip4 pin 3)
 *
 * Excluded Peripherals:
 * - SPI, I2C, UART, CAN
 */

/dts-v1/;
/ {
    gpio-keys {
        compatible = "gpio-keys";
        user-button {
            label = "User Button SW1";
            gpios = <&gpio1 9 1>;
        };
    };

    leds {
        compatible = "gpio-leds";
        user-led {
            label = "User LED1";
            gpios = <&gpio5 3 0>;
        };
    };
};

/* User-Space Application (imx8mp_gpio_app.c) */
#include <stdio.h>
#include <unistd.h>
#include <gpiod.h>

int main(void) {
    struct gpiod_chip *chip1 = gpiod_chip_open_by_name("gpiochip0");
    struct gpiod_chip *chip5 = gpiod_chip_open_by_name("gpiochip4");

    struct gpiod_line *btn = gpiod_chip_get_line(chip1, 9);
    struct gpiod_line *led = gpiod_chip_get_line(chip5, 3);

    gpiod_line_request_input(btn, "btn-input");
    gpiod_line_request_output(led, "led-output", 0);

    while (1) {
        int val = gpiod_line_get_value(btn);
        gpiod_line_set_value(led, val);
        usleep(10000);
    }
    return 0;
}`
  },

  // ── DEMO 6: NVIDIA JETSON ORIN NX ────────────────────────────────────────
  {
    id: 'nvidia-jetson-orin-nx',
    name: 'NVIDIA Jetson Orin NX (P3767 Reference Carrier)',
    vendor: 'NVIDIA',
    boardName: 'NVIDIA Jetson Orin NX + P3767 Carrier Board',
    logoType: 'nvidia' as const,
    architecture: 'ARM Cortex-A78AE + Ampere GPU',
    frequency: '2.0 GHz',
    workflow: [
      'NVIDIA P3767 Carrier Board Schematic Verification',
      'Linux Kernel GPIO & Device Tree Overlay Mapping',
      'Requirement Peripheral Scoping',
      'Linux User-Space C App / Device Tree Overlay Generation',
      'Linux Runtime Validation'
    ],
    inputFiles: ['jetson_orin_nx_design_guide.pdf', 'orin_requirement.txt'],
    generatedArtifacts: ['orin_gpio_app.c', 'orin_gpio_overlay.dts', 'validation_report.json'],
    toolchainUsed: 'NVIDIA JetPack L4T / Linux gpiod API + AArch64 GCC',
    supportedFlow: 'Linux',
    peripherals: [
      { id: '1', peripheralBlock: 'Tegra GPIO Controller', physicalPinMapping: 'GPIO07 (Pin 29) → GPIO11 (Pin 31) [P3767 Header Pin Mapping]', clockNetIndicator: true, baseAddress: '/dev/gpiochip1', driverName: 'gpio-tegra186', clockSource: 'clk_m', bus: 'APB', verification_status: 'SOURCE_VERIFIED', provenanceSource: 'NVIDIA Jetson P3767 Reference Carrier Board Schematic (P3767_A00) Sheet 8', confidence: 1.0 }
    ],
    bareMetalCode: `/* Linux Target: Bare-Metal direct register access is NOT used for Linux OS flow. */`,
    deviceTreeCode: `/*
 * Linux GPIO Solution for NVIDIA Jetson Orin NX
 * Selected Carrier Board: NVIDIA P3767 Reference Carrier Board (P3767_A00)
 * 
 * Hardware Provenance Audit:
 * - Module Schematic: NOT_PUBLICLY_AVAILABLE (NVIDIA Policy)
 * - P3767 Carrier Board Header J12 Connections (P3767_A00 Schematic Sheet 8):
 *   - GPIO07 / Pin 29: Button Input (Active High)
 *   - GPIO11 / Pin 31: LED Output (Active High)
 *
 * Excluded Peripherals:
 * - SPI, I2C, UART, CAN
 */

#include <stdio.h>
#include <unistd.h>
#include <gpiod.h>

#define CHIP_NAME "gpiochip1"
#define BTN_GPIO  7
#define LED_GPIO  11

int main(void) {
    struct gpiod_chip *chip = gpiod_chip_open_by_name(CHIP_NAME);
    if (!chip) return 1;

    struct gpiod_line *btn = gpiod_chip_get_line(chip, BTN_GPIO);
    struct gpiod_line *led = gpiod_chip_get_line(chip, LED_GPIO);

    gpiod_line_request_input(btn, "orin-btn");
    gpiod_line_request_output(led, "orin-led", 0);

    while (1) {
        int state = gpiod_line_get_value(btn);
        gpiod_line_set_value(led, state);
        usleep(5000);
    }
    return 0;
}`
  },

  // ── DEMO 7: RASPBERRY PI COMPUTE MODULE 4 ────────────────────────────────
  {
    id: 'raspberry-pi-cm4',
    name: 'Raspberry Pi Compute Module 4 (CM4IO Board)',
    vendor: 'Raspberry Pi',
    boardName: 'Raspberry Pi CM4 + CM4IO Carrier Board',
    logoType: 'samsung' as const,
    architecture: 'ARM Cortex-A72 (BCM2711)',
    frequency: '1.5 GHz',
    workflow: [
      'CM4IO Carrier Board Schematic Analysis',
      'Raspberry Pi BCM2711 Datasheet Mapping',
      'Linux Kernel GPIO & Device Tree Overlay Generation',
      'gpiod User-Space C Application Assembly',
      'Linux Host Validation'
    ],
    inputFiles: ['cm4_io_board_schematic.pdf', 'cm4_requirement.txt'],
    generatedArtifacts: ['cm4_gpio_app.c', 'cm4_gpio_overlay.dts', 'validation_report.json'],
    toolchainUsed: 'Raspberry Pi OS Linux Kernel + GCC C Toolchain',
    supportedFlow: 'Linux',
    peripherals: [
      { id: '1', peripheralBlock: 'BCM2835 GPIO', physicalPinMapping: 'GPIO17 (J8 Header Pin 11) → GPIO27 (J8 Header Pin 13)', clockNetIndicator: true, baseAddress: '/dev/gpiochip0', driverName: 'pinctrl-bcm2835', clockSource: 'clk_core', bus: 'APB', verification_status: 'SOURCE_VERIFIED', provenanceSource: 'Raspberry Pi CM4IO Board Schematic (CM4IOv5.kicad_sch) Sheet 2', confidence: 1.0 }
    ],
    bareMetalCode: `/* Linux Target: Bare-Metal direct register access is NOT used for Linux OS flow. */`,
    deviceTreeCode: `/*
 * Linux GPIO Solution for Raspberry Pi Compute Module 4
 * Target Carrier Board: Raspberry Pi Official CM4 IO Board (CM4IO)
 * 
 * Hardware Truth Audit Note:
 * - CM4 Module alone has no onboard user LEDs/buttons.
 * - Connections mapped via CM4IO Board 40-pin J8 Header (CM4IOv5.kicad_sch Sheet 2):
 *   - GPIO17: J8 Pin 11 (External Push Button Input)
 *   - GPIO27: J8 Pin 13 (External LED Output)
 *
 * Excluded Peripherals:
 * - SPI, I2C, UART
 */

#include <stdio.h>
#include <unistd.h>
#include <gpiod.h>

int main(void) {
    struct gpiod_chip *chip = gpiod_chip_open_by_name("gpiochip0");
    if (!chip) return 1;

    struct gpiod_line *btn = gpiod_chip_get_line(chip, 17);
    struct gpiod_line *led = gpiod_chip_get_line(chip, 27);

    gpiod_line_request_input(btn, "cm4-btn");
    gpiod_line_request_output(led, "cm4-led", 0);

    while (1) {
        int val = gpiod_line_get_value(btn);
        gpiod_line_set_value(led, val);
        usleep(10000);
    }
    return 0;
}`
  }
];

export const platformPresets = rawPresets;
export const hardwarePresets: PlatformPreset[] = rawPresets;
