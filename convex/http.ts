import { httpRouter } from "convex/server";

import {
  campaignSnapshot,
  confirmCryptoTx,
  corsPreflight,
  donationIntent,
  donorDonations,
  rssFeed,
} from "./publicHttp";
import { stripeWebhook } from "./stripeWebhook";

const http = httpRouter();

http.route({
  path: "/api/campaign",
  method: "GET",
  handler: campaignSnapshot,
});

http.route({
  path: "/api/donor-donations",
  method: "GET",
  handler: donorDonations,
});

http.route({
  path: "/api/donation-intent",
  method: "POST",
  handler: donationIntent,
});

http.route({
  path: "/api/donation-intent",
  method: "OPTIONS",
  handler: corsPreflight,
});

http.route({
  path: "/api/confirm-crypto-tx",
  method: "POST",
  handler: confirmCryptoTx,
});

http.route({
  path: "/api/confirm-crypto-tx",
  method: "OPTIONS",
  handler: corsPreflight,
});

http.route({
  path: "/rss.xml",
  method: "GET",
  handler: rssFeed,
});

http.route({
  path: "/stripe-webhook",
  method: "POST",
  handler: stripeWebhook,
});

export default http;
