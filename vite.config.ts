import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    // ✅ Node.js polyfills for Web3 browser compatibility
    nodePolyfills({
      include: ['buffer', 'process', 'stream', 'util', 'crypto'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // ✅ Define global variables for browser compatibility
  define: {
    'global': 'globalThis',
  },
  // ✅ Optimize dependencies
  optimizeDeps: {
    include: ['buffer', 'process'],
  },
  // ✅ Build configuration for production
  build: {
    target: 'es2020',
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'web3-vendor': ['viem', 'wagmi', 'ethers'],
          'sequence': ['0xsequence', '@0xsequence/connect', '@0xsequence/hooks'],
          'ui-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
}));
