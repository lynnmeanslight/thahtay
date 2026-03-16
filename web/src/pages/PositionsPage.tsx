import { useAccount } from 'wagmi';
import { usePosition } from '../hooks/usePosition';
import { PositionCard } from '../components/PositionCard';
import { colors } from '../theme/colors';

export function PositionsPage() {
  const { address } = useAccount();
  const { position, isLoading, refetch } = usePosition(address);

  if (!address) {
    return (
      <div style={centeredStyle}>
        <span style={{ color: colors.textSecondary, fontSize: 14 }}>
          Connect your wallet to view positions
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ color: colors.textPrimary, fontSize: 20, fontWeight: 800, margin: 0 }}>
          Open Positions
        </h2>
        <button
          onClick={refetch}
          style={{
            background: colors.bgHighlight,
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            color: colors.textSecondary,
            fontSize: 12,
            padding: '6px 12px',
            cursor: 'pointer',
          }}
        >
          Refresh
        </button>
      </div>

      {isLoading && !position && (
        <span style={{ color: colors.textSecondary, fontSize: 13 }}>Loading...</span>
      )}

      {!isLoading && !position && (
        <div style={centeredStyle}>
          <span style={{ color: colors.textSecondary, fontSize: 14 }}>No open positions</span>
          <span style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
            Open a trade on the Trade tab to get started.
          </span>
        </div>
      )}

      {position && <PositionCard position={position} onClose={refetch} />}
    </div>
  );
}

const centeredStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  paddingTop: 80,
  textAlign: 'center',
};
