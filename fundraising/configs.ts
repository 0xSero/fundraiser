export const CAMPAIGN_DEFAULTS = {
  slug: "compute-cluster-fund",
  currency: "USD",
  fundingGoalUsdCents: 10_000_000,
} as const;

export const FUNDING_MILESTONES = [
  {
    stepNumber: 1,
    title: "1 RTX Pro",
    targetUsdCents: 1_000_000,
    rewardType: "gpu_bundle",
    rewardSku: "RTX_PRO",
    rewardQuantity: 1,
  },
  {
    stepNumber: 2,
    title: "4 RTX Pro",
    targetUsdCents: 5_000_000,
    rewardType: "gpu_bundle",
    rewardSku: "RTX_PRO",
    rewardQuantity: 4,
  },
  {
    stepNumber: 3,
    title: "Dell Pro Max with GB3000",
    targetUsdCents: 10_000_000,
    rewardType: "server_system",
    rewardSku: "DELL_PRO_MAX_GB3000",
    rewardQuantity: 1,
  },
] as const;

export const PAYMENT_RAIL_CODES = [
  "stripe_card",
  "base_eth",
  "base_usdc",
  "polygon_eth",
  "polygon_usdc",
  "optimism_eth",
  "optimism_usdc",
  "ethereum_eth",
  "ethereum_usdc",
  "solana_sol",
  "solana_usdc",
] as const;

export const CAMPAIGN_STATUSES = [
  "draft",
  "live",
  "funded",
  "refund_planned",
  "refund_in_progress",
  "refunded",
  "cancelled",
] as const;

export const DONATION_STATUSES = [
  "initiated",
  "pending_confirmation",
  "confirmed",
  "failed",
  "refunding",
  "partially_refunded",
  "refunded",
] as const;

export const REFUND_BATCH_STATUSES = [
  "planned",
  "queued",
  "processing",
  "completed",
  "failed",
  "cancelled",
] as const;

export const REFUND_ITEM_STATUSES = [
  "queued",
  "processing",
  "succeeded",
  "failed",
  "skipped",
] as const;

export const REFUND_POLICY_MODES = [
  "stripe_net_of_fees",
] as const;

export const REFUND_RULES = {
  refundWindowDays: 14,
  requestEmail: "sherifcherfa@gmail.com",
  refundableRailCode: "stripe_card",
} as const;
