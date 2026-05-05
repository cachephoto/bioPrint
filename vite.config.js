import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    base: './', // Changed from '/biocorp/' to './' for local relative paths
    server: {
        port: 5173, // Set local dev server port
        host: true, // Expose to network (optional, good for testing on other devices)
        proxy: {
            // Example proxy configuration - adjust if you have a specific backend API
            // '/api': {
            //     target: 'http://localhost:3000',
            //     changeOrigin: true,
            //     secure: false,
            // }
        }
    },
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
    }
});
