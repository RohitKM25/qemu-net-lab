FROM oven/bun:1
WORKDIR /app/frontend

COPY ./bun.lock ./package.json ./
RUN bun i --non-interactive --verbose --concurrent-scripts 4
COPY . .
EXPOSE 3000

CMD ["bun", "run", "dev"]
