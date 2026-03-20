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
  const { collateralBalance, deposit, withdraw, status, resetStatus } = useCollateral();
  const [rawAmount, setRawAmount] = useState('');

  const parsedAmount = (() => {
    const n = parseFloat(rawAmount);
    if (!rawAmount || isNaN(n) || n <= 0) return null;
    return BigInt(Math.round(n * 1_000_000));
  })();

  const handleDeposit = async () => {
    if (!parsedAmount) return;
    try { await deposit(parsedAmount); setRawAmount(''); } catch { /* surfaced via status */ }
  };

  const handleWithdraw = async () => {
    if (!parsedAmount) return;
    try { await withdraw(parsedAmount); setRawAmount(''); } catch { /* surfaced via status */ }
  };

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <p className="label">Vault Collateral</p>
          <p style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
            Pre-deposited USDC used as margin for trades
          </p>
        </div>
        <span style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: colors.accent }}>
          {formatUSD(collateralBalance, 6)}
        </span>
      </div>

      {/* Flow explanation */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        marginBottom: 12,
        marginTop: 10,
        fontSize: 12,
        color: colors.textSecondary,
      }}>
        {[
          { label: 'Wallet USDC' },
          { arrow: true },
          { label: 'Vault', highlight: true },
          { arrow: true },
          { label: 'Open Trade' },
          { arrow: true },
          { label: 'Vault', highlight: true },
          { arrow: true },
          { label: 'Withdraw' },
        ].map((step, i) =>
          'arrow' in step ? (
            <span key={i} style={{ color: colors.textMuted, margin: '0 4px', fontSize: 13 }}>→</span>
          ) : (
            <span key={i} style={{
              padding: '3px 7px',
              borderRadius: 5,
              background: step.highlight ? `${colors.accent}15` : colors.bg,
              border: `1px solid ${step.highlight ? `${colors.accent}30` : colors.border}`,
              color: step.highlight ? colors.accent : colors.textSecondary,
              fontWeight: step.highlight ? 600 : 400,
              whiteSpace: 'nowrap' as const,
            }}>
              {step.label}
            </span>
          )
        )}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
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
          <span style={{ padding: '0 12px 0 0', fontSize: 13, color: 'var(--text-2)' }}>USDC</span>
        </div>
        <button className="btn btn-accent" onClick={() => void handleDeposit()} disabled={!parsedAmount || status.isLoading} style={{ height: 42 }}>Deposit</button>
        <button className="btn btn-ghost" onClick={() => void handleWithdraw()} disabled={!parsedAmount || status.isLoading} style={{ height: 42 }}>Withdraw</button>
      </div>
      {/* Contextual hint */}
      <p style={{ fontSize: 12, color: colors.textMuted, marginTop: 8, lineHeight: 1.4 }}>
        {collateralBalance === 0n
          ? 'Deposit USDC here to trade without extra wallet approvals on every position. Your wallet USDC also works directly.'
          : 'Trade profits return here automatically. Withdraw anytime to move USDC back to your wallet.'}
      </p>
      {status.error && <p style={{ color: colors.loss, fontSize: 13, marginTop: 8 }}>{status.error.message.slice(0, 80)}</p>}
      {status.isSuccess && <p style={{ color: colors.accent, fontSize: 13, marginTop: 8 }}>✓ Confirmed</p>}
    </div>
  );
}
