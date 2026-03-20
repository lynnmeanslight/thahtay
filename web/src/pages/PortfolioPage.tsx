import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { useWalletStore } from '../store/useWalletStore';
import { fetchTraderHistory } from '../services/graphService';
import { formatUSD, formatPnl, formatPrice } from '../utils/formatting';
import { colors } from '../theme/colors';
import { useCollateral } from '../hooks/useCollateral';
import { usePosition } from '../hooks/usePosition';
import { usePrice } from '../hooks/usePrice';
import { usePnL } from '../hooks/usePnL';

export function PortfolioPage() {
  const { address } = useAccount();
  const { usdcBalance, ethBalance } = useWalletStore();
  const { position } = usePosition(address);
  const { price } = usePrice();
  const { netPnl: unrealizedPnl } = usePnL(position, price);

  const { data: history = [], isLoading, refetch, error } = useQuery({
    queryKey: ['traderHistory', address],
    queryFn: () => fetchTraderHistory(address!),  
    enabled: !!address,
    refetchInterval: 30_000,
  });

  const totalRealizedPnl = history.reduce(
    (acc: bigint, t: any) => acc + BigInt(t.type === 'close' ? (t.pnl ?? '0') : '0'),
    0n,
  );

  if (!address) {
    return <div className="empty"><p>Connect your wallet</p></div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Balances */}
      <div>
        <p className="label" style={{ marginBottom: 10 }}>Balances</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          <BalCard label="USDC" value={usdcBalance != null ? formatUSD(BigInt(usdcBalance), 6) : '—'} />
          <BalCard label="ETH" value={ethBalance != null ? `${(Number(ethBalance) / 1e18).toFixed(4)}` : '—'} />
          <BalCard
            label="Realized PnL"
            value={formatPnl(totalRealizedPnl)}
            valueColor={totalRealizedPnl >= 0n ? colors.profit : colors.loss}
          />
          <BalCard
            label="Unrealized PnL"
            value={position ? formatPnl(unrealizedPnl) : '—'}
            valueColor={position ? (unrealizedPnl >= 0n ? colors.profit : colors.loss) : undefined}
            sublabel={position ? 'open position' : 'no open position'}
          />
        </div>
      </div>

      <CollateralPanel />

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <p className="label">Trade History</p>
          <button className="btn btn-ghost" onClick={() => void refetch()} style={{ height: 36, fontSize: 13 }}>Refresh</button>
        </div>
        {isLoading && <p style={{ color: 'var(--text-2)', fontSize: 15 }}>Loading…</p>}
        {!!error && (
          <p style={{ color: colors.loss, fontSize: 14, marginBottom: 8 }}>
            Could not load trade history right now.
          </p>
        )}
        {!isLoading && history.length === 0 && (
          <div className="empty" style={{ paddingTop: 30 }}><p>No trades yet</p></div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {history.map((trade: any, i: number) => (
            <div
              key={trade.id ?? i}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '10px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>ETH-USDC</p>
                <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>
                  {new Date(Number(trade.timestamp) * 1000).toLocaleDateString()}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.5px',
                    textTransform: 'uppercase' as const,
                    padding: '1px 5px', borderRadius: 3,
                    background: trade.type === 'open'
                      ? (trade.isLong ? `${colors.profit}20` : `${colors.loss}20`)
                      : 'var(--bg)',
                    color: trade.type === 'open'
                      ? (trade.isLong ? colors.profit : colors.loss)
                      : colors.textSecondary,
                    border: `1px solid ${trade.type === 'open'
                      ? (trade.isLong ? `${colors.profit}40` : `${colors.loss}40`)
                      : colors.border}`,
                  }}>
                    {trade.type === 'open'
                      ? (trade.isLong ? '↑ Long' : '↓ Short')
                      : 'Closed'}
                  </span>
                </div>
                {trade.type === 'close' ? (
                  <p style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: 4,
                    color: BigInt(trade.pnl ?? '0') >= 0n ? colors.profit : colors.loss }}>
                    {formatPnl(BigInt(trade.pnl ?? '0'))}
                  </p>
                ) : (
                  <p style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', marginTop: 4, color: colors.textSecondary }}>
                    @ ${formatPrice(BigInt(trade.price ?? '0'))}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BalCard({ label, value, valueColor, sublabel }: { label: string; value: string; valueColor?: string; sublabel?: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 12px' }}>
      <p className="label" style={{ marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: valueColor ?? 'var(--text)' }}>
        {value}
      </p>
      {sublabel && (
        <p style={{ fontSize: 12, color: colors.textMuted, marginTop: 3 }}>{sublabel}</p>
      )}
    </div>
  );
}

function CollateralPanel() {
  const { collateralBalance, withdrawableBalance, isUnderfunded, deposit, withdraw, status, resetStatus } = useCollateral();
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [rawAmount, setRawAmount] = useState('');

  const parsedAmount = (() => {
    const n = parseFloat(rawAmount);
    if (!rawAmount || isNaN(n) || n <= 0) return null;
    return BigInt(Math.round(n * 1_000_000));
  })();

  const effectiveMax = mode === 'withdraw' ? withdrawableBalance : collateralBalance;
  const exceedsBalance = mode === 'withdraw' && parsedAmount !== null && parsedAmount > withdrawableBalance;

  const handleAction = async () => {
    if (!parsedAmount || exceedsBalance) return;
    try {
      if (mode === 'deposit') await deposit(parsedAmount);
      else await withdraw(parsedAmount);
      setRawAmount('');
    } catch { /* surfaced via status */ }
  };

  const handleMax = () => {
    resetStatus();
    const max = Number(effectiveMax) / 1_000_000;
    setRawAmount(max > 0 ? max.toFixed(6) : '');
  };

  const switchMode = (next: 'deposit' | 'withdraw') => {
    setMode(next);
    setRawAmount('');
    resetStatus();
  };

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <p className="label">Vault Collateral</p>
          <p style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
            Pre-deposited USDC used as margin for trades
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 11, color: colors.textMuted, marginBottom: 2 }}>Balance</p>
          <p style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: colors.accent }}>
            {formatUSD(collateralBalance, 6)}
          </p>
          {isUnderfunded && (
            <p style={{ fontSize: 11, color: colors.loss, marginTop: 2 }}>
              withdrawable: {formatUSD(withdrawableBalance, 6)}
            </p>
          )}
        </div>
      </div>

      {/* Underfunded warning */}
      {isUnderfunded && mode === 'withdraw' && (
        <div style={{
          background: `${colors.loss}10`,
          border: `1px solid ${colors.loss}30`,
          borderRadius: 8,
          padding: '8px 12px',
          marginBottom: 12,
          fontSize: 13,
          color: colors.loss,
          lineHeight: 1.5,
        }}>
          ⚠ The vault currently holds less USDC than your balance shows. You can withdraw up to {formatUSD(withdrawableBalance, 6)} right now.
        </div>
      )}

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {(['deposit', 'withdraw'] as const).map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            style={{
              flex: 1,
              height: 36,
              borderRadius: 8,
              border: `1px solid ${mode === m ? colors.accent : colors.border}`,
              background: mode === m ? `${colors.accent}18` : 'transparent',
              color: mode === m ? colors.accent : colors.textSecondary,
              fontWeight: mode === m ? 700 : 400,
              fontSize: 14,
              cursor: 'pointer',
              textTransform: 'capitalize' as const,
            }}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Input row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div className="input-wrap" style={{ flex: 1 }}>
          <input
            className="input"
            type="number"
            min="0"
            placeholder="0.00"
            value={rawAmount}
            onChange={(e) => { resetStatus(); setRawAmount(e.target.value); }}
            style={{ fontSize: 16, padding: '11px 16px' }}
          />
          <span style={{ padding: '0 8px 0 0', fontSize: 13, color: 'var(--text-2)' }}>USDC</span>
        </div>
        {mode === 'withdraw' && collateralBalance > 0n && (
          <button
            onClick={handleMax}
            style={{
              height: 42, padding: '0 12px', borderRadius: 8,
              border: `1px solid ${colors.border}`,
              background: 'transparent',
              color: colors.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              whiteSpace: 'nowrap' as const,
            }}
          >
            Max
          </button>
        )}
      </div>

      {/* Validation warning */}
      {exceedsBalance && (
        <p style={{ color: colors.loss, fontSize: 13, marginBottom: 8 }}>
          Amount exceeds vault balance ({formatUSD(collateralBalance, 6)})
        </p>
      )}

      {/* Action button */}
      <button
        className={mode === 'deposit' ? 'btn btn-accent' : 'btn btn-danger'}
        onClick={() => void handleAction()}
        disabled={!parsedAmount || status.isLoading || exceedsBalance}
        style={{ width: '100%', height: 44, fontSize: 15 }}
      >
        {status.isLoading
          ? 'Confirming…'
          : mode === 'deposit'
          ? 'Deposit USDC'
          : 'Withdraw USDC'}
      </button>

      <p style={{ fontSize: 12, color: colors.textMuted, marginTop: 8, lineHeight: 1.4 }}>
        {mode === 'deposit'
          ? 'Deposited USDC is used as margin automatically when you open trades.'
          : 'Withdraws free collateral back to your wallet. Cannot withdraw margin locked in an open position.'}
      </p>
      {status.error && <p style={{ color: colors.loss, fontSize: 13, marginTop: 8 }}>{status.error.message.slice(0, 120)}</p>}
      {status.isSuccess && <p style={{ color: colors.profit, fontSize: 13, marginTop: 8 }}>✓ Confirmed</p>}
    </div>
  );
}
