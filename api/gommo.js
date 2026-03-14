/**
 * Vercel Serverless Proxy: Gommo AI API
 * Routes: /api/gommo/* → https://api.gommo.net/*
 * 
 * Gommo uses x-www-form-urlencoded body format.
 * IMPORTANT: maxDuration set to 60s because image generation can take 30s+
 */

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const fullUrl = req.url;
    const proxyPath = fullUrl.replace(/^\/api\/gommo\/?/, '');

    const targetUrl = `https://api.gommo.net/${proxyPath}`;
    console.log(`[Gommo Proxy] ${req.method} → ${targetUrl.substring(0, 100)}...`);

    // Build clean headers
    const forwardHeaders = {};
    const contentType = req.headers['content-type'] || '';
    if (contentType) {
      forwardHeaders['Content-Type'] = contentType;
    }
    if (req.headers['authorization']) {
      forwardHeaders['Authorization'] = req.headers['authorization'];
    }

    const fetchOptions = {
      method: req.method,
      headers: forwardHeaders,
    };

    // Gommo uses URL-encoded bodies — handle properly
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (contentType.includes('application/x-www-form-urlencoded')) {
        // Reconstruct URL-encoded body from parsed body
        if (typeof req.body === 'object' && req.body !== null) {
          fetchOptions.body = new URLSearchParams(req.body).toString();
        } else if (typeof req.body === 'string') {
          fetchOptions.body = req.body;
        }
      } else {
        const bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        fetchOptions.body = bodyStr;
      }
    }

    const response = await fetch(targetUrl, fetchOptions);

    // Forward essential response headers only
    const respContentType = response.headers.get('content-type');
    if (respContentType) {
      res.setHeader('Content-Type', respContentType);
    }

    const data = await response.arrayBuffer();
    res.status(response.status).send(Buffer.from(data));
  } catch (error) {
    console.error('[Gommo Proxy] Error:', error.message);
    res.status(502).json({ error: 'Proxy error', message: error.message });
  }
}
