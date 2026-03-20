import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { TradingCard } from './TradingCard';
import type { TradingCardProps } from './TradingCard';
import { colors } from '../theme/colors';

interface ShareCardModalProps extends TradingCardProps {
  onClose: () => void;
}

export function ShareCardModal({ onClose, ...cardProps }: ShareCardModalProps) {
  const cardRef  = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'idle' | 'capturing' | 'done'>('idle');

  const capture = async (): Promise<string | null> => {
    if (!cardRef.current) return null;
    setStatus('capturing');
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        logging: false,
      });
      return canvas.toDataURL('image/png');
    } finally {
      setStatus('done');
    }
  };

  const handleDownload = async () => {
    const dataUrl = await capture();
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.download = 'thahtay-trade.png';
    link.href = dataUrl;
    link.click();
  };

  const handleShareToX = async () => {
    // Download the card image first
    const dataUrl = await capture();
    if (dataUrl) {
      const link = document.createElement('a');
      link.download = 'thahtay-trade.png';
      link.href = dataUrl;
      link.click();
    }

    // Build tweet text
    const sideLabel = cardProps.side === 'long' ? '↑ Long' : '↓ Short';
    const pnlSign   = cardProps.pnlPercent >= 0 ? '+' : '';
    const text = [
      `${sideLabel} ETH ${cardProps.leverage}× on @ThaHtay`,
      `Entry: $${cardProps.entryPrice}  →  Mark: $${cardProps.currentPrice}`,
      `PnL: ${cardProps.pnlFormatted} (${pnlSign}${cardProps.pnlPercent.toFixed(2)}%)`,
      '',
      'Perpetual futures on Uniswap v4 · Unichain ⚡',
      '',
      '#ThaHtay #DeFi #Unichain #UniswapV4 #Perps #OnChain',
    ].join('\n');

    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer,width=560,height=600',
    );
  };

  return (
    // Backdrop
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
    >
      {/* Dialog */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 16,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          maxWidth: 420,
          width: '100%',
          position: 'relative',
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            width: 28,
            height: 28,
            borderRadius: 8,
            border: `1px solid ${colors.border}`,
            background: 'transparent',
            color: colors.textSecondary,
            cursor: 'pointer',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'inherit',
          }}
        >
          ✕
        </button>

        <div style={{ fontSize: 13, fontWeight: 600, color: colors.textSecondary, alignSelf: 'flex-start' }}>
          Share your position
        </div>

        {/* Card preview */}
        <TradingCard ref={cardRef} {...cardProps} />

        {/* Hint */}
        <p style={{
          fontSize: 11,
          color: colors.textMuted,
          textAlign: 'center',
          margin: 0,
          lineHeight: 1.5,
        }}>
          The card image will download automatically — attach it to your tweet.
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          <button
            onClick={handleDownload}
            disabled={status === 'capturing'}
            style={{
              flex: 1,
              height: 42,
              border: `1px solid ${colors.border}`,
              borderRadius: 10,
              background: 'transparent',
              color: colors.textSecondary,
              fontSize: 13,
              fontWeight: 600,
              cursor: status === 'capturing' ? 'not-allowed' : 'pointer',
              opacity: status === 'capturing' ? 0.5 : 1,
              fontFamily: 'inherit',
              transition: 'opacity 0.15s',
            }}
          >
            Download PNG
          </button>
          <button
            onClick={handleShareToX}
            disabled={status === 'capturing'}
            style={{
              flex: 2,
              height: 42,
              border: '1px solid rgba(29,161,242,0.4)',
              borderRadius: 10,
              background: 'rgba(29,161,242,0.1)',
              color: '#1da1f2',
              fontSize: 13,
              fontWeight: 700,
              cursor: status === 'capturing' ? 'not-allowed' : 'pointer',
              opacity: status === 'capturing' ? 0.5 : 1,
              fontFamily: 'inherit',
              letterSpacing: '0.2px',
              transition: 'opacity 0.15s',
            }}
          >
            {status === 'capturing' ? 'Preparing…' : 'Share on X'}
          </button>
        </div>
      </div>
    </div>
  );
}
