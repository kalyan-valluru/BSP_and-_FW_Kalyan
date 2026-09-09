import { IBuildScriptTemplateEngine } from './IBuildScriptTemplateEngine';

export class CMakeTemplateEngine implements IBuildScriptTemplateEngine {
  public readonly id = 'template-cmake';
  public readonly name = 'Production CMake & Toolchain Build Script Engine';

  public renderBuildScript(scriptType: 'cmake' | 'makefile' | 'toolchain' | 'compile_commands', context: Record<string, any>): string {
    const procId = context.targetProcessorId || 'zynq-7000';
    const cpuFlag = context.cpuFlag || '-mcpu=cortex-a9';
    const toolchainPrefix = context.toolchainPrefix || 'arm-none-eabi-';

    if (scriptType === 'cmake') {
      return `# CMakeLists.txt for ${procId} Project
cmake_minimum_required(VERSION 3.20)
project(${procId}_bsp_project C ASM)

set(CMAKE_TOOLCHAIN_FILE \${CMAKE_CURRENT_SOURCE_DIR}/toolchain.cmake)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

include_directories(
    include
    drivers
    bsp/include
)

file(GLOB_RECURSE SOURCES
    "src/*.c"
    "startup/*.S"
    "drivers/*.c"
)

add_executable(\${PROJECT_NAME}.elf \${SOURCES})

set_target_properties(\${PROJECT_NAME}.elf PROPERTIES
    LINK_FLAGS "-T\${CMAKE_CURRENT_SOURCE_DIR}/linker/linker.ld -Wl,-Map=\${PROJECT_NAME}.map"
)
`;
    }

    if (scriptType === 'toolchain') {
      return `# Cross-Compilation Toolchain File for ${procId}
set(CMAKE_SYSTEM_NAME Generic)
set(CMAKE_SYSTEM_PROCESSOR arm)

set(CMAKE_C_COMPILER ${toolchainPrefix}gcc)
set(CMAKE_ASM_COMPILER ${toolchainPrefix}gcc)
set(CMAKE_OBJCOPY ${toolchainPrefix}objcopy)
set(CMAKE_SIZE ${toolchainPrefix}size)

set(CMAKE_C_FLAGS "${cpuFlag} -O2 -Wall -ffunction-sections -fdata-sections")
set(CMAKE_ASM_FLAGS "${cpuFlag} -x assembler-with-cpp")
`;
    }

    return '';
  }
}
