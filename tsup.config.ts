import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/charges.ts',
    'src/webhooks.ts',
    'src/metrics.ts',
    'src/sandbox.ts',
    'src/distributions.ts',
    'src/networks.ts',
  ],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
})
