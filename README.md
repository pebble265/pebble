# pebble(a)

หุ่นยนต์คู่หูช่วยดูแลการกินยา + แอปมือถือ

| โฟลเดอร์ | คืออะไร |
|---|---|
| `apps/api` | Backend (NestJS + Prisma) |
| `apps/mobile` | แอปมือถือ (Expo / React Native) |
| `apps/admin` | เว็บ admin (หน้าเดียว ไม่ต้อง build) |
| `database` | โครงสร้างฐานข้อมูล PostgreSQL + migrations |
| `firmware/esp32` | เฟิร์มแวร์บอร์ด ESP32-S3 (Arduino) |
| `firmware/raspberry-pi` | แอปบน Raspberry Pi 5 (Python) |
| `docker-compose.yml` | ฐานข้อมูล PostgreSQL |

## รันบน Mac (ใช้แค่ Terminal)

ต้องมีก่อน: **Docker Desktop** (เปิดโปรแกรมไว้) และ **Node.js 20+** (ถ้ามี Homebrew สคริปต์ติดตั้ง Node ให้เอง)

```bash
git clone https://github.com/pebble265/pebble.git
cd pebble
./setup.sh      # ครั้งแรกครั้งเดียว: สร้าง .env + ฐานข้อมูล + ติดตั้งทุกอย่าง
./start.sh      # เปิดระบบ (ปิดด้วย Ctrl+C)
```

`./start.sh` เปิดให้:
- Backend: http://localhost:3000 (log อยู่ที่ `logs/api.log`)
- ฐานข้อมูล: localhost:5433
- เว็บ admin: http://localhost:8091 (ที่หน้าล็อกอิน กด "เซิร์ฟเวอร์" แล้วใส่ `http://localhost:3000/tb`)
- แอปมือถือ: Expo ขึ้น QR ให้สแกน (มือถือต้องอยู่ Wi-Fi เดียวกับ Mac)

แบบอื่น:
- `./start.sh ios` build แอปลง iOS Simulator (ต้องมี Xcode) ใช้ทางนี้ถ้า Expo Go เปิดแอปไม่ได้ เพราะแอปใช้ Bluetooth ซึ่ง Expo Go ไม่มี
- `./start.sh api` เปิดเฉพาะ backend + ฐานข้อมูล + เว็บ admin

## ค่าลับ (.env)

`setup.sh` สร้าง `.env`, `apps/api/.env`, `apps/mobile/.env` ให้เองพร้อมรหัสสุ่ม ไฟล์เหล่านี้**ไม่ขึ้น git**
ถ้าจะใช้แชตกับ Pebbi ให้ใส่ `ANTHROPIC_API_KEY` ใน `apps/api/.env` เอง (ขอจากเจ้าของโปรเจกต์ทางแชตส่วนตัว อย่าวางลง git)
ฐานข้อมูลของแต่ละเครื่องแยกกัน เริ่มต้นว่างเปล่า ให้สมัครบัญชีใหม่ในแอป

## หุ่นยนต์

ดู `firmware/raspberry-pi/README.md` (ติดตั้งบน Pi) และ `firmware/esp32/README.md` (อัปโหลดเฟิร์มแวร์ด้วย Arduino IDE)
