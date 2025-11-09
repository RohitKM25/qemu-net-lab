FROM oven/bun:1
WORKDIR /app/frontend

COPY . .
RUN bun i --non-interactive --verbose --concurrent-scripts 4
EXPOSE 3000

CMD ["bun", "run", "dev"]
