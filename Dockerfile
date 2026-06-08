FROM node:20-slim

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of the source code
COPY . .

# Build TypeScript
RUN pnpm run build

# Expose port 5000 (Backend default port)
EXPOSE 5000

# Start server
CMD ["pnpm", "run", "start"]
