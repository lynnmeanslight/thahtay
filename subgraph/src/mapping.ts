import {
  PositionOpened,
  PositionClosed,
  MarginAdded,
  MarginRemoved,
  Liquidated,
  FundingUpdated,
} from "../generated/ThaHtayHook/ThaHtayHook";
import {
  Position,
  Trade,
  Liquidation,
  FundingUpdate,
  MarginEvent,
  ProtocolStat,
} from "../generated/schema";
import { BigInt, Bytes } from "@graphprotocol/graph-ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getOrCreateProtocolStat(): ProtocolStat {
  let stat = ProtocolStat.load("global");
  if (!stat) {
    stat = new ProtocolStat("global");
    stat.totalVolumeUSD = BigInt.fromI32(0);
    stat.totalPositionsOpened = BigInt.fromI32(0);
    stat.totalPositionsClosed = BigInt.fromI32(0);
    stat.totalLiquidations = BigInt.fromI32(0);
    stat.totalFeesCollected = BigInt.fromI32(0);
    stat.updatedAt = BigInt.fromI32(0);
  }
  return stat;
}

// ─── Event Handlers ───────────────────────────────────────────────────────────

export function handlePositionOpened(event: PositionOpened): void {
  let id = event.params.trader.toHexString();
  let position = new Position(id);

  position.trader = event.params.trader;
  position.isLong = event.params.isLong;
  position.size = event.params.size;
  position.margin = event.params.margin;
  position.entryPrice = event.params.entryPrice;
  position.leverage = event.params.leverage;
  position.liquidationPrice = event.params.liquidationPrice;
  position.referrer =
    event.params.referrer == Bytes.fromHexString("0x0000000000000000000000000000000000000000")
      ? null
      : event.params.referrer;
  position.status = "open";
  position.openedAt = event.block.timestamp;
  position.closedAt = null;
  position.realizedPnl = null;
  position.exitPrice = null;
  position.fundingPaid = null;
  position.openTx = event.transaction.hash;
  position.closeTx = null;

  position.save();

  // Record trade
  let tradeId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let trade = new Trade(tradeId);
  trade.trader = event.params.trader;
  trade.type = "open";
  trade.isLong = event.params.isLong;
  trade.size = event.params.size;
  trade.price = event.params.entryPrice;
  trade.leverage = event.params.leverage;
  trade.fee = null;
  trade.timestamp = event.block.timestamp;
  trade.blockNumber = event.block.number;
  trade.txHash = event.transaction.hash;
  trade.save();

  // Update stats
  let stat = getOrCreateProtocolStat();
  stat.totalPositionsOpened = stat.totalPositionsOpened.plus(BigInt.fromI32(1));
  stat.totalVolumeUSD = stat.totalVolumeUSD.plus(event.params.size);
  stat.updatedAt = event.block.timestamp;
  stat.save();
}

export function handlePositionClosed(event: PositionClosed): void {
  let id = event.params.trader.toHexString();
  let position = Position.load(id);
  if (!position) return;

  position.status = "closed";
  position.closedAt = event.block.timestamp;
  position.exitPrice = event.params.exitPrice;
  position.realizedPnl = event.params.realizedPnl;
  position.fundingPaid = event.params.fundingPaid;
  position.closeTx = event.transaction.hash;
  position.save();

  // Record trade
  let tradeId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let trade = new Trade(tradeId);
  trade.trader = event.params.trader;
  trade.type = "close";
  trade.isLong = position.isLong;
  trade.size = position.size;
  trade.price = event.params.exitPrice;
  trade.leverage = position.leverage;
  trade.fee = null;
  trade.timestamp = event.block.timestamp;
  trade.blockNumber = event.block.number;
  trade.txHash = event.transaction.hash;
  trade.save();

  // Update stats
  let stat = getOrCreateProtocolStat();
  stat.totalPositionsClosed = stat.totalPositionsClosed.plus(BigInt.fromI32(1));
  stat.updatedAt = event.block.timestamp;
  stat.save();
}

export function handleMarginAdded(event: MarginAdded): void {
  let id = event.params.trader.toHexString();
  let position = Position.load(id);
  if (position) {
    position.margin = position.margin.plus(event.params.amount);
    position.save();
  }

  let marginId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let marginEvent = new MarginEvent(marginId);
  marginEvent.trader = event.params.trader;
  marginEvent.type = "add";
  marginEvent.amount = event.params.amount;
  marginEvent.timestamp = event.block.timestamp;
  marginEvent.blockNumber = event.block.number;
  marginEvent.txHash = event.transaction.hash;
  marginEvent.save();
}

export function handleMarginRemoved(event: MarginRemoved): void {
  let id = event.params.trader.toHexString();
  let position = Position.load(id);
  if (position) {
    position.margin = position.margin.minus(event.params.amount);
    position.save();
  }

  let marginId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let marginEvent = new MarginEvent(marginId);
  marginEvent.trader = event.params.trader;
  marginEvent.type = "remove";
  marginEvent.amount = event.params.amount;
  marginEvent.timestamp = event.block.timestamp;
  marginEvent.blockNumber = event.block.number;
  marginEvent.txHash = event.transaction.hash;
  marginEvent.save();
}

export function handleLiquidated(event: Liquidated): void {
  let id = event.params.trader.toHexString();
  let position = Position.load(id);
  if (position) {
    position.status = "liquidated";
    position.closedAt = event.block.timestamp;
    position.exitPrice = event.params.liquidationPrice;
    position.closeTx = event.transaction.hash;
    position.save();
  }

  let liqId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let liquidation = new Liquidation(liqId);
  liquidation.trader = event.params.trader;
  liquidation.liquidator = event.params.liquidator;
  liquidation.liquidationPrice = event.params.liquidationPrice;
  liquidation.bonus = event.params.bonus;
  liquidation.timestamp = event.block.timestamp;
  liquidation.blockNumber = event.block.number;
  liquidation.txHash = event.transaction.hash;
  liquidation.save();

  let stat = getOrCreateProtocolStat();
  stat.totalLiquidations = stat.totalLiquidations.plus(BigInt.fromI32(1));
  stat.updatedAt = event.block.timestamp;
  stat.save();
}

export function handleFundingUpdated(event: FundingUpdated): void {
  let stat = getOrCreateProtocolStat();
  let id = stat.totalPositionsOpened.toString() + "-" + event.block.number.toString();

  let funding = new FundingUpdate(id);
  funding.fundingRate = event.params.fundingRate;
  funding.longCumulativeIndex = event.params.longCumulativeIndex;
  funding.shortCumulativeIndex = event.params.shortCumulativeIndex;
  funding.timestamp = event.block.timestamp;
  funding.blockNumber = event.block.number;
  funding.save();
}
