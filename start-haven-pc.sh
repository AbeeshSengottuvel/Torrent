#!/usr/bin/env bash
# Haven - Secure, Ad-Free BitTorrent Client Launcher

echo "========================================================"
echo "  Haven - Secure, Ad-Free BitTorrent Client"
echo "========================================================"
echo ""

if command -v node >/dev/null 2>&1; then
    echo "Starting Haven preview server via Node.js..."
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open http://127.0.0.1:3000 &
    elif command -v open >/dev/null 2>&1; then
        open http://127.0.0.1:3000 &
    fi
    node web/server.js
elif command -v python3 >/dev/null 2>&1; then
    echo "Starting Haven preview server via Python 3..."
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open http://127.0.0.1:3000 &
    elif command -v open >/dev/null 2>&1; then
        open http://127.0.0.1:3000 &
    fi
    cd web && python3 -m http.server 3000
else
    echo "[Error] Neither Node.js nor Python 3 was found on your system."
    exit 1
fi
