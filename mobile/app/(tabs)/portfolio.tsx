import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useAccount } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { useWalletStore } from '../../src/store/useWalletStore';
import { fetchTraderHistory } from '../../src/services/graphService';
import { formatUSD, formatPnl, formatPrice } from '../../src/utils/formatting';
import { colors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';
import { useCollateral } from '../../src/hooks/useCollateral';

export default function PortfolioScreen() {
  const { address } = useAccount();
  const { usdcBalance, ethBalance } = useWalletStore();

  const {
    data: history = [],
    isLoading,
    refetch,
  } = useQuery({
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
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Connect wallet to view portfolio</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={styles.heading}>Portfolio</Text>

        {/* Balances */}
        <View style={styles.balanceGrid}>
          <BalanceCard
            label="USDC Balance"
            value={usdcBalance != null ? formatUSD(BigInt(usdcBalance), 6) : '—'}
          />
          <BalanceCard
            label="ETH Balance"
            value={
              ethBalance != null
                ? `${(Number(ethBalance) / 1e18).toFixed(4)} ETH`
                : '—'
            }
          />
          <BalanceCard
            label="Realized PnL"
            value={formatPnl(totalRealizedPnl)}
            valueColor={
              totalRealizedPnl >= 0n ? colors.profit : colors.loss
            }
          />
        </View>

        {/* Collateral */}
        <CollateralPanel />

        {/* Trade history */}
        <Text style={styles.sectionTitle}>Trade History</Text>
        {history.length === 0 && (
          <Text style={styles.emptyText}>No trades yet</Text>
        )}
        {history.map((trade: any, i: number) => (
          <View key={trade.id ?? i} style={styles.historyRow}>
            <View>
              <Text style={styles.historyMarket}>ETH-USDC</Text>
              <Text style={styles.historyTime}>
                {new Date(Number(trade.timestamp) * 1000).toLocaleDateString()}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.historySide,
                { color: trade.isLong ? colors.profit : colors.loss }]}>
                {trade.isLong ? 'Long' : 'Short'}
              </Text>
              <Text
                style={[
                  styles.historyPnl,
                  { color: BigInt(trade.pnl ?? '0') >= 0n ? colors.profit : colors.loss },
                ]}
              >
                {formatPnl(BigInt(trade.pnl ?? '0'))}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function BalanceCard({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.balanceCard}>
      <Text style={styles.balanceLabel}>{label}</Text>
      <Text style={[styles.balanceValue, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, gap: 16 },
  heading: {
    color: colors.textPrimary,
    fontSize: typography.xl,
    fontWeight: '800',
  },
  center: { flex: 1, alignItems: 'center', paddingTop: 80 },
  emptyText: {
    color: colors.textSecondary,
    fontSize: typography.sm,
    textAlign: 'center',
  },
  balanceGrid: { gap: 10 },
  balanceCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: { color: colors.textSecondary, fontSize: typography.sm },
  balanceValue: {
    color: colors.textPrimary,
    fontSize: typography.md,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: typography.md,
    fontWeight: '700',
    marginTop: 4,
  },
  historyRow: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyMarket: { color: colors.textPrimary, fontSize: typography.sm, fontWeight: '600' },
  historyTime: { color: colors.textMuted, fontSize: typography.xs, marginTop: 2 },
  historySide: { fontSize: typography.xs, fontWeight: '700' },
  historyPnl: {
    fontSize: typography.sm,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  // Collateral panel
  collateralPanel: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  collateralHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  collateralTitle: { color: colors.textPrimary, fontSize: typography.md, fontWeight: '700' },
  collateralBalance: {
    color: colors.primary,
    fontSize: typography.md,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  collateralRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  collateralInput: {
    flex: 1,
    backgroundColor: colors.bgInput,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: typography.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  btnDeposit: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  btnDepositDisabled: {
    backgroundColor: colors.bgHighlight,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  btnWithdraw: {
    backgroundColor: colors.bgHighlight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  btnText: { fontSize: typography.sm, fontWeight: '700' },
  feedbackSuccess: { color: colors.profit, fontSize: typography.xs },
  feedbackError: { color: colors.loss, fontSize: typography.xs },
});

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
    <View style={styles.collateralPanel}>
      <View style={styles.collateralHeader}>
        <Text style={styles.collateralTitle}>Vault Collateral</Text>
        <Text style={styles.collateralBalance}>{formatUSD(collateralBalance, 6)}</Text>
      </View>

      <View style={styles.collateralRow}>
        <TextInput
          style={styles.collateralInput}
          placeholder="USDC amount"
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          value={rawAmount}
          onChangeText={(t) => { resetStatus(); setRawAmount(t); }}
        />
        <TouchableOpacity
          style={parsedAmount && !status.isLoading ? styles.btnDeposit : styles.btnDepositDisabled}
          onPress={() => void handleDeposit()}
          disabled={!parsedAmount || status.isLoading}
        >
          <Text style={[styles.btnText, { color: parsedAmount && !status.isLoading ? '#000' : colors.textMuted }]}>
            {status.isLoading ? '...' : 'Deposit'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnWithdraw}
          onPress={() => void handleWithdraw()}
          disabled={!parsedAmount || status.isLoading}
        >
          <Text style={[styles.btnText, { color: parsedAmount && !status.isLoading ? colors.textPrimary : colors.textMuted }]}>
            {status.isLoading ? '...' : 'Withdraw'}
          </Text>
        </TouchableOpacity>
      </View>

      {status.isSuccess && (
        <Text style={styles.feedbackSuccess}>Transaction confirmed!</Text>
      )}
      {status.error && (
        <Text style={styles.feedbackError}>{status.error.message.slice(0, 80)}</Text>
      )}
    </View>
  );
}
