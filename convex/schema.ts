import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  campaigns: defineTable({
    slug: v.string(),
    title: v.string(),
    summary: v.optional(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("live"),
      v.literal("funded"),
      v.literal("refund_planned"),
      v.literal("refund_in_progress"),
      v.literal("refunded"),
      v.literal("cancelled"),
    ),
    currency: v.literal("USD"),
    fundingGoalUsdCents: v.number(),
    fundedUsdCents: v.number(),
    launchedAt: v.optional(v.number()),
    closedAt: v.optional(v.number()),
    createdBy: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"]),

  fundingMilestones: defineTable({
    campaignId: v.id("campaigns"),
    stepNumber: v.number(),
    title: v.string(),
    targetUsdCents: v.number(),
    rewardType: v.union(v.literal("gpu_bundle"), v.literal("server_system")),
    rewardSku: v.string(),
    rewardQuantity: v.number(),
    reachedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_campaign_and_step", ["campaignId", "stepNumber"])
    .index("by_campaign_and_target", ["campaignId", "targetUsdCents"]),

  donors: defineTable({
    email: v.optional(v.string()),
    emailLower: v.optional(v.string()),
    walletAddress: v.optional(v.string()),
    walletAddressLower: v.optional(v.string()),
    displayName: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["emailLower"])
    .index("by_wallet", ["walletAddressLower"])
    .index("by_stripe_customer", ["stripeCustomerId"]),

  paymentRails: defineTable({
    code: v.union(
      v.literal("stripe_card"),
      v.literal("base_eth"),
      v.literal("base_usdc"),
      v.literal("polygon_eth"),
      v.literal("polygon_usdc"),
      v.literal("optimism_eth"),
      v.literal("optimism_usdc"),
      v.literal("ethereum_eth"),
      v.literal("ethereum_usdc"),
      v.literal("solana_sol"),
      v.literal("solana_usdc"),
    ),
    kind: v.union(v.literal("card"), v.literal("crypto")),
    displayName: v.string(),
    assetSymbol: v.string(),
    chain: v.optional(v.string()),
    isActive: v.boolean(),
    supportsRefunds: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_code", ["code"]),

  donations: defineTable({
    campaignId: v.id("campaigns"),
    donorId: v.optional(v.id("donors")),
    paymentRailCode: v.string(),
    paymentKind: v.union(v.literal("card"), v.literal("crypto")),
    donorDisplayName: v.optional(v.string()),
    isAnonymous: v.boolean(),
    status: v.union(
      v.literal("initiated"),
      v.literal("pending_confirmation"),
      v.literal("confirmed"),
      v.literal("failed"),
      v.literal("refunding"),
      v.literal("partially_refunded"),
      v.literal("refunded"),
    ),
    amountOriginalMinor: v.number(),
    currencyOriginal: v.string(),
    usdFxRate: v.optional(v.number()),
    grossUsdCents: v.number(),
    processorFeeUsdCents: v.optional(v.number()),
    networkFeeUsdCents: v.optional(v.number()),
    netUsdCents: v.number(),
    stripePaymentIntentId: v.optional(v.string()),
    stripeChargeId: v.optional(v.string()),
    stripeRefundId: v.optional(v.string()),
    chain: v.optional(v.string()),
    txHash: v.optional(v.string()),
    fromAddress: v.optional(v.string()),
    toAddress: v.optional(v.string()),
    publicReceiptToken: v.string(),
    metadata: v.optional(v.record(v.string(), v.string())),
    confirmedAt: v.optional(v.number()),
    refundableUntil: v.optional(v.number()),
    failedAt: v.optional(v.number()),
    refundedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_campaign_and_status", ["campaignId", "status"])
    .index("by_campaign_and_created_at", ["campaignId", "createdAt"])
    .index("by_donor_and_created_at", ["donorId", "createdAt"])
    .index("by_receipt_token", ["publicReceiptToken"])
    .index("by_stripe_payment_intent", ["stripePaymentIntentId"])
    .index("by_tx_hash", ["txHash"]),

  stripeWebhookEvents: defineTable({
    eventId: v.string(),
    eventType: v.string(),
    livemode: v.boolean(),
    payloadJson: v.string(),
    processingStatus: v.union(
      v.literal("received"),
      v.literal("processed"),
      v.literal("ignored"),
      v.literal("failed"),
    ),
    stripePaymentIntentId: v.optional(v.string()),
    stripeChargeId: v.optional(v.string()),
    donationId: v.optional(v.id("donations")),
    errorMessage: v.optional(v.string()),
    receivedAt: v.number(),
    processedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_event_id", ["eventId"])
    .index("by_received_at", ["receivedAt"]),

  refundPolicies: defineTable({
    campaignId: v.id("campaigns"),
    mode: v.literal("stripe_net_of_fees"),
    stripePercentBps: v.number(),
    stripeFixedFeeUsdCents: v.number(),
    refundWindowDays: v.number(),
    requestChannel: v.literal("email"),
    requestEmail: v.string(),
    refundableRailCode: v.literal("stripe_card"),
    effectiveFrom: v.number(),
    createdBy: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_campaign_and_effective_from", ["campaignId", "effectiveFrom"]),

  refundBatches: defineTable({
    campaignId: v.id("campaigns"),
    policyMode: v.literal("stripe_net_of_fees"),
    policyStripePercentBps: v.number(),
    policyStripeFixedFeeUsdCents: v.number(),
    policyRefundWindowDays: v.number(),
    policyRequestEmail: v.string(),
    refundableRailCode: v.literal("stripe_card"),
    reason: v.string(),
    status: v.union(
      v.literal("planned"),
      v.literal("queued"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
    totalDonationCount: v.number(),
    estimatedGrossUsdCents: v.number(),
    estimatedFeeUsdCents: v.number(),
    estimatedNetUsdCents: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdBy: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_campaign_and_status", ["campaignId", "status"])
    .index("by_campaign_and_created_at", ["campaignId", "createdAt"]),

  refundItems: defineTable({
    batchId: v.id("refundBatches"),
    campaignId: v.id("campaigns"),
    donationId: v.id("donations"),
    donorId: v.optional(v.id("donors")),
    status: v.union(
      v.literal("queued"),
      v.literal("processing"),
      v.literal("succeeded"),
      v.literal("failed"),
      v.literal("skipped"),
    ),
    grossRefundUsdCents: v.number(),
    stripeFeeUsdCents: v.number(),
    netRefundUsdCents: v.number(),
    providerRefundReference: v.optional(v.string()),
    failureCode: v.optional(v.string()),
    failureMessage: v.optional(v.string()),
    processedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_batch_and_status", ["batchId", "status"])
    .index("by_donor_and_created_at", ["donorId", "createdAt"])
    .index("by_donation", ["donationId"]),

  campaignUpdates: defineTable({
    campaignId: v.id("campaigns"),
    type: v.union(
      v.literal("campaign_created"),
      v.literal("donation_confirmed"),
      v.literal("milestone_reached"),
      v.literal("publishing_github"),
      v.literal("publishing_huggingface"),
      v.literal("refund_batch_started"),
      v.literal("refund_batch_completed"),
      v.literal("operator_note"),
    ),
    title: v.string(),
    summary: v.string(),
    link: v.optional(v.string()),
    visibility: v.union(v.literal("public"), v.literal("private")),
    relatedDonationId: v.optional(v.id("donations")),
    relatedRefundBatchId: v.optional(v.id("refundBatches")),
    publishedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_campaign_and_visibility_and_published_at", ["campaignId", "visibility", "publishedAt"])
    .index("by_campaign_and_published_at", ["campaignId", "publishedAt"]),

  donorAccessSessions: defineTable({
    donorId: v.id("donors"),
    tokenHash: v.string(),
    expiresAt: v.number(),
    revokedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_donor_and_expires", ["donorId", "expiresAt"]),

  ledgerEntries: defineTable({
    campaignId: v.id("campaigns"),
    donationId: v.optional(v.id("donations")),
    refundItemId: v.optional(v.id("refundItems")),
    kind: v.union(
      v.literal("donation_credit"),
      v.literal("refund_debit"),
      v.literal("fee_debit"),
      v.literal("manual_adjustment"),
    ),
    amountUsdCents: v.number(),
    happenedAt: v.number(),
    note: v.optional(v.string()),
  })
    .index("by_campaign_and_happened_at", ["campaignId", "happenedAt"])
    .index("by_kind_and_happened_at", ["kind", "happenedAt"]),
});
