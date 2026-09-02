(function () {
  'use strict';

  var ORIGINAL_THEME = 'wfolio/pavelkayler.ru/assets/folio/desktop/themes/polina-102ed724f88f2e016d8785277edaa30dd9edf3fa8517650d82c3c7dda8253cf9.js';
  var LOCAL_IMAGE_PREFIX = 'i.wfolio.ru/';
  var IMAGE_HOST_RE = /(?:https?:)?\/\/i\.wfolio\.ru\//g;

  function localize(value) {
    return typeof value === 'string' ? value.replace(IMAGE_HOST_RE, LOCAL_IMAGE_PREFIX) : value;
  }

  function rewriteElement(el) {
    ['src', 'data-src', 'href'].forEach(function (name) {
      if (!el.hasAttribute || !el.hasAttribute(name)) return;
      var oldValue = el.getAttribute(name);
      var newValue = localize(oldValue);
      if (newValue !== oldValue) el.setAttribute(name, newValue);
    });

    ['srcset', 'data-srcset'].forEach(function (name) {
      if (!el.hasAttribute || !el.hasAttribute(name)) return;
      var oldValue = el.getAttribute(name);
      var newValue = localize(oldValue);
      if (newValue !== oldValue) el.setAttribute(name, newValue);
    });
  }

  function rewriteTree(root) {
    if (!root) return;
    if (root.nodeType === 1) rewriteElement(root);
    if (!root.querySelectorAll) return;
    root.querySelectorAll('[src],[data-src],[href],[srcset],[data-srcset]').forEach(rewriteElement);
  }

  function canonicalPath() {
    var path = window.location.pathname || '/';
    var pagesBase = '/pavelkayler.com/';
    if (window.location.hostname.endsWith('github.io') && path.indexOf(pagesBase) === 0) {
      path = '/' + path.slice(pagesBase.length);
    }
    if (path === '/index.html') path = '/';
    return path;
  }

  function pageUrl() {
    return 'https://pavelkayler.com' + canonicalPath();
  }

  function normalizeMetadata() {
    window.domains = ['pavelkayler.com'];

    var canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', pageUrl());

    ['meta[property="og:url"]', 'meta[name="twitter:url"]'].forEach(function (selector) {
      var node = document.querySelector(selector);
      if (node) node.setAttribute('content', pageUrl());
    });

    var twitterDomain = document.querySelector('meta[name="twitter:domain"]');
    if (twitterDomain) twitterDomain.setAttribute('content', 'pavelkayler.com');

    var structuredData = document.querySelector('script[type="application/ld+json"]');
    if (structuredData) {
      try {
        var data = JSON.parse(structuredData.textContent);
        if (data && data.url) data.url = 'https://pavelkayler.com';
        structuredData.textContent = JSON.stringify(data);
      } catch (_) {}
    }

    document.querySelectorAll('.branding, .admin-link').forEach(function (node) {
      node.remove();
    });
  }

  function removeWfolioUi(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('.branding, .admin-link').forEach(function (node) { node.remove(); });
    root.querySelectorAll('script[src*="wfolio.ru/card/"]').forEach(function (node) { node.remove(); });
  }

  rewriteTree(document);
  normalizeMetadata();
  removeWfolioUi(document);

  var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      if (mutation.type === 'attributes') {
        rewriteElement(mutation.target);
        return;
      }
      mutation.addedNodes.forEach(function (node) {
        rewriteTree(node);
        if (node.nodeType === 1 && node.matches && node.matches('.branding, .admin-link')) node.remove();
        removeWfolioUi(node);
      });
    });
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['src', 'data-src', 'href', 'srcset', 'data-srcset']
  });

  var original = document.createElement('script');
  original.src = ORIGINAL_THEME;
  original.async = false;
  document.head.appendChild(original);
})();
