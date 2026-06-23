#!/usr/bin/env bash
# ============================================================
# OBS Bible Companion — Mac/Linux Startup Script
#
# Run this script to start the RelayServer.
# Keep this terminal window open while using OBS and Companion.
# Press Ctrl+C to stop when your service is finished.
#
# Usage:
#   chmod +x start.sh   (first time only)
#   ./start.sh
# ============================================================

set -e

# Move to the repo root (same folder as this script).
cd "$(dirname "$0")"

echo ""
echo " =========================================="
echo "  OBS Bible Companion — RelayServer"
echo " =========================================="
echo ""

# Check Node.js is installed.
if ! command -v node &> /dev/null; then
    echo " ERROR: Node.js was not found."
    echo " Please install Node.js from https://nodejs.org and try again."
    echo ""
    exit 1
fi

# Check node_modules exists.
if [ ! -d "node_modules" ]; then
    echo " ERROR: Dependencies are not installed."
    echo " Please run the following command in this folder first:"
    echo ""
    echo "     npm install"
    echo ""
    echo " Then run ./start.sh again."
    echo ""
    exit 1
fi

echo " Starting RelayServer on port 8765..."
echo " Leave this window open during your service."
echo " Press Ctrl+C to stop."
echo ""

npm run start:relay --workspace=project-b