/**
 * MISRA COFFEE — Private Administrator Dashboard Controller
 * Client logic for Menu CMS, Categories, Tables & QR, Waiter Requests, Settings & Security.
 */

let currentAdmin = null;
let tablesList = [];
let categoriesList = [];
let menuList = [];
let restaurantProfile = {};
let qrBaseDomain = '';

function getAuthHeaders() {
  const token = sessionStorage.getItem('misra_admin_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Verify Authentication
  try {
    const res = await fetch('/api/admin/me', { headers: getAuthHeaders() });
    const data = await res.json();
    if (!data.success || !data.admin) {
      window.location.href = '/admin/login';
      return;
    }
    currentAdmin = data.admin;
    document.getElementById('admin-email-text').textContent = currentAdmin.email;
  } catch (e) {
    window.location.href = '/admin/login';
    return;
  }

  // 2. Load All Data
  await loadRestaurantProfile();
  await loadCategories();
  await loadMenuData();
  await loadTables();
});

let requestsPollInterval = null;

function switchTab(tabName) {
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('onclick').includes(tabName));
  });
  document.querySelectorAll('.admin-tab-section').forEach(sec => {
    sec.classList.toggle('active', sec.id === `tab-${tabName}`);
  });

  if (tabName === 'requests') {
    loadRequestsHistory();
    if (!requestsPollInterval) {
      requestsPollInterval = setInterval(loadRequestsHistory, 5000);
    }
  } else if (tabName === 'qrcode') {
    renderRestaurantQrCode();
    if (requestsPollInterval) {
      clearInterval(requestsPollInterval);
      requestsPollInterval = null;
    }
  } else {
    if (requestsPollInterval) {
      clearInterval(requestsPollInterval);
      requestsPollInterval = null;
    }
  }
}

async function logoutAdmin() {
  try {
    await fetch('/api/admin/logout', { method: 'POST', headers: getAuthHeaders() });
  } catch (e) {}
  sessionStorage.removeItem('misra_admin_token');
  window.location.href = '/admin/login';
}

// -------------------------------------------------------------
// 1. RESTAURANT SETTINGS & SECURITY
// -------------------------------------------------------------
async function loadRestaurantProfile() {
  try {
    const res = await fetch('/api/restaurant');
    const data = await res.json();
    if (data.success && data.restaurant) {
      restaurantProfile = data.restaurant;
      document.getElementById('admin-header-title').textContent = `${restaurantProfile.name} — Maamulka Gaarka ah`;
      
      qrBaseDomain = restaurantProfile.qr_base_url || window.location.origin;
      document.getElementById('qr-base-domain').value = qrBaseDomain;

      document.getElementById('set-res-name').value = restaurantProfile.name || '';
      document.getElementById('set-res-tagline').value = restaurantProfile.tagline || '';
      document.getElementById('set-res-phone').value = restaurantProfile.phone || '';
      document.getElementById('set-res-currency').value = restaurantProfile.currency || '$';
      renderRestaurantQrCode();
    }
  } catch (e) {
    console.error('Error loading restaurant profile:', e);
  }
}

async function saveRestaurantSettings(e) {
  e.preventDefault();
  const name = document.getElementById('set-res-name').value.trim();
  const tagline = document.getElementById('set-res-tagline').value.trim();
  const phone = document.getElementById('set-res-phone').value.trim();
  const currency = document.getElementById('set-res-currency').value.trim();

  try {
    const res = await fetch('/api/admin/restaurant', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name, tagline, phone, currency })
    });
    const data = await res.json();
    if (data.success) {
      alert('Macluumaadka makhaayadda si guul leh ayaa loo cusboonaysiiyey!');
      loadRestaurantProfile();
    } else {
      alert(data.error || 'Khalad ayaa dhacay.');
    }
  } catch (err) {
    alert('Khalad ayaa dhacay.');
  }
}

async function changeAdminSecret(e) {
  e.preventDefault();
  const newSecret = document.getElementById('new-secret').value;
  const confirmSecret = document.getElementById('confirm-secret').value;
  const msgEl = document.getElementById('change-pass-msg');

  if (newSecret !== confirmSecret) {
    msgEl.style.display = 'block';
    msgEl.style.background = 'rgba(231,76,60,0.15)';
    msgEl.style.color = '#ff9d9d';
    msgEl.textContent = 'Furayaasha cusub isma leha. Fadlan hubi.';
    return;
  }

  try {
    const res = await fetch('/api/admin/change-password', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ new_secret: newSecret })
    });
    const data = await res.json();

    msgEl.style.display = 'block';
    if (data.success) {
      msgEl.style.background = 'rgba(46,204,113,0.15)';
      msgEl.style.color = '#2ecc71';
      msgEl.textContent = '✅ Furaha maamulaha si guul leh ayaa loo beddelay!';
      document.getElementById('new-secret').value = '';
      document.getElementById('confirm-secret').value = '';
    } else {
      msgEl.style.background = 'rgba(231,76,60,0.15)';
      msgEl.style.color = '#ff9d9d';
      msgEl.textContent = data.error || 'Lama beddelin furaha.';
    }
  } catch (err) {
    msgEl.style.display = 'block';
    msgEl.textContent = 'Khalad baa dhacay.';
  }
}

// -------------------------------------------------------------
// 2. CATEGORIES MANAGEMENT
// -------------------------------------------------------------
async function loadCategories() {
  try {
    const res = await fetch('/api/admin/categories', { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.success) {
      categoriesList = data.categories || [];
      renderCategoriesTable();
      populateCategorySelects();
    }
  } catch (e) {
    console.error('Error loading categories:', e);
  }
}

function populateCategorySelects() {
  const itemCatSelect = document.getElementById('modal-item-cat');
  const filterCatSelect = document.getElementById('filter-admin-cat');

  itemCatSelect.innerHTML = categoriesList.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  
  filterCatSelect.innerHTML = '<option value="all">Dhammaan Qaybaha (All Categories)</option>' +
    categoriesList.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
}

function renderCategoriesTable() {
  const tbody = document.getElementById('categories-tbody');
  tbody.innerHTML = categoriesList.map(c => `
    <tr>
      <td><strong>#${c.sort_order}</strong></td>
      <td><strong>${c.name}</strong></td>
      <td>
        <span class="status-indicator-tag ${c.active ? 'status-completed' : 'status-cancelled'}">
          ${c.active ? 'Active' : 'Disabled'}
        </span>
      </td>
      <td>
        <div class="action-btn-group">
          <button class="btn btn-sm btn-secondary" onclick="openEditCategoryModal('${c.id}')">Beddel</button>
          <button class="btn btn-sm btn-danger" onclick="deleteCategory('${c.id}')">Tir</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openAddCategoryModal() {
  document.getElementById('category-modal-title').textContent = 'Ku Dar Qayb Cusub';
  document.getElementById('modal-cat-id').value = '';
  document.getElementById('modal-cat-name').value = '';
  document.getElementById('modal-cat-order').value = (categoriesList.length + 1) * 10;
  document.getElementById('category-dialog').showModal();
}

function openEditCategoryModal(id) {
  const c = categoriesList.find(x => x.id === id);
  if (!c) return;
  document.getElementById('category-modal-title').textContent = `Wax Ka Beddel: ${c.name}`;
  document.getElementById('modal-cat-id').value = c.id;
  document.getElementById('modal-cat-name').value = c.name;
  document.getElementById('modal-cat-order').value = c.sort_order;
  document.getElementById('category-dialog').showModal();
}

async function saveCategoryModal(e) {
  e.preventDefault();
  const id = document.getElementById('modal-cat-id').value;
  const name = document.getElementById('modal-cat-name').value.trim();
  const sort_order = parseInt(document.getElementById('modal-cat-order').value) || 0;

  try {
    if (id) {
      await fetch(`/api/admin/categories/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name, sort_order })
      });
    } else {
      await fetch('/api/admin/categories', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name, sort_order })
      });
    }
    document.getElementById('category-dialog').close();
    await loadCategories();
  } catch (err) {
    alert('Khalad ayaa dhacay.');
  }
}

async function deleteCategory(id) {
  if (!confirm('Ma hubtaa inaad tirtirto qaybtan?')) return;
  try {
    await fetch(`/api/admin/categories/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
    await loadCategories();
  } catch (e) {
    alert('Khalad ayaa dhacay.');
  }
}

// -------------------------------------------------------------
// 3. MENU ITEMS CMS
// -------------------------------------------------------------
async function loadMenuData() {
  try {
    const res = await fetch('/api/admin/menu/items', { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.success) {
      menuList = data.items || [];
      renderMenuTable();
    }
  } catch (e) {
    console.error('Error loading menu:', e);
  }
}

function renderMenuTable() {
  const tbody = document.getElementById('menu-tbody');
  const catFilter = document.getElementById('filter-admin-cat').value;
  const periodFilter = document.getElementById('filter-admin-period').value;

  const filtered = menuList.filter(it => {
    const matchCat = catFilter === 'all' || it.category_name === catFilter;
    const matchPeriod = periodFilter === 'all' || (it.meal_periods || 'all').includes(periodFilter) || (it.meal_periods === 'all');
    return matchCat && matchPeriod;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center">Wax cunto ah lama helin qaybta aad dooratay.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(it => {
    const isAvail = it.available === 1;
    const periodLabel = it.meal_periods === 'breakfast' ? 'Quraac' : (it.meal_periods === 'lunch' ? 'Qado' : (it.meal_periods === 'dinner' ? 'Casho' : 'Dhammaan'));

    return `
      <tr>
        <td><img src="${it.image_url || '/images/somali-coffee.jpg'}" style="width:44px;height:44px;object-fit:cover;border-radius:8px"></td>
        <td>
          <strong>${it.name}</strong><br>
          <small style="color:var(--text-muted)">${(it.description || '').slice(0, 45)}…</small>
        </td>
        <td><span class="item-cat-tag">${it.category_name}</span></td>
        <td><small style="color:var(--gold);font-weight:600">${periodLabel}</small></td>
        <td><small>${it.portion_sizes || 'Caadi'}</small></td>
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

function previewModalImage(url) {
  const preview = document.getElementById('modal-img-preview');
  if (preview) {
    preview.src = url || '/images/somali-coffee.jpg';
  }
}

function setModalImage(url) {
  document.getElementById('modal-item-img').value = url;
  previewModalImage(url);
}

async function handleImageFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    alert('Fadlan xulo sawir ka yar 5MB.');
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const res = await fetch('/api/admin/upload-image', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          image_data: reader.result,
          filename: file.name
        })
      });
      const data = await res.json();
      if (data.success && data.url) {
        setModalImage(data.url);
      } else {
        alert(data.error || 'Sawirka lama gelin karin.');
      }
    } catch (err) {
      alert('Khalad ayaa dhacay markii sawirka la galinayey.');
    }
  };
  reader.readAsDataURL(file);
}

function openAddItemModal() {
  document.getElementById('item-modal-title').textContent = 'Ku Dar Cunto / Cabitaan Cusub';
  document.getElementById('modal-item-id').value = '';
  document.getElementById('modal-item-name').value = '';
  document.getElementById('modal-item-price').value = '';
  document.getElementById('modal-item-sizes').value = '';
  document.getElementById('modal-item-period').value = 'all';
  document.getElementById('modal-item-desc').value = '';
  document.getElementById('modal-item-img').value = '/images/somali-coffee.jpg';
  previewModalImage('/images/somali-coffee.jpg');
  document.getElementById('modal-item-available').checked = true;
  document.getElementById('item-dialog').showModal();
}

function openEditItemModal(itemId) {
  const it = menuList.find(i => i.id === itemId);
  if (!it) return;

  document.getElementById('item-modal-title').textContent = `Wax Ka Beddel: ${it.name}`;
  document.getElementById('modal-item-id').value = it.id;
  document.getElementById('modal-item-name').value = it.name;
  document.getElementById('modal-item-cat').value = it.category_id;
  document.getElementById('modal-item-price').value = it.price;
  document.getElementById('modal-item-sizes').value = it.portion_sizes || '';
  document.getElementById('modal-item-period').value = it.meal_periods || 'all';
  document.getElementById('modal-item-desc').value = it.description || '';
  document.getElementById('modal-item-img').value = it.image_url || '';
  previewModalImage(it.image_url || '/images/somali-coffee.jpg');
  document.getElementById('modal-item-available').checked = it.available === 1;
  document.getElementById('item-dialog').showModal();
}

async function saveItemModal(e) {
  e.preventDefault();
  const id = document.getElementById('modal-item-id').value;
  const name = document.getElementById('modal-item-name').value.trim();
  const category_id = document.getElementById('modal-item-cat').value;
  const price = document.getElementById('modal-item-price').value;
  const portion_sizes = document.getElementById('modal-item-sizes').value.trim();
  const meal_periods = document.getElementById('modal-item-period').value;
  const description = document.getElementById('modal-item-desc').value.trim();
  const image_url = document.getElementById('modal-item-img').value.trim();
  const available = document.getElementById('modal-item-available').checked ? 1 : 0;

  try {
    if (id) {
      await fetch(`/api/admin/menu/items/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name, category_id, price, portion_sizes, meal_periods, description, image_url, available })
      });
    } else {
      await fetch('/api/admin/menu/items', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name, category_id, price, portion_sizes, meal_periods, description, image_url, available })
      });
    }
    document.getElementById('item-dialog').close();
    await loadMenuData();
  } catch (err) {
    alert('Khalad ayaa dhacay markii alaabta la kaydinayey.');
  }
}

async function toggleItemAvailable(id, newStatus) {
  try {
    await fetch(`/api/admin/menu/items/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ available: newStatus })
    });
    await loadMenuData();
  } catch (e) {
    alert('Khalad ayaa dhacay.');
  }
}

async function deleteMenuItem(id) {
  if (!confirm('Ma hubtaa inaad tirtirto alaabtan?')) return;
  try {
    await fetch(`/api/admin/menu/items/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
    await loadMenuData();
  } catch (e) {
    alert('Khalad ayaa dhacay.');
  }
}

// -------------------------------------------------------------
// 4. WAITER SERVICE REQUESTS HISTORY & LIVE ACTIONS
// -------------------------------------------------------------
async function loadRequestsHistory() {
  const tbody = document.getElementById('requests-history-tbody');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center">Soo rarayaa…</td></tr>';

  try {
    const res = await fetch('/api/admin/requests/all', { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.success) {
      const list = data.requests || [];
      if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center">Taariikhda codsiyo ma jiraan.</td></tr>';
        return;
      }

      tbody.innerHTML = list.map(r => {
        let details = r.request_type === 'waiter_call' ? '🔔 U Yeedhid Waiter' : '🍽️ Xulasho Cunto';
        if (r.items_json) {
          try {
            const parsed = typeof r.items_json === 'string' ? JSON.parse(r.items_json) : r.items_json;
            details = parsed.map(p => `${p.qty}× ${p.name}`).join(', ');
          } catch (e) {}
        }

        const isNewOrPending = r.status === 'new' || r.status === 'pending';
        const isAck = r.status === 'acknowledged';
        const isDone = r.status === 'completed';

        const statusLabel = isNewOrPending 
          ? 'Pending (Sugaya)' 
          : (isAck ? 'Acknowledged (Lagu Hayaa)' : 'Completed (Dhammaystiran)');

        return `
          <tr>
            <td><small>${r.id.slice(-6).toUpperCase()}</small></td>
            <td><strong>Miis ${r.table_number}</strong></td>
            <td><span class="req-type-pill ${r.request_type === 'food_selection' ? 'type-order' : 'type-call'}">${r.request_type === 'food_selection' ? 'Xulasho Cunto' : 'U Yeedh Waiter'}</span></td>
            <td><small>${details}</small></td>
            <td><small>${new Date(r.created_at).toLocaleTimeString()} (${new Date(r.created_at).toLocaleDateString()})</small></td>
            <td><span class="status-indicator-tag status-${r.status}">${statusLabel}</span></td>
            <td>
              <div class="action-btn-group">
                ${isNewOrPending ? `
                  <button class="btn btn-sm btn-primary" onclick="updateReqStatus('${r.id}', 'acknowledged')" title="Aqbal codsiga">Acknowledge</button>
                  <button class="btn btn-sm btn-secondary" onclick="updateReqStatus('${r.id}', 'completed')" title="Dhammee">Complete</button>
                ` : (isAck ? `
                  <button class="btn btn-sm btn-secondary" onclick="updateReqStatus('${r.id}', 'pending')" title="Dib ugu celi Pending">Pending</button>
                  <button class="btn btn-sm btn-primary" onclick="updateReqStatus('${r.id}', 'completed')" title="Dhammee">Complete</button>
                ` : `
                  <button class="btn btn-sm btn-secondary" onclick="updateReqStatus('${r.id}', 'pending')" title="Dib u fur">Dib u Fur</button>
                `)}
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center">Khalad ayaa dhacay.</td></tr>';
  }
}

async function updateReqStatus(id, status) {
  try {
    await fetch(`/api/requests/${id}/status`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status })
    });
    loadRequestsHistory();
  } catch (e) {}
}

// -------------------------------------------------------------
// 5. TABLES & QR CODE GENERATOR
// -------------------------------------------------------------
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
            ${isActive ? 'Active' : 'Disabled'}
          </span>
        </td>
        <td><a href="/menu?table=${t.table_number}" target="_blank" style="color:#C9A15D">${menuUrl}</a></td>
        <td>
          <div class="action-btn-group">
            <button class="btn btn-sm btn-secondary" onclick="toggleTableActive('${t.id}', ${isActive ? 0 : 1})">
              ${isActive ? 'Dami' : 'Shid'}
            </button>
            <button class="btn btn-sm btn-secondary" onclick="openEditTableModal('${t.id}')">Beddel</button>
            <button class="btn btn-sm btn-danger" onclick="deleteTable('${t.id}')">Tir</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function generateQrCards() {
  const base = qrBaseDomain || window.location.origin;

  // 1. Generate Single General QR Code for All Tables
  const singleContainer = document.getElementById('single-qr-container');
  const singleUrlText = document.getElementById('single-qr-url');
  const singleUrl = `${base}/menu`;
  if (singleContainer) {
    singleContainer.innerHTML = '';
    if (typeof QRCode !== 'undefined') {
      new QRCode(singleContainer, {
        text: singleUrl,
        width: 140,
        height: 140,
        colorDark: '#2B1B16',
        colorLight: '#FFFFFF',
        correctLevel: QRCode.CorrectLevel.H
      });
    }
  }
  if (singleUrlText) {
    singleUrlText.textContent = singleUrl;
  }

  // 2. Generate Individual Table QR Cards
  const container = document.getElementById('printable-qr-grid');
  container.innerHTML = '';

  const activeTables = tablesList.filter(t => t.active === 1);
  activeTables.forEach(t => {
    const targetUrl = `${base}/menu?table=${t.table_number}`;

    const card = document.createElement('div');
    card.className = 'qr-print-card';
    card.innerHTML = `
      <div class="qr-card-header">
        <svg width="34" height="34" viewBox="0 0 40 40" fill="none" stroke="#C9A15D" stroke-width="1.8">
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

// -------------------------------------------------------------
// RESTAURANT QR CODE MANAGEMENT & DOWNLOAD (Requirement 3)
// -------------------------------------------------------------
function renderRestaurantQrCode() {
  const base = qrBaseDomain || window.location.origin;
  const menuUrl = `${base}/menu`;

  const box = document.getElementById('restaurant-qr-box');
  const destEl = document.getElementById('restaurant-qr-dest-url');
  const testLink = document.getElementById('btn-test-qr-link');
  const customDomainInput = document.getElementById('admin-qr-custom-domain');

  if (destEl) destEl.textContent = menuUrl;
  if (testLink) testLink.href = menuUrl;
  if (customDomainInput && !customDomainInput.value) {
    customDomainInput.value = qrBaseDomain || window.location.origin;
  }

  if (box) {
    box.innerHTML = '';
    if (typeof QRCode !== 'undefined') {
      new QRCode(box, {
        text: menuUrl,
        width: 220,
        height: 220,
        colorDark: '#2B1B16',
        colorLight: '#FFFFFF',
        correctLevel: QRCode.CorrectLevel.H
      });
    }
  }
}

function downloadRestaurantQrCode() {
  const box = document.getElementById('restaurant-qr-box');
  if (!box) return;

  const canvas = box.querySelector('canvas');
  let dataUrl;
  if (canvas) {
    dataUrl = canvas.toDataURL('image/png');
  } else {
    const img = box.querySelector('img');
    if (img) dataUrl = img.src;
  }

  if (!dataUrl) {
    alert('QR Code-ka lama helin ama wali ma dhammays tirmin soo saaristiisu.');
    return;
  }

  const link = document.createElement('a');
  link.download = 'misra-coffee-qr-menu.png';
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function printRestaurantQrCard() {
  const base = qrBaseDomain || window.location.origin;
  const targetUrl = `${base}/menu`;
  const printWin = window.open('', '_blank');
  printWin.document.write(`
    <!DOCTYPE html>
    <html lang="so">
    <head>
      <meta charset="utf-8">
      <title>MISRA COFFEE — Kaadhka QR-ka Menu-ga</title>
      <link rel="stylesheet" href="/style.css">
      <link rel="stylesheet" href="/qr-platform.css">
      <style>
        body { background:#FAF6F0; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; padding:20px; font-family:'Plus Jakarta Sans',sans-serif; }
        .qr-print-card-single { background:#fff; border:3px solid #C9A15D; padding:40px; border-radius:20px; text-align:center; max-width:440px; box-shadow:0 10px 30px rgba(0,0,0,0.1); }
      </style>
    </head>
    <body>
      <div class="qr-print-card-single">
        <h1 style="font-family:'Cormorant Garamond',serif;font-size:36px;color:#2B1B16;margin:0 0 4px 0">MISRA COFFEE</h1>
        <p style="font-size:14px;color:#7A6B63;margin:0 0 16px 0">Dhadhan Aan La Ilaawi Karin</p>
        <div style="font-size:18px;font-weight:700;color:#C9A15D;margin-bottom:16px;letter-spacing:1px">DIGITAL CUSTOMER MENU</div>
        <div id="print-qr-code" style="display:inline-block;padding:12px;background:#fff;border:1px solid #E5D5BC;border-radius:12px"></div>
        <p style="margin-top:20px;font-size:15px;color:#2B1B16;line-height:1.5">
          📱 <strong>Iskaan-garee Kaamiradaada:</strong><br>
          Fadlan eeg menu-ga oo dooro waxa aad rabto inta uu adeeguhu kuu imanayo.
        </p>
        <p style="font-family:monospace;font-size:12px;color:#7A6B63;margin-top:14px;word-break:break-all">${targetUrl}</p>
      </div>
      <script src="/qrcode.min.js"><\/script>
      <script>
        new QRCode(document.getElementById('print-qr-code'), {
          text: "${targetUrl}",
          width: 220,
          height: 220,
          colorDark: '#2B1B16',
          colorLight: '#FFFFFF',
          correctLevel: QRCode.CorrectLevel.H
        });
        setTimeout(() => { window.print(); }, 400);
      <\/script>
    </body>
    </html>
  `);
  printWin.document.close();
}

async function saveCustomQrDomain() {
  const input = document.getElementById('admin-qr-custom-domain');
  if (!input) return;
  const val = input.value.trim();
  qrBaseDomain = val || window.location.origin;

  try {
    await fetch('/api/admin/restaurant', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ qr_base_url: qrBaseDomain })
    });
    alert('Domain-ka cusub ee QR-ka si guul leh ayaa loo kaydiyey!');
    renderRestaurantQrCode();
    generateQrCards();
  } catch (e) {
    alert('Khalad ayaa dhacay markii domain-ka la kaydinayey.');
  }
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
      await fetch(`/api/admin/tables/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ table_number, label, active })
      });
    } else {
      await fetch('/api/admin/tables', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ table_number, label, active })
      });
    }
    document.getElementById('table-dialog').close();
    await loadTables();
  } catch (err) {
    alert('Khalad ayaa dhacay.');
  }
}

async function toggleTableActive(id, newActive) {
  try {
    await fetch(`/api/admin/tables/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ active: newActive })
    });
    await loadTables();
  } catch (e) {
    alert('Khalad ayaa dhacay.');
  }
}

async function deleteTable(id) {
  if (!confirm('Ma hubtaa inaad tirtirto miiskan?')) return;
  try {
    await fetch(`/api/admin/tables/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
    await loadTables();
  } catch (e) {
    alert('Khalad ayaa dhacay.');
  }
}

async function saveQrBaseUrl() {
  const val = document.getElementById('qr-base-domain').value.trim();
  qrBaseDomain = val || window.location.origin;

  try {
    await fetch('/api/admin/restaurant', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ qr_base_url: qrBaseDomain })
    });
    alert('Domain-ka QR-ka si guul leh ayaa loo kaydiyey!');
    generateQrCards();
  } catch (e) {
    alert('Khalad ayaa dhacay.');
  }
}
