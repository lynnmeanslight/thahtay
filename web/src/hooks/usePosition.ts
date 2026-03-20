import { useQuery } from '@tanstack/react-query';
import { readContract } from '@wagmi/core';
import { fetchPosition } from '../services/graphService';
import type { GqlPosition } from '../services/graphService';
import { wagmiConfig } from '../providers/config';
import { POSITION_MANAGER_ABI } from '../contracts/abis';
import { ADDRESSES } from '../contracts/addresses';

type OnChainPosition = {
  trader: `0x${string}`;
  isLong: boolean;
  size: bigint;
  margin: bigint;
  entryPrice: bigint;
  leverage: bigint;
  lastFundingIndex: bigint;
  openedAt: bigint;
};

export function usePosition(trader: string | undefined): {
  position: GqlPosition | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['position', trader],
    queryFn: async () => {
      const address = trader! as `0x${string}`;

      // Primary: subgraph (fast historical/indexed reads)
      try {
        const indexed = await fetchPosition(address);
        // Only use subgraph result if position is still open; closed entities fall
        // through to the authoritative on-chain read below.
        if (indexed && indexed.status === 'open') return indexed;
      } catch {
        // Fallback below keeps the page usable when subgraph URL/indexing is broken.
      }

      // Fallback: direct on-chain position read
      const addresses = ADDRESSES.unichainSepolia;
      const hasOpen = await readContract(wagmiConfig, {
        address: addresses.positionManager,
        abi: POSITION_MANAGER_ABI,
        functionName: 'hasOpenPosition',
        args: [address],
      }) as boolean;

      if (!hasOpen) return null;

      const pos = await readContract(wagmiConfig, {
        address: addresses.positionManager,
        abi: POSITION_MANAGER_ABI,
        functionName: 'getPosition',
        args: [address],
      }) as unknown as OnChainPosition;

      return {
        id: address.toLowerCase(),
        trader: pos.trader,
        isLong: pos.isLong,
        size: pos.size.toString(),
        margin: pos.margin.toString(),
        entryPrice: pos.entryPrice.toString(),
        leverage: pos.leverage.toString(),
        liquidationPrice: '0',
        status: 'open',
        openedAt: pos.openedAt.toString(),
        closedAt: null,
        realizedPnl: null,
        exitPrice: null,
        fundingPaid: null,
        referrer: null,
      };
    },
    enabled: !!trader,
    refetchInterval: 3000,
    staleTime: 1000,
    retry: 3,
  });

  return {
    position: data ?? null,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
