import type { RefundCalculationResult, RefundPolicyMode } from "../types";

export function calculateRefundBreakdown(params: {
  grossRefundUsdCents: number;
  mode: RefundPolicyMode;
  stripePercentBps: number;
  stripeFixedFeeUsdCents: number;
}): RefundCalculationResult {
  const gross = Math.max(0, Math.trunc(params.grossRefundUsdCents));
  if (params.mode !== "stripe_net_of_fees") {
    throw new Error(`Unsupported refund mode: ${params.mode as string}`);
  }

  const basisPointsFee = Math.trunc((gross * Math.max(0, params.stripePercentBps)) / 10_000);
  const fixedFee = Math.max(0, Math.trunc(params.stripeFixedFeeUsdCents));
  const stripeFee = Math.min(basisPointsFee + fixedFee, gross);

  return {
    grossRefundUsdCents: gross,
    stripeFeeUsdCents: stripeFee,
    netRefundUsdCents: gross - stripeFee,
  };
}

export function isRefundRequestWithinWindow(params: {
  donationCreatedAt: number;
  requestReceivedAt: number;
  refundWindowDays: number;
}): boolean {
  const windowMs = Math.max(0, Math.trunc(params.refundWindowDays)) * 24 * 60 * 60 * 1000;
  return params.requestReceivedAt <= params.donationCreatedAt + windowMs;
}
