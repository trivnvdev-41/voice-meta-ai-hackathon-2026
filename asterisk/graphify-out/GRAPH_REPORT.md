# Graph Report - asterisk  (2026-10-28)

## Corpus Check
- 7 files · ~1,959 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 60 nodes · 97 edges · 8 communities (5 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- test_sip_probe.py
- ai_bridge.py
- test_bridge.py
- FakeConn
- Asterisk — Slice 1: jawab call (call native)
- FakeUas
- docker-entrypoint.sh

## God Nodes (most connected - your core abstractions)
1. `FakeConn` - 11 edges
2. `run_probe()` - 9 edges
3. `run_call()` - 8 edges
4. `Asterisk — Slice 1: jawab call (call native)` - 6 edges
5. `BridgeConfig` - 5 edges
6. `wa_match()` - 5 edges
7. `FakeUas` - 5 edges
8. `load_bridge_config()` - 4 edges
9. `parse_agi_env()` - 4 edges
10. `normalize_wa()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `test_wa_match()` --calls--> `wa_match()`  [EXTRACTED]
  tests/test_bridge.py → ai_bridge.py
- `test_find_recipe_hint_then_owner_then_public()` --calls--> `find_recipe()`  [EXTRACTED]
  tests/test_bridge.py → ai_bridge.py
- `test_run_call_greeting_and_one_turn()` --calls--> `run_call()`  [EXTRACTED]
  tests/test_bridge.py → ai_bridge.py
- `test_probe_timeout_when_nobody_answers()` --calls--> `run_probe()`  [EXTRACTED]
  tests/test_sip_probe.py → sip_probe.py
- `test_parse_agi_env()` --calls--> `parse_agi_env()`  [EXTRACTED]
  tests/test_bridge.py → ai_bridge.py

## Import Cycles
- None detected.

## Communities (8 total, 3 thin omitted)

### Community 0 - "test_sip_probe.py"
Cohesion: 0.30
Nodes (12): build_ack(), build_bye(), build_invite(), Minimal SIP UAC probe: INVITE -> wait 200 OK -> ACK -> BYE. Signaling-only…, run_probe(), status_of(), to_tag_of(), test_build_invite_shape() (+4 more)

### Community 1 - "ai_bridge.py"
Cohesion: 0.33
Nodes (11): BridgeConfig, find_recipe(), load_bridge_config(), main(), process_utterance(), _req(), _row_to_recipe(), run_call() (+3 more)

### Community 2 - "test_bridge.py"
Cohesion: 0.29
Nodes (10): find_user(), normalize_wa(), parse_agi_env(), wa_match(), _recipe_row(), test_find_recipe_hint_then_owner_then_public(), test_find_user_matches_suffix(), test_normalize_wa() (+2 more)

### Community 4 - "Asterisk — Slice 1: jawab call (call native)"
Cohesion: 0.29
Nodes (6): Asterisk — Slice 1: jawab call (call native), Caveat jujur, Enablement Meta (checklist produksi), Env (`EXTERN_IP`, `META_SIP_USERNAME`, `META_SIP_PASSWORD` wajib), Slice 2: AI bridge (EAGI), Test loopback (butuh Docker)

## Knowledge Gaps
- **6 isolated node(s):** `docker-entrypoint.sh script`, `Env (`EXTERN_IP`, `META_SIP_USERNAME`, `META_SIP_PASSWORD` wajib)`, `Test loopback (butuh Docker)`, `Slice 2: AI bridge (EAGI)`, `Enablement Meta (checklist produksi)` (+1 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `FakeConn` connect `FakeConn` to `test_bridge.py`?**
  _High betweenness centrality (0.124) - this node is a cross-community bridge._
- **Why does `FakeUas` connect `FakeUas` to `test_sip_probe.py`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `run_call()` connect `ai_bridge.py` to `test_bridge.py`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `docker-entrypoint.sh script`, `Env (`EXTERN_IP`, `META_SIP_USERNAME`, `META_SIP_PASSWORD` wajib)`, `Test loopback (butuh Docker)` to the rest of the system?**
  _6 weakly-connected nodes found - possible documentation gaps or missing edges._