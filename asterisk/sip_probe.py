"""Minimal SIP UAC probe: INVITE -> wait 200 OK -> ACK -> BYE.

Signaling-only loopback test for the Asterisk slice (stdlib only, so it
runs anywhere; immune to HTTP(S)_PROXY env). Media/RTP is out of scope.
"""
from __future__ import annotations

import random
import socket
import time

SDP_TEMPLATE = """v=0
o=- {sess} {sess} IN IP4 127.0.0.1
s=-
c=IN IP4 127.0.0.1
t=0 0
m=audio 4000 RTP/AVP 0 8
a=rtpmap:0 PCMU/8000
a=rtpmap:8 PCMA/8000
"""


def build_invite(
    target: str, call_id: str, branch: str, cseq: int, sdp: str, tag: str
) -> str:
    return (
        f"INVITE {target} SIP/2.0\r\n"
        f"Via: SIP/2.0/UDP 127.0.0.1:5099;branch={branch}\r\n"
        "Max-Forwards: 70\r\n"
        f"From: <sip:probe@127.0.0.1>;tag={tag}\r\n"
        f"To: <{target}>\r\n"
        f"Call-ID: {call_id}\r\n"
        f"CSeq: {cseq} INVITE\r\n"
        "Contact: <sip:probe@127.0.0.1:5099>\r\n"
        "Content-Type: application/sdp\r\n"
        f"Content-Length: {len(sdp.encode())}\r\n"
        "\r\n"
        f"{sdp}"
    )


def build_ack(target: str, call_id: str, branch: str, tag: str, to_tag: str) -> str:
    return (
        f"ACK {target} SIP/2.0\r\n"
        f"Via: SIP/2.0/UDP 127.0.0.1:5099;branch={branch}\r\n"
        "Max-Forwards: 70\r\n"
        f"From: <sip:probe@127.0.0.1>;tag={tag}\r\n"
        f"To: <{target}>;tag={to_tag}\r\n"
        f"Call-ID: {call_id}\r\n"
        "CSeq: 1 ACK\r\n"
        "Content-Length: 0\r\n"
        "\r\n"
    )


def build_bye(target: str, call_id: str, branch: str, tag: str, to_tag: str) -> str:
    return (
        f"BYE {target} SIP/2.0\r\n"
        f"Via: SIP/2.0/UDP 127.0.0.1:5099;branch={branch}\r\n"
        "Max-Forwards: 70\r\n"
        f"From: <sip:probe@127.0.0.1>;tag={tag}\r\n"
        f"To: <{target}>;tag={to_tag}\r\n"
        f"Call-ID: {call_id}\r\n"
        "CSeq: 2 BYE\r\n"
        "Content-Length: 0\r\n"
        "\r\n"
    )


def status_of(packet: str) -> int | None:
    first = packet.split("\r\n", 1)[0]
    if not first.startswith("SIP/2.0 "):
        return None
    try:
        return int(first.split(" ")[1])
    except (IndexError, ValueError):
        return None


def to_tag_of(packet: str) -> str:
    for line in packet.split("\r\n"):
        if line.lower().startswith("to:") and "tag=" in line:
            return line.split("tag=")[1].split(";")[0].strip()
    return ""


def run_probe(host: str, port: int, user: str = "test", timeout: float = 5.0) -> dict:
    target = f"sip:{user}@{host}:{port}"
    call_id = f"{random.randint(10**9, 10**10 - 1)}@probe"
    tag = f"p{random.randint(10**5, 10**6 - 1)}"
    branch = f"z9hG4bK{random.randint(10**9, 10**10 - 1)}"
    sdp = SDP_TEMPLATE.format(sess=random.randint(10**9, 10**10 - 1))

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(timeout)
    deadline = time.monotonic() + timeout
    try:
        sock.sendto(build_invite(target, call_id, branch, 1, sdp, tag).encode(), (host, port))
        to_tag = ""
        while time.monotonic() < deadline:
            try:
                data, _ = sock.recvfrom(65535)
            except socket.timeout:
                break
            packet = data.decode(errors="replace")
            status = status_of(packet)
            if status is None:
                continue
            if status == 200:
                to_tag = to_tag_of(packet)
                break
        if not to_tag:
            return {"answered": False, "to_tag": ""}
        ack_branch = f"z9hG4bK{random.randint(10**9, 10**10 - 1)}"
        sock.sendto(build_ack(target, call_id, ack_branch, tag, to_tag).encode(), (host, port))
        bye_branch = f"z9hG4bK{random.randint(10**9, 10**10 - 1)}"
        sock.sendto(build_bye(target, call_id, bye_branch, tag, to_tag).encode(), (host, port))
        return {"answered": True, "to_tag": to_tag}
    finally:
        sock.close()
