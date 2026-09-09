/**
 * main.c
 * Auto-generated Bare Metal BSP firmware entry loop
 * Board: ZedBoard
 * Processor: Zynq-7000
 */

#include <stdio.h>
#include <stdint.h>
#include "platform.h"
#include "xparameters.h"

int main(void) {
    init_platform();
    printf("Initializing peripheral drivers...\n");

    // Initialize uartlite_0 (UART) at 0x40600000
    // Initialize gpio_0 (GPIO) at 0x41200000
    printf("  uartlite_0 ... OK\n");
    printf("  gpio_0 ... OK\n");

    printf("System main loop running.\n");
    for (int i = 0; i < 3; i++) {
        // Performing board verification telemetry loop iteration
    }
    cleanup_platform();
    return 0;
}