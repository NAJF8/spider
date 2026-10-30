const http = require('http');
const fs = require('fs');
const path = require('path');
const { runTests } = require('./verify_sort_e2e');

const PUBLIC_DIR = path.resolve('public');
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  let filePath = path.join(PUBLIC_DIR, urlPath === '/' ? 'index.html' : urlPath);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end('Server error');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

server.listen(8080, '127.0.0.1', async () => {
  console.log('Local test server running at http://127.0.0.1:8080');
  try {
    await runTests('http://127.0.0.1:8080');
    console.log('\nLOCAL VERIFICATION SUCCESSFUL!');
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('\nLOCAL VERIFICATION FAILED:', err);
    server.close();
    process.exit(1);
  }
});
