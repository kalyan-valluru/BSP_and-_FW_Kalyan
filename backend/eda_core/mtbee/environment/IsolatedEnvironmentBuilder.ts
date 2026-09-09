export class IsolatedEnvironmentBuilder {
  public prepareEnvironment(plan: any): Record<string, any> {
    return {
      workingDirectory: `/workspace/build_${Date.now()}`,
      envVars: {
        PATH: '/usr/local/bin:/usr/bin:/bin',
        CROSS_COMPILE: 'arm-none-eabi-'
      },
      cleanupPolicy: 'PRESERVE_ARTIFACTS'
    };
  }
}
