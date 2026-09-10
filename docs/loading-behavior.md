# Small first-screen startup, then native lazy loading

The only startup screen waits for the first Home slide, the three Works cards,
Contacts photo, logo, primary/entry route modules, viewer code and fonts actually
used by the interface. Direct album entry also prepares its first screen. It does
not wait for the full Home page, the rest of the slider, entire albums, zoom images
or video files. A final check decodes only currently visible entry images. Retry
and explicit partial entry still handle genuine first-screen errors; the timer
does not silently report failed resources as ready.

Each normal image has its existing responsive size and native loading=lazy unless
it is an entry/priority image. One shared IntersectionObserver per actual scroll
container promotes images to eager when they are within two container heights below
the viewport: three screens total, the visible one plus two ahead. Root margins
update on resize. No scroll handler scans the gallery.
The browser may request a native-lazy image earlier; the observer is not a strict
network boundary or a promise that an arbitrary jump to the very end is instant.

After entry, only the first screens of other sections may warm at low priority
(two speculative queue slots). Save-Data/2G disables this optional speculation.
There is no automatic full-album background download. The slider prepares only
its next slide and keeps the current slide if the next cannot be fetched. Full
viewer images are requested on opening, with PhotoSwipe's small neighbor preload.
Video covers display a poster immediately and use native muted inline playback
only when near the screen after startup. Reduced motion keeps the poster.

The preload cache holds at most 32 image handles, not all source/zoom media.
Source image quality, layouts, routing and portable CSS fades are unchanged.
There is no route overlay and no per-route image readiness gate. Whole-page and
all-site-offline tests were replaced with cold-entry/deferred-tail/ahead-scroll
checks; photo viewer, navigation, stylesheet-cache and HTTPS tests remain required.

The old video-only Service Worker is no longer registered or awaited. We unregister
only its exact script URL asynchronously. Its compatibility file and existing
video cache remain for older still-open tabs; no other registrations or caches
are cleared. New playback uses original URLs and does not rely on Cache Storage.

An instant scrollbar jump or a very slow connection may still outrun lazy loading.
Tests record startup file bytes and server timing as measurements, not universal
speed promises. Physical-device memory and network conditions need separate tests.
