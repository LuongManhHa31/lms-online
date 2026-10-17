FROM node:20-alpine

WORKDIR /usr/src/app

# Cài đặt curl để phục vụ healthcheck
RUN apk add --no-cache curl

# Sao chép file cấu hình package
COPY package*.json ./

# Cài đặt dependencies
RUN npm install --omit=dev

# Sao chép toàn bộ source code
COPY . .

# Mở cổng ứng dụng
EXPOSE 3000

# Khởi chạy ứng dụng
CMD ["node", "src/app.js"]
