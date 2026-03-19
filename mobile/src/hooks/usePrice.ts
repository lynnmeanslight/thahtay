import { useState, useEffect, useCallback } from 'react';
import { priceService } from '../services/priceService';

/**
 * Subscribe to real-time spot price from ThaHtayHook.
 * Updates on every new block (~2s on Unichain Sepolia).
 */
export function usePrice(): { price: bigint; isLoading: boolean } {
  const [price, setPrice] = useState<bigint>(priceService.getLastPrice());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    priceService.start();
    const unsub = priceService.subscribe((newPrice) => {
      setPrice(newPrice);
      setIsLoading(false);
    });

    return () => {
      unsub();
    };
  }, []);

  return { price, isLoading };
}
