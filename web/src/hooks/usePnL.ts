import { useMemo } from 'react';
import { calcUnrealizedPnl, calcNetPnl } from '../utils/pnl';
import type { GqlPosition } from '../services/graphService';

const PRICE_PRECISION = 10n ** 18n;

function invertPrice(raw: bigint): bigint {
  if (raw <= 0n) return 0n;
  // Contracts expose inverted price (1e18 / ethPrice). Convert back to ethPrice (18 decimals).
  return (PRICE_PRECISION * PRICE_PRECISION) / raw;
}

export function usePnL(
  position: GqlPosition | null | undefined,
  currentPrice: bigint,
  fundingOwed: bigint = 0n,
): {
  pnl: bigint;
  netPnl: bigint;
  pnlPercent: number;
  isProfit: boolean;
} {
  return useMemo(() => {
    if (!position || !currentPrice) {
      return { pnl: 0n, netPnl: 0n, pnlPercent: 0, isProfit: true };
    }

    const size       = BigInt(position.size);
    const entryPrice = invertPrice(BigInt(position.entryPrice));
    const markPrice  = invertPrice(currentPrice);
    const margin     = BigInt(position.margin);

    const pnl    = calcUnrealizedPnl(position.isLong, size, entryPrice, markPrice);
    const netPnl = calcNetPnl(pnl, fundingOwed);

    const pnlPercent = margin > 0n
      ? Number((netPnl * 10000n) / margin) / 100
      : 0;

    return { pnl, netPnl, pnlPercent, isProfit: netPnl >= 0n };
  }, [position, currentPrice, fundingOwed]);
}
