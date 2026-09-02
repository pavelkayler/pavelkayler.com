#!/usr/bin/env python3
from __future__ import annotations

import html
import re
import sys
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGES = ["index.html", "works.html", "portraits.html", "projects.html", "brands.html", "contacts.html"]
REMOTE_WFOLIO_URL_RE = re.compile(r"(?:https?:)?//(?:[a-z0-9-]+\.)*wfolio\.ru/", re.I)
LOCAL_WFOLIO_ASSET_RE = re.compile(
    r"(?<![\w:/.-])(?:i|static|vp)\.wfolio\.ru/[^\s\"'<>)&,]+",
    re.I,
)
ATTR_RE = re.compile(r"\b(?:src|href|data-src)=[\"']([^\"']+)[\"']", re.I)
SITE_FIXES_TAG = '<script src="assets/site-fixes.js" defer="defer"></script>'

errors: list[str] = []
stats = {
    "pages": 0,
    "local_asset_references": 0,
    "unique_local_assets": set(),
    "local_file_references": 0,
    "galleries": 0,
}


def fail(message: str) -> None:
    errors.append(message)


def local_path(value: str) -> Path | None:
    value = html.unescape(value).strip()
    if not value or value.startswith(("#", "data:", "mailto:", "tel:", "javascript:")):
        return None
    if value.startswith(("http://", "https://", "//")):
        return None
    parsed = urllib.parse.urlsplit(value)
    path = urllib.parse.unquote(parsed.path)
    if path.startswith("/"):
        path = path[1:]
    if not path:
        return None
    return ROOT / path


for page in PAGES:
    path = ROOT / page
    if not path.exists():
        fail(f"missing required page: {page}")
        continue

    stats["pages"] += 1
    text = path.read_text(encoding="utf-8")
    canonical_path = "/" if page == "index.html" else "/" + page
    canonical = f"https://pavelkayler.com{canonical_path}"

    external_wfolio = sorted(set(m.group(0) for m in REMOTE_WFOLIO_URL_RE.finditer(text)))
    if external_wfolio:
        fail(f"{page}: still contains external Wfolio URL(s): {', '.join(external_wfolio)}")
    if "data-gallery-share-url=" in text:
        fail(f"{page}: obsolete Wfolio gallery share endpoint metadata remains")
    if 'class="branding"' in text or "class='branding'" in text:
        fail(f"{page}: visible Wfolio branding remains")
    if 'class="admin-link"' in text or "class='admin-link'" in text or "wfolio.ru/edit" in text:
        fail(f"{page}: Wfolio admin link remains")
    if canonical not in text:
        fail(f"{page}: expected canonical URL is missing")
    if "pavelkayler.ru" in text:
        fail(f"{page}: old pavelkayler.ru domain remains")

    if "© 2025 Pavel Kayler" in text:
        fail(f"{page}: stale 2025 copyright remains")
    if "© 2026 Pavel Kayler" not in text:
        fail(f"{page}: 2026 copyright is missing")
    if SITE_FIXES_TAG not in text:
        fail(f"{page}: standalone site-fixes script is not included")

    if "instagram.com" in text:
        instagram_anchors = re.findall(
            r'<a\b[^>]*href=["\'][^"\']*instagram\.com[^"\']*["\'][^>]*>.*?</a>',
            text,
            flags=re.I | re.S,
        )
        if not instagram_anchors:
            fail(f"{page}: Instagram link could not be parsed")
        elif any('fab fa-instagram' not in anchor for anchor in instagram_anchors):
            fail(f"{page}: Instagram link does not use the Instagram brand icon")

    if "js-gallery" in text:
        stats["galleries"] += text.count("js-gallery")
        if "js-gallery-link" not in text:
            fail(f"{page}: gallery container exists without gallery links")
        if "data-gallery-versions" not in text:
            fail(f"{page}: gallery links are missing fullscreen version metadata")

    for match in LOCAL_WFOLIO_ASSET_RE.finditer(text):
        value = match.group(0).rstrip(",")
        file_path = local_path(value)
        if file_path is None:
            continue
        stats["local_asset_references"] += 1
        stats["unique_local_assets"].add(str(file_path.relative_to(ROOT)))
        if not file_path.is_file() or file_path.stat().st_size == 0:
            fail(f"{page}: missing local Wfolio asset {value}")

    for match in ATTR_RE.finditer(text):
        value = match.group(1)
        file_path = local_path(value)
        if file_path is None:
            continue
        stats["local_file_references"] += 1
        if not file_path.exists():
            fail(f"{page}: broken local reference {value}")

required_files = [
    ROOT / ".nojekyll",
    ROOT / "robots.txt",
    ROOT / "sitemap.xml",
    ROOT / "favicon.ico",
    ROOT / "assets/site-fixes.js",
    ROOT / "assets/folio/desktop/themes/polina-102ed724f88f2e016d8785277edaa30dd9edf3fa8517650d82c3c7dda8253cf9.js",
    ROOT / "assets/folio/desktop/vendor/polina-3994a6f8acd9e18fe38b14dbbad877484965df0633ca7776ab996d2430e39a9f.css",
]
for path in required_files:
    if not path.exists():
        fail(f"missing required file: {path.relative_to(ROOT)}")

theme_js = required_files[-2]
theme_css = required_files[-1]
site_fixes_js = required_files[-3]
if theme_js.exists() and theme_js.stat().st_size < 250_000:
    fail("theme JS looks like a migration shim instead of the restored Polina bundle")
if theme_css.exists() and theme_css.stat().st_size < 150_000:
    fail("theme CSS looks like a migration shim instead of the restored Polina stylesheet")
if site_fixes_js.exists():
    fixes = site_fixes_js.read_text(encoding="utf-8")
    for marker in ["isInternalNavigation", "fa-instagram", "ensureWfolioGalleries", "new window.Gallery"]:
        if marker not in fixes:
            fail(f"site-fixes.js is missing required behavior marker: {marker}")

for old_httrack_file in ["backblue.gif", "fade.gif", "wfolio.whtt"]:
    if (ROOT / old_httrack_file).exists():
        fail(f"obsolete HTTrack root artifact remains: {old_httrack_file}")

print("Migration validation")
print(f"  pages: {stats['pages']}/{len(PAGES)}")
print(f"  gallery markers found: {stats['galleries']}")
print(f"  local Wfolio asset references checked: {stats['local_asset_references']}")
print(f"  unique local Wfolio assets referenced: {len(stats['unique_local_assets'])}")
print(f"  other local file references checked: {stats['local_file_references']}")
print(f"  errors: {len(errors)}")

if errors:
    for error in errors:
        print(f"ERROR: {error}")
    sys.exit(1)

print("OK: standalone migration passed all structural checks")
