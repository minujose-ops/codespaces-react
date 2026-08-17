# Proxy server for Google Docs export

This small Express server provides a /proxy-doc endpoint that fetches the Google Docs export URL (format=txt) and returns the content with CORS headers.

Usage

1. Install dependencies:

   cd server
   npm ci

2. Run locally:

   DEFAULT_DOC_ID=1aDaeLKFR5cp-h3Pi6GguRK62sKEJyT2SV2d_sLr5GtY ALLOWED_ORIGINS=http://localhost:5173 npm start

3. From your client, fetch the document via the proxy:

   fetch('https://your-proxy.example.com/proxy-doc?docId=1aDaeLKFR5cp-h3Pi6GguRK62sKEJyT2SV2d_sLr5GtY')
     .then(r => r.text())
     .then(text => console.log(text))

Environment variables

- DEFAULT_DOC_ID: optional default Google Doc ID used when ?docId is not provided.
- ALLOWED_ORIGINS: comma-separated list of allowed origins for CORS. Default: https://minujose-ops.github.io
- CACHE_TTL_MS: cache TTL in milliseconds (default 300000)

Security

- Restrict ALLOWED_ORIGINS to your site in production (do not use `*`).
- Use a persistent cache (Redis) and proper rate-limiting in production.
- For private docs, use the Google Drive API with OAuth/service account on the server.
