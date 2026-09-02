(function () {
  'use strict';

  var ORIGINAL_THEME = 'wfolio/pavelkayler.ru/assets/folio/desktop/themes/polina-102ed724f88f2e016d8785277edaa30dd9edf3fa8517650d82c3c7dda8253cf9.js';

  function normalizeLocalMirrorPath(value) {
    if (typeof value !== 'string') return value;
    return value
      .replace(/^\.\.\/i\.wfolio\.ru\//, 'i.wfolio.ru/')
      .replace(/^\.\.\/mc\.yandex\.ru\//, 'mc.yandex.ru/');
  }

  document.querySelectorAll('[src],[data-src],[href],[srcset],[data-srcset]').forEach(function (el) {
    ['src', 'data-src', 'href', 'srcset', 'data-srcset'].forEach(function (name) {
      if (!el.hasAttribute(name)) return;
      var before = el.getAttribute(name);
      var after = normalizeLocalMirrorPath(before);
      if (before !== after) el.setAttribute(name, after);
    });
  });

  document.querySelectorAll('.branding, .admin-link').forEach(function (node) { node.remove(); });

  var original = document.createElement('script');
  original.src = ORIGINAL_THEME;
  original.async = false;
  document.head.appendChild(original);
})();
