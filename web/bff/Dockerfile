# bff/Dockerfile — first-class BFF image for non-Vercel (nginx-only) hosting.
#
# Build context MUST be web/ntask (so it can COPY api/ and bff/):
#   docker build -f bff/Dockerfile -t ntask-api:<tag> .
#
# The build re-bundles the REAL api/*.ts Vercel Functions with esbuild — this is
# what guarantees the container can never drift from source. There is no committed
# snapshot; the handlers are compiled fresh from web/ntask/api on every build.
# @vercel/node imports are type-only and are erased; the handlers use only Node
# core (crypto) + global fetch, so the runtime image needs no npm dependencies.

# ---- build stage: bundle api/*.ts -> dist/ ----------------------------------
FROM node:20-alpine AS build
WORKDIR /build
RUN npm install -g esbuild@0.24.2
COPY api ./api
# outbase=api preserves the route tree: api/auth/login.ts -> dist/auth/login.js,
# api/graphql.ts -> dist/graphql.js. Glob covers every current + future handler.
RUN esbuild api/graphql.ts api/auth/*.ts \
      --bundle --platform=node --target=node20 --format=cjs \
      --outbase=api --outdir=dist \
      && ls -R dist

# ---- runtime stage: lean node + adapter -------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3080
COPY --from=build /build/dist ./dist
COPY bff/server.cjs ./server.cjs
EXPOSE 3080
USER node
CMD ["node", "server.cjs"]
