# ThaHtay — Perpetual Futures Protocol on Uniswap v4

## What It Is

ThaHtay is a **decentralized perpetual futures exchange** built as a Uniswap v4 Hook on **Unichain** (Uniswap's L2). It lets traders take leveraged long/short positions on ETH/USD using USDC as collateral — entirely on-chain, without a centralized orderbook. A Uniswap v4 ETH/USDC pool acts as the price source; all position logic is managed by hook contracts that intercept pool lifecycle events.

---

## System Architecture

The monorepo has five layers:

### 1. Smart Contracts (`contract/`)

Built with **Foundry** (Solidity `^0.8.26`), deployed on **Unichain Sepolia**.

**Live addresses:**

| Contract | Address |
|---|---|
| `ThaHtayHook` | `0xeb5851c6014C5a5F5A062C1331826b0789C3F0C0` |
| `PositionManager` | `0x2071faEe2ee61fb5a295BF03a1D51f26D2F9FaBD` |
| `FundingRateManager` | `0x723Bb79a7951415563129eE3583e573432aD6Fda` |
| `LiquidationEngine` | `0x4503A9d28Dc625676e327184Ea76c654Dd657419` |
| `Treasury` | `0x3766C6dDF41a590bB68FB925594Dc8b24663C765` |
| `USDC (test)` | `0x31d0220469e10c4E71834a79b1f276d740d3768F` |

**Four core contracts:**

| Contract | Role |
|---|---|
| `ThaHtayHook.sol` | Main orchestrator — attaches to Uniswap v4 pool, handles all trader-facing methods |
| `PositionManager.sol` | Position storage — one active position per trader, `HOOK_ROLE`-gated mutations |
| `FundingRateManager.sol` | Funding index engine — hourly updates, long/short cumulative indices |
| `LiquidationEngine.sol` | Liquidation policy — eligibility checks, payout splits, per-trader cooldowns |

**`ThaHtayHook`** is the entry point for all trader interactions. It:

- Exposes `openPosition`, `closePosition`, `addMargin`, `removeMargin`, `liquidate`
- Reads `slot0`-derived mark price from the Uniswap v4 pool after every swap (`afterSwap` callback)
- Triggers funding rate updates and liquidation scans inside the swap callback flow
- Collects a **0.1% trading fee** (10 bps), sharing 20% of that with referrers
- Has an **optional Pyth oracle** integration for index price in funding calculations

**Protocol parameters:**

| Parameter | Value | Rationale |
|---|---|---|
| Collateral | USDC | Stable, simple PnL math |
| Mark price | Uniswap v4 `slot0` | No separate oracle needed for core price |
| Leverage range | 1× – 10× | Manageable risk for v1 |
| Margin model | Isolated per position | Simple accounting |
| Trading fee | 0.1% (10 bps) | Protocol revenue |
| Referral share | 20% of protocol fee | Growth incentive |
| Liquidation bonus | 5% of position value | Incentivises liquidation bots |

---

### 2. Off-chain Keeper (`keeper/`)

A **Node.js** bot (using `viem`) that keeps the Uniswap v4 pool price in sync with real-world ETH price.

**Every interval it:**

1. Fetches real ETH/USD price from Binance REST API (fallback: CoinGecko)
2. Reads the on-chain pool-derived price via `getSpotPrice()` on the hook
3. Computes drift in **sqrt-price space** (0.5% sqrt drift ≈ 1% dollar drift)
4. If drift exceeds threshold → calls `PriceKeeper.syncPrice()` to push pool price toward market

**Included scripts:**

| Script | Purpose |
|---|---|
| `keeper.js` | Main sync loop |
| `pool-state-check.mjs` | Dumps poolId, slot0, active liquidity, tick bitmap |
| `setPythOracle.js` | Configures Pyth address + price feed ID on the hook |
| `pythCheckingScript.js` | Diagnostic — reads Pyth config from the contract |

> **Why the keeper matters:** The protocol's mark price (slot0) drives PnL, margin checks, and liquidations. Without the keeper, the on-chain price can stray far from market, creating unfair liquidations or arbitrage leakage.

---

### 3. Subgraph — Event Indexer (`subgraph/`)

A **The Graph / Goldsky** indexer that listens to on-chain events and exposes a **GraphQL API** for the frontends.

**Indexed events:**

- `PositionOpened` / `PositionClosed`
- `MarginAdded` / `MarginRemoved`
- `Liquidated`
- `FundingUpdated`

**Derived GraphQL entities:**

| Entity | Description |
|---|---|
| `Position` | Current open position state mirror |
| `Trade` | Full trade history per trader |
| `Liquidation` | Liquidation events feed |
| `FundingUpdate` | Historical funding rate snapshots |
| `MarginEvent` | Add/remove margin history |
| `ProtocolStat` | Aggregate protocol counters |

**Hybrid read strategy (used by both frontends):**

- **Live on-chain reads** (viem/wagmi) → real-time price, funding rate, balances
- **Subgraph queries** → history, liquidations feed, protocol stats dashboard

---

### 4. Mobile App (`mobile/`)

An **Expo React Native** app (iOS + Android).

**Stack:**

| Concern | Library |
|---|---|
| Wallet auth | WalletConnect / RainbowKit |
| On-chain reads/writes | viem + wagmi |
| State management | Zustand |
| Server/API data | React Query |
| Language | TypeScript |

**Key flows:**
- `useTrade` hook wraps `openPosition` / `closePosition` — handles USDC allowance check + approve automatically before writing
- Price service normalizes `sqrtPriceX96` → human-readable ETH/USD (handles WETH token0 / USDC token1 inversion)

---

### 5. Web App (`web/`)

A parallel **Vite + React + TypeScript** web frontend with feature parity to mobile.

**Design system:**
- True-black background (`#0a0a0a`), teal accent (`#00d4a1`)
- CSS custom properties + utility class architecture
- Components: `PriceChart`, `LeverageSlider`, `MarginInput`, `WalletButton`
- Pages: `TradePage`, `PortfolioPage`, `PositionsPage`, `LiquidationsPage`

---

## Full Data Flow

```
Trader (mobile / web)
        │
        ▼
ThaHtayHook.sol  ◄──────── Uniswap v4 PoolManager (slot0 mark price)
        │
        ├──► PositionManager.sol      (position CRUD, funding index snapshot)
        ├──► FundingRateManager.sol   (hourly funding index updates)
        └──► LiquidationEngine.sol    (5% bonus liquidations)
        │
        ▼
   On-chain Events
        │
        ▼
The Graph Subgraph  ──► GraphQL API  ──► Frontends (history / analytics)

Off-chain Keeper (Node.js)
  Binance / CoinGecko price feed
        │
        ▼
  PriceKeeper.syncPrice()  ──► Uniswap v4 pool (drift correction)
```

---

## Position Lifecycle

### Open
1. Trader submits `side` (long/short), `size`, `leverage`, optional `referrer`
2. Hook validates leverage limits and existing position status
3. Computes required margin + 0.1% fee (20% of fee → referrer if set)
4. Transfers USDC from trader into protocol vault
5. Snapshots current slot0 price and funding index
6. Writes position into `PositionManager`
7. Emits `PositionOpened`

### During
- Funding accumulates hourly via `FundingRateManager`
- Liquidation watchlist scanned on every pool swap (`afterSwap` callback)
- User can `addMargin` or `removeMargin` at any time

### Close
1. Hook reads current slot0 price
2. Calculates unrealized PnL + funding owed since entry
3. Computes net settlement and transfers USDC accordingly
4. Removes position from `PositionManager`
5. Emits `PositionClosed`

### Liquidation
1. Any caller triggers `liquidate(trader)`
2. `LiquidationEngine` checks if margin ratio is below threshold
3. Per-block cooldown check prevents spam liquidations
4. **5%** of position value → liquidator
5. Remainder → treasury
6. Position removed, `Liquidated` event emitted

---

## Oracle Architecture

### Current (slot0)

```
mark price  = _getSpotPrice(poolKey)  ← Uniswap v4 slot0
index price = _resolveIndexPrice()
              Priority: ① Pyth  →  ② keeper-fed indexPrice (15-min TTL)  →  ③ slot0 fallback
```

Mark price (used for PnL, margin, liquidations) comes from slot0. Index price (used only for funding rate calculation) preferentially uses Pyth.

### Pyth Integration (optional)

| Config | Value |
|---|---|
| Pyth address (Unichain Sepolia) | `0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a` |
| ETH/USD price feed ID | `0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace` |
| Default max age | 60 seconds |
| Admin function | `setPythConfig(oracle, priceId, maxAge)` |

---

## Key Technical Nuances

- **Hook address mining**: The hook contract address must be mined so its lower bits match required Uniswap v4 hook flags (`beforeSwap`, `afterSwap`, `beforeInitialize`, `afterInitialize`). The deploy script uses `HookMiner`.
- **Price orientation**: WETH is token0, USDC is token1. `sqrtPriceX96` produces an inverted price in some code paths; `PriceLib` and the mobile price service normalize all values to human-readable ETH/USD.
- **Funding formula**: `funding_owed = (currentIndex − entryIndex) × positionSize`. Long and short indices tracked separately to allow divergent funding rates.
- **sqrt-price drift**: Keeper uses sqrt-price space for threshold comparison — a 0.5% sqrt drift is approximately 1% dollar price drift.
- **USDC decimals**: All collateral accounting is in 6-decimal USDC; size/price math uses higher precision internally to avoid truncation.

---

## Tech Stack Summary

| Layer | Stack |
|---|---|
| Smart contracts | Solidity 0.8.26, Foundry, Uniswap v4 core + periphery, OpenZeppelin |
| Chain | Unichain (Uniswap L2), Unichain Sepolia testnet |
| Indexer | The Graph / Goldsky, AssemblyScript mappings |
| Keeper | Node.js, viem, Binance REST API |
| Mobile | Expo, React Native, wagmi, viem, Zustand, React Query |
| Web | Vite, React, TypeScript, wagmi, viem, Zustand |
| Oracle (optional) | Pyth Network (ETH/USD feed) |
