# FROM oven/bun:1
# WORKDIR /app/backend
# COPY package.json bun.lockb* ./
# RUN bun install
# COPY . .
# EXPOSE 3000
# CMD ["bun", "index.ts"]

FROM oven/bun:1
WORKDIR /app/backend

# Install dependencies for qh
RUN apt update && apt install -y g++ qemu-utils qemu-system-x86

# Copy backend code including qemu-handler folder
COPY . .

# Compile qh
# RUN g++ -static -O2 -o qemu-handler/qh qemu-handler/qemu_handler.cpp
RUN bun i

# Expose port
EXPOSE 3000
EXPOSE 5900-5999

# Start backend
CMD ["bun", "index.ts"]
