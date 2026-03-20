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
    const sideColor  = isLong  ? '#4ade80' : '#f87171';
    const pnlColor   = isProfit ? '#4ade80' : '#f87171';
    const pnlSign    = pnlPercent >= 0 ? '+' : '';

    return (
      <div
        ref={ref}
        style={{
          width: 360,
          background: 'linear-gradient(145deg, #0a0a1a 0%, #110d28 100%)',
          border: '1px solid #1c1c3a',
          borderRadius: 20,
          padding: '28px 28px 22px',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          position: 'relative',
          overflow: 'hidden',
          boxSizing: 'border-box',
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
          background: `${sideColor}18`,
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
          background: '#7e6cf218',
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
            <span style={{ color: '#c8c0f0', fontWeight: 800, fontSize: 15, letterSpacing: '-0.4px' }}>ThaHtay</span>
            <span style={{ color: '#3a3a5a', fontSize: 13 }}>·</span>
            <span style={{ color: '#9090c0', fontSize: 13, fontWeight: 500 }}>ETH / USD</span>
          </div>
          <span style={{
            fontSize: 10,
            color: '#7e6cf2',
            background: '#1c1c38',
            border: '1px solid #2c2c50',
            borderRadius: 6,
            padding: '3px 9px',
            fontWeight: 600,
            letterSpacing: '0.3px',
            textTransform: 'uppercase',
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
            background: `${sideColor}1a`,
            border: `1px solid ${sideColor}50`,
            borderRadius: 10,
            padding: '6px 14px',
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
            background: '#1c1c38',
            border: '1px solid #2c2c4e',
            borderRadius: 10,
            padding: '6px 14px',
          }}>
            <span style={{ color: '#c8c0f0', fontWeight: 700, fontSize: 13 }}>
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
          }}>
            {pnlFormatted}
          </div>
          <div style={{
            color: pnlColor,
            fontWeight: 600,
            fontSize: 18,
            marginTop: 8,
            opacity: 0.75,
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
              borderLeft:   i === 1 ? '1px solid #1c1c38' : 'none',
            }}>
              <div style={{
                color: '#6060a0',
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
                marginBottom: 5,
              }}>
                {label}
              </div>
              <div style={{
                color: '#e8e0ff',
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
          borderTop: '1px solid #1c1c38',
          paddingTop: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          position: 'relative',
        }}>
          {/* Hashtag tags */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['#ThaHtay', '#DeFi', '#Unichain', '#UniswapV4', '#Perps'].map((tag) => (
              <span key={tag} style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#7e6cf2',
                background: 'rgba(126,108,242,0.12)',
                border: '1px solid rgba(126,108,242,0.25)',
                borderRadius: 5,
                padding: '2px 7px',
                letterSpacing: '0.2px',
              }}>{tag}</span>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#3a3a60', fontSize: 11, fontWeight: 500 }}>
              Perpetuals on Uniswap v4
            </span>
            <span style={{ color: '#7e6cf2', fontSize: 11, fontWeight: 700, letterSpacing: '-0.2px' }}>
              thahtay.xyz
            </span>
          </div>
        </div>
      </div>
    );
  },
);

TradingCard.displayName = 'TradingCard';
