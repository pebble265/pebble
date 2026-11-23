#!/usr/bin/env bash
# pebble(a): เปิดระบบทั้งหมด  ->  ./start.sh        (ปิดด้วย Ctrl+C)
#   ./start.sh          backend + ฐานข้อมูล + เว็บ admin + แอปมือถือ (Expo, สแกน QR)
#   ./start.sh ios      เหมือนข้างบน แต่ build แอปลง iOS Simulator (ต้องมี Xcode)
#   ./start.sh api      เฉพาะ backend + ฐานข้อมูล + เว็บ admin
set -uo pipefail
cd "$(dirname "$0")"
mkdir -p logs
[[ -f apps/api/.env && -d apps/api/node_modules ]] || { echo "ยังไม่ได้ติดตั้ง: รัน ./setup.sh ก่อน"; exit 1; }
ok() { printf '   \033[32m✓ %s\033[0m\n' "$1"; }

docker info >/dev/null 2>&1 || { open -a Docker 2>/dev/null; echo "รอ Docker…"; for i in $(seq 1 60); do docker info >/dev/null 2>&1 && break; sleep 2; done; }
docker compose up -d db >/dev/null && ok "ฐานข้อมูล: localhost:5433"

OLD=$(lsof -ti tcp:3000 2>/dev/null); [[ -n "$OLD" ]] && kill $OLD 2>/dev/null && sleep 1
(cd apps/api && npm run build >/dev/null 2>&1; nohup npm run start:prod > ../../logs/api.log 2>&1 &)
for i in $(seq 1 30); do grep -q "successfully started" logs/api.log 2>/dev/null && break; sleep 1; done
grep -q "successfully started" logs/api.log && ok "backend: http://localhost:3000   (log: logs/api.log)" || echo "   ! backend ยังไม่ขึ้น ดู logs/api.log"

OLD=$(lsof -ti tcp:8091 2>/dev/null); [[ -n "$OLD" ]] && kill $OLD 2>/dev/null
(cd apps/admin && nohup python3 -m http.server 8091 > ../../logs/admin.log 2>&1 &)
ok "เว็บ admin: http://localhost:8091   (หน้าล็อกอิน > เซิร์ฟเวอร์ ใส่ http://localhost:3000/tb)"

cleanup() { echo; echo "ปิด backend + เว็บ admin"; kill $(lsof -ti tcp:3000) $(lsof -ti tcp:8091) 2>/dev/null; exit 0; }
trap cleanup INT TERM

case "${1:-}" in
  api) echo "   กด Ctrl+C เพื่อปิด"; tail -f logs/api.log ;;
  ios) cd apps/mobile && npx expo run:ios ;;
  *)   cd apps/mobile && npx expo start ;;
esac
cleanup
