#!/bin/bash
cd "$(dirname "$0")/.."
mkdir -p archive
if [ "$(ls -A output 2>/dev/null)" ]; then
  mv output/* archive/ 2>/dev/null || true
  echo "تم أرشفة محتويات output/ إلى archive/"
else
  echo "مجلد output فارغ"
fi
