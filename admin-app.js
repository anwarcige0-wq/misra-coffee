/**
 * MISRA COFFEE — Restaurant Admin Platform Controller
 * Tables Management, Real-time QR Card Generator, Menu CMS, Settings
 */

let adminUser = null;
let tablesList = [];
let categoriesList = [];
let menuList = [];
let restaurantProfile = {};
let qrBaseDomain = '';

document.addEventListener('DOMContentLoaded', () => {
  initAdminApp();
});

async function handleAdminLogin(e) {
  e.preventDefault();
  const pin = document.getElementById('admin-pin-input').value.trim();
  const errEl = document.getElementById('admin-error-msg');
  const btn = document.getElementById('btn-admin-submit');

  btn.disabled = true;
  btn.textContent = 'Hubinayaa…';
  errEl.style.display = 'none';

  try {
    const res = await fetch('/api/auth/pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin_code: pin })
    });
    const data = await res.json();

    if (data.success && data.user.role === 'admin') {
      adminUser = data.user;
      sessionStorage.setItem('misra_admin_auth', JSON.stringify(adminUser));
      initAdminApp();
    } else if (data.success && data.user.role !== 'admin') {
      errEl.style.display = 'block';
      errEl.textContent = 'Koontadani ma laha awoodda Maamulaha Guud (Admin).';
    } else {
      errEl.style.display = 'block';
      errEl.textContent = data.error || 'PIN-ka waa khalad.';
    }
  } catch (err) {
    errEl.style.display = 'block';
    errEl.textContent = 'Khalad baa dhacay. Fadlan hubi xiriirka.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Gal Maamulka';
  }
}

function initAdminApp() {
  document.getElementById('admin-auth-modal').style.display = 'none';
  document.getElementById('admin-app-container').style.display = 'block';

  loadRestaurantProfile();
  loadTables();
  loadMenuData();
}

function logoutAdmin() {
  sessionStorage.removeItem('misra_admin_auth');
  window.location.reload();
}

function switchAdminTab(tabName) {
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('onclick').includes(tabName));
  });
  document.querySelectorAll('.admin-tab-section').forEach(sec => {
    sec.classList.toggle('active', sec.id === `tab-${tabName}`);
  });

  if (tabName === 'requests') {
    loadRequestsHistory();
  }
}

// 1. Restaurant Profile & QR Domain Settings
async function loadRestaurantProfile() {
  try {
    const res = await fetch('/api/restaurant');
    const data = await res.json();
    if (data.success && data.restaurant) {
      restaurantProfile = data.restaurant;
      document.getElementById('admin-restaurant-name').textContent = `${restaurantProfile.name} — Maamulka Guud`;
      
      qrBaseDomain = restaurantProfile.qr_base_url || window.location.origin;
      document.getElementById('qr-base-domain').value = qrBaseDomain;

      // Fill settings form
      document.getElementById('set-res-name').value = restaurantProfile.name || '';
      document.getElementById('set-res-tagline').value = restaurantProfile.tagline || '';
      document.getElementById('set-res-phone').value = restaurantProfile.phone || '';
      document.getElementById('set-res-currency').value = restaurantProfile.currency || '$';
    }
  } catch (e) {
    console.error('Error loading restaurant profile:', e);
  }
}

async function saveQrBaseUrl() {
  const val = document.getElementById('qr-base-domain').value.trim();
  qrBaseDomain = val || window.location.origin;

  try {
    await fetch('/api/restaurant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qr_base_url: qrBaseDomain })
    });
    alert('Domain-ka QR-ka si guul leh ayaa loo kaydiyey!');
    generateQrCards();
  } catch (e) {
    alert('Khalad ayaa dhacay markii la kaydinayey.');
  }
}

async function saveRestaurantSettings(e) {
  e.preventDefault();
  const name = document.getElementById('set-res-name').value.trim();
  const tagline = document.getElementById('set-res-tagline').value.trim();
  const phone = document.getElementById('set-res-phone').value.trim();
  const currency = document.getElementById('set-res-currency').value.trim();

  try {
    const res = await fetch('/api/restaurant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, tagline, phone, currency })
    });
    const data = await res.json();
    if (data.success) {
      alert('Dejinta makhaayadda si guul leh ayaa loo cusboonaysiiyey!');
      loadRestaurantProfile();
    }
  } catch (err) {
    alert('Khalad ayaa dhacay.');
  }
}

// 2. Tables Management & QR Generation
async function loadTables() {
  try {
    const res = await fetch('/api/tables');
    const data = await res.json();
    if (data.success) {
      tablesList = data.tables || [];
      renderTablesTable();
      generateQrCards();
    }
  } catch (e) {
    console.error('Error loading tables:', e);
  }
}

function renderTablesTable() {
  const tbody = document.getElementById('tables-tbody');
  if (tablesList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Wali wax miisas ah lama gelin.</td></tr>';
    return;
  }

  tbody.innerHTML = tablesList.map(t => {
    const base = qrBaseDomain || window.location.origin;
    const menuUrl = `${base}/menu?table=${t.table_number}`;
    const isActive = t.active === 1;

    return `
      <tr>
        <td><strong>#${t.table_number}</strong></td>
        <td>${t.label || `Miis ${t.table_number}`}</td>
        <td>
          <span class="status-indicator-tag ${isActive ? 'status-completed' : 'status-cancelled'}">
            ${isActive ? 'Active (Shaqeynaya)' : 'Disabled (Xiran)'}
          </span>
        </td>
        <td>
          <a href="/menu?table=${t.table_number}" target="_blank" style="color:#C9A15D;text-decoration:underline">
            ${menuUrl}
          </a>
        </td>
        <td>
          <div class="action-btn-group">
            <button class="btn btn-sm btn-secondary" onclick="toggleTableActive('${t.id}', ${isActive ? 0 : 1})">
              ${isActive ? 'Dami' : 'Shid'}
            </button>
            <button class="btn btn-sm btn-secondary" onclick="openEditTableModal('${t.id}')">Wax ka beddel</button>
            <button class="btn btn-sm btn-danger" onclick="deleteTable('${t.id}')">Tir</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function generateQrCards() {
  const container = document.getElementById('printable-qr-grid');
  container.innerHTML = '';

  const activeTables = tablesList.filter(t => t.active === 1);
  if (activeTables.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted)">Ma jiraan miisas shaqeynaya oo loo samayn karo kaadhadhka QR.</p>';
    return;
  }

  activeTables.forEach(t => {
    const base = qrBaseDomain || window.location.origin;
    const targetUrl = `${base}/menu?table=${t.table_number}`;

    const card = document.createElement('div');
    card.className = 'qr-print-card';
    card.innerHTML = `
      <div class="qr-card-header">
        <svg class="qr-logo-icon" width="34" height="34" viewBox="0 0 40 40" fill="none" stroke="#C9A15D" stroke-width="1.8">
          <circle cx="20" cy="20" r="18"/>
          <path d="M11 18h14v5a6 6 0 0 1-6 6h-2a6 6 0 0 1-6-6z"/>
          <path d="M25 20h2.5a2.5 2.5 0 0 1 0 5H25"/>
          <path d="M15 10c-1.5 2 1.5 3 0 5"/>
          <path d="M20 10c-1.5 2 1.5 3 0 5"/>
        </svg>
        <div class="qr-brand-title">MISRA COFFEE</div>
      </div>
      <div class="qr-table-headline">${t.label || `MIISKA ${t.table_number}`}</div>
      <div class="qr-canvas-holder" id="qr-target-${t.id}"></div>
      <p class="qr-instruction">
        📱 <strong>Iskaan-garee Kaamiradaada:</strong><br>
        Si aad u aragto Menu-ga ama ugu yeedhato Waiter-ka.
      </p>
      <div class="qr-url-footer">${targetUrl}</div>
    `;

    container.appendChild(card);

    // Generate QR canvas
    const targetEl = card.querySelector(`#qr-target-${t.id}`);
    if (typeof QRCode !== 'undefined') {
      new QRCode(targetEl, {
        text: targetUrl,
        width: 160,
        height: 160,
        colorDark: '#2B1B16',
        colorLight: '#FFFFFF',
        correctLevel: QRCode.CorrectLevel.H
      });
    }
  });
}

function openAddTableModal() {
  document.getElementById('table-modal-title').textContent = 'Ku Dar Miis Cusub';
  document.getElementById('modal-table-id').value = '';
  document.getElementById('modal-table-number').value = '';
  document.getElementById('modal-table-label').value = '';
  document.getElementById('modal-table-active').checked = true;
  document.getElementById('table-dialog').showModal();
}

function openEditTableModal(tableId) {
  const table = tablesList.find(t => t.id === tableId);
  if (!table) return;

  document.getElementById('table-modal-title').textContent = `Wax Ka Beddel Miis ${table.table_number}`;
  document.getElementById('modal-table-id').value = table.id;
  document.getElementById('modal-table-number').value = table.table_number;
  document.getElementById('modal-table-label').value = table.label || '';
  document.getElementById('modal-table-active').checked = table.active === 1;
  document.getElementById('table-dialog').showModal();
}

async function saveTableModal(e) {
  e.preventDefault();
  const id = document.getElementById('modal-table-id').value;
  const table_number = document.getElementById('modal-table-number').value.trim();
  const label = document.getElementById('modal-table-label').value.trim();
  const active = document.getElementById('modal-table-active').checked ? 1 : 0;

  try {
    if (id) {
      await fetch(`/api/tables/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_number, label, active })
      });
    } else {
      await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_number, label, active })
      });
    }
    document.getElementById('table-dialog').close();
    loadTables();
  } catch (err) {
    alert('Khalad ayaa dhacay markii miiska la kaydinayey.');
  }
}

async function toggleTableActive(id, newActive) {
  try {
    await fetch(`/api/tables/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: newActive })
    });
    loadTables();
  } catch (e) {
    alert('Khalad ayaa dhacay.');
  }
}

async function deleteTable(id) {
  if (!confirm('Ma hubtaa inaad tirtirto miiskan?')) return;
  try {
    await fetch(`/api/tables/${id}`, { method: 'DELETE' });
    loadTables();
  } catch (e) {
    alert('Khalad ayaa dhacay.');
  }
}

// 3. Menu Management
async function loadMenuData() {
  try {
    const res = await fetch('/api/menu');
    const data = await res.json();
    if (data.success) {
      categoriesList = data.categories || [];
      menuList = data.items || [];
      renderMenuTable();
      populateCategorySelect();
    }
  } catch (e) {
    console.error('Error loading menu:', e);
  }
}

function populateCategorySelect() {
  const sel = document.getElementById('modal-item-cat');
  sel.innerHTML = categoriesList.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

function renderMenuTable() {
  const tbody = document.getElementById('menu-tbody');
  if (menuList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Wali wax alaab ah ma jiraan.</td></tr>';
    return;
  }

  tbody.innerHTML = menuList.map(it => {
    const isAvail = it.available === 1;
    return `
      <tr>
        <td><img src="${it.image_url || '/images/somali-coffee.jpg'}" style="width:44px;height:44px;object-fit:cover;border-radius:8px"></td>
        <td><strong>${it.name}</strong><br><small style="color:var(--text-muted)">${(it.description || '').slice(0, 50)}…</small></td>
        <td><span class="item-cat-tag">${it.category_name}</span></td>
        <td><strong>$${Number(it.price).toFixed(2)}</strong></td>
        <td>
          <button class="btn btn-sm ${isAvail ? 'btn-secondary' : 'btn-danger'}" onclick="toggleItemAvailable('${it.id}', ${isAvail ? 0 : 1})">
            ${isAvail ? '✓ Diyaar ah' : '✕ Waa go’day'}
          </button>
        </td>
        <td>
          <div class="action-btn-group">
            <button class="btn btn-sm btn-secondary" onclick="openEditItemModal('${it.id}')">Beddel</button>
            <button class="btn btn-sm btn-danger" onclick="deleteMenuItem('${it.id}')">Tir</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openAddItemModal() {
  document.getElementById('item-modal-title').textContent = 'Ku Dar Alaab Cusub';
  document.getElementById('modal-item-id').value = '';
  document.getElementById('modal-item-name').value = '';
  document.getElementById('modal-item-price').value = '';
  document.getElementById('modal-item-desc').value = '';
  document.getElementById('modal-item-img').value = '/images/somali-coffee.jpg';
  document.getElementById('modal-item-available').checked = true;
  document.getElementById('item-dialog').showModal();
}

function openEditItemModal(itemId) {
  const item = menuList.find(i => i.id === itemId);
  if (!item) return;

  document.getElementById('item-modal-title').textContent = `Wax Ka Beddel: ${item.name}`;
  document.getElementById('modal-item-id').value = item.id;
  document.getElementById('modal-item-name').value = item.name;
  document.getElementById('modal-item-cat').value = item.category_id;
  document.getElementById('modal-item-price').value = item.price;
  document.getElementById('modal-item-desc').value = item.description || '';
  document.getElementById('modal-item-img').value = item.image_url || '';
  document.getElementById('modal-item-available').checked = item.available === 1;
  document.getElementById('item-dialog').showModal();
}

async function saveItemModal(e) {
  e.preventDefault();
  const id = document.getElementById('modal-item-id').value;
  const name = document.getElementById('modal-item-name').value.trim();
  const category_id = document.getElementById('modal-item-cat').value;
  const price = document.getElementById('modal-item-price').value;
  const description = document.getElementById('modal-item-desc').value.trim();
  const image_url = document.getElementById('modal-item-img').value.trim();
  const available = document.getElementById('modal-item-available').checked ? 1 : 0;

  try {
    if (id) {
      await fetch(`/api/menu/items/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, category_id, price, description, image_url, available })
      });
    } else {
      await fetch('/api/menu/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, category_id, price, description, image_url, available })
      });
    }
    document.getElementById('item-dialog').close();
    loadMenuData();
  } catch (err) {
    alert('Khalad ayaa dhacay markii alaabta la kaydinayey.');
  }
}

async function toggleItemAvailable(id, newStatus) {
  try {
    await fetch(`/api/menu/items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ available: newStatus })
    });
    loadMenuData();
  } catch (e) {
    alert('Khalad ayaa dhacay.');
  }
}

async function deleteMenuItem(id) {
  if (!confirm('Ma hubtaa inaad tirtirto alaabtan?')) return;
  try {
    await fetch(`/api/menu/items/${id}`, { method: 'DELETE' });
    loadMenuData();
  } catch (e) {
    alert('Khalad ayaa dhacay.');
  }
}

// 4. Requests History
async function loadRequestsHistory() {
  const tbody = document.getElementById('requests-history-tbody');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Soo rarayaa…</td></tr>';

  try {
    const res = await fetch('/api/requests/all');
    const data = await res.json();
    if (data.success) {
      const list = data.requests || [];
      if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Taariikhda codsiyo ma jiraan.</td></tr>';
        return;
      }

      tbody.innerHTML = list.map(r => {
        let details = r.request_type === 'waiter_call' ? 'U Yeedhid Waiter' : 'Xulasho Cunto';
        if (r.items_json) {
          try {
            const parsed = typeof r.items_json === 'string' ? JSON.parse(r.items_json) : r.items_json;
            details = parsed.map(p => `${p.qty}× ${p.name}`).join(', ');
          } catch (e) {}
        }

        return `
          <tr>
            <td><small>${r.id.slice(-6).toUpperCase()}</small></td>
            <td><strong>Miis ${r.table_number}</strong></td>
            <td><span class="req-type-pill ${r.request_type === 'food_selection' ? 'type-order' : 'type-call'}">${r.request_type}</span></td>
            <td><small>${details}</small></td>
            <td><small>${new Date(r.created_at).toLocaleString()}</small></td>
            <td><span class="status-indicator-tag status-${r.status}">${r.status}</span></td>
          </tr>
        `;
      }).join('');
    }
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Khalad ayaa dhacay.</td></tr>';
  }
}
