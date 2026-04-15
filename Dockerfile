FROM node:20-slim

# Install system Chromium (much smaller than full Playwright image)
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /app
COPY package.json ./
RUN npm install --production --ignore-scripts
COPY server.js ./
COPY already_done.json ./

EXPOSE 3000
CMD ["node", "server.js"]
