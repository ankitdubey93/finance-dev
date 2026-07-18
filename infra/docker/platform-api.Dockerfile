# Platform gateway. Imports the tool-registry at runtime, so this image uses the
# pnpm workspace (registry is a linked workspace package). Only the manifests,
# libs, and this app are copied → workspace globs resolve to just these.
FROM node:20-slim

RUN corepack enable
WORKDIR /repo

COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY libs ./libs
COPY apps/platform-api ./apps/platform-api

RUN pnpm install --no-frozen-lockfile

WORKDIR /repo/apps/platform-api
EXPOSE 3000
CMD ["pnpm", "start"]
