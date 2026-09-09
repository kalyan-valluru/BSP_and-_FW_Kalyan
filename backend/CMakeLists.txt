cmake_minimum_required(VERSION 3.25)
project(BSP_Firmware_Project C)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)

# Unify target build flags based on detected architecture
if(TARGET_ARCH MATCHES "zynq-mpsoc")
    message(STATUS "Configuring build for AMD Zynq UltraScale+ (ARM Cortex-A53)")
    set(CPU_FLAGS "-mcpu=cortex-a53 -mfpu=fp-armv8 -mfloat-abi=hard")
    set(PROC_DIR "psu_cortexa53_0")
else()
    message(STATUS "Configuring build for AMD Zynq-7000 (ARM Cortex-A9)")
    set(CPU_FLAGS "-mcpu=cortex-a9 -mfpu=vfpv3 -mfloat-abi=hard")
    set(PROC_DIR "ps7_cortexa9_0")
endif()

set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} ${CPU_FLAGS} -O2 -g -Wall")

# Include directories from generated Vitis Platform BSP
include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}/vitis_ws/my_platform/${PROC_DIR}/standalone_domain/bsp/${PROC_DIR}/include
)

# Library directories from generated Vitis Platform BSP
link_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}/vitis_ws/my_platform/${PROC_DIR}/standalone_domain/bsp/${PROC_DIR}/lib
)

# Source files
add_executable(firmware.elf main.c)

# Link hardware drivers and GCC C libraries
target_link_libraries(firmware.elf PRIVATE xil gcc c)
