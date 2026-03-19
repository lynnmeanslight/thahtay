import { colors } from '../theme/colors';

interface LeverageSliderProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}

const SNAPS = [1, 2, 3, 5, 7, 10];

export function LeverageSlider({ value, onChange, min = 1, max = 10 }: LeverageSliderProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="label">Leverage</span>
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.5px', color: colors.accent }}>
          {value}×
        </span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />

      <div style={{ display: 'flex', gap: 4 }}>
        {SNAPS.map((snap) => (
          <button
            key={snap}
            onClick={() => onChange(snap)}
            style={{
              flex: 1,
              background: value === snap ? `${colors.accent}15` : 'transparent',
              border: `1px solid ${value === snap ? colors.accent : 'var(--border)'}`,
              borderRadius: 5,
              color: value === snap ? colors.accent : 'var(--text-2)',
              fontSize: 11,
              fontWeight: 600,
              padding: '5px 0',
              cursor: 'pointer',
              transition: 'all 0.1s',
              fontFamily: 'inherit',
            }}
          >
            {snap}×
          </button>
        ))}
      </div>
    </div>
  );
}
