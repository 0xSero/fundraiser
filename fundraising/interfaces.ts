import type {
  MeterProgress,
  PaymentRailCode,
  RefundBatchStatus,
  RefundCalculationResult,
  RefundPolicyMode,
  UpdateEventType,
} from "./types";

export interface DonationIntentInput {
  campaignSlug: string;
  donorRef: {
    email?: string;
    walletAddress?: string;
    displayName?: string;
    isAnonymous?: boolean;
  };
  paymentRailCode: PaymentRailCode;
  amountMinor: number;
  currency: string;
}

export interface DonationReadModel {
  donationId: string;
  campaignId: string;
  paymentRailCode: PaymentRailCode;
  donorDisplayName?: string;
  isAnonymous: boolean;
  grossUsdCents: number;
  netUsdCents: number;
  status: string;
  createdAt: number;
}

export interface DonorPortalService {
  listDonationsByDonor(donorId: string): Promise<DonationReadModel[]>;
  listDonationsByReceiptToken(publicReceiptToken: string): Promise<DonationReadModel[]>;
}

export interface RssFeedService {
  getCampaignFeed(campaignSlug: string, limit?: number): Promise<{
    title: string;
    items: Array<{
      type: UpdateEventType;
      title: string;
      summary: string;
      publishedAt: number;
      link?: string;
    }>;
  }>;
}

export interface RefundBatchPlan {
  campaignId: string;
  mode: RefundPolicyMode;
  stripePercentBps: number;
  stripeFixedFeeUsdCents: number;
  refundWindowDays: number;
  requestEmail: string;
  refundableRailCode: "stripe_card";
  reason: string;
}

export interface RefundService {
  createFullRefundBatch(input: RefundBatchPlan): Promise<{ batchId: string }>;
  estimateBatchTotals(batchId: string): Promise<{
    donationCount: number;
    grossRefundUsdCents: number;
    feeUsdCents: number;
    netRefundUsdCents: number;
  }>;
  getBatchStatus(batchId: string): Promise<RefundBatchStatus>;
}

export interface MeterService {
  getProgress(campaignId: string): Promise<MeterProgress>;
}

export interface RefundPolicyEngine {
  computeRefund(
    grossRefundUsdCents: number,
    mode: RefundPolicyMode,
    stripePercentBps: number,
    stripeFixedFeeUsdCents: number,
  ): RefundCalculationResult;
}
