import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { FUNDING_MILESTONES, REFUND_RULES } from "../fundraising/configs";
import { calculateRefundBreakdown, isRefundRequestWithinWindow } from "../fundraising/helpers/refunds";

function deriveMeterProgress(fundedUsdCents: number) {
  const reached = FUNDING_MILESTONES.filter((step) => fundedUsdCents >= step.targetUsdCents);
  const next = FUNDING_MILESTONES.find((step) => fundedUsdCents < step.targetUsdCents) ?? null;

  return {
    fundedUsdCents,
    fundedUsd: fundedUsdCents / 100,
    lastReachedStep: reached.length ? reached[reached.length - 1].stepNumber : null,
    nextMilestoneStep: next?.stepNumber ?? null,
    nextMilestoneUsd: next ? next.targetUsdCents / 100 : null,
    completionPercent: Math.min(100, Math.round((fundedUsdCents / FUNDING_MILESTONES[FUNDING_MILESTONES.length - 1].targetUsdCents) * 10000) / 100),
  };
}

const sampleDonations = [
  { id: "d_1", netUsdCents: 250_000 },
  { id: "d_2", netUsdCents: 800_000 },
  { id: "d_3", netUsdCents: 4_200_000 },
  { id: "d_4", netUsdCents: 5_150_000 },
];

const fundedUsdCents = sampleDonations.reduce((sum, donation) => sum + donation.netUsdCents, 0);

const stripeNetOfFees = calculateRefundBreakdown({
  grossRefundUsdCents: 25_000,
  mode: "stripe_net_of_fees",
  stripePercentBps: 290,
  stripeFixedFeeUsdCents: 30,
});

const donationCreatedAt = Date.now() - 5 * 24 * 60 * 60 * 1000;
const requestReceivedAt = Date.now();

const out = {
  generatedAt: new Date().toISOString(),
  milestoneConfig: FUNDING_MILESTONES,
  sampleDonations,
  meterProgress: deriveMeterProgress(fundedUsdCents),
  refundExamples: {
    stripeNetOfFees,
  },
  refundRules: REFUND_RULES,
  refundWindowValidation: {
    donationCreatedAt,
    requestReceivedAt,
    eligibleWithinWindow: isRefundRequestWithinWindow({
      donationCreatedAt,
      requestReceivedAt,
      refundWindowDays: REFUND_RULES.refundWindowDays,
    }),
  },
};

const outputDir = resolve(process.cwd(), "test-output");
mkdirSync(outputDir, { recursive: true });

const outputPath = resolve(outputDir, "results.json");
writeFileSync(outputPath, JSON.stringify(out, null, 2));

console.log(`Wrote model validation artifact: ${outputPath}`);
console.log(`Meter completion: ${out.meterProgress.completionPercent}%`);
console.log(`Stripe net-of-fees refund net on $250 sample: $${(stripeNetOfFees.netRefundUsdCents / 100).toFixed(2)}`);
