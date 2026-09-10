"""Real HTTP module delays, including requests invisible to Playwright SW routing.
Only the isolated delayed-viewer cases use this loopback origin. Ordinary live
checks keep using the production domain directly. Response bodies are unmodified.
"""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
import threading
import time


class DelayedModuleOrigin:
    def __init__(self, upstream, delay=2, hold=False):
        if urlsplit(upstream).scheme not in ('http', 'https'):
            raise ValueError('An HTTP(S) upstream is required')
        self.upstream = upstream.rstrip('/')
        self.requested = threading.Event()
        self.release = threading.Event()
        self.delayed = []
        self.hold = hold
        self.delay = delay
        owner = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def do_HEAD(self):
                self.forward('HEAD')

            def do_GET(self):
                self.forward('GET')

            def forward(self, method):
                path = urlsplit(self.path).path
                if method == 'GET' and 'lightbox' in path.lower() and path.endswith('.js'):
                    owner.delayed.append(self.path)
                    owner.requested.set()
                    if owner.hold:
                        if not owner.release.wait(90):
                            self.send_error(504, 'The test did not release its held module')
                            return
                    else:
                        time.sleep(owner.delay)
                # Forward only public resource headers; never relay cookies/auth.
                names = ('Range', 'If-Range', 'If-None-Match', 'If-Modified-Since', 'Accept', 'Accept-Encoding')
                headers = {name: self.headers[name] for name in names if name in self.headers}
                request = Request(owner.upstream + self.path, headers=headers, method=method)
                try:
                    try:
                        response = urlopen(request, timeout=90)
                    except HTTPError as error:
                        response = error
                    with response:
                        self.send_response(response.status)
                        for name, value in response.headers.items():
                            if name.lower() not in ('connection', 'transfer-encoding', 'keep-alive', 'server', 'date'):
                                self.send_header(name, value)
                        self.end_headers()
                        if method != 'HEAD':
                            while chunk := response.read(128 * 1024):
                                self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    pass
                except (URLError, TimeoutError) as error:
                    self.send_error(502, str(error))

        self.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = f'http://127.0.0.1:{self.server.server_port}'

    def close(self):
        self.release.set()
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
