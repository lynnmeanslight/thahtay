import { useMemo } from 'react';
import { calcUnrealizedPnl, calcNetPnl } from '../utils/pnl';
import type { GqlPosition } from '../services/graphService';

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
    const entryPrice = BigInt(position.entryPrice);
    const margin     = BigInt(position.margin);

    const pnl    = calcUnrealizedPnl(position.isLong, size, entryPrice, currentPrice);
    const netPnl = calcNetPnl(pnl, fundingOwed);

    const pnlPercent = margin > 0n
      ? Number((netPnl * 10000n) / margin) / 100
      : 0;

    return { pnl, netPnl, pnlPercent, isProfit: netPnl >= 0n };
  }, [position, currentPrice, fundingOwed]);
}
