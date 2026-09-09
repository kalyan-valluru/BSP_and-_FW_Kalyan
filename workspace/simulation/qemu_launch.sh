#!/bin/bash
# QEMU Launch Script for TI Sitara AM335x EVM (BeagleBone Black) (ARM Cortex-A8)
qemu-system-arm -M virt -cpu cortex-a9 -m 512 -nographic -dtb C:\Users\Administrator\Desktop\GenAi-Baremetal-Linux-2.0-agent\backend\workspace\system.dtb
