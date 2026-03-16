// ─── Number Formatting ────────────────────────────────────────────────────────

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

/**
 * Format a bigint with given decimals as a USD string.
 * e.g. formatUSD(3000_000000n, 6) → "$3,000.00"
 */
export function formatUSD(value: bigint, decimals: number = 6): string {
  const divisor = 10 ** decimals;
  const num = Number(value) / divisor;
  return USD_FORMATTER.format(num);
}

/**
 * Format a bigint (18 decimals) as a price.
 * e.g. formatPrice(3000n * 10n**18n) → "3,000.00"
 */
export function formatPrice(value: bigint | undefined | null): string {
  if (value === undefined || value === null) return '–';
  const num = Number(value) / 1e18;
  return PRICE_FORMATTER.format(num);
}

/**
 * Format a bigint (18 decimals) as a compact number.
 * e.g. formatCompact(1_500_000n * 10n**18n) → "1.5M"
 */
export function formatCompact(value: bigint, decimals: number = 18): string {
  const num = Number(value) / 10 ** decimals;
  return COMPACT_FORMATTER.format(num);
}

/**
 * Format a signed bigint PnL (18 decimals) with +/- prefix.
 */
export function formatPnl(pnl: bigint): string {
  const num = Number(pnl) / 1e18;
  const prefix = pnl >= 0n ? '+' : '';
  return `${prefix}${USD_FORMATTER.format(num)}`;
}

/**
 * Format percentage (0.05 → "5.00%").
 */
export function formatPercent(value: number, decimals: number = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format a leverage value.
 */
export function formatLeverage(leverage: number): string {
  return `${leverage}×`;
}

/**
 * Shorten an Ethereum address.
 */
export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Parse a human-readable USDC string to bigint with 18 internal decimals.
 * e.g. "100.50" → 100500000000000000000n
 */
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

/**
 * Parse a human-readable USDC string to bigint with 6 decimals (ERC20 transfer).
 */
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

/**
 * Convert 6-decimal USDC bigint to 18-decimal internal bigint.
 */
export function usdcToInternal(amount: bigint): bigint {
  return amount * BigInt(10 ** 12);
}

/**
 * Convert 18-decimal internal bigint to 6-decimal USDC bigint.
 */
export function internalToUsdc(amount: bigint): bigint {
  return amount / BigInt(10 ** 12);
}
