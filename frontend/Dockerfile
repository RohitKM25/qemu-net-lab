FROM oven/bun:1
WORKDIR /app/frontend
ENV BUN_INSTALL_CONCURRENCY=4
COPY ./bun.lock ./package.json ./
RUN bun i --non-interactive
COPY . .
EXPOSE 3000

CMD ["bun", "run", "dev"]
