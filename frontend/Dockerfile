FROM oven/bun:1
WORKDIR /app/frontend

COPY . .
RUN bun i
EXPOSE 3000

CMD ["bun", "run", "dev"]
