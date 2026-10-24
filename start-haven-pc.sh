#!/usr/bin/env bash
# Haven - Secure, Ad-Free BitTorrent Client Launcher

echo "========================================================"
echo "  Haven - Secure, Ad-Free BitTorrent Client"
echo "========================================================"
echo ""

if [ -f "desktop/dist/Haven-linux-x64/Haven" ]; then
    echo "Launching Native Desktop Application..."
    ./desktop/dist/Haven-linux-x64/Haven &
    exit 0
fi

if [ -d "desktop/node_modules/electron" ]; then
    echo "Launching Desktop App via Electron..."
    cd desktop && npm start
    exit 0
fi

echo "[Notice] Native desktop binary not found."
echo "To build or run the desktop client:"
echo "  cd desktop"
echo "  npm install"
echo "  npm start"
exit 0
