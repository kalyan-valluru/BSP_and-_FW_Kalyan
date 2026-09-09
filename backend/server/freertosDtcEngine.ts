import { compileDeviceTree } from './buildEnvironmentChecker';
import fs from 'fs/promises';
import path from 'path';

export interface FreeRTOSTaskConfig {
  name: string;
  priority: number;
  stackSizeBytes: number;
  peripheralBlock: string;
}

export function generateFreeRTOSApp(
  arg1?: any,
  arg2?: any,
  arg3?: any
): { freertosAppCode: string; freertosConfigHeader: string } {
  const processor = arg2 || arg1 || 'ARM Core';
  const periphsArray = Array.isArray(arg3) ? arg3 : (Array.isArray(arg2) ? arg2 : (Array.isArray(arg1) ? arg1 : []));
  const tasks: FreeRTOSTaskConfig[] = periphsArray.map((p: any, idx: number) => ({
    name: `vTask_${p.peripheralBlock || p.name || 'Task_' + idx}`,
    priority: (idx % 4) + 1,
    stackSizeBytes: 2048,
    peripheralBlock: p.peripheralBlock || p.name || 'Block_' + idx
  }));

  const taskCodeBlocks = tasks.map((t) => `
static void ${t.name}(void *pvParameters) {
    (void)pvParameters;
    for (;;) {
        /* Task logic for peripheral block: ${t.peripheralBlock} */
        vTaskDelay(pdMS_TO_TICKS(500));
    }
}`).join('\n');

  const taskCreations = tasks.map(t => `
    xTaskCreate(${t.name}, "${t.name}", ${t.stackSizeBytes / 4}, NULL, ${t.priority}, NULL);`).join('\n');

  const freertosAppCode = `
/**
 * ============================================================
 *  PRODUCTION FreeRTOS APPLICATION & TASK SCHEDULER
 * ============================================================
 *  Target Processor : ${processor}
 *  Generated Tasks  : ${tasks.length}
 */

#if defined(XIL_FREERTOS) || defined(FREERTOS_ENABLED) || defined(INC_FREERTOS_H)
#include "FreeRTOS.h"
#include "task.h"
#include "semphr.h"
#include "queue.h"
#include <stdio.h>

${taskCodeBlocks}

int main(void) {
    printf("[FreeRTOS] Initializing Real-Time OS Scheduler on ${processor}...\\n");
${taskCreations}
    printf("[FreeRTOS] Starting OS Task Scheduler...\\n");
    vTaskStartScheduler();

    for (;;);
    return 0;
}
#endif
`.trim();

  const freertosConfigHeader = `
#ifndef FREERTOS_CONFIG_H
#define FREERTOS_CONFIG_H

#define configUSE_PREEMPTION                    1
#define configUSE_IDLE_HOOK                     0
#define configUSE_TICK_HOOK                     0
#define configCPU_CLOCK_HZ                      ( 100000000UL )
#define configTICK_RATE_HZ                      ( ( TickType_t ) 1000 )
#define configMAX_PRIORITIES                    ( 5 )
#define configMINIMAL_STACK_SIZE                ( ( unsigned short ) 128 )
#define configTOTAL_HEAP_SIZE                   ( ( size_t ) ( 32 * 1024 ) )
#define configMAX_TASK_NAME_LEN                 ( 16 )
#define configUSE_MUTEXES                       1
#define configUSE_COUNTING_SEMAPHORES           1

#endif /* FREERTOS_CONFIG_H */
`.trim();

  return { freertosAppCode, freertosConfigHeader };
}

export async function compileDeviceTreeToDTB(
  dtsPath: string,
  dtbOutputPath: string
): Promise<{ success: boolean; dtbPath: string; error?: string }> {
  const res = await compileDeviceTree(dtsPath, dtbOutputPath);
  return {
    success: res.success,
    dtbPath: dtbOutputPath,
    error: res.error
  };
}
