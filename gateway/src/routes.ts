import express, { Router, type Request, type Response } from "express";
import type { Redis } from "ioredis";
import type { GatewayConfig } from "./config.js";
import { enqueueJob } from "./queue.js";
import {
  parseCallEvents,
  parseIncoming,
  sendAudioMessage,
  sendTextMessage,
  verifySignature,
  verifyWebhook,
} from "./whatsapp.js";

export const jsonParser = express.json({
  verify: (req, _res, buf) => {
    (req as { rawBody?: Buffer }).rawBody = buf;
  },
});

export interface RouterDeps {
  redis: Redis;
  config: GatewayConfig;
}

export function createRouter(deps: RouterDeps): Router {
  const { redis, config } = deps;
  const router = Router();

  router.get("/webhook", (req: Request, res: Response) => {
    const challenge = verifyWebhook(
      String(req.query["hub.mode"] ?? ""),
      String(req.query["hub.verify_token"] ?? ""),
      String(req.query["hub.challenge"] ?? ""),
      config.verifyToken,
    );
    if (challenge) res.status(200).send(challenge);
    else res.sendStatus(403);
  });

  router.post("/webhook", async (req: Request, res: Response) => {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    const valid = verifySignature(
      rawBody,
      req.header("x-hub-signature-256"),
      config.appSecret,
    );
    if (!valid) {
      res.sendStatus(403);
      return;
    }
    const incoming = parseIncoming(req.body);
    const callEvents = parseCallEvents(req.body);
    try {
      if (incoming && (incoming.audioId ?? incoming.textBody)) {
        await enqueueJob(redis, config.queueName, {
          waFrom: incoming.from,
          messageId: incoming.messageId,
          audioId: incoming.audioId,
          textBody: incoming.textBody,
          receivedAt: new Date().toISOString(),
        });
      }
      for (const event of callEvents) {
        await enqueueJob(redis, config.queueName, {
          ...event,
          receivedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error("enqueue failed", err);
      res.sendStatus(500);
      return;
    }
    res.sendStatus(200);
  });

  router.post("/internal/dispatch", (req: Request, res: Response) => {
    if (req.header("x-internal-token") !== config.internalToken) {
      res.sendStatus(401);
      return;
    }
    const { to, text, audioLink } = req.body as {
      to?: string;
      text?: string;
      audioLink?: string;
    };
    if (typeof to !== "string" || to.length === 0) {
      res.sendStatus(400);
      return;
    }
    void (async () => {
      try {
        if (text) await sendTextMessage(config, to, text);
        if (audioLink) await sendAudioMessage(config, to, audioLink);
      } catch (err) {
        console.error("dispatch failed", err);
      }
    })();
    res.sendStatus(202);
  });

  return router;
}
