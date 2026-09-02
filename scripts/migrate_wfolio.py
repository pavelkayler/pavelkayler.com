#!/usr/bin/env python3
from __future__ import annotations

import concurrent.futures
import html
import json
import re
import shutil
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE_SOURCE = ROOT / "wfolio" / "pavelkayler.ru"
IMAGE_SOURCE = ROOT / "wfolio" / "i.wfolio.ru"
METRIKA_SOURCE = ROOT / "wfolio" / "mc.yandex.ru"
IMAGE_DEST = ROOT / "i.wfolio.ru"

PAGES = [
    "index.html",
    "works.html",
    "portraits.html",
    "projects.html",
    "brands.html",
    "contacts.html",
]

REMOTE_IMAGE_RE = re.compile(r"(?:(?:https?:)?//i\.wfolio\.ru/[^\s\"'<>)]+)", re.I)
SCRIPT_RE = re.compile(r"<script\b[^>]*>.*?</script>", re.I | re.S)


def copy_static_tree() -> None:
    shutil.copytree(SITE_SOURCE / "assets", ROOT / "assets", dirs_exist_ok=True)
    if IMAGE_SOURCE.exists():
        shutil.copytree(IMAGE_SOURCE, IMAGE_DEST, dirs_exist_ok=True)
    if METRIKA_SOURCE.exists():
        shutil.copytree(METRIKA_SOURCE, ROOT / "mc.yandex.ru", dirs_exist_ok=True)
    shutil.copy2(SITE_SOURCE / "favicon.ico", ROOT / "favicon.ico")


def normalize_remote_url(raw: str) -> str:
    raw = html.unescape(raw)
    if raw.startswith("//"):
        return "https:" + raw
    return raw


def destination_for(url: str) -> Path:
    parsed = urllib.parse.urlparse(url)
    rel = urllib.parse.unquote(parsed.path).lstrip("/")
    parts = Path(rel).parts
    if not rel or any(part in {"..", "."} for part in parts):
        raise ValueError(f"Unsafe image path: {url}")
    return IMAGE_DEST.joinpath(*parts)


def download_one(url: str) -> tuple[str, str, int]:
    dest = destination_for(url)
    if dest.exists() and dest.stat().st_size > 0:
        return url, "existing", dest.stat().st_size

    dest.parent.mkdir(parents=True, exist_ok=True)
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; PavelKaylerMigration/1.0)",
        "Referer": "https://pavelkayler.ru/",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    }

    last_error = None
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=45) as response:
                data = response.read()
            if not data:
                raise IOError("empty response")
            tmp = dest.with_suffix(dest.suffix + ".part")
            tmp.write_bytes(data)
            tmp.replace(dest)
            return url, "downloaded", len(data)
        except Exception as exc:  # network migration: collect failures instead of breaking the site
            last_error = exc
            time.sleep(1.5 * (attempt + 1))

    return url, f"failed: {last_error}", 0


def collect_remote_urls() -> list[str]:
    urls: set[str] = set()
    for page in PAGES:
        text = (SITE_SOURCE / page).read_text(encoding="utf-8")
        for match in REMOTE_IMAGE_RE.finditer(text):
            urls.add(normalize_remote_url(match.group(0)))
    return sorted(urls)


def download_remote_images(urls: list[str]) -> dict[str, tuple[str, int]]:
    results: dict[str, tuple[str, int]] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
        futures = {pool.submit(download_one, url): url for url in urls}
        for future in concurrent.futures.as_completed(futures):
            url, status, size = future.result()
            results[url] = (status, size)
            print(f"[{status}] {url}")
    return results


def remove_wfolio_only_markup(text: str) -> str:
    text = SCRIPT_RE.sub(
        lambda m: "" if "wfolio.ru/card/" in m.group(0) else m.group(0),
        text,
    )
    text = re.sub(r'<div\s+class="branding"[^>]*>.*?</div>', "", text, flags=re.I | re.S)
    text = re.sub(r'<a\s+class="admin-link"[^>]*>.*?</a>', "", text, flags=re.I | re.S)
    text = re.sub(r'<meta\b(?=[^>]*(?:name|content)="owner")(?=[^>]*wfolio)[^>]*>', "", text, flags=re.I)
    return text


def replace_tag(text: str, selector_re: str, replacement: str) -> str:
    return re.sub(selector_re, replacement, text, count=1, flags=re.I)


def clean_page(page_name: str, successful_urls: set[str]) -> str:
    text = (SITE_SOURCE / page_name).read_text(encoding="utf-8")

    # HTTrack bookkeeping is not part of the actual website.
    text = re.sub(r"<!--\s*Mirrored from .*?-->", "", text, flags=re.I | re.S)
    text = re.sub(r"<!--\s*Added by HTTrack\s*-->.*?<!--\s*/Added by HTTrack\s*-->", "", text, flags=re.I | re.S)

    # URLs already rewritten by HTTrack become root-relative-to-this-page instead of parent-relative.
    text = text.replace("../i.wfolio.ru/", "i.wfolio.ru/")
    text = text.replace("../mc.yandex.ru/", "mc.yandex.ru/")

    def image_replacer(match: re.Match[str]) -> str:
        raw = match.group(0)
        normalized = normalize_remote_url(raw)
        if normalized not in successful_urls:
            return raw
        parsed = urllib.parse.urlparse(normalized)
        return "i.wfolio.ru/" + parsed.path.lstrip("/")

    text = REMOTE_IMAGE_RE.sub(image_replacer, text)
    text = remove_wfolio_only_markup(text)

    # Domain migration. This intentionally updates visible logo/title strings as well as metadata.
    text = text.replace("pavelkayler.wfolio.pro", "pavelkayler.com")
    text = text.replace("pavelkayler.ru", "pavelkayler.com")
    text = re.sub(r'window\.domains\s*=\s*\[[^;]*\];', 'window.domains = ["pavelkayler.com"];', text, count=1)

    canonical_path = "/" if page_name == "index.html" else "/" + page_name
    canonical_url = "https://pavelkayler.com" + canonical_path

    text = replace_tag(
        text,
        r'<link\b(?=[^>]*\brel=["\']canonical["\'])[^>]*>',
        f'<link rel="canonical" href="{canonical_url}" />',
    )
    text = replace_tag(
        text,
        r'<meta\b(?=[^>]*\bproperty=["\']og:url["\'])[^>]*>',
        f'<meta property="og:url" content="{canonical_url}" />',
    )
    text = replace_tag(
        text,
        r'<meta\b(?=[^>]*(?:name|property)=["\']twitter:url["\'])[^>]*>',
        f'<meta property="twitter:url" content="{canonical_url}" />',
    )
    text = replace_tag(
        text,
        r'<meta\b(?=[^>]*(?:name|property)=["\']twitter:domain["\'])[^>]*>',
        '<meta property="twitter:domain" content="pavelkayler.com" />',
    )

    # Keep the original layout/viewport untouched on the restoration pass.
    return text.strip() + "\n"


def write_support_files() -> None:
    (ROOT / ".nojekyll").write_text("", encoding="utf-8")
    (ROOT / "robots.txt").write_text(
        "User-agent: *\nAllow: /\n\nSitemap: https://pavelkayler.com/sitemap.xml\n",
        encoding="utf-8",
    )
    urls = ["/", "/works.html", "/portraits.html", "/projects.html", "/brands.html", "/contacts.html"]
    sitemap = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    sitemap += [f"  <url><loc>https://pavelkayler.com{path}</loc></url>" for path in urls]
    sitemap.append("</urlset>")
    (ROOT / "sitemap.xml").write_text("\n".join(sitemap) + "\n", encoding="utf-8")


def main() -> None:
    copy_static_tree()
    remote_urls = collect_remote_urls()
    print(f"Found {len(remote_urls)} unique remote Wfolio image URLs")
    results = download_remote_images(remote_urls)

    successful = {
        url for url, (status, _) in results.items()
        if status in {"existing", "downloaded"}
    }

    for page in PAGES:
        (ROOT / page).write_text(clean_page(page, successful), encoding="utf-8")

    write_support_files()

    for old_httrack_file in ["backblue.gif", "fade.gif", "wfolio.whtt"]:
        path = ROOT / old_httrack_file
        if path.exists():
            path.unlink()

    report = {
        "remote_urls_found": len(remote_urls),
        "localized": len(successful),
        "downloaded": sum(1 for status, _ in results.values() if status == "downloaded"),
        "already_present": sum(1 for status, _ in results.values() if status == "existing"),
        "failed": [
            {"url": url, "error": status}
            for url, (status, _) in sorted(results.items())
            if status.startswith("failed:")
        ],
    }
    (ROOT / "migration-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
