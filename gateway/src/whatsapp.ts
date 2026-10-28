import { createHmac, timingSafeEqual } from "node:crypto";

export interface IncomingMessage {
  from: string;
  type: string;
  messageId: string;
  audioId?: string;
  textBody?: string;
}

export interface WhatsAppCredentials {
  whatsappToken: string;
  phoneNumberId: string;
}

export function verifyWebhook(
  mode: string,
  token: string,
  challenge: string,
  verifyToken: string,
): string | null {
  if (mode === "subscribe" && token === verifyToken && challenge.length > 0) {
    return challenge;
  }
  return null;
}

export function verifySignature(
  rawBody: Buffer | undefined,
  signatureHeader: string | undefined,
  appSecret: string,
): boolean {
  if (
    !rawBody ||
    !signatureHeader ||
    !signatureHeader.startsWith("sha256=")
  ) {
    return false;
  }
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  const received = Buffer.from(signatureHeader.slice(7), "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export interface CallButtonOptions {
  bodyText: string;
  displayText?: string;
  ttlMinutes?: number;
  payload?: string;
}

export function buildCallButtonMessage(to: string, opts: CallButtonOptions): object {
  const displayText = opts.displayText ?? "Call Now";
  const ttlMinutes = opts.ttlMinutes ?? 60;
  const payload = opts.payload ?? "";
  if (!opts.bodyText) throw new Error("call button body text required");
  if (displayText.length === 0 || displayText.length > 20) {
    throw new Error("call button display text 1..20 chars");
  }
  if (!Number.isInteger(ttlMinutes) || ttlMinutes < 1 || ttlMinutes > 43200) {
    throw new Error("ttl_minutes must be 1..43200");
  }
  if (payload.length > 512) throw new Error("call button payload max 512 chars");
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "voice_call",
      body: { text: opts.bodyText },
      action: {
        name: "voice_call",
        parameters: { display_text: displayText, ttl_minutes: ttlMinutes, payload },
      },
    },
  };
}

export async function sendCallButtonMessage(
  creds: WhatsAppCredentials,
  to: string,
  opts: CallButtonOptions,
): Promise<void> {
  await sendPayload(creds, buildCallButtonMessage(to, opts));
}

type JsonObject = Record<string, any>;

export function parseIncoming(body: unknown): IncomingMessage | null {
  const msg = (body as JsonObject | null)?.entry?.[0]?.changes?.[0]?.value
    ?.messages?.[0] as JsonObject | undefined;
  if (!msg || typeof msg.from !== "string") return null;
  const incoming: IncomingMessage = {
    from: msg.from,
    type: typeof msg.type === "string" ? msg.type : "unknown",
    messageId: typeof msg.id === "string" ? msg.id : "",
  };
  if (msg.type === "audio" && typeof msg.audio?.id === "string") {
    incoming.audioId = msg.audio.id;
  }
  if (msg.type === "text" && typeof msg.text?.body === "string") {
    incoming.textBody = msg.text.body;
  }
  return incoming;
}

export interface CallEventJob {
  kind: "call_event";
  callId: string;
  from: string;
  to: string;
  event: string;
  timestamp: string;
  direction: string;
  ctaPayload: string;
  deeplinkPayload: string;
  status: string;
  duration: number;
}

export function parseCallEvents(body: unknown): CallEventJob[] {
  const out: CallEventJob[] = [];
  const entries = (body as JsonObject | null)?.entry;
  if (!Array.isArray(entries)) return out;
  for (const entry of entries) {
    const changes = (entry as JsonObject)?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const value = (change as JsonObject)?.value as JsonObject | undefined;
      const calls = value?.calls;
      if (!Array.isArray(calls)) continue;
      const contacts = Array.isArray(value?.contacts) ? value.contacts : [];
      const contact = contacts[0] as JsonObject | undefined;
      const contactWa = typeof contact?.wa_id === "string" ? contact.wa_id : "";
      for (const item of calls) {
        const call = item as JsonObject;
        if (typeof call.id !== "string") continue;
        const from = typeof call.from === "string" && call.from ? call.from : contactWa;
        const status = Array.isArray(call.status)
          ? String(call.status[0] ?? "")
          : typeof call.status === "string"
            ? call.status
            : "";
        out.push({
          kind: "call_event",
          callId: call.id,
          from,
          to: typeof call.to === "string" ? call.to : "",
          event: typeof call.event === "string" ? call.event : "",
          timestamp: typeof call.timestamp === "string" ? call.timestamp : "",
          direction: typeof call.direction === "string" ? call.direction : "",
          ctaPayload: typeof call.cta_payload === "string" ? call.cta_payload : "",
          deeplinkPayload:
            typeof call.deeplink_payload === "string" ? call.deeplink_payload : "",
          status,
          duration: typeof call.duration === "number" ? call.duration : 0,
        });
      }
    }
  }
  return out;
}

async function sendPayload(
  creds: WhatsAppCredentials,
  payload: unknown,
): Promise<void> {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${creds.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.whatsappToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) throw new Error(`WhatsApp send failed: ${res.status}`);
}

export async function sendTextMessage(
  creds: WhatsAppCredentials,
  to: string,
  text: string,
): Promise<void> {
  await sendPayload(creds, {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  });
}

export async function sendAudioMessage(
  creds: WhatsAppCredentials,
  to: string,
  audioLink: string,
): Promise<void> {
  await sendPayload(creds, {
    messaging_product: "whatsapp",
    to,
    type: "audio",
    audio: { link: audioLink },
  });
}
