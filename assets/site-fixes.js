(function () {
  "use strict";

  function isInternalNavigation(anchor) {
    if (!anchor || !anchor.getAttribute) return false;

    var rawHref = (anchor.getAttribute("href") || "").trim();
    if (!rawHref) return false;
    if (/^(?:mailto:|tel:|javascript:|data:)/i.test(rawHref)) return false;

    if (rawHref.charAt(0) === "#") return true;

    try {
      var url = new URL(rawHref, window.location.href);
      if (!/^https?:$/i.test(url.protocol)) return false;

      if (url.origin === window.location.origin) return true;

      var hostname = url.hostname.toLowerCase();
      return hostname === "pavelkayler.com" || hostname === "www.pavelkayler.com";
    } catch (_error) {
      return !/^[a-z][a-z0-9+.-]*:/i.test(rawHref);
    }
  }

  function normalizeInternalTargets(root) {
    var scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll("a[href]").forEach(function (anchor) {
      if (isInternalNavigation(anchor)) anchor.removeAttribute("target");
    });
  }

  function fixInstagramIcons(root) {
    var scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('a[href*="instagram.com"] i').forEach(function (icon) {
      icon.className = "fab fa-instagram";
      icon.removeAttribute("style");
    });
  }

  function hasWfolioGalleryHandler($, element) {
    if (typeof $._data !== "function") return false;
    var events = $._data(element, "events");
    if (!events || !events.click) return false;

    return events.click.some(function (handler) {
      return handler && handler.selector === ".js-gallery-link";
    });
  }

  function normalizeGalleryVersions($gallery) {
    $gallery.find(".js-gallery-link").each(function () {
      var $link = window.jQuery(this);
      var versions = $link.data("gallery-versions");

      if (typeof versions !== "string") return;
      try {
        $link.data("gallery-versions", JSON.parse(versions));
      } catch (_error) {
        // Keep the href as a graceful fallback if an old gallery item has bad metadata.
      }
    });
  }

  function ensureWfolioGalleries() {
    var $ = window.jQuery;
    if (!$ || typeof window.Gallery !== "function") return;

    $(".js-gallery").each(function (index, element) {
      var $gallery = $(element);
      normalizeGalleryVersions($gallery);

      if (hasWfolioGalleryHandler($, element)) {
        $gallery.attr("data-pk-gallery-ready", "native");
        return;
      }

      if ($gallery.attr("data-pk-gallery-ready")) return;

      var follower = $gallery.data("gallery-follower");
      var gallery = new window.Gallery({
        selector: ".js-gallery-link",
        initialZoom: $gallery.data("gallery-initial-zoom"),
        galleryUniqId: 1000 + index,
        galleryFollower: follower !== false
      });

      gallery.start($gallery);
      $gallery.data("pk-gallery-instance", gallery);
      $gallery.attr("data-pk-gallery-ready", "fallback");
    });
  }

  function initializeStandaloneFixes() {
    normalizeInternalTargets(document);
    fixInstagramIcons(document);
    ensureWfolioGalleries();

    // Wfolio can assign target values during its own initialization. A capture-phase
    // guard makes internal navigation same-tab even if a target is added later.
    document.addEventListener(
      "click",
      function (event) {
        var target = event.target;
        if (!target || !target.closest) return;
        var anchor = target.closest("a[href]");
        if (anchor && isInternalNavigation(anchor)) anchor.removeAttribute("target");
      },
      true
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeStandaloneFixes, { once: true });
  } else {
    initializeStandaloneFixes();
  }
})();
