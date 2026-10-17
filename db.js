const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'data.db');
const db = new DatabaseSync(DB_PATH);

// -------------------------------------------------------------
// SECURE PASSWORD HASHING (scrypt + salt)
// -------------------------------------------------------------
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  try {
    const testHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(testHash, 'hex'));
  } catch (e) {
    return false;
  }
}

// -------------------------------------------------------------
// SCHEMA INITIALIZATION
// -------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS restaurants (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE,
    name TEXT NOT NULL,
    tagline TEXT,
    phone TEXT,
    currency TEXT DEFAULT '$',
    qr_base_url TEXT DEFAULT '',
    menu_open INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tables (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    table_number TEXT NOT NULL,
    label TEXT,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(restaurant_id, table_number)
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS menu_items (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    image_url TEXT,
    portion_sizes TEXT,
    meal_periods TEXT DEFAULT 'all',
    available INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS service_requests (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    table_number TEXT NOT NULL,
    request_type TEXT NOT NULL DEFAULT 'waiter_call',
    status TEXT NOT NULL DEFAULT 'new',
    items_json TEXT,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at DATETIME,
    completed_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    failed_attempts INTEGER DEFAULT 0,
    locked_until DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admin_sessions (
    token TEXT PRIMARY KEY,
    admin_id TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL
  );
`);

// Add columns safely if not present (migration support)
try { db.exec('ALTER TABLE menu_items ADD COLUMN portion_sizes TEXT'); } catch (e) {}
try { db.exec('ALTER TABLE menu_items ADD COLUMN meal_periods TEXT DEFAULT "all"'); } catch (e) {}
try { db.exec('ALTER TABLE restaurants ADD COLUMN menu_open INTEGER DEFAULT 1'); } catch (e) {}

// Seed / Update Admin Account
const ADMIN_EMAIL = 'cabdilaahicawil881@gmail.com';
const INITIAL_SECRET = 'misra coffe7706';

const existingAdmin = db.prepare('SELECT * FROM admin_users WHERE email = ?').get(ADMIN_EMAIL);
if (!existingAdmin) {
  const { hash, salt } = hashPassword(INITIAL_SECRET);
  db.prepare(`
    INSERT INTO admin_users (id, email, password_hash, salt, role)
    VALUES (?, ?, ?, ?, 'admin')
  `).run('admin-cawil', ADMIN_EMAIL, hash, salt);
}

// Seed / Sync Restaurant
const restCount = db.prepare('SELECT COUNT(*) as count FROM restaurants').get().count;
if (restCount === 0) {
  db.prepare(`
    INSERT INTO restaurants (id, slug, name, tagline, phone, currency, qr_base_url)
    VALUES ('misra-01', 'misra', 'MISRA COFFEE', 'Dhadhan Aan La Ilaawi Karin', '+252 063 7537706', '$', '')
  `).run();
}

// Seed Tables 01 to 06
const tblCount = db.prepare('SELECT COUNT(*) as count FROM tables').get().count;
if (tblCount === 0) {
  const insTbl = db.prepare('INSERT INTO tables (id, restaurant_id, table_number, label, active) VALUES (?, "misra-01", ?, ?, 1)');
  ['01', '02', '03', '04', '05', '06'].forEach(n => insTbl.run(`tbl-${n}`, n, `Miis ${n}`));
}

// Seed / Reset the 7 Official Categories requested:
// Shaah, Qaxwo, Quraac, Qado, Casho, Cunto Fudud iyo Macmacaan, Cabitaanno & Biyo
const officialCategories = [
  { id: 'cat-shaah', name: 'Shaah', order: 1 },
  { id: 'cat-qaxwo', name: 'Qaxwo', order: 2 },
  { id: 'cat-quraac', name: 'Quraac', order: 3 },
  { id: 'cat-qado', name: 'Qado', order: 4 },
  { id: 'cat-casho', name: 'Casho', order: 5 },
  { id: 'cat-fudud-macmacaan', name: 'Cunto Fudud iyo Macmacaan', order: 6 },
  { id: 'cat-cabitaanno', name: 'Cabitaanno & Biyo', order: 7 }
];

officialCategories.forEach(c => {
  const exist = db.prepare('SELECT * FROM categories WHERE id = ?').get(c.id);
  if (!exist) {
    db.prepare("INSERT INTO categories (id, restaurant_id, name, sort_order, active) VALUES (?, 'misra-01', ?, ?, 1)").run(c.id, c.name, c.order);
  } else {
    db.prepare('UPDATE categories SET name = ?, sort_order = ?, active = 1 WHERE id = ?').run(c.name, c.order, c.id);
  }
});

// Deactivate old categories and clean out legacy/unmatched items
db.exec("UPDATE categories SET active = 0 WHERE id NOT IN ('cat-shaah', 'cat-qaxwo', 'cat-quraac', 'cat-qado', 'cat-casho', 'cat-fudud-macmacaan', 'cat-cabitaanno')");
db.exec("DELETE FROM menu_items WHERE id NOT LIKE 'it-%'");

// Seed Official Menu Items under the 7 strictly organized Categories
const officialItems = [
  // 1. Shaah (Tea items ONLY)
  {
    id: 'it-shaah-1',
    cat: 'cat-shaah',
    name: 'Shaah Cadeys (Caano leh)',
    desc: 'Shaah kulul oo caraf badan oo caano geel ama lo\'aad iyo xawaash heyl iyo qorfe leh.',
    price: 1.50,
    img: '/images/drinks.jpg',
    sizes: 'Koob: $1.50',
    period: 'all'
  },
  {
    id: 'it-shaah-2',
    cat: 'cat-shaah',
    name: 'Shaah Bigays (Cad / Madow)',
    desc: 'Shaah bigays saafi ah oo sinjibiil, caleen shaah iyo liin dhanaan leh.',
    price: 1.00,
    img: '/images/drinks.jpg',
    sizes: 'Koob: $1.00',
    period: 'all'
  },
  {
    id: 'it-shaah-3',
    cat: 'cat-shaah',
    name: 'Shaah Xawaash leh (Karkare)',
    desc: 'Shaah lagu kariyey xawaashyo dabiici ah oo heyl, dharag, filfil iyo qorfe ah.',
    price: 1.50,
    img: '/images/drinks.jpg',
    sizes: 'Koob: $1.50',
    period: 'all'
  },

  // 2. Qaxwo (Coffee items ONLY)
  {
    id: 'it-qaxwo-1',
    cat: 'cat-qaxwo',
    name: 'Qaxwaha Soomaaliyeed',
    desc: 'Qaxwo Soomaali ah oo si xirfad leh loo kariyey, lehna heyl, qorfe iyo caraf gaar ah.',
    price: 2.00,
    img: '/images/somali-coffee.jpg',
    sizes: 'Koob Yar: $1.50 | Weyn: $2.50',
    period: 'all'
  },
  {
    id: 'it-qaxwo-2',
    cat: 'cat-qaxwo',
    name: 'Espresso Dhaqameed',
    desc: 'Espresso adag oo leh crema dahabi ah iyo caraf qani ah.',
    price: 2.50,
    img: '/images/somali-coffee.jpg',
    sizes: 'Single: $2.50 | Double: $3.50',
    period: 'all'
  },
  {
    id: 'it-qaxwo-3',
    cat: 'cat-qaxwo',
    name: 'Cappuccino & Latte Caanood',
    desc: 'Qaxwo jilicsan oo caano xumbo leh iyo shaashad shokolaato ah dushiisa.',
    price: 3.00,
    img: '/images/somali-coffee.jpg',
    sizes: 'Koob: $3.00',
    period: 'all'
  },

  // 3. Quraac (Breakfast items ONLY)
  {
    id: 'it-qur-1',
    cat: 'cat-quraac',
    name: 'Canjeero & Ukun La Shiilay',
    desc: 'Canjeero jilicsan oo cusub, labo ukun oo la shiilay, malab dabiici ah iyo subag.',
    price: 4.50,
    img: '/images/breakfast.jpg',
    sizes: 'Caadi: $4.50 | Weyn: $5.50',
    period: 'breakfast'
  },
  {
    id: 'it-qur-2',
    cat: 'cat-quraac',
    name: 'Malawax & Malab Dabiici ah',
    desc: 'Malawax macaan oo kulul, subag saafi ah iyo malab geedka qansaxa.',
    price: 3.50,
    img: '/images/breakfast.jpg',
    sizes: '3 Xabbo: $3.50',
    period: 'breakfast'
  },
  {
    id: 'it-qur-3',
    cat: 'cat-quraac',
    name: 'Beer Cusub & Khudaar',
    desc: 'Beer xul ah oo lagu diyaariyey basal, barbarooni iyo suugo gaar ah.',
    price: 5.00,
    img: '/images/breakfast.jpg',
    sizes: 'Qof: $5.00 | Labo Qof: $8.50',
    period: 'breakfast'
  },

  // 4. Qado (Lunch items ONLY)
  {
    id: 'it-qad-1',
    cat: 'cat-qado',
    name: 'Bariis Iskukaris & Hilib Ari',
    desc: 'Bariis caraf badan oo sabiib leh, hilib ari jilicsan, moos, liin iyo basbaas shigni.',
    price: 8.50,
    img: '/images/lunch-dinner.jpg',
    sizes: 'Qof: $8.50 | Qoys: $16.00',
    period: 'lunch'
  },
  {
    id: 'it-qad-2',
    cat: 'cat-qado',
    name: 'Baasto & Hilib Digaag Duban',
    desc: 'Baasto suugo yaanyo macaan leh oo ay la socoto digaag la dubay iyo salaad.',
    price: 6.50,
    img: '/images/lunch-dinner.jpg',
    sizes: 'Caadi: $6.50 | Weyn: $8.00',
    period: 'lunch'
  },

  // 5. Casho (Dinner items ONLY)
  {
    id: 'it-cas-1',
    cat: 'cat-casho',
    name: 'Hilib Geel & Roodhi / Canjeero',
    desc: 'Hilib geel jilicsan oo la shiilay, maraq kulul iyo roodhi ama canjeero.',
    price: 9.00,
    img: '/images/lunch-dinner.jpg',
    sizes: 'Caadi: $9.00',
    period: 'dinner'
  },
  {
    id: 'it-cas-2',
    cat: 'cat-casho',
    name: 'Baasto Khudaar & Suugo Hilib Duqad',
    desc: 'Casho fudud oo baasto ah oo hilib duqad ah iyo khudaar cusub leh.',
    price: 7.00,
    img: '/images/lunch-dinner.jpg',
    sizes: 'Caadi: $7.00',
    period: 'dinner'
  },

  // 6. Cunto Fudud iyo Macmacaan (Snacks & Desserts ONLY)
  {
    id: 'it-fud-1',
    cat: 'cat-fudud-macmacaan',
    name: 'Sambuus Dahabi ah (3 Xabbo)',
    desc: 'Sambuus xagal-saddex ah oo hilib duqad ah iyo basbaas cagaaran ka buuxo.',
    price: 1.50,
    img: '/images/snacks.jpg',
    sizes: '3 Xabbo: $1.50 | 6 Xabbo: $3.00',
    period: 'all'
  },
  {
    id: 'it-fud-2',
    cat: 'cat-fudud-macmacaan',
    name: 'Toasted Sandwich & Croissant',
    desc: 'Toasted sandwich kulul oo jiis leh iyo croissant faransiis ah.',
    price: 3.00,
    img: '/images/snacks.jpg',
    sizes: 'Caadi: $3.00',
    period: 'all'
  },
  {
    id: 'it-fud-3',
    cat: 'cat-fudud-macmacaan',
    name: 'Doolshe & Keeg Shokolaato',
    desc: 'Macmacaan jilicsan oo shokolaato iyo laban lagu carfiyey.',
    price: 2.50,
    img: '/images/snacks.jpg',
    sizes: 'Slice: $2.50',
    period: 'all'
  },

  // 7. Cabitaanno & Biyo (Drinks & Water ONLY)
  {
    id: 'it-cab-1',
    cat: 'cat-cabitaanno',
    name: 'Casiir Canbe Dabiici ah',
    desc: 'Casiir canbe cusub oo qabow oo la miiray maanta, sonkor la\'aan ama sonkor leh.',
    price: 2.00,
    img: '/images/drinks.jpg',
    sizes: 'Muraayad: $2.00 | Caag: $3.00',
    period: 'all'
  },
  {
    id: 'it-cab-2',
    cat: 'cat-cabitaanno',
    name: 'Casiir Liin Dhanaan & Reexaan',
    desc: 'Liin dhanaan qabow oo reexaan iyo baraf lagu carfiyey, aad u harraad-bixiya.',
    price: 1.50,
    img: '/images/drinks.jpg',
    sizes: 'Caadi: $1.50',
    period: 'all'
  },
  {
    id: 'it-cab-3',
    cat: 'cat-cabitaanno',
    name: 'Biyo Saafi ah (Mineral Water)',
    desc: 'Biyo qabow ama caadi ah oo dhalo xiran ku jira, nadaafad buuxda leh.',
    price: 0.50,
    img: '/images/drinks.jpg',
    sizes: 'Caag: $0.50',
    period: 'all'
  }
];

officialItems.forEach(item => {
  const exist = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(item.id);
  if (!exist) {
    db.prepare(`
      INSERT INTO menu_items (id, restaurant_id, category_id, name, description, price, image_url, portion_sizes, meal_periods, available)
      VALUES (?, 'misra-01', ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(item.id, item.cat, item.name, item.desc, item.price, item.img, item.sizes, item.period);
  } else {
    db.prepare(`
      UPDATE menu_items 
      SET category_id = ?, name = ?, description = ?, price = ?, image_url = ?, portion_sizes = ?, meal_periods = ?, available = 1
      WHERE id = ?
    `).run(item.cat, item.name, item.desc, item.price, item.img, item.sizes, item.period, item.id);
  }
});

// -------------------------------------------------------------
// EXPORTED REPOSITORY FUNCTIONS
// -------------------------------------------------------------
module.exports = {
  db,
  ADMIN_EMAIL,

  // 1. Authentication & Security
  authenticateAdmin(email, secret) {
    const normalizedEmail = (email || '').trim().toLowerCase();

    // STRICT CHECK: Only cabdilaahicawil881@gmail.com is authorized
    if (normalizedEmail !== ADMIN_EMAIL.toLowerCase()) {
      return { 
        success: false, 
        error: 'Koontadani ma haysto fasax maamulnimo (Unauthorized). Kaliya cabdilaahicawil881@gmail.com ayaa geli kara.' 
      };
    }

    const admin = db.prepare('SELECT * FROM admin_users WHERE email = ?').get(normalizedEmail);

    if (!admin) {
      return { success: false, error: 'Email ama PIN/Secret-ka waa khalad.' };
    }

    // Check rate-limiting / lockout
    if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
      const waitMin = Math.ceil((new Date(admin.locked_until) - new Date()) / 60000);
      return { 
        success: false, 
        error: `Koontadani waa xiran tahay muddo ${waitMin} daqiiqo ah sababo amni dartood. Fadlan dib u sug.` 
      };
    }

    const isValid = verifyPassword(secret, admin.password_hash, admin.salt);
    if (!isValid) {
      const attempts = (admin.failed_attempts || 0) + 1;
      let lockSql = '';
      let lockUntil = null;
      if (attempts >= 5) {
        lockUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins lock
      }
      db.prepare('UPDATE admin_users SET failed_attempts = ?, locked_until = ? WHERE id = ?')
        .run(attempts, lockUntil, admin.id);

      return { 
        success: false, 
        error: attempts >= 5 
          ? 'Isku-dayo khaldan oo badan. Koontada waxaa la xiray 15 daqiiqo.' 
          : 'Email ama PIN/Secret-ka waa khalad.' 
      };
    }

    // Reset failed attempts on success
    db.prepare('UPDATE admin_users SET failed_attempts = 0, locked_until = NULL WHERE id = ?').run(admin.id);

    // Create secure session token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    db.prepare('INSERT INTO admin_sessions (token, admin_id, email, expires_at) VALUES (?, ?, ?, ?)')
      .run(token, admin.id, admin.email, expiresAt);

    return {
      success: true,
      token,
      admin: { id: admin.id, email: admin.email, role: admin.role }
    };
  },

  verifyAdminSession(token) {
    if (!token) return null;
    const session = db.prepare(`
      SELECT s.*, a.role 
      FROM admin_sessions s
      JOIN admin_users a ON s.admin_id = a.id
      WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')
    `).get(token);

    if (!session || (session.email || '').toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return null;
    }
    return session;
  },

  destroyAdminSession(token) {
    if (!token) return;
    db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token);
  },

  changeAdminPassword(adminId, newSecret) {
    const { hash, salt } = hashPassword(newSecret);
    db.prepare('UPDATE admin_users SET password_hash = ?, salt = ?, failed_attempts = 0 WHERE id = ?')
      .run(hash, salt, adminId);
  },

  // 2. Restaurant Profile
  getRestaurant(id = 'misra-01') {
    return db.prepare('SELECT * FROM restaurants WHERE id = ?').get(id);
  },
  updateRestaurant(id, { name, tagline, phone, currency, qr_base_url, menu_open }) {
    return db.prepare(`
      UPDATE restaurants 
      SET name = COALESCE(?, name),
          tagline = COALESCE(?, tagline),
          phone = COALESCE(?, phone),
          currency = COALESCE(?, currency),
          qr_base_url = COALESCE(?, qr_base_url),
          menu_open = COALESCE(?, menu_open)
      WHERE id = ?
    `).run(name, tagline, phone, currency, qr_base_url, menu_open !== undefined ? (menu_open ? 1 : 0) : null, id);
  },

  // 3. Tables
  getTables(restaurant_id = 'misra-01') {
    return db.prepare('SELECT * FROM tables WHERE restaurant_id = ? ORDER BY table_number ASC').all(restaurant_id);
  },
  getTableByNumber(table_number, restaurant_id = 'misra-01') {
    return db.prepare('SELECT * FROM tables WHERE restaurant_id = ? AND table_number = ?').get(restaurant_id, table_number);
  },
  addTable({ id, restaurant_id = 'misra-01', table_number, label, active = 1 }) {
    return db.prepare(`
      INSERT INTO tables (id, restaurant_id, table_number, label, active)
      VALUES (?, ?, ?, ?, ?)
    `).run(id || `tbl-${Date.now()}`, restaurant_id, table_number, label || `Miis ${table_number}`, active ? 1 : 0);
  },
  updateTable(id, { table_number, label, active }) {
    return db.prepare(`
      UPDATE tables 
      SET table_number = COALESCE(?, table_number),
          label = COALESCE(?, label),
          active = COALESCE(?, active)
      WHERE id = ?
    `).run(table_number, label, active, id);
  },
  deleteTable(id) {
    return db.prepare('DELETE FROM tables WHERE id = ?').run(id);
  },

  // 4. Categories Management
  getCategories(restaurant_id = 'misra-01') {
    return db.prepare('SELECT * FROM categories WHERE restaurant_id = ? AND active = 1 ORDER BY sort_order ASC').all(restaurant_id);
  },
  getAllCategories(restaurant_id = 'misra-01') {
    return db.prepare('SELECT * FROM categories WHERE restaurant_id = ? ORDER BY sort_order ASC').all(restaurant_id);
  },
  addCategory({ id, restaurant_id = 'misra-01', name, sort_order = 0 }) {
    return db.prepare('INSERT INTO categories (id, restaurant_id, name, sort_order) VALUES (?, ?, ?, ?)')
      .run(id || `cat-${Date.now()}`, restaurant_id, name, sort_order);
  },
  updateCategory(id, { name, sort_order, active }) {
    return db.prepare(`
      UPDATE categories
      SET name = COALESCE(?, name),
          sort_order = COALESCE(?, sort_order),
          active = COALESCE(?, active)
      WHERE id = ?
    `).run(name, sort_order, active, id);
  },
  deleteCategory(id) {
    return db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  },

  // 5. Menu Items Management
  getMenuItems(restaurant_id = 'misra-01') {
    return db.prepare(`
      SELECT m.*, c.name as category_name 
      FROM menu_items m
      JOIN categories c ON m.category_id = c.id
      WHERE m.restaurant_id = ? AND c.active = 1
      ORDER BY c.sort_order ASC, m.name ASC
    `).all(restaurant_id);
  },
  getAllMenuItems(restaurant_id = 'misra-01') {
    return db.prepare(`
      SELECT m.*, c.name as category_name 
      FROM menu_items m
      LEFT JOIN categories c ON m.category_id = c.id
      WHERE m.restaurant_id = ?
      ORDER BY c.sort_order ASC, m.name ASC
    `).all(restaurant_id);
  },
  addMenuItem({ id, restaurant_id = 'misra-01', category_id, name, description, price, image_url, portion_sizes, meal_periods, available = 1 }) {
    return db.prepare(`
      INSERT INTO menu_items (id, restaurant_id, category_id, name, description, price, image_url, portion_sizes, meal_periods, available)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id || `item-${Date.now()}`,
      restaurant_id,
      category_id,
      name,
      description,
      Number(price),
      image_url || '/images/somali-coffee.jpg',
      portion_sizes || '',
      meal_periods || 'all',
      available ? 1 : 0
    );
  },
  updateMenuItem(id, { name, description, price, category_id, image_url, portion_sizes, meal_periods, available }) {
    return db.prepare(`
      UPDATE menu_items
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          price = COALESCE(?, price),
          category_id = COALESCE(?, category_id),
          image_url = COALESCE(?, image_url),
          portion_sizes = COALESCE(?, portion_sizes),
          meal_periods = COALESCE(?, meal_periods),
          available = COALESCE(?, available)
      WHERE id = ?
    `).run(
      name,
      description,
      price !== undefined ? Number(price) : null,
      category_id,
      image_url,
      portion_sizes,
      meal_periods,
      available !== undefined ? (available ? 1 : 0) : null,
      id
    );
  },
  deleteMenuItem(id) {
    return db.prepare('DELETE FROM menu_items WHERE id = ?').run(id);
  },

  // 6. Service Requests & Waiter Calls
  createServiceRequest({ id, restaurant_id = 'misra-01', table_number, request_type = 'waiter_call', items_json = null, note = '' }) {
    const reqId = id || `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    db.prepare(`
      INSERT INTO service_requests (id, restaurant_id, table_number, request_type, status, items_json, note)
      VALUES (?, ?, ?, ?, 'new', ?, ?)
    `).run(reqId, restaurant_id, table_number, request_type, items_json ? JSON.stringify(items_json) : null, note);
    return db.prepare('SELECT * FROM service_requests WHERE id = ?').get(reqId);
  },
  getServiceRequests(restaurant_id = 'misra-01', limit = 100) {
    return db.prepare(`
      SELECT * FROM service_requests 
      WHERE restaurant_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(restaurant_id, limit);
  },
  getActiveServiceRequests(restaurant_id = 'misra-01') {
    return db.prepare(`
      SELECT * FROM service_requests 
      WHERE restaurant_id = ? AND status IN ('new', 'acknowledged')
      ORDER BY created_at DESC
    `).all(restaurant_id);
  },
  updateRequestStatus(id, status) {
    const now = new Date().toISOString();
    if (status === 'acknowledged') {
      return db.prepare('UPDATE service_requests SET status = ?, acknowledged_at = ? WHERE id = ?').run(status, now, id);
    } else if (status === 'completed' || status === 'cancelled') {
      return db.prepare('UPDATE service_requests SET status = ?, completed_at = ? WHERE id = ?').run(status, now, id);
    } else {
      return db.prepare('UPDATE service_requests SET status = ? WHERE id = ?').run(status, id);
    }
  }
};
