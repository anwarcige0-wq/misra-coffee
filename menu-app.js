/**
 * MISRA COFFEE — Customer Digital Menu Client App
 * Simple, elegant, category-based browsing with clear prices and zero unwanted ordering triggers.
 */

let allMenuItems = [];
let allCategories = [];
let activeCategory = 'all';
let searchQuery = '';
let currentTableNumber = '';
let activeRequestId = null;
let statusCheckInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Extract table parameter from URL if provided by table QR code
  const params = new URLSearchParams(window.location.search);
  const tableParam = params.get('table');
  if (tableParam) {
    currentTableNumber = tableParam.trim();
    sessionStorage.setItem('misra_table', currentTableNumber);
    const input = document.getElementById('waiter-table-input');
    if (input) input.value = currentTableNumber;
  } else {
    const saved = sessionStorage.getItem('misra_table');
    if (saved) {
      currentTableNumber = saved;
      const input = document.getElementById('waiter-table-input');
      if (input) input.value = currentTableNumber;
    }
  }

  // Load menu data (Purely read-only; viewing never triggers any orders or notifications)
  await loadMenuData();

  // Resume status tracker only if customer explicitly initiated a call previously
  const savedReq = sessionStorage.getItem('misra_active_req');
  if (savedReq) {
    activeRequestId = savedReq;
    showStatusTracker(activeRequestId);
  }
});

// 1. Load Categories & Items from Backend Database
async function loadMenuData() {
  const container = document.getElementById('menu-items-container');
  try {
    const res = await fetch('/api/menu');
    const data = await res.json();

    if (data.success) {
      allCategories = data.categories || [];
      allMenuItems = data.items || [];
      renderCategoryTabs();
      renderMenuItems();
    } else {
      container.innerHTML = '<div class="empty-state">Khalad ayaa dhacay markii menu-ga la soo rarayey.</div>';
    }
  } catch (err) {
    console.error('Menu load error:', err);
    container.innerHTML = '<div class="empty-state">Lama xiriiri karo server-ka. Fadlan internetkaaga hubi.</div>';
  }
}

// 2. Render Category Navigation Tabs
function renderCategoryTabs() {
  const tabsContainer = document.getElementById('category-tabs');
  if (!tabsContainer) return;

  let html = `<button class="cat-btn ${activeCategory === 'all' ? 'active' : ''}" onclick="filterCategory('all')">Dhammaan (All)</button>`;
  allCategories.forEach(cat => {
    const isAct = activeCategory.toLowerCase() === cat.name.toLowerCase() || activeCategory === cat.id;
    html += `<button class="cat-btn ${isAct ? 'active' : ''}" onclick="filterCategory('${cat.name}')">${cat.name}</button>`;
  });
  tabsContainer.innerHTML = html;
}

// 3. Filter Category (Purely client-side browsing, NO waiter or order calls)
function filterCategory(catName) {
  activeCategory = catName;
  renderCategoryTabs();
  renderMenuItems();
}

function handleSearch(val) {
  searchQuery = val.trim();
  renderMenuItems();
}

// 4. Render Menu Items Grid with Strict Category Organization and Clear Prices
function renderMenuItems() {
  const container = document.getElementById('menu-items-container');
  if (!container) return;

  const filtered = allMenuItems.filter(item => {
    const matchCat = activeCategory === 'all' || 
      (item.category_name && item.category_name.toLowerCase() === activeCategory.toLowerCase()) ||
      item.category_id === activeCategory;

    const matchSearch = !searchQuery || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchCat && matchSearch;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="text-align:center;padding:40px 20px;grid-column:1/-1">
        <p style="color:var(--text-muted);font-size:16px;margin-bottom:14px">Wax cunto ama cabitaan ah lama helin qaybta aad dooratay.</p>
        <button class="btn btn-sm btn-secondary" onclick="filterCategory('all'); document.getElementById('menu-search').value=''; searchQuery=''; renderMenuItems();">
          Eeg Dhammaan Alaabta
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(item => {
    const isAvail = item.available === 1;
    const formattedPrice = Number(item.price).toFixed(2);

    return `
      <article class="menu-item-card ${!isAvail ? 'item-unavailable' : ''}">
        <div class="item-media">
          <img src="${item.image_url || '/images/somali-coffee.jpg'}" alt="${item.name}" loading="lazy" class="item-img">
          <span class="item-cat-tag">${item.category_name || ''}</span>
          ${!isAvail ? '<span class="item-stock-tag">Waa go’day</span>' : ''}
        </div>
        <div class="item-details">
          <div class="item-header-row" style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px">
            <h3 class="item-name" style="margin:0;font-size:18px;color:#FAF6F0">${item.name}</h3>
            <span class="product-price-tag">$${formattedPrice}</span>
          </div>
          <p class="item-desc" style="color:var(--text-muted);font-size:13.5px;line-height:1.5;margin-bottom:8px">${item.description || ''}</p>
          ${item.portion_sizes ? `<div style="font-size:12px;color:var(--gold);margin-top:auto">📏 ${item.portion_sizes}</div>` : ''}
        </div>
      </article>
    `;
  }).join('');
}

// 5. Explicit Waiter Call (Only triggered when customer intentionally clicks and confirms)
function openCallWaiterModal() {
  const modal = document.getElementById('waiter-modal');
  if (modal) {
    const input = document.getElementById('waiter-table-input');
    if (input && currentTableNumber) input.value = currentTableNumber;
    modal.showModal();
  }
}

async function confirmCallWaiter() {
  const input = document.getElementById('waiter-table-input');
  const tableVal = input ? input.value.trim() : '';

  if (!tableVal) {
    alert('Fadlan geli lambarka miiska aad fadhido.');
    if (input) input.focus();
    return;
  }

  currentTableNumber = tableVal;
  sessionStorage.setItem('misra_table', currentTableNumber);

  const btn = document.getElementById('modal-submit-waiter-btn');
  btn.disabled = true;
  btn.textContent = 'Waa la dirayaa…';

  try {
    const res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table_number: currentTableNumber,
        request_type: 'waiter_call'
      })
    });

    const data = await res.json();
    if (data.success) {
      activeRequestId = data.request.id;
      sessionStorage.setItem('misra_active_req', activeRequestId);
      document.getElementById('waiter-modal').close();
      showStatusTracker(activeRequestId, `Codsigaagii waa la helay! Adeegaha miiska ${currentTableNumber} ayaa kuugu imanaya.`);
      startStatusPolling(activeRequestId);
    } else {
      alert(data.error || 'Khalad ayaa dhacay. Fadlan mar kale isku day.');
    }
  } catch (err) {
    console.error('Call waiter error:', err);
    alert('Lama diri karin codsiga. Fadlan internetkaaga hubi.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Xaqiiji & U Yeedh';
  }
}

function showStatusTracker(reqId, customMsg) {
  const box = document.getElementById('waiter-status-box');
  if (!box) return;
  box.style.display = 'block';
  if (customMsg) {
    document.getElementById('req-status-msg').textContent = customMsg;
  }
  checkRequestStatus(reqId);
}

async function checkRequestStatus(reqId) {
  if (!reqId) return;
  try {
    const res = await fetch(`/api/requests/${reqId}`);
    const data = await res.json();
    if (data.success && data.request) {
      const r = data.request;
      const badge = document.getElementById('req-status-badge');
      const timeEl = document.getElementById('req-status-time');
      const msg = document.getElementById('req-status-msg');

      badge.className = `status-badge status-${r.status}`;
      
      if (r.status === 'new') {
        badge.textContent = 'Cusub (New)';
        msg.textContent = 'Codsigaagu wuxuu u muuqdaa shaqaalaha. Waiter ayaa goor dhow kugu soo socda.';
      } else if (r.status === 'acknowledged') {
        badge.textContent = 'Gacanta ayaa lagu hayaa';
        msg.textContent = '✅ Shaqaaluhu way arkeen codsigaaga, wayna kuugu soo socdaan miiskaaga!';
      } else if (r.status === 'completed') {
        badge.textContent = 'Waa la dhammeeyey';
        msg.textContent = 'Adeeggaaga waa la dhammeeyey. Ku raaxayso waqtigaaga MISRA COFFEE!';
        clearInterval(statusCheckInterval);
        sessionStorage.removeItem('misra_active_req');
      } else if (r.status === 'cancelled') {
        badge.textContent = 'La Joojiyey';
        msg.textContent = 'Codsigaan waa la joojiyey.';
        clearInterval(statusCheckInterval);
        sessionStorage.removeItem('misra_active_req');
      }

      const diffSec = Math.floor((Date.now() - new Date(r.created_at).getTime()) / 1000);
      timeEl.textContent = diffSec < 60 ? 'Hadda' : `${Math.floor(diffSec / 60)} daqiiqo ka hor`;
    }
  } catch (e) {
    console.error('Status check error:', e);
  }
}

function startStatusPolling(reqId) {
  if (statusCheckInterval) clearInterval(statusCheckInterval);
  statusCheckInterval = setInterval(() => {
    checkRequestStatus(reqId);
  }, 5000);
}
