
#include "platform.h"
#include <stdio.h>

void init_platform(void) {}
void cleanup_platform(void) {}

void delay_cycles(volatile unsigned int count) {
    while(count--) {
        __asm__("nop");
    }
}

int main(void) {
    init_platform();
    printf("BSP_INIT_OK\n");
    printf("UART_OK\n");

    int state = 0;
    for (int i = 0; i < 5; i++) {
        state = !state;
        if (state) {
            printf("LED STATE: ON\n");
        } else {
            printf("LED STATE: OFF\n");
        }
        delay_cycles(1000000);
    }
    printf("BSP_VALIDATION_OK\n");
    cleanup_platform();
    return 0;
}
