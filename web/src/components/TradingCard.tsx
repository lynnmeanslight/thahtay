import { forwardRef } from 'react';

export interface TradingCardProps {
  side: 'long' | 'short';
  leverage: number;
  entryPrice: string;   // formatted, e.g. "2,105.42"
  currentPrice: string; // formatted, e.g. "2,229.74"
  pnlFormatted: string; // e.g. "+$124.32"
  pnlPercent: number;   // e.g. 8.42 (already a %)
  isProfit: boolean;
}

export const TradingCard = forwardRef<HTMLDivElement, TradingCardProps>(
  ({ side, leverage, entryPrice, currentPrice, pnlFormatted, pnlPercent, isProfit }, ref) => {
    const isLong = side === 'long';
    const sideColor  = isLong  ? 'var(--profit)' : 'var(--loss)';
    const pnlColor   = isProfit ? 'var(--profit)' : 'var(--loss)';
    const pnlSign    = pnlPercent >= 0 ? '+' : '';

    return (
      <div
        ref={ref}
        style={{
          width: 360,
          background: 'var(--surface)',
          backdropFilter: 'blur(20px) saturate(150%)',
          WebkitBackdropFilter: 'blur(20px) saturate(150%)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          padding: '28px 28px 22px',
          fontFamily: 'inherit',
          position: 'relative',
          overflow: 'hidden',
          boxSizing: 'border-box',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Background glow */}
        <div style={{
          position: 'absolute',
          top: -80,
          right: -80,
          width: 220,
          height: 220,
          borderRadius: '50%',
          background: isLong ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
          filter: 'blur(50px)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute',
          bottom: -60,
          left: -60,
          width: 160,
          height: 160,
          borderRadius: '50%',
          background: 'var(--accent-glow)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }} />

        {/* Header row */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 22,
          position: 'relative',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/brand_logo.png" alt="ThaHtay" style={{ height: 22, objectFit: 'contain' }} />
            <span style={{ color: 'var(--text)', fontWeight: 800, fontSize: 16, letterSpacing: '-0.3px', textShadow: '0 0 10px rgba(255,255,255,0.2)' }}>ThaHtay</span>
            <span style={{ color: 'var(--text-3)', fontSize: 13 }}>·</span>
            <span style={{ color: 'var(--text-2)', fontSize: 14, fontWeight: 500 }}>ETH / USD</span>
          </div>
          <span style={{
            fontSize: 10,
            color: 'var(--accent)',
            background: 'var(--border)',
            border: '1px solid var(--border-hi)',
            borderRadius: 6,
            padding: '3px 9px',
            fontWeight: 700,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            boxShadow: '0 0 10px rgba(0,255,209,0.1)'
          }}>Unichain</span>
        </div>

        {/* Side + leverage badges */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 28,
          position: 'relative',
        }}>
          <div style={{
            background: isLong ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${isLong ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            borderRadius: 10,
            padding: '6px 14px',
            boxShadow: `0 0 15px ${isLong ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}`
          }}>
            <span style={{
              color: sideColor,
              fontWeight: 800,
              fontSize: 13,
              letterSpacing: '0.8px',
              textTransform: 'uppercase',
            }}>
              {isLong ? '↑' : '↓'} {side}
            </span>
          </div>
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-hi)',
            borderRadius: 10,
            padding: '6px 14px',
          }}>
            <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: 13 }}>
              {leverage}×
            </span>
          </div>
        </div>

        {/* PnL */}
        <div style={{
          marginBottom: 28,
          position: 'relative',
          lineHeight: 1,
        }}>
          <div style={{
            color: pnlColor,
            fontWeight: 800,
            fontSize: 44,
            letterSpacing: '-1.5px',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
            textShadow: `0 0 25px ${isProfit ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
          }}>
            {pnlFormatted}
          </div>
          <div style={{
            color: pnlColor,
            fontWeight: 600,
            fontSize: 18,
            marginTop: 8,
            opacity: 0.9,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {pnlSign}{pnlPercent.toFixed(2)}%
          </div>
        </div>

        {/* Entry / Mark prices */}
        <div style={{
          display: 'flex',
          marginBottom: 24,
          position: 'relative',
        }}>
          {([
            { label: 'Entry price', value: `$${entryPrice}` },
            { label: 'Mark price',  value: `$${currentPrice}` },
          ] as const).map(({ label, value }, i) => (
            <div key={label} style={{
              flex: 1,
              paddingRight: i === 0 ? 20 : 0,
              paddingLeft:  i === 1 ? 20 : 0,
              borderLeft:   i === 1 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{
                color: 'var(--text-3)',
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                marginBottom: 5,
              }}>
                {label}
              </div>
              <div style={{
                color: 'var(--text)',
                fontWeight: 700,
                fontSize: 17,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.3px',
              }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '1px solid var(--border)',
          paddingTop: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          position: 'relative',
        }}>
          {/* Hashtag tags */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['#ThaHtay', '#DeFi', '#Unichain', '#UniswapV4', '#Perps'].map((tag) => (
              <span key={tag} style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--accent)',
                background: 'rgba(0, 255, 209, 0.08)',
                border: '1px solid rgba(0, 255, 209, 0.15)',
                borderRadius: 5,
                padding: '3px 8px',
                letterSpacing: '0.4px',
              }}>{tag}</span>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-3)', fontSize: 11, fontWeight: 500 }}>
              Perpetuals on Uniswap v4
            </span>
            <span style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 700, letterSpacing: '0.5px' }}>
              thahtay.xyz
            </span>
          </div>
        </div>
      </div>
    );
  },
);

TradingCard.displayName = 'TradingCard';
