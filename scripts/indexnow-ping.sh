#!/bin/zsh
# Notify IndexNow-participating engines (Bing, Yandex, others) of new/updated
# URLs on henryknows.info. Run after any deploy that adds or changes pages.
# Usage: scripts/indexnow-ping.sh url1 url2 ...   (paths or full URLs)
#        scripts/indexnow-ping.sh --sitemap       (ping every sitemap URL)
set -e
cd "$(dirname "$0")/.."
KEY=$(grep "^INDEXNOW_KEY=" .env | cut -d= -f2)
[ -n "$KEY" ] || { echo "INDEXNOW_KEY missing from .env"; exit 1; }

if [ "$1" = "--sitemap" ]; then
  URLS=("${(@f)$(grep -o "<loc>[^<]*" public/sitemap.xml | sed 's/<loc>//')}")
else
  URLS=()
  for u in "$@"; do
    case "$u" in
      http*) URLS+=("$u") ;;
      *) URLS+=("https://henryknows.info$u") ;;
    esac
  done
fi

python3 - "$KEY" "${URLS[@]}" <<'EOF'
import json, sys, urllib.request
key, urls = sys.argv[1], sys.argv[2:]
body = json.dumps({
    "host": "henryknows.info",
    "key": key,
    "keyLocation": f"https://henryknows.info/{key}.txt",
    "urlList": urls,
}).encode()
req = urllib.request.Request("https://api.indexnow.org/indexnow", data=body,
    headers={"Content-Type": "application/json; charset=utf-8"}, method="POST")
with urllib.request.urlopen(req, timeout=30) as r:
    print(f"IndexNow: HTTP {r.status} for {len(urls)} URLs")
EOF
