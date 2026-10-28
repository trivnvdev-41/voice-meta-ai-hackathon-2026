"""Worker entrypoint: reliable queue loop with claim/ack."""
from __future__ import annotations

import json

import redis

from .call_events import handle_call_event
from .config import load_config
from .pipeline import run_job
from .queue import ack_job, claim_job, processing_name, requeue_processing


def main() -> None:
    cfg = load_config()
    client = redis.Redis.from_url(cfg.redis_url, decode_responses=True)
    processing = processing_name(cfg.queue_name)
    requeued = requeue_processing(client, cfg.queue_name, processing)
    if requeued:
        print(f"requeued {requeued} interrupted job(s)", flush=True)
    print(f"worker listening on {cfg.queue_name}", flush=True)
    while True:
        payload = claim_job(client, cfg.queue_name, processing, timeout=30)
        if payload is None:
            continue
        try:
            job = json.loads(payload)
        except json.JSONDecodeError:
            print("skip: invalid JSON", flush=True)
            ack_job(client, processing, payload)
            continue
        if not isinstance(job, dict):
            ack_job(client, processing, payload)
            continue
        try:
            if isinstance(job, dict) and job.get("kind") == "call_event":
                handle_call_event(cfg, job)
            else:
                run_job(cfg, job)
        except Exception as exc:
            print(f"job failed: {exc}", flush=True)
        ack_job(client, processing, payload)


if __name__ == "__main__":
    main()
