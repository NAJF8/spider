const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const adminJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.js'), 'utf8');
const activeUpload = adminJs.slice(adminJs.indexOf('function imageUploadErrorMessage'), adminJs.indexOf('window.seedDraftCatalog'));
const adminHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8');
const workerJs = fs.readFileSync(path.join(__dirname, '..', 'cloudflare-worker', 'src', 'index.js'), 'utf8');

assert.match(adminHtml, /id="prodImageFile"[^>]*accept="image\/\*"/);
assert.match(adminHtml, /id="imageUploadProgress"[^>]*max="100"/);
assert.match(activeUpload, /formData\.append\('image', file, file\.name\)/);
assert.match(activeUpload, /xhr\.upload\.onprogress/);
assert.doesNotMatch(activeUpload, /toDataURL|drawImage|canvas\.width|setTimeout\(r, 4000\)/);
assert.match(workerJs, /image\/jpeg.*image\/png.*image\/webp.*image\/gif.*image\/avif.*image\/bmp.*image\/heic.*image\/heif/);
assert.match(workerJs, /detectedMime/);
assert.match(workerJs, /file\.size > 50 \* 1024 \* 1024/);

console.log('Original image upload assertions passed.');
