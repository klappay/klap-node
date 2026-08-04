import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/charges.ts',
    'src/webhooks.ts',
    'src/verify.ts',
    'src/organization.ts',
    'src/users.ts',
    'src/api-keys.ts',
    'src/invitations.ts',
    'src/auth.ts',
    'src/sandbox.ts',
    'src/distributions.ts',
    'src/networks.ts',
  ],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
})
