#FROM oven/bun:alpine
FROM node:20-alpine

WORKDIR /app

COPY package.json ./

RUN npm install

#RUN bun add mysql2
#RUN bun add @faker-js/faker@7.6.0

COPY . .

CMD ["node", "seed.js"]
