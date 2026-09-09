#!/usr/bin/env bash
# A successful deployment must be reachable with a valid TLS certificate.
set -euo pipefail
readonly ORIGIN='https://pavelkayler.com'
readonly MAX_ATTEMPTS="${SMOKE_ATTEMPTS:-6}"
readonly EXPECTED="${EXPECTED_COMMIT:-}"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
CURL=(curl --silent --show-error --connect-timeout 5 --max-time 15 --retry 0)

check_status() {
  local url="$1" expected="$2" code
  code=$("${CURL[@]}" --proto '=https' --output "$TMP/body" --write-out '%{http_code}' "$url") || return 1
  if [[ "$code" != "$expected" ]]; then
    echo "FAIL $url: expected $expected, got $code" >&2
    return 1
  fi
  echo "PASS $code $url"
}

check_redirect() {
  local source="$1" target="$2" first final
  first=$("${CURL[@]}" --output /dev/null --write-out '%{http_code}' "$source") || return 1
  case "$first" in 301|302|307|308) ;; *) echo "FAIL no redirect: $source ($first)" >&2; return 1;; esac
  # HTTPS is mandatory for every redirect destination; certificate checks stay on.
  final=$("${CURL[@]}" --location --max-redirs 4 --proto '=http,https' --proto-redir '=https' --output /dev/null --write-out '%{http_code} %{url_effective}' "$source") || return 1
  [[ "$final" == "200 $target" ]] || { echo "FAIL $source -> $final; expected 200 $target" >&2; return 1; }
  echo "PASS $source -> $target"
}

check_all() {
  local route
  for route in / /works/ /portraits/ /projects/ /brands/ /contacts/; do
    check_status "$ORIGIN$route" 200 || return 1
    grep -q 'id="root"' "$TMP/body" || { echo "FAIL application shell missing: $route" >&2; return 1; }
  done
  check_status "$ORIGIN/robots.txt" 200 || return 1
  grep -q "Sitemap: $ORIGIN/sitemap.xml" "$TMP/body" || return 1
  check_status "$ORIGIN/sitemap.xml" 200 || return 1
  grep -q "<loc>$ORIGIN/works/</loc>" "$TMP/body" || return 1
  check_status "$ORIGIN/__github_pages_smoke_missing__" 404 || return 1
  grep -qi 'noindex' "$TMP/body" || { echo 'FAIL 404 page must be noindex' >&2; return 1; }

  check_redirect 'http://pavelkayler.com/' "$ORIGIN/" || return 1
  check_redirect 'http://pavelkayler.com/works/?smoke=1' "$ORIGIN/works/?smoke=1" || return 1
  check_redirect 'https://www.pavelkayler.com/' "$ORIGIN/" || return 1
  check_redirect 'http://www.pavelkayler.com/' "$ORIGIN/" || return 1
  check_redirect 'https://www.pavelkayler.com/works/?smoke=1' "$ORIGIN/works/?smoke=1" || return 1

  if [[ -n "$EXPECTED" ]]; then
    check_status "$ORIGIN/build-info.json?commit=$EXPECTED" 200 || return 1
    python3 - "$TMP/body" "$EXPECTED" <<'PY' || return 1
import json, sys
with open(sys.argv[1], encoding='utf-8') as file:
    data = json.load(file)
assert data.get('commit') == sys.argv[2], f"Wrong published revision: {data}"
print('PASS published revision', data['commit'])
PY
  fi
}

for ((attempt=1; attempt<=MAX_ATTEMPTS; attempt++)); do
  echo "Live HTTPS check $attempt/$MAX_ATTEMPTS"
  if check_all; then
    echo 'All TLS, route, canonical redirect and release checks passed.'
    exit 0
  fi
  if (( attempt < MAX_ATTEMPTS )); then sleep 15; fi
done
echo '::error::Live production verification failed. A green build is not a healthy release.' >&2
exit 1
