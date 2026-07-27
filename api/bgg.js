const BGG_URL = 'https://boardgamegeek.com/xmlapi2/thing';
const MAX_IDS = 20;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const token = process.env.BGG_API_KEY;
  if (!token) return res.status(500).json({ error: 'Falta configurar BGG_API_KEY' });

  const rawIds = req.query?.id || req.query?.ids || '';
  const ids = Array.isArray(rawIds) ? rawIds.join(',') : String(rawIds);
  if (!/^\d+(,\d+){0,19}$/.test(ids)) {
    return res.status(400).json({ error: `Se esperan entre 1 y ${MAX_IDS} IDs numéricos` });
  }

  const url = `${BGG_URL}?id=${encodeURIComponent(ids)}&stats=1`;
  let response;

  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status !== 202) break;
      await sleep(2000);
    }

    const body = await response.text();
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=604800, stale-while-revalidate=86400');
    return res.status(response.status).send(body);
  } catch (error) {
    console.error('BGG proxy error:', error);
    return res.status(502).json({ error: 'No se pudo consultar BoardGameGeek' });
  }
}
