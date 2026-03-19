import { useState } from 'react';
import { useAccount, useConnect } from 'wagmi';
import { usePrice } from '../hooks/usePrice';
import { usePosition } from '../hooks/usePosition';
import { usePositionPreview } from '../hooks/useLiquidationPrice';
import { useTrade } from '../hooks/useTrade';
import { useFundingRate } from '../hooks/useFunding';
import { useTradeStore } from '../store/useTradeStore';
import { useWalletStore } from '../store/useWalletStore';
import { PriceChart } from '../components/PriceChart';
import { LeverageSlider } from '../components/LeverageSlider';
import { MarginInput } from '../components/MarginInput';
import { colors } from '../theme/colors';
import { formatPrice, formatUSD, internalToUsdc } from '../utils/formatting';

export function TradePage() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { price } = usePrice();
  const { position } = usePosition(address);
  const { side, sizeInput, leverageInput, setSide, setSizeInput, setLeverageInput, referrer } = useTradeStore();
  const { usdcBalance } = useWalletStore();
  const { openPosition, status } = useTrade();
  const { longRate, shortRate } = useFundingRate();
  const [error, setError] = useState('');

  const isLong = side === 'long';
  const { sizeInternal, requiredMargin, tradingFee, totalRequired, liquidationPrice } =
    usePositionPreview(sizeInput, leverageInput, price, isLong);
  const totalUsdcRequired = internalToUsdc(totalRequired);

  const handleTrade = async () => {
    setError('');
    if (!isConnected) { connect({ connector: connectors[0] }); return; }
    if (sizeInternal === 0n) { setError('Enter a collateral amount'); return; }
    try {
      await openPosition(
        isLong, sizeInternal, leverageInput, totalUsdcRequired,
        referrer ?? '0x0000000000000000000000000000000000000000',
      );
      setSizeInput('');
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string };
      setError(err?.shortMessage ?? err?.message ?? 'Transaction failed');
    }
  };

  const fmtRate = (rate: number) => `${rate >= 0 ? '+' : ''}${rate.toFixed(4)}%`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <PriceChart currentPrice={price} />

      {/* Funding rates */}
      <div style={{ display: 'flex', gap: 16, padding: '0 2px' }}>
        <span style={{ fontSize: 11, color: 'var(--text-2)' }}>
          Long{' '}
          <span style={{ color: longRate >= 0 ? colors.profit : colors.loss, fontWeight: 600 }}>
            {fmtRate(longRate)}
          </span>
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-2)' }}>
          Short{' '}
          <span style={{ color: shortRate >= 0 ? colors.profit : colors.loss, fontWeight: 600 }}>
            {fmtRate(shortRate)}
          </span>
        </span>
      </div>

      {/* Trade form */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Long / Short toggle */}
        <div className="side-toggle">
          {(['long', 'short'] as const).map((s) => (
            <button
              key={s}
              className="side-btn"
              onClick={() => setSide(s)}
              style={{
                background: side === s
                  ? s === 'long' ? `${colors.profit}22` : `${colors.loss}22`
                  : 'transparent',
                color: side === s
                  ? s === 'long' ? colors.profit : colors.loss
                  : 'var(--text-2)',
                borderRadius: 7,
              }}
            >
              {s === 'long' ? 'Long ↑' : 'Short ↓'}
            </button>
          ))}
        </div>

        <MarginInput
          value={sizeInput}
          onChangeText={setSizeInput}
          usdcBalance={usdcBalance}
          label="Collateral"
          error={error || undefined}
        />

        <LeverageSlider value={leverageInput} onChange={setLeverageInput} />

        {/* Order summary */}
        {sizeInternal > 0n && (
          <div style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            <div className="stat-row">
              <span className="key">Margin</span>
              <span className="val">{formatUSD(internalToUsdc(requiredMargin), 6)}</span>
            </div>
            <div className="stat-row">
              <span className="key">Notional</span>
              <span className="val">{formatUSD(internalToUsdc(sizeInternal), 6)}</span>
            </div>
            <div className="stat-row">
              <span className="key">Fee (0.1%)</span>
              <span className="val">{formatUSD(internalToUsdc(tradingFee), 6)}</span>
            </div>
            <div className="stat-row">
              <span className="key">Liq. price</span>
              <span className="val" style={{ color: colors.loss }}>
                {liquidationPrice > 0n ? `$${formatPrice(liquidationPrice)}` : '—'}
              </span>
            </div>
            <div className="divider" />
            <div className="stat-row">
              <span className="key" style={{ color: 'var(--text-2)', fontWeight: 500 }}>Total USDC</span>
              <span className="val bold">{formatUSD(totalUsdcRequired, 6)}</span>
            </div>
          </div>
        )}

        {/* CTA */}
        {position ? (
          <div style={{
            padding: '13px 16px',
            borderRadius: 8,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            color: 'var(--text-2)',
            fontSize: 12,
            textAlign: 'center',
          }}>
            Close your active position before opening a new one
          </div>
        ) : (
          <button
            onClick={handleTrade}
            disabled={status.isLoading}
            style={{
              width: '100%',
              height: 50,
              border: `1px solid ${isLong ? `${colors.profit}40` : `${colors.loss}40`}`,
              borderRadius: 10,
              background: isLong ? `${colors.profit}18` : `${colors.loss}18`,
              color: isLong ? colors.profit : colors.loss,
              fontSize: 14,
              fontWeight: 700,
              cursor: status.isLoading ? 'not-allowed' : 'pointer',
              opacity: status.isLoading ? 0.5 : 1,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              transition: 'opacity 0.15s',
              fontFamily: 'inherit',
            }}
          >
            {status.isLoading
              ? 'Confirming…'
              : isConnected
                ? `${isLong ? 'Long' : 'Short'} ETH  ·  ${leverageInput}×`
                : 'Connect Wallet'}
          </button>
        )}

        {status.isSuccess && status.txHash && (
          <p style={{ textAlign: 'center', fontSize: 11, color: colors.profit, marginTop: -8 }}>
            ✓ Position opened
          </p>
        )}
      </div>
    </div>
  );
}



