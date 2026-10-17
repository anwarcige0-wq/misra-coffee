const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

// In-memory rate limiting map for login protection (IP -> { count, resetTime })
const loginRateLimit = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const record = loginRateLimit.get(ip);
  if (!record || now > record.resetTime) {
    loginRateLimit.set(ip, { count: 1, resetTime: now + 60 * 1000 });
    return true;
  }
  if (record.count >= 5) {
    return false;
  }
  record.count++;
  return true;
}


const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

// Body Parser Helper
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...extraHeaders
  });
  res.end(JSON.stringify(data));
}

function getCookie(req, name) {
  const list = {};
  const rc = req.headers.cookie;
  if (rc) {
    rc.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      list[parts.shift().trim()] = decodeURI(parts.join('='));
    });
  }
  return list[name];
}

function getAuthToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return getCookie(req, 'admin_session');
}

function requireAdmin(req, res) {
  const token = getAuthToken(req);
  const session = db.verifyAdminSession(token);
  if (!session) {
    sendJson(res, 401, { success: false, error: 'Unauthorized: Fadlan gal /admin/login' });
    return null;
  }
  return session;
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  // -------------------------------------------------------------
  // ADMIN AUTHENTICATION API
  // -------------------------------------------------------------
  if (pathname === '/api/admin/login' && method === 'POST') {
    try {
      const clientIp = req.socket.remoteAddress || '127.0.0.1';
      if (!checkRateLimit(clientIp)) {
        return sendJson(res, 429, {
          success: false,
          error: 'Isku-dayo xad-dhaaf ah (Too many attempts). Fadlan sug 1 daqiiqo ka hor inta aadan mar kale isku dayin.'
        });
      }

      const body = await readJsonBody(req);
      const email = body.email;
      const secret = body.secret;

      if (!email || !secret) {
        return sendJson(res, 400, { success: false, error: 'Email iyo Secret/PIN labadaba waa loo baahan yahay.' });
      }

      const result = db.authenticateAdmin(email, secret);
      if (!result.success) {
        return sendJson(res, 401, result);
      }

      // Set Secure HTTP-only session cookie
      const cookieHeader = `admin_session=${result.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`;
      return sendJson(res, 200, {
        success: true,
        token: result.token,
        admin: result.admin
      }, { 'Set-Cookie': cookieHeader });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  if (pathname === '/api/admin/logout' && method === 'POST') {
    const token = getAuthToken(req);
    if (token) {
      db.destroyAdminSession(token);
    }
    const clearCookie = `admin_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax`;
    return sendJson(res, 200, { success: true, message: 'Logged out' }, { 'Set-Cookie': clearCookie });
  }

  if (pathname === '/api/admin/me' && method === 'GET') {
    const token = getAuthToken(req);
    const session = db.verifyAdminSession(token);
    if (!session) {
      return sendJson(res, 401, { success: false, error: 'Not authenticated' });
    }
    return sendJson(res, 200, { success: true, admin: { email: session.email, role: session.role } });
  }

  if (pathname === '/api/admin/change-password' && method === 'POST') {
    const session = requireAdmin(req, res);
    if (!session) return;

    try {
      const body = await readJsonBody(req);
      const newSecret = (body.new_secret || '').trim();
      if (!newSecret || newSecret.length < 6) {
        return sendJson(res, 400, { success: false, error: 'Furaha cusub waa inuu ka koobnaadaa ugu yaraan 6 xaraf.' });
      }
      db.changeAdminPassword(session.admin_id, newSecret);
      return sendJson(res, 200, { success: true, message: 'Furaha si guul leh ayaa loo beddelay.' });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  // -------------------------------------------------------------
  // ADMIN PROTECTED MANAGEMENT ENDPOINTS
  // -------------------------------------------------------------
  if (pathname === '/api/admin/restaurant' && method === 'POST') {
    if (!requireAdmin(req, res)) return;
    try {
      const body = await readJsonBody(req);
      db.updateRestaurant('misra-01', body);
      return sendJson(res, 200, { success: true, message: 'Settings updated' });
    } catch (e) {
      return sendJson(res, 400, { success: false, error: e.message });
    }
  }

  // Admin Categories CRUD
  if (pathname === '/api/admin/categories' && method === 'GET') {
    if (!requireAdmin(req, res)) return;
    const categories = db.getAllCategories();
    return sendJson(res, 200, { success: true, categories });
  }

  if (pathname === '/api/admin/categories' && method === 'POST') {
    if (!requireAdmin(req, res)) return;
    try {
      const body = await readJsonBody(req);
      if (!body.name) return sendJson(res, 400, { success: false, error: 'Category name required' });
      db.addCategory(body);
      return sendJson(res, 201, { success: true, message: 'Category created' });
    } catch (e) {
      return sendJson(res, 400, { success: false, error: e.message });
    }
  }

  if (pathname.startsWith('/api/admin/categories/') && method === 'PUT') {
    if (!requireAdmin(req, res)) return;
    const id = pathname.replace('/api/admin/categories/', '');
    try {
      const body = await readJsonBody(req);
      db.updateCategory(id, body);
      return sendJson(res, 200, { success: true, message: 'Category updated' });
    } catch (e) {
      return sendJson(res, 400, { success: false, error: e.message });
    }
  }

  if (pathname.startsWith('/api/admin/categories/') && method === 'DELETE') {
    if (!requireAdmin(req, res)) return;
    const id = pathname.replace('/api/admin/categories/', '');
    db.deleteCategory(id);
    return sendJson(res, 200, { success: true, message: 'Category deleted' });
  }

  // Admin Menu Items CRUD & Image Upload
  if (pathname === '/api/admin/menu/items' && method === 'GET') {
    if (!requireAdmin(req, res)) return;
    const items = db.getAllMenuItems();
    return sendJson(res, 200, { success: true, items });
  }

  if (pathname === '/api/admin/upload-image' && method === 'POST') {
    if (!requireAdmin(req, res)) return;
    try {
      const body = await readJsonBody(req);
      const dataUrl = body.image_data;
      if (!dataUrl) {
        return sendJson(res, 400, { success: false, error: 'Sawirka lama helin (Image data required).' });
      }

      let matches = dataUrl.match(/^data:image\/([A-Za-z0-9-+]+);base64,(.+)$/);
      let buffer;
      let ext = '.jpg';
      if (matches) {
        ext = '.' + (matches[1] === 'jpeg' ? 'jpg' : matches[1].replace(/[^a-z0-9]/gi, ''));
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        buffer = Buffer.from(dataUrl, 'base64');
      }

      if (buffer.length > 5 * 1024 * 1024) {
        return sendJson(res, 400, { success: false, error: 'Sawirku wuxuu ka weyn yahay 5MB.' });
      }

      const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext.toLowerCase()) ? ext.toLowerCase() : '.jpg';
      const filename = `dish-${Date.now()}-${crypto.randomBytes(3).toString('hex')}${safeExt}`;
      const uploadPath = path.join(ROOT, 'images', filename);

      fs.writeFileSync(uploadPath, buffer);
      return sendJson(res, 200, {
        success: true,
        message: 'Sawirka si guul leh ayaa loo kaydiyey.',
        url: `/images/${filename}`
      });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  if (pathname === '/api/admin/menu/items' && method === 'POST') {
    if (!requireAdmin(req, res)) return;
    try {
      const body = await readJsonBody(req);
      if (!body.name || !body.category_id || body.price === undefined) {
        return sendJson(res, 400, { success: false, error: 'Magaca, Qaybta iyo Qiimaha waa waajib.' });
      }
      db.addMenuItem(body);
      return sendJson(res, 201, { success: true, message: 'Menu item created' });
    } catch (e) {
      return sendJson(res, 400, { success: false, error: e.message });
    }
  }

  if (pathname.startsWith('/api/admin/menu/items/') && method === 'PUT') {
    if (!requireAdmin(req, res)) return;
    const id = pathname.replace('/api/admin/menu/items/', '');
    try {
      const body = await readJsonBody(req);
      db.updateMenuItem(id, body);
      return sendJson(res, 200, { success: true, message: 'Item updated' });
    } catch (e) {
      return sendJson(res, 400, { success: false, error: e.message });
    }
  }

  if (pathname.startsWith('/api/admin/menu/items/') && method === 'DELETE') {
    if (!requireAdmin(req, res)) return;
    const id = pathname.replace('/api/admin/menu/items/', '');
    db.deleteMenuItem(id);
    return sendJson(res, 200, { success: true, message: 'Item deleted' });
  }

  // Admin Tables CRUD
  if (pathname === '/api/admin/tables' && method === 'POST') {
    if (!requireAdmin(req, res)) return;
    try {
      const body = await readJsonBody(req);
      if (!body.table_number) return sendJson(res, 400, { success: false, error: 'Table number required' });
      db.addTable(body);
      return sendJson(res, 201, { success: true, message: 'Table added' });
    } catch (e) {
      return sendJson(res, 400, { success: false, error: e.message });
    }
  }

  if (pathname.startsWith('/api/admin/tables/') && method === 'PUT') {
    if (!requireAdmin(req, res)) return;
    const id = pathname.replace('/api/admin/tables/', '');
    try {
      const body = await readJsonBody(req);
      db.updateTable(id, body);
      return sendJson(res, 200, { success: true, message: 'Table updated' });
    } catch (e) {
      return sendJson(res, 400, { success: false, error: e.message });
    }
  }

  if (pathname.startsWith('/api/admin/tables/') && method === 'DELETE') {
    if (!requireAdmin(req, res)) return;
    const id = pathname.replace('/api/admin/tables/', '');
    db.deleteTable(id);
    return sendJson(res, 200, { success: true, message: 'Table deleted' });
  }

  if (pathname === '/api/admin/requests/all' && method === 'GET') {
    if (!requireAdmin(req, res)) return;
    const all = db.getServiceRequests('misra-01', 100);
    return sendJson(res, 200, { success: true, requests: all });
  }

  // -------------------------------------------------------------
  // PUBLIC CUSTOMER API ENDPOINTS
  // -------------------------------------------------------------
  if (pathname === '/api/restaurant' && method === 'GET') {
    const restaurant = db.getRestaurant();
    return sendJson(res, 200, { success: true, restaurant });
  }

  if (pathname === '/api/tables' && method === 'GET') {
    const tables = db.getTables();
    return sendJson(res, 200, { success: true, tables });
  }

  if (pathname === '/api/tables/validate' && method === 'GET') {
    const tableNumber = parsedUrl.searchParams.get('number');
    if (!tableNumber) {
      return sendJson(res, 400, { success: false, valid: false, error: 'Table number required' });
    }
    const table = db.getTableByNumber(tableNumber.trim());
    if (!table) {
      return sendJson(res, 404, { success: false, valid: false, error: 'Miiskan lama helin (Table not found)' });
    }
    if (!table.active) {
      return sendJson(res, 403, { success: false, valid: false, error: 'Miiskan hadda waa xiran yahay (Table is disabled)' });
    }
    return sendJson(res, 200, { success: true, valid: true, table });
  }

  if (pathname === '/api/menu' && method === 'GET') {
    const categories = db.getCategories();
    const items = db.getMenuItems();
    return sendJson(res, 200, { success: true, categories, items });
  }

  // Customer Waiter Call & Food Selection
  if (pathname === '/api/requests' && method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const tableNumber = (body.table_number || '').trim();

      if (!tableNumber) {
        return sendJson(res, 400, { success: false, error: 'Fadlan dooro lambarka miiskaaga (Table number required).' });
      }

      const table = db.getTableByNumber(tableNumber);
      if (!table) {
        return sendJson(res, 404, { success: false, error: 'Miiskan ma jiro nidaamka (Table does not exist).' });
      }
      if (!table.active) {
        return sendJson(res, 403, { success: false, error: 'Miiskan hadda ma shaqeynayo (Table is inactive).' });
      }

      // Duplicate prevention for waiter calls
      const activeForTable = db.getActiveServiceRequests().filter(r => r.table_number === tableNumber && r.status === 'new');
      if (activeForTable.length > 0 && body.request_type === 'waiter_call' && !body.items_json) {
        return sendJson(res, 429, { 
          success: false, 
          error: 'Codsigaagii hore waa la helay! Waiter-ka ayaa kuugu imanaya miiskaaga.',
          existingRequestId: activeForTable[0].id
        });
      }

      const created = db.createServiceRequest({
        table_number: tableNumber,
        request_type: body.request_type || 'waiter_call',
        items_json: body.items_json || null,
        note: body.note || ''
      });

      return sendJson(res, 201, {
        success: true,
        message: 'Codsigaaga si guul leh ayaa loo diray!',
        request: created
      });
    } catch (e) {
      return sendJson(res, 500, { success: false, error: e.message });
    }
  }

  if (pathname === '/api/requests/active' && method === 'GET') {
    const active = db.getActiveServiceRequests();
    return sendJson(res, 200, { success: true, requests: active });
  }

  if (pathname.startsWith('/api/requests/') && pathname.endsWith('/status') && method === 'PUT') {
    const id = pathname.replace('/api/requests/', '').replace('/status', '');
    try {
      const body = await readJsonBody(req);
      const validStatuses = ['new', 'pending', 'acknowledged', 'completed', 'cancelled'];
      if (!validStatuses.includes(body.status)) {
        return sendJson(res, 400, { success: false, error: 'Invalid status' });
      }
      const mappedStatus = body.status === 'pending' ? 'new' : body.status;
      db.updateRequestStatus(id, mappedStatus);
      return sendJson(res, 200, { success: true, message: `Status updated to ${body.status}` });
    } catch (e) {
      return sendJson(res, 400, { success: false, error: e.message });
    }
  }

  if (pathname.startsWith('/api/requests/') && method === 'GET') {
    const id = pathname.replace('/api/requests/', '');
    const reqItem = db.db.prepare('SELECT * FROM service_requests WHERE id = ?').get(id);
    if (!reqItem) return sendJson(res, 404, { success: false, error: 'Request not found' });
    return sendJson(res, 200, { success: true, request: reqItem });
  }

  if (pathname === '/api/auth/pin' && method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const user = db.db.prepare('SELECT * FROM staff_users WHERE restaurant_id = "misra-01" AND pin_code = ? AND active = 1').get((body.pin_code || '').trim());
      if (!user) {
        return sendJson(res, 401, { success: false, error: 'PIN-ka waa khalad.' });
      }
      return sendJson(res, 200, {
        success: true,
        user: { username: user.username, role: user.role, full_name: user.full_name }
      });
    } catch (e) {
      return sendJson(res, 400, { success: false, error: e.message });
    }
  }

  // -------------------------------------------------------------
  // HTML PAGE ROUTING & SECURITY GATEWAYS
  // -------------------------------------------------------------
  let safePath = path.normalize(decodeURI(pathname)).replace(/^(\.\.[\/\\])+/, '');
  const lowerSafe = safePath.toLowerCase().replace(/\\/g, '/');

  // Block direct access to database, environment, and backend source files
  if (
    lowerSafe.endsWith('.db') ||
    lowerSafe.endsWith('.db-journal') ||
    lowerSafe.endsWith('.sqlite') ||
    lowerSafe.endsWith('.sql') ||
    lowerSafe.endsWith('.env') ||
    lowerSafe.includes('/db.js') ||
    lowerSafe === '/db.js' ||
    lowerSafe.includes('/server.js') ||
    lowerSafe === '/server.js' ||
    lowerSafe.includes('package.json')
  ) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('403 Forbidden: Restricted system file');
  }

  // Protect Admin Dashboard HTML & JS direct access
  if (
    lowerSafe === '/admin-dashboard.html' || 
    lowerSafe === '/admin.html'
  ) {
    const token = getAuthToken(req);
    const session = db.verifyAdminSession(token);
    if (!session) {
      res.writeHead(302, { 'Location': '/admin/login' });
      return res.end();
    }
    safePath = '/admin-dashboard.html';
  }

  if (
    lowerSafe === '/admin-dashboard.js' || 
    lowerSafe === '/admin-app.js'
  ) {
    const token = getAuthToken(req);
    const session = db.verifyAdminSession(token);
    if (!session) {
      return sendJson(res, 401, { success: false, error: 'Unauthorized: Admin authentication required' });
    }
  }

  if (safePath === '/' || safePath === '\\' || safePath === '.') {
    safePath = '/index.html';
  } else if (safePath === '/services' || safePath === '\\services') {
    safePath = '/services.html';
  } else if (safePath === '/about' || safePath === '\\about') {
    safePath = '/about.html';
  } else if (safePath === '/menu' || safePath === '\\menu') {
    safePath = '/menu.html';
  } else if (safePath === '/staff' || safePath === '\\staff') {
    safePath = '/staff.html';
  } 
  // Admin Login Gateway
  else if (safePath === '/admin/login' || safePath === '\\admin\\login') {
    safePath = '/admin-login.html';
  }
  // Admin Dashboard Protected Gateway
  else if (safePath === '/admin/dashboard' || safePath === '\\admin\\dashboard') {
    const token = getAuthToken(req);
    const session = db.verifyAdminSession(token);
    if (!session) {
      res.writeHead(302, { 'Location': '/admin/login' });
      return res.end();
    }
    safePath = '/admin-dashboard.html';
  }
  // Legacy /admin redirect
  else if (safePath === '/admin' || safePath === '\\admin') {
    const token = getAuthToken(req);
    const session = db.verifyAdminSession(token);
    if (!session) {
      res.writeHead(302, { 'Location': '/admin/login' });
      return res.end();
    } else {
      res.writeHead(302, { 'Location': '/admin/dashboard' });
      return res.end();
    }
  }

  let filePath = path.join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err && !path.extname(filePath)) {
      const htmlPath = filePath + '.html';
      return fs.stat(htmlPath, (htmlErr, htmlStats) => {
        if (!htmlErr && htmlStats.isFile()) {
          serveFile(htmlPath, res);
        } else {
          send404(res);
        }
      });
    }

    if (err) {
      send404(res);
      return;
    }

    if (stats.isDirectory()) {
      const indexPath = path.join(filePath, 'index.html');
      fs.stat(indexPath, (idxErr, idxStats) => {
        if (!idxErr && idxStats.isFile()) {
          serveFile(indexPath, res);
        } else {
          res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('403 Directory Listing Denied');
        }
      });
      return;
    }

    serveFile(filePath, res);
  });
});

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const headers = {
    'Content-Type': contentType,
    'Cache-Control': 'no-cache'
  };
  if (path.basename(filePath) === 'sw.js') {
    headers['Service-Worker-Allowed'] = '/';
  }
  res.writeHead(200, headers);
  fs.createReadStream(filePath).pipe(res);
}

function send404(res) {
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!DOCTYPE html>
<html lang="so">
<head>
  <meta charset="utf-8">
  <title>404 — Bogga Lama Helin | MISRA COFFEE</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body style="display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:20px;background:#2B1B16;color:#FAF6F0">
  <div style="max-width:500px">
    <h1 style="font-size:48px;margin-bottom:12px;color:#C9A15D">404</h1>
    <h2 style="margin-bottom:16px">Bogga aad raadinayso lama helin.</h2>
    <p style="margin-bottom:24px;color:#C8B8A6">Fadlan ku noqo bogga hore ama menu-ga.</p>
    <a href="/" class="btn btn-primary">Ku Noqo Bogga Hore</a>
  </div>
</body>
</html>`);
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`MISRA COFFEE Platform Running at http://localhost:${PORT}/`);
});
