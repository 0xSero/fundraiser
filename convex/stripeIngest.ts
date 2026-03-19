import { v } from "convex/values";

import { internalMutation } from "./_generated/server";

export const recordStripeWebhookEvent = internalMutation({
  args: {
    eventId: v.string(),
    eventType: v.string(),
    livemode: v.boolean(),
    payloadJson: v.string(),
    stripePaymentIntentId: v.optional(v.string()),
    stripeChargeId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const existing = await ctx.db
      .query("stripeWebhookEvents")
      .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
      .unique();

    if (existing) {
      return { duplicate: true, eventDocId: existing._id };
    }

    const eventDocId = await ctx.db.insert("stripeWebhookEvents", {
      eventId: args.eventId,
      eventType: args.eventType,
      livemode: args.livemode,
      payloadJson: args.payloadJson,
      processingStatus: "processed",
      stripePaymentIntentId: args.stripePaymentIntentId,
      stripeChargeId: args.stripeChargeId,
      receivedAt: now,
      processedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return { duplicate: false, eventDocId };
  },
});
