FROM node:10-alpine

COPY index.html ./
COPY server.js ./
COPY package*.json ./

COPY . .
WORKDIR ./

RUN npm install



EXPOSE 3000

CMD ["node", "server.js"]
