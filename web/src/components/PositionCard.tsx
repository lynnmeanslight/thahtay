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
  const sideLabel = isLong ? 'LONG' : 'SHORT';

  const handleClose = async () => {
    try {
      await closePosition();
      onClose?.();
    } catch { /* suppress */ }
  };

  const handleAddMargin = async () => {
    const amount = parseFloat(marginInput);
    if (isNaN(amount) || amount <= 0) return;
    const amountBigInt = BigInt(Math.floor(amount * 1e6));
    try {
      await addMargin(amountBigInt);
      setShowAddMargin(false);
      setMarginInput('');
    } catch { /* suppress */ }
  };

  return (
    <div
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: colors.textPrimary, fontWeight: 700, fontSize: 14 }}>ETH-USDC</span>
          <span
            style={{
              background: sideColor + '22',
              color: sideColor,
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {sideLabel}
          </span>
          <span style={{ color: colors.textSecondary, fontSize: 12 }}>{position.leverage}x</span>
        </div>
        <PnLDisplay pnl={pnl} pnlPercent={pnlPercent} size="sm" />
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', marginBottom: 14 }}>
        <StatRow label="Size" value={formatUSD(BigInt(position.size), 18)} />
        <StatRow label="Entry Price" value={formatPrice(BigInt(position.entryPrice))} />
        <StatRow label="Mark Price" value={formatPrice(currentPrice)} />
        <StatRow label="Liq. Price" value={liqPrice > 0n ? formatPrice(liqPrice) : '--'} valueColor={colors.loss} />
        <StatRow label="Margin" value={formatUSD(BigInt(position.margin), 18)} />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => setShowAddMargin(true)}
          style={{
            flex: 1,
            background: colors.bgHighlight,
            border: `1px solid ${colors.border}`,
            borderRadius: 10,
            color: colors.textPrimary,
            fontSize: 13,
            fontWeight: 600,
            padding: '10px 0',
            cursor: 'pointer',
          }}
        >
          Add Margin
        </button>
        <button
          onClick={handleClose}
          disabled={status.isLoading}
          style={{
            flex: 1,
            background: colors.loss + '22',
            border: `1px solid ${colors.loss}44`,
            borderRadius: 10,
            color: colors.loss,
            fontSize: 13,
            fontWeight: 700,
            padding: '10px 0',
            cursor: status.isLoading ? 'not-allowed' : 'pointer',
            opacity: status.isLoading ? 0.6 : 1,
          }}
        >
          {status.isLoading ? 'Closing...' : 'Close Position'}
        </button>
      </div>

      {/* Add Margin overlay */}
      {showAddMargin && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            zIndex: 100,
          }}
          onClick={() => setShowAddMargin(false)}
        >
          <div
            style={{
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: '16px 16px 0 0',
              padding: 24,
              width: '100%',
              maxWidth: 480,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <span style={{ color: colors.textPrimary, fontWeight: 700, fontSize: 16 }}>Add Margin</span>
            <input
              type="number"
              placeholder="USDC amount"
              value={marginInput}
              onChange={(e) => setMarginInput(e.target.value)}
              autoFocus
              style={{
                background: colors.bgInput,
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
                color: colors.textPrimary,
                fontSize: 16,
                padding: '12px 14px',
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { setShowAddMargin(false); setMarginInput(''); }}
                style={{
                  flex: 1,
                  background: colors.bgHighlight,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 10,
                  color: colors.textPrimary,
                  padding: '12px 0',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddMargin}
                disabled={status.isLoading}
                style={{
                  flex: 1,
                  background: colors.primary,
                  border: 'none',
                  borderRadius: 10,
                  color: colors.bg,
                  padding: '12px 0',
                  cursor: status.isLoading ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  fontWeight: 700,
                  opacity: status.isLoading ? 0.6 : 1,
                }}
              >
                {status.isLoading ? 'Confirming...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div>
      <div style={{ color: colors.textMuted, fontSize: 11, marginBottom: 2 }}>{label}</div>
      <div style={{ color: valueColor ?? colors.textPrimary, fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </div>
  );
}
