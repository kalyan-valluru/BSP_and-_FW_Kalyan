import { IDriverTemplateEngine } from './IDriverTemplateEngine';

export class VendorDriverTemplateEngine implements IDriverTemplateEngine {
  public readonly id = 'template-vendor-driver';
  public readonly name = 'Production Vendor Peripheral Driver Template Engine';
  public readonly supportedCategories = ['UART', 'GPIO', 'SPI', 'I2C', 'ETH', 'DMA'];

  public renderDriver(peripheralCategory: string, context: Record<string, any>): { sourceContent: string; headerContent: string } {
    const baseAddr = context.baseAddress || '0x41200000';
    const irqNum = context.irqNumber || 61;
    const cat = peripheralCategory.toUpperCase();

    if (cat === 'UART') {
      return {
        headerContent: `/* UART Peripheral Driver Header */\n#ifndef UART_DRIVER_H\n#define UART_DRIVER_H\n#include <stdint.h>\n#define UART_BASE_ADDR ${baseAddr}\n#define UART_IRQ ${irqNum}\nvoid UART_Init(uint32_t baseAddr);\nvoid UART_SendChar(char c);\nchar UART_ReadChar(void);\n#endif\n`,
        sourceContent: `/* UART Peripheral Driver Source */\n#include "uart.h"\nvoid UART_Init(uint32_t baseAddr) {\n    volatile uint32_t* ctrl = (volatile uint32_t*)(baseAddr + 0x0C);\n    *ctrl = 0x10; /* Reset FIFO */\n}\nvoid UART_SendChar(char c) {\n    volatile uint32_t* tx = (volatile uint32_t*)(UART_BASE_ADDR + 0x04);\n    *tx = (uint32_t)c;\n}\nchar UART_ReadChar(void) {\n    volatile uint32_t* rx = (volatile uint32_t*)(UART_BASE_ADDR + 0x00);\n    return (char)(*rx);\n}\n`
      };
    }

    if (cat === 'GPIO') {
      return {
        headerContent: `/* GPIO Peripheral Driver Header */\n#ifndef GPIO_DRIVER_H\n#define GPIO_DRIVER_H\n#include <stdint.h>\n#define GPIO_BASE_ADDR ${baseAddr}\nvoid GPIO_SetDirection(uint32_t mask, uint32_t isOutput);\nvoid GPIO_WritePin(uint32_t pin, uint8_t val);\n#endif\n`,
        sourceContent: `/* GPIO Peripheral Driver Source */\n#include "gpio.h"\nvoid GPIO_SetDirection(uint32_t mask, uint32_t isOutput) {\n    volatile uint32_t* dir = (volatile uint32_t*)(GPIO_BASE_ADDR + 0x04);\n    if (isOutput) *dir &= ~mask; else *dir |= mask;\n}\nvoid GPIO_WritePin(uint32_t pin, uint8_t val) {\n    volatile uint32_t* data = (volatile uint32_t*)(GPIO_BASE_ADDR + 0x00);\n    if (val) *data |= (1 << pin); else *data &= ~(1 << pin);\n}\n`
      };
    }

    // Default driver template
    return {
      headerContent: `/* ${cat} Peripheral Driver Header */\n#ifndef ${cat}_DRIVER_H\n#define ${cat}_DRIVER_H\n#include <stdint.h>\n#define ${cat}_BASE_ADDR ${baseAddr}\nvoid ${cat}_Init(void);\n#endif\n`,
      sourceContent: `/* ${cat} Peripheral Driver Source */\n#include "${cat.toLowerCase()}.h"\nvoid ${cat}_Init(void) {\n    volatile uint32_t* base = (volatile uint32_t*)${cat}_BASE_ADDR;\n    *base = 0x01;\n}\n`
    };
  }
}
