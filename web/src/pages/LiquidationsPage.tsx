import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { fetchAtRiskPositions, fetchLiquidations, type GqlLiquidation } from '../services/graphService';
import { useTrade } from '../hooks/useTrade';
import { formatPrice, formatUSD } from '../utils/formatting';
import { colors } from '../theme/colors';

const WARN_RATIO = 10;

function shortenAddress(addr: string): string {
  if (!addr) return '--';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function LiquidationsPage() {
  const { address } = useAccount();
  const { liquidate, status } = useTrade();

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
      alert('Position liquidated! Bonus sent to your wallet.');
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string };
      alert(`Liquidation failed: ${err?.shortMessage ?? err?.message ?? 'Unknown error'}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ color: colors.textPrimary, fontSize: 20, fontWeight: 800, margin: 0 }}>
          Liquidation Monitor
        </h2>
        <p style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
          Earn 5% bonus by liquidating at-risk positions.
        </p>
      </div>

      {/* At-risk positions */}
      <section>
        <h3 style={{ color: colors.textPrimary, fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
          At Risk ({atRisk.length})
        </h3>

        {loadingAtRisk && (
          <span style={{ color: colors.textSecondary, fontSize: 13 }}>Loading...</span>
        )}
        {!loadingAtRisk && atRisk.length === 0 && (
          <span style={{ color: colors.textSecondary, fontSize: 13 }}>No positions at risk</span>
        )}

        {atRisk.map((pos: any) => {
          const marginRatio = parseFloat(pos.marginRatio ?? '100');
          const isAtRisk = marginRatio <= WARN_RATIO;
          return (
            <div
              key={pos.id}
              style={{
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: 14,
                padding: 14,
                marginBottom: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 600 }}>
                  {shortenAddress(pos.trader)}
                </span>
                <span
                  style={{
                    background: isAtRisk ? colors.loss + '22' : colors.bgHighlight,
                    color: isAtRisk ? colors.loss : colors.textSecondary,
                    borderRadius: 6,
                    padding: '2px 8px',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {marginRatio.toFixed(2)}% margin
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
                <Detail label="Side" value={pos.isLong ? 'Long' : 'Short'} />
                <Detail label="Size" value={formatUSD(BigInt(pos.size ?? '0'), 18)} />
                <Detail label="Entry" value={`$${formatPrice(BigInt(pos.entryPrice ?? '0'))}`} />
                <Detail label="Lev" value={`${pos.leverage}x`} />
              </div>

              {address && (
                <button
                  onClick={() => handleLiquidate(pos.trader)}
                  disabled={status.isLoading}
                  style={{
                    width: '100%',
                    background: colors.loss,
                    border: 'none',
                    borderRadius: 10,
                    color: colors.textPrimary,
                    fontWeight: 700,
                    fontSize: 13,
                    padding: '10px 0',
                    cursor: status.isLoading ? 'not-allowed' : 'pointer',
                    opacity: status.isLoading ? 0.6 : 1,
                  }}
                >
                  {status.isLoading ? 'Liquidating...' : 'Liquidate (+5% bonus)'}
                </button>
              )}
            </div>
          );
        })}
      </section>

      {/* Recent liquidations */}
      <section>
        <h3 style={{ color: colors.textPrimary, fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
          Recent Liquidations
        </h3>

        {loadingRecent && (
          <span style={{ color: colors.textSecondary, fontSize: 13 }}>Loading...</span>
        )}
        {!loadingRecent && recent.length === 0 && (
          <span style={{ color: colors.textSecondary, fontSize: 13 }}>No recent liquidations</span>
        )}

        {recent.slice(0, 10).map((liq: any, i: number) => (
          <div
            key={liq.id ?? i}
            style={{
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              padding: 12,
              marginBottom: 8,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 600 }}>
                {shortenAddress(liq.trader)}
              </div>
              <div style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                {new Date(Number(liq.timestamp) * 1000).toLocaleString()}
              </div>
            </div>
            <span style={{ color: colors.profit, fontWeight: 700, fontSize: 13 }}>
              +{formatUSD(BigInt(liq.bonus ?? '0'), 18)}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: colors.textMuted, fontSize: 11, marginBottom: 2 }}>{label}</div>
      <div style={{ color: colors.textPrimary, fontSize: 12, fontWeight: 600 }}>{value}</div>
    </div>
  );
}
