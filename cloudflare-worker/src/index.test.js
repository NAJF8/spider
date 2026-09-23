module.exports = {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }

    const url = new URL(request.url);

    if (url.pathname === '/api/store/prices' && request.method === 'GET') {
      try {
        const token = (request.headers?.get?.('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
        if (!token) return errorResponse('AUTH_REQUIRED', 401);
        const verifyRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }) });
        const verifyData = await verifyRes.json();
        const uid = verifyData?.users?.[0]?.localId;
        if (!uid) return errorResponse('AUTH_INVALID', 401);
        const databaseSecret = String(env.FIREBASE_DATABASE_SECRET || '').trim();
        if (!databaseSecret) return errorResponse('PRICE_BACKEND_NOT_CONFIGURED', 503);
        const query = `?auth=${encodeURIComponent(databaseSecret)}`;
        const [profileRes, pricesRes] = await Promise.all([
          fetch(`https://${env.FIREBASE_PROJECT_ID}-default-rtdb.asia-southeast1.firebasedatabase.app/profiles/${encodeURIComponent(uid)}.json${query}`),
          fetch(`https://${env.FIREBASE_PROJECT_ID}-default-rtdb.asia-southeast1.firebasedatabase.app/private_prices.json${query}`)
        ]);
        const profile = profileRes.ok ? await profileRes.json() : null;
        const accountType = ['retail', 'wholesale', 'special'].includes(profile?.accountType) ? profile.accountType : 'retail';
        const allPrices = pricesRes.ok ? ((await pricesRes.json()) || {}) : {};
        const prices = accountType === 'retail' ? {} : Object.fromEntries(Object.entries(allPrices).map(([id, value]) => [id, accountType === 'wholesale' ? { wholesale_price: value?.wholesale_price } : { special_price: value?.special_price }]));
        return jsonResponse({ success: true, accountType, prices });
      } catch { return errorResponse('PRICE_LOOKUP_FAILED', 500); }
    }

    if (url.pathname === '/api/admin/products/upload-image' && request.method === 'POST') {
      try {
        // 1. Verify Authentication (Signature, Expiry, Project, UID)
        const authHeader = request.headers?.get?.('Authorization') || '';
        const token = authHeader.replace('Bearer ', '').trim();
        
        if (!token) return errorResponse('AUTH_REQUIRED', 401);

        // Google Identity Toolkit natively checks signature, expiry, and issues it for this specific API_KEY (project)
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
        
        // Strict Admin UID Check
        if (uid !== env.ADMIN_UID) {
          return errorResponse('FORBIDDEN', 403);
        }

        // 2. Parse FormData & Validate File
        const formData = await request.formData();
        const file = formData.get('image');
        let filename = formData.get('filename') || '';

        if (!file || typeof file.arrayBuffer !== 'function') {
          return errorResponse('IMAGE_REQUIRED', 400);
        }

        if (file.size > 5 * 1024 * 1024) {
          return errorResponse('IMAGE_TOO_LARGE', 400);
        }

        // Strict Filename Sanitization to prevent Path Traversal
        filename = filename.replace(/[^a-zA-Z0-9.\-_]/g, '');
        if (!filename.toLowerCase().endsWith('.webp') && !filename.toLowerCase().endsWith('.jpg') && !filename.toLowerCase().endsWith('.png')) {
          filename += '.webp';
        }
        
        // Enforce prefix and randomness to prevent overwriting other files blindly
        if (!filename.startsWith('product-')) {
          filename = `product-${Date.now()}-${filename}`;
        }

        // 3. Upload strictly to NAJF8/spider in public/images/products
        const githubToken = String(env.GITHUB_TOKEN || '').trim();
        if (!githubToken) {
          return errorResponse('GITHUB_UPLOAD_NOT_CONFIGURED', 500);
        }

        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        
        // Basic Magic Byte Check for WebP, JPEG, PNG
        let validImage = false;
        if (bytes.length > 4) {
          // WebP: RIFF...WEBP
          if (bytes[0]===0x52 && bytes[1]===0x49 && bytes[2]===0x46 && bytes[3]===0x46 && bytes[8]===0x57 && bytes[9]===0x45) validImage = true;
          // PNG: 89 50 4e 47
          if (bytes[0]===0x89 && bytes[1]===0x50 && bytes[2]===0x4E && bytes[3]===0x47) validImage = true;
          // JPEG: FF D8 FF
          if (bytes[0]===0xFF && bytes[1]===0xD8 && bytes[2]===0xFF) validImage = true;
        }

        if (!validImage) {
           return errorResponse('IMAGE_TYPE_UNSUPPORTED', 400);
        }

        const base64Content = btoa(String.fromCharCode(...bytes));
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
            message: `chore: upload product image ${filename}`,
            content: base64Content,
            branch: 'main'
          })
        });

        if (!githubRes.ok) {
          console.error("GitHub Upload Error:", await githubRes.text());
          return errorResponse('GITHUB_UPLOAD_FAILED', 500);
        }

        // Success
        return new Response(JSON.stringify({
          success: true,
          imageUrl: `https://spider-aaa19.web.app/images/products/${filename}`,
          rawUrl: `https://raw.githubusercontent.com/NAJF8/spider/main/public/images/products/${filename}`,
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

    if (url.pathname === '/api/store/checkout' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { items, customer } = body;
        const requestId = String(body.requestId || request.headers?.get?.('X-Request-Id') || '').trim();

        if (!items || !Array.isArray(items) || items.length === 0) {
          return errorResponse('CART_EMPTY', 400);
        }
        if (!customer || !customer.name || !customer.phone) {
          return errorResponse('CUSTOMER_INFO_MISSING', 400);
        }

        const normalizedItems = items.map(item => ({
          id: String(item?.id || ''),
          qty: Number(item?.qty)
        }));
        if (normalizedItems.some(item => !item.id || !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 100)) {
          return errorResponse('INVALID_ITEM_QUANTITY', 400);
        }
        if (new Set(normalizedItems.map(item => item.id)).size !== normalizedItems.length) {
          return errorResponse('DUPLICATE_ITEM', 400);
        }

        const databaseSecret = String(env.FIREBASE_DATABASE_SECRET || '').trim();
        if (!databaseSecret) {
          return errorResponse('ORDER_BACKEND_NOT_CONFIGURED', 503);
        }
        const databaseQuery = `?auth=${encodeURIComponent(databaseSecret)}`;

        // A client retry may safely replay the same response after the first save.
        // The request id is opaque and contains no customer data.
        if (requestId && !/^[A-Za-z0-9_-]{16,100}$/.test(requestId)) {
          return errorResponse('INVALID_REQUEST_ID', 400);
        }
        if (requestId) {
          const replayRes = await fetch(`https://${env.FIREBASE_PROJECT_ID}-default-rtdb.asia-southeast1.firebasedatabase.app/checkout_requests/${encodeURIComponent(requestId)}.json${databaseQuery}`);
          if (replayRes.ok) {
            const replay = await replayRes.json();
            if (replay?.success && replay.orderNumber) {
              return jsonResponse(replay);
            }
          }
        }

        // Fetch live products and settings
        const [productsRes, settingsRes] = await Promise.all([
          fetch(`https://${env.FIREBASE_PROJECT_ID}-default-rtdb.asia-southeast1.firebasedatabase.app/products.json${databaseQuery}`),
          fetch(`https://${env.FIREBASE_PROJECT_ID}-default-rtdb.asia-southeast1.firebasedatabase.app/settings.json${databaseQuery}`)
        ]);

        if (!productsRes.ok || !settingsRes.ok) {
          return errorResponse('DATABASE_ERROR', 500);
        }

        const productsObj = await productsRes.json() || {};
        const settingsObj = await settingsRes.json() || {};
        let accountType = 'retail';
        const authHeader = request.headers?.get?.('Authorization') || '';
        const token = authHeader.replace(/^Bearer\s+/i, '').trim();
        if (token) {
          const verifyRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }) });
          const verifyData = await verifyRes.json();
          const uid = verifyData?.users?.[0]?.localId;
          if (!uid) return errorResponse('AUTH_INVALID', 401);
          const profileRes = await fetch(`https://${env.FIREBASE_PROJECT_ID}-default-rtdb.asia-southeast1.firebasedatabase.app/profiles/${encodeURIComponent(uid)}.json${databaseQuery}`);
          if (profileRes.ok) {
            const profile = await profileRes.json();
            if (['retail', 'wholesale', 'special'].includes(profile?.accountType)) accountType = profile.accountType;
          }
        }
        const privatePricesRes = await fetch(`https://${env.FIREBASE_PROJECT_ID}-default-rtdb.asia-southeast1.firebasedatabase.app/private_prices.json${databaseQuery}`);
        const privatePrices = privatePricesRes.ok ? ((await privatePricesRes.json()) || {}) : {};
        const deliveryFee = Number(settingsObj.deliveryFee);
        if (!Number.isFinite(deliveryFee) || deliveryFee < 0) {
          return errorResponse('DELIVERY_FEE_NOT_CONFIGURED', 503);
        }

        let subtotal = 0;
        const verifiedItems = [];

        for (const item of normalizedItems) {
          const liveProd = productsObj[item.id];
          if (!liveProd || liveProd.isHidden || liveProd.status !== 'published') {
            return errorResponse(`PRODUCT_UNAVAILABLE_${item.id}`, 400);
          }
          
          const availableStock = liveProd.stockQuantity ?? liveProd.stock;
          if (availableStock !== undefined && availableStock !== null && Number(availableStock) < item.qty) {
            return errorResponse(`OUT_OF_STOCK_${item.id}`, 400);
          }

          const privatePrice = privatePrices[item.id] || {};
          const requestedPrice = accountType === 'wholesale' ? privatePrice.wholesale_price : accountType === 'special' ? privatePrice.special_price : null;
          const livePrice = Number(requestedPrice ?? liveProd.price) || 0;
          subtotal += (livePrice * item.qty);
          verifiedItems.push({
            id: item.id,
            name: liveProd.name,
            price: livePrice,
            quantity: item.qty
          });
        }

        const grandTotal = subtotal + deliveryFee;
        const orderNumber = Math.floor(100000 + Math.random() * 900000).toString();
        const newOrderId = crypto.randomUUID();

        const orderPayload = {
          orderNumber,
          customerName: String(customer.name),
          customerPhone: String(customer.phone),
          governorate: String(customer.governorate || customer.gov || ''),
          city: String(customer.district || customer.city || ''),
          district: String(customer.district || ''),
          subdistrict: String(customer.subdistrict || ''),
          neighborhood: String(customer.neighborhood || ''),
          address: String(customer.addressDetails || customer.address || ''),
          addressDetails: String(customer.addressDetails || customer.address || ''),
          notes: String(customer.notes || ''),
          subtotal,
          deliveryFee,
          grandTotal,
          timestamp: Date.now(),
          status: 'pending',
          items: verifiedItems,
        };

        const saveRes = await fetch(`https://${env.FIREBASE_PROJECT_ID}-default-rtdb.asia-southeast1.firebasedatabase.app/orders/${newOrderId}.json${databaseQuery}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderPayload)
        });

        if (!saveRes.ok) {
          const errText = await saveRes.text();
          console.error("Firebase Save Error:", errText);
          return errorResponse('ORDER_SAVE_FAILED', 500);
        }

        const responsePayload = {
          success: true,
          orderNumber,
          subtotal,
          deliveryFee,
          grandTotal,
          items: verifiedItems
        };
        if (requestId) {
          const replaySave = await fetch(`https://${env.FIREBASE_PROJECT_ID}-default-rtdb.asia-southeast1.firebasedatabase.app/checkout_requests/${encodeURIComponent(requestId)}.json${databaseQuery}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...responsePayload, savedAt: Date.now() })
          });
          if (!replaySave.ok) console.error('Checkout idempotency record failed:', replaySave.status);
        }
        return jsonResponse(responsePayload);

      } catch (err) {
        console.error("Checkout Error:", err.message);
        return errorResponse('CHECKOUT_ERROR', 500);
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

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
