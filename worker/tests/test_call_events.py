from src.call_events import handle_call_event, parse_cook_payload
from src.config import WorkerConfig


def _cfg() -> WorkerConfig:
    return WorkerConfig(
        redis_url="r", queue_name="q", whatsapp_token="w", openai_api_key="o",
        meta_api_key="g", elevenlabs_api_key="e", elevenlabs_voice_id="v",
        database_url="d", s3_endpoint="s", s3_bucket="b", s3_access_key="a",
        s3_secret_key="s", gateway_url="g", internal_token="i",
    )


class FakeCursor:
    def __init__(self, rowcounts: list[int]) -> None:
        self.statements: list[tuple[str, tuple]] = []
        self._rowcounts = rowcounts
        self.rowcount = 0

    def __enter__(self):
        return self

    def __exit__(self, *a) -> bool:
        return False

    def execute(self, text, params=()):
        self.statements.append((text, tuple(params)))
        self.rowcount = self._rowcounts.pop(0) if self._rowcounts else 0


class FakeConn:
    last: "FakeConn | None" = None

    def __init__(self, rowcounts: list[int]) -> None:
        self.cursor_obj = FakeCursor(rowcounts)
        self.committed = False
        FakeConn.last = self

    def cursor(self):
        return self.cursor_obj

    def __enter__(self):
        return self

    def __exit__(self, *a) -> bool:
        return False

    def commit(self) -> None:
        self.committed = True


def _connect(monkeypatch, rowcounts: list[int]):
    import psycopg

    monkeypatch.setattr(psycopg, "connect", lambda *a, **k: FakeConn(rowcounts).__enter__() or FakeConn.last)


def test_parse_cook_payload() -> None:
    assert parse_cook_payload("cook:abc") == "abc"
    assert parse_cook_payload("nope") is None
    assert parse_cook_payload("") is None
    assert parse_cook_payload("cook:") is None


def test_connect_known_session_updates_it(monkeypatch) -> None:
    _connect(monkeypatch, [1])
    handle_call_event(_cfg(), {
        "kind": "call_event", "callId": "wacid.1", "from": "62812",
        "event": "connect", "ctaPayload": "cook:s1", "direction": "USER_INITIATED",
    })
    conn = FakeConn.last
    assert conn is not None and conn.committed
    texts = [s[0] for s in conn.cursor_obj.statements]
    assert len(texts) == 1 and "UPDATE call_sessions" in texts[0]
    assert conn.cursor_obj.statements[0][1] == ("wacid.1", "s1")


def test_connect_unknown_session_inserts(monkeypatch) -> None:
    _connect(monkeypatch, [0])
    handle_call_event(_cfg(), {
        "kind": "call_event", "callId": "wacid.2", "from": "62899",
        "event": "connect", "ctaPayload": "", "direction": "USER_INITIATED",
    })
    conn = FakeConn.last
    assert conn is not None
    texts = [s[0] for s in conn.cursor_obj.statements]
    assert len(texts) == 1 and "INSERT INTO call_sessions" in texts[0]


def test_terminate_marks_ended(monkeypatch) -> None:
    _connect(monkeypatch, [1])
    handle_call_event(_cfg(), {
        "kind": "call_event", "callId": "wacid.1", "from": "62812",
        "event": "terminate", "status": "Completed", "ctaPayload": "",
    })
    conn = FakeConn.last
    assert conn is not None
    stmt, params = conn.cursor_obj.statements[0]
    assert "UPDATE call_sessions" in stmt
    assert params[0] == "ended" and params[2] == "wacid.1"


def test_terminate_falls_back_to_session_id(monkeypatch) -> None:
    _connect(monkeypatch, [0, 1])
    handle_call_event(_cfg(), {
        "kind": "call_event", "callId": "wacid.9", "from": "62812",
        "event": "terminate", "status": "Failed", "ctaPayload": "cook:s9",
    })
    conn = FakeConn.last
    assert conn is not None
    assert len(conn.cursor_obj.statements) == 2
    assert conn.cursor_obj.statements[1][1][2] == "s9"
