import io

import ai_bridge
from ai_bridge import normalize_wa, parse_agi_env, wa_match


def test_parse_agi_env() -> None:
    env = parse_agi_env([
        "agi_callerid: 6281234567890",
        "agi_arg_1: recipe-9",
        "agi_channel: PJSIP/meta-1",
        "",
    ])
    assert env == {
        "agi_callerid": "6281234567890",
        "agi_arg_1": "recipe-9",
        "agi_channel": "PJSIP/meta-1",
    }


def test_wa_match() -> None:
    assert wa_match("+62 812-3456-7890", "6281234567890")
    assert wa_match("081234567890", "6281234567890")
    assert not wa_match("6281299999999", "6281234567890")
    assert not wa_match("123", "456")
    assert not wa_match("", "6281234567890")


def test_normalize_wa() -> None:
    assert normalize_wa("+62 (812) 3456-7890") == "6281234567890"


class FakeConn:
    """Minimal cursor/connection double for find_user/find_recipe."""

    def __init__(self, users, recipes) -> None:
        self._users = users
        self._recipes = recipes
        self._rows: list = []

    def cursor(self):
        return self

    def __enter__(self):
        return self

    def __exit__(self, *a) -> bool:
        return False

    def execute(self, text, params=()):
        if "FROM users" in text:
            self._rows = self._users
        elif "WHERE id = %s" in text:
            self._rows = [r for r in self._recipes if r[0] == params[0]]
        elif "author_user_id" in text:
            self._rows = [r for r in self._recipes if r[9] == params[0]][:1]
        elif "visibility = 'public'" in text:
            self._rows = [r for r in self._recipes if r[10] == "public"][:1]

    def fetchall(self):
        return self._rows

    def fetchone(self):
        return self._rows[0] if self._rows else None


def _recipe_row(rid="r1", author="u1", visibility="private"):
    return (
        rid, "Rendang", "Opung", "Siregar", "Sumbar", "id",
        [{"name": "santan"}], ["Masak."], "Cerita", author, visibility,
    )


def test_find_user_matches_suffix() -> None:
    conn = FakeConn([("u1", "Nenek", "6281234567890")], [])
    assert ai_bridge.find_user(conn, "+6281234567890") == {"id": "u1", "display_name": "Nenek"}
    assert ai_bridge.find_user(conn, "999") is None


def test_find_recipe_hint_then_owner_then_public() -> None:
    conn = FakeConn([], [_recipe_row("r1", "u9"), _recipe_row("r2", "u1"), _recipe_row("r3", "u9", "public")])
    assert ai_bridge.find_recipe(conn, "u1", "r1")["id"] == "r1"
    assert ai_bridge.find_recipe(conn, "u1", None)["id"] == "r2"
    assert ai_bridge.find_recipe(conn, None, None)["id"] == "r3"
    assert ai_bridge.find_recipe(FakeConn([], []), None, None) is None


class SessionConn(FakeConn):
    def __init__(self, sessions, recipes) -> None:
        super().__init__([], recipes)
        self._sessions = sessions

    def execute(self, text, params=()):
        if "call_sessions WHERE id" in text and "recipes" in text:
            session = next((s for s in self._sessions if s[0] == params[0]), None)
            rid = session[1] if session else None
            self._rows = [r for r in self._recipes if r[0] == rid]
        elif "FROM call_sessions" in text:
            self._rows = [(s[0], s[1], s[2]) for s in self._sessions]
        else:
            super().execute(text, params)


def test_find_session_recipe_by_hint() -> None:
    conn = SessionConn([("s1", "r9", "62812")], [_recipe_row("r9", "u9")])
    recipe = ai_bridge.find_session_recipe(conn, "999", "cook:s1")
    assert recipe is not None and recipe["id"] == "r9"


def test_find_session_recipe_by_caller() -> None:
    conn = SessionConn([("s1", "r9", "6281234567890")], [_recipe_row("r9", "u9")])
    recipe = ai_bridge.find_session_recipe(conn, "+6281234567890", None)
    assert recipe is not None and recipe["id"] == "r9"


def test_find_session_recipe_none_without_match() -> None:
    conn = SessionConn([("s1", "r9", "6280000000000")], [_recipe_row("r9", "u9")])
    assert ai_bridge.find_session_recipe(conn, "6281234567890", None) is None
    assert ai_bridge.find_session_recipe(conn, "6281234567890", "cook:missing") is None


def test_run_call_greeting_and_one_turn(monkeypatch) -> None:
    spoken: list[str] = []

    monkeypatch.setattr(ai_bridge, "find_user", lambda conn, cid: {"id": "u1", "display_name": "Budi"})
    monkeypatch.setattr(ai_bridge, "find_session_recipe", lambda conn, cid, hint: None)
    monkeypatch.setattr(ai_bridge, "find_recipe", lambda conn, uid, hint: {
        "name": "Rendang", "steps": ["Masak santan.", "Selesai."],
    })
    monkeypatch.setattr(ai_bridge, "speak", lambda out, text, cfg: spoken.append(text))
    monkeypatch.setattr(ai_bridge, "process_utterance", lambda cfg, session, pcm: session.respond("lanjut", "k"))

    import struct

    tone = b"".join(struct.pack("<h", 4000) for _ in range(8000))
    audio_in = io.BytesIO(tone)
    audio_out = io.BytesIO()
    ai_bridge.run_call({}, audio_in, audio_out, cfg=None, conn=None)

    assert any("Rendang" in s for s in spoken)
    assert any("Selesai" in s for s in spoken)
