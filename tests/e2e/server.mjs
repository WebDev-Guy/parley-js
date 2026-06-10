/**
 * Minimal static file server for E2E tests.
 *
 * Serves the repository root so fixtures can load the built IIFE bundle
 * from /dist/index.global.js. Two instances run on different hosts
 * (127.0.0.1 and localhost) to give the browser two distinct origins
 * without TLS or hosts-file changes.
 *
 * Usage: node tests/e2e/server.mjs <port> [host]
 *
 * Binds to loopback only (default 127.0.0.1) - the server exposes the
 * whole repository root, so it must never listen on external interfaces.
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PORT = Number(process.argv[2] ?? 4173);
const HOST = process.argv[3] ?? '127.0.0.1';

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
};

const server = createServer(async (req, res) => {
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const filePath = normalize(join(ROOT, decodeURIComponent(url.pathname)));

        // Prevent path traversal outside the repository root
        if (!filePath.startsWith(normalize(ROOT + sep)) && filePath !== normalize(ROOT)) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }

        const body = await readFile(filePath);
        res.writeHead(200, {
            'Content-Type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream',
            'Cache-Control': 'no-store',
        });
        res.end(body);
    } catch {
        res.writeHead(404);
        res.end('Not found');
    }
});

server.listen(PORT, HOST, () => {
    console.log(`E2E static server listening on ${HOST}:${PORT}`);
});
