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
# CSDL: PGlite (Postgres nhúng) lưu trong volume /app/data/pgdata, hoặc đặt DATABASE_URL để dùng Neon
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 PGLITE_DIR=/app/data/pgdata
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["node", "dist/server.js"]
