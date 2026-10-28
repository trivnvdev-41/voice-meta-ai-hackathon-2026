# Grandma's Recipe Vault — MVP: WA Loop E2E

Voice-first **WhatsApp** platform untuk mengarsipkan resep warisan keluarga.
MVP ini mencakup satu loop end-to-end: voice note masuk → terstruktur oleh AI →
tersimpan → balasan suara kembali.

## Arsitektur

```text
WA voice ──► /webhook (gateway, Node) ──► Redis list ──► worker (Python)
                                                              │
            ┌─────────────────────────────────────────────────┘
            │ unduh media → Whisper STT → Gemini structuring
            │ → Postgres + S3 → ElevenLabs TTS → dispatch
            ▼
gateway /internal/dispatch ──► WA reply (teks + voice)
```

- **gateway/** (Node + TypeScript + Express): verifikasi webhook, enqueue <200ms,
  pengiriman balasan via Meta Cloud API.
- **worker/** (Python): pipeline AI sinkron, satu job per voice note.
- **Postgres**: metadata resep; **S3-compat** (R2/Spaces): arsip voice asli.

## Quickstart

```bash
cp .env.example .env        # isi semua CHANGE_ME
docker compose up --build
```

Expose webhook ke Meta saat dev:

```bash
ngrok http 3000   # pakai URL https-nya sebagai Callback URL
```

Jalankan tanpa Docker (dev lokal, butuh Redis + Postgres lokal):

```bash
# gateway
cd gateway && npm install && npm run dev

# worker (env project-lokal di root)
python3 -m venv .venv && source .venv/bin/activate
pip install -r worker/requirements.txt
cd worker && python -m src.main
```

## Platform Web (resep + akun)

Gateway juga melayani web di `/`: daftar sebagai **author** (chef/keluarga,
bisa tulis resep) atau **client** (baca resep publik, siap untuk kopilot WA).

```bash
cd gateway && npm install && npm run dev   # butuh Postgres lokal + .env
# buka http://localhost:3000 di browser
```

API: `POST /api/register`, `POST /api/login`, `GET /api/me`,
`GET/POST /api/recipes`, `GET/PUT/DELETE /api/recipes/:id`.
Sesi via cookie `grv_session` (HMAC, HttpOnly). Tulis resep = peran author saja;
resep privat hanya terlihat pemiliknya. Skema di `gateway/migrations/`
(dijalankan otomatis saat gateway boot, juga oleh Postgres container fresh).

Next: pairing nomor WA via OTP.

## Kopilot call (native WA calling)

Tombol **Masak via Call** di halaman resep → sesi masak + tombol call
`voice_call` dikirim ke WA client → call dijawab Asterisk → AI pandu
langkah-demi-langkah. Status call terlacak via webhook `calls`.
Butuh: Calling API + SIP enable (lihat `asterisk/README.md`).

## Setup Meta (checklist)

1. Buat App di Meta App Dashboard → tambah produk **WhatsApp**.
2. Catat **Phone Number ID** + **Token** + **App Secret** (test number untuk dev).
3. Set Callback URL `https://<tunnel>/webhook` + Verify Token = `WHATSAPP_VERIFY_TOKEN`.
4. Subscribe field `messages`, kirim voice note ke test number.

## Test

```bash
cd gateway && npm test && npm run typecheck
cd worker && python -m pytest -q   # dengan .venv root aktif
```

## Asumsi MVP (eksplisit)

- **Antrean = Redis list reliable**, bukan BullMQ — agar gateway Node dan worker
  Python interoperabilitas tanpa protokol khusus. Worker claim via `BLMOVE` ke
  `<queue>:processing` dan ack via `LREM` setelah job selesai; sisa processing
  direqueue otomatis saat boot. Modul antrean terisolasi sehingga gampang
  diganti BullMQ nanti (butuh retry/UI).
- **Balasan suara via link S3 presigned** (7 hari) — Meta `audio.link` butuh URL publik.
- **Satu voice note = satu resep**; pesan teks dibalas panduan singkat.
  Multi-turn dialog (LangGraph/state) = fase berikutnya.
- **Keamanan webhook**: tiap POST wajib lolos `X-Hub-Signature-256` (403 bila palsu);
  enqueue gagal → 500 agar Meta retry; `wa_message_id` UNIQUE mencegah resep ganda.
- Foto/OCR (SAM/PaddleOCR), video memasak, dan Public Explorer di luar MVP.

## Roadmap

1. Multi-turn klarifikasi + state percakapan (Redis/LangGraph).
2. Foto resep: SAM segmentasi + OCR tulisan tangan.
3. Family Vault web (arsip + playback) + Public Heritage Explorer (opt-in).
4. Ganti antrean ke BullMQ + ganti STT/TTS ke Seamless/Faster-Whisper bila perlu.
