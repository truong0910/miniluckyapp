FROM node:22-alpine AS runner

WORKDIR /app

# Install curl for docker healthcheck
RUN apk add --no-cache curl

# Install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy source code
COPY src/ ./src/

ENV NODE_ENV=production
ENV PORT=8787

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8787/health || exit 1

CMD ["node", "src/server.js"]

