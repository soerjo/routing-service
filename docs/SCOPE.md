# Scope & Contract — Routing Service (routing-only)

Status: PRE-IMPLEMENTATION — 2026-10-17
Sumber: PRD "On-Demand & Scheduled Delivery/Ride Routing & Pricing Engine" v1.1.0
(original di repo `soerjo/routing-pricing-service/docs/PRD.md`).

## 1. Keputusan pemisahan (Mas, 2026-10-17)

Repo ini **hanya routing**. Feature pricing management DIKELUARKAN — nanti dibuat
sebagai service terpisah (`pricing-service`). Konsekuensi:

- TIDAK ada di sini: `pricing_configs`, kalkulasi fare, breakdown harga,
  `quote_token`, `ServiceFee`/`Commission`.
- Yang di sini: rute jalan raya (OSRM), fallback Haversine, lokasi driver real-time
  (Redis GEO), pencarian driver terdekat, dan atomic accept-lock (infra dispatch).
- Kontrak antar-service nanti: pricing-service memanggil routing-service untuk
  mendapat `distance_meters`, `duration_seconds`, `route_polyline` — pricing hanya
  menghitung uang dari output itu.

## 2. Feature scope routing-service

### 2.1 Routing (OSRM + fallback)
- `GET /api/v1/routing/route?origin_lat&origin_lng&dest_lat&dest_lng`
  → `{ distance_meters, duration_seconds, polyline, route_source: 'OSRM' | 'HAVERSINE_FALLBACK' }`.
- OSRM client: `GET {OSRM_URL}/route/v1/driving/{lng1},{lat1};{lng2},{lat2}?overview=full&geometries=polyline`.
- Timeout 2.000 ms; gagal/timeout → Haversine ×1.35 dengan `route_source: HAVERSINE_FALLBACK`
  dan `duration_seconds` diestimasi dari asumsi kecepatan rata-rata (default 30 km/j, env-configurable).

### 2.2 Driver location (Redis GEO)
- `POST /api/v1/driver/location` (guard DRIVER): `GEOADD drivers:locations:active <lng> <lat> <driver_id>` + `SET driver:heartbeat:<id> "1" EX 60`.
- `PATCH /api/v1/driver/status` (guard DRIVER): ONLINE → GEOADD; OFFLINE/BUSY keluar dari kandidat matching; OFFLINE → `ZREM`.
- Heartbeat dan GEO berjalan sejalan: member GEO tanpa heartbeat = basi.

### 2.3 Nearest drivers (Fase 2 matching primitive)
- `GET /api/v1/routing/nearby-drivers?lat&lng&radius_km&limit` (guard internal/service)
  → GEORADIUS `WITHDIST ASC COUNT N`, difilter `EXISTS driver:heartbeat:<id>`.
- Ini building block yang nanti dipakai order-service / pricing-service.

### 2.4 Accept-lock primitive (infra, bukan feature order)
- `POST /api/v1/locks/acquire` & `POST /api/v1/locks/release` (guard service/internal)
  → Redlock per resource key (mis. `booking:<id>`), TTL configurable, token dikembalikan ke
  caller untuk release. Atomic accept tetap valid walau pricing dipecah.

### 2.5 Explicitly OUT of scope (ke service lain nanti)
- Bookings lifecycle, order pool/broadcast, quote & fare, wallet, workers scheduled
  trigger, semua tabel `bookings`/`pricing_configs`/`users` domain ride.

## 3. Schema (dipangkas dari PRD §4)

Hanya tabel yang routing-service butuhkan sendiri:

```sql
CREATE TYPE driver_status AS ENUM ('OFFLINE', 'ONLINE', 'BUSY');

CREATE TABLE driver_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,          -- referensi logis ke users milik service lain (tanpa FK lintas DB)
    vehicle_type VARCHAR(20) NOT NULL,
    vehicle_plate_number VARCHAR(15) NOT NULL,
    status driver_status NOT NULL DEFAULT 'OFFLINE',
    last_known_lat DOUBLE PRECISION,       -- snapshot stale; sumber kebenaran = Redis GEO
    last_known_lng DOUBLE PRECISION,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Tidak ada `users`, `bookings`, `pricing_configs`, `delivery_services` di DB ini.
Snapshot rute (`distance_meters` dll.) disimpan oleh caller (order/pricing service),
bukan di sini — routing adalah komputasi stateless + Geo index.

## 4. Redis keys (kontrak)

| Key | Isi | TTL |
| :-- | :-- | :-- |
| `drivers:locations:active` (GEO) | member = driver_id, score = geohash(lat,lng) | — |
| `driver:heartbeat:<driver_id>` | "1" | EX 60 |
| `lock:<resource_key>` | Redlock token | per acquire |

## 5. Infra

- Docker: OSRM container (data OSM extract per region) + service NestJS + Redis.
- Region awal OSRM: **Jabodetabek** (perlu konfirmasi sebelum deploy WP-final).
- Semua config via env: `OSRM_URL`, `REDIS_URL`, `HAVERSINE_SPEED_KMH`, `LOCK_TTL_MS`.

## 6. Work packages

- **WP1:** Prisma schema (driver_profiles) + module routing (OSRM client + Haversine fallback) + endpoint `/routing/route` & `/routing/nearby-drivers` + unit test fallback.
- **WP2:** Driver location module (GEO + heartbeat + status toggle) + locks module (Redlock) + guards.
- **WP3:** Docker compose (OSRM preprocess + redis + app) + README deploy + smoke test end-to-end.