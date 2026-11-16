// Minimal static file server for local development (no dependencies).
// Usage: npm start [-- <port>]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ROOT_PREFIX = ROOT.endsWith(sep) ? ROOT : ROOT + sep;
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 8080);

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

/** Maps a request URL to a file inside the project, or null if it points elsewhere. */
function resolveFile(url) {
  const pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  const file = join(ROOT, normalize(pathname === '/' ? '/index.html' : pathname));
  return file.startsWith(ROOT_PREFIX) ? file : null;
}

const server = createServer(async (request, response) => {
  try {
    const file = resolveFile(request.url);
    if (!file) throw new Error('outside project root');
    const body = await readFile(file);
    response.writeHead(200, {
      'Content-Type': CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Moon Lander running at http://localhost:${PORT}`);
});
