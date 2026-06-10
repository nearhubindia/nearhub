FROM node:20-bookworm-slim

WORKDIR /app/server

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 5000

CMD ["npm", "run", "dev"]
