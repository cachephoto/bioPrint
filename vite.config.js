import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

const SAVE_DIR = path.resolve('./public/configs');

/**
 * Los diseños de las pantallas viven en el localStorage del navegador: son
 * distintos en cada equipo y se pierden al limpiar datos. Este plugin le da al
 * frontend dos endpoints para dejarlos en disco, dentro del repo:
 *
 *   POST /__bioprint/save  { name, data } -> escribe public/configs/<name>.json
 *   GET  /__bioprint/list                 -> lista los respaldos guardados
 *
 * Al vivir en public/, los archivos se sirven además como ./configs/<name>.json,
 * así que cualquier dispositivo que abra la app puede leerlos y sembrarse solo.
 */
function bioprintConfigStore() {
    return {
        name: 'bioprint-config-store',
        configureServer(server) {
            fs.mkdirSync(SAVE_DIR, { recursive: true });

            server.middlewares.use('/__bioprint/save', (req, res) => {
                res.setHeader('Content-Type', 'application/json');
                if (req.method !== 'POST') {
                    res.statusCode = 405;
                    return res.end(JSON.stringify({ ok: false, error: 'sólo POST' }));
                }
                let body = '';
                req.on('data', chunk => {
                    body += chunk;
                    if (body.length > 20 * 1024 * 1024) req.destroy(); // cortar cargas absurdas
                });
                req.on('end', () => {
                    try {
                        const { name, data } = JSON.parse(body);
                        // El nombre viene del cliente: sólo un slug plano, para que
                        // no se pueda escribir fuera de public/configs.
                        const safe = String(name || 'backup').replace(/[^a-zA-Z0-9_-]/g, '');
                        if (!safe) throw new Error('nombre inválido');
                        const file = path.join(SAVE_DIR, `${safe}.json`);
                        fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
                        res.end(JSON.stringify({ ok: true, file: `configs/${safe}.json`, bytes: fs.statSync(file).size }));
                    } catch (e) {
                        res.statusCode = 400;
                        res.end(JSON.stringify({ ok: false, error: e.message }));
                    }
                });
            });

            // Captura de pantalla a archivo: el frontend manda un PNG en base64
            server.middlewares.use('/__bioprint/shot', (req, res) => {
                res.setHeader('Content-Type', 'application/json');
                if (req.method !== 'POST') { res.statusCode = 405; return res.end('{"ok":false}'); }
                let body = '';
                req.on('data', c => { body += c; if (body.length > 40 * 1024 * 1024) req.destroy(); });
                req.on('end', () => {
                    try {
                        const { name, dataUrl } = JSON.parse(body);
                        const safe = String(name || 'shot').replace(/[^a-zA-Z0-9_-]/g, '');
                        const b64 = String(dataUrl).replace(/^data:image\/png;base64,/, '');
                        const dir = path.resolve('./public/shots');
                        fs.mkdirSync(dir, { recursive: true });
                        const file = path.join(dir, `${safe}.png`);
                        fs.writeFileSync(file, Buffer.from(b64, 'base64'));
                        res.end(JSON.stringify({ ok: true, file: `shots/${safe}.png`, bytes: fs.statSync(file).size }));
                    } catch (e) {
                        res.statusCode = 400;
                        res.end(JSON.stringify({ ok: false, error: e.message }));
                    }
                });
            });

            server.middlewares.use('/__bioprint/list', (req, res) => {
                let files = [];
                try {
                    files = fs.readdirSync(SAVE_DIR)
                        .filter(f => f.endsWith('.json'))
                        .map(f => ({ name: f.replace(/\.json$/, ''), bytes: fs.statSync(path.join(SAVE_DIR, f)).size }));
                } catch { /* carpeta vacía todavía */ }
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: true, files }));
            });
        }
    };
}

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), bioprintConfigStore()],
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
