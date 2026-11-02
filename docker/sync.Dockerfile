FROM node:22-alpine

WORKDIR /sync
COPY sync/package*.json ./
RUN npm ci --omit=dev
COPY sync/*.mjs ./

CMD ["npm", "start"]
