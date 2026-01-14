#!/bin/bash
# Run Next.js dev server with HTTPS for local testing

# Install mkcert if not already installed (macOS with Homebrew)
# brew install mkcert
# mkcert -install

# Create local certificates (only need to run once)
if [ ! -f localhost.pem ]; then
  echo "Creating local SSL certificates..."
  mkcert -install
  mkcert localhost 10.0.0.47 127.0.0.1 ::1
fi

# Run Next.js with HTTPS
NODE_OPTIONS='--no-warnings' npm run dev

