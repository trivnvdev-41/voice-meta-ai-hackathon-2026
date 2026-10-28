import socket
import threading

from sip_probe import build_invite, run_probe, status_of, to_tag_of


def test_status_of() -> None:
    assert status_of("SIP/2.0 100 Trying\r\n\r\n") == 100
    assert status_of("SIP/2.0 200 OK\r\nTo: <x>;tag=abc\r\n\r\n") == 200
    assert status_of("INVITE sip:x SIP/2.0\r\n\r\n") is None
    assert status_of("garbage") is None


def test_to_tag_of() -> None:
    assert to_tag_of("SIP/2.0 200 OK\r\nTo: <sip:x>;tag=abc123\r\n\r\n") == "abc123"
    assert to_tag_of("SIP/2.0 100 Trying\r\n\r\n") == ""


def test_build_invite_shape() -> None:
    msg = build_invite("sip:t@h:1", "cid", "z9h1", 1, "v=0\r\n", "t1")
    assert msg.startswith("INVITE sip:t@h:1 SIP/2.0\r\n")
    assert "Call-ID: cid" in msg
    assert msg.endswith("v=0\r\n")
    body = msg.split("\r\n\r\n", 1)[1]
    assert f"Content-Length: {len(body.encode())}" in msg


class FakeUas(threading.Thread):
    """Replies 100 -> 180 -> 200 OK and records what the UAC sends."""

    def __init__(self) -> None:
        super().__init__(daemon=True)
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.bind(("127.0.0.1", 0))
        self.sock.settimeout(5.0)
        self.port = self.sock.getsockname()[1]
        self.seen: list[str] = []
        self.peer = None

    def run(self) -> None:
        try:
            data, self.peer = self.sock.recvfrom(65535)
            req = data.decode(errors="replace")
            self.seen.append(req.split(" ", 1)[0])
            call_id = next(
                line.split(":", 1)[1].strip()
                for line in req.split("\r\n")
                if line.lower().startswith("call-id:")
            )
            from_tag = req.split("tag=")[1].split("\r\n")[0].split(";")[0]
            base = (
                f"Via: SIP/2.0/UDP 127.0.0.1;branch=z\r\n"
                f"From: <sip:probe@127.0.0.1>;tag={from_tag}\r\n"
                f"To: <sip:test@127.0.0.1>;tag=uas1\r\n"
                f"Call-ID: {call_id}\r\n"
            )
            for code in ("100 Trying", "180 Ringing", "200 OK"):
                self.sock.sendto(f"SIP/2.0 {code}\r\n{base}CSeq: 1 INVITE\r\nContent-Length: 0\r\n\r\n".encode(), self.peer)
            for _ in range(2):
                data, _ = self.sock.recvfrom(65535)
                self.seen.append(data.decode(errors="replace").split(" ", 1)[0])
        finally:
            self.sock.close()


def test_probe_full_call_against_fake_uas() -> None:
    uas = FakeUas()
    uas.start()
    result = run_probe("127.0.0.1", uas.port, timeout=5.0)
    uas.join(timeout=10.0)
    assert result["answered"] is True
    assert result["to_tag"] == "uas1"
    assert uas.seen[:3] == ["INVITE", "ACK", "BYE"]


def test_probe_timeout_when_nobody_answers() -> None:
    spare = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    spare.bind(("127.0.0.1", 0))
    port = spare.getsockname()[1]
    spare.close()
    result = run_probe("127.0.0.1", port, timeout=1.0)
    assert result == {"answered": False, "to_tag": ""}
