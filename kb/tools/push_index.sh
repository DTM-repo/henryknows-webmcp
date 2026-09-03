#!/bin/zsh
# Push the built KB index to the production Netlify Blobs store.
# Zero deploys, zero build credits — the chat function reads the new index on
# its next cold start (warm instances keep the old one until they recycle).
# Run from the repo root after: python3 kb/tools/build_index.py
set -e
cd "$(dirname "$0")/../.."
[ -f kb/index/index.json.gz ] || { echo "no index built — run build_index.py first"; exit 1; }
netlify blobs:set kb-index index.json.gz --input kb/index/index.json.gz
echo "pushed kb/index/index.json.gz -> Blobs store 'kb-index'"
