const SUBGRAPH_URL =
  import.meta.env.VITE_SUBGRAPH_URL ?? 'https://api.goldsky.com/api/public/project_cmmhgxyrkhhn501w826759k1v/subgraphs/thahtay-hook/1.0.0/gn';

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

export async function fetchTraderHistory(trader: string): Promise<GqlTrade[]> {
  const data = await gql<{ trades: GqlTrade[] }>(
    `query TraderHistory($trader: Bytes!, $skip: Int!) {
      trades(
        where: { trader: $trader }
        orderBy: timestamp
        orderDirection: desc
        first: 50
        skip: $skip
      ) {
        id type isLong size price leverage timestamp txHash
      }
    }`,
    { trader: trader.toLowerCase(), skip: 0 },
  );
  return data.trades;
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
