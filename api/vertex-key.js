/**
 * Vercel Serverless Proxy: Vertex Key API
 * Routes: /api/vertex-key/* → https://vertex-key.com/*
 * 
 * IMPORTANT: maxDuration set to 60s because image generation can take 30s+
 */

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
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
    const proxyPath = fullUrl.replace(/^\/api\/vertex-key\/?/, '');

    const targetUrl = `https://vertex-key.com/${proxyPath}`;
    console.log(`[VertexKey Proxy] ${req.method} → ${targetUrl.substring(0, 100)}...`);

    // Build clean headers — only forward safe ones
    const forwardHeaders = {
      'Content-Type': 'application/json',
    };
    // Forward Authorization header (Bearer token)
    if (req.headers['authorization']) {
      forwardHeaders['Authorization'] = req.headers['authorization'];
    }

    const fetchOptions = {
      method: req.method,
      headers: forwardHeaders,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      fetchOptions.body = bodyStr;
    }

    const response = await fetch(targetUrl, fetchOptions);

    // Forward essential response headers only
    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    const data = await response.arrayBuffer();
    res.status(response.status).send(Buffer.from(data));
  } catch (error) {
    console.error('[VertexKey Proxy] Error:', error.message);
    res.status(502).json({ error: 'Proxy error', message: error.message });
  }
}
