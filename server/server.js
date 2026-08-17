import express from 'express';
import rateLimit from 'express-rate-limit';

const app = express();
const PORT = process.env.PORT || 3000;

// Configure allowed origins (comma-separated) in env, default to your Pages site
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://minujose-ops.github.io').split(',');

// Basic rate limiter
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 requests per windowMs
});
app.use(limiter);

// Simple in-memory cache (replace with Redis for production)
const cache = new Map();
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS) || 5 * 60 * 1000; // 5 minutes

function setCors(res, origin) {
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
  }
  res.setHeader('Vary', 'Origin');
}

// GET /proxy-doc?docId=<id>
app.get('/proxy-doc', async (req, res) => {
  try {
    const origin = req.get('origin') || '';
    setCors(res, origin);

    const docId = req.query.docId || process.env.DEFAULT_DOC_ID;
    if (!docId) return res.status(400).send('missing docId');

    const cacheKey = docId;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.t < CACHE_TTL_MS) {
      res.type('text/plain');
      res.setHeader('X-Cache', 'HIT');
      return res.send(cached.v);
    }

    const url = `https://docs.google.com/document/d/${encodeURIComponent(docId)}/export?format=txt`;

    // Node 18+ has global fetch; follow redirects
    const r = await fetch(url, { redirect: 'follow' });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      return res.status(r.status).type('text/plain').send(`upstream error: ${r.status}\n\n${text}`);
    }
    const body = await r.text();

    cache.set(cacheKey, { v: body, t: Date.now() });
    res.setHeader('Cache-Control', `public, max-age=${Math.floor(CACHE_TTL_MS / 1000)}`);
    res.type('text/plain').setHeader('X-Cache', 'MISS').send(body);
  } catch (err) {
    console.error('proxy error', err);
    res.status(500).send('proxy error');
  }
});

app.listen(PORT, () => {
  console.log(`Proxy listening on ${PORT}`);
});
