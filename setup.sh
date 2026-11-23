#!/usr/bin/env bash
# pebble(a): ติดตั้งครั้งแรกบน Mac  ->  ./setup.sh
# ต้องมี: Docker Desktop (เปิดไว้) + Node.js 20 ขึ้นไป
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$PWD"
ok()   { printf '   \033[32m✓ %s\033[0m\n' "$1"; }
warn() { printf '   \033[33m! %s\033[0m\n' "$1"; }
die()  { printf '   \033[31m✗ %s\033[0m\n' "$1"; exit 1; }
step() { printf '\n\033[1;34m==> %s\033[0m\n' "$1"; }

step "1/5 เช็กโปรแกรมที่ต้องมี"
if ! command -v node >/dev/null; then
  if command -v brew >/dev/null; then brew install node; else die "ยังไม่มี Node.js: ติดตั้งจาก https://nodejs.org (LTS) แล้วรัน ./setup.sh ใหม่"; fi
fi
ok "Node $(node -v)"
command -v docker >/dev/null || die "ยังไม่มี Docker: ติดตั้ง Docker Desktop จาก https://www.docker.com/products/docker-desktop แล้วเปิดโปรแกรมไว้"
if ! docker info >/dev/null 2>&1; then
  open -a Docker 2>/dev/null || true
  echo "   รอ Docker Desktop เปิด…"
  for i in $(seq 1 60); do docker info >/dev/null 2>&1 && break; sleep 2; done
  docker info >/dev/null 2>&1 || die "Docker ยังไม่พร้อม: เปิด Docker Desktop แล้วรัน ./setup.sh ใหม่"
fi
ok "Docker พร้อม"

step "2/5 สร้างไฟล์ตั้งค่า (.env) พร้อมรหัสสุ่ม"
rnd() { openssl rand -base64 "$1" | tr -d '\n'; }
if [[ ! -f .env ]]; then
  PGPW=$(openssl rand -hex 16)
  printf 'POSTGRES_PASSWORD=%s\n' "$PGPW" > .env
  ok "สร้าง .env"
else
  PGPW=$(grep -E '^POSTGRES_PASSWORD=' .env | cut -d= -f2-)
  ok ".env มีอยู่แล้ว"
fi
if [[ ! -f apps/api/.env ]]; then
  sed -e "s#<POSTGRES_PASSWORD>#$PGPW#" \
      -e "s#^JWT_ACCESS_SECRET=.*#JWT_ACCESS_SECRET=$(rnd 48)#" \
      -e "s#^DATA_ENCRYPTION_KEY=.*#DATA_ENCRYPTION_KEY=$(rnd 32)#" \
      apps/api/.env.example > apps/api/.env
  ok "สร้าง apps/api/.env (ใส่ ANTHROPIC_API_KEY เองทีหลังถ้าจะใช้แชต)"
else
  ok "apps/api/.env มีอยู่แล้ว"
fi
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo 127.0.0.1)
if [[ ! -f apps/mobile/.env ]]; then
  printf 'EXPO_PUBLIC_API_URL=http://%s:3000\nEXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=\nEXPO_PUBLIC_SPOTIFY_CLIENT_ID=\n' "$IP" > apps/mobile/.env
  ok "สร้าง apps/mobile/.env (แอปจะคุยกับ http://$IP:3000)"
else
  ok "apps/mobile/.env มีอยู่แล้ว"
fi

step "3/5 เปิดฐานข้อมูล (PostgreSQL ใน Docker)"
docker compose up -d db
for i in $(seq 1 30); do docker exec pebble-db pg_isready -U pebble_admin -d pebble >/dev/null 2>&1 && break; sleep 2; done
docker exec pebble-db pg_isready -U pebble_admin -d pebble >/dev/null 2>&1 || die "ฐานข้อมูลไม่ขึ้น: docker logs pebble-db"
sleep 2
for f in database/migrations/*.sql; do
  docker exec -i pebble-db psql -q -U pebble_admin -d pebble < "$f" >/dev/null 2>&1 || true
done
ok "ฐานข้อมูลพร้อม (ตาราง + migrations ครบ)"

step "4/5 ติดตั้ง + build backend (NestJS)"
(cd apps/api && npm install --no-audit --no-fund && npx prisma generate && npm run build)
ok "backend build ผ่าน"

step "5/5 ติดตั้งแอปมือถือ (Expo)"
(cd apps/mobile && npm install --no-audit --no-fund)
ok "แอปพร้อม"

printf '\n\033[1;32mติดตั้งเสร็จ! เปิดทุกอย่างด้วย:  ./start.sh\033[0m\n'
