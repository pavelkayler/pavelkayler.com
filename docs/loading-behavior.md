# One startup, no route loading screens

The initial anonymous percentage loader is the only loading screen. Home, Works
and Contacts receive priority 0. All other page-sized photographs and route code,
then full viewer photographs and cover-video bytes are part of the SAME gate.
There is no automatic timeout that silently exposes an incomplete site. Explicit
retry/partial-site controls remain for failures or very long waits. Partial entry
is deliberately degraded and cannot promise prepared photographs.

All display-sized image handles are retained for this document's lifetime. Zoom
variants retain downloaded native handles but are not all decoded at once. Video
files are downloaded once into Blob URLs to avoid later HTTP Range downloads.
All page-size selections and the largest responsive variants are warmed; Home
viewer srcset candidates are warmed too. Resizing prefers resident variants.

Navigation has no resource loader, mask, toast or progress screen. Route code is
already imported. Pages use the portable CSS fade rather than the native snapshot
View Transition API that timed out on WebKit. Source images, layouts, photo quality,
DNS and hosting are unchanged. Archives are not part of the resource plan.

This prioritizes uninterrupted browsing over first-entry latency and transfers
more data initially, including full video/zoom resources. No Service Worker or
persistent offline installation is added. A full reload/new tab starts a new gate,
using the ordinary browser cache when available. Browser/GPU memory pressure is
not under application control; physical devices still need real-world testing.

`startup-all-smoke.py` holds a final album photograph past five seconds on three
cold browser configurations, verifies ALL planned tasks before reveal, then takes
the context offline and browses every page, whole albums, zoom images and video.
It checks zero route loader mounts, no late/failed transfers, priority/retry/partial
entry and Back. It replaces tests whose premise was the old per-route loader.
The general gallery/UI, stylesheet-cache and full-album scroll suites still run.
