import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";

const REFUND_WINDOW_DAYS = 14;

function normalizeOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function normalizeEmail(value: string | undefined): string | undefined {
  const normalized = normalizeOptional(value);
  return normalized ? normalized.toLowerCase() : undefined;
}

function normalizeWallet(value: string | undefined): string | undefined {
  const normalized = normalizeOptional(value);
  return normalized ? normalized.toLowerCase() : undefined;
}

function toReceiptToken(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

export const getCampaignSnapshot = internalQuery({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const campaign = await ctx.db
      .query("campaigns")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (!campaign) {
      return null;
    }

    const [milestones, paymentRails, updates, donations] = await Promise.all([
      ctx.db
        .query("fundingMilestones")
        .withIndex("by_campaign_and_step", (q) => q.eq("campaignId", campaign._id))
        .collect(),
      ctx.db.query("paymentRails").collect(),
      ctx.db
        .query("campaignUpdates")
        .withIndex("by_campaign_and_visibility_and_published_at", (q) =>
          q.eq("campaignId", campaign._id).eq("visibility", "public"),
        )
        .order("desc")
        .take(50),
      ctx.db
        .query("donations")
        .withIndex("by_campaign_and_created_at", (q) => q.eq("campaignId", campaign._id))
        .order("desc")
        .take(50),
    ]);

    const donorIdSet = new Set<Id<"donors">>();
    for (const donation of donations) {
      if (donation.donorId) donorIdSet.add(donation.donorId);
    }

    const donorMap = new Map<Id<"donors">, string | undefined>();
    for (const donorId of donorIdSet) {
      const donor = await ctx.db.get(donorId);
      donorMap.set(donorId, donor?.displayName);
    }

    return {
      campaign: {
        id: campaign._id,
        slug: campaign.slug,
        title: campaign.title,
        summary: campaign.summary,
        status: campaign.status,
        fundingGoalUsdCents: campaign.fundingGoalUsdCents,
        fundedUsdCents: campaign.fundedUsdCents,
      },
      milestones: milestones.map((milestone) => ({
        stepNumber: milestone.stepNumber,
        title: milestone.title,
        targetUsdCents: milestone.targetUsdCents,
        reachedAt: milestone.reachedAt,
      })),
      paymentRails: paymentRails
        .filter((rail) => rail.isActive)
        .map((rail) => ({
          code: rail.code,
          kind: rail.kind,
          displayName: rail.displayName,
          assetSymbol: rail.assetSymbol,
          chain: rail.chain,
          supportsRefunds: rail.supportsRefunds,
        })),
      updates: updates.map((update) => ({
        type: update.type,
        title: update.title,
        summary: update.summary,
        link: update.link,
        publishedAt: update.publishedAt,
      })),
      donations: donations
        .filter((d) => d.status === "confirmed")
        .map((donation) => ({
          id: donation._id,
          donor: donation.isAnonymous
            ? "Anonymous"
            : donation.donorDisplayName ?? (donation.donorId ? donorMap.get(donation.donorId) : undefined) ?? "Anonymous",
          paymentRailCode: donation.paymentRailCode,
          grossUsdCents: donation.grossUsdCents,
          status: donation.status,
          createdAt: donation.createdAt,
        })),
    };
  },
});

export const listDonationsByReceiptToken = internalQuery({
  args: {
    receiptToken: v.string(),
  },
  handler: async (ctx, args) => {
    const donation = await ctx.db
      .query("donations")
      .withIndex("by_receipt_token", (q) => q.eq("publicReceiptToken", args.receiptToken))
      .unique();

    if (!donation) return [];

    const campaign = await ctx.db.get(donation.campaignId);

    return [
      {
        donationId: donation._id,
        campaignSlug: campaign?.slug ?? null,
        paymentRailCode: donation.paymentRailCode,
        grossUsdCents: donation.grossUsdCents,
        netUsdCents: donation.netUsdCents,
        status: donation.status,
        createdAt: donation.createdAt,
        refundedAt: donation.refundedAt,
      },
    ];
  },
});

export const createDonationIntentRecord = internalMutation({
  args: {
    campaignSlug: v.string(),
    amountUsdCents: v.number(),
    paymentRailCode: v.string(),
    donorDisplayName: v.optional(v.string()),
    isAnonymous: v.optional(v.boolean()),
    donorEmail: v.optional(v.string()),
    donorWallet: v.optional(v.string()),
    toAddress: v.optional(v.string()),
    stripePaymentIntentId: v.optional(v.string()),
    stripeChargeId: v.optional(v.string()),
    metadata: v.optional(v.record(v.string(), v.string())),
  },
  handler: async (ctx, args) => {
    const campaign = await ctx.db
      .query("campaigns")
      .withIndex("by_slug", (q) => q.eq("slug", args.campaignSlug))
      .unique();

    if (!campaign) {
      throw new Error(`Campaign not found: ${args.campaignSlug}`);
    }

    const rail = await ctx.db
      .query("paymentRails")
      .withIndex("by_code", (q) => q.eq("code", args.paymentRailCode as never))
      .unique();

    if (!rail || !rail.isActive) {
      throw new Error(`Payment rail unavailable: ${args.paymentRailCode}`);
    }

    const amountUsdCents = Math.trunc(args.amountUsdCents);
    if (!Number.isFinite(amountUsdCents) || amountUsdCents < 100) {
      throw new Error("Donation must be at least $1.00");
    }

    const now = Date.now();
    const donorDisplayName = normalizeOptional(args.donorDisplayName);
    const donorEmail = normalizeOptional(args.donorEmail);
    const donorEmailLower = normalizeEmail(args.donorEmail);
    const donorWallet = normalizeOptional(args.donorWallet);
    const donorWalletLower = normalizeWallet(args.donorWallet);
    const isAnonymous = args.isAnonymous ?? true;

    let donorId: Id<"donors"> | undefined;

    if (donorEmailLower) {
      const existingByEmail = await ctx.db
        .query("donors")
        .withIndex("by_email", (q) => q.eq("emailLower", donorEmailLower))
        .unique();
      if (existingByEmail) donorId = existingByEmail._id;
    }

    if (!donorId && donorWalletLower) {
      const existingByWallet = await ctx.db
        .query("donors")
        .withIndex("by_wallet", (q) => q.eq("walletAddressLower", donorWalletLower))
        .unique();
      if (existingByWallet) donorId = existingByWallet._id;
    }

    if (donorId) {
      await ctx.db.patch(donorId, {
        email: donorEmail,
        emailLower: donorEmailLower,
        walletAddress: donorWallet,
        walletAddressLower: donorWalletLower,
        displayName: donorDisplayName,
        updatedAt: now,
      });
    } else if (!isAnonymous || donorEmail || donorWallet || donorDisplayName) {
      donorId = await ctx.db.insert("donors", {
        email: donorEmail,
        emailLower: donorEmailLower,
        walletAddress: donorWallet,
        walletAddressLower: donorWalletLower,
        displayName: donorDisplayName,
        createdAt: now,
        updatedAt: now,
      });
    }

    const publicReceiptToken = toReceiptToken();
    const refundableUntil = rail.code === "stripe_card" ? now + REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000 : undefined;

    const donationId = await ctx.db.insert("donations", {
      campaignId: campaign._id,
      donorId,
      paymentRailCode: rail.code,
      paymentKind: rail.kind,
      donorDisplayName,
      isAnonymous,
      status: "initiated",
      amountOriginalMinor: amountUsdCents,
      currencyOriginal: "USD",
      usdFxRate: 1,
      grossUsdCents: amountUsdCents,
      netUsdCents: amountUsdCents,
      stripePaymentIntentId: args.stripePaymentIntentId,
      stripeChargeId: args.stripeChargeId,
      chain: rail.chain,
      fromAddress: donorWallet,
      toAddress: normalizeOptional(args.toAddress),
      publicReceiptToken,
      metadata: args.metadata,
      refundableUntil,
      createdAt: now,
      updatedAt: now,
    });

    return {
      donationId,
      publicReceiptToken,
      paymentRailKind: rail.kind,
      paymentRailChain: rail.chain,
      stripePaymentIntentId: args.stripePaymentIntentId,
    };
  },
});

export const applyStripeEventToDonation = internalMutation({
  args: {
    eventType: v.string(),
    stripePaymentIntentId: v.optional(v.string()),
    stripeChargeId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.eventType !== "payment_intent.succeeded" || !args.stripePaymentIntentId) {
      return { applied: false, reason: "event_not_supported" as const };
    }

    const donation = await ctx.db
      .query("donations")
      .withIndex("by_stripe_payment_intent", (q) => q.eq("stripePaymentIntentId", args.stripePaymentIntentId))
      .unique();

    if (!donation) {
      return { applied: false, reason: "donation_not_found" as const };
    }

    if (donation.status === "confirmed") {
      return { applied: false, reason: "already_confirmed" as const };
    }

    const now = Date.now();

    await ctx.db.patch(donation._id, {
      status: "confirmed",
      stripeChargeId: args.stripeChargeId ?? donation.stripeChargeId,
      confirmedAt: now,
      updatedAt: now,
    });

    const campaign = await ctx.db.get(donation.campaignId);
    if (!campaign) {
      return { applied: true, reason: "campaign_missing" as const };
    }

    const newFundedUsdCents = campaign.fundedUsdCents + donation.netUsdCents;
    await ctx.db.patch(campaign._id, {
      fundedUsdCents: newFundedUsdCents,
      status: newFundedUsdCents >= campaign.fundingGoalUsdCents ? "funded" : campaign.status,
      updatedAt: now,
    });

    const milestones = await ctx.db
      .query("fundingMilestones")
      .withIndex("by_campaign_and_step", (q) => q.eq("campaignId", campaign._id))
      .collect();

    for (const milestone of milestones) {
      if (!milestone.reachedAt && newFundedUsdCents >= milestone.targetUsdCents) {
        await ctx.db.patch(milestone._id, {
          reachedAt: now,
          updatedAt: now,
        });

        await ctx.db.insert("campaignUpdates", {
          campaignId: campaign._id,
          type: "milestone_reached",
          title: `Milestone reached: ${milestone.title}`,
          summary: `Funding crossed ${(milestone.targetUsdCents / 100).toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
          })}.`,
          visibility: "public",
          publishedAt: now,
          createdAt: now,
        });
      }
    }

    await ctx.db.insert("campaignUpdates", {
      campaignId: campaign._id,
      type: "donation_confirmed",
      title: "Donation confirmed",
      summary: `${(donation.grossUsdCents / 100).toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
      })} confirmed via ${donation.paymentRailCode}.`,
      visibility: "public",
      relatedDonationId: donation._id,
      publishedAt: now,
      createdAt: now,
    });

    return {
      applied: true,
      donationId: donation._id,
    };
  },
});
