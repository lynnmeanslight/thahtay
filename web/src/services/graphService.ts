const SUBGRAPH_URL =
  import.meta.env.VITE_SUBGRAPH_URL ?? 'https://api.goldsky.com/api/public/project_cmmhgxyrkhhn501w826759k1v/subgraphs/thahtay-hook/1.0.0/gn';

import { getPublicClient } from '@wagmi/core';
import type { Address, PublicClient } from 'viem';
import { THAHTAYHOOK_ABI } from '../contracts/abis/ThaHtayHook';
import { getAddresses } from '../contracts/addresses';
import { wagmiConfig } from '../providers/config';

const DEFAULT_DEPLOY_BLOCK = 47_093_440n;

const toBigIntBlock = (value: string | undefined): bigint => {
  if (!value) return DEFAULT_DEPLOY_BLOCK;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? BigInt(parsed) : DEFAULT_DEPLOY_BLOCK;
};

const HOOK_DEPLOY_BLOCK = toBigIntBlock(import.meta.env.VITE_HOOK_DEPLOY_BLOCK);

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(SUBGRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GraphQL fetch failed: ${res.status}`);
  const json = await res.json() as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data as T;
}

export interface GqlPosition {
  id: string;
  trader: string;
  isLong: boolean;
  size: string;
  margin: string;
  entryPrice: string;
  leverage: string;
  liquidationPrice: string;
  status: string;
  openedAt: string;
  closedAt: string | null;
  realizedPnl: string | null;
  exitPrice: string | null;
  fundingPaid: string | null;
  referrer: string | null;
}

export interface GqlTrade {
  id: string;
  trader: string;
  type: string;
  isLong: boolean;
  size: string;
  price: string;
  leverage: string;
  timestamp: string;
  txHash: string;
  pnl?: string;
}

export interface GqlLiquidation {
  id: string;
  trader: string;
  liquidator: string;
  liquidationPrice: string;
  bonus: string;
  timestamp: string;
}

export interface GqlProtocolStat {
  totalVolumeUSD: string;
  totalPositionsOpened: string;
  totalPositionsClosed: string;
  totalLiquidations: string;
}

export async function fetchPosition(trader: string): Promise<GqlPosition | null> {
  const data = await gql<{ position: GqlPosition | null }>(
    `query Position($id: ID!) {
      position(id: $id) {
        id trader isLong size margin entryPrice leverage
        liquidationPrice status openedAt closedAt
        realizedPnl exitPrice fundingPaid referrer
      }
    }`,
    { id: trader.toLowerCase() },
  );
  return data.position;
}

export async function fetchTraderHistory(trader: string, chainId: number = 1301): Promise<GqlTrade[]> {
  try {
    const data = await gql<{ trades: GqlTrade[] }>(
      `query TraderHistory($trader: Bytes!, $skip: Int!) {
        trades(
          where: { trader: $trader }
          orderBy: timestamp
          orderDirection: desc
          first: 50
          skip: $skip
        ) {
          id trader type isLong size price leverage timestamp txHash
        }
      }`,
      { trader: trader.toLowerCase(), skip: 0 },
    );

    if (data.trades.length > 0) {
      return data.trades.map((t) => ({
        ...t,
        pnl: t.type === 'close' ? (t.pnl ?? '0') : '0',
      }));
    }
  } catch {
    // Fallback to on-chain logs when the subgraph is unavailable.
  }

  try {
    return await fetchTraderHistoryFromChain(trader, chainId);
  } catch {
    return [];
  }
}

async function blockTimestampMap(client: PublicClient, blocks: bigint[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(blocks.map((b) => b.toString()))).map((s) => BigInt(s));
  const entries = await Promise.all(unique.map(async (blockNumber) => {
    const block = await client.getBlock({ blockNumber });
    return [blockNumber.toString(), block.timestamp.toString()] as const;
  }));
  return new Map(entries);
}

async function fetchTraderHistoryFromChain(trader: string, chainId: number): Promise<GqlTrade[]> {
  const checksumTrader = trader as Address;
  const safeChainId = chainId === 130 ? 130 : 1301;
  const addresses = getAddresses(safeChainId);
  const client = getPublicClient(wagmiConfig, { chainId: safeChainId });

  if (!client) return [];

  const clientAny = client as any;

  const [openedLogs, closedLogs]: [any[], any[]] = await Promise.all([
    clientAny.getLogs({
      address: addresses.thaHtayHook,
      abi: THAHTAYHOOK_ABI,
      eventName: 'PositionOpened',
      args: { trader: checksumTrader },
      fromBlock: HOOK_DEPLOY_BLOCK,
      toBlock: 'latest',
    }),
    clientAny.getLogs({
      address: addresses.thaHtayHook,
      abi: THAHTAYHOOK_ABI,
      eventName: 'PositionClosed',
      args: { trader: checksumTrader },
      fromBlock: HOOK_DEPLOY_BLOCK,
      toBlock: 'latest',
    }),
  ]);

  type EventRow = {
    type: 'open' | 'close';
    blockNumber: bigint;
    logIndex: number;
    txHash: string;
    timestamp: string;
    isLong?: boolean;
    size?: string;
    leverage?: string;
    price: string;
    pnl?: string;
  };

  const rows: EventRow[] = [];

  for (const log of openedLogs) {
    if (!log.args.trader || log.blockNumber == null || log.logIndex == null || !log.transactionHash) continue;
    rows.push({
      type: 'open',
      blockNumber: log.blockNumber,
      logIndex: Number(log.logIndex),
      txHash: log.transactionHash,
      timestamp: '0',
      isLong: Boolean(log.args.isLong),
      size: (log.args.size ?? 0n).toString(),
      leverage: (log.args.leverage ?? 0n).toString(),
      price: (log.args.entryPrice ?? 0n).toString(),
      pnl: '0',
    });
  }

  for (const log of closedLogs) {
    if (!log.args.trader || log.blockNumber == null || log.logIndex == null || !log.transactionHash) continue;
    rows.push({
      type: 'close',
      blockNumber: log.blockNumber,
      logIndex: Number(log.logIndex),
      txHash: log.transactionHash,
      timestamp: '0',
      price: (log.args.exitPrice ?? 0n).toString(),
      pnl: (log.args.realizedPnl ?? 0n).toString(),
    });
  }

  if (rows.length === 0) return [];

  rows.sort((a, b) => {
    if (a.blockNumber === b.blockNumber) return b.logIndex - a.logIndex;
    return a.blockNumber > b.blockNumber ? -1 : 1;
  });

  // Keep only most recent entries for responsive UI and lower RPC overhead.
  const recentRows = rows.slice(0, 50);
  const tsMap = await blockTimestampMap(client, recentRows.map((r) => r.blockNumber));
  for (const row of recentRows) {
    row.timestamp = tsMap.get(row.blockNumber.toString()) ?? '0';
  }

  let lastSide = true;
  let lastSize = '0';
  let lastLeverage = '1';
  const normalized: GqlTrade[] = recentRows
    .slice()
    .reverse()
    .map((row) => {
    if (row.type === 'open') {
      lastSide = row.isLong ?? true;
      lastSize = row.size ?? '0';
      lastLeverage = row.leverage ?? '1';
    }

    return {
      id: `${row.txHash}-${row.logIndex}`,
      trader: trader.toLowerCase(),
      type: row.type,
      isLong: row.type === 'open' ? (row.isLong ?? true) : lastSide,
      size: row.type === 'open' ? (row.size ?? '0') : lastSize,
      price: row.price,
      leverage: row.type === 'open' ? (row.leverage ?? '1') : lastLeverage,
      timestamp: row.timestamp,
      txHash: row.txHash,
      pnl: row.type === 'close' ? (row.pnl ?? '0') : '0',
    };
    });

  return normalized.reverse();
}

export async function fetchLiquidations(first: number = 20): Promise<GqlLiquidation[]> {
  const data = await gql<{ liquidations: GqlLiquidation[] }>(
    `query Liquidations {
      liquidations(orderBy: timestamp orderDirection: desc first: ${first}) {
        id trader liquidator liquidationPrice bonus timestamp
      }
    }`,
  );
  return data.liquidations;
}

export async function fetchAtRiskPositions(): Promise<GqlPosition[]> {
  const data = await gql<{ positions: GqlPosition[] }>(
    `query AtRisk {
      positions(where: { status: "open" } first: 100) {
        id trader isLong size margin entryPrice leverage liquidationPrice status openedAt
      }
    }`,
  );
  return data.positions;
}

export async function fetchProtocolStats(): Promise<GqlProtocolStat> {
  const data = await gql<{ protocolStat: GqlProtocolStat }>(
    `query Stats {
      protocolStat(id: "global") {
        totalVolumeUSD totalPositionsOpened totalPositionsClosed totalLiquidations
      }
    }`,
  );
  return data.protocolStat ?? {
    totalVolumeUSD: '0',
    totalPositionsOpened: '0',
    totalPositionsClosed: '0',
    totalLiquidations: '0',
  };
}
