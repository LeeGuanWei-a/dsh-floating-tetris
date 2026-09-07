import { defineConfig } from 'tsdown'

// Emits lib/index.js (node half) and lib/client.js (browser half) exactly like
// the host's own @deepseek-ai/dsh-client-* packages. The browser half must end
// up in the window.__ModuleLoader__.load({ id, factory }) form — that wrapper
// is produced by the host's client bundling step, so build inside the target
// deployment's toolchain rather than assuming this bare config reproduces it.
export default defineConfig({
  entry: {
    index: 'src/index.js',
    client: 'src/client.js',
  },
  format: ['esm'],
  dts: false,
  external: [
    'react',
    'react/jsx-runtime',
    '@deepseek-ai/cordis',
  ],
})
