import { IBuildScriptTemplateEngine } from './IBuildScriptTemplateEngine';

export class MakefileTemplateEngine implements IBuildScriptTemplateEngine {
  public readonly id = 'template-makefile';
  public readonly name = 'GNU Makefile & Compile Database Engine';

  public renderBuildScript(scriptType: 'cmake' | 'makefile' | 'toolchain' | 'compile_commands', context: Record<string, any>): string {
    const procId = context.targetProcessorId || 'zynq-7000';
    const cpuFlag = context.cpuFlag || '-mcpu=cortex-a9';
    const toolchainPrefix = context.toolchainPrefix || 'arm-none-eabi-';

    if (scriptType === 'makefile') {
      return `# GNU Makefile for ${procId} Project
CC = ${toolchainPrefix}gcc
AS = ${toolchainPrefix}gcc
LD = ${toolchainPrefix}gcc
OBJCOPY = ${toolchainPrefix}objcopy

CFLAGS = ${cpuFlag} -O2 -Wall -Iinclude -Idrivers -Ibsp/include
LDFLAGS = -Tlinker/linker.ld -Wl,-Map=build/project.map

SRCS = src/main.c src/system_init.c drivers/uart.c drivers/gpio.c drivers/peripheral_init.c
ASRCS = startup/startup.S
OBJS = $(SRCS:.c=.o) $(ASRCS:.S=.o)

all: build/project.elf build/project.bin

%.o: %.c
\t$(CC) $(CFLAGS) -c $< -o $@

%.o: %.S
\t$(AS) $(CFLAGS) -c $< -o $@

build/project.elf: $(OBJS)
\t@mkdir -p build
\t$(LD) $(OBJS) $(LDFLAGS) -o $@

build/project.bin: build/project.elf
\t$(OBJCOPY) -O binary $< $@

clean:
\trm -rf build $(OBJS)
`;
    }

    if (scriptType === 'compile_commands') {
      return JSON.stringify([
        {
          directory: "/workspace/project",
          command: `${toolchainPrefix}gcc ${cpuFlag} -O2 -Iinclude -c src/main.c -o src/main.o`,
          file: "src/main.c"
        }
      ], null, 2);
    }

    return '';
  }
}
