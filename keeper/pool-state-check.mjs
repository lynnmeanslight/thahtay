import { createPublicClient, http, parseAbi, encodeAbiParameters, keccak256 } from 'viem';
import { defineChain } from 'viem';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const RPC_URL = process.env.RPC_URL ?? 'https://unichain-sepolia.g.alchemy.com/v2/YMzKKvdFJU9ZBB0r2yGuo';
const PRICE_KEEPER_ADDRESS = process.env.PRICE_KEEPER_ADDRESS;
const STATE_VIEW_ADDRESS = process.env.STATE_VIEW_ADDRESS;
const TICK_WORD_RADIUS = Number(process.env.TICK_WORD_RADIUS ?? 2);
const MAX_TICKS_TO_PRINT = Number(process.env.MAX_TICKS_TO_PRINT ?? 300);

if (!PRICE_KEEPER_ADDRESS) {
  throw new Error('Missing PRICE_KEEPER_ADDRESS in keeper/.env');
}

const chain = defineChain({
  id: 1301,
  name: 'Unichain Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

const client = createPublicClient({ chain, transport: http() });

const PRICE_KEEPER_ABI = parseAbi([
  'function poolKey() view returns ((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks))',
]);

const STATE_VIEW_ABI = parseAbi([
  'function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96,int24 tick,uint24 protocolFee,uint24 lpFee)',
  'function getLiquidity(bytes32 poolId) view returns (uint128 liquidity)',
  'function getFeeGrowthGlobals(bytes32 poolId) view returns (uint256 feeGrowthGlobal0,uint256 feeGrowthGlobal1)',
  'function getTickBitmap(bytes32 poolId,int16 tick) view returns (uint256 tickBitmap)',
  'function getTickLiquidity(bytes32 poolId,int24 tick) view returns (uint128 liquidityGross,int128 liquidityNet)',
]);

function section(title) {
  console.log(`\n=== ${title} ===`);
}

function formatAddr(addr) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function bitPositions(bitmapBigInt) {
  const positions = [];
  let n = bitmapBigInt;
  let idx = 0;
  while (n > 0n) {
    if ((n & 1n) === 1n) positions.push(idx);
    n >>= 1n;
    idx += 1;
  }
  return positions;
}

function toPoolId(key) {
  const encoded = encodeAbiParameters(
    [
      {
        type: 'tuple',
        components: [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks', type: 'address' },
        ],
      },
    ],
    [key],
  );
  return keccak256(encoded);
}

async function main() {
  const poolKey = await client.readContract({
    address: PRICE_KEEPER_ADDRESS,
    abi: PRICE_KEEPER_ABI,
    functionName: 'poolKey',
  });

  const poolId = toPoolId(poolKey);

  section('Pool Identity');
  console.table([
    {
      field: 'currency0',
      value: poolKey.currency0,
    },
    {
      field: 'currency1',
      value: poolKey.currency1,
    },
    {
      field: 'fee',
      value: poolKey.fee,
    },
    {
      field: 'tickSpacing',
      value: poolKey.tickSpacing,
    },
    {
      field: 'hooks',
      value: poolKey.hooks,
    },
    {
      field: 'poolId',
      value: poolId,
    },
  ]);

  if (!STATE_VIEW_ADDRESS) {
    section('StateView Not Configured');
    console.log('No STATE_VIEW_ADDRESS configured.');
    console.log('Set STATE_VIEW_ADDRESS in keeper/.env to read pool-specific liquidity.');
    console.log('You can deploy StateView from contract/lib/v4-periphery/script/DeployStateView.s.sol.');
    return;
  }

  const [slot0, liquidity, feeGrowthGlobals] = await Promise.all([
    client.readContract({
      address: STATE_VIEW_ADDRESS,
      abi: STATE_VIEW_ABI,
      functionName: 'getSlot0',
      args: [poolId],
    }),
    client.readContract({
      address: STATE_VIEW_ADDRESS,
      abi: STATE_VIEW_ABI,
      functionName: 'getLiquidity',
      args: [poolId],
    }),
    client.readContract({
      address: STATE_VIEW_ADDRESS,
      abi: STATE_VIEW_ABI,
      functionName: 'getFeeGrowthGlobals',
      args: [poolId],
    }),
  ]);

  const activeTick = Number(slot0[1]);
  const tickSpacing = Number(poolKey.tickSpacing);
  const compressedTick = Math.floor(activeTick / tickSpacing);
  const activeWord = Math.floor(compressedTick / 256);

  section('Core Pool State');
  console.table([
    { field: 'stateView', value: STATE_VIEW_ADDRESS },
    { field: 'sqrtPriceX96', value: slot0[0].toString() },
    { field: 'activeTick', value: activeTick },
    { field: 'tickSpacing', value: tickSpacing },
    { field: 'compressedTick', value: compressedTick },
    { field: 'activeWord', value: activeWord },
    { field: 'protocolFee', value: Number(slot0[2]) },
    { field: 'lpFee', value: Number(slot0[3]) },
    { field: 'activeLiquidity', value: liquidity.toString() },
    { field: 'feeGrowthGlobal0X128', value: feeGrowthGlobals[0].toString() },
    { field: 'feeGrowthGlobal1X128', value: feeGrowthGlobals[1].toString() },
  ]);

  section('Tick Bitmap Scan');
  const words = [];
  for (let w = activeWord - TICK_WORD_RADIUS; w <= activeWord + TICK_WORD_RADIUS; w += 1) {
    words.push(w);
  }

  const bitmapRows = [];
  const initializedTicks = [];

  for (const word of words) {
    const bitmap = await client.readContract({
      address: STATE_VIEW_ADDRESS,
      abi: STATE_VIEW_ABI,
      functionName: 'getTickBitmap',
      args: [poolId, word],
    });

    const b = BigInt(bitmap);
    const setBits = bitPositions(b);
    bitmapRows.push({
      word,
      initializedBits: setBits.length,
      bitmapHex: `0x${b.toString(16)}`,
    });

    for (const bit of setBits) {
      const compressed = word * 256 + bit;
      const tick = compressed * tickSpacing;
      initializedTicks.push(tick);
    }
  }

  console.table(bitmapRows);

  if (initializedTicks.length === 0) {
    section('Initialized Tick Liquidity');
    console.log('No initialized ticks found in scanned words.');
    console.log('This usually means no nearby in-range liquidity for the current tick.');
    return;
  }

  initializedTicks.sort((a, b) => a - b);
  const ticksToQuery = initializedTicks.slice(0, MAX_TICKS_TO_PRINT);

  const liqRows = [];
  for (const tick of ticksToQuery) {
    const liq = await client.readContract({
      address: STATE_VIEW_ADDRESS,
      abi: STATE_VIEW_ABI,
      functionName: 'getTickLiquidity',
      args: [poolId, tick],
    });

    liqRows.push({
      tick,
      distanceFromActiveTick: tick - activeTick,
      liquidityGross: liq[0].toString(),
      liquidityNet: liq[1].toString(),
    });
  }

  section('Initialized Tick Liquidity');
  console.log(
    `Showing ${liqRows.length}/${initializedTicks.length} initialized ticks (set MAX_TICKS_TO_PRINT to increase).`,
  );
  console.table(liqRows);

  section('Summary');
  console.table([
    { metric: 'hook', value: formatAddr(poolKey.hooks) },
    { metric: 'activeLiquidity', value: liquidity.toString() },
    { metric: 'initializedTicksFound', value: initializedTicks.length },
    { metric: 'scannedWordRadius', value: TICK_WORD_RADIUS },
  ]);
}

main().catch((err) => {
  console.error(err?.shortMessage ?? err?.message ?? err);
  process.exit(1);
});
