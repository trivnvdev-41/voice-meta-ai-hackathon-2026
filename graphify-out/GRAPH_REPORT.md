# Graph Report - voice-meta-ai-hackathon-2026  (2026-10-28)

## Corpus Check
- 47 files · ~14,022 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 369 nodes · 675 edges · 20 communities (19 shown, 1 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- pipeline.py
- whatsapp.ts
- package.json
- compilerOptions
- recipes.ts
- 2. STRICT EXECUTION PIPELINE
- tsconfig.build.json
- Grandma's Recipe Vault — MVP: WA Loop E2E
- ai_bridge.py
- recipes
- main.py
- app.js
- test_sip_probe.py
- Asterisk — Slice 1: jawab call (call native)
- docker-entrypoint.sh
- WorkerConfig
- test_call_audio.py
- CopilotSession

## God Nodes (most connected - your core abstractions)
1. `createApiRouter()` - 19 edges
2. `CopilotSession` - 17 edges
3. `run_job()` - 16 edges
4. `WorkerConfig` - 15 edges
5. `FakeConn` - 12 edges
6. `createRouter()` - 12 edges
7. `compilerOptions` - 11 edges
8. `UtteranceSegmenter` - 11 edges
9. `StubRedis` - 11 edges
10. `handle_call_event()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `process_utterance()` --uses--> `CopilotSession`  [INFERRED]
  asterisk/ai_bridge.py → worker/src/copilot.py
- `run_call()` --uses--> `UtteranceSegmenter`  [INFERRED]
  asterisk/ai_bridge.py → worker/src/call_audio.py
- `speak()` --calls--> `decode_to_slinear8k()`  [EXTRACTED]
  asterisk/ai_bridge.py → worker/src/call_audio.py
- `speak()` --calls--> `synthesize()`  [EXTRACTED]
  asterisk/ai_bridge.py → worker/src/tts.py
- `process_utterance()` --calls--> `transcribe()`  [EXTRACTED]
  asterisk/ai_bridge.py → worker/src/stt.py

## Import Cycles
- None detected.

## Communities (20 total, 1 thin omitted)

### Community 0 - "pipeline.py"
Cohesion: 0.09
Nodes (36): BaseModel, Connection, Exception, Grandma's Recipe Vault - AI worker., download_media(), Meta Graph API helpers (media download)., One job: voice note -> archived recipe + WhatsApp reply., run_job() (+28 more)

### Community 1 - "whatsapp.ts"
Cohesion: 0.15
Nodes (23): GatewayConfig, loadConfig(), required(), boot(), rootDir, enqueueJob(), RecipeJob, createRouter() (+15 more)

### Community 2 - "package.json"
Cohesion: 0.06
Nodes (32): dotenv, express, dependencies, dotenv, express, ioredis, pg, @types/pg (+24 more)

### Community 3 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, noEmit, resolveJsonModule, skipLibCheck (+7 more)

### Community 4 - "recipes.ts"
Cohesion: 0.12
Nodes (29): clearSessionCookieHeader(), hashPassword(), SESSION_COOKIE, sessionCookieHeader(), sessionFromHeader(), signSession(), verifyPassword(), verifySession() (+21 more)

### Community 5 - "2. STRICT EXECUTION PIPELINE"
Cohesion: 0.20
Nodes (9): 1. SKILL ROLES & RESPONSIBILITIES, 2. STRICT EXECUTION PIPELINE, 3. GUARDRAILS & OPERATIONAL RULES, PHASE 1: DISCOVERY & ARCHITECTURE (Graphify), PHASE 2: PLANNING & SPECIFICATION (gstack), PHASE 3: FRONTEND DESIGN SYSTEM (design-taste-frontend), PHASE 4: SURGICAL CODING (Ponytail), PHASE 5: VERIFICATION & QA (playwright-cli) (+1 more)

### Community 6 - "tsconfig.build.json"
Cohesion: 0.22
Nodes (8): compilerOptions, noEmit, outDir, rootDir, extends, include, src, ./tsconfig.json

### Community 7 - "Grandma's Recipe Vault — MVP: WA Loop E2E"
Cohesion: 0.20
Nodes (9): Arsitektur, Asumsi MVP (eksplisit), Grandma's Recipe Vault — MVP: WA Loop E2E, Kopilot call (native WA calling), Platform Web (resep + akun), Quickstart, Roadmap, Setup Meta (checklist) (+1 more)

### Community 8 - "ai_bridge.py"
Cohesion: 0.10
Nodes (27): BridgeConfig, find_recipe(), find_session_recipe(), find_user(), load_bridge_config(), main(), normalize_wa(), parse_agi_env() (+19 more)

### Community 9 - "recipes"
Cohesion: 0.36
Nodes (6): families, media_assets, members, recipes, users, call_sessions

### Community 11 - "main.py"
Cohesion: 0.17
Nodes (15): Protocol, main(), Worker entrypoint: reliable queue loop with claim/ack., ack_job(), claim_job(), ListClient, processing_name(), Reliable queue: claim a job, ack it only after processing. A crash between… (+7 more)

### Community 12 - "app.js"
Cohesion: 0.60
Nodes (4): api(), currentUser(), esc(), renderHeader()

### Community 13 - "test_sip_probe.py"
Cohesion: 0.21
Nodes (14): build_ack(), build_bye(), build_invite(), Minimal SIP UAC probe: INVITE -> wait 200 OK -> ACK -> BYE. Signaling-only…, run_probe(), status_of(), to_tag_of(), FakeUas (+6 more)

### Community 14 - "Asterisk — Slice 1: jawab call (call native)"
Cohesion: 0.25
Nodes (7): Asterisk — Slice 1: jawab call (call native), Caveat jujur, Enablement Meta (checklist produksi), Env (`EXTERN_IP`, `META_SIP_USERNAME`, `META_SIP_PASSWORD` wajib), Slice 2: AI bridge (EAGI), Slice 3: sesi masak + tombol call, Test loopback (butuh Docker)

### Community 17 - "WorkerConfig"
Cohesion: 0.12
Nodes (18): handle_call_event(), parse_cook_payload(), Persist WhatsApp call lifecycle events into call_sessions., load_config(), Worker configuration from environment., _req(), WorkerConfig, dispatch() (+10 more)

### Community 18 - "test_call_audio.py"
Cohesion: 0.22
Nodes (14): skipif, decode_to_slinear8k(), 8 kHz slinear16 helpers: RMS VAD segmentation + ffmpeg decode., Collects frames until end-of-speech. Fixed RMS threshold (MVP)., rms(), UtteranceSegmenter, chunks(), silence() (+6 more)

### Community 19 - "CopilotSession"
Cohesion: 0.21
Nodes (8): answer_question(), CopilotSession, Cooking copilot brain: step state, keyword navigation, Gemini Q&A., _recipe(), test_greeting_names_recipe_and_first_step(), test_ingredients_answer(), test_navigation_next_prev_repeat(), test_question_goes_to_llm()

## Knowledge Gaps
- **71 isolated node(s):** `docker-entrypoint.sh script`, `@types/pg`, `dotenv`, `express`, `ioredis` (+66 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `CopilotSession` connect `CopilotSession` to `ai_bridge.py`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `run_job()` connect `pipeline.py` to `WorkerConfig`, `main.py`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `WorkerConfig` connect `WorkerConfig` to `pipeline.py`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `run_job()` (e.g. with `WorkerConfig` and `DuplicateRecipe`) actually correct?**
  _`run_job()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `WorkerConfig` (e.g. with `handle_call_event()` and `dispatch()`) actually correct?**
  _`WorkerConfig` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `docker-entrypoint.sh script`, `@types/pg`, `dotenv` to the rest of the system?**
  _71 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `pipeline.py` be split into smaller, more focused modules?**
  _Cohesion score 0.09302325581395349 - nodes in this community are weakly interconnected._