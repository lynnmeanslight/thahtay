import { useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { useWalletStore } from '../store/useWalletStore';
import { fetchTraderHistory } from '../services/graphService';
import { formatUSD, formatPnl } from '../utils/formatting';
import { colors } from '../theme/colors';
import { useCollateral } from '../hooks/useCollateral';

export function PortfolioPage() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { usdcBalance, ethBalance } = useWalletStore();

  const { data: history = [], isLoading, refetch, error } = useQuery({
    queryKey: ['traderHistory', address, chainId],
    queryFn: () => fetchTraderHistory(address!, chainId),
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <BalCard label="USDC" value={usdcBalance != null ? formatUSD(BigInt(usdcBalance), 6) : '—'} />
          <BalCard label="ETH" value={ethBalance != null ? `${(Number(ethBalance) / 1e18).toFixed(4)}` : '—'} />
          <BalCard
            label="Realized PnL"
            value={formatPnl(totalRealizedPnl)}
            valueColor={totalRealizedPnl >= 0n ? colors.profit : colors.loss}
          />
        </div>
      </div>

      <CollateralPanel />

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <p className="label">Trade History</p>
          <button className="btn btn-ghost" onClick={() => void refetch()} style={{ height: 28, fontSize: 11 }}>Refresh</button>
        </div>
        {isLoading && <p style={{ color: 'var(--text-2)', fontSize: 13 }}>Loading…</p>}
        {!!error && (
          <p style={{ color: colors.loss, fontSize: 12, marginBottom: 8 }}>
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
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>ETH-USDC</p>
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                  {new Date(Number(trade.timestamp) * 1000).toLocaleDateString()}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' as const, color: trade.isLong ? colors.profit : colors.loss }}>
                  {trade.isLong ? 'Long' : 'Short'}
                </p>
                <p style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: 2, color: BigInt(trade.pnl ?? '0') >= 0n ? colors.profit : colors.loss }}>
                  {formatPnl(BigInt(trade.pnl ?? '0'))}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BalCard({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 12px' }}>
      <p className="label" style={{ marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: valueColor ?? 'var(--text)' }}>
        {value}
      </p>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <p className="label">Vault Collateral</p>
        <span style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: colors.accent }}>
          {formatUSD(collateralBalance, 6)}
        </span>
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
            style={{ fontSize: 14, padding: '9px 14px' }}
          />
          <span style={{ padding: '0 10px 0 0', fontSize: 11, color: 'var(--text-2)' }}>USDC</span>
        </div>
        <button className="btn btn-accent" onClick={() => void handleDeposit()} disabled={!parsedAmount || status.isLoading} style={{ height: 42 }}>Deposit</button>
        <button className="btn btn-ghost" onClick={() => void handleWithdraw()} disabled={!parsedAmount || status.isLoading} style={{ height: 42 }}>Withdraw</button>
      </div>
      {status.error && <p style={{ color: colors.loss, fontSize: 11, marginTop: 8 }}>{status.error.message.slice(0, 80)}</p>}
      {status.isSuccess && <p style={{ color: colors.accent, fontSize: 11, marginTop: 8 }}>✓ Confirmed</p>}
    </div>
  );
}
