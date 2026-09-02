#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGES = [
    "index.html",
    "works.html",
    "portraits.html",
    "projects.html",
    "brands.html",
    "contacts.html",
]

VIEWPORT_TAG = '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />'
MOBILE_CSS_TAG = '<link rel="stylesheet" href="assets/mobile-overrides.css" />'
VIEWPORT_RE = re.compile(
    r'<meta\b(?=[^>]*\bname=["\']viewport["\'])[^>]*>',
    re.I,
)


def apply(page: Path) -> None:
    text = page.read_text(encoding="utf-8")

    text, replacements = VIEWPORT_RE.subn(VIEWPORT_TAG, text, count=1)
    if replacements != 1:
        raise RuntimeError(f"{page.name}: expected exactly one viewport meta tag")

    # Keep the responsive layer separate from the preserved Wfolio theme and load
    # it last, so desktop fidelity remains easy to audit and rollback.
    text = text.replace(MOBILE_CSS_TAG, "")
    if not re.search(r"</head\s*>", text, flags=re.I):
        raise RuntimeError(f"{page.name}: missing </head>")
    text = re.sub(
        r"</head\s*>",
        MOBILE_CSS_TAG + "\n</head>",
        text,
        count=1,
        flags=re.I,
    )

    page.write_text(text, encoding="utf-8")


def main() -> None:
    css = ROOT / "assets" / "mobile-overrides.css"
    if not css.is_file():
        raise SystemExit("assets/mobile-overrides.css is missing")

    for page_name in PAGES:
        page = ROOT / page_name
        if not page.is_file():
            raise SystemExit(f"missing generated page: {page_name}")
        apply(page)
        print(f"responsive: {page_name}")


if __name__ == "__main__":
    main()
