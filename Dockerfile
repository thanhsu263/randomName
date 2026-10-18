# ---- build ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
# better-sqlite3 cần biên dịch native khi không có bản dựng sẵn cho phiên bản Node này
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# ---- runtime ----
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DB_PATH=/app/data/app.db
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["node", "dist/server.js"]
