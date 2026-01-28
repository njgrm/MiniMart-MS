
# 1. Base Image: Install dependencies only when needed
FROM node:20-alpine AS base

# Install dependencies needed for native modules (like sharp or prims) if necessary
RUN apk add --no-cache libc6-compat
WORKDIR /app

# 2. Dependencies Stage: Install node_modules
FROM base AS deps
# Copy package files
COPY package.json package-lock.json* ./
# Install dependencies (use ci for exact version match)
RUN npm ci

# 3. Builder Stage: Build the Next.js app
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED 1

# Build the application
RUN npm run build

# 4. Runner Stage: Create the final lightweight image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy essential files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# Start command
# We use a shell script or direct command. 
# Note: In standalone mode, we run server.js
CMD ["node", "server.js"]
