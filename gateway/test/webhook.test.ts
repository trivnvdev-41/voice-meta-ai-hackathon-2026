import { createHmac } from "node:crypto";
import { Socket, type AddressInfo } from "node:net";
import express from "express";
import type { Redis } from "ioredis";
import { describe, expect, it } from "vitest";
import type { GatewayConfig } from "../src/config.js";
import { createRouter, jsonParser } from "../src/routes.js";
import {
  buildCallButtonMessage,
  parseCallEvents,
  parseIncomingMessages,
  verifySignature,
  verifyWebhook,
} from "../src/whatsapp.js";

describe("verifyWebhook", () => {
  it("returns challenge on valid subscribe", () => {
    expect(verifyWebhook("subscribe", "secret", "ch123", "secret")).toBe("ch123");
  });

  it("rejects wrong token", () => {
    expect(verifyWebhook("subscribe", "nope", "ch123", "secret")).toBeNull();
  });

  it("rejects empty challenge", () => {
    expect(verifyWebhook("subscribe", "secret", "", "secret")).toBeNull();
  });
});

describe("parseIncomingMessages", () => {
  it("parses audio message", () => {
    const body = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  { id: "wamid.1", from: "62812", type: "audio", audio: { id: "media123" } },
                ],
              },
            },
          ],
        },
      ],
    };
    expect(parseIncomingMessages(body)).toEqual([{
      from: "62812",
      type: "audio",
      messageId: "wamid.1",
      audioId: "media123",
    }]);
  });

  it("parses text message", () => {
    const body = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  { id: "wamid.2", from: "62812", type: "text", text: { body: "halo" } },
                ],
              },
            },
          ],
        },
      ],
    };
    expect(parseIncomingMessages(body)).toEqual([{
      from: "62812",
      type: "text",
      messageId: "wamid.2",
      textBody: "halo",
    }]);
  });

  it("returns [] for status updates", () => {
    const body = { entry: [{ changes: [{ value: { statuses: [{}] } }] }] };
    expect(parseIncomingMessages(body)).toEqual([]);
  });

  it("returns every message in a batched webhook", () => {
    const body = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  { id: "wamid.a", from: "62811", type: "audio", audio: { id: "m1" } },
                  { id: "wamid.b", from: "62812", type: "text", text: { body: "hai" } },
                ],
              },
            },
          ],
        },
      ],
    };
    expect(parseIncomingMessages(body).map((m) => m.messageId)).toEqual([
      "wamid.a",
      "wamid.b",
    ]);
  });
});

describe("verifySignature", () => {
  const secret = "test-secret";
  const body = Buffer.from('{"a":1}');
  const good =
    "sha256=" + createHmac("sha256", secret).update(body).digest("hex");

  it("accepts valid signature", () => {
    expect(verifySignature(body, good, secret)).toBe(true);
  });

  it("rejects wrong signature", () => {
    expect(verifySignature(body, "sha256=" + "0".repeat(64), secret)).toBe(false);
  });

  it("rejects missing header", () => {
    expect(verifySignature(body, undefined, secret)).toBe(false);
  });

  it("rejects missing body", () => {
    expect(verifySignature(undefined, good, secret)).toBe(false);
  });
});

describe("buildCallButtonMessage", () => {
  it("builds voice_call interactive payload", () => {
    const msg = buildCallButtonMessage("62812", {
      bodyText: "Tekan untuk masak",
      displayText: "Masak via Call",
      ttlMinutes: 60,
      payload: "cook:s1",
    }) as any;
    expect(msg.type).toBe("interactive");
    expect(msg.interactive.action.name).toBe("voice_call");
    expect(msg.interactive.action.parameters.payload).toBe("cook:s1");
  });

  it("rejects long display text, bad ttl, long payload", () => {
    const base = { bodyText: "x", to: "y" };
    expect(() => buildCallButtonMessage("y", { ...base, displayText: "x".repeat(21) })).toThrow();
    expect(() => buildCallButtonMessage("y", { ...base, ttlMinutes: 0 })).toThrow();
    expect(() => buildCallButtonMessage("y", { ...base, ttlMinutes: 43201 })).toThrow();
    expect(() => buildCallButtonMessage("y", { ...base, payload: "x".repeat(513) })).toThrow();
  });
});

describe("parseCallEvents", () => {
  const body = {
    entry: [
      {
        changes: [
          {
            value: {
              contacts: [{ wa_id: "62812", profile: { name: "B" } }],
              calls: [
                {
                  id: "wacid.1", to: "bus", from: "62812", event: "connect",
                  timestamp: "1", direction: "USER_INITIATED", cta_payload: "cook:s1",
                },
                {
                  id: "wacid.2", to: "bus", event: "terminate", timestamp: "2",
                  direction: "USER_INITIATED", status: ["Completed"], duration: 120,
                },
              ],
            },
          },
        ],
      },
    ],
  };

  it("parses connect and terminate, falls back to contact wa_id", () => {
    const events = parseCallEvents(body);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ kind: "call_event", callId: "wacid.1", from: "62812", ctaPayload: "cook:s1" });
    expect(events[1]).toMatchObject({ from: "62812", event: "terminate", status: "Completed", duration: 120 });
  });

  it("ignores bodies without calls", () => {
    expect(parseCallEvents({})).toEqual([]);
    expect(parseCallEvents({ entry: [{ changes: [{ value: {} }] }] })).toEqual([]);
  });
});

describe("POST /webhook", () => {
  const config: GatewayConfig = {
    port: 0,
    appSecret: "test-secret",
    verifyToken: "v",
    whatsappToken: "w",
    phoneNumberId: "p",
    redisUrl: "",
    internalToken: "i",
    queueName: "q",
    databaseUrl: "",
    sessionSecret: "s",
    migrationsDir: "",
  };
  const audioBody = {
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                { id: "wamid.9", from: "62812", type: "audio", audio: { id: "m1" } },
              ],
            },
          },
        ],
      },
    ],
  };

  function signed(body: unknown): { payload: string; signature: string } {
    const payload = JSON.stringify(body);
    const signature =
      "sha256=" + createHmac("sha256", config.appSecret).update(payload).digest("hex");
    return { payload, signature };
  }

  async function withServer(
    redis: { lpush: (key: string, value: string) => Promise<number> },
    fn: (baseUrl: string) => Promise<void>,
  ): Promise<void> {
    const app = express();
    app.use(jsonParser);
    app.use(createRouter({ redis: redis as unknown as Redis, config }));
    const server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const { port } = server.address() as AddressInfo;
    try {
      await fn(`http://127.0.0.1:${port}`);
    } finally {
      server.close();
    }
  }

  // Raw socket: immune to HTTP(S)_PROXY env that hijacks fetch/http clients.
  async function post(
    base: string,
    payload: string,
    signature: string,
  ): Promise<number> {
    const url = new URL(`${base}/webhook`);
    const requestText =
      `POST ${url.pathname} HTTP/1.1\r\n` +
      `Host: ${url.hostname}\r\n` +
      `Content-Type: application/json\r\n` +
      `Content-Length: ${Buffer.byteLength(payload)}\r\n` +
      `X-Hub-Signature-256: ${signature}\r\n` +
      `Connection: close\r\n\r\n` +
      payload;
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      let data = "";
      socket.on("data", (chunk) => {
        data += chunk.toString();
      });
      socket.on("error", reject);
      socket.on("close", () => {
        const match = data.match(/^HTTP\/\d\.\d (\d{3})/);
        if (match) resolve(Number(match[1]));
        else reject(new Error(`bad response: ${data.slice(0, 80)}`));
      });
      socket.connect(Number(url.port), url.hostname, () =>
        socket.end(requestText),
      );
    });
  }

  it("enqueues and returns 200 on valid signature", async () => {
    let pushed = "";
    const redis = {
      lpush: async (_key: string, value: string) => {
        pushed = value;
        return 1;
      },
    };
    await withServer(redis, async (base) => {
      const { payload, signature } = signed(audioBody);
      expect(await post(base, payload, signature)).toBe(200);
    });
    expect(pushed).toContain("wamid.9");
  });

  it("returns 403 on invalid signature", async () => {
    const redis = { lpush: async () => 1 };
    await withServer(redis, async (base) => {
      const { payload } = signed(audioBody);
      expect(await post(base, payload, "sha256=" + "0".repeat(64))).toBe(403);
    });
  });

  it("returns 500 when enqueue fails", async () => {
    const redis = {
      lpush: async (): Promise<number> => {
        throw new Error("redis down");
      },
    };
    await withServer(redis, async (base) => {
      const { payload, signature } = signed(audioBody);
      expect(await post(base, payload, signature)).toBe(500);
    });
  });

  it("enqueues call events as call_event jobs", async () => {
    const pushed: string[] = [];
    const redis = {
      lpush: async (_key: string, value: string) => {
        pushed.push(value);
        return 1;
      },
    };
    const callsBody = {
      entry: [
        {
          changes: [
            {
              value: {
                contacts: [{ wa_id: "62812" }],
                calls: [
                  {
                    id: "wacid.9", to: "bus", from: "62812", event: "connect",
                    timestamp: "9", direction: "USER_INITIATED", cta_payload: "cook:s9",
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    await withServer(redis, async (base) => {
      const { payload, signature } = signed(callsBody);
      expect(await post(base, payload, signature)).toBe(200);
    });
    expect(pushed).toHaveLength(1);
    expect(pushed[0]).toContain('"kind":"call_event"');
    expect(pushed[0]).toContain("cook:s9");
  });
});
