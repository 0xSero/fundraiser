export const DONOR_INTERACTION_FLOW = [
  "Donor chooses campaign and amount",
  "Donor selects payment rail: Stripe card, EVM (Base/Polygon/Optimism/Ethereum with ETH or USDC), or Solana (SOL or USDC)",
  "Donor can provide optional display name, otherwise donation is anonymous by default",
  "System creates donation intent and returns provider-specific checkout instructions",
  "Webhook or on-chain confirmation marks donation confirmed",
  "Ledger entry and campaign meter update are written transactionally",
  "Campaign update event is emitted for RSS/public timeline, plus GitHub and Hugging Face publish events",
  "Donor can view donation history via account or receipt token",
] as const;

export const REFUND_ALL_FLOW = [
  "Donor reaches out to sherifcherfa@gmail.com for a refund request",
  "Operator creates refund batch for the campaign and only includes stripe_card donations",
  "System verifies refund request is within 14 days from donation timestamp",
  "System snapshots Stripe net-of-fees policy for auditability",
  "System materializes refund items for eligible Stripe donations",
  "Provider refunds are executed and tracked per refund item",
  "Ledger debits and campaign updates are emitted, including Stripe fee retention amount",
  "Batch status resolves to completed or failed",
] as const;
