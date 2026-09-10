# One startup, no route loading screens

The initial anonymous percentage loader is the only loading screen. Full Home,
Works and Contacts get first priority, then all remaining page-sized photographs,
route/viewer code, declared fonts, full zoom photographs and complete cover-video
bytes. Nothing automatically dismisses the gate early. Retry and explicit partial
entry are recovery choices; partial entry does not promise ready photographs.

Images retain native handles for the document lifetime. Only display-sized variants
are decoded up front, rather than every full zoom bitmap. Largest variants and all
Home viewer srcset candidates are downloaded too. Resize chooses resident variants.
Video preparation retains full downloaded Blobs and usable native players. It probes
Blob srcObject, a typed source and native HTTP without user-agent sniffing. Complete
transfer is established by consuming the entire response; TimeRanges is not used as
a byte-download counter. Reuse is tested with the origin unavailable. Covers reuse
prepared players rather than creating a new decoder on each visit.

Navigation has no waiting overlay, toast or resource gate. Prepared routes use a
portable CSS fade, not native View Transition snapshots. No source media, layout,
quality, DNS or hosting changes. Archives are excluded. No Service Worker is added.
A new document/full reload starts one new gate and reuses browser caches when possible.
The cold resource set approaches 300 MiB and is more expensive than staged loading.
Browser/GPU memory and physical iPhone behavior need real-device verification; neither
permanent cache residency nor zero rendering time is promised.

Tests hold a final album photo beyond five seconds and require all planned resources
before reveal. Chromium then disconnects its network; WebKit uses a real origin that
returns 503 to every new request. All pages, complete albums, rapid scrolling, zoom,
covers and Back must work with no late origin transfers and no route-loader mounts.
Tests whose contract was a per-route spinner have been replaced, not the underlying
all-photo assertions. UI/viewer, stylesheet-cache and album-scroll suites still gate
publication. QA HTTP servers support video byte ranges like the real Pages origin.
