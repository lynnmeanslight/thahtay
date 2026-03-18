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
import { formatPrice, formatUSD } from '../utils/formatting';
import { internalToUsdc } from '../utils/formatting';

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
    if (!isConnected) {
      connect({ connector: connectors[0] });
      return;
    }
    if (sizeInternal === 0n) {
      setError('Enter collateral amount');
      return;
    }
    try {
      await openPosition(
        isLong,
        sizeInternal,
        leverageInput,
        totalUsdcRequired,
        referrer ?? '0x0000000000000000000000000000000000000000',
      );
      setSizeInput('');
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string };
      setError(err?.shortMessage ?? err?.message ?? 'Transaction failed');
    }
  };

  const hasOpenPosition = !!position;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Price chart */}
      <PriceChart currentPrice={price} />

      {/* Funding rates row */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          padding: '10px 14px',
        }}
      >
        <FundingBadge label="Long funding" rate={longRate} />
        <span style={{ color: colors.border, margin: '0 4px' }}>|</span>
        <FundingBadge label="Short funding" rate={shortRate} />
      </div>

      {/* Trade form */}
      <div
        style={{
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 16,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* Long / Short toggle */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            background: colors.bgInput,
            borderRadius: 10,
            padding: 3,
          }}
        >
          {(['long', 'short'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSide(s)}
              style={{
                background: side === s
                  ? s === 'long' ? colors.profit : colors.loss
                  : 'transparent',
                border: 'none',
                borderRadius: 8,
                color: side === s ? colors.bg : colors.textSecondary,
                fontWeight: 700,
                fontSize: 14,
                padding: '10px 0',
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.15s',
              }}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Collateral input */}
        <MarginInput
          value={sizeInput}
          onChangeText={setSizeInput}
          usdcBalance={usdcBalance}
          label="Collateral (USDC)"
          error={error || undefined}
        />

        {/* Leverage slider */}
        <LeverageSlider value={leverageInput} onChange={setLeverageInput} />

        {/* Order summary */}
        {sizeInternal > 0n && (
          <div
            style={{
              background: colors.bgHighlight,
              borderRadius: 10,
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <SummaryRow label="Required Margin" value={formatUSD(internalToUsdc(requiredMargin), 6)} />
            <SummaryRow label="Position Notional" value={formatUSD(internalToUsdc(sizeInternal), 6)} />
            <SummaryRow label="Trading Fee (0.1%)" value={formatUSD(internalToUsdc(tradingFee), 6)} />
            <SummaryRow
              label="Liq. Price"
              value={liquidationPrice > 0n ? `$${formatPrice(liquidationPrice)}` : '--'}
              valueColor={colors.loss}
            />
            <div style={{ height: 1, background: colors.border, margin: '4px 0' }} />
            <SummaryRow
              label="Total USDC Required"
              value={formatUSD(totalUsdcRequired, 6)}
              bold
            />
          </div>
        )}

        {/* CTA button */}
        {hasOpenPosition ? (
          <div
            style={{
              background: colors.bgHighlight,
              borderRadius: 10,
              padding: '12px 14px',
              textAlign: 'center',
              color: colors.textSecondary,
              fontSize: 13,
            }}
          >
            You have an open position. Close it first to open a new one.
          </div>
        ) : (
          <button
            onClick={handleTrade}
            disabled={status.isLoading}
            style={{
              background: isLong ? colors.profit : colors.loss,
              border: 'none',
              borderRadius: 14,
              color: colors.bg,
              fontWeight: 800,
              fontSize: 15,
              padding: '16px 0',
              cursor: status.isLoading ? 'not-allowed' : 'pointer',
              opacity: status.isLoading ? 0.7 : 1,
              letterSpacing: '0.2px',
            }}
          >
            {!isConnected
              ? 'Connect Wallet'
              : status.isLoading
              ? 'Submitting...'
              : `${isLong ? 'Long' : 'Short'} ETH ${leverageInput}x`}
          </button>
        )}

        {status.isSuccess && status.txHash && (
          <div style={{ color: colors.profit, fontSize: 12, textAlign: 'center' }}>
            Position opened!{' '}
            <a
              href={`https://sepolia.uniscan.xyz/tx/${status.txHash}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: colors.blue }}
            >
              View tx
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function FundingBadge({ label, rate }: { label: string; rate: number }) {
  const color = rate >= 0 ? colors.profit : colors.loss;
  return (
    <span style={{ fontSize: 12, color: colors.textSecondary }}>
      {label}:{' '}
      <span style={{ color, fontWeight: 700 }}>
        {rate >= 0 ? '+' : ''}{rate.toFixed(4)}%
      </span>
    </span>
  );
}

function SummaryRow({
  label,
  value,
  valueColor,
  bold,
}: {
  label: string;
  value: string;
  valueColor?: string;
  bold?: boolean;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: colors.textSecondary, fontSize: 12 }}>{label}</span>
      <span
        style={{
          color: valueColor ?? colors.textPrimary,
          fontSize: bold ? 14 : 12,
          fontWeight: bold ? 700 : 500,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </div>
  );
}
