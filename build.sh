#!/usr/bin/env bash
# Render build script - installs Chrome dependencies + npm packages
set -e

# Install Chrome dependencies that Puppeteer needs  
apt-get update -qq
apt-get install -yqq --no-install-recommends \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 \
  libpango-1.0-0 libcairo2 libasound2 libxshmfence1 \
  fonts-liberation ca-certificates wget gnupg

# Install npm packages (this downloads Puppeteer's Chrome)
npm install

echo "Build complete!"
