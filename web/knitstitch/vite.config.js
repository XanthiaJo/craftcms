// vite.config.js
export default {
  base: '/',  // Assets served from /dist/
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
  build: {
    outDir: '../dist',  // Output to web/dist (public root)
    emptyOutDir: true,
    assetsInlineLimit: 0, // Keep Konva as external chunk
    rollupOptions: {
      input: {
        main: './src/main.js'
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name][extname]'
      }
    }
  }
};
