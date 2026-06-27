#!/usr/bin/env bash
# ============================================================
# OBS Bible Companion — Mac/Linux First-Time Setup Script
#
# Run this once after cloning the repo, and again any time
# you add a new Bible translation.
#
# Usage:
#   chmod +x setup.sh   (first time only)
#   ./setup.sh
#
# What this does:
#   1. Checks Node.js is installed
#   2. Installs all dependencies (npm install)
#   3. Generates bible_structure.json from your translation files
#   4. Builds the OBS plugin HTML (project-a)
#   5. Builds the Companion module (project-b/dist/main.js)
#
# After setup, point Bitfocus Companion's Developer modules path at:
#   <this folder>/project-b
# ============================================================

set -e
cd "$(dirname "$0")"

echo ""
echo " =========================================="
echo "  OBS Bible Companion — First-Time Setup"
echo " =========================================="
echo ""

# ── Step 1: Check Node.js ───────────────────────────────────
if ! command -v node &> /dev/null; then
    echo " ERROR: Node.js was not found."
    echo " Please install Node.js from https://nodejs.org and try again."
    echo ""
    exit 1
fi
echo " [1/5] Node.js found: $(node --version)"

# ── Step 2: npm install ─────────────────────────────────────
echo " [2/5] Installing dependencies..."
npm install
echo " [2/5] Dependencies installed."

# ── Step 3: Generate bible_structure.json ───────────────────
echo " [3/5] Generating Bible metadata..."
npm run generate:metadata --workspace=project-b
echo " [3/5] Bible metadata generated."

# ── Step 4: Build OBS plugin HTML ───────────────────────────
echo " [4/5] Building OBS plugin..."
npm run build --workspace=project-a
echo " [4/5] OBS plugin built."

# ── Step 5: Build Companion module ──────────────────────────
echo " [5/5] Building Companion module..."
npm run build --workspace=project-b
echo " [5/5] Companion module built."

# ── Done ────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo " =========================================="
echo "  Setup complete!"
echo " =========================================="
echo ""
echo " Next steps:"
echo ""
echo " 1. Open the Bitfocus Companion Launcher"
echo "    Click the cog icon and set Developer modules path to:"
echo ""
echo "      $SCRIPT_DIR/project-b"
echo ""
echo " 2. Open Bitfocus Companion in your browser"
echo "    Add a new connection and search for 'OBS Bible'"
echo ""
echo " 3. Open OBS Studio"
echo "    Go to View > Docks > Custom Browser Docks"
echo "    Add a dock pointing to:"
echo ""
echo "      $SCRIPT_DIR/project-a/src/index.html"
echo ""
echo " 4. Add a Browser Source on your scene pointing to:"
echo ""
echo "      $SCRIPT_DIR/project-a/src/browser_source.html"
echo ""