FROM node:20-alpine AS base

RUN apk add --no-cache python3 make g++ git curl bash

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

FROM base AS dev
RUN npm ci
COPY . .
RUN npm run build

FROM base AS production
COPY --from=dev /app/dist ./dist
COPY --from=dev /app/node_modules ./node_modules

EXPOSE 3000
CMD ["node", "dist/index.js"]