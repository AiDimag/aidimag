# aidimag MCP server — stdio transport, for Glama.ai introspection builds.
# (For the self-hosted team sync server, see deploy/Dockerfile.)
FROM node:22-slim

WORKDIR /app

# better-sqlite3 falls back to compiling from source when no prebuilt
# binary matches the image's platform (e.g. linux/arm64 build hosts).
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
# better-sqlite3 ships bundled prebuilds (no install-time download), and its
# linux-arm64 prebuild is linked against a newer glibc than this base image
# ships (GLIBC_2.38 dlopen failure at runtime). Recompile from source against
# the toolchain installed above, then remove the mismatched prebuild —
# binding.js always prefers prebuilds/*.node over build/Release when present.
RUN npm run build-release --prefix node_modules/better-sqlite3 \
    && rm -rf node_modules/better-sqlite3/prebuilds

COPY src ./src
RUN npm run build

# findRepoRoot() requires a .git or .aidimag dir at the store root; this
# container has neither a mounted repo nor a pre-existing store, so create
# the marker directory the store creation step (create: true) will fill in.
RUN mkdir -p .aidimag

ENV AIDIMAG_REPO=/app

ENTRYPOINT ["node", "dist/mcp/server.js"]
