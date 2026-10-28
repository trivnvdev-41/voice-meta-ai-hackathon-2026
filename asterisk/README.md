# Asterisk — Slice 1: jawab call (call native)

Terminasi SIP untuk WhatsApp Business Calling API. Jalur produksi = Meta
INVITE via TLS ke `meta-endpoint` (DTLS-SRTP + Opus). Jalur loopback =
endpoint UDP tanpa auth untuk test lokal, konteks dialplan sama.

## Env (`EXTERN_IP`, `META_SIP_USERNAME`, `META_SIP_PASSWORD` wajib)

`META_SIP_ALLOW` default ke private-net (loopback). Untuk produksi, ganti ke
daftar IP webhook Meta dari [dok IP addresses](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview#ip-addresses)
— SIP memakai daftar yang sama, tanpa alternatif mTLS.

## Test loopback (butuh Docker)

```bash
docker compose up --build asterisk
# dari host / container lain di net yang sama:
python3 asterisk/sip_probe.py  # atau: pytest asterisk -q (butuh Asterisk hidup)
```

Probe kirim INVITE UDP ke 5060, tunggu 200 OK, tutup dengan ACK + BYE.

## Slice 2: AI bridge (EAGI)

Jawaban call langsung diserahkan ke `ai_bridge.py` (EAGI, audio 8 kHz di fd 3):
dengar ucapan (VAD) → Whisper → kopilot resep (`worker/src/copilot.py`,
navigasi kata kunci + tanya-jawab Meta Llama, maks 2 kalimat) → ElevenLabs →
putar balik ke call. Turn-based, tanpa barge-in.

Resep diambil dari Postgres: arg EAGI, lalu terbaru milik penelepon
(cocok `wa_id`), lalu publik terbaru. Perlu `DATABASE_URL` + API key di env
service asterisk. Latensi per giliran ±3–6 detik (STT+LLM+TTS berurutan);
streaming = optimasi berikutnya.

## Enablement Meta (checklist produksi)

1. App mode **Live**, health status OK untuk `PHONE_NUMBER_ID`.
2. Enable SIP di nomor bisnis (hostname + port server ini).
3. Subscribe webhook field `calls` + permission `whatsapp_business_messaging`.
4. Business-initiated hanya dari kode negara yang didukung (ID aman; US/CA/EG/VN/NG tidak).

## Slice 3: sesi masak + tombol call

Alur: client tekan **Masak via Call** di web → gateway buat `call_sessions`
+ kirim tombol `voice_call` (payload `cook:<id>`, TTL 60 mnt) → client tekan
tombol → INVITE bawa header `x-wa-meta-cta-payload` → dialplan teruskan ke
EAGI → bridge pakai resep sesi itu. Webhook `calls` (connect/terminate)
dicatat worker ke `call_sessions` untuk status.

## Caveat jujur

- Asumsi kredensial digest = yang diset saat enable SIP (verifikasi di dashboard).
- `dtls_verify=no` awal; ketatkan ke fingerprint bila Meta mempublikasikannya.
- Tanpa modul Opus, negosiasi jatuh ke ulaw/alaw — cek `core show codecs`.
- Referensi: [calling](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling),
  [SIP](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling/sip).
