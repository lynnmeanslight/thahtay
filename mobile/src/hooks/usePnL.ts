import { useMemo } from 'react';
import { calcUnrealizedPnl, calcNetPnl } from '../utils/pnl';
import { GqlPosition } from '../services/graphService';

/**
 * Real-time PnL computed from live price and position data.
 * Runs on every render (price updates every ~2s).
 */
export function usePnL(
  position: GqlPosition | null | undefined,
  currentPrice: bigint,
  fundingOwed: bigint = 0n,
): {
  pnl: bigint;      // raw PnL (18 decimals, signed)
  netPnl: bigint;   // after funding
  pnlPercent: number; // percentage of initial margin
  isProfit: boolean;
} {
  return useMemo(() => {
    if (!position || !currentPrice) {
      return { pnl: 0n, netPnl: 0n, pnlPercent: 0, isProfit: true };
    }

    const size       = BigInt(position.size);
    const entryPrice = BigInt(position.entryPrice);
    const margin     = BigInt(position.margin);

    const pnl    = calcUnrealizedPnl(position.isLong, size, entryPrice, currentPrice);
    const netPnl = calcNetPnl(pnl, fundingOwed);

    const pnlPercent = margin > 0n
      ? Number((netPnl * 10000n) / margin) / 100
      : 0;

    return {
      pnl,
      netPnl,
      pnlPercent,
      isProfit: netPnl >= 0n,
    };
  }, [position, currentPrice, fundingOwed]);
}
