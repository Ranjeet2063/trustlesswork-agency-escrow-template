/**
 * Fee model and calculation utilities for Trustless Work agency escrows.
 *
 * Reconciles both:
 * 1. Platform/integrator fee: Configured by this agency escrow template (default: 30 bps).
 * 2. Trustless Work protocol fee: Deducted by the Trustless Work smart contract on release.
 *
 * PROVENANCE & OPERATIONAL SPECIFICATION:
 * The 30 bps (0.30%) Trustless Work protocol release fee is an EMPIRICALLY OBSERVED
 * TESTNET ASSUMPTION sourced from two-wallet integration tests (PR #37 / Issue #20:
 * 100 USDC -> 99.4 USDC net, 50 USDC -> 49.7 USDC net).
 *
 * It is NOT an implementation-owned constant or guaranteed protocol invariant in the
 * template sources. Until dynamic on-chain querying of Trustless Work runtime configuration
 * is available, every surface presenting payee net amounts derived from this rate MUST
 * present the result as an ESTIMATE (`isEstimate: true`) and state its empirical provenance.
 */

/** Default platform fee in basis points (0.30% = 30 bps). Configurable by template. */
export const DEFAULT_PLATFORM_FEE_BPS = 30;

/**
 * Observed testnet Trustless Work protocol release fee in basis points (0.30% = 30 bps).
 *
 * NOTICE: This is an empirical testnet observation from issue #20 / PR #37 integration tests,
 * NOT a canonical implementation-owned constant. It must not be treated as globally canonical.
 */
export const OBSERVED_TESTNET_PROTOCOL_FEE_BPS = 30;

/**
 * @deprecated Use `OBSERVED_TESTNET_PROTOCOL_FEE_BPS` to explicitly indicate that this
 * is an empirical testnet assumption rather than a canonical protocol constant.
 */
export const DEFAULT_TW_PROTOCOL_FEE_BPS = OBSERVED_TESTNET_PROTOCOL_FEE_BPS;

export type FeeBreakdown = {
  /** Gross funded escrow amount locked in the contract */
  grossAmount: number;
  /** Platform/template fee in basis points */
  platformFeeBps: number;
  /** Platform fee amount routed to template platform address */
  platformFeeAmount: number;
  /** Protocol fee in basis points */
  protocolFeeBps: number;
  /** Trustless Work protocol release fee amount */
  protocolFeeAmount: number;
  /** Combined platform + protocol fees deducted at release */
  totalFeeAmount: number;
  /** Expected net amount received by the payee (estimated when protocol deductions apply) */
  netAmount: number;
  /** Whether the net amount includes estimated protocol-level deductions */
  isEstimate: boolean;
  /** Provenance description for user interfaces displaying estimated net payouts */
  estimateNotice?: string;
};

/**
 * Calculate the complete fee breakdown distinguishing platform and protocol fees.
 *
 * @param grossAmount Total escrow amount to be funded
 * @param platformFeeBps Platform fee rate in basis points (defaults to 30 bps = 0.30%)
 * @param protocolFeeBps Protocol fee rate in basis points (defaults to OBSERVED_TESTNET_PROTOCOL_FEE_BPS = 30 bps)
 */
export function calculateFeeBreakdown(
  grossAmount: number,
  platformFeeBps: number = DEFAULT_PLATFORM_FEE_BPS,
  protocolFeeBps: number = OBSERVED_TESTNET_PROTOCOL_FEE_BPS,
): FeeBreakdown {
  if (!Number.isFinite(grossAmount) || grossAmount < 0) {
    throw new Error("Gross amount must be a non-negative finite number");
  }

  if (
    !Number.isInteger(platformFeeBps) ||
    platformFeeBps < 0 ||
    platformFeeBps > 10_000
  ) {
    throw new Error("Platform fee basis points must be between 0 and 10000");
  }

  if (
    !Number.isInteger(protocolFeeBps) ||
    protocolFeeBps < 0 ||
    protocolFeeBps > 10_000
  ) {
    throw new Error("Protocol fee basis points must be between 0 and 10000");
  }

  // Calculate fees rounded to 7 decimals (Stellar token precision)
  const platformFeeAmount = Number(
    (grossAmount * (platformFeeBps / 10_000)).toFixed(7),
  );
  const protocolFeeAmount = Number(
    (grossAmount * (protocolFeeBps / 10_000)).toFixed(7),
  );
  const totalFeeAmount = Number(
    (platformFeeAmount + protocolFeeAmount).toFixed(7),
  );
  const netAmount = Number(
    Math.max(0, grossAmount - totalFeeAmount).toFixed(7),
  );

  return {
    grossAmount,
    platformFeeBps,
    platformFeeAmount,
    protocolFeeBps,
    protocolFeeAmount,
    totalFeeAmount,
    netAmount,
    isEstimate: true,
    estimateNotice:
      protocolFeeBps > 0
        ? "Payee net is an estimate based on observed testnet protocol release fees (issue #20 / PR #37)."
        : undefined,
  };
}
