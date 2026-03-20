import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { fetchAtRiskPositions, fetchLiquidations, type GqlLiquidation } from '../services/graphService';
import { useTrade } from '../hooks/useTrade';
import { formatPrice, formatUSD } from '../utils/formatting';
import { calcLiquidationPrice } from '../utils/pnl';
import { colors } from '../theme/colors';

function short(addr: string) {
  if (!addr) return '—';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function LiquidationsPage() {
  const { address } = useAccount();
  const { liquidate, status } = useTrade();

  if (!address) return (
    <div className="empty"><p>Connect your wallet to view liquidations.</p></div>
  );

  const { data: atRisk = [], isLoading: loadingAtRisk, refetch: refetchAtRisk } = useQuery({
    queryKey: ['atRisk'],
    queryFn: fetchAtRiskPositions,
    refetchInterval: 10_000,
  });

  const { data: recent = [], isLoading: loadingRecent } = useQuery<GqlLiquidation[]>({
    queryKey: ['liquidations'],
    queryFn: () => fetchLiquidations(),
    refetchInterval: 15_000,
  });

  const handleLiquidate = async (trader: string) => {
    try {
      await liquidate(trader as `0x${string}`);
      refetchAtRisk();
      alert('Liquidated — 5% bonus sent to your wallet.');
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string };
      alert(`Liquidation failed: ${err?.shortMessage ?? err?.message ?? 'Unknown'}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Liquidations</h2>
        <p style={{ fontSize: 14, color: 'var(--text-2)' }}>
          Earn a 5% bonus by liquidating under-margined positions.
        </p>
      </div>

      {/* At-risk positions */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <p className="label">At risk ({atRisk.length})</p>
          <button className="btn btn-ghost" onClick={() => void refetchAtRisk()} style={{ height: 36, fontSize: 13 }}>Refresh</button>
        </div>

{loadingAtRisk && <p style={{ color: 'var(--text-2)', fontSize: 15 }}>Loading…</p>}

        {!loadingAtRisk && atRisk.length === 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '20px 16px', textAlign: 'center', color: 'var(--text-2)', fontSize: 12 }}>
            No positions at risk
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {atRisk.map((pos: any) => {
            const marginRatio = parseFloat(pos.marginRatio ?? '100');
            return (
              <div
                key={pos.id}
                style={{ background: 'var(--surface)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 12, padding: 14 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{short(pos.trader)}</p>
                    <p style={{ fontSize: 12, marginTop: 2, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' as const, color: pos.isLong ? colors.profit : colors.loss }}>
                      {pos.isLong ? 'Long' : 'Short'} · {pos.leverage}×
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 12, color: 'var(--text-2)' }}>Margin ratio</p>
                    <p style={{ fontSize: 17, fontWeight: 700, color: colors.loss, fontVariantNumeric: 'tabular-nums' }}>
                      {marginRatio.toFixed(1)}%
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  <div className="stat-row" style={{ fontSize: 14 }}>
                    <span className="key">Size</span>
                    <span className="val">{formatUSD(BigInt(pos.size ?? '0'), 6)}</span>
                  </div>
                  <div className="stat-row" style={{ fontSize: 14 }}>
                    <span className="key">Margin</span>
                    <span className="val">{formatUSD(BigInt(pos.margin ?? '0'), 6)}</span>
                  </div>
                  <div className="stat-row" style={{ fontSize: 14 }}>
                    <span className="key">Entry</span>
                    <span className="val">${formatPrice(BigInt(pos.entryPrice ?? '0'))}</span>
                  </div>
                  <div className="stat-row" style={{ fontSize: 14 }}>
                    <span className="key">Liq. price</span>
                    <span className="val" style={{ color: colors.loss }}>
                      ${formatPrice(calcLiquidationPrice(
                        pos.isLong,
                        BigInt(pos.size ?? '0'),
                        BigInt(pos.margin ?? '0'),
                        BigInt(pos.entryPrice ?? '0'),
                      ))}
                    </span>
                  </div>
                </div>
                <button
                  className="btn btn-danger"
                  onClick={() => handleLiquidate(pos.trader)}
                  disabled={status.isLoading}
                  style={{ width: '100%', height: 38 }}
                >
                  {status.isLoading ? 'Confirming…' : 'Liquidate (+5% bonus)'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {(recent.length > 0 || loadingRecent) && (
        <div>
          <p className="label" style={{ marginBottom: 10 }}>Recent</p>
          {loadingRecent && <p style={{ color: 'var(--text-2)', fontSize: 15 }}>Loading…</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {recent.slice(0, 10).map((liq: any, i: number) => (
              <div
                key={liq.id ?? i}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}
              >
                <div>
                  <p style={{ fontSize: 14, color: 'var(--text)' }}>{short(liq.trader)}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                    {new Date(Number(liq.timestamp) * 1000).toLocaleDateString()}
                  </p>
                </div>
                <span style={{ fontSize: 14, color: colors.profit, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  +{formatUSD(BigInt(liq.bonus ?? '0'), 18)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
