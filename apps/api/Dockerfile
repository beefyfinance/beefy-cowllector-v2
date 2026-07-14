FROM node:26-slim AS build
WORKDIR /app

COPY package.json tsconfig.json ./
COPY src ./src
RUN npm install
RUN npm run build

FROM node:26-slim AS runner
WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY heroku-run.sh ./
RUN chmod +x heroku-run.sh

ENTRYPOINT ["./heroku-run.sh"]
CMD ["node", "dist/index.js"]
