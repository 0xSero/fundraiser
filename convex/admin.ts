import { v } from "convex/values";

import { internalMutation, mutation } from "./_generated/server";

const CAMPAIGN_SLUG = "compute-cluster-fund";

export const resetCampaignData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const campaign = await ctx.db
      .query("campaigns")
      .withIndex("by_slug", (q) => q.eq("slug", CAMPAIGN_SLUG))
      .unique();

    if (!campaign) return { deleted: 0 };

    // Delete all donations
    const donations = await ctx.db
      .query("donations")
      .withIndex("by_campaign_and_created_at", (q) => q.eq("campaignId", campaign._id))
      .collect();
    for (const d of donations) await ctx.db.delete(d._id);

    // Delete all campaign updates
    const updates = await ctx.db
      .query("campaignUpdates")
      .withIndex("by_campaign_and_published_at", (q) => q.eq("campaignId", campaign._id))
      .collect();
    for (const u of updates) await ctx.db.delete(u._id);

    // Delete all ledger entries
    const ledger = await ctx.db
      .query("ledgerEntries")
      .withIndex("by_campaign_and_happened_at", (q) => q.eq("campaignId", campaign._id))
      .collect();
    for (const l of ledger) await ctx.db.delete(l._id);

    // Delete all donors
    const donors = await ctx.db.query("donors").collect();
    for (const d of donors) await ctx.db.delete(d._id);

    // Reset funded amount
    await ctx.db.patch(campaign._id, { fundedUsdCents: 0, updatedAt: Date.now() });

    return { deleted: donations.length + updates.length + ledger.length + donors.length };
  },
});

const MILESTONES = [
  { stepNumber: 1, title: "1 RTX Pro", targetUsdCents: 1_000_000, rewardType: "gpu_bundle", rewardSku: "RTX_PRO", rewardQuantity: 1 },
  { stepNumber: 2, title: "4 RTX Pro", targetUsdCents: 5_000_000, rewardType: "gpu_bundle", rewardSku: "RTX_PRO", rewardQuantity: 4 },
  {
    stepNumber: 3,
    title: "Dell Pro Max with GB3000",
    targetUsdCents: 10_000_000,
    rewardType: "server_system",
    rewardSku: "DELL_PRO_MAX_GB3000",
    rewardQuantity: 1,
  },
] as const;

const PAYMENT_RAILS = [
  { code: "stripe_card", kind: "card", displayName: "Card (Stripe)", assetSymbol: "USD", chain: undefined, supportsRefunds: true },
  { code: "base_eth", kind: "crypto", displayName: "Base ETH", assetSymbol: "ETH", chain: "base", supportsRefunds: false },
  { code: "base_usdc", kind: "crypto", displayName: "Base USDC", assetSymbol: "USDC", chain: "base", supportsRefunds: false },
  { code: "polygon_eth", kind: "crypto", displayName: "Polygon ETH", assetSymbol: "ETH", chain: "polygon", supportsRefunds: false },
  { code: "polygon_usdc", kind: "crypto", displayName: "Polygon USDC", assetSymbol: "USDC", chain: "polygon", supportsRefunds: false },
  { code: "optimism_eth", kind: "crypto", displayName: "Optimism ETH", assetSymbol: "ETH", chain: "optimism", supportsRefunds: false },
  { code: "optimism_usdc", kind: "crypto", displayName: "Optimism USDC", assetSymbol: "USDC", chain: "optimism", supportsRefunds: false },
  { code: "ethereum_eth", kind: "crypto", displayName: "Ethereum ETH", assetSymbol: "ETH", chain: "ethereum", supportsRefunds: false },
  { code: "ethereum_usdc", kind: "crypto", displayName: "Ethereum USDC", assetSymbol: "USDC", chain: "ethereum", supportsRefunds: false },
  { code: "solana_sol", kind: "crypto", displayName: "Solana SOL", assetSymbol: "SOL", chain: "solana", supportsRefunds: false },
  { code: "solana_usdc", kind: "crypto", displayName: "Solana USDC", assetSymbol: "USDC", chain: "solana", supportsRefunds: false },
  { code: "monero_xmr", kind: "crypto", displayName: "Monero XMR", assetSymbol: "XMR", chain: "monero", supportsRefunds: false },
  { code: "bitcoin_btc", kind: "crypto", displayName: "Bitcoin BTC", assetSymbol: "BTC", chain: "bitcoin", supportsRefunds: false },
] as const;

export const bootstrapCampaign = mutation({
  args: {
    adminToken: v.string(),
  },
  handler: async (ctx, args) => {
    const expected = process.env.ADMIN_BOOTSTRAP_TOKEN;
    if (!expected || args.adminToken !== expected) {
      throw new Error("Unauthorized bootstrap token");
    }

    const now = Date.now();

    let campaign = await ctx.db
      .query("campaigns")
      .withIndex("by_slug", (q) => q.eq("slug", CAMPAIGN_SLUG))
      .unique();

    if (!campaign) {
      const campaignId = await ctx.db.insert("campaigns", {
        slug: CAMPAIGN_SLUG,
        title: "Compute Cluster Fund",
        summary: "Funding local AI R and D infrastructure with public updates.",
        status: "live",
        currency: "USD",
        fundingGoalUsdCents: 10_000_000,
        fundedUsdCents: 0,
        launchedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      campaign = await ctx.db.get(campaignId);
    }

    if (!campaign) {
      throw new Error("Unable to create campaign");
    }

    for (const milestone of MILESTONES) {
      const existing = await ctx.db
        .query("fundingMilestones")
        .withIndex("by_campaign_and_step", (q) => q.eq("campaignId", campaign._id).eq("stepNumber", milestone.stepNumber))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          title: milestone.title,
          targetUsdCents: milestone.targetUsdCents,
          rewardType: milestone.rewardType,
          rewardSku: milestone.rewardSku,
          rewardQuantity: milestone.rewardQuantity,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("fundingMilestones", {
          campaignId: campaign._id,
          stepNumber: milestone.stepNumber,
          title: milestone.title,
          targetUsdCents: milestone.targetUsdCents,
          rewardType: milestone.rewardType,
          rewardSku: milestone.rewardSku,
          rewardQuantity: milestone.rewardQuantity,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    for (const rail of PAYMENT_RAILS) {
      const existing = await ctx.db
        .query("paymentRails")
        .withIndex("by_code", (q) => q.eq("code", rail.code))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          kind: rail.kind,
          displayName: rail.displayName,
          assetSymbol: rail.assetSymbol,
          chain: rail.chain,
          isActive: true,
          supportsRefunds: rail.supportsRefunds,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("paymentRails", {
          code: rail.code,
          kind: rail.kind,
          displayName: rail.displayName,
          assetSymbol: rail.assetSymbol,
          chain: rail.chain,
          isActive: true,
          supportsRefunds: rail.supportsRefunds,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    const existingRefundPolicy = await ctx.db
      .query("refundPolicies")
      .withIndex("by_campaign_and_effective_from", (q) => q.eq("campaignId", campaign._id))
      .order("desc")
      .first();

    if (!existingRefundPolicy) {
      await ctx.db.insert("refundPolicies", {
        campaignId: campaign._id,
        mode: "stripe_net_of_fees",
        stripePercentBps: 290,
        stripeFixedFeeUsdCents: 30,
        refundWindowDays: 14,
        requestChannel: "email",
        requestEmail: "sherifcherfa@gmail.com",
        refundableRailCode: "stripe_card",
        effectiveFrom: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    const existingPublicUpdate = await ctx.db
      .query("campaignUpdates")
      .withIndex("by_campaign_and_visibility_and_published_at", (q) =>
        q.eq("campaignId", campaign._id).eq("visibility", "public"),
      )
      .first();

    if (!existingPublicUpdate) {
      await ctx.db.insert("campaignUpdates", {
        campaignId: campaign._id,
        type: "campaign_created",
        title: "Campaign is live",
        summary: "Live donations enabled with Stripe and crypto rails.",
        visibility: "public",
        publishedAt: now,
        createdAt: now,
      });
    }

    return {
      campaignId: campaign._id,
      slug: campaign.slug,
      bootstrappedAt: now,
    };
  },
});
