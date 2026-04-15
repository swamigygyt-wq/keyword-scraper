FROM mcr.microsoft.com/playwright:v1.42.0-jammy

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY server.js ./
COPY already_done.json ./

EXPOSE 3000
CMD ["node", "server.js"]
