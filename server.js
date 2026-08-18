const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;
const publishProjectTargetPath = '/api/publish_project';
const getPublishedProjectTargetPath = '/api/get_published_project';
const createPublishingUserIdTargetPath = '/api/create_publishing_user_id';
const apiProxyOrigin = 'http://127.0.0.1:8000';

// Simple HTTP request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

const createApiProxy = (targetPath, routeLabel) => createProxyMiddleware({
  target: apiProxyOrigin,
  changeOrigin: true,
  logLevel: 'info',
  pathRewrite: (path, req) => {
    const originalPath = req.originalUrl;
    const queryIndex = originalPath.indexOf('?');
    if (queryIndex === -1) {
      return targetPath;
    }
    return `${targetPath}${originalPath.slice(queryIndex)}`;
  },
  onProxyRes: (proxyRes) => {
    proxyRes.headers['access-control-allow-origin'] = '*';
  },
  onError: (err, req, res) => {
    console.error(`Failed to proxy ${routeLabel} request:`, err);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
    }
    res.end(JSON.stringify({ error: 'Upstream request failed' }));
  },
});

// Set COOP/COEP/CORP headers to enable cross-origin isolation (required for threads/SharedArrayBuffer)
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

const handleCorsPreflight = (methods) => (req, res) => {
  res.setHeader('Access-Control-Allow-Methods', `${methods}, OPTIONS`);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(204);
};

app.options('/api/publish_project', handleCorsPreflight('POST'));
app.options('/api/get_published_project', handleCorsPreflight('GET, POST'));
app.options('/api/create_publishing_user_id', handleCorsPreflight('POST'));

app.use('/api/publish_project', createApiProxy(publishProjectTargetPath, '/api/publish_project'));
app.use('/api/get_published_project', createApiProxy(getPublishedProjectTargetPath, '/api/get_published_project'));
app.use('/api/create_publishing_user_id', createApiProxy(createPublishingUserIdTargetPath, '/api/create_publishing_user_id'));

// Serve godot.editor.html as the index page
app.get(['/', '/index.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'godot.editor.html'));
});

// Serve all static files from the project directory
app.use(express.static(path.join(__dirname, '.'), {
  setHeaders: (res, filePath) => {
    // Ensure correct content-type for WASM
    if (filePath.endsWith('.wasm')) {
      res.setHeader('Content-Type', 'application/wasm');
    }
  },
}));

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});


