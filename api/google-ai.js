/**
 * Vercel Serverless Proxy: Google AI API
 * Routes: /api/google-ai/* → https://generativelanguage.googleapis.com/*
 * 
 * This avoids CORS issues when calling Google AI from the browser.
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
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-goog-api-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Extract the path after /api/google-ai/
    const fullUrl = req.url;
    const proxyPath = fullUrl.replace(/^\/api\/google-ai\/?/, '');

    const targetUrl = `https://generativelanguage.googleapis.com/${proxyPath}`;
    console.log(`[GoogleAI Proxy] ${req.method} → ${targetUrl.substring(0, 120)}...`);

    // Build clean headers — only forward safe ones
    const forwardHeaders = {
      'Content-Type': 'application/json',
    };
    // Forward x-goog-api-key if present
    if (req.headers['x-goog-api-key']) {
      forwardHeaders['x-goog-api-key'] = req.headers['x-goog-api-key'];
    }

    const fetchOptions = {
      method: req.method,
      headers: forwardHeaders,
    };

    // Forward body for POST/PUT — use raw body string
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
    console.error('[GoogleAI Proxy] Error:', error.message);
    res.status(502).json({ error: 'Proxy error', message: error.message });
  }
}
