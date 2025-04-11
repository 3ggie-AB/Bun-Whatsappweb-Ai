FROM oven/bun:1.0

RUN apt-get update && apt-get install -y \
  wget ca-certificates fonts-liberation libappindicator3-1 \
  libasound2 libatk-bridge2.0-0 libatk1.0-0 libcups2 libdbus-1-3 \
  libgdk-pixbuf2.0-0 libnspr4 libnss3 libxss1 libxtst6 libxshmfence1 \
  libgbm1 libgtk-3-0 --no-install-recommends && \
  apt-get clean && rm -rf /var/lib/apt/lists/*

# ✅ Skip Puppeteer Chromium download
ENV PUPPETEER_SKIP_DOWNLOAD=true

WORKDIR /app
COPY . .

# ✅ Pastikan https-proxy-agent sudah ada
RUN bun add https-proxy-agent

# ✅ Jalankan install
RUN bun install

CMD ["bun", "app.js"]
