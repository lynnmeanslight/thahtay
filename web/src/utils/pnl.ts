const PRECISION = BigInt('1000000000000000000'); // 1e18

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
 *
 * entryPrice here is the raw on-chain value (WETH-per-USDC, inverted), so
 * the direction of price movement for each side is reversed versus intuition:
 *
 *   LONG  is liquidated when ETH price drops → inverted price RISES
 *         → liqPrice_inv = entryPrice * (1 + buffer)  [displayed value will be below entry]
 *
 *   SHORT is liquidated when ETH price rises → inverted price FALLS
 *         → liqPrice_inv = entryPrice * (1 - buffer)  [displayed value will be above entry]
 *
 * buffer = marginRatio - maintenanceMargin (5%) for both sides.
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

  if (marginRatioFixed <= MAINTENANCE) return entryPrice;
  const buffer = marginRatioFixed - MAINTENANCE;

  if (isLong) {
    // Inverted price must RISE to trigger liquidation (ETH price falls)
    return entryPrice + (entryPrice * buffer) / PRECISION;
  } else {
    // Inverted price must FALL to trigger liquidation (ETH price rises)
    return entryPrice - (entryPrice * buffer) / PRECISION;
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

  const leverageInt = BigInt(Math.round(leverage));
  if (leverageInt <= 0n) return size;

  return size / leverageInt;
}

/** Total USDC required = margin + fee */
export function calcTotalRequired(size: bigint, leverage: number): bigint {
  const margin = calcRequiredMargin(size, leverage);
  const fee = calcTradingFee(size);
  return margin + fee;
}
