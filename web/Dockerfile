# GeldeSat — Coolify / Docker ile kendi sunucunuzda çalıştırma
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# The lockfile is written by npm 11; npm 10 (bundled with node 22) rejects it.
RUN npm install -g npm@11 && npm ci
COPY . .
# Coolify passes build variables as build args; Vite inlines VITE_* at build time.
ARG VITE_GOOGLE_AUTH_ENABLED=false
ENV VITE_GOOGLE_AUTH_ENABLED=$VITE_GOOGLE_AUTH_ENABLED
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000
# fonts-dejavu-core: sharp/librsvg needs a real font for the photo watermark text.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.output ./.output
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/scripts ./scripts
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
EXPOSE 3000
USER node
ENTRYPOINT ["/docker-entrypoint.sh"]
