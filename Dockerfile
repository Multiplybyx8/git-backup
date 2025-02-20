FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Set the timezone to UTC+7
RUN apk --no-cache add tzdata && \
  ln -sf /usr/share/zoneinfo/Asia/Bangkok /etc/localtime

EXPOSE 33322

CMD ["node", "app.js"]

