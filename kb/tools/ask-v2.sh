#!/bin/zsh
# Ask Henry's owned engine (chat-proxy-v2) via a local `netlify dev` server.
# Usage: kb/tools/ask-v2.sh "question here"
# Prereq: `netlify dev` running in another terminal (default port 8888),
# ANTHROPIC_API_KEY present in .env.
Q="$1"
[ -n "$Q" ] || { echo "usage: ask-v2.sh \"question\""; exit 1; }
curl -s -X POST "http://localhost:8888/.netlify/functions/chat-proxy-v2" \
  -H "Content-Type: application/json" \
  -d "$(python3 -c 'import json,sys; print(json.dumps({"message": sys.argv[1]}))' "$Q")" \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("response") or d)'
