import { useMemo } from 'react';
import { useReadContract, useChainId } from 'wagmi';
import { FUNDING_RATE_MANAGER_ABI } from '../contracts/abis/index';
import { getAddresses } from '../contracts/addresses';

const PRECISION = BigInt('1000000000000000000'); // 1e18

function bpsToPercent(rate: bigint): number {
  return Number((rate * BigInt(10000)) / PRECISION) / 100;
}

export function useFundingRate() {
  const chainId = useChainId();
  const addresses = getAddresses(chainId as 1301 | 130);

  const { data: longIndex } = useReadContract({
    address: addresses.fundingRateManager,
    abi: FUNDING_RATE_MANAGER_ABI,
    functionName: 'longCumulativeIndex',
    query: { refetchInterval: 10_000 },
  });

  const { data: shortIndex } = useReadContract({
    address: addresses.fundingRateManager,
    abi: FUNDING_RATE_MANAGER_ABI,
    functionName: 'shortCumulativeIndex',
    query: { refetchInterval: 10_000 },
  });

  const { data: epoch } = useReadContract({
    address: addresses.fundingRateManager,
    abi: FUNDING_RATE_MANAGER_ABI,
    functionName: 'fundingEpoch',
    query: { refetchInterval: 10_000 },
  });

  return useMemo(() => {
    if (!longIndex || !shortIndex) {
      return { longRate: 0, shortRate: 0, epoch: 0, isLoading: true };
    }
    const li = longIndex as bigint;
    const si = shortIndex as bigint;
    const longDelta = li - PRECISION;
    const shortDelta = si - PRECISION;

    return {
      longRate: bpsToPercent(longDelta < 0n ? -longDelta : longDelta) * (longDelta < 0n ? -1 : 1),
      shortRate: bpsToPercent(shortDelta < 0n ? -shortDelta : shortDelta) * (shortDelta < 0n ? -1 : 1),
      epoch: Number(epoch ?? 0n),
      isLoading: false,
    };
  }, [longIndex, shortIndex, epoch]);
}
