#!/usr/bin/env python3
"""Static QA server with MP4 byte ranges, matching Pages rather than a fake stream."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re

class MediaRangeHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        self.range_remaining = None
        path = Path(self.translate_path(self.path))
        value = self.headers.get('Range')
        if path.suffix.lower() != '.mp4' or not path.is_file() or not value:
            return super().send_head()
        total = path.stat().st_size
        match = re.fullmatch(r'bytes=(\d*)-(\d*)', value.strip())
        if not match or not any(match.groups()):
            self.send_error(416, 'Unsupported range'); return None
        left, right = match.groups()
        start = int(left) if left else max(0, total-int(right))
        end = min(int(right), total-1) if right and left else total-1
        if start > end or start >= total:
            self.send_response(416); self.send_header('Content-Range', f'bytes */{total}'); self.end_headers(); return None
        stream = path.open('rb'); stream.seek(start)
        self.range_remaining = end-start+1
        self.send_response(206)
        self.send_header('Content-Type', 'video/mp4')
        self.send_header('Content-Length', str(self.range_remaining))
        self.send_header('Content-Range', f'bytes {start}-{end}/{total}')
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Last-Modified', self.date_time_string(path.stat().st_mtime))
        self.end_headers()
        return stream
    def copyfile(self, source, outputfile):
        if self.range_remaining is None:
            return super().copyfile(source, outputfile)
        remaining = self.range_remaining
        while remaining:
            chunk=source.read(min(65536,remaining))
            if not chunk: break
            outputfile.write(chunk); remaining-=len(chunk)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=4173);parser.add_argument('--directory',default='dist')
    args=parser.parse_args()
    ThreadingHTTPServer(('127.0.0.1',args.port),partial(MediaRangeHandler,directory=args.directory)).serve_forever()
