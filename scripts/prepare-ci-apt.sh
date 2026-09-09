#!/usr/bin/env bash
# Playwright installs its own pinned Chromium/WebKit, not system Google Chrome.
# A Chrome apt index with a hash mismatch must not block unrelated Ubuntu deps.
# Only adjust the ephemeral GitHub runner; never weaken apt hash/signature checks.
set -euo pipefail
if [[ "${GITHUB_ACTIONS:-}" != "true" ]]; then exit 0; fi
for source in /etc/apt/sources.list.d/*chrome*.list /etc/apt/sources.list.d/*chrome*.sources; do
  [[ -f "$source" ]] || continue
  if grep -qE 'https?://dl\.google\.com/linux/chrome(-stable)?/deb' "$source"; then
    echo "Disabling unused system Chrome feed for this Playwright runner: $source"
    sudo mv "$source" "${source}.disabled-for-playwright"
  fi
done
