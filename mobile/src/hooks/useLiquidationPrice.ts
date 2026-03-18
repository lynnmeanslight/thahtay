import { useMemo } from 'react';
import { calcLiquidationPrice, calcTradingFee } from '../utils/pnl';
import { GqlPosition } from '../services/graphService';
import { parseUsdcToInternal } from '../utils/formatting';

/**
 * Compute liquidation price for an existing open position.
 */
export function useLiquidationPrice(position: GqlPosition | null | undefined): bigint {
  return useMemo(() => {
    if (!position) return 0n;
    return calcLiquidationPrice(
      position.isLong,
      BigInt(position.size),
      BigInt(position.margin),
      BigInt(position.entryPrice),
    );
  }, [position]);
}

/**
 * Compute derived values for a *new* position being constructed in the UI.
 */
export function usePositionPreview(
  sizeInput: string,
  leverage: number,
  currentPrice: bigint,
  isLong: boolean,
): {
  sizeInternal: bigint;
  requiredMargin: bigint;
  tradingFee: bigint;
  totalRequired: bigint;
  liquidationPrice: bigint;
} {
  return useMemo(() => {
    const marginInternal = parseUsdcToInternal(sizeInput);
    const leverageInt = Math.max(1, Math.min(10, Math.round(leverage)));

    if (marginInternal === 0n || leverageInt === 0 || currentPrice === 0n) {
      return {
        sizeInternal: 0n,
        requiredMargin: 0n,
        tradingFee: 0n,
        totalRequired: 0n,
        liquidationPrice: 0n,
      };
    }

    const sizeInternal      = marginInternal * BigInt(leverageInt);
    const requiredMargin    = marginInternal;
    const tradingFee        = calcTradingFee(sizeInternal);
    const totalRequired     = requiredMargin + tradingFee;
    const liqPrice          = calcLiquidationPrice(isLong, sizeInternal, requiredMargin, currentPrice);

    return { sizeInternal, requiredMargin, tradingFee, totalRequired, liquidationPrice: liqPrice };
  }, [sizeInput, leverage, currentPrice, isLong]);
}
