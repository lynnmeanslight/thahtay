import { useState } from 'react';
import { colors } from '../theme/colors';
import { formatPrice, formatUSD } from '../utils/formatting';
import { PnLDisplay } from './PnLDisplay';
import { usePnL } from '../hooks/usePnL';
import { useLiquidationPrice } from '../hooks/useLiquidationPrice';
import { usePrice } from '../hooks/usePrice';
import { useTrade } from '../hooks/useTrade';
import type { GqlPosition } from '../services/graphService';

interface PositionCardProps {
  position: GqlPosition;
  onClose?: () => void;
}

export function PositionCard({ position, onClose }: PositionCardProps) {
  const { price: currentPrice } = usePrice();
  const { pnl, pnlPercent } = usePnL(position, currentPrice);
  const liqPrice = useLiquidationPrice(position);
  const { closePosition, addMargin, status } = useTrade();

  const [showAddMargin, setShowAddMargin] = useState(false);
  const [marginInput, setMarginInput] = useState('');

  const isLong = position.isLong;
  const sideColor = isLong ? colors.profit : colors.loss;

  const handleClose = async () => {
    try { await closePosition(); onClose?.(); } catch { /* suppress */ }
  };

  const handleAddMargin = async () => {
    const amount = parseFloat(marginInput);
    if (isNaN(amount) || amount <= 0) return;
    try {
      await addMargin(BigInt(Math.floor(amount * 1e6)));
      setShowAddMargin(false);
      setMarginInput('');
    } catch { /* suppress */ }
  };

  return (
    <>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 18,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>ETH-USDC</span>
            <span style={{
              background: `${sideColor}15`,
              color: sideColor,
              borderRadius: 4,
              padding: '2px 7px',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.6px',
              textTransform: 'uppercase' as const,
            }}>
              {isLong ? 'Long' : 'Short'}
            </span>
            <span style={{ color: 'var(--text-2)', fontSize: 12 }}>{position.leverage}×</span>
          </div>
          <PnLDisplay pnl={pnl} pnlPercent={pnlPercent} size="sm" />
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 16 }}>
          <div className="stat-row">
            <span className="key">Size</span>
            <span className="val">{formatUSD(BigInt(position.size), 6)}</span>
          </div>
          <div className="stat-row">
            <span className="key">Entry price</span>
            <span className="val">${formatPrice(BigInt(position.entryPrice))}</span>
          </div>
          <div className="stat-row">
            <span className="key">Mark price</span>
            <span className="val">${formatPrice(currentPrice)}</span>
          </div>
          <div className="stat-row">
            <span className="key">Liq. price</span>
            <span className="val" style={{ color: colors.loss }}>
              {liqPrice > 0n ? `$${formatPrice(liqPrice)}` : '—'}
            </span>
          </div>
          <div className="stat-row">
            <span className="key">Margin</span>
            <span className="val">{formatUSD(BigInt(position.margin), 6)}</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-ghost"
            onClick={() => setShowAddMargin(true)}
            style={{ flex: 1, height: 40 }}
          >
            Add Margin
          </button>
          <button
            className="btn btn-danger"
            onClick={handleClose}
            disabled={status.isLoading}
            style={{ flex: 1 }}
          >
            {status.isLoading ? 'Closing…' : 'Close Position'}
          </button>
        </div>
      </div>

      {/* Add Margin modal */}
      {showAddMargin && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}
          onClick={() => setShowAddMargin(false)}
        >
          <div
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Add Margin</p>
            <div className="input-wrap">
              <input
                className="input"
                type="number"
                placeholder="Amount in USDC"
                value={marginInput}
                onChange={(e) => setMarginInput(e.target.value)}
                autoFocus
              />
              <span style={{ padding: '0 14px', fontSize: 12, color: 'var(--text-2)' }}>USDC</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-ghost"
                onClick={() => { setShowAddMargin(false); setMarginInput(''); }}
                style={{ flex: 1, height: 44 }}
              >
                Cancel
              </button>
              <button
                className="btn btn-accent"
                onClick={handleAddMargin}
                disabled={status.isLoading || !marginInput}
                style={{ flex: 1, height: 44 }}
              >
                {status.isLoading ? 'Confirming…' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
