# Graph Report - voice-meta-ai-hackathon-2026  (2026-10-28)

## Corpus Check
- 38 files · ~9,658 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 258 nodes · 444 edges · 17 communities (16 shown, 1 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- pipeline.py
- routes.ts
- package.json
- compilerOptions
- recipes.ts
- 2. STRICT EXECUTION PIPELINE
- tsconfig.build.json
- Grandma's Recipe Vault — MVP: WA Loop E2E
- devDependencies
- 001_init.sql
- main.py
- app.js
- test_sip_probe.py
- Asterisk — Slice 1: jawab call (call native)
- docker-entrypoint.sh

## God Nodes (most connected - your core abstractions)
1. `createApiRouter()` - 18 edges
2. `run_job()` - 16 edges
3. `createRouter()` - 11 edges
4. `compilerOptions` - 11 edges
5. `WorkerConfig` - 11 edges
6. `StubRedis` - 11 edges
7. `run_probe()` - 9 edges
8. `ListClient` - 8 edges
9. `claim_job()` - 8 edges
10. `DuplicateRecipe` - 8 edges

## Surprising Connections (you probably didn't know these)
- `test_probe_timeout_when_nobody_answers()` --calls--> `run_probe()`  [EXTRACTED]
  asterisk/tests/test_sip_probe.py → asterisk/sip_probe.py
- `ApiDeps` --references--> `Db`  [EXTRACTED]
  gateway/src/recipes.ts → gateway/src/db.ts
- `boot()` --calls--> `createApiRouter()`  [EXTRACTED]
  gateway/src/index.ts → gateway/src/recipes.ts
- `withServer()` --calls--> `createRouter()`  [EXTRACTED]
  gateway/test/webhook.test.ts → gateway/src/routes.ts
- `dispatch()` --uses--> `WorkerConfig`  [INFERRED]
  worker/src/dispatch.py → worker/src/config.py

## Import Cycles
- None detected.

## Communities (17 total, 1 thin omitted)

### Community 0 - "pipeline.py"
Cohesion: 0.09
Nodes (40): BaseModel, Connection, Exception, Worker configuration from environment., WorkerConfig, dispatch(), Send replies back through the gateway., Grandma's Recipe Vault - AI worker. (+32 more)

### Community 1 - "routes.ts"
Cohesion: 0.14
Nodes (22): GatewayConfig, loadConfig(), required(), createDb(), migrate(), boot(), rootDir, enqueueJob() (+14 more)

### Community 2 - "package.json"
Cohesion: 0.09
Nodes (21): dotenv, express, dependencies, dotenv, express, ioredis, pg, @types/pg (+13 more)

### Community 3 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, noEmit, resolveJsonModule, skipLibCheck (+7 more)

### Community 4 - "recipes.ts"
Cohesion: 0.15
Nodes (24): clearSessionCookieHeader(), hashPassword(), SESSION_COOKIE, sessionCookieHeader(), sessionFromHeader(), signSession(), verifyPassword(), verifySession() (+16 more)

### Community 5 - "2. STRICT EXECUTION PIPELINE"
Cohesion: 0.20
Nodes (9): 1. SKILL ROLES & RESPONSIBILITIES, 2. STRICT EXECUTION PIPELINE, 3. GUARDRAILS & OPERATIONAL RULES, PHASE 1: DISCOVERY & ARCHITECTURE (Graphify), PHASE 2: PLANNING & SPECIFICATION (gstack), PHASE 3: FRONTEND DESIGN SYSTEM (design-taste-frontend), PHASE 4: SURGICAL CODING (Ponytail), PHASE 5: VERIFICATION & QA (playwright-cli) (+1 more)

### Community 6 - "tsconfig.build.json"
Cohesion: 0.22
Nodes (8): compilerOptions, noEmit, outDir, rootDir, extends, include, src, ./tsconfig.json

### Community 7 - "Grandma's Recipe Vault — MVP: WA Loop E2E"
Cohesion: 0.22
Nodes (8): Arsitektur, Asumsi MVP (eksplisit), Grandma's Recipe Vault — MVP: WA Loop E2E, Platform Web (resep + akun), Quickstart, Roadmap, Setup Meta (checklist), Test

### Community 8 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, tsx, @types/express, @types/node, typescript, vitest, tsx, @types/express (+3 more)

### Community 9 - "001_init.sql"
Cohesion: 0.48
Nodes (5): families, media_assets, members, recipes, users

### Community 11 - "main.py"
Cohesion: 0.15
Nodes (17): Protocol, load_config(), _req(), main(), Worker entrypoint: reliable queue loop with claim/ack., ack_job(), claim_job(), ListClient (+9 more)

### Community 12 - "app.js"
Cohesion: 0.60
Nodes (4): api(), currentUser(), esc(), renderHeader()

### Community 13 - "test_sip_probe.py"
Cohesion: 0.21
Nodes (14): build_ack(), build_bye(), build_invite(), Minimal SIP UAC probe: INVITE -> wait 200 OK -> ACK -> BYE. Signaling-only…, run_probe(), status_of(), to_tag_of(), FakeUas (+6 more)

### Community 14 - "Asterisk — Slice 1: jawab call (call native)"
Cohesion: 0.33
Nodes (5): Asterisk — Slice 1: jawab call (call native), Caveat jujur, Enablement Meta (checklist produksi), Env (`EXTERN_IP`, `META_SIP_USERNAME`, `META_SIP_PASSWORD` wajib), Test loopback (butuh Docker)

## Knowledge Gaps
- **67 isolated node(s):** `docker-entrypoint.sh script`, `@types/pg`, `dotenv`, `express`, `ioredis` (+62 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `run_job()` connect `pipeline.py` to `main.py`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `createApiRouter()` connect `recipes.ts` to `routes.ts`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `run_job()` (e.g. with `WorkerConfig` and `DuplicateRecipe`) actually correct?**
  _`run_job()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `WorkerConfig` (e.g. with `dispatch()` and `run_job()`) actually correct?**
  _`WorkerConfig` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `docker-entrypoint.sh script`, `@types/pg`, `dotenv` to the rest of the system?**
  _67 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `pipeline.py` be split into smaller, more focused modules?**
  _Cohesion score 0.08734693877551021 - nodes in this community are weakly interconnected._
- **Should `routes.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13978494623655913 - nodes in this community are weakly interconnected._