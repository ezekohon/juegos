import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 4173);
const bggToken = process.env.BGG_API_KEY;
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

async function fetchBGG(url) {
  const headers = bggToken ? { Authorization: `Bearer ${bggToken}` } : {};
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, { headers });
    if (response.status !== 202) return response;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  return fetch(url, { headers });
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);
    if (requestUrl.pathname === '/api/bgg') {
      if (!bggToken) return send(res, 500, JSON.stringify({ error: 'Falta BGG_API_KEY' }), 'application/json');
      const ids = requestUrl.searchParams.get('ids') || requestUrl.searchParams.get('id') || '';
      if (!/^\d+(,\d+){0,19}$/.test(ids)) return send(res, 400, JSON.stringify({ error: 'ids inválidos' }), 'application/json');
      const upstream = await fetchBGG(`https://boardgamegeek.com/xmlapi2/thing?id=${ids}&stats=1`);
      const body = await upstream.text();
      res.writeHead(upstream.status, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(body);
    }

    const requested = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
    const file = normalize(join(root, 'dist', requested));
    if (!file.startsWith(join(root, 'dist'))) return send(res, 403, 'Forbidden');
    const body = await readFile(file);
    return send(res, 200, body, contentTypes[extname(file)] || 'application/octet-stream');
  } catch (error) {
    if (error.code === 'ENOENT') return send(res, 404, 'Not found');
    return send(res, 500, error.message);
  }
});

server.listen(port, () => console.log(`Juegos Eze & Eli: http://localhost:${port}`));
