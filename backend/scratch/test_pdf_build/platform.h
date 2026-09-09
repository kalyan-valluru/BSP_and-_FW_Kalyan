/**
 * platform.h
 * Hardware Abstraction layer header definitions
 */

#ifndef PLATFORM_H_
#define PLATFORM_H_

void init_platform(void);
void cleanup_platform(void);

#define XPAR_UARTLITE_0_BASEADDR 0x40600000
#define XPAR_GPIO_0_BASEADDR 0x41200000

#endif // PLATFORM_H_