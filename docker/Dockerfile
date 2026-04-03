FROM oven/bun:1 AS builder

WORKDIR /app

COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

FROM oven/bun:1-slim

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/hooks ./hooks

RUN bun install --production --frozen-lockfile

EXPOSE 3001

ENTRYPOINT ["bun", "run", "dist/cli.js"]
CMD ["daemon", "start"]
