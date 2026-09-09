import { generateFreeRTOSApp } from '../freertosDtcEngine';
import { HALDevice, HALPeripheral } from '../hal_bsp_engine';
import { ToolchainCapabilities } from '../toolchainResolver';

export interface BspFile {
  filename: string;
  code: string;
}

import { BoardMetadataLayer } from '../boardMetadataLayer';

export interface LinkerMemoryRegion {
  name: string;
  origin: string;
  length: string;
  source: 'HKL/HALDevice' | 'Project' | 'BoardMetadata' | 'SafeFallback';
}

export function resolveStm32MemoryRegions(device: HALDevice): { flash: LinkerMemoryRegion; ram: LinkerMemoryRegion } {
  const devAny = device as any;

  // Priority 1 & 2: Explicit validated HKL / HALDevice / Project memory regions
  if (devAny.memoryRegions && Array.isArray(devAny.memoryRegions) && devAny.memoryRegions.length >= 2) {
    const flashReg = devAny.memoryRegions.find((r: any) => r.name.toUpperCase().includes('FLASH'));
    const ramReg = devAny.memoryRegions.find((r: any) => r.name.toUpperCase().includes('RAM'));
    if (flashReg && ramReg) {
      return {
        flash: { name: 'FLASH', origin: flashReg.base || flashReg.origin, length: flashReg.length || flashReg.size, source: 'HKL/HALDevice' },
        ram: { name: 'RAM', origin: ramReg.base || ramReg.origin, length: ramReg.length || ramReg.size, source: 'HKL/HALDevice' }
      };
    }
  }

  // Priority 3: Board Metadata Defaults from BoardMetadataLayer
  const meta = BoardMetadataLayer.getMetadata(device.boardName);
  if (meta && (meta as any).flashOrigin && (meta as any).ramOrigin) {
    return {
      flash: { name: 'FLASH', origin: (meta as any).flashOrigin, length: (meta as any).flashLength || '2048K', source: 'BoardMetadata' },
      ram: { name: 'RAM', origin: (meta as any).ramOrigin, length: (meta as any).ramLength || '512K', source: 'BoardMetadata' }
    };
  }

  // Priority 4: Existing Safe Fallback
  return {
    flash: { name: 'FLASH', origin: '0x08000000', length: '2048K', source: 'SafeFallback' },
    ram: { name: 'RAM', origin: '0x24000000', length: '512K', source: 'SafeFallback' }
  };
}

/**
 * Generates all vendor-specific BSP and peripheral driver files to form a complete buildable project.
 */
export function generateVendorBSP(device: HALDevice, capabilities: ToolchainCapabilities): BspFile[] {
  const files: BspFile[] = [];
  const isXilinx = capabilities.vendor.toLowerCase().includes('xilinx') || capabilities.supportsVivado;
  const isSTM32 = capabilities.vendor.toLowerCase().includes('stmicro') || capabilities.processorFamily.toLowerCase().includes('stm32');

  const isResolved = (p: HALPeripheral) => {
    if (p.fieldStatuses) {
      if (p.fieldStatuses.baseAddress === 'unresolved' || p.fieldStatuses.interruptNumber === 'unresolved' || p.fieldStatuses.clockSource === 'unresolved') {
        return false;
      }
    }
    return p.baseAddress !== 'unresolved' && String(p.interrupt ? p.interrupt.number : '').indexOf('unresolved') === -1;
  };

  const activePeripherals = device.peripherals.filter(isResolved);
  const skippedPeripherals = device.peripherals.filter(p => !isResolved(p));

  const uarts = device.peripherals.filter(p => p.category === 'UART');
  const gpios = device.peripherals.filter(p => p.category === 'GPIO');

  if (isSTM32) {
    // ─────────────────────────────────────────────────────────────────────────
    // 1. STM32 VENDOR BSP GENERATOR
    // ─────────────────────────────────────────────────────────────────────────

    const memRegions = resolveStm32MemoryRegions(device);

    // Linker Script
    files.push({
      filename: 'linker.ld',
      code: `/* Linker Script for STM32 (Generated for ${device.boardName} | Memory Source: ${memRegions.flash.source}) */
ENTRY(Reset_Handler)

MEMORY {
    FLASH (rx) : ORIGIN = ${memRegions.flash.origin}, LENGTH = ${memRegions.flash.length}
    RAM (rwx)  : ORIGIN = ${memRegions.ram.origin}, LENGTH = ${memRegions.ram.length}
}

SECTIONS {
    .text : {
        KEEP(*(.isr_vector))
        *(.text*)
        *(.rodata*)
        *(.glue_7)
        *(.glue_7t)
        *(.eh_frame)
        . = ALIGN(4);
        _etext = .;
    } > FLASH

    .data : {
        _sdata = .;
        *(.data*)
        . = ALIGN(4);
        _edata = .;
    } > RAM AT > FLASH

    .bss : {
        _sbss = .;
        __bss_start__ = _sbss;
        *(.bss*)
        *(COMMON)
        . = ALIGN(4);
        _ebss = .;
        __bss_end__ = _ebss;
    } > RAM

    _estack = ORIGIN(RAM) + LENGTH(RAM);
}
`
    });


    // Startup File
    files.push({
      filename: 'startup_stm32h7xx.c',
      code: `/**
 * startup_stm32h7xx.c
 * Vector table and startup code for Cortex-M7
 */
#include <stdint.h>

extern int main(void);
extern uint32_t _etext;
extern uint32_t _sdata;
extern uint32_t _edata;
extern uint32_t _sbss;
extern uint32_t _ebss;
extern uint32_t _estack;

void Reset_Handler(void);
void Default_Handler(void) { while(1); }

void NMI_Handler(void) __attribute__((weak, alias("Default_Handler")));
void HardFault_Handler(void) __attribute__((weak, alias("Default_Handler")));
void MemManage_Handler(void) __attribute__((weak, alias("Default_Handler")));
void BusFault_Handler(void) __attribute__((weak, alias("Default_Handler")));
void UsageFault_Handler(void) __attribute__((weak, alias("Default_Handler")));
void SVC_Handler(void) __attribute__((weak, alias("Default_Handler")));
void DebugMon_Handler(void) __attribute__((weak, alias("Default_Handler")));
void PendSV_Handler(void) __attribute__((weak, alias("Default_Handler")));
void SysTick_Handler(void) __attribute__((weak, alias("Default_Handler")));

// Peripheral interrupt vectors
${activePeripherals.filter(p => p.interrupt).map(p => `void ${p.name}_IRQHandler(void) __attribute__((weak, alias("Default_Handler")));`).join('\n')}
/* Skipped vectors:
${skippedPeripherals.map(p => ` * ${p.name}_IRQHandler (Skipped: Unresolved Parameter)`).join('\n')}
 */

__attribute__((section(".isr_vector"), used))
void (*const g_pfnVectors[])(void) = {
    (void (*)(void))&_estack,
    Reset_Handler,
    NMI_Handler,
    HardFault_Handler,
    MemManage_Handler,
    BusFault_Handler,
    UsageFault_Handler,
    0, 0, 0, 0,
    SVC_Handler,
    DebugMon_Handler,
    0,
    PendSV_Handler,
    SysTick_Handler,
    // Add custom interrupts matching vectors offsets
    ${activePeripherals.filter(p => p.interrupt).map(p => `${p.name}_IRQHandler,`).join('\n    ')}
};

void Reset_Handler(void) {
    // Copy data segment
    uint32_t *src = &_etext;
    uint32_t *dst = &_sdata;
    while (dst < &_edata) {
        *dst++ = *src++;
    }

    // Clear bss segment
    dst = &_sbss;
    while (dst < &_ebss) {
        *dst++ = 0;
    }

    // Branch to main
    main();
    while (1);
}
`
    });

    // Clock tree and system files
    files.push({
      filename: 'system_stm32h7xx.c',
      code: `/**
 * system_stm32h7xx.c
 * Clock Tree Initialization
 */
#include "stm32h7xx_hal.h"

void SystemClock_Config(void) {
    // Stub clock setup for STM32H7 running at 480 MHz
    HAL_RCC_OscConfig();
    HAL_RCC_ClockConfig();
}
`
    });

    // STM32 HAL configurations
    files.push({
      filename: 'stm32h7xx_hal.h',
      code: `/**
 * stm32h7xx_hal.h
 * STM32 HAL wrapper stubs
 */
#ifndef STM32H7XX_HAL_H
#define STM32H7XX_HAL_H
#include <stdint.h>

typedef enum {
    HAL_OK = 0x00,
    HAL_ERROR = 0x01,
    HAL_BUSY = 0x02,
    HAL_TIMEOUT = 0x03
} HAL_StatusTypeDef;

void HAL_Init(void);
void HAL_RCC_OscConfig(void);
void HAL_RCC_ClockConfig(void);

#endif`
    });

    files.push({
      filename: 'stm32h7xx_hal.c',
      code: `#include "stm32h7xx_hal.h"\nvoid HAL_Init(void) {}\nvoid HAL_RCC_OscConfig(void) {}\nvoid HAL_RCC_ClockConfig(void) {}`
    });

    files.push({
      filename: 'stm32h7xx_hal_conf.h',
      code: `/* STM32 HAL Configuration | Target: ${device.boardName} */\n#define HAL_MODULE_ENABLED`
    });

    // platform.h / platform.c stubs (maps Zynq platform hooks to STM32 HAL init)
    files.push({
      filename: 'platform.h',
      code: `/**
 * platform.h
 * Zynq-compatible interface mapped to STM32.
 */
#ifndef PLATFORM_H
#define PLATFORM_H

void init_platform(void);
void cleanup_platform(void);

#endif`
    });

    files.push({
      filename: 'platform.c',
      code: `/**
 * platform.c
 * STM32 HAL initializers
 */
#include "platform.h"
#include "stm32h7xx_hal.h"

void init_platform(void) {
    HAL_Init();
}
void cleanup_platform(void) {
    // Release peripherals
}
`
    });

    // system_init.h / system_init.c stubs
    files.push({
      filename: 'system_init.h',
      code: `#ifndef SYSTEM_INIT_H\n#define SYSTEM_INIT_H\nint system_init(void);\n#endif`
    });

    const activeUarts = uarts.filter(isResolved);
    const uartBase = activeUarts.length > 0 ? activeUarts[0].baseAddress : '0x40011000';
    const isUartActive = activeUarts.length > 0;

    files.push({
      filename: 'system_init.c',
      code: `/**
 * system_init.c
 * System-wide peripheral initialization
 */
#include "system_init.h"
#include "platform.h"
#include "uart.h"
#include "xil_printf.h"

int system_init(void) {
    init_platform();
    ${isUartActive ? 'uart_init();' : '// uart_init(); /* UART is skipped: Unresolved Parameter */'}
    xil_printf("[STM32 BSP] Peripherals initialized successfully.\\r\\n");
    return 0;
}
`
    });

    // interrupt.h / interrupt.c stubs
    files.push({
      filename: 'interrupt.h',
      code: `#ifndef INTERRUPT_H\n#define INTERRUPT_H\nint interrupt_init(void);\n#endif`
    });

    files.push({
      filename: 'interrupt.c',
      code: `/**
 * interrupt.c
 * STM32 NVIC initialization
 */
#include "interrupt.h"

int interrupt_init(void) {
    // Configure NVIC priority grouping and enable IRQ channels
    return 0;
}
`
    });

    // uart.h / uart.c stubs
    files.push({
      filename: 'uart.h',
      code: isUartActive ? `/**
 * uart.h
 * STM32 USART wrapper
 */
#ifndef UART_H
#define UART_H
#include <stdint.h>

#define UART_BASEADDR ${uartBase}

int uart_init(void);
void uart_send_byte(uint8_t data);
uint8_t uart_recv_byte(void);
void uart_send_string(const char *str);

#endif` : `/* UART is skipped: Unresolved Base Address or Parameter */\n#ifndef UART_H\n#define UART_H\n#include <stdint.h>\n#define UART_BASEADDR 0\nstatic inline int uart_init(void) { return 0; }\nstatic inline void uart_send_byte(uint8_t d) {}\nstatic inline uint8_t uart_recv_byte(void) { return 0; }\nstatic inline void uart_send_string(const char *s) {}\n#endif`
    });

    files.push({
      filename: 'uart.c',
      code: isUartActive ? `/**
 * uart.c
 * STM32 USART implementation
 */
#include "uart.h"

int uart_init(void) {
    // Initialize USART peripheral registers at ${uartBase}
    return 0;
}

void uart_send_byte(uint8_t data) {
    // Write data to USART TDR register
}

uint8_t uart_recv_byte(void) {
    // Read from USART RDR register
    return 0;
}

void uart_send_string(const char *str) {
    while (*str) {
        uart_send_byte((uint8_t)*str++);
    }
}
` : `/* UART is skipped: Unresolved Base Address or Parameter */\n#include "uart.h"\n`
    });

    // xil_printf.h / xil_printf.c stubs (maps xil_printf to UART string output)
    files.push({
      filename: 'xil_printf.h',
      code: `/**
 * xil_printf.h
 * Redirects Xilinx printfs to STM32 UART channel.
 */
#ifndef XIL_PRINTF_H
#define XIL_PRINTF_H

void xil_printf(const char *format, ...);

#endif`
    });

    files.push({
      filename: 'xil_printf.c',
      code: `/**
 * xil_printf.c
 * Standard console stubs
 */
#include "xil_printf.h"
#include "uart.h"
#include <stdarg.h>
#include <stdio.h>

void xil_printf(const char *format, ...) {
    char buffer[128];
    va_list args;
    va_start(args, format);
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);
    uart_send_string(buffer);
}
`
    });

    // gpio.h / gpio.c
    const gpioPeriphs = gpios;
    const gpioBaseAddr = gpioPeriphs.length > 0 ? gpioPeriphs[0].baseAddress : '0x58020000';
    files.push({
      filename: 'gpio.h',
      code: `/**
 * gpio.h - STM32 GPIO driver interface
 */
#ifndef GPIO_H
#define GPIO_H
#include <stdint.h>

#define GPIO_BASEADDR ${gpioBaseAddr}

int  gpio_init(void);
void gpio_set_direction(uint32_t pin, int output);
void gpio_write(uint32_t pin, int val);
int  gpio_read(uint32_t pin);

#endif /* GPIO_H */`
    });
    files.push({
      filename: 'gpio.c',
      code: `/**
 * gpio.c - STM32 GPIO driver implementation
 */
#include "gpio.h"

int gpio_init(void) {
    return 0;
}
void gpio_set_direction(uint32_t pin, int output) {
    (void)pin; (void)output;
}
void gpio_write(uint32_t pin, int val) {
    (void)pin; (void)val;
}
int gpio_read(uint32_t pin) {
    (void)pin; return 0;
}
`
    });

    // spi.h / spi.c
    files.push({
      filename: 'spi.h',
      code: `#ifndef SPI_H\n#define SPI_H\n#include <stdint.h>\nint spi_init(void);\nvoid spi_transfer(uint8_t *s, uint8_t *r, uint32_t len);\n#endif`
    });
    files.push({
      filename: 'spi.c',
      code: `#include "spi.h"\nint spi_init(void) { return 0; }\nvoid spi_transfer(uint8_t *s, uint8_t *r, uint32_t len) { (void)s; (void)r; (void)len; }\n`
    });

    // i2c.h / i2c.c
    files.push({
      filename: 'i2c.h',
      code: `#ifndef I2C_H\n#define I2C_H\n#include <stdint.h>\nint i2c_init(uint32_t clk);\nint i2c_write(uint8_t a, const uint8_t *b, uint32_t l);\nint i2c_read(uint8_t a, uint8_t *b, uint32_t l);\n#endif`
    });
    files.push({
      filename: 'i2c.c',
      code: `#include "i2c.h"\nint i2c_init(uint32_t c) { (void)c; return 0; }\nint i2c_write(uint8_t a, const uint8_t *b, uint32_t l) { (void)a; (void)b; (void)l; return 0; }\nint i2c_read(uint8_t a, uint8_t *b, uint32_t l) { (void)a; (void)b; (void)l; return 0; }\n`
    });

    // timer.h / timer.c
    files.push({
      filename: 'timer.h',
      code: `#ifndef TIMER_H\n#define TIMER_H\n#include <stdint.h>\nint timer_init(void);\nvoid timer_start(void);\nuint32_t timer_get_value(void);\nvoid timer_delay_ms(uint32_t ms);\n#endif`
    });
    files.push({
      filename: 'timer.c',
      code: `#include "timer.h"\nint timer_init(void) { return 0; }\nvoid timer_start(void) {}\nuint32_t timer_get_value(void) { return 0; }\nvoid timer_delay_ms(uint32_t ms) { for (volatile uint32_t i=0; i<ms*5000; i++); }\n`
    });

    // Makefile
    files.push({
      filename: 'Makefile',
      code: `# Makefile for STM32H7 (ARM Cortex-M7)
CC = arm-none-eabi-gcc
OBJCOPY = arm-none-eabi-objcopy
CFLAGS = -mcpu=cortex-m4 -mthumb -O2 -Wall -DSTM32F407xx -I.
LDFLAGS = -T linker.ld -nostartfiles -Wl,--gc-sections

SRCS = main.c startup_stm32h7xx.c system_stm32h7xx.c stm32h7xx_hal.c platform.c system_init.c interrupt.c uart.c gpio.c spi.c i2c.c timer.c
OBJS = $(SRCS:.c=.o)

all: firmware.elf firmware.bin

firmware.elf: $(OBJS)
\t$(CC) $(CFLAGS) $(OBJS) -o $@ $(LDFLAGS)

firmware.bin: firmware.elf
\t$(OBJCOPY) -O binary $< $@

%.o: %.c
\t$(CC) $(CFLAGS) -c $< -o $@

clean:
\trm -f $(OBJS) firmware.elf firmware.bin
`
    });

  } else {
    // ─────────────────────────────────────────────────────────────────────────
    // 2. AMD/XILINX VENDOR BSP GENERATOR
    // ─────────────────────────────────────────────────────────────────────────

    // xparameters.h
    const macros = device.peripherals.map((p, idx) => {
      if (!isResolved(p)) {
        return `/* ${p.name} is skipped: Unresolved Base Address or IRQ mapping */`;
      }
      const macroId = p.name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
      const irq = p.interrupt ? p.interrupt.number : 0;
      return `#define XPAR_${macroId}_DEVICE_ID ${idx}\n#define XPAR_${macroId}_BASEADDR ${p.baseAddress}\n#define XPAR_${macroId}_HIGHADDR 0x${(parseInt(p.baseAddress, 16) + 0xFFF).toString(16).toUpperCase()}\n#define XPAR_${macroId}_IRQ ${irq}`;
    }).join('\n\n');

    files.push({
      filename: 'xparameters.h',
      code: `/**
 * xparameters.h
 * AMD/Xilinx hardware parameter definitions.
 */
#ifndef XPARAMETERS_H
#define XPARAMETERS_H

#define XPAR_CPU_CORTEXA9_0_CPU_CLK_FREQ_HZ 667000000U
#define XPAR_SCUGIC_SINGLE_DEVICE_ID 0U

${macros}

/* Fallback definitions for standard driver device IDs */
#ifndef XPAR_XUARTPS_0_DEVICE_ID
#if defined(XPAR_PS7_UART_1_DEVICE_ID)
#define XPAR_XUARTPS_0_DEVICE_ID XPAR_PS7_UART_1_DEVICE_ID
#elif defined(XPAR_UART1_DEVICE_ID)
#define XPAR_XUARTPS_0_DEVICE_ID XPAR_UART1_DEVICE_ID
#else
#define XPAR_XUARTPS_0_DEVICE_ID 0U
#endif
#endif

#ifndef XPAR_XGPIOPS_0_DEVICE_ID
#if defined(XPAR_PS7_GPIO_0_DEVICE_ID)
#define XPAR_XGPIOPS_0_DEVICE_ID XPAR_PS7_GPIO_0_DEVICE_ID
#elif defined(XPAR_GPIO_DEVICE_ID)
#define XPAR_XGPIOPS_0_DEVICE_ID XPAR_GPIO_DEVICE_ID
#else
#define XPAR_XGPIOPS_0_DEVICE_ID 0U
#endif
#endif

#endif`
    });

    // platform.h / platform.c
    files.push({
      filename: 'platform.h',
      code: `#ifndef PLATFORM_H\n#define PLATFORM_H\nvoid init_platform(void);\nvoid cleanup_platform(void);\n#endif`
    });

    files.push({
      filename: 'platform.c',
      code: `/**
 * platform.c
 * Zynq hardware platform setups.
 */
#include "platform.h"
#include "xparameters.h"

void init_platform(void) {
    // Enable cache, initialize MMU
}
void cleanup_platform(void) {
    // Disable cache
}
`
    });

    // system_init.h / system_init.c
    files.push({
      filename: 'system_init.h',
      code: `#ifndef SYSTEM_INIT_H\n#define SYSTEM_INIT_H\nint system_init(void);\n#endif`
    });

    files.push({
      filename: 'system_init.c',
      code: `/**
 * system_init.c
 * System peripheral driver instantiations
 */
#include "system_init.h"
#include "platform.h"
#include "uart.h"
#include "xil_printf.h"

int system_init(void) {
    init_platform();
    uart_init();
    xil_printf("[Xilinx BSP] Peripheral initializations complete.\\r\\n");
    return 0;
}
`
    });

    // interrupt.h / interrupt.c
    files.push({
      filename: 'interrupt.h',
      code: `#ifndef INTERRUPT_H\n#define INTERRUPT_H\nint interrupt_init(void);\n#endif`
    });

    files.push({
      filename: 'interrupt.c',
      code: `/**
 * interrupt.c
 * SCU GIC / Interrupt controller configurations
 */
#include "interrupt.h"
#include "xil_exception.h"

int interrupt_init(void) {
    Xil_ExceptionInit();
    Xil_ExceptionEnable();
    return 0;
}
`
    });

    // uart.h / uart.c
    const uartBase = uarts.length > 0 ? uarts[0].baseAddress : '0xE0001000';
    files.push({
      filename: 'uart.h',
      code: `/**
 * uart.h
 * Xilinx PS UART wrapper
 */
#ifndef UART_H
#define UART_H
#include <stdint.h>

#define UART_BASEADDR ${uartBase}

int uart_init(void);
void uart_send_byte(uint8_t data);
uint8_t uart_recv_byte(void);
void uart_send_string(const char *str);

#endif`
    });

    files.push({
      filename: 'uart.c',
      code: `/**
 * uart.c
 * Xilinx PS UART driver implementation
 */
#include "uart.h"

int uart_init(void) {
    return 0;
}

void uart_send_byte(uint8_t data) {
    volatile uint32_t *cr = (volatile uint32_t *)(UART_BASEADDR + 0x00);
    volatile uint32_t *sr = (volatile uint32_t *)(UART_BASEADDR + 0x2C);
    volatile uint32_t *fifo = (volatile uint32_t *)(UART_BASEADDR + 0x30);
    
    // Enable transmitter if not enabled
    if ((*cr & 0x10) == 0) {
        *cr |= 0x10;
    }
    
    // Wait for FIFO not full
    while ((*sr & 0x10) != 0);
    *fifo = data;
}

uint8_t uart_recv_byte(void) {
    volatile uint32_t *sr = (volatile uint32_t *)(UART_BASEADDR + 0x2C);
    volatile uint32_t *fifo = (volatile uint32_t *)(UART_BASEADDR + 0x30);
    
    // Wait for data
    while ((*sr & 0x02) != 0);
    return (uint8_t)*fifo;
}

void uart_send_string(const char *str) {
    while (*str) {
        uart_send_byte((uint8_t)*str++);
    }
}
`
    });

    // xil_printf.h / xil_printf.c
    files.push({
      filename: 'xil_printf.h',
      code: `#ifndef XIL_PRINTF_H\n#define XIL_PRINTF_H\nvoid xil_printf(const char *format, ...);\n#endif`
    });

    files.push({
      filename: 'xil_printf.c',
      code: `/**
 * xil_printf.c
 * Lightweight console print redirects
 */
#include "xil_printf.h"
#include "uart.h"
#include <stdarg.h>
#include <stdio.h>

void xil_printf(const char *format, ...) {
    char buffer[128];
    va_list args;
    va_start(args, format);
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);
    uart_send_string(buffer);
}
`
    });

    // xil_exception.h / xil_exception.c
    files.push({
      filename: 'xil_exception.h',
      code: `#ifndef XIL_EXCEPTION_H\n#define XIL_EXCEPTION_H\nvoid Xil_ExceptionInit(void);\nvoid Xil_ExceptionEnable(void);\n#endif`
    });

    files.push({
      filename: 'xil_exception.c',
      code: `#include "xil_exception.h"\nvoid Xil_ExceptionInit(void) {}\nvoid Xil_ExceptionEnable(void) {}`
    });

    // startup.c
    files.push({
      filename: 'startup.c',
      code: `/**
 * startup.c
 * Zynq Reset Handler vectors
 */
extern int main(void);
void Reset_Handler(void) {
    main();
    while(1);
}
`
    });

    // linker.ld
    files.push({
      filename: 'linker.ld',
      code: `/* Linker Script for Xilinx Zynq-7000 (Generated for ${device.boardName}) */
ENTRY(Reset_Handler)

MEMORY {
    DDR (rwx) : ORIGIN = 0x00100000, LENGTH = 512M
}

SECTIONS {
    .text : {
        *(.text*)
        *(.rodata*)
    } > DDR
    
    .data : { *(.data*) } > DDR
    .bss : { *(.bss*) } > DDR
    _estack = ORIGIN(DDR) + LENGTH(DDR);
}
`
    });

    // gpio.h / gpio.c — always emitted so main.c #includes resolve
    const gpioPeriphs = gpios;
    const gpioBaseAddr = gpioPeriphs.length > 0 ? gpioPeriphs[0].baseAddress : '0xFF0A0000';
    files.push({
      filename: 'gpio.h',
      code: `/**
 * gpio.h - GPIO driver interface
 * Auto-generated by GenAI BSP Platform (Xilinx/AMD)
 */
#ifndef GPIO_H
#define GPIO_H
#include <stdint.h>

#define GPIO_BASEADDR ${gpioBaseAddr}

int  gpio_init(void);
void gpio_set_direction(uint32_t pin, int output);
void gpio_write(uint32_t pin, int val);
int  gpio_read(uint32_t pin);

#endif /* GPIO_H */`
    });
    files.push({
      filename: 'gpio.c',
      code: `/**
 * gpio.c - GPIO driver implementation
 * Auto-generated by GenAI BSP Platform (Xilinx/AMD)
 */
#include "gpio.h"

int gpio_init(void) {
    volatile uint32_t *dirm = (volatile uint32_t *)(GPIO_BASEADDR + 0x284);
    volatile uint32_t *oen  = (volatile uint32_t *)(GPIO_BASEADDR + 0x288);
    *dirm = 0xFF; /* all outputs */
    *oen  = 0xFF;
    return 0;
}

void gpio_set_direction(uint32_t pin, int output) {
    volatile uint32_t *dirm = (volatile uint32_t *)(GPIO_BASEADDR + 0x284);
    volatile uint32_t *oen  = (volatile uint32_t *)(GPIO_BASEADDR + 0x288);
    if (output) { *dirm |= (1U << pin); *oen |= (1U << pin); }
    else        { *dirm &= ~(1U << pin); }
}

void gpio_write(uint32_t pin, int val) {
    volatile uint32_t *data = (volatile uint32_t *)(GPIO_BASEADDR + 0x40);
    if (val) *data |=  (1U << pin);
    else     *data &= ~(1U << pin);
}

int gpio_read(uint32_t pin) {
    volatile uint32_t *data = (volatile uint32_t *)(GPIO_BASEADDR + 0x60);
    return (*data >> pin) & 1;
}
`
    });

    // spi.h / spi.c — always emitted so main.c #includes resolve
    const spiPeriphs = device.peripherals.filter(p => p.category === 'SPI');
    const spiBaseAddr = spiPeriphs.length > 0 ? spiPeriphs[0].baseAddress : '0xFF040000';
    files.push({
      filename: 'spi.h',
      code: `/**
 * spi.h - SPI driver interface
 * Auto-generated by GenAI BSP Platform (Xilinx/AMD)
 */
#ifndef SPI_H
#define SPI_H
#include <stdint.h>

#define SPI_BASEADDR ${spiBaseAddr}

int  spi_init(void);
void spi_transfer(uint8_t *send_buf, uint8_t *recv_buf, uint32_t len);

#endif /* SPI_H */`
    });
    files.push({
      filename: 'spi.c',
      code: `/**
 * spi.c - SPI driver implementation
 * Auto-generated by GenAI BSP Platform (Xilinx/AMD)
 */
#include "spi.h"

int spi_init(void) {
    volatile uint32_t *cr = (volatile uint32_t *)(SPI_BASEADDR + 0x00);
    *cr = 0x00000001; /* Enable */
    return 0;
}

void spi_transfer(uint8_t *send_buf, uint8_t *recv_buf, uint32_t len) {
    volatile uint32_t *tx = (volatile uint32_t *)(SPI_BASEADDR + 0x1C);
    volatile uint32_t *rx = (volatile uint32_t *)(SPI_BASEADDR + 0x20);
    volatile uint32_t *sr = (volatile uint32_t *)(SPI_BASEADDR + 0x04);
    for (uint32_t i = 0; i < len; i++) {
        while (*sr & 0x00000010); /* wait TX not full */
        *tx = send_buf ? send_buf[i] : 0xFF;
        while (!(*sr & 0x00000001)); /* wait RX not empty */
        if (recv_buf) recv_buf[i] = (uint8_t)(*rx & 0xFF);
        else (void)*rx;
    }
}
`
    });

    // i2c.h / i2c.c — always emitted so main.c #includes resolve
    const i2cPeriphs = device.peripherals.filter(p => p.category === 'I2C');
    const i2cBaseAddr = i2cPeriphs.length > 0 ? i2cPeriphs[0].baseAddress : '0xFF020000';
    files.push({
      filename: 'i2c.h',
      code: `/**
 * i2c.h - I2C driver interface
 * Auto-generated by GenAI BSP Platform (Xilinx/AMD)
 */
#ifndef I2C_H
#define I2C_H
#include <stdint.h>

#define I2C_BASEADDR ${i2cBaseAddr}

int  i2c_init(uint32_t clk_hz);
int  i2c_write(uint8_t addr, const uint8_t *buf, uint32_t len);
int  i2c_read(uint8_t addr, uint8_t *buf, uint32_t len);

#endif /* I2C_H */`
    });
    files.push({
      filename: 'i2c.c',
      code: `/**
 * i2c.c - I2C driver implementation
 * Auto-generated by GenAI BSP Platform (Xilinx/AMD)
 */
#include "i2c.h"

int i2c_init(uint32_t clk_hz) {
    volatile uint32_t *cr = (volatile uint32_t *)(I2C_BASEADDR + 0x00);
    (void)clk_hz;
    *cr = 0x0000000E; /* master mode, enable */
    return 0;
}

int i2c_write(uint8_t addr, const uint8_t *buf, uint32_t len) {
    volatile uint32_t *ar   = (volatile uint32_t *)(I2C_BASEADDR + 0x08);
    volatile uint32_t *data = (volatile uint32_t *)(I2C_BASEADDR + 0x0C);
    volatile uint32_t *sr   = (volatile uint32_t *)(I2C_BASEADDR + 0x04);
    *ar = addr;
    for (uint32_t i = 0; i < len; i++) {
        *data = buf[i];
        while (*sr & 0x00000200); /* wait not busy */
    }
    return 0;
}

int i2c_read(uint8_t addr, uint8_t *buf, uint32_t len) {
    volatile uint32_t *ar   = (volatile uint32_t *)(I2C_BASEADDR + 0x08);
    volatile uint32_t *data = (volatile uint32_t *)(I2C_BASEADDR + 0x0C);
    volatile uint32_t *sr   = (volatile uint32_t *)(I2C_BASEADDR + 0x04);
    *ar = (uint32_t)(addr | 0x01);
    for (uint32_t i = 0; i < len; i++) {
        while (!(*sr & 0x00000020)); /* wait data ready */
        buf[i] = (uint8_t)(*data & 0xFF);
    }
    return 0;
}
`
    });

    // timer.h / timer.c — always emitted; timer_delay_ms needed by main.c
    files.push({
      filename: 'timer.h',
      code: `/**
 * timer.h - Timer driver interface
 * Auto-generated by GenAI BSP Platform (Xilinx/AMD)
 */
#ifndef TIMER_H
#define TIMER_H
#include <stdint.h>

int  timer_init(void);
void timer_start(void);
uint32_t timer_get_value(void);
void timer_delay_ms(uint32_t ms);

#endif /* TIMER_H */`
    });
    files.push({
      filename: 'timer.c',
      code: `/**
 * timer.c - Timer driver implementation
 * Auto-generated by GenAI BSP Platform (Xilinx/AMD)
 */
#include "timer.h"

int timer_init(void) {
    return 0;
}

void timer_start(void) {
}

uint32_t timer_get_value(void) {
    return 0;
}

void timer_delay_ms(uint32_t ms) {
    /* Busy-wait loop — replace with hardware timer for production */
    for (volatile uint32_t i = 0; i < ms * 10000U; i++) {
        (void)i;
    }
}
`
    });

    // Makefile
    files.push({
      filename: 'Makefile',
      code: `# Makefile for AMD/Xilinx Zynq
CC = arm-none-eabi-gcc
OBJCOPY = arm-none-eabi-objcopy
CFLAGS = -mcpu=cortex-a9 -O2 -Wall --specs=nosys.specs -I.
LDFLAGS = -T linker.ld -nostartfiles

SRCS = main.c platform.c system_init.c interrupt.c uart.c xil_printf.c xil_exception.c startup.c
OBJS = $(SRCS:.c=.o)

all: firmware.elf

firmware.elf: $(OBJS)
\t$(CC) $(CFLAGS) $(OBJS) -o $@ $(LDFLAGS)

%.o: %.c
\t$(CC) $(CFLAGS) -c $< -o $@

clean:
\trm -f $(OBJS) firmware.elf
`
    });
  }

  // Include basic drivers for each peripheral block
  device.peripherals.forEach(p => {
    const filenameBase = p.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    files.push({
      filename: `drivers/${filenameBase}_drv.h`,
      code: `#ifndef ${filenameBase.toUpperCase()}_DRV_H\n#define ${filenameBase.toUpperCase()}_DRV_H\n#include <stdint.h>\nvoid ${filenameBase}_init(void);\n#endif`
    });
    files.push({
      filename: `drivers/${filenameBase}_drv.c`,
      code: `#include "drivers/${filenameBase}_drv.h"\n#include "platform.h"\nvoid ${filenameBase}_init(void) { /* Driver init register logic for ${p.name} @ ${p.baseAddress} */ }`
    });
  });

  // Synthesize FreeRTOS Application & Config Header
  const freertos = generateFreeRTOSApp(device.processor, device.peripherals.map(p => ({ peripheralBlock: p.name, type: p.category, interruptNumber: p.interrupt?.number })));
  files.push({ filename: 'freertos_app.c', code: freertos.freertosAppCode });
  files.push({ filename: 'FreeRTOSConfig.h', code: freertos.freertosConfigHeader });

  return files;
}
