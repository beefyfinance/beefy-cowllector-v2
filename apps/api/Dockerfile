# Build from monorepo root:
#   docker build -f apps/api/Dockerfile -t cowllector-api .
FROM node:26-slim AS build
RUN npm install -g pnpm@11.13.0

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/tsconfig.json ./apps/api/
COPY apps/api/src ./apps/api/src

RUN pnpm install --frozen-lockfile --filter @beefyfinance/cowllector-api
RUN pnpm --filter @beefyfinance/cowllector-api build
RUN pnpm --filter @beefyfinance/cowllector-api deploy --prod --legacy /prod

FROM node:26-slim AS runner
WORKDIR /app

COPY --from=build /prod ./
COPY --from=build /app/apps/api/dist ./dist
COPY apps/api/heroku-run.sh ./
RUN chmod +x heroku-run.sh

ENTRYPOINT ["./heroku-run.sh"]
CMD ["node", "dist/index.js"]
