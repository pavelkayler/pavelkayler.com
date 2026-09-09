#!/usr/bin/env python3
"""Reject opaque source/build filenames and broken local asset references."""
import argparse
import csv
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import unquote, urlsplit

parser = argparse.ArgumentParser()
parser.add_argument('--include-dist', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
paths = [Path(name) for name in subprocess.check_output(
    ['git', 'ls-files', '-z'], cwd=root).decode().split('\0') if name]
if args.include_dist:
    paths += [p.relative_to(root) for p in (root / 'dist').rglob('*') if p.is_file()]
for path in paths:
    for part in path.parts:
        assert re.fullmatch(r'[A-Za-z0-9_.-]+', part), f'Invalid filename component: {path}'
        assert len(part) <= 96, f'Overlong filename component: {path}'
        assert not re.search(r'[a-f0-9]{24,}', part), f'Hash-named file: {path}'
        token = part.rsplit('.', 1)[0]
        opaque = len(token) >= 24 and re.search(r'[A-Z]', token) and re.search(r'[a-z]', token) and re.search(r'[0-9]', token)
        assert not opaque, f'Opaque asset identifier: {path}'
    assert 'video_proxies' not in path.parts, f'Obsolete media tree: {path}'
    assert not str(path).startswith('src/' + 'generated/'), f'Unmaintained content directory: {path}'

manifest = json.loads((root / 'src/content/media-manifest.json').read_text())
for name in manifest:
    assert not Path(name).is_absolute() and '..' not in Path(name).parts, f'Unsafe path: {name}'
    assert 'archive' not in Path(name).parts, f'Archive asset would be published: {name}'
    assert (root / name).is_file(), f'Missing source: {name}'
    if args.include_dist:
        assert (root / 'dist' / name).is_file(), f'Missing published asset: {name}'
with (root / 'media/catalog.csv').open(newline='') as file:
    catalog = list(csv.DictReader(file))
for item in catalog:
    file = root / item['path']
    assert file.is_file(), f'Missing catalog asset: {item["path"]}'
    assert file.stat().st_size == int(item['bytes']), f'Update catalog for changed media: {item["path"]}'
assert {item['path'] for item in catalog} == {str(p) for p in paths if str(p).startswith('media/') and p.suffix.lower() in ('.jpg', '.png', '.mp4')}, 'Media catalog does not match the tracked library'

# A moved stylesheet must resolve URLs relative to its new served location.
url_pattern = re.compile(r'url\(\s*[\'"]?([^\'"\)]+)')
css_files = [root / p for p in paths if p.suffix == '.css']
for file in css_files:
    served_root = root / 'dist' if file.is_relative_to(root / 'dist') else root
    served_directory = root if file == root / 'assets/styles/site-theme.css' else file.parent
    for match in url_pattern.finditer(file.read_text()):
        uri = match[1].strip()
        if uri.startswith(('data:', 'http:', 'https:', '//', '#')):
            continue
        relative = unquote(urlsplit(uri).path)
        target = served_root / relative.lstrip('/') if relative.startswith('/') else served_directory / relative
        assert target.is_file(), f'Broken CSS asset in {file.relative_to(root)}: {uri}'

asset_pattern = re.compile(r'(?:__BASE__|/)?(media/[A-Za-z0-9_./-]+\.(?:jpg|png|mp4))')
for directory in (root / 'src', root / 'assets/styles'):
    for file in directory.rglob('*'):
        if file.suffix not in ('.ts', '.tsx', '.json', '.css'):
            continue
        text = file.read_text()
        assert not re.search(r'[a-f0-9]{32,}\.(?:jpg|png|woff2|ttf|css|svg)', text), f'Old opaque filename in {file}'
        for match in asset_pattern.finditer(text):
            assert (root / match[1]).is_file(), f'Broken media reference in {file}: {match[1]}'
if args.include_dist:
    assert not (root / 'dist/media/archive').exists(), 'Unpublished media leaked into production'
print(f'Descriptive filename checks passed: {len(paths)} source/build files, {len(catalog)} catalog assets, {len(manifest)} published media references.')
