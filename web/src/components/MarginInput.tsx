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
    if (usdcBalance != null) onChangeText((Number(usdcBalance) / 1e6).toFixed(2));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="label">{label}</span>
        {usdcBalance != null && (
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
            Bal: {formatUSD(usdcBalance, 6)}
          </span>
        )}
      </div>

      <div className={`input-wrap${error ? ' has-error' : ''}`}>
        <input
          className="input"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={value}
          onChange={(e) => onChangeText(e.target.value)}
        />
        <span style={{ padding: '0 8px', fontSize: 12, color: 'var(--text-2)' }}>USDC</span>
        {usdcBalance != null && (
          <button
            onClick={handleMax}
            style={{
              background: 'transparent',
              border: 'none',
              color: colors.accent,
              fontSize: 10,
              fontWeight: 700,
              padding: '0 12px 0 4px',
              cursor: 'pointer',
              letterSpacing: '0.5px',
              fontFamily: 'inherit',
            }}
          >
            MAX
          </button>
        )}
      </div>

      {error && <span style={{ fontSize: 11, color: colors.loss }}>{error}</span>}
    </div>
  );
}
