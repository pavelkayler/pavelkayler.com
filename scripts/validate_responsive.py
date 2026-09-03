#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGES = ["index.html", "works.html", "portraits.html", "projects.html", "brands.html", "contacts.html"]
VIEWPORT_MARKER = 'name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"'
CSS_TAG = '<link rel="stylesheet" href="assets/mobile-overrides.css" />'

errors: list[str] = []


def fail(message: str) -> None:
    errors.append(message)


css_path = ROOT / "assets" / "mobile-overrides.css"
if not css_path.is_file():
    fail("assets/mobile-overrides.css is missing")
else:
    css = css_path.read_text(encoding="utf-8")
    required_css_markers = [
        "@media (max-width: 768px)",
        "body {\n    min-width: 0;",
        ".menu {\n    min-width: 0;",
        ".album-grid > .piece",
        "width: 50%;",
        ".listing .listing-item",
        "100svh",
        "safe-area-inset-bottom",
    ]
    for marker in required_css_markers:
        if marker not in css:
            fail(f"mobile-overrides.css is missing marker: {marker}")

for page_name in PAGES:
    path = ROOT / page_name
    if not path.is_file():
        fail(f"missing page: {page_name}")
        continue

    text = path.read_text(encoding="utf-8")
    if VIEWPORT_MARKER not in text:
        fail(f"{page_name}: device-width viewport is missing")
    if "width=1280" in text or "width=1280" in text.replace(" ", ""):
        fail(f"{page_name}: legacy Wfolio 1280 viewport remains")
    if text.count(CSS_TAG) != 1:
        fail(f"{page_name}: expected one responsive stylesheet tag, found {text.count(CSS_TAG)}")
    if text.find(CSS_TAG) > text.lower().find("</head>"):
        fail(f"{page_name}: responsive stylesheet is not inside <head>")

print("Responsive validation")
print(f"  pages checked: {len(PAGES)}")
print(f"  errors: {len(errors)}")

if errors:
    for error in errors:
        print(f"ERROR: {error}")
    sys.exit(1)

print("OK: mobile viewport and responsive override layer are present")
