FROM node:24-alpine AS build

WORKDIR /home/node/app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:24-alpine
WORKDIR /home/node/app
COPY --from=build /home/node/app/package*.json ./
COPY --from=build /home/node/app/node_modules ./node_modules
COPY --from=build /home/node/app/dist ./dist

EXPOSE 5000
CMD ["node", "dist/index.js"]
