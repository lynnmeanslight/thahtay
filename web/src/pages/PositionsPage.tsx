import { useAccount } from 'wagmi';
import { usePosition } from '../hooks/usePosition';
import { PositionCard } from '../components/PositionCard';

export function PositionsPage() {
  const { address } = useAccount();
  const { position, isLoading, error, refetch } = usePosition(address);

  if (!address) return (
    <div className="empty"><p>Connect your wallet</p></div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Open Positions</h2>
        <button className="btn btn-ghost" onClick={refetch} style={{ height: 30, fontSize: 11 }}>
          Refresh
        </button>
      </div>

      {error && (
        <div style={{
          background: 'rgba(244,63,94,0.05)',
          border: '1px solid rgba(244,63,94,0.2)',
          borderRadius: 8,
          padding: '10px 12px',
          color: 'var(--loss)',
          fontSize: 12,
        }}>
          Indexed data unavailable — on-chain fallback active.
        </div>
      )}

      {isLoading && !position && (
        <p style={{ color: 'var(--text-2)', fontSize: 13 }}>Loading…</p>
      )}

      {!isLoading && !position && (
        <div className="empty">
          <p>No open positions</p>
          <small>Go to Trade to open one</small>
        </div>
      )}

      {position && <PositionCard position={position} onClose={refetch} />}
    </div>
  );
}
