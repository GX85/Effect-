import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import endpoint from '../api/inquiry.mjs';
import effect from '../api/effect.mjs';

const root = fileURLToPath(new URL('../dist/client/', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
  '.txt': 'text/plain',
};
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1:8080');
    if (url.pathname === '/api/inquiry' || url.pathname === '/api/effect') {
      const request = new Request(url, {
        method: req.method,
        headers: req.headers,
        ...(req.method !== 'GET' && req.method !== 'HEAD'
          ? { body: req, duplex: 'half' }
          : {}),
      });
      const response = await (url.pathname === '/api/effect' ? effect : endpoint).fetch(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    let path = resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!path.startsWith(resolve(root) + sep) && path !== resolve(root)) {
      res.writeHead(403).end();
      return;
    }
    if ((await stat(path).catch(() => null))?.isDirectory())
      path = resolve(path, 'index.html');
    if (!(await stat(path).catch(() => null))?.isFile() && !extname(path))
      path += '.html';
    let data = await readFile(path).catch(() => null);
    let status = 200;
    if (!data) {
      path = resolve(root, '404.html');
      data = await readFile(path);
      status = 404;
    }
    res.writeHead(status, {
      'Content-Type': types[extname(path)] || 'application/octet-stream',
    });
    res.end(data);
  } catch {
    res.writeHead(500).end('Local preview error');
  }
}).listen(8080, '127.0.0.1', () =>
  console.log('Focus preview: http://127.0.0.1:8080'),
);
