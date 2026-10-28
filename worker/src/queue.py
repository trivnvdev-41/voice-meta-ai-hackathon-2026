"""Reliable queue: claim a job, ack it only after processing.

A crash between claim and ack leaves the payload in the processing list,
which is moved back to the main queue on the next boot.
"""
from __future__ import annotations

import json
from typing import Protocol


class ListClient(Protocol):
    def lpush(self, name: str, value: str) -> int: ...
    def blmove(
        self,
        source: str,
        destination: str,
        timeout: float = 0,
        src: str = "RIGHT",
        dest: str = "LEFT",
    ) -> str | None: ...
    def lrem(self, name: str, count: int, value: str) -> int: ...
    def lmove(self, source: str, destination: str, src: str, dest: str) -> str | None: ...


def processing_name(queue_name: str) -> str:
    return f"{queue_name}:processing"


def claim_job(
    client: ListClient, queue_name: str, processing: str, timeout: float = 30
) -> str | None:
    return client.blmove(
        queue_name, processing, timeout=timeout, src="RIGHT", dest="LEFT"
    )


def ack_job(client: ListClient, processing: str, payload: str) -> None:
    client.lrem(processing, 1, payload)


def requeue_processing(
    client: ListClient, queue_name: str, processing: str
) -> int:
    moved = 0
    while client.lmove(processing, queue_name, src="LEFT", dest="RIGHT") is not None:
        moved += 1
    return moved


def push_job(client: ListClient, queue_name: str, payload: str) -> None:
    client.lpush(queue_name, payload)


def dead_letter_name(queue_name: str) -> str:
    return f"{queue_name}:dead"


def dead_letter(
    client: ListClient, queue_name: str, payload: str, error: str
) -> None:
    """Park an unrecoverable job so it can be inspected instead of lost."""
    client.lpush(
        dead_letter_name(queue_name),
        json.dumps({"payload": payload, "error": error}),
    )
