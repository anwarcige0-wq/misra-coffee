/**
 * MISRA COFFEE — Modern Web Application Client Enhancer
 * - PWA Service Worker Registration & Real Installation Engine
 * - Native Toast Notification Engine
 * - Mobile App Bottom Navigation Bar
 * - Native App Installation (Android, iOS, Windows, Mac)
 */

(function () {
  'use strict';

  // 1. Service Worker Registration
  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.log('SW registration note:', err);
      });
    });
  }

  // 2. Global Toast Notification System
  window.showToast = function (message, type = 'info', duration = 3500) {
    let container = document.getElementById('app-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'app-toast-container';
      container.className = 'app-toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `app-toast toast-${type}`;
    
    let icon = '☕';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-msg">${message}</span>
      <button class="toast-close" onclick="this.parentElement.remove()" aria-label="Close">✕</button>
    `;

    container.appendChild(toast);

    // Auto remove
    setTimeout(() => {
      toast.classList.add('toast-fade-out');
      setTimeout(() => {
        if (toast.parentElement) toast.remove();
      }, 300);
    }, duration);
  };

  // 3. Render Modern Mobile Bottom App Bar
  function initMobileBottomBar() {
    if (document.querySelector('.mobile-bottom-bar')) return;

    const currentPath = window.location.pathname.toLowerCase();
    const bar = document.createElement('nav');
    bar.className = 'mobile-bottom-bar';
    bar.setAttribute('aria-label', 'Mobile App Navigation');

    const links = [
      { href: '/', label: 'Home', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' },
      { href: '/menu', label: 'Menu', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>' },
      { href: 'javascript:window.triggerInstallApp()', label: 'Ku Shubo', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/><polyline points="9 11 12 14 15 11"/><line x1="12" y1="6" x2="12" y2="14"/></svg>' },
      { href: '/services', label: 'Services', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>' },
      { href: '/admin/login', label: 'Admin', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' }
    ];

    bar.innerHTML = links.map(item => {
      const isActive = (item.href === '/' && (currentPath === '/' || currentPath.endsWith('index.html'))) ||
                       (item.href !== '/' && !item.href.startsWith('javascript') && currentPath.includes(item.href));
      return `
        <a href="${item.href}" class="bottom-bar-item ${isActive ? 'active' : ''}">
          <div class="bottom-bar-icon">${item.icon}</div>
          <span class="bottom-bar-label">${item.label}</span>
        </a>
      `;
    }).join('');

    document.body.appendChild(bar);
  }

  // 4. Install App PWA Engine (Android, iOS, Windows, Mac)
  let deferredPrompt = null;

  function isAppInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  // Native Android/Chrome event when app successfully completes installation
  window.addEventListener('appinstalled', () => {
    console.log('MISRA COFFEE App was installed successfully!');
    deferredPrompt = null;
    const banner = document.getElementById('pwa-install-banner');
    if (banner) banner.remove();
    const modal = document.getElementById('pwa-install-modal');
    if (modal) modal.remove();
    window.showToast('✅ MISRA COFFEE App si buuxda ayaa loogu shubay taleefankaaga!', 'success', 6000);
  });

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log('beforeinstallprompt ready');

    if (!isAppInstalled()) {
      renderInstallBanner();
    }
  });

  function renderInstallBanner() {
    if (document.getElementById('pwa-install-banner') || isAppInstalled()) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.className = 'pwa-install-banner';
    banner.innerHTML = `
      <div class="pwa-banner-inner">
        <img src="/images/app-icon-192.png" width="44" height="44" alt="MISRA COFFEE App" style="border-radius:10px;object-fit:cover;flex-shrink:0">
        <div style="flex:1">
          <strong style="color:#FAF6F0;font-size:13.5px;display:block">Ku shubo MISRA COFFEE App</strong>
          <small style="color:var(--text-muted);font-size:11.5px">Ku dar apps-kaaga caadiga ah ee taleefanka</small>
        </div>
        <button class="btn btn-sm btn-primary" onclick="window.triggerInstallApp()" id="btn-install-pwa" style="white-space:nowrap;padding:7px 14px;font-size:13px">📱 Ku Shubo</button>
        <button class="btn-close-banner" onclick="dismissPwaBanner()" aria-label="Xir">✕</button>
      </div>
    `;
    document.body.appendChild(banner);
  }

  window.triggerInstallApp = function () {
    if (isAppInstalled()) {
      window.showToast('App-ku mar hore ayuu kuugu rakibnaa taleefanka!', 'info', 4000);
      return;
    }

    if (deferredPrompt) {
      // Trigger official native Android/Chromium install sheet
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          window.showToast('App-ka waa la soo degsanayaa, fadlan sug daqiiqad…', 'info', 4000);
        }
        deferredPrompt = null;
      });
      return;
    }

    // If deferredPrompt is not yet triggered by browser, show custom guide modal
    openPwaGuideModal();
  };

  function openPwaGuideModal() {
    let modal = document.getElementById('pwa-install-modal');
    if (modal) modal.remove();

    const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());

    modal = document.createElement('div');
    modal.id = 'pwa-install-modal';
    modal.className = 'pwa-modal-overlay';
    modal.onclick = function (e) {
      if (e.target === modal) modal.remove();
    };

    modal.innerHTML = `
      <div class="pwa-modal-box">
        <div class="pwa-modal-header">
          <img src="/images/app-icon-192.png" width="54" height="54" alt="MISRA COFFEE App" style="border-radius:12px;box-shadow:0 4px 14px rgba(0,0,0,0.5)">
          <div>
            <h3 style="color:#FAF6F0;margin:0 0 3px 0;font-size:18px">Ku Shubo MISRA COFFEE</h3>
            <p style="color:var(--gold);font-size:12px;margin:0">App Rasmi ah oo Mobile ah</p>
          </div>
        </div>
        
        <div class="pwa-modal-body" style="margin:16px 0">
          ${isIos ? `
            <div class="pwa-step">
              <span class="pwa-step-num">1</span>
              <div>Ku dhufo batoonka <strong>Share (La-wadaag)</strong> ee hoose <span style="font-size:16px">📤</span>.</div>
            </div>
            <div class="pwa-step">
              <span class="pwa-step-num">2</span>
              <div>Hoos u deg oo dooro <strong>"Add to Home Screen"</strong> (Ku dar Shaashadda Hore).</div>
            </div>
          ` : `
            <div class="pwa-step">
              <span class="pwa-step-num">1</span>
              <div>Ku dhufo <strong>3-da dhibcood (⋮)</strong> ee ku yaalla geeska sare ee browser-kaaga (Chrome).</div>
            </div>
            <div class="pwa-step">
              <span class="pwa-step-num">2</span>
              <div>Liiska ka dooro <strong>"Install app"</strong> ama <strong>"Add to Home screen"</strong> (Ku dar Shaashadda Hore).</div>
            </div>
            <div class="pwa-step">
              <span class="pwa-step-num">3</span>
              <div>Ku dhufo <strong>"Install"</strong>, toos ayuu ugu soo dhacayaa shaashaddaada caadiga ah ee Apps-ka!</div>
            </div>
          `}
        </div>

        <button class="btn btn-primary btn-block" onclick="this.closest('.pwa-modal-overlay').remove()">
          Waan Fahmay 👍
        </button>
      </div>
    `;

    document.body.appendChild(modal);
  }

  window.dismissPwaBanner = function () {
    const b = document.getElementById('pwa-install-banner');
    if (b) b.remove();
  };

  document.addEventListener('DOMContentLoaded', () => {
    initMobileBottomBar();
    setTimeout(() => {
      if (!isAppInstalled()) {
        renderInstallBanner();
      }
    }, 1500);
  });
})();
