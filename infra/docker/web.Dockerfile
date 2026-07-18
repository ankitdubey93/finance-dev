# Vite dev server for the SPA shell. Uses the pnpm workspace (imports the
# tool-registry). Runs the dev server so the /api proxy → platform-api is live.
FROM node:20-slim

RUN corepack enable
WORKDIR /repo

COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY libs ./libs
COPY apps/web ./apps/web

RUN pnpm install --no-frozen-lockfile

WORKDIR /repo/apps/web
EXPOSE 5173
CMD ["pnpm", "dev"]
