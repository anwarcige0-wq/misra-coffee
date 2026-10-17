/**
 * MISRA COFFEE — Staff Dashboard Controller
 * Real-time monitoring, live sounds, request status management.
 */

let staffUser = null;
let currentFilter = 'all';
let allRequests = [];
let pollInterval = null;
let lastKnownRequestCount = 0;

// Web Audio API Chime Generator
function playChime() {
  const soundEnabled = document.getElementById('sound-checkbox')?.checked;
  if (!soundEnabled) return;

  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5

    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.6);
  } catch (e) {
    console.log('Audio chime not permitted without user gesture yet:', e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Check if session exists
  const saved = sessionStorage.getItem('misra_staff_auth');
  if (saved) {
    try {
      staffUser = JSON.parse(saved);
      initStaffApp();
    } catch (e) {}
  }
});

async function handleStaffLogin(e) {
  e.preventDefault();
  const pin = document.getElementById('staff-pin-input').value.trim();
  const errEl = document.getElementById('auth-error-msg');
  const btn = document.getElementById('btn-login-submit');

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

    if (data.success) {
      staffUser = data.user;
      sessionStorage.setItem('misra_staff_auth', JSON.stringify(staffUser));
      initStaffApp();
    } else {
      errEl.style.display = 'block';
      errEl.textContent = data.error || 'PIN-ka aad gelisay waa khalad.';
      document.getElementById('staff-pin-input').value = '';
    }
  } catch (err) {
    errEl.style.display = 'block';
    errEl.textContent = 'Khalad baa dhacay. Fadlan mar kale isku day.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Gal Dashboard-ka';
  }
}

function initStaffApp() {
  document.getElementById('staff-auth-modal').style.display = 'none';
  document.getElementById('staff-app-container').style.display = 'block';

  fetchStaffRequests();
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(fetchStaffRequests, 3500);
}

function logoutStaff() {
  sessionStorage.removeItem('misra_staff_auth');
  if (pollInterval) clearInterval(pollInterval);
  window.location.reload();
}

async function fetchStaffRequests() {
  try {
    const endpoint = currentFilter === 'completed' ? '/api/requests/all' : '/api/requests/active';
    const res = await fetch(endpoint);
    const data = await res.json();

    if (data.success) {
      allRequests = data.requests || [];
      
      // Check if new requests appeared to chime
      const newItemsCount = allRequests.filter(r => r.status === 'new').length;
      if (newItemsCount > lastKnownRequestCount) {
        playChime();
      }
      lastKnownRequestCount = newItemsCount;

      updateStatsCounters();
      renderRequestsGrid();
    }
  } catch (err) {
    console.error('Fetch staff requests error:', err);
  }
}

function updateStatsCounters() {
  const newCount = allRequests.filter(r => r.status === 'new').length;
  const ackCount = allRequests.filter(r => r.status === 'acknowledged').length;
  const doneCount = allRequests.filter(r => r.status === 'completed').length;

  document.getElementById('stat-count-new').textContent = newCount;
  document.getElementById('stat-count-ack').textContent = ackCount;
  document.getElementById('stat-count-done').textContent = doneCount;
  document.getElementById('tab-new-badge').textContent = newCount;
}

function setStaffFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.staff-tab').forEach(tab => {
    tab.classList.toggle('active', tab.textContent.toLowerCase().includes(filter) || (filter === 'all' && tab.textContent.includes('Dhammaan')));
  });
  fetchStaffRequests();
}

function renderRequestsGrid() {
  const container = document.getElementById('requests-container');

  const filtered = allRequests.filter(r => {
    if (currentFilter === 'all') return true;
    return r.status === currentFilter;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state-staff">
        <div class="empty-icon">☕</div>
        <h3>Hadda wax codsiyo ah ma jiraan</h3>
        <p>Dhammaan miisaska waa la xanaaneeyey ama codsiyo cusub ma soo dhicin.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(req => {
    const isNew = req.status === 'new';
    const isAck = req.status === 'acknowledged';
    const isDone = req.status === 'completed';
    const isCancel = req.status === 'cancelled';

    let itemsListHtml = '';
    if (req.items_json) {
      try {
        const items = typeof req.items_json === 'string' ? JSON.parse(req.items_json) : req.items_json;
        if (Array.isArray(items) && items.length > 0) {
          itemsListHtml = `
            <div class="req-items-box">
              <span class="req-items-title">Cuntooyinka La Xushay:</span>
              <ul class="req-items-list">
                ${items.map(it => `
                  <li><strong>${it.qty}×</strong> ${it.name} <span class="req-sub">$${Number(it.subtotal || (it.qty * it.price)).toFixed(2)}</span></li>
                `).join('')}
              </ul>
            </div>
          `;
        }
      } catch (e) {}
    }

    const timeAgo = getTimeAgo(req.created_at);

    return `
      <div class="request-card status-${req.status} ${isNew ? 'pulse-border' : ''}">
        <div class="req-card-header">
          <div class="req-table-box">
            <span class="req-table-badge">MIIS</span>
            <span class="req-table-num">${req.table_number}</span>
          </div>

          <div class="req-meta-box">
            <span class="req-type-pill ${req.request_type === 'food_selection' ? 'type-order' : 'type-call'}">
              ${req.request_type === 'food_selection' ? '🍽️ Xulasho Cunto' : '🔔 U Yeedhid Waiter'}
            </span>
            <span class="req-time-stamp">${timeAgo}</span>
          </div>
        </div>

        <div class="req-card-body">
          <div class="req-status-line">
            <span class="status-indicator-tag status-${req.status}">
              ${isNew ? '● Codsi Cusub (New)' : (isAck ? '✓ Gacanta Lagu Hayaa' : (isDone ? '✔ Waa La Dhameeyey' : '✕ La Joojiyey'))}
            </span>
          </div>

          ${itemsListHtml}
        </div>

        <div class="req-card-actions">
          ${isNew ? `
            <button class="btn btn-sm btn-primary" onclick="updateStatus('${req.id}', 'acknowledged')">
              ✓ Gacanta Qabo (Acknowledge)
            </button>
            <button class="btn btn-sm btn-secondary" onclick="updateStatus('${req.id}', 'completed')">
              ✔ Dhamee (Complete)
            </button>
          ` : (isAck ? `
            <button class="btn btn-sm btn-primary" onclick="updateStatus('${req.id}', 'completed')">
              ✔ Waa La Dhameeyey (Complete)
            </button>
            <button class="btn btn-sm btn-secondary" onclick="updateStatus('${req.id}', 'cancelled')">
              Jooji
            </button>
          ` : `
            <span class="done-note">${isDone ? 'Adeeggan waa la dhammeeyey' : 'Waa la joojiyey'}</span>
          `)}
        </div>
      </div>
    `;
  }).join('');
}

async function updateStatus(reqId, newStatus) {
  try {
    const res = await fetch(`/api/requests/${reqId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (data.success) {
      fetchStaffRequests();
    } else {
      alert(data.error || 'Khalad ayaa dhacay');
    }
  } catch (err) {
    console.error('Update status error:', err);
  }
}

function getTimeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 30) return 'Hadda';
  if (seconds < 60) return `${seconds}s ka hor`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} daqiiqo ka hor`;
  const hours = Math.floor(minutes / 60);
  return `${hours} saac ka hor`;
}
