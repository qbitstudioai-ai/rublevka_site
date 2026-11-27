# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package*.json ./
RUN npm ci
COPY events-original/package*.json ./events-original/
# Main-site types refer to the SQLite adapter, but the SQLite runtime stays in the event container.
RUN mkdir -p events-original/node_modules/@types/better-sqlite3 \
 && node -e 'const fs=require("fs"), crypto=require("crypto");const entry=require("./events-original/package-lock.json").packages["node_modules/@types/better-sqlite3"];fetch(entry.resolved).then(async r=>{if(!r.ok)throw Error("Cannot download SQLite types");const b=Buffer.from(await r.arrayBuffer());if("sha512-"+crypto.createHash("sha512").update(b).digest("base64")!==entry.integrity)throw Error("SQLite types integrity mismatch");fs.writeFileSync("/tmp/sqlite-types.tgz",b)})' \
 && tar -xzf /tmp/sqlite-types.tgz --strip-components=1 -C events-original/node_modules/@types/better-sqlite3 \
 && rm /tmp/sqlite-types.tgz
COPY --chown=node:node . .
RUN chown node:node /app
USER node
ARG SITE_URL
ENV SITE_URL=${SITE_URL} SEO_INDEXING_ENABLED=false EVENTS_ORIGINAL_ORIGIN=http://events:3000
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
