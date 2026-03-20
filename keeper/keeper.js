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

const CHAIN_ID = Number(process.env.CHAIN_ID ?? 1301);
const CHAIN_NAME = process.env.CHAIN_NAME ?? 'Unichain Sepolia';
const RPC_URL = process.env.RPC_URL
  ?? 'https://unichain-sepolia.g.alchemy.com/v2/YMzKKvdFJU9ZBB0r2yGuo';

const unichainSepolia = defineChain({
  id: CHAIN_ID,
  name: CHAIN_NAME,
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] },
  },
});

// ── Config ────────────────────────────────────────────────────────────────────

const PRIVATE_KEY          = process.env.PRIVATE_KEY;             // 0x-prefixed
const PRICE_KEEPER_ADDRESS = process.env.PRICE_KEEPER_ADDRESS;    // deployed PriceKeeper
const HOOK_ADDRESS         = process.env.HOOK_ADDRESS;
const POLL_INTERVAL_MS     = Number(process.env.POLL_INTERVAL_MS ?? 60_000); // 1 min default
// Must match PriceKeeper.thresholdBps (default 12) converted to a fraction.
// 12 bps = 0.12% sqrtPrice drift ≈ 0.25% ETH price drift.
// Keeper fires only when sqrtDrift >= this value, so the contract never rejects
// "drift below threshold".
// NOTE: deployed contract must have thresholdBps <= 12. Call:
//   cast send $PRICE_KEEPER_ADDRESS "setSyncConfig(uint256,uint256,uint256)" 12 200 10 \
//     --rpc-url https://sepolia.unichain.org --private-key $PRIVATE_KEY
const SQRT_DRIFT_THRESHOLD = 0.00125;

if (!PRIVATE_KEY)          throw new Error('Missing PRIVATE_KEY in .env');
if (!PRICE_KEEPER_ADDRESS) throw new Error('Missing PRICE_KEEPER_ADDRESS in .env');
if (!HOOK_ADDRESS)         throw new Error('Missing HOOK_ADDRESS in .env');

// ── ABIs ──────────────────────────────────────────────────────────────────────

const KEEPER_ABI = parseAbi([
  'function syncPrice(uint160 targetSqrtPriceX96) external',
  'function owner() external view returns (address)',
  'function poolKey() external view returns ((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks))',
]);

const HOOK_ABI = parseAbi([
  'function getSpotPrice() external view returns (uint256)',
  'function setIndexPrice(uint256 newIndexPrice) external',
  'function triggerFundingUpdate() external',
  'function poolKey() external view returns ((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks))',
  'function KEEPER_ROLE() external view returns (bytes32)',
  'function hasRole(bytes32 role, address account) external view returns (bool)',
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

let canPushIndexPrice = true;
let canTriggerFunding = true;
let syncEnabled = true;

async function runPreflightChecks() {
  const rpcChainId = await publicClient.getChainId();
  if (rpcChainId !== CHAIN_ID) {
    throw new Error(
      `RPC chain mismatch: expected ${CHAIN_ID} but RPC reports ${rpcChainId}. Check RPC_URL/CHAIN_ID in .env.`,
    );
  }

  try {
    const owner = await publicClient.readContract({
      address: PRICE_KEEPER_ADDRESS,
      abi: KEEPER_ABI,
      functionName: 'owner',
    });
    console.log(`  keeper owner    : ${owner}`);
  } catch (err) {
    throw new Error(
      `PRICE_KEEPER_ADDRESS does not expose owner(). Wrong address/network? ${err?.shortMessage ?? err?.message ?? err}`,
    );
  }

  const hookPoolKey = await publicClient.readContract({
    address: HOOK_ADDRESS,
    abi: HOOK_ABI,
    functionName: 'poolKey',
  });
  const keeperPoolKey = await publicClient.readContract({
    address: PRICE_KEEPER_ADDRESS,
    abi: KEEPER_ABI,
    functionName: 'poolKey',
  });

  const poolKeyMismatch =
    hookPoolKey.currency0.toLowerCase() !== keeperPoolKey.currency0.toLowerCase()
    || hookPoolKey.currency1.toLowerCase() !== keeperPoolKey.currency1.toLowerCase()
    || Number(hookPoolKey.fee) !== Number(keeperPoolKey.fee)
    || Number(hookPoolKey.tickSpacing) !== Number(keeperPoolKey.tickSpacing)
    || hookPoolKey.hooks.toLowerCase() !== keeperPoolKey.hooks.toLowerCase();

  if (poolKeyMismatch) {
    throw new Error(
      `Pool key mismatch. Hook key: ${JSON.stringify(hookPoolKey)} | PriceKeeper key: ${JSON.stringify(keeperPoolKey)}. Redeploy PriceKeeper with the exact hook pool key values.`,
    );
  }

  let keeperRole;
  let hasKeeperRole;
  let hasKeeperContractRole;
  try {
    keeperRole = await publicClient.readContract({
      address: HOOK_ADDRESS,
      abi: HOOK_ABI,
      functionName: 'KEEPER_ROLE',
    });
    hasKeeperRole = await publicClient.readContract({
      address: HOOK_ADDRESS,
      abi: HOOK_ABI,
      functionName: 'hasRole',
      args: [keeperRole, account.address],
    });

    hasKeeperContractRole = await publicClient.readContract({
      address: HOOK_ADDRESS,
      abi: HOOK_ABI,
      functionName: 'hasRole',
      args: [keeperRole, PRICE_KEEPER_ADDRESS],
    });
  } catch {
    canPushIndexPrice = false;
    canTriggerFunding = false;
    syncEnabled = false;
    console.warn('  warn: hook does not expose role/introspection methods; keeper-side hook updates disabled');
    return;
  }

  if (!hasKeeperRole) {
    canPushIndexPrice = false;
    console.warn('  warn: keeper wallet lacks KEEPER_ROLE on hook; setIndexPrice will be skipped');
  }

  if (!hasKeeperContractRole) {
    syncEnabled = false;
    throw new Error(
      `PriceKeeper contract lacks KEEPER_ROLE on hook; syncPrice swaps will always revert. Grant role with: cast send ${HOOK_ADDRESS} \"grantRole(bytes32,address)\" ${keeperRole} ${PRICE_KEEPER_ADDRESS} --rpc-url ${RPC_URL} --private-key <ADMIN_PRIVATE_KEY>`,
    );
  }
}

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

// Hook price orientation currently uses inverse ETH price in 1e18 precision.
function realPriceToHookIndexPrice(ethPriceUsd) {
  if (!Number.isFinite(ethPriceUsd) || ethPriceUsd <= 0) return 0n;
  return BigInt(Math.round(1e18 / ethPriceUsd));
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

    const hookIndexPrice = realPriceToHookIndexPrice(realPrice);
    if (hookIndexPrice > 0n && canPushIndexPrice) {
      try {
        const setIndexHash = await walletClient.writeContract({
          address: HOOK_ADDRESS,
          abi: HOOK_ABI,
          functionName: 'setIndexPrice',
          args: [hookIndexPrice],
        });
        await publicClient.waitForTransactionReceipt({ hash: setIndexHash });
      } catch (e) {
        const msg = e?.shortMessage ?? e?.message ?? `${e}`;
        console.warn(`  ↳ setIndexPrice failed: ${msg}`);
        if (msg.includes('Missing or invalid parameters') || msg.includes('not keeper')) {
          canPushIndexPrice = false;
          console.warn('  ↳ disabling future setIndexPrice calls; fix hook role or hook address');
        }
      }
    }

    if (canTriggerFunding) {
      try {
        const fundingHash = await walletClient.writeContract({
          address: HOOK_ADDRESS,
          abi: HOOK_ABI,
          functionName: 'triggerFundingUpdate',
        });
        await publicClient.waitForTransactionReceipt({ hash: fundingHash });
      } catch (e) {
        const msg = e?.shortMessage ?? e?.message ?? `${e}`;
        console.warn(`  ↳ triggerFundingUpdate failed: ${msg}`);
        if (msg.includes('Missing or invalid parameters')) {
          canTriggerFunding = false;
          console.warn('  ↳ disabling future triggerFundingUpdate calls; fix hook address/ABI');
        }
      }
    }

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

    const approxPriceThreshold = SQRT_DRIFT_THRESHOLD * 2; // ~0.25% price drift
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

    if (!syncEnabled) {
      console.log('  ↳ sync disabled (pool not initialized for this PriceKeeper pool key)');
      return;
    }

    console.log(`  ↳ syncing to sqrtPriceX96=${targetSqrtPriceX96.toString()} ...`);

    let hash;
    try {
      hash = await walletClient.writeContract({
        address: PRICE_KEEPER_ADDRESS,
        abi: KEEPER_ABI,
        functionName: 'syncPrice',
        args: [targetSqrtPriceX96],
      });
    } catch (e) {
      const msg = e?.shortMessage ?? e?.message ?? `${e}`;
      if (msg.includes('pool not initialised')) {
        syncEnabled = false;
        console.error(
          `  ↳ sync disabled: PriceKeeper pool is not initialized. Redeploy PriceKeeper with the same PoolManager/token0/token1/fee/tickSpacing/hooks as your initialized pool.`,
        );
        return;
      }
      throw e;
    }

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
console.log(`  chain           : ${CHAIN_NAME} (${CHAIN_ID})`);
console.log(`  rpc             : ${RPC_URL}`);
console.log(`  poll interval   : ${POLL_INTERVAL_MS / 1000}s`);
console.log(`  sqrt threshold  : ${SQRT_DRIFT_THRESHOLD * 100}%`);
console.log(`  approx price th : ${(SQRT_DRIFT_THRESHOLD * 200).toFixed(2)}%`);
console.log('');

runPreflightChecks()
  .then(() => {
    tick(); // run immediately on start
    setInterval(tick, POLL_INTERVAL_MS);
  })
  .catch((err) => {
    console.error(`Startup preflight failed: ${err?.shortMessage ?? err?.message ?? err}`);
    process.exit(1);
  });
