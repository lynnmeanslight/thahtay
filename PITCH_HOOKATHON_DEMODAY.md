# ThaHtay - Uniswap Hook Incubator Pitch Pack

This document is a ready-to-use pitch package for Hookathon + Demo Day.
It is tailored to the current stack (Uniswap v4 hook + Base Sepolia deployment + web/mobile + subgraph + keeper).

## 1) One-Liners

### 8-second one-liner
ThaHtay is a perp trading protocol built as a Uniswap v4 hook, turning swap flow into real-time funding and liquidation logic with USDC-collateralized isolated margin.

### 30-second elevator pitch
Perpetual futures are usually built as standalone exchanges with separate oracle and matching complexity. ThaHtay takes a different path: we use Uniswap v4 as the execution and price foundation, and run perp risk logic inside a custom hook architecture. The system combines PositionManager, FundingRateManager, and LiquidationEngine with a keeper and subgraph, giving traders simple 1x to 10x isolated leverage and giving LP ecosystems a composable perp primitive.

## 2) Pitch Narrative (What to say)

### Problem
- Most perp venues are siloed and monolithic.
- Integrating perp logic into composable AMM flow is still early.
- Retail users need simpler risk controls and transparent settlement.

### Solution
- A Uniswap v4-native hook protocol for perps.
- USDC collateral and isolated margin for cleaner risk accounting.
- Hook-mediated funding updates and liquidation checks tied to market activity.
- Mobile + web UX and indexed data layer for practical usage.

### Why this is a hook (and not just another perp app)
- Core behavior lives in hook-driven lifecycle and v4 pool context.
- Price and state flow are linked to pool mechanics.
- Funding and liquidation orchestration is designed around hook-triggered activity.

### Why now
- Uniswap v4 unlocks programmable pool logic.
- Teams that prove credible hook-based market design early can own a new category.
- Base ecosystem has strong builder momentum and user distribution.

## 3) 10-Slide Deck Structure

## Slide 1 - Title
- ThaHtay: Perpetual Futures as a Uniswap v4 Hook
- Team name + logos + contact
- Tagline: Composable perps built directly around pool-native logic

## Slide 2 - Market Pain
- Perp infra is fragmented
- Complex risk engines are opaque to users
- Hard to compose with AMM-native ecosystems

## Slide 3 - Product
- Open/close long/short positions
- Add/remove margin
- Liquidate under-collateralized accounts
- Mobile and web interfaces

## Slide 4 - Architecture
- Uniswap v4 pool and hook
- PositionManager, FundingRateManager, LiquidationEngine
- Keeper sync path and subgraph indexing
- Explain each in one line

## Slide 5 - Why Our Hook Is Different
- Hook-aware lifecycle design (funding + liquidation checks)
- Isolated margin risk model (1x to 10x)
- USDC collateral for simpler accounting
- Practical operator stack: keeper + indexer + dual frontend

## Slide 6 - Demo Evidence
- Live open position
- Real-time price updates
- Funding index updates
- Liquidation path
- Close and settlement

## Slide 7 - Traction (replace with your exact numbers)
- Users tested: [X]
- Positions opened: [X]
- Notional volume: [X]
- Keeper uptime: [X%]
- Subgraph indexed events: [X]

## Slide 8 - Security and Risk
- AccessControl role boundaries
- Reentrancy protections
- Isolated margin model
- Liquidation safeguards and cooldown behavior
- Known edge cases and mitigations

## Slide 9 - Roadmap
- Next 30 days: hardened testing + bug bounty scope
- Next 60 days: better liquidation network + analytics
- Next 90 days: partner integrations + grad-to-mainnet criteria

## Slide 10 - Ask
- Looking for: grants, design partners, and audits
- Pilot partners: LP and market-maker collaborators
- Contact + QR for repo/demo

## 4) 3-Minute Demo Day Script (Timed)

### 0:00-0:25 - Hook
"Perps today are mostly standalone venues. We asked: what if perp risk logic could be built around Uniswap v4 hook architecture so it is composable from day one?"

### 0:25-0:55 - What we built
"ThaHtay is a USDC-collateralized isolated-margin perp protocol with 1x to 10x leverage. We built the on-chain stack plus keeper, subgraph, and mobile/web clients."

### 0:55-1:30 - Why the architecture matters
"Our hook-centric flow orchestrates position lifecycle with dedicated manager contracts: PositionManager for state, FundingRateManager for index accounting, and LiquidationEngine for solvency actions. This gives clean separation while preserving hook-driven behavior."

### 1:30-2:20 - Live proof
"In this demo, I open a position, show live mark-price updates, inspect margin and funding state, then close. We also show liquidation readiness when margin safety drops. Everything is observable via on-chain events and indexed in the subgraph."

### 2:20-2:45 - Why this can win
"This is not only a hook experiment; it is a usable market primitive with execution path, risk controls, and client UX already running on Base Sepolia."

### 2:45-3:00 - Ask
"We are looking for audit support, grant collaboration, and LP design partners to move from testnet proof to production rollout."

## 5) 7-Minute Live Demo Runbook

## Demo prep checklist
- Wallet on Base Sepolia with test ETH + test USDC
- Correct addresses loaded in frontend
- Subgraph endpoint responsive
- Keeper health check passing
- A fallback prerecorded video ready

## Demo flow
1. Show architecture slide (30s)
2. Connect wallet on web/mobile (30s)
3. Open a long position (60s)
4. Show position details and funding index view (60s)
5. Add/remove margin (45s)
6. Show liquidation candidate logic or explain threshold path (60s)
7. Close position and show settlement + events/subgraph update (75s)
8. Close with roadmap and ask (40s)

## Backup flow if tx is slow
- Use already-open position prepared 10 minutes before demo
- Switch to read-only walkthrough of historical tx hashes
- Show subgraph events and decoded contract state

## 6) Judges/Investor Q&A Bank

## Q1: Why does this need v4 hooks?
A: Hooks let us design behavior around pool-native lifecycle and custom logic surfaces that are difficult in v3-style static pools. Our architecture is purpose-built for programmable market mechanics.

## Q2: Where is your edge versus existing perp DEXes?
A: We are building a hook-native perp primitive with modular managers, not a monolithic exchange clone. The objective is composability + transparent risk logic + easy integration paths.

## Q3: How do you handle oracle risk?
A: Core pricing uses pool-derived market data. We also operate a keeper path for drift control. We explicitly track orientation/normalization and guardrail checks.

## Q4: What are your biggest technical risks now?
A: Liquidation liveness and edge-case market stress behavior. We mitigate with modular risk controls, testing expansion, and dedicated keeper/liquidator operations.

## Q5: What does success in 3 months look like?
A: Stable testnet KPIs, external audit progress, partner pilot integrations, and clear criteria for mainnet readiness.

## 7) Submission Copy You Can Paste

### 280-character version
ThaHtay is a Uniswap v4 hook-based perp protocol on Base Sepolia with USDC collateral, isolated margin, funding and liquidation engines, keeper-assisted price sync, and web/mobile UX. We are building a composable perp primitive, not a siloed venue.

### 100-word version
ThaHtay is a production-oriented perpetual futures protocol designed around Uniswap v4 hook architecture. It combines a hook orchestrator with PositionManager, FundingRateManager, and LiquidationEngine to support isolated margin long/short trading from 1x to 10x leverage. The system includes keeper infrastructure for price-sync operations, subgraph indexing for analytics and history, and both web and mobile clients for user access. Built on Base Sepolia, ThaHtay demonstrates how programmable pools can power transparent, composable risk-managed derivatives. We are preparing for audit hardening, partner pilots, and ecosystem integration to transition from testnet validation to broader deployment.

## 8) What to Prepare Before Demo Day
- 3 strongest proof points with exact metrics
- 1 architecture diagram and 1 risk model slide
- 1 clean end-to-end tx demo under weak network conditions
- 3 clear asks: grant, audit, pilot partner
- 1-line answer to: "Why your hook wins this cohort?"

## 9) Replace-These-Now Fields
- Team members + background
- Exact traction metrics (users, trades, volume, uptime)
- Links: repo, live app, demo video, subgraph endpoint, explorer tx
- Specific grant amount or support requested
- Timeline dates and milestones

## 10) Optional Closing Line
"We believe the next generation of perps will be programmable, composable, and pool-native. ThaHtay is our proof that Uniswap v4 hooks can deliver that future."
