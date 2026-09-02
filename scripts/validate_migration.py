#!/usr/bin/env python3
from __future__ import annotations

import html
import re
import sys
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGES = ["index.html", "works.html", "portraits.html", "projects.html", "brands.html", "contacts.html"]
REMOTE_WFOLIO_IMAGE_RE = re.compile(r"(?:https?:)?//i\.wfolio\.ru/", re.I)
LOCAL_WFOLIO_IMAGE_RE = re.compile(r"(?<![\w:/.-])i\.wfolio\.ru/[^\s\"'<>)]+", re.I)
ATTR_RE = re.compile(r"\b(?:src|href|data-src)=[\"']([^\"']+)[\"']", re.I)

errors: list[str] = []
stats = {
    "pages": 0,
    "local_image_references": 0,
    "unique_local_images": set(),
    "local_file_references": 0,
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
    canonical = f'https://pavelkayler.com{canonical_path}'

    if REMOTE_WFOLIO_IMAGE_RE.search(text):
        fail(f"{page}: still contains external i.wfolio.ru image URL")
    if "wfolio.ru/card/" in text:
        fail(f"{page}: still loads wfolio.ru/card")
    if 'class="branding"' in text or "class='branding'" in text:
        fail(f"{page}: visible Wfolio branding remains")
    if 'class="admin-link"' in text or "class='admin-link'" in text or "wfolio.ru/edit" in text:
        fail(f"{page}: Wfolio admin link remains")
    if canonical not in text:
        fail(f"{page}: expected canonical URL is missing")
    if "pavelkayler.ru" in text:
        fail(f"{page}: old pavelkayler.ru domain remains")

    for match in LOCAL_WFOLIO_IMAGE_RE.finditer(text):
        value = match.group(0).rstrip(",")
        file_path = local_path(value)
        if file_path is None:
            continue
        stats["local_image_references"] += 1
        stats["unique_local_images"].add(str(file_path.relative_to(ROOT)))
        if not file_path.is_file() or file_path.stat().st_size == 0:
            fail(f"{page}: missing local image {value}")

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
    ROOT / "assets/folio/desktop/themes/polina-102ed724f88f2e016d8785277edaa30dd9edf3fa8517650d82c3c7dda8253cf9.js",
    ROOT / "assets/folio/desktop/vendor/polina-3994a6f8acd9e18fe38b14dbbad877484965df0633ca7776ab996d2430e39a9f.css",
]
for path in required_files:
    if not path.exists():
        fail(f"missing required file: {path.relative_to(ROOT)}")

# The restored Wfolio bundle/CSS should be the original full assets, not the temporary migration shims.
theme_js = required_files[-2]
theme_css = required_files[-1]
if theme_js.exists() and theme_js.stat().st_size < 250_000:
    fail("theme JS looks like a migration shim instead of the restored Polina bundle")
if theme_css.exists() and theme_css.stat().st_size < 150_000:
    fail("theme CSS looks like a migration shim instead of the restored Polina stylesheet")

for old_httrack_file in ["backblue.gif", "fade.gif", "wfolio.whtt"]:
    if (ROOT / old_httrack_file).exists():
        fail(f"obsolete HTTrack root artifact remains: {old_httrack_file}")

print("Migration validation")
print(f"  pages: {stats['pages']}/{len(PAGES)}")
print(f"  local image references checked: {stats['local_image_references']}")
print(f"  unique local image files referenced: {len(stats['unique_local_images'])}")
print(f"  other local file references checked: {stats['local_file_references']}")
print(f"  errors: {len(errors)}")

if errors:
    for error in errors:
        print(f"ERROR: {error}")
    sys.exit(1)

print("OK: standalone migration passed all structural checks")
