
import { colors } from '../theme/colors';
import { formatPnl } from '../utils/formatting';

interface PnLDisplayProps {
  pnl: bigint;
  pnlPercent?: number;
  size?: 'sm' | 'md' | 'lg';
}

export function PnLDisplay({ pnl, pnlPercent, size = 'md' }: PnLDisplayProps) {
  const isProfit = pnl >= 0n;
  const color = isProfit ? colors.profit : colors.loss;
  const fontSize = size === 'sm' ? 12 : size === 'lg' ? 22 : 14;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ color, fontSize, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {formatPnl(pnl)}
      </span>
      {pnlPercent !== undefined && (
        <span style={{ color, fontSize: fontSize - 1, fontVariantNumeric: 'tabular-nums' }}>
          ({isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%)
        </span>
      )}
    </span>
  );
}
