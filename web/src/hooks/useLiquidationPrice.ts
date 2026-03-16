import { useMemo } from 'react';
import { calcLiquidationPrice, calcRequiredMargin, calcTradingFee } from '../utils/pnl';
import type { GqlPosition } from '../services/graphService';
import { parseUsdcToInternal } from '../utils/formatting';

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
    const sizeInternal = parseUsdcToInternal(sizeInput);

    if (sizeInternal === 0n || leverage === 0 || currentPrice === 0n) {
      return {
        sizeInternal: 0n,
        requiredMargin: 0n,
        tradingFee: 0n,
        totalRequired: 0n,
        liquidationPrice: 0n,
      };
    }

    const requiredMargin = calcRequiredMargin(sizeInternal, leverage);
    const tradingFee     = calcTradingFee(sizeInternal);
    const totalRequired  = requiredMargin + tradingFee;
    const liquidationPrice = calcLiquidationPrice(isLong, sizeInternal, requiredMargin, currentPrice);

    return { sizeInternal, requiredMargin, tradingFee, totalRequired, liquidationPrice };
  }, [sizeInput, leverage, currentPrice, isLong]);
}
