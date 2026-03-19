import type {
  CAMPAIGN_STATUSES,
  DONATION_STATUSES,
  PAYMENT_RAIL_CODES,
  REFUND_BATCH_STATUSES,
  REFUND_ITEM_STATUSES,
  REFUND_POLICY_MODES,
} from "./configs";

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
export type DonationStatus = (typeof DONATION_STATUSES)[number];
export type PaymentRailCode = (typeof PAYMENT_RAIL_CODES)[number];
export type RefundBatchStatus = (typeof REFUND_BATCH_STATUSES)[number];
export type RefundItemStatus = (typeof REFUND_ITEM_STATUSES)[number];
export type RefundPolicyMode = (typeof REFUND_POLICY_MODES)[number];

export type PaymentKind = "card" | "crypto";

export type UpdateEventType =
  | "campaign_created"
  | "donation_confirmed"
  | "milestone_reached"
  | "publishing_github"
  | "publishing_huggingface"
  | "refund_batch_started"
  | "refund_batch_completed"
  | "operator_note";

export type Visibility = "public" | "private";

export interface RefundCalculationInput {
  grossRefundUsdCents: number;
  mode: RefundPolicyMode;
  stripePercentBps: number;
  stripeFixedFeeUsdCents: number;
}

export interface RefundCalculationResult {
  grossRefundUsdCents: number;
  stripeFeeUsdCents: number;
  netRefundUsdCents: number;
}

export interface MeterProgress {
  fundedUsdCents: number;
  nextMilestoneUsdCents: number | null;
  lastReachedMilestoneStep: number | null;
}
