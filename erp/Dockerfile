FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN chmod +x docker-entrypoint.sh

EXPOSE 3334

ENTRYPOINT ["./docker-entrypoint.sh"]
