FROM node:20-slim AS builder

WORKDIR /app

# Install dependencies first (better cache)
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# Runtime image to serve static files
FROM node:20-slim AS runner
WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist ./dist

ENV HOST=0.0.0.0
EXPOSE 4173

CMD ["serve", "-s", "dist", "-l", "4173"]
