import type { IConfiguration } from '@cucumber/cucumber'

const config: Partial<IConfiguration> = {
  paths: ['tests/cucumber/features/**/*.feature'],
  import: [
    'tests/cucumber/support/world.ts',
    'tests/cucumber/support/hooks.ts',
    'tests/cucumber/steps/**/*.steps.ts',
  ],
  format: [
    'progress-bar',
    ['html', 'tests/cucumber/reports/cucumber-report.html'],
  ],
  parallel: 1,
  strict: false,
}

export default config
