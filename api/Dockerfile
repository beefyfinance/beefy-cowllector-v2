FROM oven/bun:1 as base
WORKDIR /app

# Install dependencies only
FROM base AS deps
COPY package.json .
RUN bun install --frozen-lockfile

# Production image
FROM base AS runner
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENTRYPOINT [ "/app/heroku-run.sh" ]
CMD ["bun", "run", "src/index.ts"]

