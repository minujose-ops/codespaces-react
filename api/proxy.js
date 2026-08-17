// Vercel serverless function: /api/proxy
// Fetches a Google Doc export (format=txt) server-side and returns it with CORS and caching.
//
// Env vars:
// - DEFAULT_DOC_ID (optional)
// - ALLOWED_ORIGINS (comma-separated; default: https://minujose-ops.github.io)
// - CACHE_TTL_MS (optional, default 300000 = 5m)

const CACHE_TTL = Number(process.env.CACHE_TTL_MS || 300000);

// small in-memory cache per instance (serverless may re-create instances)
global.__docCache = global.__docCache || new Map();
const cache = global.__docCache;

function setCorsHeaders(res, origin) {
  const allowed = (process.env.ALLOWED_ORIGINS || 'https://minujose-ops.github.io').split(',');
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // fall back to first allowed origin (safe default)
    res.setHeader('Access-Control-Allow-Origin', allowed[0]);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  // handle preflight
  setCorsHeaders(res, req.headers.origin);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Content-Type', 'text/plain');
    return res.status(405).send('Method Not Allowed');
  }

  const docId = req.query.docId || process.env.DEFAULT_DOC_ID;
  if (!docId) {
    res.setHeader('Content-Type', 'text/plain');
    return res.status(400).send('missing docId');
  }

  const cacheKey = docId;
  const entry = cache.get(cacheKey);
  if (entry && Date.now() - entry.t < CACHE_TTL) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).send(entry.v);
  }

  const url = `https://docs.google.com/document/d/${encodeURIComponent(docId)}/export?format=txt`;

  try {
    // Vercel Node runtime includes global fetch
    const r = await fetch(url, { redirect: 'follow' });
    const body = await r.text();

    if (!r.ok) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(502).send(`upstream error: ${r.status}\n\n${body}`);
    }

    // cache and return
    cache.set(cacheKey, { v: body, t: Date.now() });
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', `public, max-age=${Math.floor(CACHE_TTL / 1000)}`);
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).send(body);
  } catch (err) {
    console.error('proxy error', err);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(500).send('proxy error');
  }
}
