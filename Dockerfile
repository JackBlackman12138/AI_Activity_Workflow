FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/api/package.json packages/api/package.json
COPY packages/worker/package.json packages/worker/package.json
COPY packages/database/package.json packages/database/package.json
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve@14
COPY --from=build /app/apps/web/dist ./dist
EXPOSE 4173
CMD ["serve", "-s", "dist", "-l", "4173"]
