# ---- build ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# ---- runtime ----
FROM node:22-bookworm-slim
WORKDIR /app
# CSDL: file SQLite trong volume (DB_PATH), hoặc đặt TURSO_DATABASE_URL + TURSO_AUTH_TOKEN để dùng Turso
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DB_PATH=/app/data/app.db
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["node", "dist/server.js"]
