
import { colors } from '../theme/colors';

interface LeverageSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

const SNAP_POINTS = [1, 2, 3, 5, 7, 10];

export function LeverageSlider({ value, onChange, min = 1, max = 10 }: LeverageSliderProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: colors.textSecondary, fontSize: 12 }}>Leverage</span>
        <span style={{ color: colors.primary, fontWeight: 700, fontSize: 14 }}>{value}x</span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={0.5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', cursor: 'pointer' }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {SNAP_POINTS.map((snap) => (
          <button
            key={snap}
            onClick={() => onChange(snap)}
            style={{
              background: value === snap ? colors.primary : colors.bgHighlight,
              color: value === snap ? colors.bg : colors.textSecondary,
              border: 'none',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {snap}x
          </button>
        ))}
      </div>
    </div>
  );
}
