import Big from 'big.js';

const PRECISION = BigInt('1000000000000000000'); // 1e18
const USDC_DECIMALS = 6;
const INTERNAL_DECIMALS = 18;

// ─── PnL ──────────────────────────────────────────────────────────────────────

/**
 * Calculate unrealized PnL.
 * All prices and size in 18-decimal units (bigint).
 * Returns signed bigint (18 decimals).
 */
export function calcUnrealizedPnl(
  isLong: boolean,
  size: bigint,
  entryPrice: bigint,
  currentPrice: bigint,
): bigint {
  if (size === 0n || entryPrice === 0n) return 0n;

  if (isLong) {
    if (currentPrice >= entryPrice) {
      return (size * (currentPrice - entryPrice)) / entryPrice;
    } else {
      return -((size * (entryPrice - currentPrice)) / entryPrice);
    }
  } else {
    if (entryPrice >= currentPrice) {
      return (size * (entryPrice - currentPrice)) / entryPrice;
    } else {
      return -((size * (currentPrice - entryPrice)) / entryPrice);
    }
  }
}

/**
 * Net PnL after subtracting funding owed (signed).
 */
export function calcNetPnl(pnl: bigint, fundingOwed: bigint): bigint {
  return pnl - fundingOwed;
}

// ─── Margin Ratio ─────────────────────────────────────────────────────────────

/**
 * Effective margin = margin + unrealizedPnl.
 * marginRatio = effectiveMargin / size (18-decimal fraction).
 */
export function calcMarginRatio(
  margin: bigint,
  pnl: bigint,
  size: bigint,
): number {
  if (size === 0n) return Infinity;
  const em = margin + pnl;
  return Number((em * 10000n) / size) / 100; // as percentage
}

// ─── Liquidation Price ────────────────────────────────────────────────────────

/**
 * Approximate liquidation price from position data.
 * Long:  liqPrice = entryPrice * (1 - (marginRatio - 0.05))
 * Short: liqPrice = entryPrice * (1 + (marginRatio - 0.05))
 */
export function calcLiquidationPrice(
  isLong: boolean,
  size: bigint,
  margin: bigint,
  entryPrice: bigint,
): bigint {
  if (size === 0n || entryPrice === 0n) return 0n;

  const MAINTENANCE = PRECISION / 20n; // 5% = 0.05 × 1e18
  const marginRatioFixed = (margin * PRECISION) / size;

  if (isLong) {
    if (marginRatioFixed <= MAINTENANCE) return entryPrice;
    const buffer = marginRatioFixed - MAINTENANCE;
    return entryPrice - (entryPrice * buffer) / PRECISION;
  } else {
    const buffer = marginRatioFixed + MAINTENANCE;
    if (buffer >= PRECISION) return entryPrice * 2n; // effectively infinity
    return entryPrice + (entryPrice * buffer) / PRECISION;
  }
}

// ─── Fee Calculation ──────────────────────────────────────────────────────────

/** Trading fee = 0.1% (10 bps) of notional size */
export function calcTradingFee(size: bigint): bigint {
  return (size * 10n) / 10_000n;
}

/** Required margin = size / leverage */
export function calcRequiredMargin(size: bigint, leverage: number): bigint {
  if (!Number.isFinite(leverage) || leverage <= 0) return size;

  // Support fractional leverage (e.g. 1.5x, 5.5x) using fixed-point math.
  // Scale leverage by 10 to match slider precision (0.1-0.5 steps).
  const leverageScaled = BigInt(Math.round(leverage * 10));
  if (leverageScaled <= 0n) return size;

  return (size * 10n) / leverageScaled;
}

/** Total USDC required = margin + fee */
export function calcTotalRequired(size: bigint, leverage: number): bigint {
  const margin = calcRequiredMargin(size, leverage);
  const fee = calcTradingFee(size);
  return margin + fee;
}
