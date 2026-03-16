import { useQuery } from '@tanstack/react-query';
import { fetchPosition } from '../services/graphService';
import type { GqlPosition } from '../services/graphService';

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
