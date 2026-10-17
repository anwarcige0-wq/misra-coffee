/**
 * MISRA COFFEE — Web Application Interactive Scripts
 * - Header scroll shadow state
 * - Mobile hamburger menu toggle & auto-close
 * - Route/Page detection for active navigation state
 */

document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('header');
  const navToggle = document.getElementById('nav-toggle');
  const navMenu = document.getElementById('nav-menu');
  const navLinks = document.querySelectorAll('.nav-link');

  // 1. Mobile Menu Toggle
  if (navToggle && navMenu) {
    navToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isExpanded = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', String(!isExpanded));
      navToggle.classList.toggle('open');
      navMenu.classList.toggle('open');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!header.contains(e.target) && navMenu.classList.contains('open')) {
        navMenu.classList.remove('open');
        navToggle.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });

    // Close menu on link click
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
        navToggle.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // 2. Sticky Header Styling on Scroll
  function handleScroll() {
    if (!header) return;
    if (window.scrollY > 30) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  // 3. Highlight Current Route
  const currentPath = window.location.pathname.toLowerCase();
  navLinks.forEach(link => {
    const linkHref = link.getAttribute('href').toLowerCase();
    
    // Check if link matches root or specific sub-path
    if (
      (currentPath === '/' || currentPath === '/index.html' || currentPath === '') &&
      (linkHref === '/' || linkHref === '/index.html')
    ) {
      link.classList.add('active');
    } else if (
      (currentPath.includes('/services') || currentPath.includes('services.html')) &&
      linkHref.includes('services')
    ) {
      link.classList.add('active');
    } else if (
      (currentPath.includes('/about') || currentPath.includes('about.html')) &&
      linkHref.includes('about')
    ) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
});