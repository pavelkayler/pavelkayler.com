# One startup, no route loading screens

The initial anonymous percentage loader is the only loading screen. Full Home,
Works and Contacts get first priority, then all remaining page-sized photographs,
route/viewer code, declared fonts, full zoom photographs and complete cover-video
bytes. Nothing automatically dismisses the gate early. Retry and explicit partial
entry are recovery choices; partial entry does not promise ready photographs.

Images retain native handles for the document lifetime. Display-sized variants
are decoded up front rather than every zoom bitmap. Largest variants and all Home
viewer srcset candidates are downloaded too. Resizing selects resident variants.

Video bytes are explicitly cached as complete responses before entry. A small,
media-only Service Worker slices byte ranges out of those stored files. This is
necessary because an ordinary warmed HTTP cache/native player still issued late
Range requests on WebKit, while Blob sources had decoder failures. Video players
opt into CORS mode and are prepared under the initial mask. There is no video
transcoding added. The cache contains only the two public cover videos (~28 MB),
not personal data. Cache keys include the readable build directory. Old versions
are removed when there is no other portfolio tab that could need them.

The worker never intercepts HTML, scripts, photographs, ordinary video URLs or
navigation. Only marked video URLs are handled, leaving deployment freshness and
rollbacks independent of a cached application shell. Removing the feature from a
future build leaves normal original URLs unaffected. Browser storage can still be
evicted; unavailable storage exposes the startup recovery controls.

Navigation has no waiting overlay, toast or resource gate. Prepared pages use a
portable CSS fade, not native View Transition snapshots. Source media, layout,
quality, DNS and hosting are unchanged; archived assets are excluded.

A new document/full reload starts one new gate and reuses caches when possible.
The cold resource set is approximately 317–318 MB and is deliberately more expensive
than staged loading. Browser/GPU memory and physical iPhone behavior still need
real-device verification. Permanent cache residency and zero rendering time are
not promised; this is not an offline installation of the entire site.

Tests hold a final album photograph beyond five seconds, require all planned tasks
before reveal, then disconnect Chromium and deny all new origin requests in WebKit.
Every page, complete album, rapid scroll, zoom viewer, cover and Back must work without
late origin transfers or route-loader mounts. Real media-range cache unit tests and
all previous UI/viewer, stylesheet-cache and complete-album scroll suites remain
required. QA HTTP servers implement video byte ranges as the real Pages origin does.
