import { useState, useEffect } from 'react';
import { priceService } from '../services/priceService';

export function usePrice(): { price: bigint; isLoading: boolean } {
  const [price, setPrice] = useState<bigint>(priceService.getLastPrice());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    priceService.start();
    const unsub = priceService.subscribe((newPrice) => {
      setPrice(newPrice);
      setIsLoading(false);
    });
    return () => unsub();
  }, []);

  return { price, isLoading };
}
