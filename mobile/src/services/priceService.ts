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
  private started = false;

  // getSpotPrice() currently returns inverse ratio for this pool orientation.
  // Normalize to ETH/USD (18 decimals) for the mobile UI and calculations.
  private static readonly ONE_E18 = 10n ** 18n;
  private static readonly ONE_E36 = 10n ** 36n;

  constructor() {
    this.httpClient = createPublicClient({
      chain: DEFAULT_CHAIN,
      transport: http(),
    });
  }

  start() {
    if (this.started) return;
    this.started = true;

    this.startWebSocket();
    // Fallback polling every 2 seconds
    this.pollInterval = setInterval(() => this.fetchPrice(), 2000);
    void this.fetchPrice();
  }

  stop() {
    this.started = false;
    this.unwatch?.();
    this.wsClient = null;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  subscribe(callback: PriceCallback): () => void {
    this.callbacks.add(callback);
    // Immediately deliver last known price
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
      const addresses = getAddresses(DEFAULT_CHAIN.id as 84532 | 8453);
      const rawPrice = await this.httpClient.readContract({
        address: addresses.thaHtayHook,
        abi: THAHTAYHOOK_ABI,
        functionName: 'getSpotPrice',
      }) as bigint;

      const price = this.normalizePrice(rawPrice);

      if (price && price !== this.lastPrice) {
        this.lastPrice = price;
        this.notify(price);
      }
    } catch (e) {
      // Silently ignore — price will be retried next interval
    }
  }

  private notify(price: bigint) {
    this.callbacks.forEach((cb) => cb(price));
  }

  private normalizePrice(rawPrice: bigint): bigint {
    if (rawPrice <= 0n) return 0n;

    // If raw is < 1e18, treat it as inverse (e.g. 1e18 / ethPrice) and invert.
    if (rawPrice < PriceService.ONE_E18) {
      return PriceService.ONE_E36 / rawPrice;
    }

    return rawPrice;
  }
}

export const priceService = new PriceService();
