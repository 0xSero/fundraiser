import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

const DEFAULT_CAMPAIGN_SLUG = "compute-cluster-fund";
const EVM_CHAINS = new Set(["base", "polygon", "optimism", "ethereum"]);

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
};

function inferChainFromPaymentRailCode(paymentRailCode: string): string | undefined {
  if (paymentRailCode.startsWith("solana_")) return "solana";
  if (paymentRailCode.startsWith("base_")) return "base";
  if (paymentRailCode.startsWith("polygon_")) return "polygon";
  if (paymentRailCode.startsWith("optimism_")) return "optimism";
  if (paymentRailCode.startsWith("ethereum_")) return "ethereum";
  return undefined;
}

function resolveCryptoDestination(paymentRailCode: string): { chain: string; address: string } {
  const chain = inferChainFromPaymentRailCode(paymentRailCode);
  if (!chain) {
    throw new Error(`Unsupported crypto payment rail: ${paymentRailCode}`);
  }

  if (chain === "solana") {
    const solanaAddress = process.env.SOLANA_DONATION_ADDRESS?.trim();
    if (!solanaAddress) {
      throw new Error("Missing SOLANA_DONATION_ADDRESS");
    }
    return { chain, address: solanaAddress };
  }

  if (EVM_CHAINS.has(chain)) {
    const evmAddress = process.env.EVM_DONATION_ADDRESS?.trim();
    if (!evmAddress) {
      throw new Error("Missing EVM_DONATION_ADDRESS");
    }
    return { chain, address: evmAddress };
  }

  throw new Error(`Unsupported chain for rail ${paymentRailCode}: ${chain}`);
}

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS_HEADERS,
      "content-type": "application/json",
    },
  });
}

function optionsResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

function xmlEscape(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function createStripePaymentIntent(params: {
  amountUsdCents: number;
  campaignSlug: string;
  paymentRailCode: string;
  donorEmail?: string;
  donorName?: string;
}): Promise<{ id: string; clientSecret: string }> {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  const form = new URLSearchParams();
  form.set("amount", String(params.amountUsdCents));
  form.set("currency", "usd");
  form.set("automatic_payment_methods[enabled]", "true");
  form.set("metadata[campaign_slug]", params.campaignSlug);
  form.set("metadata[payment_rail]", params.paymentRailCode);

  if (params.donorEmail) {
    form.set("receipt_email", params.donorEmail);
  }

  if (params.donorName) {
    form.set("metadata[donor_name]", params.donorName);
  }

  const response = await fetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: {
      authorization: `Bearer ${stripeSecretKey}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  const payload = (await response.json()) as {
    id?: string;
    client_secret?: string;
    error?: { message?: string };
  };

  if (!response.ok || !payload.id || !payload.client_secret) {
    throw new Error(payload.error?.message ?? "Stripe payment intent creation failed");
  }

  return {
    id: payload.id,
    clientSecret: payload.client_secret,
  };
}

export const corsPreflight = httpAction(async () => {
  return optionsResponse();
});

export const campaignSnapshot = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug") ?? DEFAULT_CAMPAIGN_SLUG;

  const snapshot = await ctx.runQuery(internal.liveData.getCampaignSnapshot, { slug });
  if (!snapshot) {
    return jsonResponse(404, { error: `Campaign not found: ${slug}` });
  }

  return jsonResponse(200, snapshot);
});

export const donorDonations = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const receiptToken = url.searchParams.get("receiptToken");

  if (!receiptToken) {
    return jsonResponse(400, { error: "Missing receiptToken" });
  }

  const rows = await ctx.runQuery(internal.liveData.listDonationsByReceiptToken, {
    receiptToken,
  });

  return jsonResponse(200, { donations: rows });
});

export const donationIntent = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return optionsResponse();
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  let body: {
    campaignSlug?: string;
    amountUsd?: number;
    paymentRailCode?: string;
    donorName?: string;
    donorEmail?: string;
    donorWallet?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON payload" });
  }

  const campaignSlug = body.campaignSlug ?? DEFAULT_CAMPAIGN_SLUG;
  const paymentRailCode = body.paymentRailCode;
  const amountUsdCents = Math.trunc((body.amountUsd ?? 0) * 100);

  if (!paymentRailCode) {
    return jsonResponse(400, { error: "Missing paymentRailCode" });
  }

  if (!Number.isFinite(amountUsdCents) || amountUsdCents < 100) {
    return jsonResponse(400, { error: "Minimum donation is $1.00" });
  }

  const donorName = body.donorName?.trim();
  const donorEmail = body.donorEmail?.trim();
  const donorWallet = body.donorWallet?.trim();
  const isAnonymous = !donorName;

  try {
    if (paymentRailCode === "stripe_card") {
      const stripeIntent = await createStripePaymentIntent({
        amountUsdCents,
        campaignSlug,
        paymentRailCode,
        donorEmail,
        donorName,
      });

      const result = await ctx.runMutation(internal.liveData.createDonationIntentRecord, {
        campaignSlug,
        amountUsdCents,
        paymentRailCode,
        donorDisplayName: donorName,
        isAnonymous,
        donorEmail,
        donorWallet,
        stripePaymentIntentId: stripeIntent.id,
        metadata: {
          origin: "web_ui",
        },
      });

      return jsonResponse(200, {
        donationId: result.donationId,
        receiptToken: result.publicReceiptToken,
        paymentRailCode,
        amountUsdCents,
        stripe: {
          paymentIntentId: stripeIntent.id,
          clientSecret: stripeIntent.clientSecret,
          publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
        },
      });
    }

    const cryptoDestination = resolveCryptoDestination(paymentRailCode);
    const result = await ctx.runMutation(internal.liveData.createDonationIntentRecord, {
      campaignSlug,
      amountUsdCents,
      paymentRailCode,
      donorDisplayName: donorName,
      isAnonymous,
      donorEmail,
      donorWallet,
      toAddress: cryptoDestination.address,
      metadata: {
        origin: "web_ui",
        destinationChain: cryptoDestination.chain,
        destinationAddress: cryptoDestination.address,
      },
    });

    return jsonResponse(200, {
      donationId: result.donationId,
      receiptToken: result.publicReceiptToken,
      paymentRailCode,
      amountUsdCents,
      crypto: {
        chain: cryptoDestination.chain,
        toAddress: cryptoDestination.address,
      },
      nextStep: "Send on-chain to the provided destination address, then we confirm by tx hash.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Donation intent failed";
    return jsonResponse(400, { error: message });
  }
});

export const rssFeed = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug") ?? DEFAULT_CAMPAIGN_SLUG;

  const snapshot = await ctx.runQuery(internal.liveData.getCampaignSnapshot, { slug });
  if (!snapshot) {
    return new Response("Campaign not found", { status: 404 });
  }

  const siteBase = process.env.CONVEX_HTTP_ACTIONS_URL ?? "https://cheery-camel-510.convex.site";
  const itemsXml = snapshot.updates
    .slice(0, 50)
    .map(
      (update) => `<item>
<title>${xmlEscape(update.title)}</title>
<description>${xmlEscape(update.summary)}</description>
<pubDate>${new Date(update.publishedAt).toUTCString()}</pubDate>
<guid>${xmlEscape(`${slug}:${update.publishedAt}:${update.type}`)}</guid>
<link>${xmlEscape(update.link ?? `${siteBase}/api/campaign?slug=${slug}`)}</link>
</item>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>${xmlEscape(snapshot.campaign.title)}</title>
<link>${xmlEscape(`${siteBase}/api/campaign?slug=${slug}`)}</link>
<description>${xmlEscape(snapshot.campaign.summary ?? "Campaign updates")}</description>
${itemsXml}
</channel>
</rss>`;

  return new Response(xml, {
    status: 200,
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "access-control-allow-origin": "*",
    },
  });
});
