import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const backendUrl = env.VITE_API_BASE_URL || 'http://localhost:3000';
    return {
        plugins: [
            react(),
            VitePWA({
                registerType: 'autoUpdate',
                includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
                manifest: {
                    name: 'Creative Production Platform',
                    short_name: 'ChangeArt',
                    description: 'Creative agency production management — quotes, jobs, QC, delivery.',
                    theme_color: '#0A1628',
                    background_color: '#0A1628',
                    display: 'standalone',
                    start_url: '/',
                    icons: [
                        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                    ],
                },
                workbox: {
                    navigateFallback: '/index.html',
                    globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
                },
                devOptions: { enabled: false },
            }),
        ],
        resolve: {
            alias: {
                '@': path.resolve(__dirname, 'src'),
                '@contracts': path.resolve(__dirname, 'src/contracts'),
                '@modules': path.resolve(__dirname, 'src/modules'),
                '@lib': path.resolve(__dirname, 'src/lib'),
                '@layouts': path.resolve(__dirname, 'src/layouts'),
                '@providers': path.resolve(__dirname, 'src/providers'),
                '@routes': path.resolve(__dirname, 'src/routes'),
            },
        },
        server: {
            port: 5173,
            strictPort: false,
            proxy: {
                '/api': {
                    target: backendUrl,
                    changeOrigin: true,
                    secure: false,
                },
                '/socket.io': {
                    target: backendUrl,
                    ws: true,
                    changeOrigin: true,
                },
            },
        },
        build: {
            sourcemap: true,
            target: 'es2022',
            rollupOptions: {
                output: {
                    manualChunks: {
                        'react-vendor': ['react', 'react-dom', 'react-router-dom'],
                        'query-vendor': ['@tanstack/react-query', '@tanstack/react-table'],
                        'chart-vendor': ['recharts'],
                        'firebase-vendor': ['firebase/app', 'firebase/messaging'],
                    },
                },
            },
        },
        test: {
            environment: 'jsdom',
            globals: true,
            setupFiles: ['./src/test/setup.ts'],
            css: false,
        },
    };
});
