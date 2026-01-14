#!/bin/bash
# Run Chrome without CORS for development
# WARNING: Only use for development! Close all Chrome windows first.

echo "Starting Chrome without CORS restrictions..."
echo "WARNING: This is for development only!"
echo ""

open -na "Google Chrome" --args --user-data-dir="/tmp/chrome_dev_session" --disable-web-security --disable-site-isolation-trials

echo ""
echo "Chrome started. Now run: npm run dev"
echo "Navigate to http://localhost:3001 in the Chrome window that just opened"


