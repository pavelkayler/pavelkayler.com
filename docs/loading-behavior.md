# Loading and image readiness

## Initial entry

The existing primary set has priority: all five Home hero slides, eight Home photos, category cards, Works, Contacts, logo, fonts and route/viewer code. A direct album URL additionally waits for every display-sized image of that selected album. Other albums, zoom files and complete videos do not delay initial entry to Home.

## Navigation

`preparePage` waits for all display-sized photos, cover poster and related cards, not just the first six. `prepareScreen` is for speculative first-screen warming only. A selected destination promotes its work in the shared queue. Pending navigation uses the anonymous fullscreen ring and resource percentage; unchanged fast-path behavior avoids an intentional spinner delay.

Preloader and rendered images use the same viewport/DPR URL selection. Native decoded image handles are retained for at most 32 core images plus the selected page's display URLs. Switching pages releases the previous album's handles. A historical task-ready flag alone is not treated as decoded readiness after release. This is not permanent storage and does not pin all zoom/original files.

After mounting, `usePageImagesReady` checks actual image completion before exposing the page and covers asynchronous decode work with the same loader. Initial entry uses the same mounted-image decoder. The decoder includes offscreen photographs; readiness cannot depend on scrolling. Explicit error/long-wait partial-entry controls are preserved and never count missing files as ready.

## Regression coverage

`album-readiness-smoke.py` holds the final album image while the first six can load, then requires all mounted photos to be complete/visible when the mask disappears. It immediately jumps through the album to its end and checks there are no new display-image HTTP requests. It covers Portraits, Projects and Brands, direct Portraits entry, Back restoration and a final-image failure/retry in Chromium and mobile WebKit emulation. Existing primary-page/preload/cache/lightbox/HTTPS checks remain enabled.

Full-resolution zoom images and video streams remain a separate background tier. Memory-pressure eviction, physical-device rendering and uninterrupted video playback cannot be guaranteed by browser emulation.
