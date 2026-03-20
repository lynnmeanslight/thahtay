import { useState } from 'react';
import { useAccount } from 'wagmi';
import { usePosition } from '../hooks/usePosition';
import { usePrice } from '../hooks/usePrice';
import { usePnL } from '../hooks/usePnL';
import { PositionCard } from '../components/PositionCard';
import { ShareCardModal } from '../components/ShareCardModal';
import { colors } from '../theme/colors';
import { formatPrice, formatPnl, internalToUsdc } from '../utils/formatting';

export function PositionsPage() {
  const { address } = useAccount();
  const { position, isLoading, error, refetch } = usePosition(address);
  const { price } = usePrice();
  const { pnl, netPnl, pnlPercent, isProfit } = usePnL(position, price);
  const [showShare, setShowShare] = useState(false);

  if (!address) return (
    <div className="empty"><p>Connect your wallet</p></div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Open Positions</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {position && (
            <button
              className="btn btn-ghost"
              onClick={() => setShowShare(true)}
              style={{ height: 36, fontSize: 13, color: colors.textSecondary }}
            >
              Share
            </button>
          )}
          <button className="btn btn-ghost" onClick={refetch} style={{ height: 36, fontSize: 13 }}>
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(244,63,94,0.05)',
          border: '1px solid rgba(244,63,94,0.2)',
          borderRadius: 8,
          padding: '10px 12px',
          color: 'var(--loss)',
          fontSize: 14,
        }}>
          Indexed data unavailable — on-chain fallback active.
        </div>
      )}

      {isLoading && !position && (
        <p style={{ color: 'var(--text-2)', fontSize: 15 }}>Loading…</p>
      )}

      {!isLoading && !position && (
        <div className="empty">
          <p>No open positions</p>
          <small>Go to Trade to open one</small>
        </div>
      )}

      {position && <PositionCard position={position} onClose={refetch} />}

      {showShare && position && (
        <ShareCardModal
          onClose={() => setShowShare(false)}
          side={position.isLong ? 'long' : 'short'}
          leverage={Number(position.leverage)}
          entryPrice={formatPrice(BigInt(position.entryPrice))}
          currentPrice={formatPrice(price)}
          pnlFormatted={formatPnl(netPnl)}
          pnlPercent={pnlPercent}
          isProfit={isProfit}
        />
      )}
    </div>
  );
}
