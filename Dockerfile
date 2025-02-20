FROM node:20-alpine

# ติดตั้ง git, tzdata และ zip
RUN apk add --no-cache git tzdata zip

# ตั้งค่า timezone เป็น UTC+7
RUN ln -sf /usr/share/zoneinfo/Asia/Bangkok /etc/localtime

# ตั้งค่า working directory
WORKDIR /app

# คัดลอกไฟล์ package.json และ package-lock.json (ถ้ามี) ก่อน
COPY package*.json ./

# ติดตั้ง dependencies
RUN npm install

# คัดลอกไฟล์ทั้งหมดไปยัง working directory
COPY . .

# เปิดพอร์ตที่ต้องการ
EXPOSE 33322

# รันแอปพลิเคชัน
CMD ["node", "app.js"]  # หรือใช้ path ที่ถูกต้อง
