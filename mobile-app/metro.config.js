// https://docs.expo.dev/guides/customizing-metro/
const https = require('https');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/**
 * Development only: when the app runs in a browser (`expo start --web`), it
 * calls the API on its own origin and Metro forwards /api/* to the live site.
 * This avoids CORS without changing the production server. Native builds call
 * the site directly and never hit this.
 */
const API_ORIGIN = 'https://www.geldesat.com';

function proxyApi(req, res) {
  const target = new URL(req.url, API_ORIGIN);
  const headers = { ...req.headers, host: target.host };
  // Better Auth checks Origin on state-changing calls; present the site's own.
  if (headers.origin) headers.origin = API_ORIGIN;
  if (headers.referer) headers.referer = `${API_ORIGIN}/`;
  delete headers['accept-encoding'];
  const upstream = https.request(target, { method: req.method, headers }, (response) => {
    res.writeHead(response.statusCode ?? 502, response.headers);
    response.pipe(res);
  });
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'API sunucusuna ulaşılamadı.' }));
  });
  req.pipe(upstream);
}

const enhance = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const next = enhance ? enhance(middleware, server) : middleware;
  return (req, res, fallthrough) => {
    if (req.url && (req.url.startsWith('/api/') || req.url.startsWith('/uploads/'))) {
      proxyApi(req, res);
      return;
    }
    return next(req, res, fallthrough);
  };
};

module.exports = config;
