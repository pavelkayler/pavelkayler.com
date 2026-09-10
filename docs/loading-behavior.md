# Current first-screen startup, then native lazy loading

The startup screen waits only for the route the visitor actually opened: its logo,
first-screen image set, route module and interface fonts. It no longer makes entry
depend on Home, Works or Contacts when they are not the current route, and PhotoSwipe
is not a startup dependency. Direct album entry primes its cover plus the first row;
a final DOM check promotes and decodes any additional image that is actually visible
before the startup mask disappears. Retry and explicit partial entry still handle
genuine first-screen errors; the timer does not silently report failed resources as
ready.

Each normal image keeps its responsive variants and native loading=lazy unless it is
an entry/priority image. The responsive selector uses the real pixel width encoded in
maintained filenames (for example 640x912) instead of the old Wfolio layout descriptors
(600w/1240w/1880w), preventing unnecessary jumps to the next, much larger variant.
One shared IntersectionObserver per actual scroll container promotes images to eager
within two container heights below the viewport: three screens in total (the current
screen plus the next two). Root margins update on resize. No scroll handler scans the
gallery. The browser may request a native-lazy image earlier; the observer is not a
strict network boundary or a promise that an arbitrary jump to the very end is instant.

After entry, only the first screens of other sections may warm at low priority (two
speculative queue slots). Save-Data/2G disables this optional speculation. There is no
automatic full-album background download. The slider prepares only its next slide and
keeps the current slide if the next cannot be fetched. Full viewer images are requested
on opening, with PhotoSwipe's small neighbor preload. Video covers display a poster
immediately and use native muted inline playback only when near the screen after startup.
Reduced motion keeps the poster.

Production media processing leaves tracked source photographs untouched. JPEGs above
512 KiB are re-encoded progressively at quality 89 when that saves at least five percent.
The photographic PNG used by the first Home slide is additionally converted to WebP in
the production artifact, and generated bundle references are switched to the smaller
WebP variants only when conversion reduces bytes. Original PNGs remain in the artifact
as a conservative fallback/source copy.

The preload cache holds at most 32 image handles, not all source/zoom media. Layouts,
routing and portable CSS fades are unchanged. There is no route overlay for already
prepared destinations and no all-site startup gate.

The old video-only Service Worker is no longer registered or awaited. We unregister
only its exact script URL asynchronously. Its compatibility file and existing video
cache remain for older still-open tabs; no other registrations or caches are cleared.
New playback uses original URLs and does not rely on Cache Storage.

An instant scrollbar jump or a very slow connection may still outrun lazy loading.
Tests record startup file bytes and server timing as measurements, not universal speed
promises. Physical-device memory and network conditions need separate tests.
