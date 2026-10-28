# Chef in Your Ear

**A voice-first WhatsApp sous-chef that saves family recipes before they disappear — then calls you back and cooks alongside you, step by step, hands-free.**

Every family has a recipe that only lives in one person's memory. The problem is never that people don't want to preserve it; it's that archiving tools ask them to sit down and type into a form. They won't. But they will happily send a voice note to WhatsApp.

So that's the entire entry point. A grandmother records herself explaining how she makes rendang, in her own language and her own words — *"sejemput"*, *"sampai minyak naik"*. The **AI sous-chef** transcribes it with Whisper, then uses Meta Llama to structure it into a real recipe: name, ingredients, steps, region, even the family or clan name she mentions. Where she speaks in folk measurements, we keep her exact phrasing and add metric estimates beside it, because the original wording *is* the heritage. Within seconds she gets a voice reply back in WhatsApp confirming the recipe is saved — and the original recording is archived alongside it, so the sound of her voice is preserved too.

The second half is where the archive comes alive. On a recipe page there's a button: **Cook via Call**. Tap it and WhatsApp actually rings. The call is terminated over SIP into Asterisk, which hands the audio to your **chef on the line**. It greets you — *"Ready when you are, chef"* — reads step one, and waits. Say *"next"* and it moves on. Say *"repeat"* and it goes back. Ask *"how much coconut milk?"* and it answers from that specific recipe's context, in two sentences, out loud. Your hands stay in the dough the whole time. At the end of the last step: *"That's the whole recipe, chef. Selamat makan."*

Under the hood it's three services working together: a Node/TypeScript gateway that verifies Meta's webhook signature and acknowledges in under 200 milliseconds, a Redis-backed reliable queue, and a Python worker running the transcription, structuring, storage, and speech synthesis pipeline. A web vault lets family members manage recipes, control privacy, and share publicly if they choose. The build is genuinely production-shaped — duplicate messages are deduplicated, forged webhooks are rejected, failed jobs return errors so Meta retries, and in-flight jobs are requeued if the worker crashes.

We built this because cultural knowledge doesn't get lost in one dramatic moment. It gets lost quietly, one unwritten recipe at a time. **Chef in Your Ear makes preservation as easy as talking — then turns every saved recipe into a chef who's always available, always patient, and always in your ear.**

---

## MVP: WhatsApp Loop E2E

Voice-first **WhatsApp** assistant for archiving family **cooking and drinks recipes**.
This MVP covers one end-to-end loop: voice note in → structured by AI →
saved → voice reply back.

## Architecture

```text
WA voice ──► /webhook (gateway, Node) ──► Redis list ──► worker (Python)
                                                              │
            ┌─────────────────────────────────────────────────┘
            │ download media → Whisper STT → Meta Llama structuring
            │ → Postgres + S3 → ElevenLabs TTS → dispatch
            ▼
gateway /internal/dispatch ──► WA reply (text + voice)
```

- **gateway/** (Node + TypeScript + Express): webhook verification, enqueue in <200ms,
  reply delivery via Meta Cloud API.
- **worker/** (Python): synchronous AI pipeline, one job per voice note.
- **Postgres**: recipe metadata; **S3-compatible** (R2/Spaces): original voice archive.

## Quickstart

```bash
cp .env.example .env        # fill every CHANGE_ME
docker compose up --build
```

Expose the webhook to Meta during development:

```bash
ngrok http 3000   # use the https URL as the Callback URL
```

Run without Docker (local dev, needs local Redis + Postgres):

```bash
# gateway
cd gateway && npm install && npm run dev

# worker (local project env at repo root)
python3 -m venv .venv && source .venv/bin/activate
pip install -r worker/requirements.txt
cd worker && python -m src.main
```

## Web Platform (recipes + accounts)

The gateway also serves the web app at `/`: register as an **author** (chef/family,
can write recipes) or a **client** (read public recipes, ready for the WA copilot).

```bash
cd gateway && npm install && npm run dev   # needs local Postgres + .env
# open http://localhost:3000 in a browser
```

API: `POST /api/register`, `POST /api/login`, `GET /api/me`,
`GET/POST /api/recipes`, `GET/PUT/DELETE /api/recipes/:id`.
Session via `grv_session` cookie (HMAC, HttpOnly). Writing recipes = author role only;
private recipes are visible to their owner only. Schema lives in `gateway/migrations/`
(applied automatically on gateway boot, tracked in `schema_migrations` — each file runs once).

Next: WA number pairing via OTP.

## Call copilot (native WA calling)

The **Cook via Call** button on a recipe page → cooking session + `voice_call`
button sent to the WA client → call answered by Asterisk → the AI guides you
step by step. Call status is tracked through the `calls` webhook.
Requires: Calling API + SIP enabled (see `asterisk/README.md`).

## Meta setup (checklist)

1. Create an App in Meta App Dashboard → add the **WhatsApp** product.
2. Note the **Phone Number ID** + **Token** + **App Secret** (test number for dev).
3. Set Callback URL `https://<tunnel>/webhook` + Verify Token = `WHATSAPP_VERIFY_TOKEN`.
4. Subscribe to the `messages` field, send a voice note to the test number.

## Test

```bash
cd gateway && npm test && npm run typecheck
cd worker && python -m pytest -q   # with the root .venv active
```

Optional real-Postgres integration test (FK order, WA linking, member reuse):

```bash
docker run -d --rm -p 127.0.0.1:5540:5432 -e POSTGRES_PASSWORD=it -e POSTGRES_DB=grv postgres:16-alpine
cd gateway && TEST_DATABASE_URL=postgres://postgres:it@127.0.0.1:5540/grv npm test
```

## MVP assumptions (explicit)

- **Queue = reliable Redis list**, not BullMQ — so the Node gateway and the Python
  worker interoperate without a custom protocol. The worker claims via `BLMOVE` into
  `<queue>:processing` and acks via `LREM` after the job finishes; leftovers in
  processing are requeued automatically on boot. The queue module is isolated, so
  swapping in BullMQ later (needs retry/UI) is easy.
- **Voice reply via presigned S3 link** (1 hour, signed at send time) — Meta `audio.link`
  requires a public URL. Archived voice notes are signed **on read**
  (`GET /api/recipes/:id/voice`), so an archive link never expires.
- **One voice note = one recipe**; text messages get a short guidance reply.
  Multi-turn dialog (LangGraph/state) = next phase.
- **Webhook security**: every POST must pass `X-Hub-Signature-256` (403 if forged);
  failed enqueue → 500 so Meta retries; `wa_message_id` UNIQUE prevents duplicate recipes.
- Photo/OCR (SAM/PaddleOCR), cooking videos, and the Public Explorer are out of MVP scope.

## Roadmap

1. Multi-turn clarification + conversation state (Redis/LangGraph).
2. Recipe photos: SAM segmentation + handwriting OCR.
3. Family Vault web (archive + playback) + Public Heritage Explorer (opt-in).
4. Move the queue to BullMQ + swap STT/TTS to Seamless/Faster-Whisper if needed.
