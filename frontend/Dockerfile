FROM oven/bun:latest AS builder
WORKDIR /app
COPY package*.json bun.lock* ./
RUN bun install

# Copy application files
COPY . .

# Pass build environment variables so they get baked into the React pages securely
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID

RUN bun run build

# Start a new image for the runtime
FROM oven/bun:latest AS runner
WORKDIR /app

ENV NODE_ENV production
ENV PORT 3000
EXPOSE 3000

# Copy necessary files from the builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Run the standalone server
CMD ["bun", "server.js"]
