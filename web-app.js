/**
 * MISRA COFFEE — Modern Web Application Client Enhancer
 * - PWA Service Worker Registration
 * - Native Toast Notification Engine
 * - Mobile App Bottom Navigation Bar
 * - Install App (PWA) Prompt
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
      { href: '/services', label: 'Services', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>' },
      { href: '/menu', label: 'Digital Menu', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>' },
      { href: '/admin/login', label: 'Admin', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' }
    ];

    bar.innerHTML = links.map(item => {
      const isActive = (item.href === '/' && (currentPath === '/' || currentPath.endsWith('index.html'))) ||
                       (item.href !== '/' && currentPath.includes(item.href));
      return `
        <a href="${item.href}" class="bottom-bar-item ${isActive ? 'active' : ''}">
          <div class="bottom-bar-icon">${item.icon}</div>
          <span class="bottom-bar-label">${item.label}</span>
        </a>
      `;
    }).join('');

    document.body.appendChild(bar);
  }

  // 4. Install App PWA Banner (Cross-Platform Android, iOS, Windows, Mac)
  let deferredPrompt;

  window.triggerInstallApp = function () {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(choice => {
        if (choice.outcome === 'accepted') {
          window.showToast('Waad ku mahadsan tahay ku shubashada MISRA COFFEE App!', 'success');
        }
        deferredPrompt = null;
      });
      return;
    }

    // Check if iOS
    const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    if (isIos) {
      alert("Si aad ugu shubato iPhone-kaaga:\n1. Ku dhufo batoonka 'Share' (la-wadaag) ee browser-ka Safari (hoose ama kor).\n2. Kadib dooro 'Add to Home Screen' (Ku dar Shaashadda Hore).");
    } else {
      alert("Si aad ugu shubato qalabkaaga:\nBrowser-kaaga ku dhufo 3-da dhibcood (Menu) kadib dooro 'Install app' ama 'Add to Home screen'.");
    }
  };

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    const banner = document.getElementById('pwa-install-banner');
    if (!banner) {
      const newBanner = document.createElement('div');
      newBanner.id = 'pwa-install-banner';
      newBanner.className = 'pwa-install-banner';
      newBanner.innerHTML = `
        <div class="pwa-banner-inner">
          <img src="/images/app-icon-192.png" width="42" height="42" alt="MISRA COFFEE App" style="border-radius:10px;object-fit:cover;box-shadow:0 2px 8px rgba(0,0,0,0.4)">
          <div style="flex:1">
            <strong style="color:#FAF6F0;font-size:14px">Ku shubo MISRA COFFEE App</strong>
            <small style="display:block;color:var(--text-muted);font-size:12px">Sida App rasmi ah ugu fur shaashaddaada</small>
          </div>
          <button class="btn btn-sm btn-primary" onclick="window.triggerInstallApp()" id="btn-install-pwa">📱 Ku Shubo</button>
          <button class="btn-close-banner" onclick="dismissPwaBanner()" aria-label="Xir">✕</button>
        </div>
      `;
      document.body.appendChild(newBanner);
    }
  });

  window.dismissPwaBanner = function () {
    const b = document.getElementById('pwa-install-banner');
    if (b) b.remove();
  };

  document.addEventListener('DOMContentLoaded', () => {
    initMobileBottomBar();
  });
})();
