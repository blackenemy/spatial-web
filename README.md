# spatial-web

ส่วนหน้าบ้าน (Frontend) ของ Mini Spatial Data Platform — แผนที่ + ตารางแบบโต้ตอบได้
ใช้ React 19 + Vite + MapLibre GL + React Query + Blueprint UI

เว็บจริง: https://spatial-web.project-hub.it.com

> **ระบบนี้มี 2 repo** คู่กับหลังบ้าน:
> [`spatial-api`](https://github.com/blackenemy/spatial-api)
> หน้าบ้านตัวนี้ไม่มีข้อมูลของตัวเอง มันดึงจาก API — ให้เปิด API ก่อน แล้วค่อยเปิดตัวนี้

## วิธีที่ 1 — รันด้วย Docker

เปิด **API ก่อน** (ที่ repo [`spatial-api`](https://github.com/blackenemy/spatial-api)
สั่ง `docker compose up`) แล้วกลับมาที่นี่:

```bash
docker compose up --build                       # เปิดที่ http://localhost:5173 → ต่อ API ที่ :3000
# ถ้าจะให้ต่อ API ที่อื่น (ค่านี้ถูกฝังตอน build):
VITE_API_URL=http://host:port docker compose up --build
```

## วิธีที่ 2 — รันเองไม่ใช้ Docker

```bash
npm install
export VITE_API_URL=http://localhost:3000   # ที่อยู่ของ API
npm run dev                                  # เปิดที่ http://localhost:5173
```

ตั้งค่า `VITE_API_URL` ในไฟล์ `.env.local` / `.env.production` แทนการ export ก็ได้

## ตัวแปรสภาพแวดล้อม (Environment variables)

| ตัวแปร | ตัวอย่าง | คำอธิบาย |
|--------|----------|----------|
| `VITE_API_URL` | `http://localhost:3000` | ที่อยู่ของ API (ค่าเริ่มต้น `http://localhost:3000`) · ค่านี้ถูกฝังตอน **build** (Vite) |

## คำสั่ง (Scripts)

```bash
npm run dev       # เซิร์ฟเวอร์ dev (แก้แล้วรีโหลดเอง)
npm run build     # ตรวจชนิดข้อมูล (tsc -b) + build ตัวจริง
npm run preview   # ลองเปิดตัวที่ build แล้ว
npm test          # ทดสอบย่อย (vitest)
npx playwright test   # ทดสอบ E2E — API + ทุกขั้นตอนบนหน้าจอ (ดูโฟลเดอร์ e2e/)
```

## ทำอะไรได้บ้าง

- ดึงข้อมูลสถานที่จาก API จริง (ไม่ใช่ข้อมูลปลอม) แล้วแสดงเป็น **แผนที่ MapLibre** + **ตาราง**
- **เพิ่ม / แก้ไข / ลบ** สถานที่ผ่านหน้าจอ (คลิกบนแผนที่เพื่อปักตำแหน่ง)
- **ค้นหา** ตามชื่อ, **กรอง** ตามประเภท, **รวมกลุ่มหมุด** (clustering) เมื่อหมุดเยอะ
- แสดง geometry ได้หลายแบบ — **จุด (Point) / เส้น (LineString) / รูปปิด (Polygon)**
- **วาดพื้นที่บนแผนที่ → ค้นหาสถานที่ข้างใน** (spatial query ด้วย PostGIS `ST_Within`)
- **นำเข้า / ส่งออก** ไฟล์ GeoJSON, สลับแผนที่พื้นหลัง, มีป้ายสีตามประเภทสถานที่

## ทำไมใช้ clustering แทน pagination

เป็น **map-first app** — แผนที่ไม่มีคอนเซ็ปต์ "หน้า" การรวมกลุ่มหมุด (clustering)
ตอบโจทย์ "รองรับข้อมูลจำนวนมาก" ได้ตรงกว่า: หมุดหมื่นจุดก็เลื่อน/ซูมได้ลื่นโดยไม่ต้อง
แบ่งหน้า และ query ตามกรอบแผนที่ (`?bbox=`) ก็ช่วยดึงเฉพาะที่มองเห็นอยู่แล้ว
(ถ้าอนาคตต้องการมุมมองตารางข้อมูลมหาศาล ค่อยเพิ่ม `?limit/offset` ที่ API ทีหลังได้)

## ทดสอบ E2E

`e2e/api.spec.ts` ยิงไปที่ API จริง (เปลี่ยนได้ด้วยตัวแปร `API_URL`)
ส่วน `e2e/web.spec.ts` ทดสอบหน้าจอโดยจำลอง API ในหน่วยความจำ
รันครั้งแรกต้องสั่ง `npx playwright install chromium` ก่อนหนึ่งครั้ง
