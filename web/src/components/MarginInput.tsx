
import { colors } from '../theme/colors';
import { formatUSD } from '../utils/formatting';

interface MarginInputProps {
  value: string;
  onChangeText: (v: string) => void;
  usdcBalance?: bigint;
  label?: string;
  error?: string;
}

export function MarginInput({
  value,
  onChangeText,
  usdcBalance,
  label = 'Collateral',
  error,
}: MarginInputProps) {
  const handleMax = () => {
    if (!usdcBalance) return;
    onChangeText((Number(usdcBalance) / 1e6).toFixed(2));
  };

  const balanceStr = usdcBalance != null ? formatUSD(usdcBalance, 6) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: colors.textSecondary, fontSize: 12 }}>{label}</span>
        {balanceStr && (
          <span style={{ color: colors.textMuted, fontSize: 11 }}>Bal: {balanceStr}</span>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: colors.bgInput,
          border: `1px solid ${error ? colors.loss : colors.border}`,
          borderRadius: 10,
          padding: '0 12px',
          gap: 8,
        }}
      >
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(e) => onChangeText(e.target.value)}
          placeholder="0.00"
          style={{
            flex: 1,
            background: colors.bgInput,
            border: 'none',
            outline: 'none',
            color: colors.textPrimary,
            fontSize: 16,
            padding: '12px 0',
            fontVariantNumeric: 'tabular-nums',
            colorScheme: 'dark',
          }}
        />
        <span style={{ color: colors.textSecondary, fontSize: 13 }}>USDC</span>
        {usdcBalance != null && (
          <button
            onClick={handleMax}
            style={{
              background: colors.bgHighlight,
              border: 'none',
              borderRadius: 4,
              color: colors.primary,
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 6px',
              cursor: 'pointer',
              letterSpacing: '0.5px',
            }}
          >
            MAX
          </button>
        )}
      </div>

      {error && <span style={{ color: colors.loss, fontSize: 11 }}>{error}</span>}
    </div>
  );
}
