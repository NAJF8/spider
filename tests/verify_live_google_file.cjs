const fs = require('fs');
const https = require('https');

const expectedPath = 'C:/Users/MSI/.gemini/antigravity/brain/56aff216-0c35-4c7d-9f93-2b570d0f7a13/.user_uploaded/media_1794263904484_feca43ce.html';
const expectedBuffer = fs.readFileSync(expectedPath);
const liveUrl = 'https://spidernajaf.com/googlefc2b415a7968474e.html';

console.log('Comparing LIVE URL:', liveUrl);
console.log('Against original attached file:', expectedPath);

https.get(liveUrl, (res) => {
  const chunks = [];
  res.on('data', (d) => chunks.push(d));
  res.on('end', () => {
    const actualBuffer = Buffer.concat(chunks);
    console.log('--- Results ---');
    console.log('HTTP Status Code:', res.statusCode);
    console.log('Content-Type Header:', res.headers['content-type']);
    console.log('Actual Bytes Length:', actualBuffer.length);
    console.log('Expected Bytes Length:', expectedBuffer.length);
    console.log('Exact Binary Match:', actualBuffer.equals(expectedBuffer));
    console.log('Live Content:', actualBuffer.toString('utf-8'));
    console.log('Expected Content:', expectedBuffer.toString('utf-8'));
    
    if (res.statusCode === 200 && actualBuffer.equals(expectedBuffer)) {
      console.log('✅ VERIFICATION SUCCEEDED 100%: LIVE FILE MATCHES ATTACHED FILE EXACTLY!');
      process.exit(0);
    } else {
      console.error('❌ VERIFICATION FAILED: Discrepancy detected.');
      process.exit(1);
    }
  });
}).on('error', (err) => {
  console.error('Network request failed:', err);
  process.exit(1);
});
