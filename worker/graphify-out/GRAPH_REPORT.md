# Graph Report - worker  (2026-10-28)

## Corpus Check
- 14 files · ~2,005 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 79 nodes · 172 edges · 10 communities (8 shown, 2 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- run_job
- pipeline.py
- structure.py
- test_recipe.py
- main.py
- test_queue.py
- StubRedis
- ListClient
- test_run_job_duplicate_recipe

## God Nodes (most connected - your core abstractions)
1. `run_job()` - 16 edges
2. `WorkerConfig` - 11 edges
3. `StubRedis` - 11 edges
4. `ListClient` - 8 edges
5. `claim_job()` - 8 edges
6. `DuplicateRecipe` - 8 edges
7. `RecipeDraft` - 8 edges
8. `main()` - 7 edges
9. `processing_name()` - 7 edges
10. `save_recipe()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `_dummy_config()` --calls--> `WorkerConfig`  [EXTRACTED]
  tests/test_recipe.py → src/config.py
- `test_summarize_reply_with_clarification()` --calls--> `summarize_reply()`  [EXTRACTED]
  tests/test_recipe.py → src/pipeline.py
- `test_summarize_reply_without_clarification()` --calls--> `summarize_reply()`  [EXTRACTED]
  tests/test_recipe.py → src/pipeline.py
- `test_run_job_duplicate_recipe()` --calls--> `run_job()`  [EXTRACTED]
  tests/test_recipe.py → src/pipeline.py
- `test_run_job_failure_hides_details()` --calls--> `run_job()`  [EXTRACTED]
  tests/test_recipe.py → src/pipeline.py

## Import Cycles
- None detected.

## Communities (10 total, 2 thin omitted)

### Community 0 - "run_job"
Cohesion: 0.20
Nodes (15): Connection, Exception, load_config(), Worker configuration from environment., _req(), WorkerConfig, dispatch(), Send replies back through the gateway. (+7 more)

### Community 1 - "pipeline.py"
Cohesion: 0.19
Nodes (8): Grandma's Recipe Vault - AI worker., download_media(), Meta Graph API helpers (media download)., One job: voice note -> archived recipe + WhatsApp reply., Speech-to-text via Whisper API., transcribe(), Text-to-speech via ElevenLabs (warm reply voice)., synthesize()

### Community 2 - "structure.py"
Cohesion: 0.36
Nodes (7): BaseModel, build_prompt(), Ingredient, Transcript -> structured recipe via Gemini., RecipeDraft, structure_recipe(), test_prompt_keeps_transcript()

### Community 3 - "test_recipe.py"
Cohesion: 0.43
Nodes (7): summarize_reply(), parse_recipe_json(), test_parse_code_fence(), test_parse_family_name(), test_parse_plain_json(), test_summarize_reply_with_clarification(), test_summarize_reply_without_clarification()

### Community 4 - "main.py"
Cohesion: 0.48
Nodes (5): main(), Worker entrypoint: reliable queue loop with claim/ack., ack_job(), Reliable queue: claim a job, ack it only after processing. A crash between…, requeue_processing()

### Community 5 - "test_queue.py"
Cohesion: 0.71
Nodes (6): claim_job(), processing_name(), _seed(), test_ack_removes_from_processing(), test_claim_is_fifo(), test_crash_requeues_unacked_jobs_in_order()

### Community 8 - "test_run_job_duplicate_recipe"
Cohesion: 0.40
Nodes (5): _dummy_config(), Internal error details go to logs, never to the user., Meta retry of the same message dispatches 'already saved', no crash., test_run_job_duplicate_recipe(), test_run_job_failure_hides_details()

## Knowledge Gaps
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `run_job()` connect `run_job` to `pipeline.py`, `structure.py`, `test_recipe.py`, `main.py`, `test_run_job_duplicate_recipe`?**
  _High betweenness centrality (0.209) - this node is a cross-community bridge._
- **Why does `StubRedis` connect `StubRedis` to `test_queue.py`?**
  _High betweenness centrality (0.147) - this node is a cross-community bridge._
- **Why does `claim_job()` connect `test_queue.py` to `main.py`, `ListClient`?**
  _High betweenness centrality (0.106) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `run_job()` (e.g. with `WorkerConfig` and `DuplicateRecipe`) actually correct?**
  _`run_job()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `WorkerConfig` (e.g. with `dispatch()` and `run_job()`) actually correct?**
  _`WorkerConfig` has 4 INFERRED edges - model-reasoned connections that need verification._