import { useMemo } from 'react';
import { useReadContracts } from 'wagmi';
import { FUNDING_RATE_MANAGER_ABI } from '../contracts/abis/index';
import { THAHTAYHOOK_ABI } from '../contracts/abis/ThaHtayHook';
import { ADDRESSES } from '../contracts/addresses';

const PRECISION = BigInt('1000000000000000000'); // 1e18
// K coefficient — must match FundingRateManager.K = 1e13
const K = 10000000000000n;
// Hours per year for annualisation
const HOURS_PER_YEAR = 8760;

/**
 * Convert raw on-chain funding rate (int256, K-scaled) to % per hour.
 * rate = K * priceDelta / indexPrice  (all in same 1e18-based units)
 * % per hour = rate / PRECISION * 100
 */
function rateToHourlyPct(rate: bigint): number {
  // Multiply by 1e8 before dividing by PRECISION to keep precision, then / 1e6 to get %
  return Number((rate * 100000000n) / PRECISION) / 1000000;
}

/**
 * Compute the live pending funding rate from current mark and index prices.
 * Both prices use getSpotPrice() units: 1e18 / ethPrice (inverted, 18 dec).
 */
function computePendingRate(markPrice: bigint, indexP: bigint): bigint {
  if (indexP === 0n) return 0n;
  const priceDelta = markPrice - indexP;
  return (K * priceDelta) / indexP;
}

export function useFundingRate() {
  const addresses = ADDRESSES.unichainSepolia;

  const { data } = useReadContracts({
    contracts: [
      {
        address: addresses.fundingRateManager,
        abi: FUNDING_RATE_MANAGER_ABI,
        functionName: 'currentFundingRate',
      },
      {
        address: addresses.thaHtayHook,
        abi: THAHTAYHOOK_ABI,
        functionName: 'getSpotPrice',
      },
      {
        address: addresses.thaHtayHook,
        abi: THAHTAYHOOK_ABI,
        functionName: 'indexPrice',
      },
      {
        address: addresses.fundingRateManager,
        abi: FUNDING_RATE_MANAGER_ABI,
        functionName: 'fundingEpoch',
      },
      {
        address: addresses.fundingRateManager,
        abi: FUNDING_RATE_MANAGER_ABI,
        functionName: 'longCumulativeIndex',
      },
      {
        address: addresses.fundingRateManager,
        abi: FUNDING_RATE_MANAGER_ABI,
        functionName: 'shortCumulativeIndex',
      },
    ],
    query: { refetchInterval: 10_000 },
  });

  return useMemo(() => {
    if (!data) return { longRate: 0, shortRate: 0, epoch: 0, isLoading: true };

    const settledRate   = (data[0]?.result ?? 0n) as bigint;
    const markPrice     = (data[1]?.result ?? 0n) as bigint;
    const indexP        = (data[2]?.result ?? 0n) as bigint;
    const epoch         = Number((data[3]?.result ?? 0n) as bigint);
    const longCumIndex  = data[4]?.result as bigint | undefined;
    const shortCumIndex = data[5]?.result as bigint | undefined;

    // Prefer live-computed rate (mark vs keeper-fed indexPrice) over the
    // once-per-hour settled value. Falls back to settled when indexPrice
    // hasn't been set yet (both prices 0n).
    const liveRate = (markPrice > 0n && indexP > 0n)
      ? computePendingRate(markPrice, indexP)
      : settledRate;

    // Convert to annualised % (industry standard for perps display)
    const hourlyPct    = rateToHourlyPct(liveRate < 0n ? -liveRate : liveRate) * (liveRate < 0n ? -1 : 1);
    const annualizedPct = hourlyPct * HOURS_PER_YEAR;

    return {
      longRate:  annualizedPct,   // positive = longs paying shorts
      shortRate: -annualizedPct,  // opposite
      epoch,
      longCumulativeIndex:  longCumIndex,
      shortCumulativeIndex: shortCumIndex,
      isLoading: false,
    };
  }, [data]);
}
