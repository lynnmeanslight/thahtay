import { useQuery } from '@tanstack/react-query';
import { fetchPosition, GqlPosition } from '../services/graphService';

/**
 * Fetch a trader's position from The Graph.
 * Refetches every 3 seconds to catch on-chain events.
 */
export function usePosition(trader: string | undefined): {
  position: GqlPosition | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['position', trader],
    queryFn: () => fetchPosition(trader!),
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
