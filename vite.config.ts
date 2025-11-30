import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: '$syncer',
      formats: ['es', 'cjs', 'iife'],
      fileName: (format) => {
        switch (format) {
          case 'es':
            return 'index.js';
          case 'cjs':
            return 'index.cjs';
          case 'iife':
            return 'index.global.js';
          default:
            return `index.${format}.js`;
        }
      },
    },
    rollupOptions: {
      external: ['node:buffer'],
    },
    outDir: 'dist',
    sourcemap: true,
  },
});
