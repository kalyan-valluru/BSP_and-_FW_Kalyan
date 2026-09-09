import { ILinkerTemplateEngine } from './ILinkerTemplateEngine';

export class ArchitectureLinkerTemplateEngine implements ILinkerTemplateEngine {
  public readonly id = 'template-arch-linker';
  public readonly name = 'Multi-Architecture Linker & Startup Template Engine';
  public readonly supportedArchitectures = ['ARM Cortex-A9', 'ARM Cortex-A53', 'ARM Cortex-M7', 'RISC-V'];

  public renderLinkerScript(context: Record<string, any>): string {
    const procId = context.targetProcessorId || 'zynq-7000';
    const stackSize = context.stackSizeBytes || 0x4000;
    const heapSize = context.heapSizeBytes || 0x8000;

    return `/* GNU Linker Script for ${procId} */
ENTRY(Reset_Handler)

MEMORY
{
    FLASH (rx)  : ORIGIN = 0x00000000, LENGTH = 256K
    SRAM  (rwx) : ORIGIN = 0x00100000, LENGTH = 512M
}

SECTIONS
{
    .isr_vector :
    {
        . = ALIGN(4);
        KEEP(*(.isr_vector))
        . = ALIGN(4);
    } > FLASH

    .text :
    {
        . = ALIGN(4);
        *(.text*)
        *(.rodata*)
        . = ALIGN(4);
        _etext = .;
    } > SRAM AT> FLASH

    .data :
    {
        . = ALIGN(4);
        _sdata = .;
        *(.data*)
        . = ALIGN(4);
        _edata = .;
    } > SRAM AT> FLASH

    .bss :
    {
        . = ALIGN(4);
        _sbss = .;
        *(.bss*)
        . = ALIGN(4);
        _ebss = .;
    } > SRAM

    ._user_heap_stack :
    {
        . = ALIGN(8);
        . = . + ${heapSize};
        _eheap = .;
        . = . + ${stackSize};
        _estack = .;
        . = ALIGN(8);
    } > SRAM
}
`;
  }

  public renderStartupAssembly(context: Record<string, any>): string {
    return `/* Assembly Startup Handler */
.syntax unified
.global Reset_Handler
.type Reset_Handler, %function

Reset_Handler:
    /* Stack Pointer Initialization */
    ldr r0, =_estack
    mov sp, r0

    /* Copy .data Section from FLASH to SRAM */
    ldr r0, =_sdata
    ldr r1, =_edata
    ldr r2, =_etext
copy_data_loop:
    cmp r0, r1
    bcs zero_bss_init
    ldr r3, [r2], #4
    str r3, [r0], #4
    b copy_data_loop

zero_bss_init:
    /* Zero .bss Section */
    ldr r0, =_sbss
    ldr r1, =_ebss
    mov r2, #0
zero_bss_loop:
    cmp r0, r1
    bcs jump_main
    str r2, [r0], #4
    b zero_bss_loop

jump_main:
    bl SystemInit
    bl main
1:  b 1b
`;
  }

  public renderVectorTable(context: Record<string, any>): { sourceContent: string; headerContent: string } {
    return {
      headerContent: `/* Interrupt Vector Table Header */\n#ifndef VECTORS_H\n#define VECTORS_H\nvoid Reset_Handler(void);\nvoid NMI_Handler(void);\nvoid HardFault_Handler(void);\n#endif\n`,
      sourceContent: `/* Interrupt Vector Table Array Source */\n#include "vectors.h"\n__attribute__ ((section(".isr_vector")))\nvoid (* const g_pfnVectors[])(void) = {\n    Reset_Handler,\n    NMI_Handler,\n    HardFault_Handler\n};\nvoid NMI_Handler(void) { while(1); }\nvoid HardFault_Handler(void) { while(1); }\n`
    };
  }
}
