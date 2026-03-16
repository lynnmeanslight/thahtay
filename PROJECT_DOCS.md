# ThaHtay Project Documentation

## 1. What this project is

ThaHtay is a perpetual futures protocol built around a Uniswap v4 pool on Unichain.

- On-chain contracts handle position lifecycle, funding, and liquidation.
- A keeper bot helps sync pool price toward external market price.
- A subgraph indexes events for low-latency frontend reads.
- Two frontends exist: mobile (Expo React Native) and web (Vite React).

## 2. Monorepo structure

- contract/: Solidity contracts, tests, deployment scripts (Foundry)
- keeper/: Off-chain keeper and pool diagnostic scripts (Node + viem)
- subgraph/: The Graph / Goldsky indexing project
- mobile/: Expo React Native app (trade UI, wallet auth, on-chain writes)
- web/: React web app (parallel UI stack)

## 3. Core architecture and data flow

### 3.1 High-level flow

1. Trader interacts from mobile/web.
2. Frontend sends transactions to ThaHtayHook.
3. ThaHtayHook updates PositionManager and checks FundingRateManager / LiquidationEngine.
4. Hook and manager contracts emit events.
5. Subgraph indexes events and exposes GraphQL for UI history/analytics views.
6. Keeper periodically compares real-world ETH price vs pool-derived price and calls PriceKeeper.syncPrice when drift exceeds threshold.

### 3.2 Components and responsibilities

#### Uniswap v4 pool + slot0

The Uniswap v4 pool is the price source. ThaHtay reads slot0-derived price rather than depending on a separate oracle feed for core mark price reads.

#### ThaHtayHook

Main orchestrator contract.

Responsibilities:

- Stores the active PoolKey during initialization.
- Reads spot price after swaps.
- Triggers periodic funding updates.
- Scans watchlist for liquidation candidates.
- Exposes trader-facing methods:
  - openPosition
  - closePosition
  - addMargin
  - removeMargin
  - liquidate
  - getSpotPrice / getUnrealizedPnl / getLiquidationPrice

#### PositionManager

Position storage contract.

Responsibilities:

- Stores one active position per trader.
- Enforces only hook can mutate position state (HOOK_ROLE).
- Handles open/close/margin mutations and funding index tracking.

#### FundingRateManager

Funding index engine.

Responsibilities:

- Updates funding at fixed intervals (1 hour).
- Tracks long and short cumulative indices.
- Computes funding owed by index delta and size.

#### LiquidationEngine

Liquidation policy executor.

Responsibilities:

- Evaluates liquidation eligibility based on position state/current price path.
- Executes liquidation flow and payout split (liquidator bonus + treasury remainder).
- Applies per-trader cooldown by block to avoid spam in a single block.

#### PriceKeeper (on-chain) + keeper script (off-chain)

Off-chain keeper script computes target sqrt price from external market and calls on-chain PriceKeeper.syncPrice.

Key nuance:

- Threshold is enforced in sqrt-price space.
- A 0.5% sqrt drift is roughly about 1% price drift.

### 3.3 Read/write paths in frontend

#### Writes (transactions)

UI -> useTrade hook -> ThaHtayHook methods.

- openPosition path also performs USDC allowance check/approve before writing.
- close/add/remove/liquidate call direct contract methods.

#### Reads (hybrid)

- Live price, funding indices, balances: direct on-chain reads (viem/wagmi).
- Position history, liquidations, protocol stats: subgraph GraphQL.

This split keeps action-state fresh from chain while historical lists come from indexed events.

## 4. Contract lifecycle: open to close

### 4.1 Open position

1. User submits side, size, leverage, optional referrer.
2. Hook validates leverage and existing position status.
3. Hook computes required margin and fee.
4. Hook transfers USDC from trader.
5. Hook captures current spot price from pool.
6. Hook snapshots funding index and writes position into PositionManager.
7. Hook emits PositionOpened.

### 4.2 During position

- Funding updates happen over time (interval-based).
- Liquidation watchlist scanning happens in hook swap callback flow.
- User can add/remove margin.

### 4.3 Close position

1. Hook reads current spot price.
2. Calculates unrealized PnL and funding owed.
3. Computes settlement and transfers USDC accordingly.
4. Removes position in PositionManager.
5. Emits PositionClosed.

## 5. Price model details

Price conversions are a critical area in this codebase.

- Hook computes spot from sqrtPriceX96.
- Depending on token ordering, some return paths can be inverse of human-facing ETH/USD expectation.
- Mobile price service normalizes values to ETH/USD format before UI consumption.

Operational implication:

- If displayed price looks inverted or absurdly small/large, first verify orientation and normalization layer.

## 6. Keeper design and behavior

### 6.1 What keeper does

Every interval:

1. Fetches real ETH price from Binance (fallback CoinGecko).
2. Reads on-chain pool-derived price via hook.
3. Computes drift.
4. Converts real price -> target sqrtPriceX96.
5. Calls sync only if sqrt drift is above threshold.

### 6.2 Why it may appear to not sync

- Drift can look large in dollar terms but still be below sqrt threshold.
- If active in-range liquidity is zero, swaps/sync may not move meaningful execution price.
- Misconfigured addresses/env or unfunded keeper wallet also block operation.

### 6.3 Diagnostics

Use keeper scripts to inspect pool identity and liquidity shape.

- pool-state-check.mjs: confirms poolKey, poolId, slot0, active liquidity, tick bitmap, initialized tick liquidity.

## 7. Subgraph model

### 7.1 Indexed events

- PositionOpened
- PositionClosed
- MarginAdded
- MarginRemoved
- Liquidated
- FundingUpdated

### 7.2 Derived entities

- Position
- Trade
- Liquidation
- FundingUpdate
- MarginEvent
- ProtocolStat

### 7.3 Frontend usage

Mobile/web query subgraph for:

- current open position state mirror
- trader history
- recent liquidations
- protocol stats dashboard counters

## 8. Mobile app architecture

### 8.1 Runtime stack

- Expo Router for screens/tabs
- wagmi + viem for on-chain interactions
- React Query for async state and caching
- Zustand for local wallet/trade UI state
- Privy for authentication UX

### 8.2 Important runtime polyfills

Hermes does not expose all browser globals expected by some web3/auth libs.

polyfills.ts provides:

- TextEncoder/TextDecoder
- crypto.getRandomValues / randomUUID
- window event API shims
- Event / CustomEvent fallbacks

### 8.3 Tabs/screens

- Trade: open position flow, price chart, funding display
- Positions: current open position and close/margin controls
- Portfolio: balances + trade history summary
- Liquidations: at-risk monitor and liquidation action

## 9. Web app architecture

Web app mirrors many mobile concepts:

- provider composition
- wallet sync
- trade/positions/liquidations/portfolio pages

It is useful for desktop operations and dev parity with mobile.

## 10. Deployment and environment

### 10.1 Contracts (Foundry)

Deploy script responsibilities:

- Deploy PositionManager, FundingRateManager, LiquidationEngine
- Mine valid hook address with required permission bits
- Deploy ThaHtayHook with CREATE2 salt
- Grant HOOK_ROLE dependencies
- Initialize pool with token ordering and initial sqrt price

### 10.2 Keeper env

Common variables:

- PRIVATE_KEY
- PRICE_KEEPER_ADDRESS
- RPC_URL
- HOOK_ADDRESS
- POSITION_MANAGER_ADDRESS
- FUNDING_RATE_MANAGER_ADDRESS
- LIQUIDATION_ENGINE_ADDRESS
- POOL_MANAGER_ADDRESS
- USDC_ADDRESS
- WETH_ADDRESS
- STATE_VIEW_ADDRESS (optional, for deep pool diagnostics)

### 10.3 Mobile env

Common variables:

- EXPO_PUBLIC_SUBGRAPH_URL
- EXPO_PUBLIC_UNICHAIN_SEPOLIA_RPC
- EXPO_PUBLIC_PRIVY_APP_ID
- EXPO_PUBLIC_PRIVY_CLIENT_ID

## 11. Developer workflows

### 11.1 Contract dev

- forge build
- forge test -vvv
- forge script for deployment/broadcast

### 11.2 Keeper dev

- npm install
- npm start
- node pool-state-check.mjs for pool diagnostics

### 11.3 Mobile dev

- npm install
- npm run type-check
- npx expo start -c --ios (or --android)

### 11.4 Subgraph dev

- npm install
- npm run codegen
- npm run build
- deploy with Goldsky or Graph Studio scripts

## 12. Known pitfalls and troubleshooting

### 12.1 Price display mismatch

Symptom:

- Price appears inverted or far from expected.

Checks:

1. Verify hook getSpotPrice orientation vs UI expectation.
2. Verify frontend normalization path.
3. Verify chain id and addresses loaded by app.

### 12.2 Keeper appears inactive

Symptom:

- Large dollar gap but no sync tx.

Checks:

1. Compute/inspect sqrt drift, not only price drift.
2. Confirm keeper wallet has gas.
3. Confirm keeper wallet has required role/ownership authorization.
4. Confirm pool has active liquidity in range.

### 12.3 BigInt integral error in leverage math

Symptom:

- number is not integral runtime error.

Cause:

- Fractional leverage converted directly with BigInt.

Fix approach:

- Use fixed-point scaling for leverage (e.g., *10) and divide with integer math.

### 12.4 Hermes crypto missing

Symptom:

- Property crypto does not exist.

Fix approach:

- Ensure polyfills initialize global crypto.getRandomValues and optional randomUUID before app/provider initialization.

## 13. Security and operational guidance

- Never commit private keys or real secrets to git.
- Keep .env files local and excluded.
- Use dedicated keeper keys with minimal privileges/funds.
- Rotate compromised keys immediately.
- Validate addresses per environment (testnet/mainnet separation).
- Add test coverage before changing math-sensitive paths (price, pnl, funding, liquidation).

## 14. Suggested next documentation upgrades

- Add sequence diagrams for open/close/liquidation flows.
- Add explicit decimals table for each contract argument and return value.
- Add incident runbook with expected command outputs for keeper and pool diagnostics.
- Add release checklist (contracts, subgraph, mobile/web, keeper) with smoke-test gates.
