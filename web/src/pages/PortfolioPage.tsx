import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { useWalletStore } from '../store/useWalletStore';
import { fetchTraderHistory } from '../services/graphService';
import { formatUSD, formatPnl } from '../utils/formatting';
import { colors } from '../theme/colors';
import { useCollateral } from '../hooks/useCollateral';

export function PortfolioPage() {
  const { address } = useAccount();
  const { usdcBalance, ethBalance } = useWalletStore();

  const { data: history = [], isLoading, refetch } = useQuery({
    queryKey: ['traderHistory', address],
    queryFn: () => fetchTraderHistory(address!),
    enabled: !!address,
    refetchInterval: 30_000,
  });

  const totalRealizedPnl = history.reduce(
    (acc: bigint, t: any) => acc + BigInt(t.pnl ?? '0'),
    0n,
  );

  if (!address) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 80 }}>
        <span style={{ color: colors.textSecondary, fontSize: 14 }}>
          Connect your wallet to view portfolio
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ color: colors.textPrimary, fontSize: 20, fontWeight: 800, margin: 0 }}>Portfolio</h2>
        <button
          onClick={() => void refetch()}
          style={{
            background: colors.bgHighlight,
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            color: colors.textSecondary,
            fontSize: 12,
            padding: '6px 12px',
            cursor: 'pointer',
          }}
        >
          Refresh
        </button>
      </div>

      {/* Balances */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <BalanceCard label="USDC Balance" value={usdcBalance != null ? formatUSD(BigInt(usdcBalance), 6) : '--'} />
        <BalanceCard
          label="ETH Balance"
          value={ethBalance != null ? `${(Number(ethBalance) / 1e18).toFixed(4)} ETH` : '--'}
        />
        <BalanceCard
          label="Realized PnL"
          value={formatPnl(totalRealizedPnl)}
          valueColor={totalRealizedPnl >= 0n ? colors.profit : colors.loss}
        />
      </div>

      {/* Collateral */}
      <CollateralPanel />

      {/* Trade history */}
      <h3 style={{ color: colors.textPrimary, fontSize: 14, fontWeight: 700, margin: 0 }}>Trade History</h3>

      {isLoading && <span style={{ color: colors.textSecondary, fontSize: 13 }}>Loading...</span>}
      {!isLoading && history.length === 0 && (
        <span style={{ color: colors.textSecondary, fontSize: 13 }}>No trades yet</span>
      )}

      {history.map((trade: any, i: number) => (
        <div
          key={trade.id ?? i}
          style={{
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 600 }}>ETH-USDC</div>
            <div style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
              {new Date(Number(trade.timestamp) * 1000).toLocaleDateString()}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: trade.isLong ? colors.profit : colors.loss, fontSize: 11, fontWeight: 700 }}>
              {trade.isLong ? 'Long' : 'Short'}
            </div>
            <div
              style={{
                color: BigInt(trade.pnl ?? '0') >= 0n ? colors.profit : colors.loss,
                fontSize: 13,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                marginTop: 2,
              }}
            >
              {formatPnl(BigInt(trade.pnl ?? '0'))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CollateralPanel() {
  const { collateralBalance, deposit, withdraw, status, resetStatus } = useCollateral();
  const [rawAmount, setRawAmount] = useState('');

  const parsedAmount = (() => {
    const n = parseFloat(rawAmount);
    if (!rawAmount || isNaN(n) || n <= 0) return null;
    return BigInt(Math.round(n * 1_000_000)); // USDC 6 decimals
  })();

  const handleDeposit = async () => {
    if (!parsedAmount) return;
    try {
      await deposit(parsedAmount);
      setRawAmount('');
    } catch { /* error surfaced via status */ }
  };

  const handleWithdraw = async () => {
    if (!parsedAmount) return;
    try {
      await withdraw(parsedAmount);
      setRawAmount('');
    } catch { /* error surfaced via status */ }
  };

  return (
    <div
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 14,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: colors.textPrimary, fontSize: 14, fontWeight: 700 }}>
          Vault Collateral
        </span>
        <span style={{ color: colors.primary, fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {formatUSD(collateralBalance, 6)}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="number"
          min="0"
          placeholder="USDC amount"
          value={rawAmount}
          onChange={(e) => { resetStatus(); setRawAmount(e.target.value); }}
          style={{
            flex: 1,
            background: colors.bgInput,
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            color: colors.textPrimary,
            fontSize: 14,
            padding: '8px 12px',
            outline: 'none',
          }}
        />
        <button
          onClick={() => void handleDeposit()}
          disabled={!parsedAmount || status.isLoading}
          style={{
            background: parsedAmount && !status.isLoading ? colors.primary : colors.bgHighlight,
            border: 'none',
            borderRadius: 8,
            color: parsedAmount && !status.isLoading ? '#000' : colors.textMuted,
            fontSize: 13,
            fontWeight: 700,
            padding: '8px 16px',
            cursor: parsedAmount && !status.isLoading ? 'pointer' : 'not-allowed',
          }}
        >
          {status.isLoading ? '...' : 'Deposit'}
        </button>
        <button
          onClick={() => void handleWithdraw()}
          disabled={!parsedAmount || status.isLoading}
          style={{
            background: colors.bgHighlight,
            border: `1px solid ${colors.borderLight}`,
            borderRadius: 8,
            color: parsedAmount && !status.isLoading ? colors.textPrimary : colors.textMuted,
            fontSize: 13,
            fontWeight: 700,
            padding: '8px 16px',
            cursor: parsedAmount && !status.isLoading ? 'pointer' : 'not-allowed',
          }}
        >
          {status.isLoading ? '...' : 'Withdraw'}
        </button>
      </div>

      {status.isSuccess && (
        <span style={{ color: colors.profit, fontSize: 12 }}>Transaction confirmed!</span>
      )}
      {status.error && (
        <span style={{ color: colors.loss, fontSize: 12 }}>
          {status.error.message.slice(0, 80)}
        </span>
      )}
    </div>
  );
}

function BalanceCard({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 14,
        padding: 14,
      }}
    >
      <div style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6 }}>{label}</div>
      <div
        style={{
          color: valueColor ?? colors.textPrimary,
          fontSize: 15,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  );
}
