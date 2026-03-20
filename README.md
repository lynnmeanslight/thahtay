# ThaHtay — Perpetual Futures on Uniswap v4

> Built for the Uniswap Hook Incubator / Hookathon · Deployed on **Unichain Sepolia**

ThaHtay is a **decentralized perpetual futures exchange** implemented entirely as a **Uniswap v4 Hook**. Traders take leveraged long/short ETH/USD positions — no centralized orderbook, no separate oracle contract required. A live Uniswap v4 ETH/USDC pool is the price source and liquidity layer simultaneously.

**The core insight:** a v4 Hook can intercept every swap in a pool. ThaHtay exploits this to read a fresh `slot0` mark price on every swap, trigger funding rate updates, and scan liquidation eligibility — all within the swap callback, with zero additional infrastructure on-chain.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        UNICHAIN                              │
│                                                             │
│   ┌──────────────────────────────────────────────────────┐  │
│   │              Uniswap v4 PoolManager                  │  │
│   │    (ETH/USDC pool — price discovery + liquidity)     │  │
│   └──────────────────────┬───────────────────────────────┘  │
│                          │  hook callbacks                   │
│   ┌──────────────────────▼───────────────────────────────┐  │
│   │               ThaHtayHook.sol                        │  │
│   │   beforeSwap / afterSwap / beforeInit / afterInit    │  │
│   │   • opens / closes positions                         │  │
│   │   • reads slot0 price per-block                      │  │
│   │   • triggers funding rate updates                    │  │
│   │   • triggers liquidation checks                      │  │
│   └──────────┬──────────────┬────────────────────────────┘  │
│              │              │                                │
│   ┌──────────▼──┐  ┌────────▼──────────┐  ┌─────────────┐  │
│   │ PositionMgr │  │FundingRateManager │  │Liquidation  │  │
│   │  .sol       │  │     .sol          │  │Engine.sol   │  │
│   └─────────────┘  └───────────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────┘

         on-chain events ───► The Graph Subgraph
                                      │
                              GraphQL API
                                      │
                       ┌──────────────▼────────────┐
                       │   React Native (Expo) App  │
                       │   iOS + Android            │
                       │   WalletConnect / Rainbow  │
                       └────────────────────────────┘
```

### Key Design Choices

| Decision | Choice | Rationale |
|---|---|---|
| Collateral | USDC | Stable, simple PnL math |
| AMM / Price | Uniswap v4 `slot0` + TWAP | No separate oracle needed |
| Leverage | 1×–10× | Manageable risk for v1 |
| Margin | Isolated per position | Simple accounting |
| Liquidation bonus | 5% | Incentivises liquidation bots |
| Trading fee | 0.1% (10 bps) | Protocol revenue |
| Referral fee | 20% of protocol fee | Growth incentive |

---

## Repository Structure

```
thahtay/
├── contracts/              # Foundry smart contracts
│   ├── src/
│   │   ├── ThaHtayHook.sol
│   │   ├── PositionManager.sol
│   │   ├── FundingRateManager.sol
│   │   ├── LiquidationEngine.sol
│   │   ├── interfaces/
│   │   └── libraries/
│   ├── test/
│   ├── script/
│   └── foundry.toml
│
├── subgraph/               # The Graph indexer
│   ├── schema.graphql
│   ├── subgraph.yaml
│   └── src/mapping.ts
│
└── mobile/                 # React Native (Expo) app
    └── src/
        ├── components/
        ├── screens/
        ├── hooks/
        ├── contracts/
        ├── store/
        ├── services/
        └── utils/
```

---

## Quick Start

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) installed
- [Node.js](https://nodejs.org) v20+
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npm i -g expo-cli eas-cli`)

### 1 — Smart Contracts

```bash
cd contracts

# Install dependencies
forge install

# Compile
forge build

# Run tests
forge test -vvv

# Deploy to Unichain Sepolia
cp ../.env.example ../.env
# Fill in your private key + RPC URL in .env
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $UNICHAIN_SEPOLIA_RPC \
  --private-key $PRIVATE_KEY \
  --broadcast --verify
```

### 2 — Subgraph

```bash
cd subgraph

npm install

# Authenticate with Goldsky or The Graph Studio
goldsky login    # or graph auth --studio <key>

# Deploy
goldsky subgraph deploy thahtay-hook/1.0.0 --from-abi .
# or
graph deploy --studio thahtay-hook
```

### 3 — Mobile App

```bash
cd mobile

npm install

# Copy env template
cp .env.example .env
# Fill in WalletConnect project ID + subgraph URL

# iOS simulator
npx expo start --ios

# Android emulator
npx expo start --android

# Production build
eas build --platform all
```

---

## Contract Addresses

### Unichain Sepolia (Chain ID: 1301)

| Contract | Address |
|---|---|
| `ThaHtayHook` | [`0xAB307e812680b93E32BF23126e8a11924ea2B0C0`](https://sepolia.uniscan.xyz/address/0xAB307e812680b93E32BF23126e8a11924ea2B0C0) |
| `PositionManager` | [`0x8d1D1bf157477B95cee7Ba54E2DF585ecd970019`](https://sepolia.uniscan.xyz/address/0x8d1D1bf157477B95cee7Ba54E2DF585ecd970019) |
| `FundingRateManager` | [`0xC73D840622Dc2eA97f7fd981Ea4Ce8b88617Bf29`](https://sepolia.uniscan.xyz/address/0xC73D840622Dc2eA97f7fd981Ea4Ce8b88617Bf29) |
| `LiquidationEngine` | [`0x88b11E2A5194F42D26D68f3Fe78436b99524922c`](https://sepolia.uniscan.xyz/address/0x88b11E2A5194F42D26D68f3Fe78436b99524922c) |
| `PriceKeeper` | [`0xFCB7d8C8efBC89dcd8E39a721F69933438EF01A3`](https://sepolia.uniscan.xyz/address/0xFCB7d8C8efBC89dcd8E39a721F69933438EF01A3) |
| `Treasury` | [`0x53A85148F287835CAF6f66E6a8eD27f2c4c0f722`](https://sepolia.uniscan.xyz/address/0x53A85148F287835CAF6f66E6a8eD27f2c4c0f722) |
| `USDC (mock)` | [`0x631FEDecA55Aa01aD5844E94ecB604caF29bfdb4`](https://sepolia.uniscan.xyz/address/0x631FEDecA55Aa01aD5844E94ecB604caF29bfdb4) |
| `WETH (mock)` | [`0xAb69B88033A540442D9FD8A64e8Db8302297572d`](https://sepolia.uniscan.xyz/address/0xAb69B88033A540442D9FD8A64e8Db8302297572d) |
| `PoolManager (v4)` | [`0x00B036B58a818B1BC34d502D3fE730Db729e62AC`](https://sepolia.uniscan.xyz/address/0x00B036B58a818B1BC34d502D3fE730Db729e62AC) |

Pyth oracle: `0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a`  
ETH/USD feed ID: `0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace`  
Hook mining salt: `0x000...7bda`

---

## Funding Rate

```
fundingRate = k × (markPrice − indexPrice)

k = 0.0001 per hour (1 basis point per 1% deviation)

Positive funding → longs pay shorts
Negative funding → shorts pay longs
```

Funding updates every **1 hour** and is settled when a position is opened, closed, or margin is adjusted.

## Liquidation

```
marginRatio = margin / (size / leverage) × 100

Liquidated when marginRatio < 5%  (maintenance margin)

Liquidator receives: 5% of remaining position value
Protocol treasury:   remaining margin after bonus + debt settlement
```

## PnL Calculation

```
Long:  PnL = size × (currentPrice − entryPrice) / entryPrice − fundingOwed
Short: PnL = size × (entryPrice − currentPrice) / entryPrice − fundingOwed
```

---

## Security

- OpenZeppelin `ReentrancyGuard` on all state-changing functions
- OpenZeppelin `AccessControl` — only ThaHtayHook can write to PositionManager
- OpenZeppelin `SafeERC20` for all token transfers
- `unchecked` blocks only used where overflow is mathematically impossible
- Liquidation cooldown: minimum 1 block between liquidation checks per position
- No flash-loan vulnerability: margin must be deposited before position opens

## License

MIT
