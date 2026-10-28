import json

from src.queue import (
    ack_job,
    claim_job,
    dead_letter,
    dead_letter_name,
    processing_name,
    push_job,
    requeue_processing,
)


class StubRedis:
    """In-memory stand-in for the Redis list commands queue.py uses."""

    def __init__(self) -> None:
        self.lists: dict[str, list[str]] = {}

    def lpush(self, name: str, value: str) -> int:
        items = self.lists.setdefault(name, [])
        items.insert(0, value)
        return len(items)

    def blmove(
        self,
        source: str,
        destination: str,
        timeout: float = 0,
        src: str = "RIGHT",
        dest: str = "LEFT",
    ) -> str | None:
        del timeout
        items = self.lists.get(source, [])
        if not items:
            return None
        value = items.pop() if src == "RIGHT" else items.pop(0)
        dest_items = self.lists.setdefault(destination, [])
        if dest == "LEFT":
            dest_items.insert(0, value)
        else:
            dest_items.append(value)
        return value

    def lrem(self, name: str, count: int, value: str) -> int:
        items = self.lists.get(name, [])
        kept = []
        removed = 0
        for item in items:
            if item == value and removed < count:
                removed += 1
            else:
                kept.append(item)
        self.lists[name] = kept
        return removed

    def lmove(self, source: str, destination: str, src: str, dest: str) -> str | None:
        items = self.lists.get(source, [])
        if not items:
            return None
        value = items.pop(0) if src == "LEFT" else items.pop()
        dest_items = self.lists.setdefault(destination, [])
        if dest == "LEFT":
            dest_items.insert(0, value)
        else:
            dest_items.append(value)
        return value


def _seed(client: StubRedis, queue: str) -> None:
    for job in ("job-a", "job-b", "job-c"):
        client.lpush(queue, job)


def test_claim_is_fifo() -> None:
    client = StubRedis()
    proc = processing_name("q")
    _seed(client, "q")
    assert claim_job(client, "q", proc) == "job-a"
    assert claim_job(client, "q", proc) == "job-b"
    assert claim_job(client, "q", proc) == "job-c"
    assert claim_job(client, "q", proc, timeout=1) is None


def test_ack_removes_from_processing() -> None:
    client = StubRedis()
    proc = processing_name("q")
    _seed(client, "q")
    payload = claim_job(client, "q", proc)
    assert payload is not None
    ack_job(client, proc, payload)
    assert client.lists.get(proc, []) == []


def test_crash_requeues_unacked_jobs_in_order() -> None:
    client = StubRedis()
    proc = processing_name("q")
    _seed(client, "q")
    assert claim_job(client, "q", proc) == "job-a"
    assert claim_job(client, "q", proc) == "job-b"
    # worker crashes before acking either job
    assert requeue_processing(client, "q", proc) == 2
    assert claim_job(client, "q", proc) == "job-a"
    assert claim_job(client, "q", proc) == "job-b"
    assert claim_job(client, "q", proc) == "job-c"


def test_push_job_appends_to_queue() -> None:
    client = StubRedis()
    push_job(client, "q", "job-x")
    assert client.lists["q"] == ["job-x"]


def test_dead_letter_keeps_payload_and_error() -> None:
    client = StubRedis()
    dead_letter(client, "q", '{"a":1}', "RuntimeError: boom")
    parked = client.lists[dead_letter_name("q")]
    assert len(parked) == 1
    assert json.loads(parked[0]) == {
        "payload": '{"a":1}',
        "error": "RuntimeError: boom",
    }
