export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }

    const url = new URL(request.url);

    // Image Upload Route
    if (url.pathname === '/api/admin/products/upload-image' && request.method === 'POST') {
      try {
        // 1. Verify Authentication
        const authHeader = request.headers.get('Authorization') || '';
        const token = authHeader.replace('Bearer ', '').trim();
        
        if (!token) {
          return errorResponse('AUTH_REQUIRED', 401);
        }

        // Verify Firebase Token using Identity Toolkit
        const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`;
        const verifyRes = await fetch(verifyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: token })
        });

        const verifyData = await verifyRes.json();
        
        if (!verifyRes.ok || !verifyData.users || verifyData.users.length === 0) {
          return errorResponse('AUTH_INVALID', 401);
        }

        const uid = verifyData.users[0].localId;
        
        // Ensure it's the specific SPIDER admin
        if (uid !== env.ADMIN_UID) {
          return errorResponse('FORBIDDEN', 403);
        }

        // 2. Parse FormData
        const formData = await request.formData();
        const file = formData.get('image');
        const filename = formData.get('filename') || `product-${Date.now()}.webp`;

        if (!file || typeof file.arrayBuffer !== 'function') {
          return errorResponse('IMAGE_REQUIRED', 400);
        }

        // Check size (e.g. max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          return errorResponse('IMAGE_TOO_LARGE', 400);
        }

        // 3. Upload to GitHub
        const githubToken = env.GITHUB_TOKEN;
        if (!githubToken) {
          return errorResponse('GITHUB_UPLOAD_NOT_CONFIGURED', 500);
        }

        const buffer = await file.arrayBuffer();
        const base64Content = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        
        const path = `public/images/products/${filename}`;
        const githubUrl = `https://api.github.com/repos/NAJF8/spider/contents/${path}`;

        const githubRes = await fetch(githubUrl, {
          method: 'PUT',
          headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${githubToken}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'Spider-Najaf-Image-Uploader',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: `feat: upload product image ${filename}`,
            content: base64Content,
            branch: 'main'
          })
        });

        if (!githubRes.ok) {
          const ghErr = await githubRes.text();
          console.error("GitHub Upload Error:", ghErr);
          return errorResponse('GITHUB_UPLOAD_FAILED', 500);
        }

        // Success
        return new Response(JSON.stringify({
          success: true,
          imageUrl: `https://spider-aaa19.web.app/images/products/${filename}`,
          path: `/images/products/${filename}`
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });

      } catch (err) {
        console.error("Upload Error:", err.message);
        return errorResponse('IMAGE_UPLOAD_FAILED', 500);
      }
    }

    return new Response('Not Found', { status: 404 });
  }
};

function errorResponse(code, status) {
  return new Response(JSON.stringify({ error: code }), {
    status: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
