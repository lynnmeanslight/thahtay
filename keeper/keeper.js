/**
 * keeper.js — Price Sync Keeper for ThaHtayHook
 *
 * Fetches the live ETH/USDC price from Binance every 60 seconds, computes the
 * target sqrtPriceX96; if the pool has drifted beyond the on-chain threshold
 * it calls
 * PriceKeeper.syncPrice() on Unichain Sepolia to push slot0 back in line.
 *
 * The Uniswap v4 hook then reads slot0 in its afterSwap callback, so every
 * keeper sync naturally triggers funding rate updates and liquidation scans —
 * all driven by the real market price.
 *
 * Usage:
 *   cp .env.example .env   # fill in your values
 *   npm install
 *   node keeper.js
 */

import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defineChain } from 'viem';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

// ── Chain definition ──────────────────────────────────────────────────────────

const unichainSepolia = defineChain({
  id: 1301,
  name: 'Unichain Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.RPC_URL ?? 'https://sepolia.unichain.org'] },
  },
});

// ── Config ────────────────────────────────────────────────────────────────────

const PRIVATE_KEY          = process.env.PRIVATE_KEY;             // 0x-prefixed
const PRICE_KEEPER_ADDRESS = process.env.PRICE_KEEPER_ADDRESS;    // deployed PriceKeeper
const HOOK_ADDRESS         = process.env.HOOK_ADDRESS ?? '0xb251e8bBcd2C0d70869B728e58AE526622bD30C0';
const POLL_INTERVAL_MS     = Number(process.env.POLL_INTERVAL_MS ?? 60_000); // 1 min default
// This must match PriceKeeper.THRESHOLD_BPS in sqrtPrice space.
// THRESHOLD_BPS=50 => sqrt drift 0.5%, which is roughly ~1% ETH price drift.
const SQRT_DRIFT_THRESHOLD = 0.005;

if (!PRIVATE_KEY)          throw new Error('Missing PRIVATE_KEY in .env');
if (!PRICE_KEEPER_ADDRESS) throw new Error('Missing PRICE_KEEPER_ADDRESS in .env');

// ── ABIs ──────────────────────────────────────────────────────────────────────

const KEEPER_ABI = parseAbi([
  'function syncPrice(uint160 targetSqrtPriceX96) external',
]);

const HOOK_ABI = parseAbi([
  'function getSpotPrice() external view returns (uint256)',
]);

// ── Clients ───────────────────────────────────────────────────────────────────

const account = privateKeyToAccount(PRIVATE_KEY);

const publicClient = createPublicClient({
  chain: unichainSepolia,
  transport: http(),
});

const walletClient = createWalletClient({
  account,
  chain: unichainSepolia,
  transport: http(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Fetch live ETH/USDC price from Binance (no API key required).
 * Falls back to CoinGecko if Binance is unavailable.
 */
async function fetchRealPrice() {
  try {
    const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDC');
    if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
    const { price } = await res.json();
    return parseFloat(price);
  } catch {
    // Fallback: CoinGecko (slower, no API key needed)
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
    );
    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
    const data = await res.json();
    return data.ethereum.usd;
  }
}

/**
 * Convert an ETH/USD price to the sqrtPriceX96 expected by the pool.
 *
 * Pool layout: USDC = token0 (6 dec), WETH = token1 (18 dec)
 * getSpotPrice() returns  1e18 / ethPrice  (inverted ratio with 18 dec precision)
 *
 * Derivation:
 *   getSpotPrice = sqrtPriceX96^2 * 1e30 / 2^192
 *   getSpotPrice = 1e18 / ethPrice
 *   ⟹ sqrtPriceX96 = 2^96 / (sqrt(ethPrice) * 1e6)
 *
 * Floating-point precision is sufficient: error < 1e-8% for realistic prices.
 */
function priceToSqrtPriceX96(ethPriceUsd) {
  // sqrt(ethPrice) * 1e6  (keep as float — precision adequate for keeper)
  const denom = Math.sqrt(ethPriceUsd) * 1e6;

  // 2^96 expressed as BigInt, then divided by denom approximated as BigInt
  const Q96 = 2n ** 96n;
  // Scale numerator by 1e12 for precision before dividing
  const numerator = Q96 * 1_000_000_000_000n; // Q96 * 1e12
  const denomBig  = BigInt(Math.round(denom * 1e12));
  return numerator / denomBig;
}

/**
 * Read the pool's current effective ETH price via ThaHtayHook.getSpotPrice().
 */
async function readPoolPrice() {
  const raw = await publicClient.readContract({
    address: HOOK_ADDRESS,
    abi: HOOK_ABI,
    functionName: 'getSpotPrice',
  });
  // Contract returns 1e18 / ethPrice, so invert
  return raw > 0n ? 1e18 / Number(raw) : null;
}

// ── Main loop ─────────────────────────────────────────────────────────────────

async function tick() {
  const timestamp = new Date().toISOString();
  try {
    const [realPrice, poolPrice] = await Promise.all([
      fetchRealPrice(),
      readPoolPrice(),
    ]);

    if (poolPrice === null) {
      console.log(`[${timestamp}] pool price unavailable, skipping`);
      return;
    }

    const priceDrift = Math.abs(realPrice - poolPrice) / poolPrice;
    const targetSqrtPriceX96 = priceToSqrtPriceX96(realPrice);
    const currentSqrtPriceX96 = priceToSqrtPriceX96(poolPrice);
    const sqrtDrift = currentSqrtPriceX96 > 0n
      ? Number((currentSqrtPriceX96 > targetSqrtPriceX96
        ? currentSqrtPriceX96 - targetSqrtPriceX96
        : targetSqrtPriceX96 - currentSqrtPriceX96)) / Number(currentSqrtPriceX96)
      : 0;

    const approxPriceThreshold = SQRT_DRIFT_THRESHOLD * 2;
    console.log(
      `[${timestamp}] real=$${realPrice.toFixed(2)}  pool=$${poolPrice.toFixed(2)}  priceDrift=${(priceDrift * 100).toFixed(2)}%  sqrtDrift=${(sqrtDrift * 100).toFixed(2)}%`,
    );

    if (sqrtDrift < SQRT_DRIFT_THRESHOLD) {
      console.log(
        `  ↳ below on-chain threshold (sqrt ${(
          SQRT_DRIFT_THRESHOLD * 100
        ).toFixed(2)}%, approx price ${(approxPriceThreshold * 100).toFixed(2)}%), no sync`,
      );
      return;
    }

    console.log(`  ↳ syncing to sqrtPriceX96=${targetSqrtPriceX96.toString()} ...`);

    const hash = await walletClient.writeContract({
      address: PRICE_KEEPER_ADDRESS,
      abi: KEEPER_ABI,
      functionName: 'syncPrice',
      args: [targetSqrtPriceX96],
    });

    console.log(`  ↳ tx submitted: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`  ↳ confirmed in block ${receipt.blockNumber} (status: ${receipt.status})`);
  } catch (err) {
    console.error(`[${timestamp}] ERROR:`, err.shortMessage ?? err.message ?? err);
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────

console.log(`ThaHtayHook Price Keeper starting`);
console.log(`  keeper contract : ${PRICE_KEEPER_ADDRESS}`);
console.log(`  keeper wallet   : ${account.address}`);
console.log(`  poll interval   : ${POLL_INTERVAL_MS / 1000}s`);
console.log(`  sqrt threshold  : ${SQRT_DRIFT_THRESHOLD * 100}%`);
console.log(`  approx price th : ${(SQRT_DRIFT_THRESHOLD * 200).toFixed(2)}%`);
console.log('');

tick(); // run immediately on start
setInterval(tick, POLL_INTERVAL_MS);
