import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: 'src/index.ts',
  format: ['cjs', 'esm'],
  sourcemap: true,
  minify: false,
  silent: true,
})
