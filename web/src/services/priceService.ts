import { createPublicClient, webSocket, http } from 'viem';
import { DEFAULT_CHAIN } from '../contracts/addresses';
import { THAHTAYHOOK_ABI } from '../contracts/abis/ThaHtayHook';
import { getAddresses } from '../contracts/addresses';

type PriceCallback = (price: bigint) => void;

class PriceService {
  private callbacks: Set<PriceCallback> = new Set();
  private lastPrice: bigint = 0n;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private wsClient: ReturnType<typeof createPublicClient> | null = null;
  private httpClient: ReturnType<typeof createPublicClient>;
  private unwatch: (() => void) | null = null;

  constructor() {
    this.httpClient = createPublicClient({
      chain: DEFAULT_CHAIN,
      transport: http(),
    });
  }

  start() {
    this.startWebSocket();
    this.pollInterval = setInterval(() => this.fetchPrice(), 2000);
  }

  stop() {
    this.unwatch?.();
    this.wsClient = null;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  subscribe(callback: PriceCallback): () => void {
    this.callbacks.add(callback);
    if (this.lastPrice > 0n) callback(this.lastPrice);
    return () => this.callbacks.delete(callback);
  }

  getLastPrice(): bigint {
    return this.lastPrice;
  }

  private startWebSocket() {
    try {
      this.wsClient = createPublicClient({
        chain: DEFAULT_CHAIN,
        transport: webSocket(DEFAULT_CHAIN.rpcUrls.default.http[0].replace('https', 'wss')),
      });
      this.unwatch = this.wsClient.watchBlockNumber({
        onBlockNumber: () => this.fetchPrice(),
      });
    } catch {
      // WebSocket unavailable — polling fallback covers it
    }
  }

  private async fetchPrice() {
    try {
      const addresses = getAddresses(DEFAULT_CHAIN.id as 1301 | 130);
      const price = await this.httpClient.readContract({
        address: addresses.thaHtayHook,
        abi: THAHTAYHOOK_ABI,
        functionName: 'getSpotPrice',
      }) as bigint;

      if (price && price !== this.lastPrice) {
        this.lastPrice = price;
        this.notify(price);
      }
    } catch {
      // Silently ignore — retried next interval
    }
  }

  private notify(price: bigint) {
    this.callbacks.forEach((cb) => cb(price));
  }
}

export const priceService = new PriceService();
