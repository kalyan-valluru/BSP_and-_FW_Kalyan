/**
 * xparameters.h
 * Official Vendor Canonical Hardware Parameter Definitions
 */

#ifndef XPARAMETERS_H_
#define XPARAMETERS_H_

#include <stdint.h>

#define XPAR_UARTLITE_0_BASEADDR 0x40600000U
#define XPAR_GPIO_0_BASEADDR 0x41200000U
#define XPAR_CPU_CORE_CLOCK_FREQ_HZ 666666667U

typedef uint32_t u32;
typedef uint16_t u16;
typedef uint8_t u8;
typedef uintptr_t UINTPTR;

#define Xil_Out32(Addr, Value) (*(volatile uint32_t *)(Addr) = (uint32_t)(Value))
#define Xil_In32(Addr) (*(volatile uint32_t *)(Addr))

#endif // XPARAMETERS_H_