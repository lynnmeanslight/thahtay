const USD_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PRICE_FORMATTER = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const COMPACT_FORMATTER = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 2,
});

export function formatUSD(value: bigint, decimals: number = 6): string {
  const divisor = 10 ** decimals;
  const num = Number(value) / divisor;
  return USD_FORMATTER.format(num);
}

export function formatPrice(value: bigint | undefined | null): string {
  if (value === undefined || value === null) return '--';
  if (value === 0n) return '--';
  // Contract returns price as ETH-per-USDC (inverted) with 18 decimals;
  // invert to get the human-readable USDC-per-ETH price.
  const num = 1e18 / Number(value);
  return PRICE_FORMATTER.format(num);
}

export function formatCompact(value: bigint, decimals: number = 18): string {
  const num = Number(value) / 10 ** decimals;
  return COMPACT_FORMATTER.format(num);
}

export function formatPnl(pnl: bigint): string {
  const num = Number(pnl) / 1e18;
  const prefix = pnl >= 0n ? '+' : '';
  return `${prefix}${USD_FORMATTER.format(num)}`;
}

export function formatPercent(value: number, decimals: number = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatLeverage(leverage: number): string {
  return `${leverage}x`;
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function parseUsdcToInternal(value: string): bigint {
  if (!value || value === '.') return 0n;
  try {
    const [integer = '0', fraction = '0'] = value.split('.');
    const fractionPadded = fraction.padEnd(18, '0').slice(0, 18);
    return BigInt(integer) * BigInt(10 ** 18) + BigInt(fractionPadded);
  } catch {
    return 0n;
  }
}

export function parseUsdcToTransfer(value: string): bigint {
  if (!value || value === '.') return 0n;
  try {
    const [integer = '0', fraction = '0'] = value.split('.');
    const fractionPadded = fraction.padEnd(6, '0').slice(0, 6);
    return BigInt(integer) * 1_000_000n + BigInt(fractionPadded);
  } catch {
    return 0n;
  }
}

export function usdcToInternal(amount: bigint): bigint {
  return amount * BigInt(10 ** 12);
}

export function internalToUsdc(amount: bigint): bigint {
  return amount / BigInt(10 ** 12);
}
