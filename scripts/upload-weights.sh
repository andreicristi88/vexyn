#!/usr/bin/env bash
# Upload SDXS weights to R2. Run from the vexyn repo root:
#   bash scripts/upload-weights.sh /path/to/out
# Requires: R2 enabled on the account, bucket created (see below).
#
# One-time setup (after enabling R2 in the dashboard):
#   npx wrangler r2 bucket create vexyn-models
#   npx wrangler r2 bucket cors put vexyn-models --file scripts/r2-cors.json
#   npx wrangler r2 bucket domain add vexyn-models --domain models.vexyn.app --zone-id <ZONE_ID>
set -euo pipefail

SRC="${1:?usage: upload-weights.sh /path/to/out}"
BUCKET="vexyn-models"
PREFIX="sdxs-512-v1"

for f in runtime.json text_encoder/model.onnx unet/model.onnx vae_decoder/model.onnx; do
  [ -f "$SRC/$f" ] || { echo "LIPSA: $SRC/$f"; exit 1; }
done

echo "Urc din $SRC in r2://$BUCKET/$PREFIX/ ..."
npx wrangler r2 object put "$BUCKET/$PREFIX/runtime.json" \
  --file "$SRC/runtime.json" --content-type "application/json" --remote

for part in text_encoder unet vae_decoder; do
  size=$(du -h "$SRC/$part/model.onnx" | cut -f1)
  echo "  $part ($size)..."
  npx wrangler r2 object put "$BUCKET/$PREFIX/$part/model.onnx" \
    --file "$SRC/$part/model.onnx" \
    --content-type "application/octet-stream" \
    --cache-control "public, max-age=31536000, immutable" \
    --remote
done

echo "Gata. Verificare:"
echo "  curl -sI https://models.vexyn.app/$PREFIX/runtime.json"
