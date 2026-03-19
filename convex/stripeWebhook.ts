import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

function parseStripeSignature(headerValue: string | null): { timestamp: string; signatures: string[] } | null {
  if (!headerValue) return null;

  const entries = headerValue
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.split("=") as [string, string]);

  const timestamp = entries.find(([key]) => key === "t")?.[1];
  const signatures = entries.filter(([key]) => key === "v1").map(([, value]) => value);

  if (!timestamp || signatures.length === 0) return null;
  return { timestamp, signatures };
}

function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function computeHmacSha256Hex(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const bytes = new Uint8Array(signature);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hasValidStripeSignature(params: {
  rawBody: string;
  stripeSignatureHeader: string | null;
  webhookSecret: string;
}): Promise<boolean> {
  const parsed = parseStripeSignature(params.stripeSignatureHeader);
  if (!parsed) return false;

  const signedPayload = `${parsed.timestamp}.${params.rawBody}`;
  const expected = await computeHmacSha256Hex(signedPayload, params.webhookSecret);

  for (const signature of parsed.signatures) {
    if (timingSafeCompare(signature, expected)) return true;
  }

  return false;
}

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const stripeWebhook = httpAction(async (ctx, request) => {
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return jsonResponse(500, { error: "Missing STRIPE_WEBHOOK_SECRET" });
  }

  const rawBody = await request.text();
  const isValid = await hasValidStripeSignature({
    rawBody,
    stripeSignatureHeader: request.headers.get("stripe-signature"),
    webhookSecret,
  });

  if (!isValid) {
    return jsonResponse(400, { error: "Invalid Stripe signature" });
  }

  let event: {
    id: string;
    type: string;
    livemode?: boolean;
    data?: { object?: Record<string, unknown> };
  };

  try {
    event = JSON.parse(rawBody);
  } catch {
    return jsonResponse(400, { error: "Invalid JSON payload" });
  }

  if (!event?.id || !event?.type) {
    return jsonResponse(400, { error: "Missing Stripe event id or type" });
  }

  const object = event.data?.object;
  const stripePaymentIntentId =
    typeof object?.payment_intent === "string"
      ? object.payment_intent
      : event.type.startsWith("payment_intent.") && typeof object?.id === "string"
        ? object.id
        : undefined;

  const stripeChargeId =
    event.type.startsWith("charge.") && typeof object?.id === "string" ? object.id : undefined;

  const ingestResult = await ctx.runMutation(internal.stripeIngest.recordStripeWebhookEvent, {
    eventId: event.id,
    eventType: event.type,
    livemode: Boolean(event.livemode),
    payloadJson: rawBody,
    stripePaymentIntentId,
    stripeChargeId,
  });

  const projectionResult = await ctx.runMutation(internal.liveData.applyStripeEventToDonation, {
    eventType: event.type,
    stripePaymentIntentId,
    stripeChargeId,
  });

  return jsonResponse(200, {
    received: true,
    duplicate: ingestResult.duplicate,
    eventId: event.id,
    eventType: event.type,
    projection: projectionResult,
  });
});
