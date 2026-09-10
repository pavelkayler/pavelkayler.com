/* Only explicitly versioned portfolio videos are intercepted. HTML, scripts,
   photographs and normal video URLs retain ordinary network/cache behaviour. */
const VIDEO_CACHE = 'portfolio-video-v1';
const videoPath = new URL('media/video/', self.registration.scope).pathname;
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

async function serveVideo(request) {
  const cache = await caches.open(VIDEO_CACHE);
  const stored = await cache.match(request.url);
  if (!stored) {
    const original = new URL(request.url);
    original.searchParams.delete('portfolio-video');
    return fetch(new Request(original, request));
  }
  const body = await stored.blob();
  const headers = new Headers(stored.headers);
  headers.delete('Content-Encoding');
  headers.set('Accept-Ranges', 'bytes');
  headers.set('X-Portfolio-Video-Cache', 'hit');
  const range = request.headers.get('Range');
  // Without a matching validator, If-Range requires the complete representation.
  const ifRange = request.headers.get('If-Range');
  const canRange = !ifRange || ifRange === headers.get('ETag') || ifRange === headers.get('Last-Modified');
  if (!range || !canRange || request.method === 'HEAD') {
    headers.set('Content-Length', String(body.size));
    return new Response(request.method === 'HEAD' ? null : body, {status: 200, headers});
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  let start, end;
  if (match && (match[1] || match[2])) {
    start = match[1] ? Number(match[1]) : Math.max(0, body.size - Number(match[2]));
    end = match[1] && match[2] ? Math.min(Number(match[2]), body.size - 1) : body.size - 1;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= body.size) {
    headers.set('Content-Range', `bytes */${body.size}`);
    headers.set('Content-Length', '0');
    return new Response(null, {status: 416, headers});
  }
  const part = body.slice(start, end + 1, headers.get('Content-Type') || 'video/mp4');
  headers.set('Content-Range', `bytes ${start}-${end}/${body.size}`);
  headers.set('Content-Length', String(part.size));
  return new Response(part, {status: 206, headers});
}
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(videoPath) ||
      !url.pathname.endsWith('.mp4') || !url.searchParams.has('portfolio-video') ||
      !['GET', 'HEAD'].includes(event.request.method)) return;
  event.respondWith(serveVideo(event.request));
});
self.addEventListener('message', event => {
  if (event.data?.type !== 'portfolio-video-trim' || typeof event.data.release !== 'string') return;
  event.waitUntil((async () => {
    // Do not delete video versions still needed by another open portfolio tab.
    const windows = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
    if (windows.length > 1) return;
    const cache = await caches.open(VIDEO_CACHE);
    for (const request of await cache.keys()) {
      const url = new URL(request.url);
      if (url.pathname.startsWith(videoPath) && url.searchParams.get('portfolio-video') !== event.data.release)
        await cache.delete(request);
    }
  })());
});
