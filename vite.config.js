import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    base: '/biocorp/',
    server: {
        port: 5173,
        strictPort: true, // No intentar otro puerto si 5173 está ocupado
    },
});
