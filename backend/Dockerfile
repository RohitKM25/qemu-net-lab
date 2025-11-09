FROM oven/bun:1
WORKDIR /app/backend

# Install dependencies for qh
RUN apt update && apt install -y qemu-utils qemu-system-x86
RUN apt install -y bridge-utils telnet iproute2 iputils-ping

COPY . .

RUN bun i

# Expose port
EXPOSE 3000
EXPOSE 5000-5099
EXPOSE 5900-5999

# Start backend
CMD ["bun", "index.ts"]
