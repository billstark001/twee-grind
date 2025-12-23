import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default {
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    format: 'esm',
    sourcemap: true,
  },
  plugins: [
    nodeResolve(),
    typescript({ 
      tsconfig: './tsconfig.build.json',
      declaration: true,
      declarationDir: 'dist',
      outDir: 'dist',
    }),
  ],
};
